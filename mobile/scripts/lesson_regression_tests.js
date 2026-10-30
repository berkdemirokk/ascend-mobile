#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const React = require('react');

// Execute the actual screen and quiz JSX with persistent hook state. Native
// services and unrelated child views are fixtures; this is not a device test.
const root = path.resolve(__dirname, '..');
const question = { q: 'Choose the correct answer', options: ['Wrong', 'Correct'], correct: 1, explain: 'Why this is correct.' };
const noop = () => {};
const asyncNoop = async () => {};
const animation = () => ({ start: noop });
class AnimatedValue {
  setValue() {}
  interpolate() { return 0; }
}

function createLessonHarness({ isPremium = false, isInGracePeriod = false, hasQuiz = true } = {}) {
  const slots = [];
  const pendingEffects = [];
  const completions = [];
  const timers = [];
  const navigations = [];
  const paywallChecks = [];
  let hookCancellations = 0;
  let cursor = 0;
  let dirty = false;
  let heartLosses = 0;
  let hookCount;
  const route = { params: { pathId: 'focus', lessonId: 'focus-1' } };
  const state = {
    pathProgress: {}, hearts: 3, currentStreak: 0, isPremium, isInGracePeriod,
    completePathLesson: payload => {
      completions.push(payload);
      const completed = state.pathProgress[payload.pathId]?.completed || [];
      state.pathProgress = {
        ...state.pathProgress,
        [payload.pathId]: { completed: [...completed, payload.lessonId] },
      };
    },
    loseHeart: () => { heartLosses++; }, gainHeart: noop,
    grantBonusXP: noop, clearMomentumToast: noop,
  };
  const hooks = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => {
        const value = typeof next === 'function' ? next(slots[i]) : next;
        if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; }
      }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useMemo(factory) { cursor++; return factory(); },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!(i in slots) || deps.some((dep, j) => !Object.is(dep, slots[i][j]))) {
        slots[i] = deps;
        pendingEffects.push(effect);
      }
    },
  };
  const theme = { LT: {}, LT_RADII: {}, LT_SHADOW: {}, LT_SPACING: {} };
  const mocks = {
    react: hooks,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': {
      View: 'View', Text: 'Text', ScrollView: 'ScrollView', StatusBar: 'StatusBar',
      StyleSheet: { create: value => value }, Alert: { alert: noop },
      Animated: { Value: AnimatedValue, View: 'AnimatedView', timing: animation, spring: animation, sequence: animation },
      Easing: { out: value => value, cubic: noop },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-i18next': { useTranslation: () => ({ t: (key, fallback) => key.endsWith('.teaching') ? 'A teaching paragraph.' : fallback }) },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '@react-native-vector-icons/material-icons/static': { MaterialIcons: 'Icon' },
    'expo-haptics': { notificationAsync: asyncNoop, NotificationFeedbackType: { Success: 'success', Warning: 'warning' } },
    'expo-audio': { RecordingPresets: { HIGH_QUALITY: {} }, useAudioRecorder: () => ({}) },
    '../contexts/AppContext': { useApp: () => state },
    '../contexts/AuthContext': { useAuth: () => ({ user: null }) },
    '../data/paths': {
      getLessonById: id => id === 'missing' ? null : ({ id, pathId: 'focus', order: 1 }),
      getPathById: () => ({ id: 'focus', duration: 3 }),
      getLessonAccessState: () => 'active',
      getQuizForLesson: () => hasQuiz ? [question, { ...question }] : [],
    },
    '../services/ads': { showInterstitial: asyncNoop, shouldShowAd: () => false },
    '../services/sounds': { playSound: asyncNoop },
    '../services/tts': { speak: asyncNoop, stop: asyncNoop },
    '../services/voiceRecording': { startRecording: asyncNoop, stopRecording: asyncNoop, cancelRecording: asyncNoop, playRecording: asyncNoop },
    '../i18n': { getCurrentLanguage: () => 'en' },
    '../services/review': { requestReviewIfAppropriate: asyncNoop },
    '../services/notifications': { cancelFirstWeekHooks: async () => { hookCancellations++; } },
    '../services/paywallTrigger': { maybeTriggerPostLessonPaywall: async payload => {
      paywallChecks.push(payload);
      return !payload.isPremium && payload.lessonsCompleted === 3;
    } },
    '../services/reflectionMirror': { mirrorReflection: () => ({}) },
    '../services/analytics': { track: noop },
    '../components/AccessibleControls': { AccessibleTouchableOpacity: 'TouchableOpacity' },
    '../AccessibleControls': { AccessibleTouchableOpacity: 'TouchableOpacity' },
    '../config/lightTheme': theme, '../../config/lightTheme': theme,
    '../components/MilestoneModal': { __esModule: true, default: 'MilestoneModal', isMilestone: () => false },
    '../components/PathMilestoneScene': { __esModule: true, default: 'PathMilestoneScene', detectPathSceneStage: () => 0 },
    '../components/ConfettiBurst': { __esModule: true, default: 'ConfettiBurst' },
    '../components/SageMode': { __esModule: true, default: 'SageMode' },
    '../components/OutOfHeartsModal': { __esModule: true, default: 'OutOfHeartsModal' },
    '../components/lesson/TeachingPhase': { TeachingPhase: 'TeachingPhase' },
    '../components/lesson/CommitPhase': { CommitPhase: 'CommitPhase' },
  };
  function load(relative) {
    const filename = path.join(root, relative);
    const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
      filename, babelrc: false, configFile: false,
      plugins: ['@babel/plugin-transform-modules-commonjs', ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
    });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', code)(request => {
      assert(Object.hasOwn(mocks, request), `Unexpected dependency: ${request}`);
      return mocks[request];
    }, module, module.exports, (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, noop);
    return module.exports;
  }
  const { QuizPhase } = load('src/components/lesson/QuizPhase.js');
  mocks['../components/lesson/QuizPhase'] = { QuizPhase };
  const LessonScreen = load('src/screens/LessonScreen.js').default;
  function render() {
    let tree;
    let attempts = 0;
    do {
      assert(attempts++ < 10, 'Screen did not settle');
      cursor = 0;
      dirty = false;
      tree = LessonScreen({ route, navigation: {
        goBack: () => navigations.push(['back']),
        replace: (...args) => navigations.push(args),
        navigate: (...args) => navigations.push(args),
      } });
      if (hookCount !== undefined) assert.equal(cursor, hookCount, 'Hook count changed between render paths');
      hookCount = cursor;
      pendingEffects.splice(0).forEach(effect => effect());
    } while (dirty);
    return tree;
  }
  return {
    render, route, state, completions, timers, navigations, paywallChecks, QuizPhase,
    heartLosses: () => heartLosses,
    hookCancellations: () => hookCancellations,
  };
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node?.props) return [];
  return [node, ...elements(node.props.children)];
}
const find = (tree, type) => elements(tree).find(node => node.type === type);
const cta = tree => elements(tree).filter(node => node.type === 'TouchableOpacity' && node.props.activeOpacity === 0.9)[0];
const celebrationContinue = tree => elements(tree).find(node => node.type === 'TouchableOpacity'
  && elements(node).some(child => child.type === 'Text' && child.props.children === 'Yola Dön'));
