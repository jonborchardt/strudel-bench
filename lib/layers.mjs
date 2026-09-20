import { S, val, isPattern, hasSound } from './strudel.mjs';
import { registerLayer, tailMask } from './song.mjs';
// structural axes get their number check inside applyPlanPhase (which calls num for us)
import { defineCell, applyPlanPhase, applyPatternPhases, ctl, piece, cells } from './axes.mjs';
import { rankings, bassGrid, place, accents, gridToMini, parseGrid, parseTemplate, gains, positions, fromPositions, barsOf, fit } from './grid.mjs';
import { rootOf, modeOf, keyAt, chordToneTable } from './harmony.mjs';
import { isSynth, resolveSample, resolvePatch, soundNames } from './packs.mjs';
import { prng } from './random.mjs';

const hz = (n) => `${Math.round(n)} Hz`;
// .scale() emits note names ("C4"); adding note(0) forces MIDI numbers so pitch cells can do arithmetic.
const midi = (p) => p.add(S.note(0));

/**
 * Like ctl, but multiplies the control instead of setting it: a second .gain()/.lpf() *replaces* the
 * first, so a cell that only modifies a control another cell (or the baseline) already set must mul.
 * fn maps the axis value to a factor, 1 meaning "leave it alone". Same 0.5 / noopBelow contract as ctl.
 */
function mulBy(pat, name, value, fn, { noopBelow = false } = {}) {
  if (typeof value === 'number') {
    if (value === 0.5 || (noopBelow && value <= 0.5)) return pat;
    return pat.mul(S[name](fn(value)));
  }
  if (!isPattern(value)) throw new Error(`axis value must be a number or a pattern, got ${typeof value}`);
  return pat.mul(S[name](value.fmap(fn)));
}

/** Pan sweep of half-width d (number or pattern) around centre. */
const sweep = (pat, lfo, d) => pat.pan(lfo.range(-1, 1).mul(val(d)).add(0.5));

export const DRUM_ORDER = ['bd', 'sd', 'hh', 'oh', 'cp']; // the order density adds voices in
/** A named voice patch (lib/patches.json), or an object of controls, applied under the axes: one .<control>(value) per key. */
const withPatch = (p, attrs) => Object.entries(resolvePatch(attrs.patch) ?? {}).reduce((q, [k, v]) => q[k](v), p);
/** level is material: a plain gain multiplier, 1 = untouched. Applied after every axis phase. */
function withLevel(p, attrs) {
  if (attrs.level === undefined) return p;
  if (!(Number.isFinite(attrs.level) && attrs.level >= 0)) throw new Error(`level must be a finite number >= 0, got ${typeof attrs.level === 'number' ? attrs.level : JSON.stringify(attrs.level)}`);
  return attrs.level === 1 ? p : p.mul(S.gain(attrs.level));
}
/**
 * The layer's structural summary, kept on the built pattern for the visual score (lib/visual.mjs) and the check: an
 * explicit whitelist of plain values (strings, numbers, arrays and objects of those), frozen at every depth, so nothing
 * that builds the part (patterns, closures, the grid context) leaks or moves after the build. song() copies it off
 * the pattern before .orbit() wraps it.
 */
const deepFreeze = (o) => { if (o && typeof o === 'object') for (const v of Object.values(o)) deepFreeze(v); return Object.freeze(o); };
const withPlan = (p, plan) => Object.assign(p, { plan: deepFreeze(plan) });
const text = (x) => (typeof x === 'string' ? x : null); // a written line stays text; a pattern is not data
/**
 * The `s` a part plays. A string is the sound; a list is a pick per hit (chooseIn hashes the hit's time, so the same hit
 * plays the same take on every play and in every host); a weights object ({ a: 3, b: 1 }) is a weighted pick (wchoose);
 * a pattern (a double-quoted "<a b>" the transpiler already turned into one) alternates however it says.
 */
export const soundPat = (sound) => {
  if (Array.isArray(sound)) {
    if (!sound.length || !sound.every((s) => typeof s === 'string')) throw new Error(`sound: a list must hold sound names, got ${JSON.stringify(sound)}`);
    return sound.length === 1 ? sound[0] : S.chooseIn(...sound);
  }
  if (sound && typeof sound === 'object' && !isPattern(sound)) {
    const pairs = Object.entries(sound);
    if (!pairs.length || !pairs.every(([, w]) => typeof w === 'number' && w > 0)) throw new Error(`sound: weights must be positive numbers, got ${JSON.stringify(sound)}`);
    return S.wchoose(...pairs);
  }
  return sound;
};

// Named arp orders, as index-picking functions of (position, voice count). n must be the *actual* per-chord
// voice count at arp time, not plan.tones: chordPatterns.tones floors a seventh chord at 4 voices even when
// plan.tones is 3, so a plan.tones-sized order would never reach the 4th (the seventh) voice.
export const ARP_ORDERS = {
  up: (i, n) => i % n,
  down: (i, n) => n - 1 - (i % n),
  updown: (i, n) => { const cyc = Math.max(1, 2 * n - 2); const k = i % cyc; return k < n ? k : cyc - k; },
};
// len picks per chord: half the section grid (8 in 4/4, 6 in 3/4), so the arp sits on the same grid as the other layers
export const arpIndices = (name, n, len = 8) => Array.from({ length: len }, (_, i) => ARP_ORDERS[name](i, n));
// compiled from source (one copy, no drift) so the picker prints with the order inlined and no closure
// variables: dump.mjs only has to prepend arpIndices/ARP_ORDERS for the dump to paste into the repl.
const arpPicker = (order, len) => new Function('arpIndices', 'seq',
  // single quotes: the repl's transpiler turns a double-quoted string into a mini pattern, and ARP_ORDERS[pattern] is undefined
  `return (haps) => seq(...arpIndices('${order}', haps.length, ${len})).fmap((i) => haps[i % haps.length])`)(arpIndices, S.seq);
function checkArp(name) {
  // the transpiler turns a double-quoted "0 2 1 2" into a mini pattern before we see it; .arp() takes either
  if (isPattern(name) || Object.hasOwn(ARP_ORDERS, name) || (typeof name === 'string' && /\d/.test(name))) return;
  throw new Error(`pad.arp must be 'up', 'down', 'updown' or an index pattern like "0 2 1", got ${JSON.stringify(name)}`);
}

// the seeded generator behind the melody line is lib/random.mjs prng, shared with gen/ and the visual score

