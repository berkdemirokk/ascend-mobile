// Hybrid monetization: AdMob (interstitial + rewarded + banner) for free
// users + RevenueCat subscription for premium.
import { Platform } from 'react-native';
import { ADMOB_IDS } from '../config/constants';

// ─── Module state ────────────────────────────────────────────────────────────
// We lazy-require `react-native-google-mobile-ads` so the rest of the app keeps
// working even if the native module isn't present (JS-only Metro dev, bare
// Snack link, forgotten `pod install`, etc.).

let gma = null; // the imported module, or null if unavailable
let adsReady = false;

let interstitial = null;
let interstitialLoaded = false;

let rewarded = null;
let rewardedLoaded = false;

// ─── Diagnostics ─────────────────────────────────────────────────────────────
// Every load attempt records its outcome so the Settings → Debug panel
// can show users the actual reason ads aren't appearing. The most common
// causes for a brand-new AdMob account are NO_FILL (AdMob has no
// inventory for this app's audience yet) and NETWORK_ERROR. Without
// these recorded, "Reklam yüklenemedi" feels like a bug — with them,
// the user can paste the codes into AdMob support.
//
// Shape: { ts, kind: 'rewarded'|'interstitial', status: 'loaded'|'error',
//          code?: string, message?: string }
const adDiagnostics = [];
const DIAG_MAX = 20;

const recordDiag = (entry) => {
  adDiagnostics.push({ ...entry, ts: Date.now() });
  if (adDiagnostics.length > DIAG_MAX) {
    adDiagnostics.splice(0, adDiagnostics.length - DIAG_MAX);
  }
};

export const getAdDiagnostics = () => [...adDiagnostics];

// Hard timeout for the load promise. AdMob's SDK usually settles a
// load within 1-3 seconds; anything beyond 12 is dead in the water
// (network drop, SDK hang, never-resolving callback). Without this
// guard the Promise hangs forever and the pre-load pipeline gets
// stuck — meaning the NEXT lesson completion can't show an ad even
// after AdMob recovers. The timeout lets us reject, record the
// diagnostic, and let the caller try again.
const LOAD_TIMEOUT_MS = 12000;

// ─── Ad unit resolution ──────────────────────────────────────────────────────

// New AdMob accounts have near-zero fill on TestFlight (no inventory yet),
// so a TESTFLIGHT toggle in constants forces test units even in release.
// Flip USE_TEST_ADS_IN_RELEASE to false before App Store submission.
const shouldUseTestUnits = () =>
  __DEV__ || ADMOB_IDS.USE_TEST_ADS_IN_RELEASE === true;

const getInterstitialId = () => {
  if (Platform.OS !== 'ios') {
    return ADMOB_IDS.TEST_INTERSTITIAL_ANDROID;
  }
  return shouldUseTestUnits()
    ? ADMOB_IDS.TEST_INTERSTITIAL_IOS
    : ADMOB_IDS.INTERSTITIAL_IOS;
};

const getRewardedId = () => {
  if (Platform.OS !== 'ios') return null;
  return shouldUseTestUnits()
    ? ADMOB_IDS.TEST_REWARDED_IOS
    : ADMOB_IDS.REWARDED_IOS;
};

// ─── ATT + init ──────────────────────────────────────────────────────────────

// Last known ATT status, updated by requestTrackingPermissionIfNeeded and
// read by createAdRequest below to set requestNonPersonalizedAdsOnly.
let lastTrackingStatus = 'undetermined';

/**
 * Request App Tracking Transparency. Exported so callers can trigger it
 * AFTER user has had a moment to understand the app (Apple guideline:
 * "explain why you need tracking before asking"). The current call site
 * is OnboardingScreen.finishOnboarding — after the user has seen the
 * welcome, picked a goal, picked a path, and saw/skipped the upsell.
 *
 * Returns 'granted' | 'denied' | 'undetermined' | 'restricted' | 'unknown'.
 */
export const requestTrackingPermissionIfNeeded = async () => {
  if (Platform.OS !== 'ios') return 'unknown';
  try {
    const mod = await import('expo-tracking-transparency').catch(() => null);
    if (!mod) return 'unknown';
    const { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } = mod;
    const existing = await getTrackingPermissionsAsync();
    let status = existing?.status || 'unknown';
    if (status === 'undetermined') {
      const result = await requestTrackingPermissionsAsync();
      status = result?.status || 'unknown';
    }
    lastTrackingStatus = status;
    return status;
  } catch (e) {
    console.warn('ATT request skipped:', e?.message);
    return 'unknown';
  }
};

