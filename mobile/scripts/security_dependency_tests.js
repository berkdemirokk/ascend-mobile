const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { verifyForgePatch } = require('./patch_security_dependencies');

function verifyDependencyBehavior() {
  verifyForgePatch();
  const forge = require('node-forge');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
  const privateForge = forge.pki.privateKeyFromPem(privateKey.export({ type: 'pkcs1', format: 'pem' }));
  const publicForge = forge.pki.publicKeyFromPem(publicKey.export({ type: 'spki', format: 'pem' }));
  const message = 'Ascend dependency regression';
  const digest = crypto.createHash('sha256').update(message).digest('latin1');
  const signature = crypto.sign('sha256', Buffer.from(message), privateKey).toString('latin1');
  assert.equal(publicForge.verify(digest, signature), true, 'valid Node signature must still verify');
  const a = forge.asn1;
  const element = (type, value, constructed = false) => a.create(a.Class.UNIVERSAL, type, constructed, value);
  for (const withNull of [true, false]) {
    const algorithm = [element(a.Type.OID, a.oidToDer(forge.oids.sha256).getBytes())];
    if (withNull) algorithm.push(element(a.Type.NULL, ''));
    const info = (children) => a.toDer(element(a.Type.SEQUENCE, [
      element(a.Type.SEQUENCE, children, true), element(a.Type.OCTETSTRING, digest),
    ], true)).getBytes();
    assert.equal(publicForge.verify(digest, privateForge.sign(info(algorithm), null)), true);
    const malformed = info([...algorithm, element(a.Type.OCTETSTRING, 'unconsumed bytes')]);
    assert.throws(() => publicForge.verify(digest, privateForge.sign(malformed, null)), /DigestInfo/,
      'nested extra elements must fail before digest comparison');
  }
  // Exercise the real Expo CLI schema consumers against the Zod override.
  const cliRoot = path.dirname(require.resolve('@expo/cli/package.json', { paths: [path.dirname(require.resolve('expo/package.json'))] }));
  const { PluginSchema, DevToolsPluginOutputSchema } = require(path.join(cliRoot, 'build/src/start/server/DevToolsPlugin.schema.js'));
  const { createMCPDevToolsExtensionSchema } = require(path.join(cliRoot, 'build/src/start/server/createMCPDevToolsExtensionSchema.js'));
  const plugin = PluginSchema.parse({ packageName: 'fixture', packageRoot: '/fixture', cliExtensions: {
    description: 'Fixture', entryPoint: 'index.js', commands: [{ name: 'inspect', title: 'Inspect', environments: ['cli'],
      parameters: [{ name: 'count', type: 'number' }] }],
  } });
  const schema = createMCPDevToolsExtensionSchema(plugin);
  assert.equal(schema.safeParse({ command: 'inspect', count: 2 }).success, true);
  assert.equal(schema.safeParse({ command: 'inspect', count: 'wrong' }).success, false);
  assert.equal(schema.safeParse({ command: 'inspect', unexpected: 1 }).success, false);
  assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'text', text: 'ok', level: 'info' }]).success, true);
  console.log('[security] Signature rejection, valid signatures, and Expo Zod consumers verified');
}
if (require.main === module) verifyDependencyBehavior();
module.exports = { verifyDependencyBehavior };