// ---------- shared continuous cells (same mapping on several layers) ----------
// swingBy(x, n) splits each cycle into n slices and delays the second half of each; negative x is outside
// its domain and fragments events. Rule 6 says a grid cannot be straighter than straight, so below .5 is a
// documented no-op. 4 slices (not 8) so 8th-note material actually has events in the delayed half.
const swingAmount = (x) => Math.max(0, x - 0.5) * 0.6;
function defineSwing(layer) {
  defineCell(layer, 'groove', {
    timing: (p, v) => (typeof v === 'number'
      ? (v <= 0.5 ? p : p.swingBy((v - 0.5) * 0.6, 4))
      : p.swingBy(v.fmap(swingAmount), 4)),
    describe: (a, b) => `swing ${a <= .5 ? '0' : swingAmount(a).toFixed(2)} -> ${b <= .5 ? '0' : swingAmount(b).toFixed(2)}`,
  });
}
function defineOrganic(layer, { timing = true } = {}) {
  // scale is compiled in, not captured: dump.mjs prints closures with toString(), and a free `scale` resolves
  // to strudel's own scale() in the repl, so a captured one would silently turn every jittered value into NaN.
  const jitter = (v, scale) => S.rand.range(-1, 1).mul(val(v).fmap(Function(`return (x) => Math.max(0, x - 0.5) * ${scale}`)()));
  const cell = {
    level: (p, v) => (typeof v === 'number' && v <= 0.5 ? p : p.mul(S.gain(jitter(v, 0.4).add(1)))),
    describe: (a, b) => `${timing ? `timing jitter +/-${Math.round(Math.max(0, b - .5) * 80)} ms, ` : ''}gain jitter ${Math.round(Math.max(0, b - .5) * 40)}%`,
  };
  if (timing) cell.timing = (p, v) => (typeof v === 'number' && v <= 0.5 ? p : p.nudge(jitter(v, 0.08)));
  defineCell(layer, 'organicness', cell);
}
// width as a sine pan sweep of half-width (v - .5), one LFO cycle every `slow` cycles
function defineSweep(layer, slow) {
  defineCell(layer, 'width', {
    spatial: (p, v) => (typeof v === 'number'
      ? (v <= 0.5 ? p : sweep(p, S.sine.slow(slow), v - 0.5))
      : sweep(p, S.sine.slow(slow), val(v).fmap((x) => Math.max(0, x - 0.5)))),
    describe: (a, b) => (b <= .5 ? 'centred' : `pan sweep +/-${(b - .5).toFixed(2)}`),
  });
}

// ---------- drums ----------
const DRUM_THRESH = { bd: .1, sd: .3, hh: .5, oh: .7, cp: .85 };
const DRUM_PAN_UNIT = { bd: 0, sd: 0, hh: 1, oh: -1, cp: -.6 };