// True only when the user has explicitly granted ATT — for any other state
// (denied, undetermined, restricted, unknown) we serve non-personalized ads.
const isPersonalizedAdsAllowed = () => lastTrackingStatus === 'granted';

// Exported so the React banner component can mirror the same flag in its
// requestOptions. Without this the banner would silently send personalized
// requests even when the user denied ATT.
export const requestNonPersonalizedAdsOnly = () => !isPersonalizedAdsAllowed();

// Hybrid monetization: free users see ads, premium users don't.
// AdMob is shown after every 2-3 lesson completions.
const ADS_ENABLED = true;

export const initAds = async () => {
  if (!ADS_ENABLED) {
    adsReady = false;
    return;
  }
  try {
    // ATT is now requested AFTER the first lesson, not at boot. Apple
    // guideline: don't request tracking before user understands what the
    // app does. Initialize the SDK without ATT — it will get the prompt
    // status the next time it checks.
    gma = await import('react-native-google-mobile-ads').catch(() => null);
    if (!gma) {
      adsReady = false;
      return;
    }

    // `mobileAds()` is the default export in v14+. Initialize it once.
    if (typeof gma.default === 'function') {
      await gma.default().initialize();
    }
    adsReady = true;
  } catch (e) {
    console.warn('Ads init error:', e?.message);
    adsReady = false;
  }
};

// ─── Interstitial ────────────────────────────────────────────────────────────

export const loadInterstitial = async () => {
  if (!adsReady || !gma?.InterstitialAd || !gma?.AdEventType) {
    recordDiag({
      kind: 'interstitial',
      status: 'error',
      code: 'sdk_unavailable',
      message: !adsReady ? 'adsReady=false' : 'native module missing',
    });
    return;
  }
  try {
    const adUnitId = getInterstitialId();
    interstitial = gma.InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: !isPersonalizedAdsAllowed(),
    });

    await new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn) => (...args) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        offLoaded?.();
        offError?.();
        fn(...args);
      };
      const offLoaded = interstitial.addAdEventListener(
        gma.AdEventType.LOADED,
        settle(() => {
          interstitialLoaded = true;
          recordDiag({
            kind: 'interstitial',
            status: 'loaded',
            adUnitId,
          });
          resolve();
        }),
      );
      const offError = interstitial.addAdEventListener(
        gma.AdEventType.ERROR,
        settle((err) => {
          interstitialLoaded = false;
          // err shape from react-native-google-mobile-ads:
          //   { code: 'googleMobileAds/no-fill' | 'network-error' | ...,
          //     message: human-readable }
          recordDiag({
            kind: 'interstitial',
            status: 'error',
            code: err?.code || 'unknown',
            message: err?.message || String(err),
            adUnitId,
          });
          reject(err);
        }),
      );
      const timeoutId = setTimeout(
        settle(() => {
          interstitialLoaded = false;
          recordDiag({
            kind: 'interstitial',
            status: 'error',
            code: 'timeout',
            message: `no response in ${LOAD_TIMEOUT_MS}ms`,
            adUnitId,
          });
          reject(new Error('timeout'));
        }),
        LOAD_TIMEOUT_MS,
      );
      interstitial.load();
    });
  } catch (e) {
    console.warn('Load interstitial error:', e?.message);
    interstitialLoaded = false;
  }
};

export const showInterstitial = async () => {
  if (!adsReady || !interstitialLoaded || !interstitial) return false;
  try {
    await interstitial.show();
    interstitialLoaded = false;
    // Preload the next one in the background so the following completion is
    // ready to show immediately.
    loadInterstitial().catch(() => {});
    return true;
  } catch (e) {
    console.warn('Show interstitial error:', e?.message);
    return false;
  }
};

// ─── Rewarded ────────────────────────────────────────────────────────────────

