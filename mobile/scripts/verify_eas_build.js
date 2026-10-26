const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

// Validate provider metadata, not caller-supplied labels, before submitting an IPA.
function verifyBuild(build, { buildId, commit, app }) {
  assert(build && !Array.isArray(build), 'Expected one EAS build metadata object');
  assert.equal(typeof buildId, 'string', 'Expected a build ID');
  assert(buildId.length > 0, 'Expected a nonempty build ID');
  assert(app?.extra?.eas?.projectId && app?.version, 'app.json must declare its EAS project and version');
  assert.match(commit || '', /^[0-9a-f]{40}$/i, 'Expected a full checkout commit SHA');
  assert.equal(build.id, buildId, 'EAS returned a different build ID');
  const reportedProjectId = build.project?.id || build.projectId || build.easProjectId;
  const reportedProjectSlug = build.project?.slug || build.projectSlug;
  // EAS CLI may omit project fields in its JSON response. `eas build:view` is
  // scoped by the checked-out app config and confirms the matching project;
  // reject any project identity it does report when it conflicts.
  if (reportedProjectId) assert.equal(reportedProjectId, app.extra?.eas?.projectId, 'Wrong EAS project');
  if (reportedProjectSlug) assert.equal(reportedProjectSlug, app.slug, 'Wrong EAS project slug');
  assert.equal(build.platform, 'IOS', 'Build is not an iOS binary');
  assert.equal(build.status, 'FINISHED', 'Build has not finished successfully');
  assert.equal(build.distribution, 'STORE', 'Build is not signed for store distribution');
  assert.equal(build.isForIosSimulator, false, 'Simulator or unknown-target builds cannot be submitted');
  assert.equal(build.buildProfile, 'production', 'Build must use the production profile');
  assert.equal(build.gitCommitHash, commit, 'Build source does not match the verified checkout');
  assert.equal(build.appVersion, app.version, 'Build marketing version does not match app.json');
  assert.match(String(build.appBuildVersion || ''), /^\d+(?:\.\d+){0,2}$/, 'Missing or invalid iOS build number');
  return build;
}

if (require.main === module) {
  const metadataPath = process.argv[2];
  assert(metadataPath, 'Usage: node scripts/verify_eas_build.js <metadata.json>');
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')).expo;
  const build = verifyBuild(JSON.parse(fs.readFileSync(metadataPath, 'utf8')), {
    buildId: process.env.EAS_BUILD_ID,
    commit: process.env.GITHUB_SHA,
    app,
  });
  console.log(`Verified iOS ${build.appVersion} (${build.appBuildVersion}) from ${build.gitCommitHash}`);
}

module.exports = { verifyBuild };
