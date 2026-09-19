// Generate the impulse responses of samples/user/rooms/ (`npm run ir`). Nothing is downloaded: each room is a shoebox
// model, so the file is silence (the pre-delay, which superdough has no control for), then the early reflections the
// ear reads a room's shape and size from, then a decaying noise tail like the one superdough synthesizes itself.
// A song uses one with packs: ['rooms'] and room: { ir: 'hall' }; room.irbegin reads the same file from a fraction in,
// room.size truncates it (never stretches it), and the convolver normalizes, so only the taps' relative levels matter.
// ponytail: a shoebox gives plausible geometry, not a real room's diffusion; drop a recorded wav in the pack instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeWav } from './analyze.mjs';

const RATE = 44100, SPEED = 343; // m/s

// mulberry32: the same seeded PRNG the generators use, so a regenerated pack is byte-identical
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/**
 * Image-source reflections of a shoebox `w × d × h` (metres) with the source `src` and the listener `lis` in it:
 * every mirrored copy of the source up to `order` bounces is one tap, delayed by its distance over the speed of sound,
 * quieter by that distance and by `absorb` per wall it bounced off, and panned by how far to the side it arrives from.
 * Times and gains are relative to the direct path, because the dry signal is what the send is delayed against: measured
 * from the source instead, a big room would add its own flight time on top of the pre-delay and no one asked for that.
 */
function taps({ w, d, h, src, lis, absorb, order }) {
  const direct = Math.hypot(src[0] - lis[0], src[1] - lis[1], src[2] - lis[2]);
  const out = [];
  for (let i = -order; i <= order; i++) for (let j = -order; j <= order; j++) for (let k = -order; k <= order; k++) {
    const bounces = Math.abs(i) + Math.abs(j) + Math.abs(k);
    if (bounces === 0 || bounces > order) continue; // 0 is the direct sound, which a reverb send must not carry
    // mirror the source across each wall pair: even index reflects the position, odd one the room offset
    const mirror = (n, size, p) => (n % 2 === 0 ? n * size + p : (n + 1) * size - p);
    const x = mirror(i, w, src[0]) - lis[0], y = mirror(j, d, src[1]) - lis[1], z = mirror(k, h, src[2]) - lis[2];
    const dist = Math.hypot(x, y, z);
    out.push({ t: (dist - direct) / SPEED, gain: (absorb ** bounces * direct) / dist, pan: Math.max(-1, Math.min(1, x / Math.max(dist, 1e-6))) });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * One impulse response as [left, right]: `predelay` seconds of silence, the taps written in as single samples, and a
 * noise tail that decays to -60 dB over `decay` seconds under a one-pole lowpass sliding from `lp` down to `damp` Hz.
 */
export function impulse({ predelay, decay, taps: tp, lp, damp, tailAt, seed = 1 }) {
  const n = Math.round((predelay + decay) * RATE), head = Math.round(predelay * RATE);
  const ch = [new Float32Array(n), new Float32Array(n)];
  for (const { t, gain, pan } of tp) {
    const i = head + Math.round(t * RATE);
    if (i >= n) continue;
    ch[0][i] += gain * Math.sqrt((1 - pan) / 2); // equal-power, so a hard-panned tap is as loud as a centred one
    ch[1][i] += gain * Math.sqrt((1 + pan) / 2);
  }
  const rand = rng(seed), start = head + Math.round(tailAt * RATE), len = n - start;
  const state = [0, 0];
  for (let i = 0; i < len; i++) {
    const env = Math.pow(10, (-3 * i) / (decay * RATE)); // -60 dB over the decay
    for (let c = 0; c < 2; c++) {
      const hz = lp + (damp - lp) * (i / len); // the tail darkens as it dies, like a real room's air and walls
      const a = 1 - Math.exp((-2 * Math.PI * hz) / RATE);
      state[c] += a * ((rand() * 2 - 1) * env - state[c]);
      ch[c][start + i] += state[c];
    }
  }
  const peak = Math.max(...ch.map((c) => c.reduce((m, x) => Math.max(m, Math.abs(x)), 0)));
  for (const c of ch) for (let i = 0; i < n; i++) c[i] /= peak || 1; // the convolver normalizes anyway; this just keeps the wav from clipping
  return ch;
}

// Three characters, not three rooms: what changes between them is size (so pre-delay and decay), how dead the walls
// are and how dark the tail goes. A plate has no geometry at all, so it gets dense taps from a tiny hard box.
export const ROOMS = {
  room:  { predelay: 0.008, decay: 0.9, lp: 9000, damp: 2500, tailAt: 0.03, seed: 11, box: { w: 5, d: 4, h: 2.8, src: [1.4, 1, 1.5], lis: [3.4, 3, 1.4], absorb: 0.55, order: 4 } },
  plate: { predelay: 0.015, decay: 1.8, lp: 12000, damp: 4000, tailAt: 0.012, seed: 22, box: { w: 1.2, d: 0.9, h: 0.4, src: [0.3, 0.3, 0.2], lis: [0.9, 0.6, 0.2], absorb: 0.8, order: 6 } },
  hall:  { predelay: 0.03, decay: 3.2, lp: 7000, damp: 1200, tailAt: 0.09, seed: 33, box: { w: 22, d: 30, h: 14, src: [8, 6, 1.7], lis: [11, 20, 1.4], absorb: 0.72, order: 4 } },
};

export const irOf = ({ box, ...rest }) => impulse({ ...rest, taps: taps(box) });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.join(path.resolve(import.meta.dirname, '..'), 'samples', 'user', 'rooms');
  fs.mkdirSync(dir, { recursive: true });
  const made = [];
  for (const [name, spec] of Object.entries(ROOMS)) {
    writeWav(path.join(dir, `${name}.wav`), RATE, irOf(spec));
    made.push(`${name}.wav ${spec.predelay * 1000} ms pre-delay, ${spec.decay} s decay, ${taps(spec.box).length} early reflections`);
    console.log(`samples/user/rooms/${name}.wav  ${(fs.statSync(path.join(dir, `${name}.wav`)).size / 1024).toFixed(0)} KB`);
  }
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({
    deploy: true,
    license: 'CC0-1.0',
    source: `generated by scripts/ir.mjs (npm run ir): shoebox impulse responses, 16-bit stereo 44.1 kHz. ${made.join('; ')}`,
  }, null, 2) + '\n');
  console.log(`samples/user/rooms/pack.json written; use it with packs: ['rooms'] and room: { ir: 'hall' }`);
}
