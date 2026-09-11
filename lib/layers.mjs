import { S, val, isPattern } from './strudel.mjs';
import { registerLayer } from './song.mjs';
// structural axes get their number check inside applyPlanPhase (which calls num for us)
import { defineCell, applyPlanPhase, applyPatternPhases, ctl, piece } from './axes.mjs';
import { TEMPLATES, place, accents, gridToMini } from './grid.mjs';

const hz = (n) => `${Math.round(n)} Hz`;
const rootOf = (key) => key.split(':')[0].replace(/\d+$/, '');
const modeOf = (key) => key.split(':').slice(1).join(':') || 'minor';
const keyAt = (key, octave) => `${rootOf(key)}${octave}:${modeOf(key)}`;
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

// deterministic PRNG from seed for melodic material
const prng = (seed) => { let x = (seed * 2654435761) >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32); };

// ---------- shared continuous cells (same mapping on several layers) ----------
function defineSwing(layer) {
  defineCell(layer, 'groove', {
    timing: (p, v) => (typeof v === 'number'
      ? (v === 0.5 ? p : p.swingBy((v - 0.5) * 0.3, 8))
      : p.swingBy(v.fmap((x) => (x - 0.5) * 0.3), 8)),
    describe: (a, b) => `swing ${((a - .5) * .3).toFixed(2)} -> ${((b - .5) * .3).toFixed(2)}`,
  });
}
function defineOrganic(layer, { timing = true } = {}) {
  const jitter = (v, scale) => S.rand.range(-1, 1).mul(val(v).fmap((x) => Math.max(0, x - 0.5) * scale));
  const cell = {
    level: (p, v) => (typeof v === 'number' && v <= 0.5 ? p : p.mul(S.gain(jitter(v, 0.4).add(1)))),
    describe: (a, b) => `timing jitter +/-${Math.round(Math.max(0, b - .5) * 80)} ms, gain jitter ${Math.round(Math.max(0, b - .5) * 40)}%`,
  };
  if (timing) cell.timing = (p, v) => (typeof v === 'number' && v <= 0.5 ? p : p.nudge(jitter(v, 0.08)));
  defineCell(layer, 'organicness', cell);
}

// ---------- drums ----------
const DRUM_ORDER = ['bd', 'sd', 'hh', 'oh', 'cp'];
const DRUM_THRESH = { bd: .1, sd: .3, hh: .5, oh: .7, cp: .85 };
const DRUM_PAN_UNIT = { bd: 0, sd: 0, hh: 1, oh: -1, cp: -.6 };

function drumPlan(attrs) {
  const t = TEMPLATES[attrs.template ?? 'house'];
  if (!t) throw new Error(`drums: unknown template "${attrs.template}" (known: ${Object.keys(TEMPLATES).join(', ')})`);
  return { grids: { ...t }, voices: ['bd', 'sd', 'hh'], hatAccent: accents(0.5), variation: 0 };
}
defineCell('drums', 'density', {
  structural: (plan, v) => {
    const grids = { ...plan.grids };
    if (v >= 0.8) grids.hh = 'xxxxxxxxxxxxxxxx';
    return { ...plan, voices: DRUM_ORDER.filter((k) => v >= DRUM_THRESH[k]), grids };
  },
  describe: (a, b) => `voices ${DRUM_ORDER.filter((k) => b >= DRUM_THRESH[k]).join('+') || 'none'}${b >= .8 ? ', 16th hats' : ''}`,
});
defineCell('drums', 'drive', {
  structural: (plan, v) => ({ ...plan, grids: { ...plan.grids, bd: place(plan.grids.bd, v), sd: place(plan.grids.sd, v) }, hatAccent: accents(v) }),
  describe: (a, b) => (b > .5 ? 'kick/snare toward the pulse, hats accent on-beat' : b < .5 ? 'kick/snare pushed to offbeats' : 'template placement'),
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
  articulation: (p, v) => {
    p = ctl(p, 'clip', v, piece(1.2, 1, 0.2));
    p = ctl(p, 'release', v, piece(0.4, 0.1, 0.02));
    return typeof v === 'number' && v >= 0.6 ? p.cut(1) : p;
  },
  describe: (a, b) => `clip ${piece(1.2, 1, .2)(b).toFixed(2)}, release ${piece(.4, .1, .02)(b).toFixed(2)} s${b >= .6 ? ', hats choke' : ''}`,
});
defineCell('drums', 'aggression', {
  spectral: (p, v) => ctl(p, 'distort', v, (x) => Math.max(0, x - 0.5) * 1.2, { noopBelow: true }),
  describe: (a, b) => `distort ${(Math.max(0, b - .5) * 1.2).toFixed(2)}`,
});
defineSwing('drums');
defineOrganic('drums');
// applied per voice inside buildDrums, so the phase runner has nothing to do
defineCell('drums', 'width', { builtIn: true, describe: (a, b) => `stereo spread +/-${piece(0, .1, .5)(b).toFixed(2)}` });

