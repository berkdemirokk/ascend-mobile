const { spawnSync } = require('node:child_process');

const isWindows = process.platform === 'win32';
const command = process.execPath;
const expoCli = require.resolve('expo/bin/cli');
const args = [
  expoCli,
  'export',
  '--platform',
  'ios',
  '--output-dir',
  'dist-ci',
];

if (isWindows) {
  // Windows Application Control can reject the newly downloaded hermesc.exe
  // before it starts (spawn UNKNOWN). Metro still validates the complete JS
  // graph here; Linux/macOS CI keeps the real Hermes bytecode compilation.
  args.push('--no-bytecode');
  console.log('[export:ios] Windows detected; validating the iOS JS bundle without Hermes bytecode.');
}

const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
