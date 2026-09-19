import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readWav, analyze } from '../lib/analyze.mjs';
import { ROOMS, irOf } from '../scripts/ir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

test('an impulse is silent for exactly its pre-delay, then reflections, then a tail', () => {
  for (const [name, spec] of Object.entries(ROOMS)) {
    const [l, r] = irOf(spec);
    const head = Math.round(spec.predelay * 44100);
    assert.equal(l.slice(0, head).reduce((m, x) => Math.max(m, Math.abs(x)), 0), 0, `${name}: the pre-delay must be digital silence, or it is not a pre-delay`);
    const first = l.findIndex((x) => x !== 0);
    assert.ok(first >= head && first < head + 0.06 * 44100, `${name}: the first reflection lands ${(((first - head) / 44100) * 1000).toFixed(1)} ms after the pre-delay; early reflections are early, and the room's own flight time must not stack on top`);
    assert.equal(l.length, Math.round((spec.predelay + spec.decay) * 44100), `${name}: room.size truncates the file, so it must be as long as it claims`);
    const peak = Math.max(...[l, r].map((c) => c.reduce((m, x) => Math.max(m, Math.abs(x)), 0)));
    assert.ok(peak > 0.99 && peak <= 1, `${name}: normalized, not clipped (peak ${peak})`);
    const tail = l.slice(-441).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    assert.ok(tail < 0.02, `${name}: the tail has decayed by the end (${tail})`);
  }
});

test('the generated pack is stereo and each impulse covers the room sizes the songs ask for', { skip: !fs.existsSync(path.join(ROOT, 'samples/user/rooms/hall.wav')) && 'run npm run ir first' }, () => {
  // a room.size longer than the impulse it names is silently truncated by superdough, so the song asking for it is the test
  const asked = fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.strudel'))
    .flatMap((f) => [...fs.readFileSync(path.join(ROOT, 'songs', f), 'utf8').matchAll(/room:\s*\{([^}]*)\}/g)]
      .map(([, body]) => ({ ir: body.match(/\bir:\s*'([^']+)'/)?.[1], size: Number(body.match(/\bsize:\s*([\d.]+)/)?.[1]), song: f }))
      .filter((r) => r.ir && r.size));
  const secsOf = {};
  for (const name of Object.keys(ROOMS)) {
    const wav = readWav(fs.readFileSync(path.join(ROOT, 'samples/user/rooms', `${name}.wav`)));
    assert.equal(wav.channels, 2, `${name}: a mono impulse gives every part the same reverb in both ears`);
    assert.ok(analyze(wav).width > 0, `${name}: the reflections must differ between the channels, or the room has no shape`);
    secsOf[name] = wav.frames[0].length / wav.rate;
  }
  for (const { ir, size, song } of asked) {
    if (!(ir in secsOf)) continue; // another pack's impulse
    assert.ok(secsOf[ir] >= size, `${song}: room.size ${size} outlasts ${ir}.wav (${secsOf[ir].toFixed(1)} s), so its tail is cut off`);
  }
});
