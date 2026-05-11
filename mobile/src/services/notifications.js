import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { navigateFromAnywhere } from '../navigation/AppNavigator';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Schedulable trigger shape changed in expo-notifications 0.28+ (SDK 52).
// Fall back to the legacy shape on older installs so either version works.
const SchedulableTriggerInputTypes =
  Notifications.SchedulableTriggerInputTypes ?? {};

const DAILY_REMINDER_ID = 'ascend-daily-reminder';
const EVENING_REMINDER_ID = 'ascend-evening-reminder';
const WEEKLY_RECAP_ID = 'ascend-weekly-recap';
const STREAK_AT_RISK_ID = 'ascend-streak-at-risk';
const COMEBACK_ID = 'ascend-comeback';

// Category IDs — pre-registered with the system so notifications can
// declare which set of action buttons they want. Set in setupNotifCategories.
const CAT_LESSON_REMINDER = 'ascend.lesson-reminder';

/**
 * Register notification categories with iOS so notifications referencing
 * these category IDs render with action buttons (e.g., "Start Lesson").
 * Idempotent — safe to call on every boot.
 *
 * One-time setup; should be called once during app init.
 */
export const setupNotifCategories = async () => {
  try {
    await Notifications.setNotificationCategoryAsync(CAT_LESSON_REMINDER, [
      {
        identifier: 'start_lesson',
        buttonTitle: i18n.t('notifications.actionStartLesson'),
        options: {
          // Open the app to handle the action. Required for navigation.
          opensAppToForeground: true,
        },
      },
    ]);
  } catch (e) {
    console.warn('setupNotifCategories failed:', e?.message);
  }
};

// Listener registry — kept so we can detach on hot reload.
let responseSub = null;

/**
 * Wire the notification response handler. Triggers when the user taps
 * the notification body OR an action button. Idempotent — safe to call
 * multiple times (we detach the previous sub first).
 *
 * The action handler navigates the user to the "Lessons" tab via the
 * top-level navigation ref. If the app is cold-booting, navigation may
 * not be ready yet — the user lands on the default home tab instead,
 * which is still useful (one tap from there to start a lesson).
 */
export const setupNotifResponseListener = () => {
  try {
    if (responseSub?.remove) responseSub.remove();
  } catch {}
  try {
    responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const action = response?.actionIdentifier;
        // The category buttons report their identifier. The "default"
        // identifier means the user tapped the notification body.
        const isStartLesson =
          action === 'start_lesson' ||
          action === Notifications.DEFAULT_ACTION_IDENTIFIER;
        if (!isStartLesson) return;
        // Land on Paths tab — the user can tap the "Today's mission"
        // card from there to enter their next lesson. We don't deep-
        // link directly to a specific lesson because the notification
        // doesn't carry path/lesson context, and Home → Path is one tap.
        navigateFromAnywhere('MainTabs', { screen: 'Home' });
      },
    );
  } catch (e) {
    console.warn('setupNotifResponseListener failed:', e?.message);
  }
};

export const requestNotificationPermissions = async () => {
  if (!Device.isDevice) {
    console.log('Notifications require a physical device');
    return false;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return false;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Ascend',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  return true;
};

/**
 * Schedule a 9 AM daily reminder. Branches title/body on whether the user
 * has an active streak: "Begin monk mode" for first-day users vs.
 * "{n} days — discipline" for users carrying a streak. The previous
 * version passed `{ streak: '' }` which produced "🔥  days — discipline"
 * (double space + dangling word) — visually broken on the lock screen.
 *
 * @param {Object} [opts]
 * @param {number} [opts.currentStreak=0]  caller's current streak (from
 *   useApp().currentStreak), used to pick the right copy.
 */
export const scheduleDailyReminder = async ({ currentStreak = 0 } = {}) => {
  // Replace any previously scheduled copy of the same reminder so we don't
  // pile up duplicates every app launch.
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  } catch {
    // no-op — notification may not exist yet
  }

  const hasStreak = (currentStreak || 0) > 0;
  const title = hasStreak
    ? i18n.t('notifications.reminderTitleProgress', { streak: currentStreak })
    : i18n.t('notifications.reminderTitleStart');
  const body = hasStreak
    ? i18n.t('notifications.reminderBodyProgress')
    : i18n.t('notifications.reminderBodyStart');

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title,
      body,
      sound: true,
      // Renders the "Start Lesson" action button below the body when
      // the user long-presses the notification or pulls down the
      // notification center entry. Big retention lift — one tap from
      // push to in-lesson.
      categoryIdentifier: CAT_LESSON_REMINDER,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY ?? 'daily',
      hour: 9,
      minute: 0,
    },
  });
};

