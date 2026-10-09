import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseName, isCc0, importKit } from '../scripts/freesound.mjs';

test('parseName: voice prefix and the Freesound id', () => {
  assert.deepEqual(parseName('bd_123456__someone__big-kick.wav'), { voice: 'bd', id: '123456' });
  assert.equal(parseName('kick_123456__x__y.wav'), null, 'not a voice');
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
    const r = await importKit(src, 'tkit', { fetchJson: async (id) => meta[id], root });
    assert.deepEqual(r.imported.map((x) => x.id), ['1']);
    assert.deepEqual(r.rejected.map((x) => x.file), ['sd_2__b__s.wav']);
    assert.ok(fs.existsSync(path.join(root, 'samples', 'user', 'tkit', 'tkit_bd', '1.wav')));
    assert.ok(!fs.existsSync(path.join(root, 'samples', 'user', 'tkit', 'tkit_sd')));
    const pack = JSON.parse(fs.readFileSync(path.join(root, 'samples', 'user', 'tkit', 'pack.json'), 'utf8'));
    assert.equal(pack.deploy, true); assert.equal(pack.license, 'CC0-1.0');
    assert.match(fs.readFileSync(path.join(root, 'samples', 'user', 'tkit', 'LICENSE-ASSETS.md'), 'utf8'), /\| tkit_bd\/1\.wav \| k \| a \| https:\/\/freesound\.org\/s\/1\/ \| CC0 \|/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
