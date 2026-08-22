// Runtime theme compatibility helpers.
//
// Ascend currently ships one reviewed visual system: the red-and-white
// light palette. Most screens use the static `LT` tokens, so switching
// only the root chrome and a few overlays to dark created a split theme
// when the device was in dark mode. Keep every consumer on LT until a
// complete, screen-by-screen dark-mode contrast review is ready.

import { LT } from './lightTheme';

/**
 * Returns the reviewed red-and-white light token set.
 * The hook shape is retained so a future complete dark-mode migration
 * does not require another call-site refactor.
 *
 * Usage in a component:
 *   const T = useTheme();
 *   return <View style={{ backgroundColor: T.background }} />
 */
export const useTheme = () => {
  return LT;
};

// Backwards-compatible alias — Phase 1 surfaces used `useDynamicLT`
// before we settled on the shorter `useTheme` name. Kept exported so
// the App.js + AppNavigator wiring doesn't churn alongside the screen
// migrations.
export const useDynamicLT = useTheme;

/**
 * Hook that resolves the current theme and runs the caller's
 * stylesheet factory against it. The factory MUST return a plain
 * object (NOT pre-baked through StyleSheet.create — we do that for
 * you). Returning a stable shape is important: React Native won't
 * memoize across renders, but a fresh object each render is cheap
 * here because the values are primitives.
 *
 * Migration recipe:
 *   // Before
 *   const styles = StyleSheet.create({
 *     container: { backgroundColor: LT.background },
 *   });
 *
 *   // After (inside component body)
 *   const styles = useThemedStyles((T) => ({
 *     container: { backgroundColor: T.background },
 *   }));
 *
 * Notes:
 *   - Pass any LT.* reference through T.* to share the active palette.
 *   - StyleSheet.create() wrapping is no longer required; RN treats
 *     a plain object identically for style props.
 *   - For static styles that don't depend on theme (a fixed white
 *     overlay over a hero image, say), keep them as a module-level
 *     constant outside the hook — no need to re-make on each render.
 */
export const useThemedStyles = (makeStyles) => {
  const T = useTheme();
  return makeStyles(T);
};

/**
 * Imperative counterpart for non-React contexts. `scheme` is accepted
 * for backwards compatibility but intentionally ignored while the app
 * is light-only.
 */
export const getThemedLT = (_scheme) => LT;