function quiz(harness) {
  const element = find(harness.render(), harness.QuizPhase);
  assert(element, 'Quiz should be visible');
  return { element, choices: elements(harness.QuizPhase(element.props)).filter(node => node.props.accessibilityRole === 'radio') };
}

async function main() {
  for (const flags of [{}, { isPremium: true }, { isInGracePeriod: true }]) {
    const h = createLessonHarness(flags);
    assert(find(h.render(), 'TeachingPhase'));
    cta(h.render()).props.onPress();
    assert.equal(cta(h.render()).props.disabled, true, 'Continue is blocked until an answer is selected');
    quiz(h).choices[1].props.onPress();
    assert.equal(quiz(h).element.props.selectedAnswer, 1);
    assert(quiz(h).choices.every(node => node.props.disabled));
    quiz(h).element.props.handleSelectAnswer(0); // A repeated event must not alter the revealed answer.
    assert.equal(quiz(h).element.props.selectedAnswer, 1);
    cta(h.render()).props.onPress();
    assert.equal(quiz(h).element.props.quizIndex, 1);
    assert.equal(quiz(h).element.props.selectedAnswer, null);
    assert.equal(quiz(h).element.props.revealed, false);
    quiz(h).choices[0].props.onPress();
    assert.equal(h.heartLosses(), flags.isPremium || flags.isInGracePeriod ? 0 : 1);
    cta(h.render()).props.onPress();
    assert.equal(cta(h.render()).props.disabled, true, 'Commitment is required before completion');
    find(h.render(), 'CommitPhase').props.setActionDone(true);
    assert.equal(cta(h.render()).props.disabled, false);
    await cta(h.render()).props.onPress();
    assert.equal(h.completions.length, 1);
    assert.equal(h.completions[0].quizCorrect, 1);
    assert.equal(h.completions[0].quizTotal, 2);
    assert.equal(h.completions[0].xp, 20);
    assert(find(h.render(), 'ConfettiBurst'), 'Completion renders celebration');
    h.route.params.lessonId = 'focus-2';
    assert(find(h.render(), 'TeachingPhase'), 'Changing lesson resets the phase');
    cta(h.render()).props.onPress();
    assert.equal(quiz(h).element.props.quizIndex, 0);
    assert.equal(quiz(h).element.props.revealed, false);
    h.route.params.lessonId = 'missing';
    assert.doesNotThrow(h.render, 'Missing lesson must preserve hook count');
  }
  const noQuiz = createLessonHarness({ hasQuiz: false });
  cta(noQuiz.render()).props.onPress();
  assert(find(noQuiz.render(), 'CommitPhase'), 'Lessons without a quiz go directly to commitment');
  find(noQuiz.render(), 'CommitPhase').props.setActionDone(true);
  await cta(noQuiz.render()).props.onPress();
  await celebrationContinue(noQuiz.render()).props.onPress();
  assert.equal(noQuiz.hookCancellations(), 1, 'First completed lesson cancels first-week reminders');
  noQuiz.timers.find(timer => timer.delay === 250).fn();
  assert.deepEqual(noQuiz.navigations, [['Assessment', { mode: 'baseline' }]]);
  assert.equal(noQuiz.paywallChecks.length, 0, 'First lesson assessment takes priority over paywall');

  for (const total of [2, 3]) {
    const h = createLessonHarness({ hasQuiz: false });
    h.route.params.lessonId = `focus-${total}`;
    h.state.pathProgress = { focus: { completed: Array.from({ length: total - 1 }, (_, i) => `focus-${i + 1}`) } };
    h.state.baselineAssessment = { complete: true };
    cta(h.render()).props.onPress();
    find(h.render(), 'CommitPhase').props.setActionDone(true);
    await cta(h.render()).props.onPress();
    await celebrationContinue(h.render()).props.onPress();
    assert.equal(h.paywallChecks[0].lessonsCompleted, total, 'Post-lesson count must include current lesson exactly once');
    assert.deepEqual(h.navigations, total === 3 ? [['Paywall', { source: 'post_lesson_3' }]] : [['back']]);
    await celebrationContinue(h.render()).props.onPress();
    assert.equal(h.paywallChecks.length, 1, 'Repeated continue cannot replay the post-lesson flow');
  }
  console.log('Lesson regressions passed: quiz render, answer selection, hearts/grace/premium, scoring, completion, lesson reset, missing/no-quiz paths, first-lesson assessment, and third-lesson paywall.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
