// Vivid Impact Theme — Stitch "Modern Kartlar" / "Klasik Monastik"
// Bold red primary, light/dark mode aware, Inter typography.
//
// The main export `LT` is STATIC and points at the light tokens — kept
// for backward compatibility with every StyleSheet.create() call that
// already lives in the codebase (build-time captured, won't react to
// runtime theme switches).
//
// For NEW dynamic surfaces (root backgrounds, status bar tint, splash)
// import `getThemedLT()` or use the `useDynamicLT()` hook from
// `./theme.js`. Full dark migration is a separate sprint: this commit
// only wires the foundation so a system-dark-mode user no longer sees
// a white splash flash on cold start.

export const LT = {
  // Surfaces (light, layered)
  background: '#F9F9F9',
  surface: '#F9F9F9',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F3F3F4',
  surfaceContainer: '#EEEEEE',
  surfaceContainerHigh: '#E8E8E8',
  surfaceContainerHighest: '#E2E2E2',
  surfaceVariant: '#E2E2E2',

  // Text on surfaces
  onBackground: '#1A1C1C',
  onSurface: '#1A1C1C',
  onSurfaceVariant: '#5E3F3A',
  outline: '#936E69',
  outlineVariant: '#E8BCB6',

  // Brand — bold vivid red
  primary: '#B70006',
  primaryContainer: '#E31212',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#FFF7F5',

  // Tertiary (cobalt blue accent)
  tertiary: '#3741E1',
  tertiaryContainer: '#535EFB',
  onTertiary: '#FFFFFF',
  onTertiaryContainer: '#FAF7FF',

  // Status
  error: '#BA1A1A',
  success: '#0F7B3D',
};

// Dark mode counterpart — same brand semantics, dark surfaces. Mirrors
// `LT` key-for-key so a future runtime swap can drop these in without
// any consumer needing to rename anything.
export const LT_DARK = {
  // Surfaces (dark, layered)
  background: '#0A0A0B',
  surface: '#0A0A0B',
  surfaceContainerLowest: '#111114',
  surfaceContainerLow: '#16161A',
  surfaceContainer: '#1C1C20',
  surfaceContainerHigh: '#232328',
  surfaceContainerHighest: '#2B2B30',
  surfaceVariant: '#2B2B30',

  // Text on dark surfaces — high contrast, slight warm bias to soften
  // pure-white at 3am reading.
  onBackground: '#F2F2F0',
  onSurface: '#F2F2F0',
  onSurfaceVariant: '#C9B5B1',
  outline: '#6B5450',
  outlineVariant: '#3A2E2C',

  // Brand — same vivid red but slightly desaturated for dark mode
  // (pure red on dark vibrates uncomfortably; lowering chroma fixes).
  primary: '#E31212',
  primaryContainer: '#FF3D44',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#FFEDED',

  // Tertiary (cobalt blue accent — dark variant)
  tertiary: '#535EFB',
  tertiaryContainer: '#7B86FF',
  onTertiary: '#FFFFFF',
  onTertiaryContainer: '#EDEFFF',

  // Status — same hues, slightly brighter to stand out on dark surfaces
  error: '#FF6464',
  success: '#3FCB70',
};

// Typography scale (Inter)
export const LT_TYPE = {
  displayHero: {
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -1,
    fontWeight: '900',
  },
  h1: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    fontWeight: '700',
  },
  h2: {
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.4,
    fontWeight: '700',
  },
  bodyLg: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
  },
  bodyMd: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  labelCaps: {
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  streakNumber: {
    fontSize: 48,
    lineHeight: 48,
    letterSpacing: -0.5,
    fontWeight: '900',
  },
};

export const LT_SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  gutter: 16,
  containerMargin: 20,
};

export const LT_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
};
