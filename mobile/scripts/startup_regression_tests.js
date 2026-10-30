#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const React = require('react');

const root = path.resolve(__dirname, '..');
const cache = new Map();
let appLoadAttempts = 0;
let appLoadFails = true;
function AppFixture() { return null; }
const mocks = {
  react: React,
  '@react-native-vector-icons/material-icons/static': { MaterialIcons: 'MaterialIcons' },
  'expo-constants': { expoConfig: { extra: {} } },
  'react-native': {
    View: 'View', Text: 'Text', Button: 'Button',
    StyleSheet: { create: (styles) => styles },
  },
};
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  }).code;
  const module = { exports: {} };
  cache.set(filename, module);
  function localRequire(request) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    if (request === '../../App') {
      appLoadAttempts += 1;
      if (appLoadFails) throw new Error('Native SDK unavailable during module evaluation');
      return { default: AppFixture };
    }
    if (!request.startsWith('.')) return require(request);
    const base = path.resolve(path.dirname(filename), request);
    const target = [base, `${base}.js`, path.join(base, 'index.js')]
      .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!target) throw new Error(`Missing ${request} from ${filename}`);
    return load(target);
  }
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}

async function main() {
  // Module-level styles must evaluate successfully before the startup boundary mounts.
  const { LT_RADIUS, LT_RADII, LT_SHADOW } = load('src/config/lightTheme.js');
  assert.equal(LT_RADII, LT_RADIUS);
  assert.equal(LT_RADII.md, 8);
  assert.equal(typeof LT_SHADOW.ambient, 'object');
  assert.equal(typeof load('src/components/home/StatCell.js').StatCell, 'function');

  // Metro permits missing named exports, so check all theme imports explicitly.
  function checkThemeImports(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) { checkThemeImports(filename); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const ast = babel.parseSync(fs.readFileSync(filename, 'utf8'), {
        filename, babelrc: false, configFile: false,
        parserOpts: { sourceType: 'module', plugins: ['jsx'] },
      });
      for (const node of ast.program.body) {
        if (node.type !== 'ImportDeclaration' || !/\/config\/lightTheme$/.test(node.source.value)) continue;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            assert.ok(Object.hasOwn(load('src/config/lightTheme.js'), specifier.imported.name),
              `${filename} imports missing lightTheme export ${specifier.imported.name}`);
          }
        }
      }
    }
  }
  checkThemeImports(path.join(root, 'src'));
  assert.equal(require(path.join(root, 'package.json')).main, 'index.js', 'package entry must use the guarded startup boundary');
  const { sanitizePersistedState } = load('src/contexts/stateHydration.js');
  const { initialState } = load('src/contexts/appStateConstants.js');
  const { appReducer } = load('src/contexts/appReducer.js');
  const { ACTION_TYPES } = load('src/contexts/appActionTypes.js');

  for (const corrupt of [null, [], 12, 'invalid']) assert.deepEqual(sanitizePersistedState(corrupt), {});
  const payload = JSON.parse('{"pathProgress":{"good":{"completed":["lesson-1",null,"lesson-1",4],"reflections":{"lesson-1":"keep","bad":{}},"reflectionAudio":{"lesson-1":"file://keep"},"quizCorrect":{"lesson-1":2,"bad":"3"}},"bad":null},"userProfile":{"name":{},"answers":{"name":4,"goal":"focus"}},"totalXP":40,"hearts":999,"unlockedAchievements":null,"assessmentHistory":[null],"dailyDeckHistory":[false],"_loaded":false,"_momentumToast":{"bad":true},"unknown":true}');
  const normalized = appReducer(initialState, { type: ACTION_TYPES.LOAD_STATE, payload });
  assert.equal(normalized._loaded, true);
  assert.deepEqual(normalized.pathProgress.good.completed, ['lesson-1']);
  assert.equal(normalized.pathProgress.good.reflections['lesson-1'], 'keep');
  assert.equal(normalized.pathProgress.good.reflectionAudio['lesson-1'], 'file://keep');
  assert.deepEqual(normalized.pathProgress.good.quizCorrect, { 'lesson-1': 2 });
  assert.equal(normalized.pathProgress.bad, undefined);
  assert.equal(normalized.userProfile.name, undefined);
  assert.equal(normalized.userProfile.answers.name, undefined);
  assert.equal(normalized.userProfile.answers.goal, 'focus');
  assert.equal(normalized.totalXP, 40);
  assert.equal(normalized.hearts, 5);
  assert.deepEqual(normalized.unlockedAchievements, []);
  assert.deepEqual(normalized.assessmentHistory, []);
  assert.deepEqual(normalized.dailyDeckHistory, []);
  assert.equal(normalized._momentumToast, null);
  assert.equal(normalized.unknown, undefined);
  for (const value of [null, [], 7, 'broken']) {
    const state = appReducer(initialState, { type: ACTION_TYPES.LOAD_STATE, payload: { pathProgress: value } });
    assert.deepEqual(Object.values(state.pathProgress), []);
    const completed = appReducer(state, { type: ACTION_TYPES.COMPLETE_PATH_LESSON, payload: { pathId: 'dopamine-detox', lessonId: 'day-1', xp: 15 } });
    assert.deepEqual(completed.pathProgress['dopamine-detox'].completed, ['day-1']);
  }
  const switched = appReducer(normalized, { type: ACTION_TYPES.RESET_FOR_USER_SWITCH, payload: { stateOwnerUserId: 'user-b' } });
  assert.equal(switched.stateOwnerUserId, 'user-b');
  assert.deepEqual(switched.pathProgress, {});
  assert.equal(switched.userProfile, null);

  const { resolveInitialUrl } = load('src/navigation/initialUrl.js');
  assert.equal(await resolveInitialUrl(() => Promise.resolve('ascend://reset-password')), 'ascend://reset-password');
  assert.equal(await resolveInitialUrl(() => Promise.resolve(null)), null);
  assert.equal(await resolveInitialUrl(() => Promise.reject(new Error('link rejected'))), null);
  assert.equal(await resolveInitialUrl(() => { throw new Error('link threw'); }), null);
  const start = Date.now();
  assert.equal(await resolveInitialUrl(() => new Promise(() => {}), 10), null);
  assert.ok(Date.now() - start < 1000, 'hanging initial link must release navigation');

  const { default: StartupRoot, RuntimeApp } = load('src/components/StartupRoot.js');
  const startupRootSource = fs.readFileSync(path.join(root, 'src/components/StartupRoot.js'), 'utf8');
  assert(!startupRootSource.includes('this.state.error?.message'), 'startup fallback must not expose raw SDK/config errors');
  assert.equal(appLoadAttempts, 0, 'bootstrap must load without evaluating App or its native SDK imports');
  const boundary = new StartupRoot({});
  assert.equal(boundary.render().type, RuntimeApp);
  assert.throws(() => RuntimeApp(), /Native SDK unavailable/);
  boundary.state = { ...boundary.state, ...StartupRoot.getDerivedStateFromError(new Error('boot failure')) };
  assert.equal(boundary.render().type, 'View', 'startup error must render an independent native fallback');
  assert.equal(appLoadAttempts, 1, 'fallback must not import failing application services');
  appLoadFails = false;
  assert.equal(RuntimeApp().type, AppFixture, 'healthy application must be rendered inside startup boundary');

  const effects = [];
  const writes = [];
  mocks.react = {
    useRef: (value) => ({ current: value }),
    useCallback: (callback) => callback,
    useEffect: (callback) => effects.push(callback),
  };
  mocks['react-native'].AppState = { addEventListener: () => ({ remove() {} }) };
  mocks['@react-native-async-storage/async-storage'] = {
    __esModule: true,
    default: {
      getItem: async () => { throw new Error('storage unavailable'); },
      setItem: async (...args) => { writes.push(args); },
    },
  };
  const { useLocalPersistence } = load('src/hooks/useLocalPersistence.js');
  const failureDispatches = [];
  const persistence = useLocalPersistence({ state: { ...initialState, _loaded: true }, dispatch: (action) => failureDispatches.push(action) });
  effects[0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failureDispatches.length, 1, 'failed hydration must still release startup');
  persistence.flushSaveNow();
  assert.deepEqual(writes, [], 'failed hydration must not overwrite existing disk state with defaults');
  effects.length = 0;
  mocks['@react-native-async-storage/async-storage'].default.getItem = async () => null;
  const healthy = useLocalPersistence({ state: { ...initialState, _loaded: true }, dispatch: () => {} });
  effects[0]();
  await new Promise((resolve) => setImmediate(resolve));
  healthy.flushSaveNow();
  assert.equal(writes.length, 1, 'a successful empty read must enable normal persistence');
  console.log('Startup regressions passed: corrupt snapshots, preserved progress, account reset, hanging/rejected links, early module failure fallback.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
