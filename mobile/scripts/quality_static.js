#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { VISITOR_KEYS } = require('@babel/types');
const transformModules = require('@babel/plugin-transform-modules-commonjs');

const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const SRC = path.join(ROOT, 'src');
const failures = [];
let assertions = 0;

const assert = (condition, message) => {
  assertions += 1;
  if (!condition) throw new Error(message);
};

const run = (name, check) => {
  try {
    check();
    console.log(`[ok] ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`[fail] ${name}: ${error.message}`);
  }
};

const walk = (directory, extension) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target, extension));
    if (entry.isFile() && target.endsWith(extension)) files.push(target);
  }
  return files.sort();
};

const relative = (file) => path.relative(ROOT, file).replace(/\\/g, '/');
const jsFiles = [
  ...walk(SRC, '.js'),
  path.join(ROOT, 'App.js'),
].filter((file) => fs.existsSync(file)).sort();
const astByFile = new Map();

const parseSource = (file) => parser.parse(fs.readFileSync(file, 'utf8'), {
  sourceType: 'unambiguous',
  plugins: ['jsx', 'optionalChaining', 'objectRestSpread'],
});

const getAst = (file) => {
  if (!astByFile.has(file)) astByFile.set(file, parseSource(file));
  return astByFile.get(file);
};

const deepMerge = (base, extra) => {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (
      value && typeof value === 'object' && !Array.isArray(value)
      && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
};

const flatten = (value, prefix = '', out = new Map()) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      flatten(item, prefix ? `${prefix}.${key}` : key, out);
    });
    return out;
  }
  out.set(prefix, value);
  return out;
};

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const trMain = readJson('src/i18n/locales/tr.json');
const enMain = readJson('src/i18n/locales/en.json');
const trLessons = readJson('src/i18n/locales/lessons.tr.json');
const enLessons = readJson('src/i18n/locales/lessons.en.json');
const trResource = deepMerge(trMain, trLessons);
const enResource = deepMerge(enMain, enLessons);
const trFlat = flatten(trResource);
const enFlat = flatten(enResource);

const placeholders = (value) => {
  if (typeof value !== 'string') return [];
  return [...value.matchAll(/{{\s*([^},\s]+)[^}]*}}/g)].map((match) => match[1]).sort();
};

run('locale parity and interpolation', () => {
  const trKeys = [...trFlat.keys()];
  const enKeys = [...enFlat.keys()];
  const trOnly = trKeys.filter((key) => !enFlat.has(key));
  const enOnly = enKeys.filter((key) => !trFlat.has(key));
  assert(!trOnly.length, `TR-only keys: ${trOnly.slice(0, 10).join(', ')}`);
  assert(!enOnly.length, `EN-only keys: ${enOnly.slice(0, 10).join(', ')}`);
  const mismatches = trKeys.filter((key) => (
    placeholders(trFlat.get(key)).join('|') !== placeholders(enFlat.get(key)).join('|')
  ));
  assert(!mismatches.length, `placeholder mismatch: ${mismatches.slice(0, 10).join(', ')}`);
});

run('JavaScript syntax', () => {
  const invalid = [];
  for (const file of jsFiles) {
    try {
      getAst(file);
    } catch (error) {
      invalid.push(`${relative(file)} (${error.message})`);
    }
  }
  assert(!invalid.length, invalid.slice(0, 10).join('; '));
});

const resolveLocalImport = (fromFile, request) => {
  const base = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.json`,
    path.join(base, 'index.js'),
    path.join(base, 'index.json'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
};

run('relative imports', () => {
  const missing = [];
  for (const file of jsFiles) {
    traverse(getAst(file), {
      ImportDeclaration(importPath) {
        const request = importPath.node.source.value;
        if (request.startsWith('.') && !resolveLocalImport(file, request)) {
          missing.push(`${relative(file)} -> ${request}`);
        }
      },
    });
  }
  assert(!missing.length, missing.slice(0, 20).join('; '));
});

run('translation key usage', () => {
  const missing = [];
  for (const file of jsFiles) {
    traverse(getAst(file), {
      CallExpression(callPath) {
        const { callee, arguments: args } = callPath.node;
        if (callee.type !== 'Identifier' || callee.name !== 't') return;
        if (!args[0] || args[0].type !== 'StringLiteral') return;
        const key = args[0].value;
        if (!trFlat.has(key) || !enFlat.has(key)) missing.push(`${relative(file)} -> ${key}`);
      },
    });
  }
  assert(!missing.length, missing.slice(0, 20).join('; '));
});

const jsxName = (nameNode) => {
  if (!nameNode) return '';
  if (nameNode.type === 'JSXIdentifier') return nameNode.name;
  if (nameNode.type === 'JSXMemberExpression') {
    return `${jsxName(nameNode.object)}.${jsxName(nameNode.property)}`;
  }
  return '';
};

const jsxAttribute = (opening, name) => opening.attributes.find((attribute) => (
  attribute.type === 'JSXAttribute' && attribute.name.name === name
));

const containsNode = (node, predicate) => {
  if (!node || typeof node !== 'object') return false;
  if (predicate(node)) return true;
  const keys = VISITOR_KEYS[node.type] || [];
  return keys.some((key) => {
    const value = node[key];
    return Array.isArray(value)
      ? value.some((child) => containsNode(child, predicate))
      : containsNode(value, predicate);
  });
};

run('icon button accessibility', () => {
  const issues = [];
  for (const file of jsFiles) {
    traverse(getAst(file), {
      JSXElement(elementPath) {
        const opening = elementPath.node.openingElement;
        const component = jsxName(opening.name);
        if (!['TouchableOpacity', 'Pressable'].includes(component)) return;
        const hasIcon = containsNode(elementPath.node, (node) => {
          if (node.type !== 'JSXElement') return false;
          const name = jsxName(node.openingElement.name);
          return /(?:^|\.)(?:MaterialIcons|MaterialCommunityIcons|Ionicons|Feather|FontAwesome\d*|Entypo|AntDesign)$/.test(name);
        });
        const hasText = containsNode(elementPath.node, (node) => (
          (node.type === 'JSXElement' && jsxName(node.openingElement.name) === 'Text')
          || (node.type === 'JSXText' && node.value.trim().length > 0)
        ));
        if (!hasIcon || hasText) return;
        const line = opening.loc?.start.line || '?';
        if (!jsxAttribute(opening, 'accessibilityLabel')) {
          issues.push(`${relative(file)}:${line} missing accessibilityLabel`);
        }
        if (!jsxAttribute(opening, 'accessibilityRole')) {
          issues.push(`${relative(file)}:${line} missing accessibilityRole`);
        }
        if (!jsxAttribute(opening, 'hitSlop')) {
          issues.push(`${relative(file)}:${line} missing hitSlop`);
        }
      },
    });
  }
  assert(!issues.length, issues.slice(0, 30).join('; '));
});

run('shared accessible touch controls', () => {
  const wrapperFile = path.join(SRC, 'components', 'AccessibleControls.js');
  const wrapperSource = fs.readFileSync(wrapperFile, 'utf8');
  const rawImports = [];
  for (const file of jsFiles) {
    if (file === wrapperFile) continue;
    traverse(getAst(file), {
      ImportDeclaration(importPath) {
        if (importPath.node.source.value !== 'react-native') return;
        const rawControls = importPath.node.specifiers.filter((specifier) => (
          specifier.type === 'ImportSpecifier'
          && ['TouchableOpacity', 'Pressable'].includes(specifier.imported.name)
        ));
        if (rawControls.length) rawImports.push(relative(file));
      },
    });
  }
  assert(!rawImports.length, `raw React Native touch controls: ${rawImports.join(', ')}`);
  assert(wrapperSource.includes("accessibilityRole ?? (onPress && accessible !== false ? 'button' : undefined)"), 'shared touch controls must provide a default button role');
  assert(wrapperSource.includes('disabled: true'), 'shared touch controls must expose disabled state');
});

run('small-screen interactive widths', () => {
  const issues = [];
  for (const file of jsFiles) {
    const ast = getAst(file);
    const wideStyles = new Set();
    traverse(ast, {
      VariableDeclarator(variablePath) {
        const { id, init } = variablePath.node;
        if (id.type !== 'Identifier' || init?.type !== 'CallExpression') return;
        if (init.callee?.type !== 'MemberExpression'
          || init.callee.object?.name !== 'StyleSheet'
          || init.callee.property?.name !== 'create'
          || init.arguments[0]?.type !== 'ObjectExpression') return;
        for (const styleProperty of init.arguments[0].properties) {
          if (styleProperty.type !== 'ObjectProperty'
            || styleProperty.value?.type !== 'ObjectExpression') continue;
          const styleName = styleProperty.key.name || styleProperty.key.value;
          const fixedWide = styleProperty.value.properties.some((property) => (
            property.type === 'ObjectProperty'
            && ['width', 'minWidth'].includes(property.key.name || property.key.value)
            && property.value?.type === 'NumericLiteral'
            && property.value.value > 280
          ));
          if (fixedWide) wideStyles.add(`${id.name}.${styleName}`);
        }
      },
    });

    const inspectStyle = (node, line) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'MemberExpression' && !node.computed
        && node.object?.type === 'Identifier' && node.property?.type === 'Identifier') {
        const reference = `${node.object.name}.${node.property.name}`;
        if (wideStyles.has(reference)) issues.push(`${relative(file)}:${line} uses ${reference}`);
      }
      if (node.type === 'ObjectExpression') {
        for (const property of node.properties) {
          if (property.type === 'ObjectProperty'
            && ['width', 'minWidth'].includes(property.key.name || property.key.value)
            && property.value?.type === 'NumericLiteral'
            && property.value.value > 280) {
            issues.push(`${relative(file)}:${line} has inline fixed width ${property.value.value}`);
          }
        }
      }
      for (const key of VISITOR_KEYS[node.type] || []) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach((item) => inspectStyle(item, line));
        else inspectStyle(child, line);
      }
    };

    traverse(ast, {
      JSXOpeningElement(openingPath) {
        if (!['TouchableOpacity', 'Pressable'].includes(jsxName(openingPath.node.name))) return;
        const style = jsxAttribute(openingPath.node, 'style');
        inspectStyle(style?.value?.expression, openingPath.node.loc?.start.line || '?');
      },
    });
  }
  assert(!issues.length, `fixed-width controls can overflow 320pt screens: ${issues.slice(0, 20).join('; ')}`);
});

