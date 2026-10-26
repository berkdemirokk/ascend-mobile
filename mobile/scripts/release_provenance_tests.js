const assert = require('node:assert/strict');
const { verifyBuild } = require('./verify_eas_build');

const expected = {
  buildId: 'e4855afe-4c7c-4197-9688-adde76c151d6',
  commit: 'a'.repeat(40),
  app: { version: '1.0.46', extra: { eas: { projectId: 'expected-project' } } },
};
const valid = {
  id: expected.buildId,
  project: { id: 'expected-project' },
  platform: 'IOS', status: 'FINISHED', distribution: 'STORE',
  isForIosSimulator: false, buildProfile: 'production',
  gitCommitHash: expected.commit, appVersion: '1.0.46', appBuildVersion: '132',
};
assert.equal(verifyBuild(valid, expected), valid);
assert.equal(verifyBuild({ ...valid, project: undefined }, expected).id, expected.buildId);
for (const invalid of [
  { id: 'another-build' }, { project: { id: 'another-project' } },
  { platform: 'ANDROID' }, { status: 'IN_PROGRESS' }, { status: 'ERRORED' },
  { distribution: 'INTERNAL' }, { isForIosSimulator: true }, { isForIosSimulator: undefined },
  { buildProfile: 'preview' }, { gitCommitHash: 'b'.repeat(40) }, { gitCommitHash: undefined },
  { appVersion: '1.0.44' }, { appBuildVersion: undefined },
]) {
  assert.throws(() => verifyBuild({ ...valid, ...invalid }, expected), JSON.stringify(invalid));
}
assert.throws(() => verifyBuild(valid, { ...expected, app: {} }));
assert.throws(() => verifyBuild(valid, { ...expected, commit: 'main' }));
console.log('Release provenance tests passed: valid production build accepted; 15 invalid candidates rejected.');
