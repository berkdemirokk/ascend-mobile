// Centralized haptic feedback. iOS-only impactful feedback patterns used
// throughout the app for "feel" — every quiz answer, every lesson
// completion, every milestone gets a tactile pulse.
//
// All functions silently no-op on Android (Haptics.* still works but
// vibration isn't as nuanced) and on failure (some devices don't have
// a Taptic engine, or user has disabled system haptics).
//
// Hot path: these get called inside render/event handlers, so they
// MUST never throw — every call is wrapped with .catch(() => {}).

import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_HAPTICS_ENABLED = '@ascend/haptics_enabled_v1';

// In-memory cache for the user's preference — re-checked on app boot.
// Defaults to true; user can toggle off in Settings.
let hapticsEnabled = true;

export const initHaptics = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY_HAPTICS_ENABLED);
    if (raw !== null) hapticsEnabled = raw === 'true';
  } catch {}
};

export const setHapticsEnabled = async (enabled) => {
  hapticsEnabled = !!enabled;
  try {
    await AsyncStorage.setItem(KEY_HAPTICS_ENABLED, String(hapticsEnabled));
  } catch {}
};

export const getHapticsEnabled = () => hapticsEnabled;

// ─── Standard feedback patterns ──────────────────────────────────────

/** Success — correct quiz answer, lesson completed, level up. */
export const hapticSuccess = () => {
  if (!hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
};

/** Warning — wrong quiz answer, about to lose hearts. */
export const hapticWarning = () => {
  if (!hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => {},
  );
};

/** Error — destructive action (delete account confirm, reset). */
export const hapticError = () => {
  if (!hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => {},
  );
};

/** Light impact — UI tap (toggle, select option in onboarding). */
export const hapticImpactLight = () => {
  if (!hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Medium impact — button press (CTAs, "Start lesson" button). */
export const hapticImpactMedium = () => {
  if (!hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

/** Heavy impact — milestone celebration (3-day streak, level up). */
export const hapticImpactHeavy = () => {
  if (!hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
};

// ─── Composed patterns ───────────────────────────────────────────────

/**
 * Milestone celebration — 3 heavy thumps in quick succession. Used when
 * the user crosses a streak threshold (3-day, 7-day, 30-day, etc.) to
 * make the moment feel like an event.
 */
export const hapticMilestone = () => {
  if (!hapticsEnabled) return;
  hapticImpactHeavy();
  setTimeout(() => hapticImpactHeavy(), 120);
  setTimeout(() => hapticSuccess(), 280);
};

/**
 * Level up pattern — success notification + heavy impact for that
 * "achievement unlocked" feel.
 */
export const hapticLevelUp = () => {
  if (!hapticsEnabled) return;
  hapticImpactHeavy();
  setTimeout(() => hapticSuccess(), 150);
};