run('navigation routes', () => {
  const routes = new Set();
  const calls = [];
  for (const file of jsFiles) {
    traverse(getAst(file), {
      JSXOpeningElement(openingPath) {
        const name = jsxName(openingPath.node.name);
        if (!name.endsWith('.Screen')) return;
        const attribute = jsxAttribute(openingPath.node, 'name');
        if (attribute?.value?.type === 'StringLiteral') routes.add(attribute.value.value);
      },
      CallExpression(callPath) {
        const { callee, arguments: args } = callPath.node;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        if (callee.object.type !== 'Identifier' || callee.object.name !== 'navigation') return;
        if (!['navigate', 'replace', 'push'].includes(callee.property.name)) return;
        if (args[0]?.type === 'StringLiteral') {
          calls.push({ route: args[0].value, file, line: callPath.node.loc?.start.line });
        }
      },
    });
  }
  const invalid = calls.filter((call) => !routes.has(call.route));
  assert(!invalid.length, invalid.slice(0, 20).map((call) => (
    `${relative(call.file)}:${call.line} -> ${call.route}`
  )).join('; '));
});

run('route params guards', () => {
  const unguarded = [];
  for (const file of jsFiles) {
    traverse(getAst(file), {
      MemberExpression(memberPath) {
        const node = memberPath.node;
        if (node.object.type === 'Identifier' && node.object.name === 'route'
          && !node.computed && node.property.name === 'params') {
          unguarded.push(`${relative(file)}:${node.loc?.start.line}`);
        }
      },
    });
  }
  assert(!unguarded.length, `use route?.params: ${unguarded.join(', ')}`);
});

run('StyleSheet references', () => {
  const issues = [];
  for (const file of jsFiles) {
    const ast = getAst(file);
    const sheets = new Map();
    const references = new Map();
    const dynamic = new Set();
    traverse(ast, {
      VariableDeclarator(variablePath) {
        const { id, init } = variablePath.node;
        if (id.type !== 'Identifier' || init?.type !== 'CallExpression') return;
        const callee = init.callee;
        if (callee.type !== 'MemberExpression' || callee.object.name !== 'StyleSheet'
          || callee.property.name !== 'create' || init.arguments[0]?.type !== 'ObjectExpression') return;
        const keys = new Set(init.arguments[0].properties
          .filter((property) => property.type === 'ObjectProperty' && !property.computed)
          .map((property) => property.key.name || property.key.value));
        sheets.set(id.name, keys);
        references.set(id.name, new Set());
      },
    });
    traverse(ast, {
      MemberExpression(memberPath) {
        const { object, property, computed } = memberPath.node;
        if (object.type !== 'Identifier' || !sheets.has(object.name)) return;
        if (computed) {
          dynamic.add(object.name);
          return;
        }
        if (property.type === 'Identifier') references.get(object.name).add(property.name);
      },
    });
    for (const [name, keys] of sheets.entries()) {
      const used = references.get(name) || new Set();
      for (const key of used) {
        if (!keys.has(key)) issues.push(`${relative(file)} undefined ${name}.${key}`);
      }
      if (!dynamic.has(name)) {
        for (const key of keys) {
          if (!used.has(key)) issues.push(`${relative(file)} unused ${name}.${key}`);
        }
      }
    }
  }
  assert(!issues.length, issues.slice(0, 30).join('; '));
});