function buildDrums(plan, attrs, ctx) {
  const w = attrs.width ?? 0.5;
  const voices = plan.voices.map((k) => {
    let p = S.s(k).struct(gridToMini(plan.grids[k])).bank(ctx.kit);
    if (k === 'hh') p = p.gain(plan.hatAccent);
    const unit = DRUM_PAN_UNIT[k];
    return unit === 0 ? p.pan(0.5) : ctl(p, 'pan', w, (x) => 0.5 + unit * piece(0, 0.1, 0.5)(x));
  });
  let pat = S.stack(...voices);
  if (plan.variation > 0.5) {
    pat = pat.sometimesBy((plan.variation - 0.5) * 2, (x) => x.ply(2));
    if (plan.variation >= 0.75) pat = pat.every(4, S.rev);
  }
  return pat;
}
registerLayer('drums', (attrs, ctx) => {
  const plan = applyPlanPhase('drums', drumPlan(attrs), attrs, ctx);
  return applyPatternPhases('drums', buildDrums(plan, attrs, ctx), attrs, ctx);
});

// ---------- bass ----------
const BASS_LINES = { 1: '0', 2: '0 0', 4: '0 0 4 3', 8: '0 0 4 0 3 0 4 2' };
const BASS_GRIDS = { 1: 'x...............', 2: 'x.......x.......', 4: 'x...x...x...x...', 8: 'x.x.x.x.x.x.x.x.' };
const bassCount = (v) => (v < .25 ? 1 : v < .5 ? 2 : v <= .75 ? 4 : 8);

