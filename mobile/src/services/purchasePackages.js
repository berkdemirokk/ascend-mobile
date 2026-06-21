import {
  PRODUCT_ID_MONTHLY,
  PRODUCT_ID_YEARLY,
} from '../config/revenuecatProducts.js';

export const getPackageForPeriod = (pkgs = [], period = 'monthly') => {
  if (!Array.isArray(pkgs)) return null;
  if (period === 'yearly') {
    return pkgs.find((p) => p.packageType === 'ANNUAL')
      || pkgs.find((p) => p.product?.identifier === PRODUCT_ID_YEARLY)
      || null;
  }
  return pkgs.find((p) => p.packageType === 'MONTHLY')
    || pkgs.find((p) => p.product?.identifier === PRODUCT_ID_MONTHLY)
    || null;
};