run('unused imports', () => {
  const unused = [];
  for (const file of jsFiles) {
    const ast = getAst(file);
    const jsxIdentifiers = new Set();
    traverse(ast, {
      JSXIdentifier(identifierPath) {
        jsxIdentifiers.add(identifierPath.node.name);
      },
    });
    traverse(ast, {
      ImportDeclaration(importPath) {
        for (const specifier of importPath.node.specifiers) {
          const binding = importPath.scope.getBinding(specifier.local.name);
          const reactDefault = importPath.node.source.value === 'react'
            && specifier.type === 'ImportDefaultSpecifier';
          if (binding && !binding.referenced && !jsxIdentifiers.has(specifier.local.name) && !reactDefault) {
            unused.push(`${relative(file)} -> ${specifier.local.name}`);
          }
        }
      },
    });
  }
  assert(!unused.length, unused.slice(0, 30).join('; '));
});

run('production JSX literals', () => {
  const allowed = new Set(['ascend.app', 'v', 'DAILY DISCIPLINE', 'XP', 'PREMIUM']);
  const issues = [];
  for (const file of jsFiles) {
    if (relative(file) === 'src/components/AdDebugModal.js') continue;
    traverse(getAst(file), {
      JSXText(textPath) {
        const value = textPath.node.value.replace(/\s+/g, ' ').trim();
        if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(value) || allowed.has(value)) return;
        issues.push(`${relative(file)}:${textPath.node.loc?.start.line} -> ${value}`);
      },
    });
  }
  assert(!issues.length, issues.slice(0, 20).join('; '));
});

run('MaterialIcons names', () => {
  const glyphs = require('@react-native-vector-icons/material-icons/glyphmaps/MaterialIcons.json');
  const invalid = [];
  for (const file of jsFiles) {
    traverse(getAst(file), {
      JSXOpeningElement(openingPath) {
        if (jsxName(openingPath.node.name) !== 'MaterialIcons') return;
        const attribute = jsxAttribute(openingPath.node, 'name');
        let icon = null;
        if (attribute?.value?.type === 'StringLiteral') icon = attribute.value.value;
        if (attribute?.value?.type === 'JSXExpressionContainer'
          && attribute.value.expression.type === 'StringLiteral') icon = attribute.value.expression.value;
        if (icon && !Object.prototype.hasOwnProperty.call(glyphs, icon)) {
          invalid.push(`${relative(file)}:${openingPath.node.loc?.start.line} -> ${icon}`);
        }
      },
    });
  }
  assert(!invalid.length, invalid.join('; '));
});

run('release toolchain', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  const easJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  const dependencies = packageJson.dependencies || {};
  const image = easJson.build?.production?.ios?.image || '';
  const releaseVersion = appJson.expo?.version || '';
  const versionParts = releaseVersion.split('.').map(Number);
  const previousApproved = [1, 0, 41];
  const isNewReleaseTrain = versionParts.length === 3
    && versionParts.every(Number.isInteger)
    && versionParts.some((part, index) => (
      part > previousApproved[index]
      && versionParts.slice(0, index).every((value, prefix) => value === previousApproved[prefix])
    ));

  assert(/^[~^]?57\./.test(dependencies.expo || ''), `production requires Expo SDK 57, found ${dependencies.expo}`);
  assert(image === 'macos-tahoe-26.5-xcode-26.6', `Expo SDK 57 production must pin the reviewed Xcode 26.6 image, found ${image}`);
  assert(/^[~^]?7\./.test(dependencies['@react-navigation/native'] || ''), 'React Navigation 7 is required');
  assert(!Object.prototype.hasOwnProperty.call(appJson.expo || {}, 'newArchEnabled'), 'SDK 55+ removed the Legacy Architecture flag');
  assert(!dependencies['react-native-reanimated'], 'react-native-reanimated is not required by the app');
  assert(!dependencies['react-native-worklets'], 'react-native-worklets is not required by the app');
  assert(dependencies['expo-audio'], 'expo-audio is required for playback and voice reflections');
  assert(!dependencies['expo-av'], 'deprecated expo-av must not return');
  assert(!dependencies['@expo/vector-icons'], 'deprecated @expo/vector-icons wrapper must not return');
  assert(dependencies['@react-native-vector-icons/material-icons'] === '13.1.2', 'Material Icons must stay on the reviewed exact package version');
  assert(dependencies['@supabase/supabase-js'] === '2.112.3', 'supabase-js must stay pinned exactly');
  const ttsSource = fs.readFileSync(path.join(SRC, 'services', 'tts.js'), 'utf8');
  const voiceSource = fs.readFileSync(path.join(SRC, 'services', 'voiceRecording.js'), 'utf8');
  const lessonSource = fs.readFileSync(path.join(SRC, 'screens', 'LessonScreen.js'), 'utf8');
  assert(!jsFiles.some((file) => fs.readFileSync(file, 'utf8').includes("from 'expo-av'")), 'expo-av imports must not return');
  assert(ttsSource.includes('playsInSilentMode: true'), 'pre-recorded TTS must play in iOS silent mode');
  assert(ttsSource.includes('playbackGeneration'), 'TTS must cancel stale async playback requests');
  assert(voiceSource.includes('finally') && voiceSource.includes('resetPlaybackAudioMode'), 'voice cleanup must always restore playback mode');
  assert(lessonSource.includes('cancelRecording(voiceRecorder)'), 'lesson unmount must cancel an active voice recording');
  assert(packageJson.version === releaseVersion, `package/app version mismatch: ${packageJson.version} vs ${releaseVersion}`);
  assert(appJson.expo?.userInterfaceStyle === 'light', 'the reviewed red-white UI must stay light until a full dark theme ships');
  assert(appJson.expo?.ios?.supportsTablet === true, 'the release must preserve iPad support from the previous App Store version');
  assert(!packageJson.scripts?.web, 'native-only release must not expose an unconfigured web script');
  assert(isNewReleaseTrain, `release version must be newer than 1.0.41, found ${releaseVersion}`);
  assert(!Object.prototype.hasOwnProperty.call(appJson.expo?.ios || {}, 'buildNumber'), 'iOS buildNumber must be managed remotely by EAS');

  const deprecatedSafeAreaImports = [];
  for (const file of jsFiles) {
    traverse(getAst(file), {
      ImportDeclaration(importPath) {
        if (importPath.node.source.value !== 'react-native') return;
        if (importPath.node.specifiers.some((specifier) => (
          specifier.type === 'ImportSpecifier' && specifier.imported.name === 'SafeAreaView'
        ))) {
          deprecatedSafeAreaImports.push(relative(file));
        }
      },
    });
  }
  assert(!deprecatedSafeAreaImports.length, `deprecated react-native SafeAreaView: ${deprecatedSafeAreaImports.join(', ')}`);
  assert(!jsFiles.some((file) => fs.readFileSync(file, 'utf8').includes("Dimensions.get('window')")), 'responsive UI must use useWindowDimensions instead of a static window snapshot');

  const welcomeSource = fs.readFileSync(path.join(SRC, 'screens', 'auth', 'WelcomeScreen.js'), 'utf8');
  const settingsSource = fs.readFileSync(path.join(SRC, 'screens', 'SettingsScreen.js'), 'utf8');
  const heatmapSource = fs.readFileSync(path.join(SRC, 'components', 'StreakHeatmap.js'), 'utf8');
  assert(welcomeSource.includes('accessibilityRole="radio"') && welcomeSource.includes('checked: active'), 'welcome language picker must expose its selected radio state');
  assert(welcomeSource.includes("useState(Platform.OS === 'ios')"), 'Apple Sign-In must remain visible on iOS while availability is probed');
  assert(welcomeSource.includes('name="apple"'), 'Apple Sign-In fallback button must show the official Apple mark');
  assert(settingsSource.includes('accessibilityRole="radio"') && settingsSource.includes('checked: active'), 'settings language picker must expose its selected radio state');
  assert(settingsSource.includes("Platform.OS === 'ios'") && settingsSource.includes('redeemModalVisible'), 'referral code entry must work without the iOS-only Alert.prompt');
  assert(heatmapSource.includes('heatmap.dayAccessibility'), 'streak heatmap days need a non-color accessibility label');
});