/**
 * Evening (8 PM today) reminder for users at risk of breaking their streak.
 *
 * @param {Object} [opts]
 * @param {number} [opts.currentStreak=0]
 */
export const scheduleStreakReminder = async ({ currentStreak = 0 } = {}) => {
  // Evening reminder at 8 PM today if we're still before 8 PM.
  const now = new Date();
  const evening = new Date();
  evening.setHours(20, 0, 0, 0);
  if (now >= evening) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(EVENING_REMINDER_ID);
  } catch {
    // no-op
  }

  const hasStreak = (currentStreak || 0) > 0;
  const title = hasStreak
    ? i18n.t('notifications.reminderTitleDanger', { streak: currentStreak })
    : i18n.t('notifications.reminderTitleStart');

  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_REMINDER_ID,
    content: {
      title,
      body: i18n.t('notifications.reminderBodyDanger'),
      sound: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE ?? 'date',
      date: evening,
    },
  });
};

/**
 * Streak-at-risk: schedule a 21:00 push for today only IF the user hasn't
 * completed today's lesson. The body is loss-aversion framed because that's
 * empirically the strongest re-engagement trigger. Re-call on every app open
 * and on every lesson completion to keep state right.
 *
 * @param {Object} ctx
 * @param {boolean} ctx.todayCompleted
 * @param {number} ctx.currentStreak
 * @param {boolean} ctx.onVacation
 */
export const scheduleStreakAtRiskReminder = async ({
  todayCompleted,
  currentStreak,
  onVacation,
}) => {
  // Always cancel any existing copy first — we re-derive on every call.
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_AT_RISK_ID);
  } catch {}

  // No-op if user already completed today, has no streak to lose, or is on
  // vacation (streak frozen — no risk).
  if (todayCompleted) return;
  if ((currentStreak || 0) < 2) return;
  if (onVacation) return;

  const now = new Date();
  const target = new Date();
  target.setHours(21, 0, 0, 0);
  if (now >= target) return; // too late today, daily reminder already covers tomorrow

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_AT_RISK_ID,
    content: {
      title: i18n.t('notifications.streakAtRiskTitle', { streak: currentStreak }),
      body: i18n.t('notifications.streakAtRiskBody'),
      sound: true,
      // Streak-at-risk is the highest-urgency push — show "Start Lesson"
      // action button so the user can act without navigating manually.
      categoryIdentifier: CAT_LESSON_REMINDER,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE ?? 'date',
      date: target,
    },
  });
};

/**
 * Comeback: when a user has been gone 3+ days, schedule a one-shot
 * re-engagement push for tomorrow morning. Cancelled the moment they open
 * the app again, so it only fires for genuine drop-offs.
 *
 * @param {Object} ctx
 * @param {string|null} ctx.lastCompletedDate
 */
export const scheduleComebackReminder = async ({ lastCompletedDate }) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(COMEBACK_ID);
  } catch {}
  if (!lastCompletedDate) return;
  const last = new Date(lastCompletedDate);
  if (Number.isNaN(last.getTime())) return;
  const daysSince = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince < 3) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  await Notifications.scheduleNotificationAsync({
    identifier: COMEBACK_ID,
    content: {
      title: i18n.t('notifications.comebackTitle'),
      body: i18n.t('notifications.comebackBody', { days: daysSince }),
      sound: true,
      // Comeback push targets a dormant user — give them a one-tap
      // way back via the action button.
      categoryIdentifier: CAT_LESSON_REMINDER,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE ?? 'date',
      date: tomorrow,
    },
  });
};

export const cancelComebackReminder = async () => {
  try {
    await Notifications.cancelScheduledNotificationAsync(COMEBACK_ID);
  } catch {}
};

/**
 * Schedule a weekly recap notification — every Sunday at 19:00 local time.
 * The notification is the come-back trigger that pulls the user into the
 * Stats tab on the slowest engagement day of the week.
 */
export const scheduleWeeklyRecap = async () => {
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_RECAP_ID);
  } catch {
    // no-op
  }
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_RECAP_ID,
    content: {
      title: i18n.t('notifications.weeklyRecapTitle'),
      body: i18n.t('notifications.weeklyRecapBody'),
      sound: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.WEEKLY ?? 'weekly',
      // 1 = Sunday in expo-notifications' weekly trigger
      weekday: 1,
      hour: 19,
      minute: 0,
    },
  });
};

export const sendCelebrationNotification = async (title, body) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null, // immediate
  });
};

export const cancelAllNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
