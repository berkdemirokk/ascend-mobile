// Active theme tokens live in `./lightTheme.js` (LT). The dark M3 palette that
// used to live here has been removed — nothing imported it after the brand
// switch to the red/white light theme. New screens should import from
// `./lightTheme.js`.

// Legacy COLORS export — still imported by a couple of screens & helpers
// (achievements config, OnboardingScreen, AchievementDetailModal). Kept as
// flat hex values now that the M3 dark palette is gone.
export const COLORS = {
  primary: '#6366F1',          // Brand gradient start (legacy, kept for CTA gradients)
  primaryDark: '#4F46E5',
  accent: '#8B5CF6',           // Brand gradient end
  accentDark: '#7C3AED',
  background: '#13131b',
  surface: '#1f1f27',
  surfaceLight: '#292932',
  border: '#464554',
  text: '#e4e1ed',
  textSecondary: '#c7c4d7',
  textMuted: '#908fa0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#ffb4ab',
  gold: '#FDE047',
  // Path colors (kept for backward compat)
  health: '#10B981',
  career: '#3B82F6',
  mindfulness: '#8B5CF6',
  relationships: '#EC4899',
  finance: '#F59E0B',
};

export const XP_REWARDS = {
  ACTION_COMPLETE: 10,
  FIRST_TIME_BONUS: 5,
  STREAK_10: 25,
  STREAK_30: 100,
  STREAK_100: 500,
};

export const LEVEL_THRESHOLDS = [
  { level: 1, title: 'Beginner', xpRequired: 0, isPremium: false },
  { level: 2, title: 'Committed', xpRequired: 100, isPremium: false },
  { level: 3, title: 'Dedicated', xpRequired: 300, isPremium: false },
  { level: 4, title: 'Advanced', xpRequired: 600, isPremium: false },
  { level: 5, title: 'Elite', xpRequired: 1000, isPremium: false },
  { level: 6, title: 'Master', xpRequired: 1500, isPremium: false },
  { level: 7, title: 'Legendary', xpRequired: 2500, isPremium: true },
];

export const getLevelForXP = (xp) => {
  let current = LEVEL_THRESHOLDS[0];
  for (const t of LEVEL_THRESHOLDS) {
    if (xp >= t.xpRequired) current = t;
  }
  return current;
};

export const getNextLevel = (currentLevel) => {
  return LEVEL_THRESHOLDS.find((l) => l.level === currentLevel + 1) || null;
};

export const checkLevelUp = (newTotalXP, currentLevel) => {
  const next = getNextLevel(currentLevel);
  if (next && newTotalXP >= next.xpRequired) {
    return next.level;
  }
  return currentLevel;
};

export const CATEGORIES = [
  { id: 'health', label: 'Health', icon: '💪', color: COLORS.health, description: 'Physical fitness & wellbeing' },
  { id: 'career', label: 'Career', icon: '🚀', color: COLORS.career, description: 'Work, skills, and growth' },
  { id: 'mindfulness', label: 'Mindfulness', icon: '🧘', color: COLORS.mindfulness, description: 'Mental clarity & peace' },
  { id: 'relationships', label: 'Relationships', icon: '❤️', color: COLORS.relationships, description: 'Family, friends & love' },
  { id: 'finance', label: 'Finance', icon: '💰', color: COLORS.finance, description: 'Money, savings & wealth' },
];

export const DIFFICULTIES = [
  { id: 'beginner', label: 'Beginner', description: 'Easy, 5-10 min per day', icon: '🌱' },
  { id: 'intermediate', label: 'Intermediate', description: 'Moderate, 10-30 min per day', icon: '⚡' },
  { id: 'advanced', label: 'Advanced', description: 'Challenging, 30+ min per day', icon: '🔥' },
];

export const STORAGE_KEYS = {
  USER_STATE: '@ascend/user_state_v1',
  ONBOARDED: '@ascend/onboarded_v1',
  AD_COUNTER: '@ascend/ad_counter_v1',
};