run('release supply-chain and public-link security', () => {
  const workflowDir = path.join(REPO_ROOT, '.github', 'workflows');
  const workflowFiles = fs.readdirSync(workflowDir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => path.join(workflowDir, name));
  for (const file of workflowFiles) {
    const workflow = fs.readFileSync(file, 'utf8');
    const actionRefs = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
    for (const actionRef of actionRefs) {
      assert(/@[0-9a-f]{40}$/i.test(actionRef), `${path.basename(file)} must pin ${actionRef} to a full commit SHA`);
    }
  }

  const docsDir = path.join(REPO_ROOT, 'docs');
  for (const name of fs.readdirSync(docsDir).filter((entry) => entry.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(docsDir, name), 'utf8');
    assert(/Content-Security-Policy/i.test(html), `${name} must define a CSP for GitHub Pages`);
    assert(/<meta\s+name="referrer"\s+content="no-referrer"/i.test(html), `${name} must suppress outbound referrers`);
  }

  const productionSource = jsFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert(!productionSource.includes('https://ascend.app'), 'share links must not use an unrelated ascend.app domain');

  const migrations = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', name), 'utf8'))
    .join('\n');
  assert(!/auth\.role\s*\(/i.test(migrations), 'RLS policies must use role targets plus ownership checks, not deprecated auth.role()');
  assert(migrations.includes('private.can_read_squad_members'), 'squad membership reads must remain participant-scoped');

  for (const functionName of ['delete-user', 'broadcast-push']) {
    const source = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', functionName, 'index.ts'), 'utf8');
    assert(/@supabase\/supabase-js@\d+\.\d+\.\d+/.test(source), `${functionName} must pin supabase-js exactly`);
  }
});

run('startup fail-open guards', () => {
  const appSource = fs.readFileSync(path.join(ROOT, 'App.js'), 'utf8');
  const authSource = fs.readFileSync(path.join(SRC, 'contexts', 'AuthContext.js'), 'utf8');
  const notificationSource = fs.readFileSync(path.join(SRC, 'services', 'notifications.js'), 'utf8');
  const getSessionCalls = authSource.match(/supabase\.auth\.getSession\(\)/g) || [];

  assert(/I18N_STARTUP_TIMEOUT_MS\s*=\s*3000/.test(appSource), 'i18n startup must have a hard timeout');
  assert(appSource.includes("setI18nReady(true)"), 'i18n timeout must release the launch screen');
  assert(getSessionCalls.length === 1, `auth bootstrap must reuse one session request, found ${getSessionCalls.length}`);
  assert(/if \(result\?\.timedOut\)\s*{\s*setLoading\(false\)/s.test(authSource), 'auth timeout must release the launch screen');
  assert(/sessionRequest\s*\.then/.test(authSource), 'late auth restoration must reuse the original request');
  assert(/AUTH_REQUEST_TIMEOUT_MS\s*=\s*12000/.test(authSource), 'interactive auth requests must have a bounded timeout');
  assert(authSource.includes('export const runAuthRequest'), 'interactive auth requests must share the bounded auth wrapper');
  const unboundedAuthCalls = authSource.match(
    /await\s+supabase\.auth\.(signUp|signInWithPassword|resetPasswordForEmail|resend|signInWithIdToken)\(/g,
  ) || [];
  assert(!unboundedAuthCalls.length, `unbounded interactive auth calls: ${unboundedAuthCalls.join(', ')}`);
  assert(notificationSource.includes('shouldShowBanner: true'), 'notification handler must use the current iOS banner behavior');
  assert(notificationSource.includes('shouldShowList: true'), 'notification handler must use the current iOS list behavior');
});

run('release observability', () => {
  const analyticsSource = fs.readFileSync(path.join(SRC, 'services', 'analytics.js'), 'utf8');
  const appSource = fs.readFileSync(path.join(ROOT, 'App.js'), 'utf8');
  const onboardingSource = fs.readFileSync(path.join(SRC, 'screens', 'OnboardingScreen.js'), 'utf8');
  assert(analyticsSource.includes("QUEUE_STORAGE_KEY"), 'analytics queue must survive app termination');
  assert(analyticsSource.includes('const { error } = await supabase.from(TABLE).insert(batch)'), 'analytics must inspect Supabase insert errors');
  assert(analyticsSource.includes('Constants.nativeBuildVersion'), 'analytics events must include native build version');
  assert(analyticsSource.includes('installGlobalErrorHandler'), 'global JS errors must be captured');
  assert(appSource.includes('installGlobalErrorHandler()'), 'App must install the global JS error handler');
  assert(appSource.includes('flushAnalytics()'), 'App lifecycle must flush analytics');
  assert(appSource.includes("track({ event: 'app_js_started' })"), 'App must report that the JS entrypoint started');
  assert(appSource.includes("track({ event: 'app_ready' })"), 'App must report when startup providers are ready');
  assert(onboardingSource.includes("event: 'onboarding_step_viewed'"), 'onboarding funnel must record each viewed step');
});

run('purchase failure semantics', () => {
  const purchaseSource = fs.readFileSync(path.join(SRC, 'services', 'purchases.js'), 'utf8');
  const restoreMatch = purchaseSource.match(/export const restorePurchases = async \(\) => \{([\s\S]*?)\n\};/);
  assert(restoreMatch, 'restorePurchases implementation missing');
  assert(restoreMatch[1].includes("throw new Error"), 'unavailable purchase service must throw');
  assert(!/catch\s*\([^)]*\)[\s\S]*return false/.test(restoreMatch[1]), 'restore errors must not be reported as an empty entitlement');
});

run('release blocker regression guards', () => {
  const appContextSource = fs.readFileSync(path.join(SRC, 'contexts', 'AppContext.js'), 'utf8');
  const lessonSource = fs.readFileSync(path.join(SRC, 'screens', 'LessonScreen.js'), 'utf8');
  const purchasesSource = fs.readFileSync(path.join(SRC, 'services', 'purchases.js'), 'utf8');
  const adsSource = fs.readFileSync(path.join(SRC, 'services', 'ads.js'), 'utf8');
  const achievementsSource = fs.readFileSync(path.join(SRC, 'config', 'achievements.js'), 'utf8');
  const constantsSource = fs.readFileSync(path.join(SRC, 'config', 'constants.js'), 'utf8');

  assert(!/setCrit(?:BonusXP|Flash)\s*\(/.test(lessonSource), 'LessonScreen must not call removed crit state setters');
  const postLessonRefIndex = lessonSource.indexOf('const postLessonFlowRanRef = useRef(false)');
  const lessonEarlyReturnIndex = lessonSource.indexOf('if (!path || !lesson)');
  assert(postLessonRefIndex >= 0, 'post-lesson ref declaration missing');
  assert(lessonEarlyReturnIndex >= 0, 'lesson early return guard missing');
  assert(postLessonRefIndex < lessonEarlyReturnIndex, 'post-lesson ref must be declared before early returns');
  assert(lessonSource.includes("source: 'next_lesson_premium'"), 'next lesson flow must guard premium lessons');
  assert(/getLessonAccessState\(nextLesson,\s*pathProgress,\s*isPremium\)/.test(lessonSource), 'next lesson flow must reuse lesson access state');

  assert(appContextSource.includes('LOCAL_STATE_LOAD_TIMEOUT_MS'), 'local state hydrate must have a timeout');
  assert(appContextSource.includes('ACTION_TYPES.REFILL_HEARTS'), 'heart refill timer must dispatch a real refill');
  assert(appContextSource.includes('Initial cloud push failed'), 'empty remote sync must create the first cloud row');

  assert(purchasesSource.includes('RevenueCat configure'), 'RevenueCat configure must be timeout bounded');
  assert(purchasesSource.includes('RevenueCat offerings'), 'RevenueCat offerings must be timeout bounded');
  assert(adsSource.includes('show_timeout'), 'rewarded ad show must have a hard timeout');

  const noLongerPromised = /first 7 days|7-day (?:premium|free trial)|7 days of premium|7 g[üu]n (?:premium|[üu]cretsiz)|[üu]cretsiz deneme/i;
  assert(!noLongerPromised.test(JSON.stringify(trMain)), 'TR copy still promises an unbacked 7-day premium gift');
  assert(!noLongerPromised.test(JSON.stringify(enMain)), 'EN copy still promises an unbacked 7-day premium gift');
  assert(trMain.paywall.trustNoTrack === 'APP STORE', 'TR paywall trust label must not claim no tracking');
  assert(enMain.paywall.trustNoTrack === 'APP STORE', 'EN paywall trust label must not claim no tracking');
  const inflatedSocialProof = /10[.,]?000\+|thousands? of (?:users|members)|binlerce (?:kullanıcı|üye)/i;
  assert(!inflatedSocialProof.test(JSON.stringify(trMain.paywall)), 'TR paywall contains unsupported social proof');
  assert(!inflatedSocialProof.test(JSON.stringify(enMain.paywall)), 'EN paywall contains unsupported social proof');

  const maxLevel = Math.max(
    ...[...constantsSource.matchAll(/level:\s*(\d+)/g)].map((match) => Number(match[1])),
  );
  const invalidLevelAchievements = [...achievementsSource.matchAll(
    /id:\s*'([^']+)'[\s\S]*?type:\s*'level'[\s\S]*?target:\s*(\d+)/g,
  )].filter((match) => Number(match[2]) > maxLevel);
  assert(!invalidLevelAchievements.length, `unreachable level achievements: ${invalidLevelAchievements.map((match) => match[1]).join(', ')}`);
});

run('deterministic lesson rewards', () => {
  const appContextSource = fs.readFileSync(path.join(SRC, 'contexts', 'AppContext.js'), 'utf8');
  const lessonSource = fs.readFileSync(path.join(SRC, 'screens', 'LessonScreen.js'), 'utf8');
  assert(!appContextSource.includes('Math.random()'), 'lesson completion reward must not use random multipliers');
  assert(!lessonSource.includes('Math.random()'), 'quiz answers must not grant random rewards');
  assert(appContextSource.includes('_lessonReward: {'), 'reducer must expose an itemized lesson reward receipt');
  assert(appContextSource.includes('totalXp: finalXp'), 'reward receipt must use the granted XP total');
  assert(lessonSource.includes('_lessonReward?.totalXp'), 'celebration must display the granted XP total');
});

run('first-session content pacing', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  const lessonScreen = fs.readFileSync(path.join(SRC, 'screens', 'LessonScreen.js'), 'utf8');
  const paths = trLessons.lessons || {};
  const jargonTitle = /\b(?:Master|Mastery|Mid-point|Baseline|Kill|Deep|Review|Inbox)\b/i;
  const unsupportedOpeningClaim = /\b(?:kokain|cocaine|phantom reaching|baseline|%\d+)\b/i;

  assert(appJson.expo?.name === 'Ascend: Daily Discipline', 'installed app name must match the App Store brand');
  assert(trMain.onboarding?.title === 'Ascend: Daily Discipline', 'onboarding brand must match the installed app');
  assert(lessonScreen.includes('Array.from({ length: 4 }'), 'teaching flow must cap long lessons at four beats');

  for (const [pathId, lessons] of Object.entries(paths)) {
    const first = lessons?.['1'];
    assert(first, `${pathId} must have an opening lesson`);
    const teachingWords = String(first.teaching || '').split(/\s+/).filter(Boolean).length;
    const actionWords = String(first.action || '').split(/\s+/).filter(Boolean).length;
    const paragraphs = String(first.teaching || '').split(/\n\n+/).filter(Boolean);
    assert(teachingWords >= 60 && teachingWords <= 110, `${pathId}.1 teaching must be 60-110 words, found ${teachingWords}`);
    assert(paragraphs.length === 4, `${pathId}.1 teaching must have four beats, found ${paragraphs.length}`);
    assert(actionWords <= 24, `${pathId}.1 action must be at most 24 words, found ${actionWords}`);
    assert(!unsupportedOpeningClaim.test(first.teaching), `${pathId}.1 contains an unsupported or jargon-heavy opening claim`);
  }

  for (const [language, resource] of [['tr', trLessons], ['en', enLessons]]) {
    const defaultFreeLessons = resource.lessons['dopamine-detox'] || {};
    for (let lessonId = 1; lessonId <= 10; lessonId += 1) {
      const lesson = defaultFreeLessons[String(lessonId)];
      const teachingWords = String(lesson?.teaching || '').split(/\s+/).filter(Boolean).length;
      const actionWords = String(lesson?.action || '').split(/\s+/).filter(Boolean).length;
      const paragraphs = String(lesson?.teaching || '').split(/\n\n+/).filter(Boolean);
      assert(teachingWords >= 70 && teachingWords <= 110, `${language}.dopamine-detox.${lessonId} teaching must be 70-110 words, found ${teachingWords}`);
      assert(paragraphs.length === 4, `${language}.dopamine-detox.${lessonId} must have four beats, found ${paragraphs.length}`);
      assert(actionWords <= 24, `${language}.dopamine-detox.${lessonId} action must be at most 24 words, found ${actionWords}`);
      assert(!unsupportedOpeningClaim.test(lesson?.teaching || ''), `${language}.dopamine-detox.${lessonId} contains an unsupported or jargon-heavy claim`);
    }
  }

  const safetyEditedLessons = {
    'body-discipline': [2, 3, 4, 5],
    'money-discipline': [2, 3, 4, 5],
  };
  for (const [language, resource] of [['tr', trLessons], ['en', enLessons]]) {
    for (const [pathId, lessonIds] of Object.entries(safetyEditedLessons)) {
      for (const lessonId of lessonIds) {
        const lesson = resource.lessons[pathId][String(lessonId)];
        const teachingWords = String(lesson.teaching || '').split(/\s+/).filter(Boolean).length;
        const actionWords = String(lesson.action || '').split(/\s+/).filter(Boolean).length;
        const paragraphs = String(lesson.teaching || '').split(/\n\n+/).filter(Boolean);
        const riskyClaim = /%\s*\d+|\d+\s*%|\b(?:guarantee|garanti|kanıtlandı|proven)\b/i;
        assert(teachingWords >= 65 && teachingWords <= 120, `${language}.${pathId}.${lessonId} teaching must be 65-120 words, found ${teachingWords}`);
        assert(paragraphs.length === 4, `${language}.${pathId}.${lessonId} must have four beats, found ${paragraphs.length}`);
        assert(actionWords <= 24, `${language}.${pathId}.${lessonId} action must be at most 24 words, found ${actionWords}`);
        assert(!riskyClaim.test(lesson.teaching), `${language}.${pathId}.${lessonId} contains a percentage or guarantee claim`);
      }
    }
  }

  const freeLessonLimits = {
    'dopamine-detox': 10,
    'silent-morning': 5,
    'mind-discipline': 5,
    'body-discipline': 5,
    'money-discipline': 5,
  };
  const riskyFreeClaim = /%\s*\d+|\d+\s*%|\b(?:guarantee|guaranteed|garanti|kanıtlandı|proven)\b/i;
  for (const [language, resource] of [['tr', trLessons], ['en', enLessons]]) {
    for (const [pathId, limit] of Object.entries(freeLessonLimits)) {
      for (let lessonId = 1; lessonId <= limit; lessonId += 1) {
        const lesson = resource.lessons[pathId][String(lessonId)];
        const teachingWords = String(lesson.teaching || '').split(/\s+/).filter(Boolean).length;
        const actionWords = String(lesson.action || '').split(/\s+/).filter(Boolean).length;
        const paragraphs = String(lesson.teaching || '').split(/\n\n+/).filter(Boolean);
        const allCopy = [
          lesson.teaching,
          lesson.action,
          ...lesson.quiz.flatMap((question) => [question.q, question.explain, ...question.options]),
        ].join(' ');
        assert(teachingWords >= 60 && teachingWords <= 120, `${language}.${pathId}.${lessonId} free teaching must be 60-120 words, found ${teachingWords}`);
        assert(paragraphs.length === 4, `${language}.${pathId}.${lessonId} free teaching must have four beats, found ${paragraphs.length}`);
        assert(actionWords <= 24, `${language}.${pathId}.${lessonId} free action must be at most 24 words, found ${actionWords}`);
        assert(!riskyFreeClaim.test(allCopy), `${language}.${pathId}.${lessonId} free lesson contains an unqualified percentage or guarantee`);
      }
    }
  }

  for (const [pathId, lessons] of Object.entries(paths)) {
    for (const [lessonId, lesson] of Object.entries(lessons)) {
      assert(!jargonTitle.test(lesson.title || ''), `${pathId}.${lessonId} title contains avoidable English jargon: ${lesson.title}`);
    }
  }
});

