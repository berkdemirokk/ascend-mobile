import { getPackageForPeriod } from './purchasePackages';

export const hasActiveEntitlement = (customerInfo, entitlementId) => (
  customerInfo?.entitlements?.active?.[entitlementId] != null
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

      const { customerInfo } = await purchases.purchasePackage(purchasePackage);
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
    const customerInfo = await purchases.restorePurchases();
    return hasActiveEntitlement(customerInfo, entitlementId);
  },
});
