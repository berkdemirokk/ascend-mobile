// Temporary, narrowly scoped mitigation for GHSA-86w9-cpqp-85rv.
// Matches the DigestAlgorithm count guard proposed upstream in forge PR #1152.
// No patched npm release exists as of 2026-10-25. Remove after upgrading.
const fs = require('fs');
const crypto = require('crypto');

const ORIGINAL_HASH = 'fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50';
const BEFORE = 'obj.value.length !== 2) {';
const AFTER = "obj.value.length !== 2 ||\n            obj.value[0].value.length !==\n            (('parameters' in capture) ? 2 : 1)) {";
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function verifyForgePatch({ apply = false } = {}) {
  const version = require('node-forge/package.json').version;
  if (version !== '1.4.0') throw new Error(`Review forge mitigation for version ${version}`);
  const file = require.resolve('node-forge/lib/rsa');
  const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const reverted = source.replace(AFTER, BEFORE);
  if (source.includes(AFTER) && hash(reverted) === ORIGINAL_HASH) return true;
  if (hash(source) !== ORIGINAL_HASH || source.split(BEFORE).length !== 2) {
    throw new Error('node-forge RSA source differs from the reviewed 1.4.0 source');
  }
  if (!apply) throw new Error('node-forge mitigation missing; run npm install (postinstall required)');
  fs.writeFileSync(file, source.replace(BEFORE, AFTER));
  console.log('[security] Applied node-forge nested DigestAlgorithm guard (GHSA-86w9-cpqp-85rv)');
  return true;
}

if (require.main === module) verifyForgePatch({ apply: !process.argv.includes('--check') });
module.exports = { verifyForgePatch };
