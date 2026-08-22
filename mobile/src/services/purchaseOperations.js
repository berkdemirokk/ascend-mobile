import { getPackageForPeriod } from './purchasePackages';

export const hasActiveEntitlement = (customerInfo, entitlementId) => (
  customerInfo?.entitlements?.active?.[entitlementId] != null
);

const PURCHASE_TIMEOUT_MS = 180000;
const RESTORE_TIMEOUT_MS = 45000;

const withOperationTimeout = (promise, ms, label) => (
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(`${label} timed out`);
        error.code = 'ASCEND_PURCHASE_TIMEOUT';
        reject(error);
      }, ms);
    }),
  ])
);

export const createPurchaseOperations = ({
  getOfferings,
  ensureReady,
  entitlementId,
  unavailableMessage = 'Purchases service is unavailable',
}) => ({
  purchasePremium: async (period = 'monthly') => {
    try {
      const offering = await getOfferings();
      if (!offering?.availablePackages?.length) {
        throw new Error('No packages available');
      }

      const purchases = await ensureReady();
      if (!purchases) throw new Error(unavailableMessage);

      const purchasePackage = getPackageForPeriod(offering.availablePackages, period);
      if (!purchasePackage) {
        throw new Error(`No ${period} package available`);
      }

      const { customerInfo } = await withOperationTimeout(
        purchases.purchasePackage(purchasePackage),
        PURCHASE_TIMEOUT_MS,
        'purchase',
      );
      return {
        status: hasActiveEntitlement(customerInfo, entitlementId) ? 'unlocked' : 'pending',
        customerInfo,
      };
    } catch (error) {
      if (error?.userCancelled) return { status: 'cancelled' };
      throw error;
    }
  },

  restorePurchases: async () => {
    const purchases = await ensureReady();
    if (!purchases) throw new Error(unavailableMessage);
    const customerInfo = await withOperationTimeout(
      purchases.restorePurchases(),
      RESTORE_TIMEOUT_MS,
      'restore',
    );
    return hasActiveEntitlement(customerInfo, entitlementId);
  },
});