run('reviewed advanced lesson safety', () => {
  const reviewedRanges = {
    'dopamine-detox': [[11, 50]],
    'silent-morning': [[6, 50]],
    'mind-discipline': [[6, 50]],
    'body-discipline': [[1, 50]],
    'money-discipline': [[1, 50]],
  };
  const riskyClaim = /%|\b(?:percent|guarantee|guaranteed|proven|research|studies|study|science|scientific|experts?|mortality|lifespan|y\u00fczde|garanti|kan\u0131tland\u0131|kan\u0131tlanm\u0131\u015f|ara\u015ft\u0131rma(?:lar)?|bilimsel|uzmanlar|mortalite|\u00f6m\u00fcr)\b/i;
  for (const [language, resource] of [['tr', trLessons], ['en', enLessons]]) {
    for (const [pathId, ranges] of Object.entries(reviewedRanges)) {
      for (const [start, end] of ranges) {
        for (let lessonId = start; lessonId <= end; lessonId += 1) {
          const lesson = resource.lessons[pathId][String(lessonId)];
          const teachingWords = String(lesson.teaching || '').split(/\s+/).filter(Boolean).length;
          const actionWords = String(lesson.action || '').split(/\s+/).filter(Boolean).length;
          const paragraphs = String(lesson.teaching || '').split(/\n\n+/).filter(Boolean);
          const allCopy = [
            lesson.title,
            lesson.teaching,
            lesson.action,
            lesson.reflectionPrompt,
            ...lesson.quiz.flatMap((question) => [question.q, question.explain, ...question.options]),
          ].join(' ');
          assert(teachingWords >= 60 && teachingWords <= 120, `${language}.${pathId}.${lessonId} reviewed teaching must be 60-120 words, found ${teachingWords}`);
          assert(paragraphs.length === 4, `${language}.${pathId}.${lessonId} reviewed teaching must have four beats, found ${paragraphs.length}`);
          assert(actionWords <= 24, `${language}.${pathId}.${lessonId} reviewed action must be at most 24 words, found ${actionWords}`);
          assert(!riskyClaim.test(allCopy), `${language}.${pathId}.${lessonId} reviewed lesson contains an unsupported authority, percentage, or guarantee claim`);
        }
      }
    }
  }
});

