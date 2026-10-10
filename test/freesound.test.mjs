import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { writeWav } from '../scripts/analyze.mjs';
import { readWav } from '../lib/analyze.mjs';
import { parseName, isCc0, importKit } from '../scripts/freesound.mjs';

test('parseName: voice prefix and the Freesound id', () => {
  assert.deepEqual(parseName('bd_123456__someone__big-kick.wav'), { voice: 'bd', id: '123456' });
  assert.deepEqual(parseName('tambourine_123456__x__y.wav'), { voice: 'tambourine', id: '123456' }, 'an extra sound');
  assert.equal(parseName('Kick_123456__x__y.wav'), null, 'not a sound name');
  assert.equal(parseName('bd_nokick.wav'), null, 'no id');
});
test('isCc0 accepts the CC0 url and name, nothing else', () => {
  assert.ok(isCc0('http://creativecommons.org/publicdomain/zero/1.0/'));
  assert.ok(isCc0('Creative Commons 0'));
  assert.ok(!isCc0('http://creativecommons.org/licenses/by/3.0/'));
  assert.ok(!isCc0('Attribution'));
});
test('importKit copies CC0 files into <kit>_<voice>/<id>.wav, rejects others, writes pack.json and the licence table', async () => {
  const root = path.resolve(import.meta.dirname, '_t_fs'), src = path.join(root, 'in');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'bd_1__a__k.wav'), 'x'); fs.writeFileSync(path.join(src, 'sd_2__b__s.wav'), 'x');
  const meta = { 1: { id: 1, name: 'k', username: 'a', license: 'http://creativecommons.org/publicdomain/zero/1.0/', url: 'https://freesound.org/s/1/' }, 2: { id: 2, name: 's', username: 'b', license: 'http://creativecommons.org/licenses/by/4.0/', url: 'https://freesound.org/s/2/' } };
  try {
    const r = await importKit(src, 'tkit', { fetchJson: async (id) => meta[id], root, peakDb: null });
    assert.deepEqual(r.imported.map((x) => x.id), ['1']);
    assert.deepEqual(r.rejected.map((x) => x.file), ['sd_2__b__s.wav']);
    assert.ok(fs.existsSync(path.join(root, 'samples', 'user', 'tkit', 'tkit_bd', '1.wav')));
    assert.ok(!fs.existsSync(path.join(root, 'samples', 'user', 'tkit', 'tkit_sd')));
    const pack = JSON.parse(fs.readFileSync(path.join(root, 'samples', 'user', 'tkit', 'pack.json'), 'utf8'));
    assert.equal(pack.deploy, true); assert.equal(pack.license, 'CC0-1.0');
    assert.match(fs.readFileSync(path.join(root, 'samples', 'user', 'tkit', 'LICENSE-ASSETS.md'), 'utf8'), /\| tkit_bd\/1\.wav \| k \| a \| https:\/\/freesound\.org\/s\/1\/ \| CC0 \|/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('importKit peak-normalises a wav to peakDb and says so in the licence header', async () => {
  const root = path.resolve(import.meta.dirname, '_t_fs2'), src = path.join(root, 'in');
  fs.mkdirSync(src, { recursive: true });
  const ch = new Float32Array(1000); ch[10] = 0.25; ch[20] = -0.1;
  writeWav(path.join(src, 'bd_1__a__k.wav'), 44100, [ch]);
  const meta = { 1: { id: 1, name: 'k', username: 'a', license: 'Creative Commons 0', url: 'https://freesound.org/s/1/' } };
  try {
    await importKit(src, 'tkit', { fetchJson: async (id) => meta[id], root, peakDb: -3 });
    const w = readWav(fs.readFileSync(path.join(root, 'samples', 'user', 'tkit', 'tkit_bd', '1.wav')));
    assert.ok(Math.abs(Math.max(...w.frames[0].map(Math.abs)) - 0.708) < 1e-3);
    assert.equal(w.rate, 44100);
    assert.match(fs.readFileSync(path.join(root, 'samples', 'user', 'tkit', 'LICENSE-ASSETS.md'), 'utf8'), /peak-normalised to -3 dBFS at import/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('importKit refuses a non-wav input while normalising', async () => {
  const root = path.resolve(import.meta.dirname, '_t_fs4'), src = path.join(root, 'in');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'bd_1__a__k.flac'), 'x');
  try { await assert.rejects(importKit(src, 'tkit', { fetchJson: async () => ({}), root, peakDb: -3 }), /only wav/); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('importKit: a failing lookup writes nothing, and a re-run drops stale takes', async () => {
  const root = path.resolve(import.meta.dirname, '_t_fs3'), src = path.join(root, 'in'), bd = path.join(root, 'samples', 'user', 'tkit', 'tkit_bd');
  fs.mkdirSync(src, { recursive: true }); fs.mkdirSync(bd, { recursive: true });
  fs.writeFileSync(path.join(src, 'bd_1__a__k.wav'), 'x'); fs.writeFileSync(path.join(src, 'bd_2__a__k.wav'), 'x'); fs.writeFileSync(path.join(bd, '99.wav'), 'old');
  const ok = { license: 'Creative Commons 0', name: 'k', username: 'a', url: 'u' };
  try {
    await assert.rejects(importKit(src, 'tkit', { fetchJson: async (id) => { if (id === '2') throw new Error('429'); return ok; }, root, peakDb: null }), /429/);
    assert.ok(fs.existsSync(path.join(bd, '99.wav')) && !fs.existsSync(path.join(bd, '1.wav')), 'nothing touched');
    await importKit(src, 'tkit', { fetchJson: async () => ok, root, peakDb: null });
    assert.ok(!fs.existsSync(path.join(bd, '99.wav')) && fs.existsSync(path.join(bd, '1.wav')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
