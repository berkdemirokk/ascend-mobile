// Runtime theme helper — pairs with the static `LT` + `LT_DARK` token
// sets in `./lightTheme.js`.
//
// This file is the START of the dark-mode migration, not the end. The
// approach is intentionally surgical:
//
//   - Existing screens keep their StyleSheet.create({ ... LT.primary })
//     calls intact (build-time captured colors, light only).
//   - NEW dynamic surfaces — root View backgrounds, status bar tint,
//     splash transitions — use `useDynamicLT()` so the color reacts to
//     the system color scheme.
//   - Full dark migration (every screen, every card) happens in a
//     dedicated sprint. Until then, a system-dark-mode user sees:
//       ✓ Dark splash (no white flash on cold start)
//       ✓ Dark status bar tint
//       ✓ Dark root background (no white edges around scrollables)
//       ✗ Still-light cards/text (incremental migration)
//
// This matches Apple HIG's minimum bar — "respects user's preference"
// without requiring the full visual overhaul up front.

import { useColorScheme } from 'react-native';
import { LT, LT_DARK } from './lightTheme';

/**
 * Returns the LT token set matching the current system color scheme.
 * `light` and `null` both return LT (default).
 * `dark` returns LT_DARK.
 *
 * Usage in a component:
 *   const T = useDynamicLT();
 *   return <View style={{ backgroundColor: T.background }} />
 */
export const useDynamicLT = () => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? LT_DARK : LT;
};

/**
 * Imperative getter for non-React contexts (e.g., status bar setup
 * inside an event handler). Reads system preference once; does not
 * subscribe to changes. Prefer `useDynamicLT` in components.
 */
export const getThemedLT = (scheme) =>
  scheme === 'dark' ? LT_DARK : LT;