run('lesson locale schema', () => {
  const locales = [['tr', trLessons], ['en', enLessons]];
  const pathIds = Object.keys(trLessons.lessons);
  assert(pathIds.length === 5, `expected 5 paths, found ${pathIds.length}`);
  for (const [language, resource] of locales) {
    assert(Object.keys(resource.lessons).join('|') === pathIds.join('|'), `${language} path IDs differ`);
    for (const pathId of pathIds) {
      const lessons = resource.lessons[pathId];
      assert(Object.keys(lessons).length === 50, `${language}.${pathId} must have 50 lessons`);
      for (let order = 1; order <= 50; order += 1) {
        const lesson = lessons[String(order)];
        assert(lesson, `${language}.${pathId}.${order} missing`);
        for (const field of ['title', 'teaching', 'action', 'reflectionPrompt']) {
          assert(typeof lesson[field] === 'string' && lesson[field].trim(), `${language}.${pathId}.${order}.${field}`);
        }
        assert(Array.isArray(lesson.quiz) && lesson.quiz.length === 2, `${language}.${pathId}.${order}.quiz`);
        lesson.quiz.forEach((question, index) => {
          assert(typeof question.q === 'string' && question.q.trim(), `${language}.${pathId}.${order}.quiz[${index}].q`);
          assert(Array.isArray(question.options) && question.options.length === 4, `${language}.${pathId}.${order}.quiz[${index}].options`);
          assert(Number.isInteger(question.correct) && question.correct >= 0 && question.correct < 4, `${language}.${pathId}.${order}.quiz[${index}].correct`);
          assert(typeof question.explain === 'string' && question.explain.trim(), `${language}.${pathId}.${order}.quiz[${index}].explain`);
        });
      }
    }
  }
});

