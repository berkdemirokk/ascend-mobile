const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const theme = fs.readFileSync(path.join(ROOT, 'src', 'config', 'lightTheme.js'), 'utf8');

const expected = {
  repository: 'berkdemirokk/ascend-mobile',
  name: 'Ascend: Daily Discipline',
  slug: 'ascend-level-up',
  bundleIdentifier: 'com.ascend.growth',
  projectId: '2a44eced-27a4-4ae2-b831-25957422f01b',
  icon: './assets/icon.png',
  splash: './assets/splash.png',
};

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(app.name === expected.name, `app name must be ${expected.name}`);
check(app.slug === expected.slug, `app slug must be ${expected.slug}`);
check(app.version === pkg.version, 'app.json and package.json versions must match');
check(app.ios?.bundleIdentifier === expected.bundleIdentifier, 'unexpected iOS bundle identifier');
check(app.extra?.eas?.projectId === expected.projectId, 'unexpected EAS project id');
check(app.userInterfaceStyle === 'light', 'release must use the reviewed light theme');
check(app.icon === expected.icon, 'unexpected release icon path');
check(app.plugins?.some((plugin) => Array.isArray(plugin)
  && plugin[0] === 'expo-splash-screen'
  && plugin[1]?.image === expected.splash
  && plugin[1]?.backgroundColor === '#F9F9F9'), 'unexpected release splash configuration');
check(theme.includes("background: '#F9F9F9'"), 'reviewed white background token is missing');
check(theme.includes("primaryContainer: '#E31212'"), 'reviewed red brand token is missing');
check(fs.existsSync(path.join(ROOT, 'assets', 'icon.png')), 'release icon file is missing');
check(fs.existsSync(path.join(ROOT, 'assets', 'splash.png')), 'release splash file is missing');

if (process.env.GITHUB_REPOSITORY) {
  check(process.env.GITHUB_REPOSITORY === expected.repository,
    `release workflow must run only in ${expected.repository}`);
} else {
  const remote = spawnSync('git', ['-C', ROOT, 'remote', 'get-url', 'origin'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (remote.status === 0) {
    check(/berkdemirokk\/ascend-mobile(?:\.git)?\s*$/.test(remote.stdout),
      `local origin must be ${expected.repository}`);
  } else {
    failures.push('unable to verify the local git origin');
  }
}

if (failures.length) {
  console.error('Release identity verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error('Refusing to build: this is not the reviewed red-and-white Ascend app.');
  process.exit(1);
}

console.log('Release identity verified: canonical red-and-white Ascend app.');
