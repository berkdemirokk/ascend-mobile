// Runtime theme helper — pairs with the static `LT` + `LT_DARK` token
// sets in `./lightTheme.js`.
//
// Current scope (intentional): root surfaces + global overlay UI are
// dark-aware (splash, status bar, navigator background, WhatsNew modal,
// AdDebug modal, Skeleton loader). The bulk of screens stay on the
// static `LT.*` light palette — looks fine in light mode, visibly
// off-brand in dark for content areas.
//
// A previous per-screen dark migration was attempted (Squad / Settings /
// Profile / Reflections moved to useThemedStyles) but was reverted on
// 2026-05-24 because of contrast bugs we couldn't catch without a
// systematic dark-mode review pass. The hooks below stay exported in
// case we revisit, but no new screens should adopt them until the brand
// has a finalized dark palette + we've cleared a contrast/legibility
// audit. For now: ship light-only content with dark-aware chrome.

import { useColorScheme } from 'react-native';
import { LT, LT_DARK } from './lightTheme';

/**
 * Returns the LT token set matching the current system color scheme.
 * `light` and `null` both return LT (default).
 * `dark` returns LT_DARK.
 *
 * Usage in a component:
 *   const T = useTheme();
 *   return <View style={{ backgroundColor: T.background }} />
 */
export const useTheme = () => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? LT_DARK : LT;
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
 *   - Pass any LT.* reference through T.* and dark mode just works.
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
 * Imperative getter for non-React contexts (e.g., status bar setup
 * inside an event handler). Reads system preference once; does not
 * subscribe to changes. Prefer `useTheme` in components.
 */
export const getThemedLT = (scheme) =>
  scheme === 'dark' ? LT_DARK : LT;