export const loadRewarded = async () => {
  if (!adsReady || !gma?.RewardedAd || !gma?.RewardedAdEventType) {
    recordDiag({
      kind: 'rewarded',
      status: 'error',
      code: 'sdk_unavailable',
      message: !adsReady ? 'adsReady=false' : 'native module missing',
    });
    return;
  }
  const adUnitId = getRewardedId();
  if (!adUnitId) {
    recordDiag({
      kind: 'rewarded',
      status: 'error',
      code: 'no_unit_id',
      message: 'getRewardedId returned null (non-iOS or missing config)',
    });
    return;
  }
  try {
    rewarded = gma.RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: !isPersonalizedAdsAllowed(),
    });
    await new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn) => (...args) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        offLoaded?.();
        offError?.();
        fn(...args);
      };
      const offLoaded = rewarded.addAdEventListener(
        gma.RewardedAdEventType.LOADED,
        settle(() => {
          rewardedLoaded = true;
          recordDiag({ kind: 'rewarded', status: 'loaded', adUnitId });
          resolve();
        }),
      );
      const offError = rewarded.addAdEventListener(
        gma.AdEventType.ERROR,
        settle((err) => {
          rewardedLoaded = false;
          recordDiag({
            kind: 'rewarded',
            status: 'error',
            code: err?.code || 'unknown',
            message: err?.message || String(err),
            adUnitId,
          });
          reject(err);
        }),
      );
      const timeoutId = setTimeout(
        settle(() => {
          rewardedLoaded = false;
          recordDiag({
            kind: 'rewarded',
            status: 'error',
            code: 'timeout',
            message: `no response in ${LOAD_TIMEOUT_MS}ms`,
            adUnitId,
          });
          reject(new Error('timeout'));
        }),
        LOAD_TIMEOUT_MS,
      );
      rewarded.load();
    });
  } catch (e) {
    console.warn('Load rewarded error:', e?.message);
    rewardedLoaded = false;
  }
};

/**
 * Show a rewarded ad. Resolves with `true` if the user earned the reward
 * (watched the ad through), `false` if they bailed early or ads are
 * unavailable.
 */
export const showRewarded = async () => {
  if (!adsReady || !rewardedLoaded || !rewarded || !gma?.RewardedAdEventType) {
    return false;
  }
  return new Promise((resolve) => {
    let earned = false;
    const offEarned = rewarded.addAdEventListener(
      gma.RewardedAdEventType.EARNED_REWARD,
      () => {
        earned = true;
      },
    );
    const offClosed = rewarded.addAdEventListener(
      gma.AdEventType.CLOSED,
      () => {
        offEarned?.();
        offClosed?.();
        rewardedLoaded = false;
        // Preload the next rewarded ad for the next reward moment.
        loadRewarded().catch(() => {});
        resolve(earned);
      },
    );
    rewarded.show().catch((e) => {
      console.warn('Show rewarded error:', e?.message);
      offEarned?.();
      offClosed?.();
      resolve(false);
    });
  });
};

// ─── Frequency capping ───────────────────────────────────────────────────────
// In-memory counter that decides whether this completion triggers an ad.
// Persists only for the current session — acceptable since the worst case is
// the first action of a new session not showing an ad.

let actionsSinceLastAd = 0;
const AD_FREQUENCY = 2;

export const shouldShowAd = (isPremium) => {
  if (isPremium) return false;
  actionsSinceLastAd += 1;
  if (actionsSinceLastAd >= AD_FREQUENCY) {
    actionsSinceLastAd = 0;
    return true;
  }
  return false;
};

export const resetAdCounter = () => {
  actionsSinceLastAd = 0;
};

// ─── Banner ──────────────────────────────────────────────────────────────────
// The banner is rendered as a React component, not via imperative show() like
// the others. We just expose the unit ID so the consumer component can pick it.
export const getBannerId = () => {
  if (Platform.OS !== 'ios') return null;
  return shouldUseTestUnits()
    ? ADMOB_IDS.TEST_BANNER_IOS
    : ADMOB_IDS.BANNER_IOS;
};

export const isAdsReady = () => adsReady;

// Whether a rewarded ad has been loaded and is ready to show. Used by the
// OutOfHearts modal to decide whether to expose the "Watch ad" CTA at all,
// instead of showing it and then silently failing on tap.
export const isRewardedReady = () => rewardedLoaded;

/**
 * Snapshot of the ad-system state for the debug panel. Returns enough
 * info for the user to copy-paste into AdMob support: SDK status, the
 * actual ad unit IDs in use, ATT permission state, and recent load
 * outcomes. No PII — safe to share publicly.
 */
export const getAdSystemStatus = () => ({
  sdkAvailable: !!gma,
  adsReady,
  interstitialLoaded,
  rewardedLoaded,
  interstitialId: getInterstitialId(),
  rewardedId: getRewardedId(),
  bannerId: getBannerId(),
  trackingStatus: lastTrackingStatus,
  personalizedAds: isPersonalizedAdsAllowed(),
  useTestUnits: shouldUseTestUnits(),
  diagnostics: [...adDiagnostics],
});

