const { spawnSync } = require('node:child_process');
const { verifyDependencyBehavior } = require('./security_dependency_tests');

// Inspect advisory roots, not the duplicated npm meta-vulnerability dependents.
// The only exception is executable mitigation, verified below, for this exact
// upstream advisory. New high/critical advisories always fail the build.
const MITIGATED_URL = 'https://github.com/advisories/GHSA-86w9-cpqp-85rv';
function assessAudit(report) {
  if (!report || report.error || !report.vulnerabilities) throw new Error('npm audit did not return a valid report');
  const blocking = [];
  const mitigated = new Set();
  const visit = (name, visited = new Set()) => {
    if (visited.has(name)) return;
    visited.add(name);
    const finding = report.vulnerabilities[name];
    if (!finding) throw new Error(`Missing audit dependency ${name}`);
    if (!finding.via?.length && ['high', 'critical'].includes(finding.severity)) blocking.push(name);
    for (const via of finding.via || []) {
      if (typeof via === 'string') { visit(via, visited); continue; }
      if (!['high', 'critical'].includes(via.severity)) continue;
      if (name === 'node-forge' && via.url === MITIGATED_URL && via.severity === 'high') mitigated.add(via.url);
      else blocking.push(`${name}: ${via.title || via.url}`);
    }
  };
  Object.keys(report.vulnerabilities).forEach((name) => visit(name));
  return { blocking: [...new Set(blocking)], mitigated: [...mitigated] };
}

if (require.main === module) {
  const result = spawnSync('npm audit --omit=dev --json', { shell: true, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.error || result.status === null || result.status > 1) throw new Error(result.stderr || 'npm audit failed');
  const report = JSON.parse(result.stdout);
  const { blocking, mitigated } = assessAudit(report);
  // Never silently accept the published vulnerability without the exact patch
  // and actual verification behavior, including when install scripts were skipped.
  verifyDependencyBehavior();
  if (mitigated.length) {
    console.warn(`[security] npm reports ${report.metadata?.vulnerabilities?.high || 0} HIGH package paths; ` +
      `the node-forge advisory is mitigated by a verified local patch: ${MITIGATED_URL}`);
  }
  if (blocking.length) throw new Error(`Unmitigated high/critical advisories:\n${blocking.join('\n')}`);
  console.log('[security] No unmitigated high/critical dependency advisories');
}
module.exports = { assessAudit };