/** f over each bar of a multi-bar grid string. */
const perBar = (g, steps, f) => barsOf(g, steps).map(f).join('');
/** A per-step mini string (a struct, per-step gains) spanning `bars` bars: slowed so one bar of it lasts one cycle. */
const over = (mini, bars) => (bars > 1 ? S.mini(mini).slow(bars) : mini);
/** A grid's accent (X) and ghost (o) gains on a pattern, over its bars; a grid of plain hits leaves it alone. */
const withGains = (p, grid, bars) => { const acc = gains(grid); return acc ? p.mul(S.gain(over(acc, bars))) : p; };
/** The drum voices that sound at density `v`: the five kit voices past their threshold, of those the template has a line for, plus every written extra voice. */
const voicesAt = (plan, v) => DRUM_ORDER.filter((k) => v >= DRUM_THRESH[k] && plan.grids[k]).concat(plan.extra);
function drumSounds(attrs, voices) {
  const sounds = attrs.sounds ?? {};
  for (const k of Object.keys(sounds)) if (!voices.includes(k)) throw new Error(`drums.sounds: unknown voice "${k}" (known: ${voices.join(', ')})`);
  return sounds;
}
function drumPlan(attrs, ctx) {
  const { grid } = ctx;
  const rows = parseTemplate(attrs.template, grid.steps), grids = {}, bars = {};
  // a line with no hit (heartbeat's all-rest sd) is a voice the template leaves out: not built, no fill rolled on it, no 16th hats invented for it
  for (const r of rows) if (positions(r.grid).length) { grids[r.voice] = r.grid; bars[r.voice] = r.bars; }
  const written = rows.map((r) => r.voice).filter((k) => !DRUM_ORDER.includes(k)); // voices outside the five: never gated by density
  const plan = { grids, bars, extra: written.filter((k) => grids[k]), hatAccent: accents(0.5, grid), variation: 0, sounds: drumSounds(attrs, [...DRUM_ORDER, ...written]), grid };
  return { ...plan, voices: voicesAt(plan, 0.5) };
}
defineCell('drums', 'density', {
  structural: (plan, v) => {
    const grids = { ...plan.grids };
    // 16th hats at the top of the range, but only for a template that has hats at all: one with an empty hh line
    // (heartbeat) means it, and inventing a voice the template deliberately left out is not what density is for
    if (v >= 0.8 && plan.grids.hh) grids.hh = 'x'.repeat(plan.grid.steps * (plan.bars.hh ?? 1));
    return { ...plan, voices: voicesAt(plan, v), grids };
  },
  // describe has no access to plan (only the from/to values), so it cannot tell which of these the written template
  // actually has voices for (structural does, via plan.grids); say so rather than claiming a voice the template lacks
  describe: (a, b) => {
    const voices = DRUM_ORDER.filter((k) => b >= DRUM_THRESH[k]);
    return `voices ${voices.length ? `${voices.join('+')} (of the template's voices)` : 'none'}${b >= .8 ? ', 16th hats' : ''}`;
  },
});
defineCell('drums', 'drive', {
  structural: (plan, v) => {
    const r = rankings(plan.grid.steps, plan.grid.pulse);
    const placed = (k, voice) => (plan.grids[k] ? { [k]: perBar(plan.grids[k], plan.grid.steps, (b) => place(b, v, r, voice)) } : {});
    return { ...plan, grids: { ...plan.grids, ...placed('bd', 'on'), ...placed('sd', 'snare') }, hatAccent: accents(v, plan.grid) };
  },
  describe: (a, b) => (b > .5 ? 'kick onto the pulse, snare onto the backbeat, hats accent on-beat' : b < .5 ? 'kick/snare pushed to offbeats' : 'template placement'),
});
defineCell('drums', 'variation', {
  structural: (plan, v) => ({ ...plan, variation: v }),
  describe: (a, b) => (b <= .5 ? 'pure loop' : `fills with p=${((b - .5) * 2).toFixed(2)}${b >= .75 ? ', reversed every 4th' : ''}`),
});
defineCell('drums', 'brightness', {
  spectral: (p, v) => {
    p = ctl(p, 'lpf', v, (x) => (x < 0.5 ? piece(800, 20000, 20000, { log: true })(x) : 20000));
    return ctl(p, 'hpf', v, (x) => (x > 0.5 ? piece(20, 20, 1500, { log: true })(x) : 20), { noopBelow: true });
  },
  describe: (a, b) => (b < .5 ? `lpf ${hz(piece(800, 20000, 20000, { log: true })(b))}` : `hpf ${hz(piece(20, 20, 1500, { log: true })(b))}`),
});
defineCell('drums', 'weight', {
  level: (p, v) => mulBy(p, 'gain', v, piece(0.6, 1, 1.2)),
  spectral: (p, v) => ctl(p, 'shape', v, (x) => Math.max(0, x - 0.5) * 0.4, { noopBelow: true }),
  describe: (a, b) => `gain x${piece(0.6, 1, 1.2)(b).toFixed(2)}`,
});
defineCell('drums', 'space', {
  spatial: (p, v) => ctl(ctl(p, 'room', v, (x) => Math.max(0, x - 0.5) * 0.8, { noopBelow: true }), 'size', v, piece(0.3, 0.3, 0.8), { noopBelow: true }),
  describe: (a, b) => `room ${(Math.max(0, b - .5) * .8).toFixed(2)}`,
});
defineCell('drums', 'articulation', {
  // the choke at >= .6 is per voice (hats only), so buildDrums applies that part
  articulation: (p, v) => ctl(ctl(p, 'clip', v, piece(1.2, 1, 0.2)), 'release', v, piece(0.4, 0.1, 0.02)),
  describe: (a, b) => `clip ${piece(1.2, 1, .2)(b).toFixed(2)}, release ${piece(.4, .1, .02)(b).toFixed(2)} s${b >= .6 ? ', hats choke' : ''}`,
});
defineCell('drums', 'aggression', {
  spectral: (p, v) => ctl(p, 'distort', v, (x) => Math.max(0, x - 0.5) * 1.2, { noopBelow: true }),
  describe: (a, b) => `distort ${(Math.max(0, b - .5) * 1.2).toFixed(2)}`,
});
defineSwing('drums');
defineOrganic('drums');
// applied per voice inside buildDrums, so the phase runner has nothing to do
defineCell('drums', 'width', { describe: (a, b) => `stereo spread +/-${piece(0, .1, .5)(b).toFixed(2)}` });

/**
 * The pattern for one drum voice: the kit's `voice` by default; a chosen `sound` keeps the kit when the kit has that
 * voice (rim, hh:2 -> RolandTR909_rim), otherwise plays as named (a pack sample: cajon, clap). superdough looks up
 * <kit>_<name> and nothing else once .bank() is set, so a sample the kit lacks would be silence. Node has no sound
 * map (hasSound is undefined there) and assumes the kit, which check.mjs accepts either way.
 */
export const voiceSound = (sound, voice, kit, struct) => {
  const names = soundNames(sound), kitHas = (n) => hasSound(`${kit}_${n}`) !== false; // Node (no sound map): assume the kit
  if (!sound || names.every(kitHas)) return S.s(soundPat(sound ?? voice)).struct(struct).bank(kit);
  if (!names.some(kitHas)) return S.s(soundPat(sound)).struct(struct);
  // a list mixing kit voices and pack samples: .bank() would hide the samples and no bank the kit voices, so the kit
  // voices are written in full (<kit>_<name>, the name superdough would have built) and the bank is left off
  const full = (n) => (kitHas(n) ? `${kit}_${n}` : n);
  return S.s(soundPat(Array.isArray(sound) ? sound.map(full) : Object.fromEntries(Object.entries(sound).map(([n, w]) => [full(n), w])))).struct(struct);
};

function buildDrums(plan, attrs, ctx) {
  const w = attrs.width ?? 0.5;
  // hats choke each other at high articulation; kick and snare must stay out of that cut group
  const choke = typeof attrs.articulation === 'number' && attrs.articulation >= 0.6;
  const voices = plan.voices.map((k) => {
    const grid = plan.grids[k], bars = plan.bars[k] ?? 1;
    let p = voiceSound(plan.sounds[k], k, ctx.kit, gridToMini(grid));
    if (bars > 1) p = p.slow(bars);
    if (k === 'hh') p = p.gain(plan.hatAccent);
    p = withGains(p, grid, bars);
    if (choke && (k === 'hh' || k === 'oh')) p = p.cut(1);
    const unit = DRUM_PAN_UNIT[k] ?? 0;
    p = p.pan(0.5 + unit * 0.1); // baseline spread, so width .5 is the same as no width at all
    return unit === 0 ? p : ctl(p, 'pan', w, (x) => 0.5 + unit * piece(0, 0.1, 0.5)(x));
  });
  let pat = S.stack(...voices);
  if (plan.variation > 0.5) {
    pat = pat.sometimesBy((plan.variation - 0.5) * 2, (x) => x.ply(2));
    if (plan.variation >= 0.75) pat = pat.every(4, S.rev);
  }
  if (attrs.fill !== undefined && typeof attrs.fill !== 'boolean' && !(Number.isInteger(attrs.fill) && attrs.fill >= 2)) throw new Error(`drums.fill must be true, false or a bar count >= 2, got ${JSON.stringify(attrs.fill)}`);
  const every = Number.isInteger(attrs.fill) ? attrs.fill : 0;
  const fill = attrs.fill === true || (attrs.fill === undefined && ctx.next === 'climax');
  const half = Math.floor(plan.grid.steps / 2);
  // snare roll over the last half-bar, gain rising .5 -> 1 (the saw is per cycle); one struct over `slow` bars so a
  // fractional section (2.5 bars) still rolls into its actual end
  const roll = (struct, slow) => voiceSound(plan.sounds.sd, 'sd', ctx.kit, gridToMini(struct)).slow(slow).gain(S.saw.range(0, 1));
  // a fill is a snare roll: a template that left sd out on purpose (no line, or an all-rests line like heartbeat's, which
  // drumPlan drops) does not get one invented for it
  const hasSd = !!plan.grids.sd;
  if (fill && ctx.cycles >= 1 && hasSd) { const total = Math.round(plan.grid.steps * ctx.cycles); pat = S.stack(pat, roll('.'.repeat(total - half) + 'x'.repeat(half), ctx.cycles)); }
  if (every && hasSd) pat = S.stack(pat, roll('.'.repeat(plan.grid.steps * every - half) + 'x'.repeat(half), every));
  return pat;
}
registerLayer('drums', (attrs, ctx) => {
  const plan = applyPlanPhase('drums', drumPlan(attrs, ctx), attrs, ctx);
  return withPlan(withLevel(applyPatternPhases('drums', buildDrums(plan, attrs, ctx), attrs, ctx), attrs), {
    voices: [...plan.voices], // the voices that sound at this density, grids after drive's placement and density's 16th hats
    grids: Object.fromEntries(plan.voices.map((k) => [k, plan.grids[k]])),
    bars: Object.fromEntries(plan.voices.map((k) => [k, plan.bars[k] ?? 1])),
  });
}, { materials: ['template', 'sounds', 'fill'] }); // no `sound`: drums take per-voice `sounds`

// ---------- bass ----------
const BASS_LINES = { 1: '0', 2: '0 0', 4: '0 0 4 3', 8: '0 0 4 0 3 0 4 2' };
const bassCount = (v) => (v < .25 ? 1 : v < .5 ? 2 : v <= .75 ? 4 : 8);
/** The line an unwritten bass plays at this density (the roll shows it before a first click writes it). */
export const bassLine = (density) => BASS_LINES[bassCount(typeof density === 'number' ? density : .5)];

function bassPlan(attrs, ctx) {
  const g = ctx.grid;
  const r = attrs.rhythm !== undefined ? parseGrid(attrs.rhythm, g.steps) : null;
  return { line: attrs.notes ?? BASS_LINES[4], lineExplicit: attrs.notes !== undefined, grid: r ? r.grid : bassGrid(4, g), gridExplicit: !!r, bars: r?.bars ?? 1, g, octave: 2, variation: 0, sound: attrs.sound ?? 'sawtooth' };
}
defineCell('bass', 'density', {
  structural: (plan, v) => { const count = bassCount(v); return { ...plan, line: plan.lineExplicit ? plan.line : BASS_LINES[count], grid: plan.gridExplicit ? plan.grid : bassGrid(count, plan.g) }; },
  describe: (a, b) => `${bassCount(b)} notes per cycle`,
});
defineCell('bass', 'drive', {
  structural: (plan, v) => ({ ...plan, grid: perBar(plan.grid, plan.g.steps, (b) => place(b, v, rankings(plan.g.steps, plan.g.pulse))), accent: v }),
  describe: (a, b) => (b > .5 ? 'notes pulled onto beats, on-beat accent' : b < .5 ? 'notes syncopated' : 'baseline placement'),
});
defineCell('bass', 'variation', { structural: (plan, v) => ({ ...plan, variation: v }), describe: (a, b) => (b <= .5 ? 'pure loop' : `octave jumps p=${((b - .5) * 2).toFixed(2)}`) });
defineCell('bass', 'register', { structural: (plan, v) => ({ ...plan, octave: v < 1 / 3 ? 1 : v <= 2 / 3 ? 2 : 3 }), describe: (a, b) => `octave ${b < 1 / 3 ? 1 : b <= 2 / 3 ? 2 : 3}` });
defineCell('bass', 'weight', {
  pitch: (p, v) => (typeof v === 'number' && v > 0.7 ? p.sub(S.note(12)) : p),
  // brightness *sets* the cutoff and runs first (AXIS_NAMES order), so weight only scales what it found.
  spectral: (p, v) => mulBy(p, 'lpf', v, piece(1, 1, 0.75), { noopBelow: true }),
  level: (p, v) => mulBy(p, 'gain', v, piece(0.75, 1, 1.375)),
  describe: (a, b) => `gain x${piece(.75, 1, 1.375)(b).toFixed(2)}, lpf x${piece(1, 1, .75)(b).toFixed(2)}${b > .7 ? ', octave down' : ''}`,
});
defineCell('bass', 'brightness', { spectral: (p, v) => ctl(p, 'lpf', v, piece(80, 400, 2000, { log: true })), describe: (a, b) => `lpf ${hz(piece(80, 400, 2000, { log: true })(a))} -> ${hz(piece(80, 400, 2000, { log: true })(b))}` });
defineCell('bass', 'space', { spatial: (p, v) => ctl(p, 'room', v, (x) => Math.max(0, x - 0.5) * 0.6, { noopBelow: true }), describe: (a, b) => `room ${(Math.max(0, b - .5) * .6).toFixed(2)}` });
defineCell('bass', 'articulation', {
  articulation: (p, v) => ctl(ctl(ctl(p, 'clip', v, piece(1.1, 0.8, 0.3)), 'attack', v, piece(0.05, 0.005, 0)), 'release', v, piece(0.3, 0.1, 0.03)),
  describe: (a, b) => `clip ${piece(1.1, .8, .3)(b).toFixed(2)}, release ${piece(.3, .1, .03)(b).toFixed(2)} s`,
});
defineCell('bass', 'aggression', {
  spectral: (p, v) => ctl(ctl(p, 'distort', v, (x) => Math.max(0, x - 0.5) * 1.4, { noopBelow: true }), 'shape', v, (x) => Math.max(0, x - 0.5), { noopBelow: true }),
  describe: (a, b) => `distort ${(Math.max(0, b - .5) * 1.4).toFixed(2)}`,
});
defineSwing('bass');
defineOrganic('bass');

function buildBass(plan, attrs, ctx) {
  let p = midi(S.n(plan.line).add(S.n(ctx.chords)).scale(keyAt(ctx.key, plan.octave))).add(S.note(ctx.chordAcc)).struct(over(gridToMini(plan.grid), plan.bars))
    .s(soundPat(plan.sound)).lpf(400).lpenv(2).lpdecay(0.15).clip(0.8).release(0.1).gain(0.8); // lpenv: a 2-octave filter pluck, so a static saw reads as a bass
  if (plan.accent !== undefined && plan.accent !== 0.5) p = p.mul(S.gain(accents(plan.accent, plan.g)));
  p = withGains(p, plan.grid, plan.bars);
  if (plan.variation > 0.5) p = p.sometimesBy((plan.variation - 0.5) * 2, (x) => x.add(S.note(12)));
  return withPatch(p, attrs);
}
registerLayer('bass', (attrs, ctx) => {
  const plan = applyPlanPhase('bass', bassPlan(attrs, ctx), attrs, ctx);
  return withPlan(withLevel(applyPatternPhases('bass', buildBass(plan, attrs, ctx), attrs, ctx), attrs), { line: text(plan.line), grid: plan.grid, bars: plan.bars, octave: plan.octave });
}, { materials: ['sound', 'notes', 'rhythm', 'patch'] });

// ---------- melody ----------
// A contour, not a dice roll: starts on the root, moves mostly by step with the odd leap, holds some notes for
// two slots (@2), rests a little, and the last note comes home to the root so the loop has a cadence.
export const melodyLine = (seed, len = 8) => {
  const r = prng(seed);
  const out = [];
  let deg = 0;
  for (let used = 0; used < len;) {
    if (used > 0 && r() < 0.15) { out.push('~'); used++; continue; }
    const leap = r() < 0.25 ? 2 + Math.floor(r() * 2) : 1;
    if (used > 0) deg = Math.max(0, Math.min(7, deg + (r() < 0.5 ? -leap : leap)));
    const hold = used + 1 < len && r() < 0.3 ? 2 : 1;
    out.push(hold === 2 ? `${deg}@2` : String(deg));
    used += hold;
  }
  const last = out.length - 1;
  out[last] = out[last] === '~' ? '0' : out[last].replace(/^\d+/, '0');
  return out.join(' ');
};
const melodyOctave = (v) => (v < 1 / 3 ? 3 : v <= 2 / 3 ? 4 : 5);

function melodyPlan(attrs, ctx) {
  const phrase = attrs.phrase ?? 1;
  if (!Number.isInteger(phrase) || phrase < 1) throw new Error(`melody.phrase must be a positive integer, got ${JSON.stringify(attrs.phrase)}`);
  if (![undefined, true, false, 'tones'].includes(attrs.follow)) throw new Error("melody.follow must be true, false or 'tones'");
  return { line: attrs.notes ?? melodyLine(ctx.seed, ctx.grid.steps / 2 * phrase), phrase, follow: attrs.follow === true, tones: attrs.follow === 'tones', octave: 4, density: 0.5, variation: 0, sound: attrs.sound ?? 'sawtooth' };
}
defineCell('melody', 'density', {
  structural: (plan, v) => ({ ...plan, density: v }),
  describe: (a, b) => (b < .5 ? `drop ${Math.round((0.5 - b) * 2 * 80)}% of notes` : b > .5 ? `double notes p=${((b - .5) * 2).toFixed(2)}` : 'full line'),
});
defineCell('melody', 'variation', { structural: (plan, v) => ({ ...plan, variation: v }), describe: (a, b) => (b <= .5 ? 'pure loop' : `bursts p=${((b - .5) * 2).toFixed(2)}${b >= .75 ? ', reversed every 4th' : ''}`) });
defineCell('melody', 'register', { structural: (plan, v) => ({ ...plan, octave: melodyOctave(v) }), describe: (a, b) => `octave ${melodyOctave(b)}` });
defineCell('melody', 'brightness', { spectral: (p, v) => ctl(p, 'lpf', v, piece(300, 2000, 8000, { log: true })), describe: (a, b) => `lpf ${hz(piece(300, 2000, 8000, { log: true })(a))} -> ${hz(piece(300, 2000, 8000, { log: true })(b))}` });
defineCell('melody', 'space', {
  spatial: (p, v) => ctl(ctl(p, 'room', v, piece(0, 0.2, 0.9)), 'delay', v, (x) => Math.max(0, x - 0.5) * 0.8, { noopBelow: true }),
  describe: (a, b) => `room ${piece(0, .2, .9)(b).toFixed(2)}, delay ${(Math.max(0, b - .5) * .8).toFixed(2)}`,
});
defineCell('melody', 'articulation', {
  articulation: (p, v) => ctl(ctl(ctl(p, 'clip', v, piece(1.1, 0.8, 0.3)), 'attack', v, piece(0.05, 0.005, 0)), 'release', v, piece(0.3, 0.1, 0.03)),
  describe: (a, b) => `clip ${piece(1.1, .8, .3)(b).toFixed(2)}, release ${piece(.3, .1, .03)(b).toFixed(2)} s`,
});
defineCell('melody', 'aggression', {
  spectral: (p, v) => { p = ctl(p, 'distort', v, (x) => Math.max(0, x - 0.5) * 0.8, { noopBelow: true }); return typeof v === 'number' && v > 0.7 ? p.coarse(Math.round(1 + (v - 0.7) * 20)) : p; },
  describe: (a, b) => `distort ${(Math.max(0, b - .5) * .8).toFixed(2)}${b > .7 ? ', coarse' : ''}`,
});
defineSwing('melody');
defineOrganic('melody');
defineSweep('melody', 4);

function buildMelody(plan, attrs, ctx) {
  let p;
  if (plan.tones) {
    const table = chordToneTable(ctx.key, ctx.progression), n = table.length;
    // the line as bare numbers (a single-quoted string is mini-notation; a double-quoted one already arrived as a pattern),
    // each degree turned into a function of the bar's chord index, applied to a <0 1 2 ...> that counts bars; compiled from
    // source with the table inlined so the dump prints numbers, not a closure over `table`
    const degrees = isPattern(plan.line) ? plan.line : S.mini(plan.line);
    const src = `((T) => (d) => (c) => T[c % ${n}][((d % 4) + 4) % 4] + 12 * Math.floor(d / 4))(${JSON.stringify(table)})`; // the table is built once, not per note
    const pick = new Function(`return ${src}`)(); pick.toString = () => src;
    const semis = degrees.slow(plan.phrase).fmap(pick).appLeft(S.mini(`<${table.map((_, i) => i).join(' ')}>`));
    p = S.note(semis).add(midi(S.n(0).scale(keyAt(ctx.key, plan.octave)))); // semitones above the key root in the register's octave
  } else {
    // slow the line *before* the harmony joins it: the progression advances per cycle, not per phrase.
    let line = S.n(plan.line).slow(plan.phrase);
    if (plan.follow) line = line.add(S.n(ctx.chords));
    p = midi(line.scale(keyAt(ctx.key, plan.octave)));
    if (plan.follow) p = p.add(S.note(ctx.chordAcc));
  }
  // vib: a little vibrato so a held synth note is not a test tone; accents: off-beat notes sit 20% under the beat
  p = p.s(soundPat(plan.sound)).lpf(2000).clip(0.8).release(0.1).room(0.2).gain(0.6).mul(S.gain(accents(0.75, ctx.grid)));
  if (isSynth(plan.sound)) p = p.vib(4).vibmod(0.12); // a sampled piano or bell with vibrato reads as fake; only a raw oscillator needs it
  if (plan.density < 0.5) p = p.degradeBy((0.5 - plan.density) * 2 * 0.8);
  if (plan.density > 0.5) p = p.sometimesBy((plan.density - 0.5) * 2, (x) => x.ply(2));
  if (plan.variation > 0.5) { p = p.sometimesBy((plan.variation - 0.5) * 2, (x) => x.fast(2)); if (plan.variation >= 0.75) p = p.every(4, S.rev); }
  return withPatch(p, attrs);
}
registerLayer('melody', (attrs, ctx) => {
  const plan = applyPlanPhase('melody', melodyPlan(attrs, ctx), attrs, ctx);
  return withPlan(withLevel(applyPatternPhases('melody', buildMelody(plan, attrs, ctx), attrs, ctx), attrs), { line: text(plan.line), phrase: plan.phrase, follow: plan.tones ? 'tones' : plan.follow ? 'chords' : 'free', octave: plan.octave });
}, { materials: ['sound', 'notes', 'follow', 'phrase', 'seed', 'patch'] }); // seed: its own over the song's, for the generated line

// ---------- pad ----------
const PAD_TONES = { 1: '0', 2: '[0,4]', 3: '[0,2,4]', 4: '[0,2,4,6]' };
const padTones = (v) => (v < .25 ? 1 : v < .5 ? 2 : v <= .75 ? 3 : 4);
const padWidth = piece(0, 0.1, 0.5);

function padPlan(attrs, ctx) { return { tones: 3, chord: attrs.chord, octave: 4, drive: 0.5, sound: attrs.sound ?? 'sawtooth', arp: attrs.arp ?? null }; }
defineCell('pad', 'density', { structural: (plan, v) => ({ ...plan, tones: padTones(v) }), describe: (a, b) => `${padTones(b)} chord tones` });
defineCell('pad', 'drive', { structural: (plan, v) => ({ ...plan, drive: v }), describe: (a, b) => (b > .5 ? `pulse duck depth ${((b - .5) * 2 * .6).toFixed(2)} (a faked dip; a duck: material replaces it)` : 'no duck') });
defineCell('pad', 'register', { structural: (plan, v) => ({ ...plan, octave: v < 1 / 3 ? 3 : v <= 2 / 3 ? 4 : 5 }), describe: (a, b) => `octave ${b < 1 / 3 ? 3 : b <= 2 / 3 ? 4 : 5}` });
defineCell('pad', 'weight', {
  pitch: (p, v) => (typeof v === 'number' && v > 0.7 ? p.sub(S.note(12)) : p),
  level: (p, v) => mulBy(p, 'gain', v, piece(0.667, 1, 1.444)),
  describe: (a, b) => `gain x${piece(.667, 1, 1.444)(b).toFixed(2)}${b > .7 ? ', low voicing' : ''}`,
});
defineCell('pad', 'brightness', { spectral: (p, v) => ctl(p, 'lpf', v, piece(200, 1200, 6000, { log: true })), describe: (a, b) => `lpf ${hz(piece(200, 1200, 6000, { log: true })(a))} -> ${hz(piece(200, 1200, 6000, { log: true })(b))}` });
defineCell('pad', 'space', { spatial: (p, v) => ctl(ctl(p, 'room', v, piece(0, 0.3, 0.9)), 'size', v, piece(0.4, 0.6, 0.95)), describe: (a, b) => `room ${piece(0, .3, .9)(b).toFixed(2)}, size ${piece(.4, .6, .95)(b).toFixed(2)}` });
defineCell('pad', 'articulation', {
  articulation: (p, v) => ctl(ctl(ctl(p, 'clip', v, piece(1.2, 1, 0.3)), 'attack', v, piece(0.6, 0.15, 0)), 'release', v, piece(2, 0.6, 0.05)),
  describe: (a, b) => `clip ${piece(1.2, 1, .3)(b).toFixed(2)}, attack ${piece(.6, .15, 0)(b).toFixed(2)} s, release ${piece(2, .6, .05)(b).toFixed(2)} s`,
});
defineCell('pad', 'aggression', { spectral: (p, v) => ctl(p, 'distort', v, (x) => Math.max(0, x - 0.5) * 0.6, { noopBelow: true }), describe: (a, b) => `distort ${(Math.max(0, b - .5) * .6).toFixed(2)}` });
defineOrganic('pad', { timing: false });
defineCell('pad', 'width', {
  spatial: (p, v) => (typeof v === 'number'
    ? (v === 0.5 ? p : v >= 0.8 ? p.pan(0.5).jux(S.rev) : sweep(p, S.sine.slow(8), padWidth(v))) // jux adds ±.5 to the pad's own ±.1 sweep, overflowing [0,1]
    : sweep(p, S.sine.slow(8), val(v).fmap(padWidth))),
  describe: (a, b) => (b >= .8 ? 'jux(rev)' : `pan sweep +/-${padWidth(b).toFixed(2)}`),
});

function buildPad(plan, attrs, ctx) {
  let p = plan.chord !== undefined
    ? midi(S.n(plan.chord).add(S.n(PAD_TONES[plan.tones])).scale(keyAt(ctx.key, plan.octave)))
    : midi(S.n(ctx.chords).scale(keyAt(ctx.key, plan.octave))).add(S.note(ctx.chordAcc)).add(S.note(ctx.chordTones(plan.tones)));
  p = p.s(soundPat(plan.sound)).lpf(1200).attack(0.15).release(0.6).room(0.3).size(0.6).gain(0.45)
    .pan(S.sine.slow(8).range(0.4, 0.6));
  if (plan.arp) {
    checkArp(plan.arp);
    // named orders are re-derived per chord from the stacked haps' real length; a custom index string
    // (e.g. "0 2 1") still passes straight through to .arp(), unchanged from before.
    p = Object.hasOwn(ARP_ORDERS, plan.arp) ? p.arpWith(arpPicker(plan.arp, ctx.grid.steps / 2)) : p.arp(plan.arp);
  }
  // ponytail: the duck is sampled once per chord hap (continuous signals collapse per hap), so it reads as a
  // per-chord level dip rather than a 4-per-cycle pump. a real sidechain is `duck: 'drums'`; this dip remains
  // the no-duck fallback.
  if (plan.drive > 0.5 && attrs.duck === undefined) p = p.mul(S.gain(S.square.fast(4).range(1 - (plan.drive - 0.5) * 2 * 0.6, 1)));
  // ponytail: a slow +/-15 cent drift is the chorus a lone saw lacks without adding voices (a second detuned
  // voice would double the pad's onsets and break the tone-count contract). Upgrade: supersaw unison per event.
  p = isSynth(plan.sound) ? p.vib(0.4).vibmod(0.15) : p; // the same rule as the melody: a sampled pad (strings, choir) drifts on its own
  return withPatch(p, attrs);
}
registerLayer('pad', (attrs, ctx) => {
  const plan = applyPlanPhase('pad', padPlan(attrs, ctx), attrs, ctx);
  return withPlan(withLevel(applyPatternPhases('pad', buildPad(plan, attrs, ctx), attrs, ctx), attrs), { tones: plan.tones, octave: plan.octave, arp: typeof plan.arp === 'string' ? plan.arp : plan.arp ? 'pattern' : null });
}, { materials: ['sound', 'chord', 'arp', 'patch'] });

// ---------- fx ----------
// Transition material only: a riser into the next section and an impact on this one's downbeat.
function fxPlan(attrs, ctx) {
  // not `attrs.riser || 0`: NaN is falsy and would silently mean "no riser"
  const k = attrs.riser === true ? 4 : attrs.riser === undefined || attrs.riser === false ? 0 : attrs.riser;
  if (!Number.isInteger(k) || k < 0) throw new Error(`fx.riser must be true or a positive integer, got ${typeof attrs.riser === 'number' ? attrs.riser : JSON.stringify(attrs.riser)}`);
  return { riser: Math.min(k, ctx.cycles), impact: attrs.impact === true ? 'bd' : attrs.impact || null, sound: attrs.sound ?? 'white' };
}
defineCell('fx', 'brightness', { spectral: (p, v) => mulBy(p, 'lpf', v, piece(0.25, 1, 2.5, { log: true })), describe: (a, b) => `lpf x${piece(.25, 1, 2.5, { log: true })(b).toFixed(2)}` });
defineCell('fx', 'space', { spatial: (p, v) => ctl(ctl(p, 'room', v, piece(0, 0.5, 0.95)), 'size', v, piece(0.3, 0.8, 0.95)), describe: (a, b) => `room ${piece(0, .5, .95)(b).toFixed(2)}` });
defineCell('fx', 'weight', { level: (p, v) => mulBy(p, 'gain', v, piece(0.5, 1, 1.5)), describe: (a, b) => `gain x${piece(.5, 1, 1.5)(b).toFixed(2)}` });
defineSweep('fx', 2);

function buildFx(plan, attrs, ctx) {
  const parts = [];
  if (plan.riser > 0) {
    const { riser: k } = plan, start = ctx.cycles - k;
    // 8 noise slices per cycle (a single long event would sample its signals once); the mask keeps only the last
    // k cycles, at slice resolution so a fractional section length (2.5 bars) still gets its riser.
    parts.push(S.s(soundPat(plan.sound)).fast(8).mask(tailMask(ctx.cycles, k)).clip(1)
      .lpf(S.saw.range(200, 8000).slow(k).late(start)).gain(S.saw.range(0, 0.5).slow(k).late(start)).room(0.5).size(0.8));
  }
  if (plan.impact) {
    // period >= section length, so the hit at 0 is the only one inside the section even when cycles is fractional
    parts.push(S.s(plan.impact).struct(`<x${' ~'.repeat(Math.ceil(ctx.cycles) - 1)}>`).speed(0.5).lpf(8000).room(0.5).size(0.8).gain(0.9));
  }
  return parts.length ? S.stack(...parts) : S.silence;
}
registerLayer('fx', (attrs, ctx) => {
  const plan = fxPlan(attrs, ctx);
  return withPlan(withLevel(applyPatternPhases('fx', buildFx(plan, attrs, ctx), attrs, ctx), attrs), { riser: plan.riser, impact: plan.impact });
}, { materials: ['sound', 'riser', 'impact'] });

// ---------- sample ----------
// A sliced sample (the Compose page's sampler): `sound` is any loaded sample, begin..end the region of the file
// (fractions) that stands for `bars` bars at the section tempo, cut into `slices` equal pieces played in the order
// `pattern` writes (mini-notation of slice indices, spanning the sample's bars). Natural playback keeps every slice
// its own length at the fitted speed; `stretch` fits each slice to its step (what strudel's fit() does, computed
// from the section tempo rather than the scheduler's).
// The trim is folded into the slice grid because strudel's .slice() overwrites an earlier .begin()/.end().
/** Strudel's point array for the slice grid: n+1 fractions of the file for `slices` equal pieces of begin..end, or
 *  [begin, ...breaks, end] when `slices` lists break points (fractions of the file inside the region). Slice i spans points[i]..points[i+1]. */
export const slicePoints = (begin, end, slices) => (Array.isArray(slices) ? [begin, ...slices, end] : Array.from({ length: slices + 1 }, (_, i) => begin + ((end - begin) * i) / slices));

function oneSamplePlan(attrs) {
  attrs = resolveSample(attrs); // a pack definition (samples/user/<pack>/pack.json) sits under the part; the part's keys win
  const { sound = null, begin = 0, end = 1, bars = 1, slices = 1, pattern, stretch = false, transpose = 0 } = attrs;
  if (typeof transpose !== 'number' || !Number.isFinite(transpose)) throw new Error('sample.transpose must be a number of semitones');
  const frac = (k, v) => { if (!(typeof v === 'number' && v >= 0 && v <= 1)) throw new Error(`sample.${k} must be a number in 0..1 (a fraction of the file), got ${JSON.stringify(v)}`); };
  frac('begin', begin); frac('end', end);
  if (!(begin < end)) throw new Error(`sample: begin (${begin}) must be before end (${end})`);
  if (!(typeof bars === 'number' && bars > 0)) throw new Error(`sample.bars must be a positive number, got ${JSON.stringify(bars)}`);
  if (Array.isArray(slices)) {
    if (!slices.every((x) => typeof x === 'number' && x >= 0 && x <= 1)) throw new Error(`sample.slices as break points must be fractions of the file in 0..1, got ${JSON.stringify(slices)}`);
    if (slices.some((x, i) => i > 0 && x <= slices[i - 1])) throw new Error(`sample.slices break points must be strictly increasing, got ${JSON.stringify(slices)}`);
    if (slices.some((x) => x <= begin || x >= end)) throw new Error(`sample.slices break points must lie inside the region (begin ${begin} .. end ${end}), got ${JSON.stringify(slices)}`);
  } else if (!(Number.isInteger(slices) && slices >= 1)) throw new Error(`sample.slices must be a positive integer or a list of break points, got ${JSON.stringify(slices)}`);
  const count = Array.isArray(slices) ? slices.length + 1 : slices;
  const pat = pattern ?? Array.from({ length: count }, (_, i) => i).join(' '); // unwritten: every slice in order, so the loop plays as recorded
  if (typeof pat !== 'string' && !isPattern(pat)) throw new Error('sample.pattern must be a string of slice indices in mini-notation');
  const ipat = isPattern(pat) ? pat : S.mini(pat);
  // ponytail: 8 cycles catch a <0 1 2> alternation; a deeper one slips through and plays to the file end
  const bad = ipat.queryArc(0, 8).map((h) => h.value).find((i) => !(Number.isInteger(i) && i >= 0 && i < count));
  if (bad !== undefined) throw new Error(`sample.pattern: slice ${bad} is out of range (slices: ${count}, so 0..${count - 1})`);
  return { sound, begin, end, bars, slices, count, ipat, stretch: stretch === true, points: slicePoints(begin, end, slices), ratio: 2 ** (transpose / 12) };
}
/**
 * A sample part's `sound` may be a list of definitions: each hit picks one (deterministically, by soundPat's
 * chooseIn), and each take keeps its own region (begin/end/points), because a shared file position would be
 * meaningless across different source files. `bars` and the slice count are structural (they say what the
 * pattern's indices mean), so every take must agree on them; the part's own keys (bars, slices, ...) apply to
 * every take alike and are what makes them agree in the first place.
 */
function samplePlan(attrs) {
  if (!Array.isArray(attrs.sound)) return { ...oneSamplePlan(attrs), takes: null };
  if (!attrs.sound.length || !attrs.sound.every((s) => typeof s === 'string')) throw new Error(`sample.sound: a list must hold sound names, got ${JSON.stringify(attrs.sound)}`);
  const takes = attrs.sound.map((sound) => oneSamplePlan({ ...attrs, sound }));
  const [first] = takes;
  for (const t of takes.slice(1)) {
    if (t.bars !== first.bars) throw new Error(`sample.sound list: bars of "${t.sound}" (${t.bars}) and "${first.sound}" (${first.bars}) must agree; write bars on the part`);
    if (t.count !== first.count) throw new Error(`sample.sound list: slice counts of "${t.sound}" (${t.count}) and "${first.sound}" (${first.count}) must agree; write slices on the part`);
  }
  return { ...first, sound: null, takes: takes.map(({ sound, begin, end, points }) => ({ sound, begin, end, points })) };
}
defineCell('sample', 'brightness', { spectral: (p, v) => ctl(p, 'lpf', v, piece(400, 20000, 20000, { log: true })), describe: (a, b) => (b >= .5 ? 'open' : `lpf ${Math.round(piece(400, 20000, 20000, { log: true })(b))} Hz`) });
defineCell('sample', 'space', { spatial: (p, v) => ctl(ctl(p, 'room', v, piece(0, 0.5, 0.95)), 'size', v, piece(0.3, 0.8, 0.95)), describe: (a, b) => `room ${piece(0, .5, .95)(b).toFixed(2)}` });
defineCell('sample', 'weight', { level: (p, v) => mulBy(p, 'gain', v, piece(0.5, 1, 1.5)), describe: (a, b) => `gain x${piece(.5, 1, 1.5)(b).toFixed(2)}` });
defineSweep('sample', 2);

function buildSample(plan, attrs, ctx) {
  if (!plan.takes) {
    if (!plan.sound) return S.silence;
    const p = S.s(plan.sound).slice(plan.points, plan.ipat).slow(plan.bars);
    // unit 'c': speed is fractions of the file per second, so the region (end - begin) lasts bars/cps seconds
    if (!plan.stretch) return p.speed((ctx.cps * (plan.end - plan.begin) * plan.ratio) / plan.bars).unit('c');
    // stretch: each slice fills its step. strudel's fit() does the same from the *scheduler's* cps, which is the song's;
    // the section's cps is the right one (a section with its own bpm), and a fixed number keeps npm run check and the
    // page in agreement. toString so lib/dump.mjs prints the number instead of a closure over ctx (as piece/ramp do).
    const cps = ctx.cps, ratio = plan.ratio;
    const f = (haps) => haps.map((h) => h.withValue((v) => ({ ...v, speed: (cps / h.whole.duration) * ((v.end ?? 1) - (v.begin ?? 0)) * ratio, unit: 'c' })));
    f.toString = () => `(haps) => haps.map((h) => h.withValue((v) => ({ ...v, speed: (${cps} / h.whole.duration) * ((v.end ?? 1) - (v.begin ?? 0)) * ${ratio}, unit: 'c' })))`;
    return p.withHaps(f);
  }
  // a pick per hit among takes that each keep their own region: the slice index gives structure, chooseIn picks the
  // take *index* (not the resolved sound: two takes can share a pack sound, e.g. loop-kick/loop-snare both play
  // "loop", and keying by name would collapse them into one), and the per-take point table turns (take, index) into
  // sound/begin/end and speed. withValue replaces the hap's value wholesale, so no `n`/`take` leaks to superdough.
  // slow(bars) runs before withHaps, as the single-sound path slows before its own withHaps: h.whole.duration inside
  // the closure must be the real (post-slow) step length, since stretch's speed is computed from it. The table is
  // inlined into the closure's source (as the stretch closure above inlines cps) so lib/dump.mjs's toString pastes
  // into the repl.
  const TAKES = plan.takes.map((t) => ({ s: t.sound, points: t.points }));
  const cps = ctx.cps, bars = plan.bars, stretch = plan.stretch, ratio = plan.ratio;
  const body = `((T) => (haps) => haps.map((h) => h.withValue((v) => { const t = T[v.take], b = t.points[v.n], e = t.points[v.n + 1]; return { s: t.s, begin: b, end: e, unit: 'c', speed: ${stretch ? `(${cps} / h.whole.duration) * (e - b) * ${ratio}` : `${cps} * (e - b) * ${ratio} / ${bars}`} }; })))(${JSON.stringify(TAKES)})`; // the table is built once, not per hit
  const f = new Function(`return ${body}`)();
  f.toString = () => body;
  return plan.ipat.fmap((i) => ({ n: i })).set(S.chooseIn(...plan.takes.map((_, k) => ({ take: k })))).slow(bars).withHaps(f);
}
registerLayer('sample', (attrs, ctx) => {
  const plan = samplePlan(attrs);
  return withPlan(withLevel(applyPatternPhases('sample', buildSample(plan, attrs, ctx), attrs, ctx), attrs), { bars: plan.bars, slices: plan.count, takes: plan.takes ? plan.takes.map((t) => t.sound) : plan.sound ? [plan.sound] : [] });
}, { materials: ['sound', 'begin', 'end', 'bars', 'slices', 'pattern', 'stretch', 'transpose'] });

// ---------- perc ----------
// One bare sound on a written rhythm: a shaker, a cowbell, any one-shot in a pack. No kit: the name plays as written
// (`RolandTR909_cb` in full when a kit voice is wanted). The drum cells that act on a single voice apply.
function percPlan(attrs, ctx) {
  const { grid, bars } = parseGrid(attrs.rhythm ?? fit('x...', ctx.grid.steps), ctx.grid.steps); // the default is a hit per beat in any meter
  return { sound: attrs.sound ?? null, grid, bars, g: ctx.grid, accent: 0.5 };
}
const percRank = (g) => rankings(g.steps, g.pulse);
defineCell('perc', 'density', {
  // below .5 keep the best-ranked share of the hits; above .5 add the best-ranked empty steps (all of them at 1). Per bar.
  structural: (plan, v) => ({ ...plan, grid: perBar(plan.grid, plan.g.steps, (bar) => {
    const r = percRank(plan.g), cur = positions(bar), chars = Object.fromEntries(cur.map((i) => [i, bar[i]]));
    if (v < 0.5) return fromPositions([...cur].sort((a, b) => r.on.indexOf(a) - r.on.indexOf(b)).slice(0, Math.ceil(cur.length * v * 2)), bar.length, chars);
    const empty = r.off.filter((i) => !cur.includes(i));
    return fromPositions([...cur, ...empty.slice(0, Math.round((v - 0.5) * 2 * empty.length))], bar.length, chars);
  }) }),
  describe: (a, b) => (b < .5 ? `keep ${Math.round(b * 200)}% of the hits` : b > .5 ? `add ${Math.round((b - .5) * 200)}% of the empty steps` : 'the written rhythm'),
});
defineCell('perc', 'drive', { structural: (plan, v) => ({ ...plan, grid: perBar(plan.grid, plan.g.steps, (b) => place(b, v, percRank(plan.g))), accent: v }), describe: (a, b) => (b > .5 ? 'hits pulled onto the pulse, on-beat accent' : b < .5 ? 'hits pushed off it' : 'as written') });
for (const a of ['brightness', 'weight', 'space', 'aggression']) defineCell('perc', a, cells.drums[a]); // the same mappings as a drum voice
// same mapping as drums, but no choke: buildPerc has one voice and never cuts it, so the drums describe's ", hats choke" clause would lie.
defineCell('perc', 'articulation', { articulation: cells.drums.articulation.articulation, describe: (a, b) => `clip ${piece(1.2, 1, .2)(b).toFixed(2)}, release ${piece(.4, .1, .02)(b).toFixed(2)} s` });
defineSwing('perc'); defineOrganic('perc'); defineSweep('perc', 2);
function buildPerc(plan, attrs, ctx) {
  if (!plan.sound) return S.silence;
  let p = withGains(S.s(soundPat(plan.sound)).struct(over(gridToMini(plan.grid), plan.bars)), plan.grid, plan.bars);
  if (plan.accent !== 0.5) p = p.mul(S.gain(accents(plan.accent, plan.g)));
  return p;
}
registerLayer('perc', (attrs, ctx) => { const plan = applyPlanPhase('perc', percPlan(attrs, ctx), attrs, ctx); return withPlan(withLevel(applyPatternPhases('perc', buildPerc(plan, attrs, ctx), attrs, ctx), attrs), { grid: plan.grid, bars: plan.bars }); }, { materials: ['sound', 'rhythm'] });

// ---------- raw ----------
// The escape hatch: a plain strudel pattern inside a section, so a texture (a noise bed, a scrape, a drone) sits with the
// parts instead of in a stack() around the song, and mute/solo/pin, the check table and the dump all see it. Only the
// cells that act on any pattern apply; the pattern's own controls are its material.
for (const a of ['brightness', 'space', 'weight', 'width']) defineCell('raw', a, cells.sample[a]);
registerLayer('raw', (attrs, ctx) => {
  if (attrs.pattern !== undefined && !isPattern(attrs.pattern)) throw new Error(`raw.pattern must be a strudel pattern (s("...").struct("...")), got ${typeof attrs.pattern}`);
  return withLevel(applyPatternPhases('raw', attrs.pattern ?? S.silence, attrs, ctx), attrs);
}, { materials: ['pattern'] });