const moduleCache = new Map();
const loadModule = (file) => {
  let resolved = file;
  if (!path.extname(resolved)) resolved = resolveLocalImport(`${resolved}.js`, `./${path.basename(resolved)}`) || resolved;
  if (resolved.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;
  const module = { exports: {} };
  moduleCache.set(resolved, module);
  const source = fs.readFileSync(resolved, 'utf8');
  const code = babel.transformSync(source, {
    filename: resolved,
    babelrc: false,
    configFile: false,
    plugins: [transformModules],
  }).code;
  const localRequire = (request) => {
    if (!request.startsWith('.')) return require(request);
    const target = resolveLocalImport(resolved, request);
    if (!target) throw new Error(`Cannot resolve ${request} from ${relative(resolved)}`);
    return loadModule(target);
  };
  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire, module, module.exports, resolved, path.dirname(resolved),
  );
  return module.exports;
};

run('domain invariants', () => {
  const paths = loadModule(path.join(SRC, 'data/paths.js'));
  const ranks = loadModule(path.join(SRC, 'config/ranks.js'));
  const characters = loadModule(path.join(SRC, 'config/characterEvolution.js'));
  const challenges = loadModule(path.join(SRC, 'config/dailyChallenges.js'));
  const achievements = loadModule(path.join(SRC, 'config/achievements.js'));
  const decks = loadModule(path.join(SRC, 'data/dailyDecks.js'));
  const quotes = loadModule(path.join(SRC, 'config/quotes.js'));
  const purchases = loadModule(path.join(SRC, 'services/purchasePackages.js'));
  const products = loadModule(path.join(SRC, 'config/revenuecatProducts.js'));
  const dates = loadModule(path.join(SRC, 'utils/dateOnly.js'));

  assert(paths.PATHS.length === 5, `PATHS=${paths.PATHS.length}`);
  assert(new Set(paths.PATHS.map((item) => item.id)).size === paths.PATHS.length, 'duplicate path IDs');
  paths.PATHS.forEach((item, index) => {
    assert(item.order === index + 1, `path order ${item.id}`);
    assert(item.duration === 50, `path duration ${item.id}`);
    assert(item.freeLessons > 0 && item.freeLessons <= item.duration, `free lessons ${item.id}`);
    assert(paths.getPathLessons(item).length === item.duration, `generated lessons ${item.id}`);
  });
  assert(ranks.RANKS.length === 6, `RANKS=${ranks.RANKS.length}`);
  assert(characters.CHARACTER_STAGES.length === 6, `CHARACTER_STAGES=${characters.CHARACTER_STAGES.length}`);
  assert(challenges.DAILY_CHALLENGES.length === 30, `DAILY_CHALLENGES=${challenges.DAILY_CHALLENGES.length}`);
  assert(decks.DAILY_DECKS.length === 32, `DAILY_DECKS=${decks.DAILY_DECKS.length}`);
  assert(quotes.QUOTES.length === 35, `QUOTES=${quotes.QUOTES.length}`);
  const challengeA = challenges.getDailyChallenge('2026-06-20');
  const challengeB = challenges.getDailyChallenge('2026-06-20');
  assert(challengeA.id === challengeB.id, 'daily challenge is not deterministic');
  assert(new Set(achievements.ACHIEVEMENTS.map((item) => item.id)).size === achievements.ACHIEVEMENTS.length, 'duplicate achievement IDs');
  assert(achievements.ACHIEVEMENTS.every((item) => item.title !== '???' && item.description !== '???'), 'placeholder achievement copy');

  const sundayNoHistory = achievements.checkSpecialAchievements({
    now: new Date(2026, 5, 21, 12),
    unlocked: [],
    lessonHistory: {},
  });
  const sundayAfterSaturday = achievements.checkSpecialAchievements({
    now: new Date(2026, 5, 21, 12),
    unlocked: [],
    lessonHistory: { '2026-06-20': 1 },
  });
  assert(!sundayNoHistory.includes('weekend_warrior'), 'weekend achievement unlocked after one day');
  assert(sundayAfterSaturday.includes('weekend_warrior'), 'weekend achievement did not require both days');

  const boundaryNow = new Date(2026, 5, 20, 0, 1);
  assert(dates.toLocalDateString(boundaryNow) === '2026-06-20', 'local date formatting mismatch');
  assert(dates.calendarDaysSince('2026-06-17', boundaryNow) === 3, 'calendar day distance mismatch');
  assert(dates.calendarDaysSince('invalid', boundaryNow) === null, 'invalid date must return null');

  const monthly = { packageType: 'MONTHLY', product: { identifier: products.PRODUCT_ID_MONTHLY } };
  const yearly = { packageType: 'ANNUAL', product: { identifier: products.PRODUCT_ID_YEARLY } };
  assert(purchases.getPackageForPeriod([yearly, monthly], 'monthly') === monthly, 'monthly selection mismatch');
  assert(purchases.getPackageForPeriod([monthly, yearly], 'yearly') === yearly, 'yearly selection mismatch');
  assert(purchases.getPackageForPeriod([yearly], 'monthly') === null, 'monthly must not fall back to yearly');
  assert(purchases.getPackageForPeriod([monthly], 'yearly') === null, 'yearly must not fall back to monthly');
});

