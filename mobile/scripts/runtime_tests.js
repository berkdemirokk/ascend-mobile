#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const transformModules = require('@babel/plugin-transform-modules-commonjs');

const ROOT = path.resolve(__dirname, '..');
const moduleCache = new Map();
let assertions = 0;

const resolveLocalImport = (fromFile, request) => {
  const base = path.resolve(path.dirname(fromFile), request);
  return [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')]
    .find((candidate) => fs.existsSync(candidate));
};

const loadModule = (file) => {
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if (moduleCache.has(file)) return moduleCache.get(file).exports;

  const module = { exports: {} };
  moduleCache.set(file, module);
  const code = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    plugins: [transformModules],
  }).code;
  const localRequire = (request) => {
    if (!request.startsWith('.')) return require(request);
    const target = resolveLocalImport(file, request);
    if (!target) throw new Error(`Cannot resolve ${request} from ${file}`);
    return loadModule(target);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
};

const assert = (condition, message) => {
  assertions += 1;
  if (!condition) throw new Error(message);
};

const assertRejects = async (operation, pattern, message) => {
  assertions += 1;
  try {
    await operation();
  } catch (error) {
    if (pattern.test(error?.message || '')) return;
    throw new Error(`${message}: unexpected error "${error?.message}"`);
  }
  throw new Error(`${message}: promise resolved`);
};

const entitlementId = 'premium';
const activeCustomer = { entitlements: { active: { premium: { isActive: true } } } };
const inactiveCustomer = { entitlements: { active: {} } };
const monthly = { packageType: 'MONTHLY', product: { identifier: 'monthly' } };
const yearly = { packageType: 'ANNUAL', product: { identifier: 'yearly' } };

const main = async () => {
  const { createPurchaseOperations, hasActiveEntitlement } = loadModule(
    path.join(ROOT, 'src/services/purchaseOperations.js'),
  );

  assert(hasActiveEntitlement(activeCustomer, entitlementId), 'active entitlement not detected');
  assert(!hasActiveEntitlement(inactiveCustomer, entitlementId), 'inactive entitlement reported active');
  assert(!hasActiveEntitlement(null, entitlementId), 'missing customer reported active');

  let purchasedPackage = null;
  const unlocked = createPurchaseOperations({
    getOfferings: async () => ({ availablePackages: [yearly, monthly] }),
    ensureReady: async () => ({
      purchasePackage: async (pkg) => {
        purchasedPackage = pkg;
        return { customerInfo: activeCustomer };
      },
    }),
    entitlementId,
  });
  const unlockedResult = await unlocked.purchasePremium('monthly');
  assert(unlockedResult.status === 'unlocked', 'active purchase must unlock premium');
  assert(purchasedPackage === monthly, 'monthly purchase selected the wrong package');

  const pending = createPurchaseOperations({
    getOfferings: async () => ({ availablePackages: [monthly] }),
    ensureReady: async () => ({ purchasePackage: async () => ({ customerInfo: inactiveCustomer }) }),
    entitlementId,
  });
  assert((await pending.purchasePremium()).status === 'pending', 'missing entitlement must be pending');

  const cancelled = createPurchaseOperations({
    getOfferings: async () => ({ availablePackages: [monthly] }),
    ensureReady: async () => ({
      purchasePackage: async () => { throw Object.assign(new Error('cancelled'), { userCancelled: true }); },
    }),
    entitlementId,
  });
  assert((await cancelled.purchasePremium()).status === 'cancelled', 'user cancellation must not be an error');

  const offline = createPurchaseOperations({
    getOfferings: async () => ({ availablePackages: [monthly] }),
    ensureReady: async () => ({ purchasePackage: async () => { throw new Error('network offline'); } }),
    entitlementId,
  });
  await assertRejects(() => offline.purchasePremium(), /network offline/, 'network purchase failure must throw');

  const noPackages = createPurchaseOperations({
    getOfferings: async () => null,
    ensureReady: async () => ({}),
    entitlementId,
  });
  await assertRejects(() => noPackages.purchasePremium(), /No packages available/, 'empty offering must throw');

  const restoreActive = createPurchaseOperations({
    getOfferings: async () => null,
    ensureReady: async () => ({ restorePurchases: async () => activeCustomer }),
    entitlementId,
  });
  assert(await restoreActive.restorePurchases(), 'active restore must return true');

  const restoreEmpty = createPurchaseOperations({
    getOfferings: async () => null,
    ensureReady: async () => ({ restorePurchases: async () => inactiveCustomer }),
    entitlementId,
  });
  assert(!(await restoreEmpty.restorePurchases()), 'empty restore must return false');

  const restoreUnavailable = createPurchaseOperations({
    getOfferings: async () => null,
    ensureReady: async () => null,
    entitlementId,
  });
  await assertRejects(
    () => restoreUnavailable.restorePurchases(),
    /Purchases service is unavailable/,
    'unavailable restore must throw',
  );

  const restoreOffline = createPurchaseOperations({
    getOfferings: async () => null,
    ensureReady: async () => ({ restorePurchases: async () => { throw new Error('restore offline'); } }),
    entitlementId,
  });
  await assertRejects(() => restoreOffline.restorePurchases(), /restore offline/, 'restore network failure must throw');

  console.log(`runtime tests passed: ${assertions} assertions`);
};

main().catch((error) => {
  console.error(`runtime tests failed: ${error.message}`);
  process.exit(1);
});
