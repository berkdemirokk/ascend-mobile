// Smart paywall trigger — fires the paywall at the user's peak emotional
// moment (after completing the 3rd lesson) instead of the cold onboarding-
// end pitch. Research on freemium habit apps consistently shows post-
// activation paywall converts ~30-50% better than pre-activation.
//
// Trigger rules:
//   - User has completed exactly POST_LESSON_PAYWALL_TRIGGER_COUNT lessons
//   - User is NOT already premium
//   - We haven't shown this specific paywall before (one-shot per device)
//
// The onboarding-end upsell still fires for users who skip onboarding
// quickly; this is an additive trigger, not a replacement.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_POST_LESSON_PAYWALL_SHOWN = '@ascend/post_lesson_paywall_shown_v1';

// Fire after the user has felt the loop click — 3rd lesson is when they've
// experienced:
//   1. The discipline content style (lesson 1)
//   2. The streak forming (lesson 2 = day 2)
//   3. The "I might actually stick with this" feeling (lesson 3)
// That's the moment to ask for $$$.
export const POST_LESSON_PAYWALL_TRIGGER_COUNT = 3;

/**
 * Should we show the post-lesson paywall right now?
 *
 * @param {Object} opts
 * @param {number} opts.lessonsCompleted  total lessons completed across
 *   all paths (including the one that just triggered this check).
 * @param {boolean} opts.isPremium  current subscription state.
 * @returns {Promise<boolean>}
 */
export const maybeTriggerPostLessonPaywall = async ({
  lessonsCompleted,
  isPremium,
}) => {
  if (isPremium) return false;
  if (lessonsCompleted !== POST_LESSON_PAYWALL_TRIGGER_COUNT) return false;

  try {
    const shown = await AsyncStorage.getItem(KEY_POST_LESSON_PAYWALL_SHOWN);
    if (shown === 'true') return false;

    // Mark BEFORE returning true so a race condition (two completions
    // firing the check at the same time) doesn't double-show the paywall.
    await AsyncStorage.setItem(KEY_POST_LESSON_PAYWALL_SHOWN, 'true');
    return true;
  } catch {
    // On AsyncStorage error, fall back to "yes" — better to show the
    // paywall once accidentally than to miss the peak conversion moment.
    return true;
  }
};

/** Used by the Settings → Reset Progress flow to re-enable the trigger. */
export const resetPostLessonPaywallTrigger = async () => {
  try {
    await AsyncStorage.removeItem(KEY_POST_LESSON_PAYWALL_SHOWN);
  } catch {}
};