run('Supabase policy idempotency', () => {
  const supabaseRoot = path.join(ROOT, 'supabase');
  const sqlFiles = walk(supabaseRoot, '.sql');
  const sql = sqlFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n\n');
  const sqlWithoutComments = sql.replace(/--.*$/gm, '');
  const creates = [...sql.matchAll(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([\w.]+)/gi)];
  const missingDrops = creates.filter((match) => {
    const escaped = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const table = match[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${escaped}"\\s+ON\\s+${table}`, 'i').test(sql);
  });
  assert(!missingDrops.length, `missing DROP POLICY: ${missingDrops.map((match) => match[1]).join(', ')}`);
  assert(/set\s+search_path\s*=\s*public,\s*pg_temp/i.test(sql), 'trigger functions must pin search_path');
  assert(/revoke\s+execute\s+on\s+function\s+public\.rls_auto_enable\(\)\s+from\s+public/i.test(sql), 'public SECURITY DEFINER helper execute must be revoked');
  assert(/analytics_events_user_idx[\s\S]*on\s+public\.analytics_events\s*\(user_id/i.test(sql), 'analytics_events.user_id foreign key needs a covering index');
  assert(/squad_member_progress_user_idx[\s\S]*on\s+public\.squad_member_progress\s*\(user_id/i.test(sql), 'squad_member_progress.user_id foreign key needs a covering index');
  assert(!/create\s+policy\s+"referrals: redeemer can mark redemption"/i.test(sqlWithoutComments), 'referral UPDATE policies must be merged');
  assert(!/create\s+policy\s+"referrals: owner can mark reward paid"/i.test(sqlWithoutComments), 'referral UPDATE policies must be merged');
  assert(/create\s+policy\s+"referrals: update own redemption state"/i.test(sqlWithoutComments), 'merged referral UPDATE policy missing');
  const directAuthCalls = [...sqlWithoutComments.matchAll(/auth\.(uid|role)\(\)/g)]
    .filter((match) => !sqlWithoutComments.slice(Math.max(0, match.index - 12), match.index).endsWith('(select '));
  assert(!directAuthCalls.length, `RLS auth calls must use (select auth.*()): ${directAuthCalls.map((match) => match[0]).join(', ')}`);
});

run('stale content seed scripts stay removed', () => {
  const scriptDir = path.join(ROOT, 'scripts');
  const staleSeeds = fs.readdirSync(scriptDir)
    .filter((name) => /^seed_.*\.js$/.test(name))
    .sort();
  assert(!staleSeeds.length, `stale seed scripts can reintroduce unsafe copy: ${staleSeeds.join(', ')}`);
});

run('public copy avoids unsupported motivation stats', () => {
  const files = [
    'src/components/StreakLostBanner.js',
    'src/data/dailyDecks.js',
    'src/i18n/locales/tr.json',
    'src/i18n/locales/en.json',
  ];
  const banned = /(?:Monk Mode|%47|47%|%80|%90|science-proven|kanıtlandı|kanıtlanmış|Matthew Walker|Stanford|Wim Hof|Default Mode Network|Ultradian|Intermittent Fasting)/i;
  const issues = files.flatMap((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return banned.test(source) ? [file] : [];
  });
  assert(!issues.length, `unsupported or stale public copy in: ${issues.join(', ')}`);
});

run('critical flow regression guards', () => {
  const appContext = fs.readFileSync(path.join(SRC, 'contexts/AppContext.js'), 'utf8');
  const ads = fs.readFileSync(path.join(SRC, 'services/ads.js'), 'utf8');
  const home = fs.readFileSync(path.join(SRC, 'screens/HomeScreen.js'), 'utf8');
  const pathScreen = fs.readFileSync(path.join(SRC, 'screens/PathScreen.js'), 'utf8');
  const lesson = fs.readFileSync(path.join(SRC, 'screens/LessonScreen.js'), 'utf8');
  const resetPassword = fs.readFileSync(path.join(SRC, 'screens/auth/ResetPasswordScreen.js'), 'utf8');
  const signup = fs.readFileSync(path.join(SRC, 'screens/auth/SignupScreen.js'), 'utf8');
  const login = fs.readFileSync(path.join(SRC, 'screens/auth/LoginScreen.js'), 'utf8');
  const cloudSync = fs.readFileSync(path.join(SRC, 'services/cloudSync.js'), 'utf8');
  const outOfHeartsModal = fs.readFileSync(path.join(SRC, 'components/OutOfHeartsModal.js'), 'utf8');

  assert(
    appContext.includes('resetPendingForUserRef.current === userId')
      && appContext.includes('userSwitchResetNonce'),
    'user switch must block cloud pull until reset completes',
  );
  assert(
    appContext.includes('if (userId && !purchaseIdentityReady)')
      && appContext.includes('purchaseIdentityReady = await linkPurchaseUser(userId)'),
    'premium check must wait for RevenueCat user identity binding',
  );
  assert(
    appContext.includes('markReferralRewardsPaid(unpaidIds)')
      && appContext.includes("['invalid', 'own_code', 'already_redeemed', 'already_used_a_code']"),
    'referral rewards must be crash-safe and pending codes must survive transient errors',
  );
  assert(
    cloudSync.includes("'referralOwnerRewardIds'")
      && cloudSync.includes('cloudPayload.referralOwnerRewardIds'),
    'referral owner reward ids must sync and merge across devices',
  );
  assert(
    ads.includes('let rewardedLoadPromise = null')
      && ads.includes('const nextRewarded = gma.RewardedAd.createForAdRequest')
      && ads.includes('const adToShow = rewarded'),
    'rewarded ads must guard concurrent loads and show the loaded instance',
  );
  assert(
    home.includes('const [pendingLesson, setPendingLesson]')
      && home.includes("navigation.navigate('Lesson', target)"),
    'Home out-of-hearts refill must resume the tapped lesson',
  );
  assert(
    pathScreen.includes('finalState !== \'completed\'')
      && pathScreen.includes('const [pendingLesson, setPendingLesson]')
      && pathScreen.includes("navigation.navigate('Lesson', target)"),
    'Path out-of-hearts guard must allow completed lessons and resume pending lessons',
  );
  assert(
    !/onRefill\?\.\(\);\s*onClose\?\.\(\);/.test(outOfHeartsModal),
    'out-of-hearts refill must let each parent own its post-refill navigation',
  );
  assert(
    lesson.includes('const canonicalPathId = lesson?.pathId || pathId')
      && /completePathLesson\(\{\r?\n\s*pathId: canonicalPathId/.test(lesson)
      && lesson.includes("navigation.replace('Lesson', { pathId: canonicalPathId"),
    'LessonScreen must use the lesson canonical path for content/progress/navigation',
  );
  assert(
    resetPassword.includes('exchangeCodeForSession(params.code)'),
    'reset-password screen must support Supabase PKCE code recovery links',
  );
  assert(
    signup.includes('password.length < 8') && resetPassword.includes('password.length < 8'),
    'new and reset passwords must enforce the eight-character minimum available on every plan',
  );
  assert(
    login.includes('if (!password)') && !login.includes('password.length < 8'),
    'login must not lock out accounts created under the legacy password policy',
  );
});

if (failures.length) {
  console.error(`\nquality:static failed (${failures.length} checks)`);
  process.exit(1);
}

console.log(`\nquality:static passed: ${assertions} assertions across ${jsFiles.length} JS files`);
