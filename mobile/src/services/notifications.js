import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
const EVENING_INSIGHT_ID = 'ascend-evening-insight';
const WEEKLY_RECAP_ID = 'ascend-weekly-recap';
const STREAK_AT_RISK_ID = 'ascend-streak-at-risk';
const COMEBACK_ID = 'ascend-comeback';
// D1 / D3 first-week hooks — schedule once at onboarding-finish. These
// are the highest-leverage push slots: brand-new users have no streak to
// lose, so the daily 9 AM reminder is their only outside-app touchpoint,
// and one bland message at 9 AM doesn't beat the post-install novelty
// decay. D1 (next-day evening) catches "did you forget us?", D3 catches
// "you said you'd start — three days in, here we are."
const D1_HOOK_ID = 'ascend-d1-hook';
const D3_HOOK_ID = 'ascend-d3-hook';

// Pool size for the rotating daily reminder copy. Variants live in i18n
// (notifications.dailyStart{N}Title/Body and notifications.dailyProgress
// {N}Title/Body). Bumped from 4/6 → 20/20 after the retention audit
// flagged push muting as a D14 risk: a user who saw the same 4 starting
// messages for two weeks stopped reading them.
const DAILY_START_VARIANTS = 20;   // for users with no streak yet
const DAILY_PROGRESS_VARIANTS = 20; // for users with an active streak

// AsyncStorage key holding the last few variant indices we've already
// shown, per pool. We exclude these from the random pick so a user
// never sees the same line two days in a row, and rarely sees the
// same line twice within a week. The blacklist is intentionally
// small (7) — much larger would force unnatural-feeling rotation.
const RECENT_VARIANT_BLACKLIST_KEY = '@ascend/recent_variants_v1';
const BLACKLIST_LENGTH = 7;

/**
 * Read the recent-variants blacklist from AsyncStorage. Returns
 * `{ start: [], progress: [] }` on any error or first call.
 */
const readRecentVariants = async () => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_VARIANT_BLACKLIST_KEY);
    if (!raw) return { start: [], progress: [] };
    const parsed = JSON.parse(raw);
    return {
      start: Array.isArray(parsed?.start) ? parsed.start : [],
      progress: Array.isArray(parsed?.progress) ? parsed.progress : [],
    };
  } catch {
    return { start: [], progress: [] };
  }
};

/**
 * Push a chosen variant index onto the recent-list for its pool and
 * trim to BLACKLIST_LENGTH. Best-effort — silent on error.
 */
const recordVariantSeen = async (pool, idx) => {
  try {
    const recent = await readRecentVariants();
    const list = [idx, ...(recent[pool] || []).filter((v) => v !== idx)].slice(
      0,
      BLACKLIST_LENGTH,
    );
    await AsyncStorage.setItem(
      RECENT_VARIANT_BLACKLIST_KEY,
      JSON.stringify({ ...recent, [pool]: list }),
    );
  } catch {
    // no-op
  }
};

/**
 * Pick today's variant index. Tries to avoid the last BLACKLIST_LENGTH
 * indices the user has already seen in this pool. Falls back to the
 * old day-of-year deterministic pick if blacklist read fails — same
 * behaviour as before the upgrade.
 */