// RevenueCat config. The iOS public API key used to live as a plain
// string here, which meant it was readable in `git log -p` forever even
// if the file were later edited. We now read it from `app.json` →
// `expo.extra.revenueCatIosKey` (resolved via `Constants.expoConfig`)
// so the value can be supplied at build-time from EAS Secrets without
// touching source. The fallback string is kept ONLY so existing local
// builds don't break the moment this commit lands — rotate the key in
// the RevenueCat dashboard and remove the fallback as a follow-up.
import Constants from 'expo-constants';

const extra = Constants?.expoConfig?.extra ?? {};

export const REVENUECAT_CONFIG = {
  API_KEY_IOS: extra.revenueCatIosKey || 'appl_GdTXEiIwMXBaFuHLGjwBhzlrruB',
  ENTITLEMENT_ID: 'premium',
  OFFERING_ID: 'default',
  // Match App Store Connect product IDs (verified via ASC API)
  PRODUCT_ID_MONTHLY: 'com.ascend.premium.monthly',
  PRODUCT_ID_YEARLY: 'com.ascend.premium.yearly',
  PRODUCT_ID: 'com.ascend.premium.monthly',
};

export const ADMOB_IDS = {
  // Real production IDs from the AdMob console for the App Store-linked
  // "Ascend: Monk Mode" app (publisher pub-9898903071826160, app
  // ~2513505932). This app is linked to App Store ID 6761607644.
  //
  // ⚠️ Build 53 + 54 shipped with the WRONG APP ID (~9553442066) which
  // pointed at a duplicate, unlinked AdMob app. The ad UNIT IDs were
  // already correct (they belong to ~2513505932), but the app+unit
  // mismatch caused every ad request to return no-fill. Build 55 fixes
  // the APP_ID_IOS so the SDK identifies itself as the correct
  // (App-Store-linked) app on every request. Ad unit IDs are unchanged.
  APP_ID_IOS: 'ca-app-pub-9898903071826160~2513505932',
  INTERSTITIAL_IOS: 'ca-app-pub-9898903071826160/5083828952',
  REWARDED_IOS: 'ca-app-pub-9898903071826160/1096482484',
  BANNER_IOS: 'ca-app-pub-9898903071826160/3722645822',
  // Google-provided test IDs — use these only when __DEV__ to avoid invalid
  // traffic flags on live ad units during development.
  TEST_INTERSTITIAL_IOS: 'ca-app-pub-3940256099942544/4411468910',
  TEST_REWARDED_IOS: 'ca-app-pub-3940256099942544/1712485313',
  TEST_BANNER_IOS: 'ca-app-pub-3940256099942544/2934735716',
  TEST_INTERSTITIAL_ANDROID: 'ca-app-pub-3940256099942544/1033173712',

  // ⚠️ TESTFLIGHT TOGGLE — must be false for App Store submission!
  // Google AdMob bans accounts that serve test ads in production traffic
  // detected via App Store distribution. Flip to true ONLY for TestFlight
  // verification before final submission.
  USE_TEST_ADS_IN_RELEASE: false,
};

export const PAYWALL_FEATURES = [
  { icon: '🚫', title: 'Ad-Free Experience', description: 'Remove all advertisements' },
  { icon: '❄️', title: 'Streak Freeze', description: 'Miss a day without losing your streak' },
  { icon: '👑', title: 'Legendary Levels', description: 'Unlock level 7 and beyond' },
  { icon: '📊', title: 'Advanced Stats', description: 'Deep insights into your progress' },
  { icon: '🎯', title: 'Unlimited History', description: 'Full timeline of every action' },
  { icon: '✨', title: 'Exclusive Badges', description: 'Show off your premium status' },
];

export const LEGAL = {
  PRIVACY_URL: 'https://berkdemirokk.github.io/ascend-ai-growth-coach/privacy.html',
  TERMS_URL: 'https://berkdemirokk.github.io/ascend-ai-growth-coach/terms.html',
  SUPPORT_EMAIL: 'berkdemirok@icloud.com',
};
