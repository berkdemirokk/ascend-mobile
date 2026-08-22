#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const transformModules = require('@babel/plugin-transform-modules-commonjs');
const transformReactJsx = require('@babel/plugin-transform-react-jsx');

const ROOT = path.resolve(__dirname, '..');
const moduleCache = new Map();
let assertions = 0;

const asyncStorageMock = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
  multiRemove: async () => {},
};
const supabaseMock = {
  auth: {},
  functions: {},
};
const audioModeCalls = [];
const createdAudioPlayers = [];
const expoAudioMock = {
  requestRecordingPermissionsAsync: async () => ({ granted: true }),
  setAudioModeAsync: async (mode) => { audioModeCalls.push(mode); },
  createAudioPlayer: (source) => {
    const player = {
      source,
      addListener: () => ({ remove: () => {} }),
      play: () => {},
      pause: () => {},
      remove: () => {},
    };
    createdAudioPlayers.push(player);
    return player;
  },
};
const moduleMocks = {
  'react-native': {
    AppState: { addEventListener: () => ({ remove: () => {} }) },
  },
  '@react-native-async-storage/async-storage': {
    __esModule: true,
    default: asyncStorageMock,
  },
  'expo-constants': {
    __esModule: true,
    default: { expoConfig: { extra: {} } },
  },
  'expo-audio': expoAudioMock,
  'react-native-url-polyfill/auto': {},
  '@supabase/supabase-js': { createClient: () => supabaseMock },
  '../services/purchases': {
    checkPremiumStatus: async () => null,
    linkPurchaseUser: async () => false,
    unlinkPurchaseUser: async () => false,
  },
  '../services/referral': {},
  '../services/notifications': {},
  '../services/supabase': { supabase: supabaseMock, SUPABASE_CONFIGURED: false },
  './supabase': { supabase: supabaseMock, SUPABASE_CONFIGURED: false },
  './AuthContext': { useAuth: () => ({ user: null }) },
};

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
    plugins: [transformModules, transformReactJsx],
  }).code;
  const localRequire = (request) => {
    if (Object.prototype.hasOwnProperty.call(moduleMocks, request)) {
      return moduleMocks[request];
    }
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
  const voice = loadModule(path.join(ROOT, 'src/services/voiceRecording.js'));
  audioModeCalls.length = 0;
  const failedStart = await voice.startRecording({
    isRecording: false,
    prepareToRecordAsync: async () => { throw new Error('prepare failed'); },
    record: () => {},
  });
  assert(!failedStart, 'failed voice prepare must not report recording');
  assert(
    audioModeCalls.at(-1)?.allowsRecording === false,
    'failed voice prepare did not restore playback audio mode',
  );

  audioModeCalls.length = 0;
  const failedStop = await voice.stopRecording({
    stop: async () => { throw new Error('stop failed'); },
  });
  assert(failedStop === null, 'failed voice stop must return null');
  assert(
    audioModeCalls.at(-1)?.allowsRecording === false,
    'failed voice stop did not restore playback audio mode',
  );

  audioModeCalls.length = 0;
  await voice.cancelRecording({
    isRecording: true,
    stop: async () => { throw new Error('cancel failed'); },
  });
  assert(
    audioModeCalls.at(-1)?.allowsRecording === false,
    'failed voice cancellation did not restore playback audio mode',
  );

  const tts = loadModule(path.join(ROOT, 'src/services/tts.js'));
  let resolveHead;
  const originalFetch = global.fetch;
  global.fetch = () => new Promise((resolve) => { resolveHead = resolve; });
  audioModeCalls.length = 0;
  createdAudioPlayers.length = 0;
  const pendingSpeech = tts.speak('test', {
    lang: 'tr-TR',
    pathId: 'dopamine-detox',
    lessonOrder: 1,
  });
  await Promise.resolve();
  await tts.stop();
  resolveHead({ ok: true });
  assert(!(await pendingSpeech), 'stopped in-flight TTS request reported playback');
  assert(createdAudioPlayers.length === 0, 'stopped in-flight TTS request created a stale player');
  assert(
    audioModeCalls.some((mode) => mode.playsInSilentMode === true),
    'pre-recorded TTS did not enable iOS silent-mode playback',
  );
  global.fetch = originalFetch;

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

  const { runAuthRequest, withTimeout } = loadModule(path.join(ROOT, 'src/contexts/AuthContext.js'));
  const immediateAuth = await withTimeout(Promise.resolve({ data: { session: 'session' } }), 20);
  assert(immediateAuth.timedOut === false, 'resolved auth request reported a timeout');
  assert(immediateAuth.data.session === 'session', 'resolved auth session was not preserved');
  const timedOutAuth = await withTimeout(new Promise(() => {}), 5);
  assert(timedOutAuth.timedOut === true, 'stalled auth request did not fail open');
  assert(timedOutAuth.data === null, 'timed-out auth request must not invent a session');
  const scalarAuth = await withTimeout(Promise.resolve('ok'), 20);
  assert(scalarAuth.data === 'ok' && scalarAuth.timedOut === false, 'scalar auth response was not tagged safely');
  const boundedAuth = await runAuthRequest(() => Promise.resolve({ data: { user: 'u1' }, error: null }), 20);
  assert(boundedAuth.data.user === 'u1' && !boundedAuth.error, 'bounded auth request lost a successful response');
  const boundedTimeout = await runAuthRequest(() => new Promise(() => {}), 5);
  assert(boundedTimeout.error?.code === 'ASCEND_AUTH_TIMEOUT', 'bounded auth request did not return timeout error');
  const boundedNetwork = await runAuthRequest(() => { throw new Error('dns failed'); }, 20);
  assert(
    boundedNetwork.error?.code === 'ASCEND_AUTH_REQUEST_FAILED',
    'bounded auth request did not normalize network failure',
  );

  const { appReducer, initialState, ACTION_TYPES } = loadModule(
    path.join(ROOT, 'src/contexts/AppContext.js'),
  );
  const loaded = appReducer(initialState, {
    type: ACTION_TYPES.LOAD_STATE,
    payload: { totalXP: 42, anonUsername: 'monk_1234', fossilField: 'remove-me' },
  });
  assert(loaded.totalXP === 42 && loaded._loaded, 'state hydration lost valid fields');
  assert(loaded.anonUsername === 'ascender_1234', 'legacy anonymous handle was not migrated');
  assert(!Object.prototype.hasOwnProperty.call(loaded, 'fossilField'), 'state hydration accepted an unknown field');

  const premium = appReducer({ ...initialState, hearts: 1, streakFreezes: 2 }, {
    type: ACTION_TYPES.SET_PREMIUM,
    payload: true,
  });
  assert(premium.isPremium && premium.hearts === 5, 'premium activation did not restore unlimited-heart state');
  assert(premium.streakFreezes === 12, 'premium activation did not grant the configured freezes');

  const recentInstall = { ...initialState, hearts: 3, installedAt: new Date().toISOString() };
  assert(
    appReducer(recentInstall, { type: ACTION_TYPES.LOSE_HEART }) === recentInstall,
    'new-user grace period consumed a heart',
  );
  const oldInstall = {
    ...initialState,
    hearts: 3,
    installedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  };
  const afterHeartLoss = appReducer(oldInstall, { type: ACTION_TYPES.LOSE_HEART });
  assert(afterHeartLoss.hearts === 2, 'heart debit did not remove exactly one heart');
  assert(Boolean(afterHeartLoss.heartsRefillAt), 'heart debit did not schedule a refill');
  const refilled = appReducer(
    { ...afterHeartLoss, hearts: 0, heartsRefillAt: new Date().toISOString() },
    { type: ACTION_TYPES.REFILL_HEARTS },
  );
  assert(refilled.hearts === 5 && refilled.heartsRefillAt === null, 'heart refill did not restore usable hearts');

  const localDate = (offsetDays) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  };
  const vacationBridge = appReducer({
    ...initialState,
    currentStreak: 8,
    lastCompletedDate: localDate(-7),
    vacationUntil: localDate(-1),
    streakFreezes: 0,
  }, { type: ACTION_TYPES.AUTO_APPLY_STREAK_FREEZE });
  assert(vacationBridge.lastCompletedDate === localDate(-1), 'vacation mode did not bridge the protected return day');

  const lessonState = {
    ...initialState,
    installedAt: oldInstall.installedAt,
    pathProgress: {},
    unlockedAchievements: [],
  };
  const lessonAction = {
    type: ACTION_TYPES.COMPLETE_PATH_LESSON,
    payload: {
      pathId: 'dopamine-detox',
      lessonId: 'dopamine-detox-1',
      quizCorrect: 1,
      quizTotal: 2,
      xp: 20,
    },
  };
  const afterLesson = appReducer(lessonState, lessonAction);
  assert(afterLesson.totalXP === 20, 'ordinary lesson XP must be deterministic');
  assert(afterLesson._lessonReward.totalXp === 20, 'reward receipt does not match granted XP');
  assert(afterLesson.pathProgress['dopamine-detox'].completed.length === 1, 'lesson completion was not stored');
  assert(afterLesson.todaySessionLessons === 1, 'lesson session counter did not start at one');
  assert(appReducer(afterLesson, lessonAction) === afterLesson, 'duplicate lesson completion granted progress twice');

  const secondLesson = appReducer(afterLesson, {
    ...lessonAction,
    payload: {
      ...lessonAction.payload,
      lessonId: 'dopamine-detox-2',
      quizCorrect: 2,
    },
  });
  assert(secondLesson._lessonReward.perfectBonus === 10, 'perfect lesson bonus was not itemized');
  assert(secondLesson._lessonReward.momentumBonus === 25, 'second lesson did not receive the documented chain bonus');
  assert(secondLesson.totalXP - afterLesson.totalXP === 55, 'itemized lesson reward does not equal the XP delta');

  const switched = appReducer({
    ...afterLesson,
    onboarded: true,
    userProfile: { name: 'old-user' },
  }, { type: ACTION_TYPES.RESET_FOR_USER_SWITCH });
  assert(switched.onboarded && switched._loaded, 'user switch broke onboarding state');
  assert(Object.keys(switched.pathProgress).length === 0 && switched.userProfile === null, 'user switch leaked account data');

  const referralReward = appReducer({
    ...initialState,
    streakFreezes: 0,
    referralOwnerRewardIds: [],
  }, {
    type: ACTION_TYPES.GRANT_REFERRAL_REWARD,
    payload: { id: 'ref-row-1' },
  });
  assert(referralReward.streakFreezes === 10, 'owner referral reward did not grant freezes');
  const duplicateReferralReward = appReducer(referralReward, {
    type: ACTION_TYPES.GRANT_REFERRAL_REWARD,
    payload: { id: 'ref-row-1' },
  });
  assert(
    duplicateReferralReward === referralReward,
    'duplicate owner referral row granted reward twice',
  );

  const { mergeStates, pickSyncableState } = loadModule(
    path.join(ROOT, 'src/services/cloudSync.js'),
  );
  const merged = mergeStates({
    lastCompletedDate: '2026-06-20',
    currentStreak: 2,
    totalXP: 20,
    hearts: 3,
    referralOwnerRewardIds: ['ref-row-local'],
    pathProgress: {
      'dopamine-detox': {
        completed: ['dopamine-detox-1'],
        reflections: { 'dopamine-detox-1': 'local' },
        reflectionAudio: { 'dopamine-detox-1': 'file://local.m4a' },
        quizCorrect: { 'dopamine-detox-1': 1 },
      },
    },
  }, {
    lastCompletedDate: '2026-06-21',
    currentStreak: 3,
    totalXP: 40,
    hearts: 4,
    referralOwnerRewardIds: ['ref-row-cloud', 'ref-row-local'],
    pathProgress: {
      'dopamine-detox': {
        completed: ['dopamine-detox-2'],
        reflections: { 'dopamine-detox-1': 'cloud' },
        quizCorrect: { 'dopamine-detox-1': 2 },
      },
    },
  });
  assert(merged.currentStreak === 3 && merged.hearts === 4, 'newer cloud state did not win time-sensitive fields');
  assert(merged.pathProgress['dopamine-detox'].completed.length === 2, 'cross-device lesson progress was dropped');
  assert(merged.pathProgress['dopamine-detox'].reflections['dopamine-detox-1'] === 'cloud', 'cloud reflection conflict did not win');
  assert(merged.pathProgress['dopamine-detox'].quizCorrect['dopamine-detox-1'] === 2, 'higher quiz score was not preserved');
  assert(
    merged.referralOwnerRewardIds.length === 2
      && merged.referralOwnerRewardIds.includes('ref-row-local')
      && merged.referralOwnerRewardIds.includes('ref-row-cloud'),
    'referral owner reward ids were not merged across devices',
  );
  const syncable = pickSyncableState({ ...merged, isPremium: true });
  assert(!Object.prototype.hasOwnProperty.call(syncable, 'isPremium'), 'store-authoritative premium state was synced');
  assert(!Object.prototype.hasOwnProperty.call(syncable.pathProgress['dopamine-detox'], 'reflectionAudio'), 'local audio URI was synced');

  const { resolveAccessibilityProps } = loadModule(
    path.join(ROOT, 'src/components/AccessibleControls.js'),
  );
  const defaultButton = resolveAccessibilityProps({ onPress: () => {} });
  assert(defaultButton.accessibilityRole === 'button', 'interactive control has no default button role');
  const radio = resolveAccessibilityProps({ onPress: () => {}, accessibilityRole: 'radio' });
  assert(radio.accessibilityRole === 'radio', 'explicit accessibility role was overwritten');
  const hiddenBackdrop = resolveAccessibilityProps({ onPress: () => {}, accessible: false });
  assert(hiddenBackdrop.accessibilityRole === undefined, 'hidden backdrop became an accessibility button');
  const disabledControl = resolveAccessibilityProps({
    onPress: () => {},
    disabled: true,
    accessibilityState: { selected: true },
  });
  assert(
    disabledControl.accessibilityState.disabled && disabledControl.accessibilityState.selected,
    'disabled accessibility state did not preserve existing state',
  );

  console.log(`runtime tests passed: ${assertions} assertions`);
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`runtime tests failed: ${error.message}`);
    process.exit(1);
  });