function bassPlan(attrs) {
  return { line: attrs.notes ?? BASS_LINES[4], lineExplicit: attrs.notes !== undefined, grid: BASS_GRIDS[4], octave: 2, variation: 0 };
}
defineCell('bass', 'density', {
  structural: (plan, v) => { const count = bassCount(v); return { ...plan, line: plan.lineExplicit ? plan.line : BASS_LINES[count], grid: BASS_GRIDS[count] }; },
  describe: (a, b) => `${bassCount(b)} notes per cycle`,
});
defineCell('bass', 'drive', {
  structural: (plan, v) => ({ ...plan, grid: place(plan.grid, v), accent: v }),
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
  let p = midi(S.n(plan.line).scale(keyAt(ctx.key, plan.octave))).struct(gridToMini(plan.grid))
    .s('sawtooth').lpf(400).clip(0.8).release(0.1).gain(0.8);
  if (plan.accent !== undefined && plan.accent !== 0.5) p = p.mul(S.gain(accents(plan.accent)));
  if (plan.variation > 0.5) p = p.sometimesBy((plan.variation - 0.5) * 2, (x) => x.add(S.note(12)));
  return p;
}
registerLayer('bass', (attrs, ctx) => {
  const plan = applyPlanPhase('bass', bassPlan(attrs), attrs, ctx);
  return applyPatternPhases('bass', buildBass(plan, attrs, ctx), attrs, ctx);
});

// ---------- melody ----------
const melodyLine = (seed) => { const r = prng(seed); return Array.from({ length: 8 }, () => (r() < 0.2 ? '~' : Math.floor(r() * 8))).join(' '); };
const melodyOctave = (v) => (v < 1 / 3 ? 3 : v <= 2 / 3 ? 4 : 5);

function melodyPlan(attrs, ctx) { return { line: attrs.notes ?? melodyLine(ctx.seed), octave: 4, density: 0.5, variation: 0 }; }
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
defineCell('melody', 'width', {
  spatial: (p, v) => (typeof v === 'number'
    ? (v <= 0.5 ? p : sweep(p, S.sine.slow(4), (v - 0.5)))
    : sweep(p, S.sine.slow(4), val(v).fmap((x) => Math.max(0, x - 0.5)))),
  describe: (a, b) => (b <= .5 ? 'centred' : `pan sweep +/-${Math.max(0, b - .5).toFixed(2)}`),
});

function buildMelody(plan, attrs, ctx) {
  let p = midi(S.n(plan.line).scale(keyAt(ctx.key, plan.octave))).s('sawtooth').lpf(2000).clip(0.8).release(0.1).room(0.2).gain(0.6);
  if (plan.density < 0.5) p = p.degradeBy((0.5 - plan.density) * 2 * 0.8);
  if (plan.density > 0.5) p = p.sometimesBy((plan.density - 0.5) * 2, (x) => x.ply(2));
  if (plan.variation > 0.5) { p = p.sometimesBy((plan.variation - 0.5) * 2, (x) => x.fast(2)); if (plan.variation >= 0.75) p = p.every(4, S.rev); }
  return p;
}
registerLayer('melody', (attrs, ctx) => {
  const plan = applyPlanPhase('melody', melodyPlan(attrs, ctx), attrs, ctx);
  return applyPatternPhases('melody', buildMelody(plan, attrs, ctx), attrs, ctx);
});

// ---------- pad ----------
const PAD_TONES = { 1: '0', 2: '[0,4]', 3: '[0,2,4]', 4: '[0,2,4,6]' };
const padTones = (v) => (v < .25 ? 1 : v < .5 ? 2 : v <= .75 ? 3 : 4);
const padWidth = piece(0, 0.1, 0.5);

function padPlan(attrs) { return { tones: 3, chord: attrs.chord ?? '<0 5>', octave: 4, drive: 0.5 }; }
defineCell('pad', 'density', { structural: (plan, v) => ({ ...plan, tones: padTones(v) }), describe: (a, b) => `${padTones(b)} chord tones` });
defineCell('pad', 'drive', { structural: (plan, v) => ({ ...plan, drive: v }), describe: (a, b) => (b > .5 ? `pulse duck depth ${((b - .5) * 2 * .6).toFixed(2)}` : 'no duck') });
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
    ? (v === 0.5 ? p : v >= 0.8 ? p.jux(S.rev) : sweep(p, S.sine.slow(8), padWidth(v)))
    : sweep(p, S.sine.slow(8), val(v).fmap(padWidth))),
  describe: (a, b) => (b >= .8 ? 'jux(rev)' : `pan sweep +/-${padWidth(b).toFixed(2)}`),
});

function buildPad(plan, attrs, ctx) {
  let p = midi(S.n(plan.chord).add(S.n(PAD_TONES[plan.tones])).scale(keyAt(ctx.key, plan.octave)))
    .s('sawtooth').lpf(1200).attack(0.15).release(0.6).room(0.3).size(0.6).gain(0.45)
    .pan(S.sine.slow(8).range(0.4, 0.6));
  // ponytail: the duck is sampled once per chord hap (continuous signals collapse per hap), so it reads as a
  // per-chord level dip rather than a 4-per-cycle pump. A real sidechain needs the pad re-struck, which would
  // change the onset count and break the drive invariant. Upgrade when the renderer samples gain continuously.
  if (plan.drive > 0.5) p = p.mul(S.gain(S.square.fast(4).range(1 - (plan.drive - 0.5) * 2 * 0.6, 1)));
  return p;
}
registerLayer('pad', (attrs, ctx) => {
  const plan = applyPlanPhase('pad', padPlan(attrs), attrs, ctx);
  return applyPatternPhases('pad', buildPad(plan, attrs, ctx), attrs, ctx);
});
