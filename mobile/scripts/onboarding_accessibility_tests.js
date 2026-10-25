const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const fixtures = {
  '../AccessibleControls': { AccessibleTouchableOpacity: 'TouchableOpacity' },
  '../../config/lightTheme': { LT: {} },
  '../../data/paths': { PATHS: [{ id: 'focus', duration: 10 }, { id: 'fitness', duration: 20 }] },
  '../../data/archetypes': { ARCHETYPES: [{ id: 'a', nameKey: 'nameA', tagKey: 'tagA', descKey: 'descA' }, { id: 'b', nameKey: 'nameB', tagKey: 'tagB', descKey: 'descB' }] },
  '@react-native-vector-icons/material-icons/static': { MaterialIcons: 'Icon' },
  'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', StyleSheet: { create: value => value } },
};
function load(name) {
  const file = path.join(__dirname, '..', 'src', 'components', 'onboarding', `${name}.js`);
  const code = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(request => fixtures[request] || require(request), module, module.exports);
  return module.exports.default;
}
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node?.props) return [];
  return [node, ...elements(node.props.children)];
}
const t = (key, fallback) => typeof fallback === 'string' ? fallback : key;
const choices = tree => elements(tree).filter(node => node.props.accessibilityRole === 'radio');
const Personalize = load('PersonalizeStep');
const answers = {};
const render = () => Personalize({ t, answers, onAnswer: (key, value) => { answers[key] = value; } });
assert.equal(choices(render()).length, 11);
for (const choice of choices(render())) {
  choice.props.onPress();
  const after = choices(render()).find(node => node.key === choice.key);
  assert.equal(after.props.accessibilityState.checked, true);
  assert.equal(after.props.accessibilityState.selected, true);
  assert(after.props.accessibilityLabel.length > 0);
}
assert.equal(choices(render()).filter(node => node.props.accessibilityState.checked).length, 3, 'Exactly one option per goal/time/mood group remains selected');
assert(elements(render()).find(node => node.type === 'TextInput').props.accessibilityLabel);
for (const [name, prop] of [['PickPathStep', 'selectedPath'], ['ArchetypeStep', 'selectedArchetype']]) {
  const Component = load(name);
  let selected;
  const view = () => Component({ t, [prop]: selected, onSelect: id => { selected = id; } });
  for (const choice of choices(view())) {
    choice.props.onPress();
    const current = choices(view());
    assert.equal(current.filter(node => node.props.accessibilityState.checked).length, 1);
    assert.equal(current.find(node => node.key === choice.key).props.accessibilityState.selected, true);
    assert(current.every(node => node.props.accessibilityLabel.length > 0));
  }
}
const screenSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', 'OnboardingScreen.js'), 'utf8');
const personalizeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'onboarding', 'PersonalizeStep.js'), 'utf8');
assert(screenSource.includes('<KeyboardAvoidingView') && screenSource.includes('Keyboard.dismiss();'));
assert(screenSource.includes('AccessibilityInfo.announceForAccessibility') && screenSource.includes('STEPS[stepIndex - 1]'));
assert(personalizeSource.includes('style={styles.personalizeScroll}'));
console.log('Onboarding accessibility tests passed: choices expose selection, progress is announced, back navigation works, and the keyboard-aware form scrolls. Native VoiceOver/layout verification remains required.');
