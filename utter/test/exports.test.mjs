// The boundary, enforced rather than agreed: one entry point, nothing reaching outside the folder, and the SDK and the
// key each confined to the files that are allowed to see them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(import.meta.dirname, '..');
const SDK = 'microsoft-cognitiveservices-speech-sdk';
const PRIVILEGED = new Set(['azure.mjs', 'worker.mjs']); // the only files that may name the SDK or read the key
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.name === 'node_modules' ? [] : e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.mjs') ? [path.join(dir, e.name)] : []);
const specifiers = (src) => [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);

test('utter resolves', async () => {
  assert.equal(typeof (await import('utter')), 'object');
});

test('the internals stay internal: a deep import is refused', async () => {
  await assert.rejects(() => import('utter/ssml.mjs'), (e) => e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED');
});

test('nothing in utter imports from outside utter, and only azure/worker name the SDK', () => {
  for (const f of files(HERE)) {
    const rel = path.relative(HERE, f).replaceAll('\\', '/'), inTest = rel.startsWith('test/');
    for (const spec of specifiers(fs.readFileSync(f, 'utf8'))) {
      if (spec.startsWith('node:')) continue;
      if (spec.startsWith('.')) {
        assert.ok(!path.relative(HERE, path.resolve(path.dirname(f), spec)).startsWith('..'), `${rel} reaches outside utter: ${spec}`);
        continue;
      }
      if (inTest && (spec === 'utter' || spec.startsWith('utter/'))) continue; // the suite imports the package as a consumer would
      assert.equal(spec, SDK, `${rel} imports ${spec}: the SDK is the only outside dependency`);
      assert.ok(PRIVILEGED.has(rel), `${rel} names the SDK; only azure.mjs and worker.mjs may`);
    }
  }
});

test('only azure/worker read the key', () => {
  for (const f of files(HERE)) {
    const rel = path.relative(HERE, f).replaceAll('\\', '/');
    if (PRIVILEGED.has(rel) || rel.startsWith('test/')) continue;
    assert.ok(!/process\.env\.AZURE_SPEECH_KEY/.test(fs.readFileSync(f, 'utf8')), `${rel} reads the key`);
  }
});