const pickDailyVariantIndex = async (variantCount, pool) => {
  const recent = await readRecentVariants();
  const blacklist = new Set(recent[pool] || []);
  const candidates = [];
  for (let i = 0; i < variantCount; i++) {
    if (!blacklist.has(i)) candidates.push(i);
  }
  // If everything is blacklisted (variantCount <= BLACKLIST_LENGTH on a
  // very small pool — shouldn't happen with 20 vs 7, but defensive),
  // fall back to the deterministic legacy pick so we never crash.
  if (candidates.length === 0) {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - yearStart) / (1000 * 60 * 60 * 24));
    return dayOfYear % Math.max(1, variantCount);
  }
  // Random pick from the un-blacklisted candidates.
  return candidates[Math.floor(Math.random() * candidates.length)];
};

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
 * Register the device's Expo push token in the `public.push_tokens`
 * table so the broadcast-push Edge Function can target this user from
 * the server. Idempotent + fire-and-forget — if anything fails, the
 * app still works, the user just won't get server-initiated pushes.
 *
 * No-op when:
 *   - Running in a simulator (Device.isDevice is false)
 *   - Notification permissions aren't granted
 *   - No authenticated user yet (caller passes userId === null)
 *
 * Caller: AppContext effect after sign-in. Safe to call multiple
 * times — the upsert keys on user_id (primary key in push_tokens),
 * so the latest device's token always wins (a user with two devices
 * gets push on the most-recently-active one — acceptable tradeoff
 * for v1 to keep the schema simple).
 *
 * @param {string|null} userId Authenticated user id, or null to no-op.
 * @param {object} supabase   Supabase client (passed in to avoid an
 *                            import cycle between services/).
 * @returns {Promise<string|null>} The registered token, or null on no-op/error.
 */
export const registerPushToken = async (userId, supabase) => {
  if (!userId || !supabase) return null;
  if (!Device.isDevice) return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    // expo-notifications requires projectId for the token API since
    // SDK 49. We read it from app.json → expo.extra.eas.projectId via
    // Constants. Without this, getExpoPushTokenAsync throws.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      null;
    if (!projectId) {
      console.warn('[notifications] No projectId — cannot fetch push token');
      return null;
    }

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoToken = tokenResp?.data;
    if (!expoToken) return null;

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_token: expoToken,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) {
      console.warn('[notifications] push token upsert failed:', error.message);
      return null;
    }
    return expoToken;
  } catch (e) {
    console.warn('[notifications] registerPushToken exception:', e?.message);
    return null;
  }
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
// Path-optimal reminder hour. Each discipline path has a natural
// "best time of day to engage" — pushing the silent-morning user at
// 9 PM is a waste, pushing the body-discipline user at 7 AM ditto.
// Times tuned for TR habits (most users wake 7-8, work 9-18,
// dinner 19-20, sleep 23-24).
const PATH_OPTIMAL_HOUR = {
  'silent-morning': 7, // wake-and-do — earliest slot
  'mind-discipline': 9, // settle-into-work-then-focus
  'money-discipline': 10, // weekday: post-morning-rush; weekend: brunch budget
  'body-discipline': 18, // post-work, pre-dinner: gym window
  'dopamine-detox': 20, // evening phone-detox prime time
};

