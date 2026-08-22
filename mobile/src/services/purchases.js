import { Platform } from 'react-native';
import { REVENUECAT_CONFIG } from '../config/constants';
import { getPackageForPeriod } from './purchasePackages';
import { createPurchaseOperations, hasActiveEntitlement } from './purchaseOperations';

let Purchases = null;
let isInitialized = false;
let initPromise = null;
let currentAppUserID = null;
let lastInitError = null;
let lastOfferingsError = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RC_CONFIGURE_TIMEOUT_MS = 10000;
const RC_REQUEST_TIMEOUT_MS = 10000;

const withTimeout = (promise, ms, label) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms,
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });

const loadPurchasesModule = async () => {
  if (Purchases) return Purchases;
  try {
    const mod = await import('react-native-purchases');
    Purchases = mod.default ?? mod;
    return Purchases;
  } catch (e) {
    lastInitError = `module load failed: ${e?.message || e}`;
    console.warn('[RC] react-native-purchases module load failed:', e?.message || e);
    return null;
  }
};

export const initPurchases = async () => {
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const P = await loadPurchasesModule();
      if (!P) {
        lastInitError = lastInitError || 'native module not available';
        return false;
      }
      // Android isn't shipped yet — skip configure but mark "ready" so callers
      // don't block forever waiting for a configure that won't happen.
      if (Platform.OS !== 'ios') {
        isInitialized = true;
        return true;
      }
      try {
        if (P.LOG_LEVEL && typeof P.setLogLevel === 'function') {
          // INFO level surfaces useful diagnostic info on TestFlight without
          // spamming. Visible in Xcode/Console.app device logs.
          P.setLogLevel(__DEV__ ? P.LOG_LEVEL.DEBUG : P.LOG_LEVEL.INFO);
        }
      } catch {}
      await withTimeout(
        P.configure({ apiKey: REVENUECAT_CONFIG.API_KEY_IOS }),
        RC_CONFIGURE_TIMEOUT_MS,
        'RevenueCat configure',
      );
      isInitialized = true;
      lastInitError = null;
      return true;
    } catch (e) {
      lastInitError = e?.message || String(e);
      console.warn('[RC] init error:', lastInitError);
      // Allow a future retry by clearing the in-flight promise.
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
};

// Exposed for diagnostic UI (Settings → debug, error toasts) so we can show
// the actual reason instead of a generic "not ready" message.
export const getPurchasesDiagnostics = () => ({
  initialized: isInitialized,
  lastInitError,
  lastOfferingsError,
  hasModule: !!Purchases,
});

const ensureReady = async () => {
  if (!isInitialized) await initPurchases();
  if (!isInitialized) return null;
  return Purchases;
};

// Tie RevenueCat's customer record to the Supabase user so subscriptions
// follow the user across devices instead of the device's anonymous id.
export const linkPurchaseUser = async (appUserID) => {
  if (!appUserID) return false;
  if (currentAppUserID === appUserID) return true;
  try {
    const P = await ensureReady();
    if (!P || typeof P.logIn !== 'function') return false;
    await withTimeout(P.logIn(appUserID), RC_REQUEST_TIMEOUT_MS, 'RevenueCat logIn');
    currentAppUserID = appUserID;
    return true;
  } catch (e) {
    console.warn('linkPurchaseUser error:', e?.message);
    return false;
  }
};

export const unlinkPurchaseUser = async () => {
  if (!isInitialized || !currentAppUserID) return false;
  try {
    const P = Purchases;
    if (!P || typeof P.logOut !== 'function') return false;
    await withTimeout(P.logOut(), RC_REQUEST_TIMEOUT_MS, 'RevenueCat logOut');
    currentAppUserID = null;
    return true;
  } catch (e) {
    // logOut throws if the current user is already anonymous — that's fine.
    currentAppUserID = null;
    return false;
  }
};

/**
 * @returns {Promise<boolean|null>} true = active premium, false = no
 *   active entitlement, null = couldn't determine (offline / RC outage /
 *   not initialized). Callers MUST handle null specially: don't dispatch
 *   SET_PREMIUM false because the user may have a real subscription that
 *   we just can't verify right now.
 */
export const checkPremiumStatus = async () => {
  try {
    const P = await ensureReady();
    if (!P) return null;
    const customerInfo = await withTimeout(
      P.getCustomerInfo(),
      RC_REQUEST_TIMEOUT_MS,
      'RevenueCat customer info',
    );
    return hasActiveEntitlement(customerInfo, REVENUECAT_CONFIG.ENTITLEMENT_ID);
  } catch (e) {
    console.warn('Check premium error:', e?.message);
    return null; // unknown — don't downgrade user
  }
};

/**
 * Result shape for purchasePremium so callers can distinguish:
 *   { status: 'unlocked', customerInfo }       — bought + entitlement live
 *   { status: 'pending', customerInfo }        — bought but entitlement not live yet (RC lag)
 *   { status: 'cancelled' }                    — user dismissed the system sheet
 *   throws Error                               — actual failure (network, no packages, etc.)
 * The old shape (boolean) silently conflated 'pending' with 'cancelled',
 * leaving paying users with no premium unlock and no error message.
 */

const pickOffering = (offerings) => {
  if (!offerings) return null;
  if (offerings.current?.availablePackages?.length) return offerings.current;
  // RevenueCat dashboards sometimes ship without a "current" offering set —
  // fall back to the named offering id from config, then any non-empty one.
  const named = offerings.all?.[REVENUECAT_CONFIG.OFFERING_ID];
  if (named?.availablePackages?.length) return named;
  const all = Object.values(offerings.all || {});
  return all.find((o) => o?.availablePackages?.length) || null;
};

export const getOfferings = async () => {
  const P = await ensureReady();
  if (!P) {
    lastOfferingsError = lastInitError || 'not initialized';
    return null;
  }

  // StoreKit can take a moment after launch to wire up product metadata.
  // Retry a few times with backoff before giving up.
  const delays = [0, 800, 1800, 3500];
  let lastError = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i]);
    try {
      const offerings = await withTimeout(
        P.getOfferings(),
        RC_REQUEST_TIMEOUT_MS,
        'RevenueCat offerings',
      );
      const picked = pickOffering(offerings);
      if (picked) {
        lastOfferingsError = null;
        return picked;
      }
      lastError = new Error('No packages in offering');
    } catch (e) {
      lastError = e;
    }
  }
  lastOfferingsError = lastError?.message || 'offerings unavailable';
  if (lastError) console.warn('[RC] getOfferings retries exhausted:', lastError?.message);
  return null;
};

const purchaseOperations = createPurchaseOperations({
  getOfferings: () => getOfferings(),
  ensureReady: () => ensureReady(),
  entitlementId: REVENUECAT_CONFIG.ENTITLEMENT_ID,
  unavailableMessage: 'Purchases module unavailable',
});

export const purchasePremium = (period = 'monthly') => (
  purchaseOperations.purchasePremium(period)
);

export const getAvailablePackages = async () => {
  try {
    const offerings = await getOfferings();
    if (!offerings?.availablePackages?.length) return null;
    const pkgs = offerings.availablePackages;
    return {
      monthly: getPackageForPeriod(pkgs, 'monthly'),
      yearly: getPackageForPeriod(pkgs, 'yearly'),
    };
  } catch (e) {
    console.warn('getAvailablePackages error:', e?.message);
    return null;
  }
};

export const restorePurchases = async () => {
  try {
    return await purchaseOperations.restorePurchases();
  } catch (error) {
    if (!isInitialized && lastInitError) throw new Error(lastInitError);
    throw error;
  }
};