export const scheduleDailyReminder = async ({
  currentStreak = 0,
  userName = '',
  archetypeName = '',
  activePathId = null,
} = {}) => {
  // Replace any previously scheduled copy of the same reminder so we don't
  // pile up duplicates every app launch.
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  } catch {
    // no-op — notification may not exist yet
  }

  // Rotate through a pool of copy by day-of-year so users don't see the
  // same line every morning. Falls back to the legacy reminderTitleStart/
  // reminderTitleProgress keys when a variant key is missing (so a partial
  // i18n drop still works).
  const hasStreak = (currentStreak || 0) > 0;
  const variantCount = hasStreak ? DAILY_PROGRESS_VARIANTS : DAILY_START_VARIANTS;
  const pool = hasStreak ? 'progress' : 'start';
  const variantIdx = await pickDailyVariantIndex(variantCount, pool);
  // Record this pick so tomorrow's pick can avoid it. Fire-and-forget;
  // a failed write just means the next pick might repeat — annoying
  // but never fatal.
  recordVariantSeen(pool, variantIdx).catch(() => {});
  const prefix = hasStreak ? 'dailyProgress' : 'dailyStart';
  const fallbackTitleKey = hasStreak
    ? 'notifications.reminderTitleProgress'
    : 'notifications.reminderTitleStart';
  const fallbackBodyKey = hasStreak
    ? 'notifications.reminderBodyProgress'
    : 'notifications.reminderBodyStart';

  // Personalised vocative: "Berk, ..." prefixed onto the title when the
  // user gave us a name in onboarding. Empty/null name falls through to
  // the generic title — never produces "  ," or a dangling comma.
  const trimmedName = (userName || '').trim();
  const interpolations = { streak: currentStreak, name: trimmedName };

  const rawTitle = i18n.t(
    `notifications.${prefix}${variantIdx}Title`,
    {
      defaultValue: i18n.t(fallbackTitleKey, interpolations),
      ...interpolations,
    },
  );
  // Three-way personalisation rotation by variantIdx % 3:
  //   0 → archetype prefix ("Sessiz Savaşçı, bugün başla")
  //   1 → name prefix ("Berk, bugün başla")
  //   2 → generic (no prefix)
  // Either prefix collapses to the next slot's behaviour if the
  // corresponding string is empty — so an archetype-less user just
  // sees name/generic alternation, exactly the old behaviour.
  // This makes the archetype choice STICK in the daily reminder
  // surface — every third push reminds the user who they said
  // they're becoming, free retention reinforcement.
  const trimmedArchetype = (archetypeName || '').trim();
  const slot = variantIdx % 3;
  let title;
  if (slot === 0 && trimmedArchetype) {
    title = `${trimmedArchetype}, ${rawTitle
      .charAt(0)
      .toLowerCase()}${rawTitle.slice(1)}`;
  } else if (slot === 1 && trimmedName) {
    title = `${trimmedName}, ${rawTitle
      .charAt(0)
      .toLowerCase()}${rawTitle.slice(1)}`;
  } else if (trimmedName) {
    // Fall back to name when archetype is empty but name exists,
    // mirroring the old once-every-three rhythm.
    title =
      variantIdx % 3 === 0
        ? `${trimmedName}, ${rawTitle
            .charAt(0)
            .toLowerCase()}${rawTitle.slice(1)}`
        : rawTitle;
  } else {
    title = rawTitle;
  }

  const body = i18n.t(
    `notifications.${prefix}${variantIdx}Body`,
    {
      defaultValue: i18n.t(fallbackBodyKey, interpolations),
      ...interpolations,
    },
  );

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
      // Path-optimal hour — defaults to 9 AM if no path or path not
      // in the map. Audit finding: 'one-size-fits-all 9 AM push wastes
      // the most precious slot for users whose path peaks earlier
      // (silent-morning) or later (dopamine-detox)'.
      hour: PATH_OPTIMAL_HOUR[activePathId] ?? 9,
      minute: 0,
    },
  });
};

/**
 * D1 + D3 "first week" hooks. Both fire at 19:30 on day +1 and day +3 from
 * the moment this function is called (i.e. onboarding finish). They're
 * scheduled once and self-cancel if the user finishes a lesson sooner via
 * cancelFirstWeekHooks(). Cheap to call again — we always cancel before
 * scheduling.
 *
 * Why 19:30? Phones are most actively in-hand in early evening, and at
 * that hour the user has finished work/school and has a believable window
 * to do a 5-min lesson tonight.
 */
export const scheduleFirstWeekHooks = async ({ userName = '' } = {}) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(D1_HOOK_ID);
    await Notifications.cancelScheduledNotificationAsync(D3_HOOK_ID);
  } catch {}

  const makeTarget = (daysAhead) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    target.setHours(19, 30, 0, 0);
    return target;
  };

  const trimmedName = (userName || '').trim();
  // For first-week hooks we always personalise if we have a name — these
  // are the highest-leverage retention pushes and the user JUST gave us
  // their name, so it'll feel coherent.
  const prefix = (raw) =>
    trimmedName
      ? `${trimmedName}, ${raw.charAt(0).toLowerCase()}${raw.slice(1)}`
      : raw;

  await Notifications.scheduleNotificationAsync({
    identifier: D1_HOOK_ID,
    content: {
      title: prefix(i18n.t('notifications.d1HookTitle')),
      body: i18n.t('notifications.d1HookBody'),
      sound: true,
      categoryIdentifier: CAT_LESSON_REMINDER,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE ?? 'date',
      date: makeTarget(1),
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: D3_HOOK_ID,
    content: {
      title: prefix(i18n.t('notifications.d3HookTitle')),
      body: i18n.t('notifications.d3HookBody'),
      sound: true,
      categoryIdentifier: CAT_LESSON_REMINDER,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE ?? 'date',
      date: makeTarget(3),
    },
  });
};

/**
 * Cancel the D1/D3 hooks. Call this when the user completes their first
 * lesson — they're already activated; the "did you forget?" angle would
 * read as nagging.
 */
export const cancelFirstWeekHooks = async () => {
  try {
    await Notifications.cancelScheduledNotificationAsync(D1_HOOK_ID);
    await Notifications.cancelScheduledNotificationAsync(D3_HOOK_ID);
  } catch {}
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
 * Evening Insight push — only fires for users who DID work today.
 * Counterpart to the at-risk reminder: that one nags non-completers,
 * this one rewards completers with a meaningful "you did real work
 * today" beat at 21:30. Loss-aversion isn't the lever here; the
 * lever is "value summary" — the user closes the day knowing their
 * effort placed them in a measurable group, not just disappeared.
 *
 * Should be re-called whenever todaySessionLessons changes so the
 * variant + body reflect the latest count (a user who does +1 more
 * lesson after the push was scheduled gets the upgraded message).
 *
 * @param {Object} opts
 * @param {number} opts.lessonsToday  count of lessons completed today.
 *   When 0, we cancel any existing scheduled insight and bail —
 *   silent days don't need an insight push, the at-risk one covers it.
 */
export const scheduleEveningInsight = async ({ lessonsToday = 0 } = {}) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(EVENING_INSIGHT_ID);
  } catch {
    // no-op
  }
  if ((lessonsToday || 0) < 1) return;

  // Target 21:30 today. If we're already past it, bail — the moment
  // is gone, push tomorrow's via the next app-open dispatch.
  const now = new Date();
  const target = new Date();
  target.setHours(21, 30, 0, 0);
  if (now >= target) return;

  const minutes = lessonsToday * 5;
  // Three body tiers — high/mid/low — keyed by today's count. The
  // statistical claims are floor estimates from the Lally/Prochaska
  // adherence literature and aren't precise — but they're conservative
  // and survive scrutiny.
  let titleKey;
  let bodyKey;
  if (lessonsToday >= 3) {
    titleKey = 'notifications.eveningInsightTitleHigh';
    bodyKey = 'notifications.eveningInsightBodyHigh';
  } else if (lessonsToday === 2) {
    titleKey = 'notifications.eveningInsightTitle2';
    bodyKey = 'notifications.eveningInsightBody2';
  } else {
    titleKey = 'notifications.eveningInsightTitle1';
    bodyKey = 'notifications.eveningInsightBody1';
  }
  const title = i18n.t(titleKey, { count: lessonsToday, minutes });
  const body = i18n.t(bodyKey, { count: lessonsToday, minutes });

  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_INSIGHT_ID,
    content: { title, body, sound: true },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE ?? 'date',
      date: target,
    },
  });
};

export const cancelEveningInsight = async () => {
  try {
    await Notifications.cancelScheduledNotificationAsync(EVENING_INSIGHT_ID);
  } catch {}
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

  // No-op if user already completed today, has no streak yet, or is on
  // vacation (streak frozen — no risk). Threshold was 2 — at that level
  // brand-new users who finished their FIRST lesson got no risk push,
  // which was the exact moment they most needed one. Now even a 1-day
  // streak triggers it.
  if (todayCompleted) return;
  if ((currentStreak || 0) < 1) return;
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
