// The examples page is data: adding an example is an entry here, not UI code (examples.html renders every entry through one card).
// Example fields: title, blurb, tags, variants: [{ label, hll | src }], and optionally svg (an inline <svg>, shown at 219×135 on the
// left) and explain (HTML shown beside it). `src` fetches a file from songs/ instead of inlining the code. The expanded Strudel is
// generated in the browser on first show. `stub: true` renders a placeholder in the intended spot until a follow-up fills it in.
// Variants of one example must produce different event streams (test/examples.test.mjs), except one marked `alias: true`, which
// must produce exactly the previous variant's stream: a second spelling of the same thing.
// Put a space before the slash of a self-closing svg tag: test/pages.test.mjs reads a quote followed by a slash as a root-absolute url.
// Descriptor and modifier examples compute their numbers with the resolver's own parsePhrase/applyDeltas, so the page shows
// exactly what `npm run resolve` would write, never a hand-copied approximation.
import { DESCRIPTORS, MODIFIERS, parsePhrase, applyDeltas, loadVocab } from '../lib/vocab.mjs';
if (typeof window !== 'undefined') await loadVocab((f) => fetch(new URL(`../lib/${f}`, import.meta.url)).then((r) => r.json()));

const num = (v) => (v === 1 || v === 0 ? String(v) : String(v).replace(/^0\./, '.'));
const attrs = (o) => `{ ${Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'number' ? num(v) : v}`).join(', ')} }`;
export const layer = (name, a, cycles = 4, note = '') => `${name}(${typeof a === 'string' ? a : attrs(a)}, { cycles: ${cycles} })${note ? ` // ${note}` : ''}`;
export const lbh = (name, axis, lo = .1, hi = .9) => [
  { label: 'Low', hll: layer(name, `{ ${axis}: ${lo} }`) },
  { label: 'Baseline', hll: layer(name, '{}') },
  { label: 'High', hll: layer(name, `{ ${axis}: ${hi} }`) },
];
/** The numbers the resolver writes for `phrase` on top of `base` (missing axes are 0.5). */
export const said = (phrase, base = {}) => {
  const { deltas, unknown } = parsePhrase(phrase);
  if (unknown.length) throw new Error(`examples: unknown word(s) ${unknown.join(', ')} in "${phrase}"`);
  return { ...base, ...Object.fromEntries(Object.entries(applyDeltas(base, deltas)).map(([a, r]) => [a, r.to])) };
};
const signed = (d) => `${d < 0 ? '−' : '+'}${num(Math.abs(d))}`;
/** "weight +.35, aggression +.15, register −.15" for a descriptor word. */
export const deltasOf = (word) => Object.entries(DESCRIPTORS[word]).map(([a, d]) => `${a} ${signed(d)}`).join(', ');
const SONG = `song({ cps: .5, key: 'C:minor', seed: 3 }, [`;
const s2 = (a, b) => `${SONG}\n  ${a},\n  ${b},\n])`;

// ---- svg generators: every card gets a 219×135 picture of what its variants change, drawn from the same data as the code ----
const INK = '#6b6b6b', LO = '#c9d4ee', MID = '#8fa6e2', HI = '#2f6fed', PALE = '#eef1f8';
const svg = (body) => `<svg viewBox="0 0 219 135" xmlns="http://www.w3.org/2000/svg" font-size="9" font-family="system-ui, sans-serif">${body}</svg>`;
const txt = (x, y, s, more = '') => `<text x="${x}" y="${y}" fill="${INK}"${more}>${s}</text>`;
const head = (dur = 4) => `<rect x="8" y="16" width="2" height="112" fill="${HI}" opacity=".7"><animate attributeName="x" from="8" to="213" dur="${dur}s" repeatCount="indefinite" /></rect>`;
const EVENS = [0, 2, 4, 6, 8, 10, 12, 14], ALL = Array.from({ length: 16 }, (_, i) => i);
/** Three labelled rows of a 16-step bar. A hit is a step index or { i, dx (px), a (height 0..1), on (accent) }. */
const grid = (rows, labels, { beats = false, bottom = false } = {}) => svg(
  (beats ? [0, 4, 8, 12].map((i) => `<rect x="${8 + i * 13}" y="16" width="10" height="112" fill="${PALE}" />`).join('') : '')
  + rows.map((row, r) => row.map((h) => { const { i, dx = 0, a = 1, on = false } = typeof h === 'number' ? { i: h } : h;
    return `<rect x="${8 + i * 13 + dx}" y="${20 + r * 38 + (1 - a) * (bottom ? 26 : 13)}" width="10" height="${26 * a}" rx="2" fill="${on ? HI : LO}" />`; }).join('')).join('')
  + labels.map((l, r) => txt(8, 14 + r * 38, l)).join('') + head());
/** Three labelled 26px bands; draw(r, y) returns the band's content. */
const bands = (labels, draw, sweep = false) => svg(labels.map((l, r) => txt(8, 14 + r * 38, l) + draw(r, 20 + r * 38)).join('') + (sweep ? head() : ''));
const env = ([a, d]) => (r, y) => [0, 1, 2, 3].map((b) => { const x0 = 8 + b * 52, w = 48; return `<polygon points="${x0},${y + 26} ${x0 + a * w},${y} ${Math.min(x0 + w, x0 + (a + d) * w)},${y + 26}" fill="${LO}" />`; }).join('');
const wave = (clip) => (r, y) => { const pts = []; for (let x = 8; x <= 211; x += 2) { const s = Math.sin((x - 8) / 203 * Math.PI * 8); pts.push(`${x},${(y + 13 - 12 * Math.max(-clip, Math.min(clip, s)) / clip).toFixed(1)}`); } return `<polyline points="${pts.join(' ')}" fill="none" stroke="${HI}" stroke-width="1.5" />`; };
const tail = (len) => (r, y) => `<rect x="8" y="${y}" width="10" height="26" rx="2" fill="${HI}" />` + Array.from({ length: Math.round(len / 6) }, (_, k) => `<rect x="${20 + k * 6}" y="${y + 4}" width="5" height="18" rx="1" fill="${LO}" opacity="${(1 - k * 6 / len).toFixed(2)}" />`).join('');
const stereo = (half) => (r, y) => txt(20, y + 17, 'L') + txt(193, y + 17, 'R') + `<line x1="109" y1="${y}" x2="109" y2="${y + 26}" stroke="#ddd" />` + `<rect x="${109 - half}" y="${y + 8}" width="${2 * half}" height="10" rx="5" fill="${LO}" />` + `<circle cx="109" cy="${y + 13}" r="4" fill="${HI}">${half > 5 ? `<animate attributeName="cx" values="109;${109 + half};109;${109 - half};109" dur="8s" repeatCount="indefinite" />` : ''}</circle>`;
const lowpass = svg([[50, 'dark', LO], [110, 'baseline', MID], [172, 'bright', HI]].map(([cx, l, c]) => `<path d="M8,40 H${cx} Q${cx + 14},40 ${cx + 22},110" fill="none" stroke="${c}" stroke-width="2" />` + txt(cx - 10, 32, l)).join('') + txt(8, 128, '20 Hz') + txt(184, 128, '20 kHz'));
const spectrum = (w) => ALL.map((i) => ({ i, a: Math.max(.08, Math.min(1, .35 + w * Math.max(0, 1 - i / 6))) }));
const SHAPE = [0, 2, 4, 3, 5, 4, 2, 0];
const contour = svg(['high', 'baseline', 'low'].map((l, r) => { const y = 20 + r * 38, at = (n, k) => `${16 + k * 27},${y + 24 - n * 4}`; return txt(8, y - 6, l) + `<polyline points="${SHAPE.map(at).join(' ')}" fill="none" stroke="${r === 1 ? MID : HI}" stroke-width="2" />` + SHAPE.map((n, k) => `<circle cx="${at(n, k).split(',')[0]}" cy="${at(n, k).split(',')[1]}" r="3" fill="${HI}" />`).join(''); }).join('') + head());
/** Axis deltas: one row per axis, a bar from `from` to `to` on a 0..1 track with the baseline marked. Several segs stack thinner. */
const X = (v) => 70 + v * 140;
const bars = (rows) => { const h = Math.min(30, 112 / rows.length); return svg(
  txt(68, 12, '0') + txt(X(.5) - 16, 12, 'baseline') + txt(206, 12, '1') + `<line x1="${X(.5)}" y1="16" x2="${X(.5)}" y2="${18 + h * rows.length}" stroke="#ccc" stroke-dasharray="3 3" />`
  + rows.map(({ name, segs }, r) => { const y = 18 + r * h, bh = (h - 6) / segs.length; return txt(8, y + h / 2 + 3, name)
    + segs.map(({ from, to }, k) => `<rect x="${X(Math.min(from, to))}" y="${y + 3 + k * bh}" width="${Math.max(1.5, Math.abs(X(to) - X(from)))}" height="${Math.max(2, bh - 1)}" fill="${to >= from ? HI : MID}" />`).join(''); }).join('')); };
// only the axes some phrase moves; an axis that is merely set in `base` (the starting point) is not part of the word
const deltaBars = (phrases, base = {}) => { const axes = [...new Set(phrases.flatMap((p) => Object.keys(said(p, base)).filter((a) => said(p, base)[a] !== (base[a] ?? .5))))]; return bars(axes.map((a) => ({ name: a, segs: phrases.map((p) => ({ from: base[a] ?? .5, to: said(p, base)[a] ?? base[a] ?? .5 })) }))); };
/** Roman-numeral boxes, one per cycle; the tonic (i or I) is filled. */
const chords = (rows) => { const h = Math.min(34, 118 / rows.length); return svg(rows.map(([label, prog], r) => { const y = 12 + r * h, cs = prog.split(' '), w = 150 / cs.length; return txt(8, y + h / 2 + 3, label)
  + cs.map((c, k) => { const home = /^[iI]$/.test(c); return `<rect x="${62 + k * w}" y="${y + 2}" width="${w - 3}" height="${h - 6}" rx="3" fill="${home ? HI : LO}" />` + `<text x="${62 + k * w + (w - 3) / 2}" y="${y + h / 2 + 3}" text-anchor="middle" fill="${home ? '#fff' : '#333'}">${c}</text>`; }).join(''); }).join('')); };
/** Twelve semitone cells per row: the scale's notes filled, its root in accent. */
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
const strip = (rows) => { const h = Math.min(30, 118 / rows.length); return svg(rows.map(([label, mode, root = 0], r) => { const y = 12 + r * h; return txt(8, y + h / 2 + 3, label)
  + Array.from({ length: 12 }, (_, s) => `<rect x="${64 + s * 12}" y="${y + 3}" width="10" height="${h - 8}" rx="2" fill="${s === root ? HI : SCALES[mode].includes((s - root + 12) % 12) ? LO : PALE}" />`).join(''); }).join('')); };
/** Section blocks sized by cycles and energy; a hot section is the one the words touch; ramp draws a trajectory inside its block. */
const timeline = (secs, note = '') => { const total = secs.reduce((s, x) => s + x[1], 0); let x = 8; return svg(secs.map(([name, cycles, level, hot, ramp]) => {
  const w = cycles / total * 203, hgt = 20 + level * 80, y = 120 - hgt, out = `<rect x="${x}" y="${y}" width="${w - 2}" height="${hgt}" rx="3" fill="${hot ? HI : LO}" />`
    + `<text x="${x + (w - 2) / 2}" y="131" text-anchor="middle" fill="${INK}"${w < 34 ? ' font-size="7"' : ''}>${w < 22 ? name.slice(0, 3) : name}</text>`
    + (ramp ? `<line x1="${x + 3}" y1="${118 - ramp[0] * (hgt - 8)}" x2="${x + w - 5}" y2="${118 - ramp[1] * (hgt - 8)}" stroke="${hot ? '#fff' : HI}" stroke-width="2" />` : '');
  x += w; return out; }).join('') + (note ? txt(8, 14, note) : '') + head(total * 2)); };
const rampSvg = (a, b, label) => svg(`<line x1="8" y1="67" x2="211" y2="67" stroke="#c9c9c9" stroke-dasharray="3 3" />` + `<line x1="8" y1="${122 - a * 110}" x2="211" y2="${122 - b * 110}" stroke="${HI}" stroke-width="2" />`
  + `<circle r="4" fill="${HI}"><animateMotion dur="4s" repeatCount="indefinite" path="M8,${122 - a * 110} L211,${122 - b * 110}" /></circle>` + txt(8, 14, label) + txt(150, 63, 'baseline .5'));

const ab = (name, word, base = {}, cycles = 4) => ({ svg: deltaBars([word], base), variants: [
  { label: 'Baseline', hll: layer(name, base, cycles) },
  { label: word, hll: layer(name, said(word, base), cycles, `"${word}"`) },
] });
const HUMAN = [[1, .9], [-1, 1], [2, .8], [0, 1], [-2, .85], [1, 1], [0, .75], [-1, .95]];

export const GROUPS = [
  { id: 'axes', title: 'Axes', blurb: 'Each axis is one perceptual dimension of one layer, from 0 to 1. 0.5 leaves the layer at its baseline; lower and higher values move it in a fixed direction, and the expanded Strudel shows the controls it became. Compare low, baseline and high. Axes marked "one-sided" cannot go below the baseline (a grid cannot be straighter than straight), so their low side is the baseline itself.', items: [
    { title: 'Density', tags: ['density', 'drums', 'structural'], blurb: 'Amount of musical activity: how many steps of the grid the drums fill.',
      svg: grid([[0, 4, 8, 12], EVENS, ALL], ['low', 'baseline', 'high']), explain: 'The grid has 16 steps per bar. Density picks how many of them carry a hit, from the downbeats alone to every step; the pattern itself is otherwise the same.',
      variants: lbh('drums', 'density', .2, .9) },
    { title: 'Drive', tags: ['drive', 'drums', 'structural'], blurb: 'Rhythmic insistence toward the pulse: where the hits fall and which are accented, not how many.',
      svg: grid([[2, 6, 10, 14], [0, 4, 8, 12], [0, 4, 8, 12].map((i) => ({ i, on: true }))], ['low: off the beat', 'baseline', 'high: on the beat, accented'], { beats: true }),
      explain: 'Density is held at .7 in all three so there is enough to place. Low drive pushes the kick and snare off the beat; high drive pulls them onto it and accents the on-beat hats.',
      variants: [{ label: 'Floating', hll: layer('drums', '{ density: .7, drive: .1 }') }, { label: 'Baseline', hll: layer('drums', '{ density: .7 }') }, { label: 'Driving', hll: layer('drums', '{ density: .7, drive: .9 }') }] },
    { title: 'Brightness', tags: ['brightness', 'pad', 'spectral'], blurb: 'Spectral character of the pad, dark to bright: the filter cutoff moves geometrically around its baseline (200 Hz to 6 kHz around 1.2 kHz).',
      svg: lowpass, variants: [{ label: 'Dark', hll: layer('pad', '{ brightness: .1 }') }, { label: 'Baseline', hll: layer('pad', '{}') }, { label: 'Bright', hll: layer('pad', '{ brightness: .9 }') }] },
    { title: 'Weight', tags: ['weight', 'bass', 'spectral'], blurb: 'Perceived low end and body of the bass: level and low-pass together, and above .7 the line drops an octave.',
      svg: grid([spectrum(-.3), spectrum(0), spectrum(.65)], ['low: thin', 'baseline', 'high: low end up, octave down'], { bottom: true }), variants: lbh('bass', 'weight', .2, .9) },
    { title: 'Space', tags: ['space', 'pad', 'spatial'], blurb: 'Dry and close to spacious: reverb amount and room size on the pad.',
      svg: bands(['low: dry', 'baseline', 'high: long tail'], (r, y) => tail([12, 60, 190][r])(r, y)), variants: lbh('pad', 'space', .1, .95) },
    { title: 'Articulation', tags: ['articulation', 'pad'], blurb: 'Sustained and smooth to short and punchy: attack, release and note length of the pad.',
      svg: bands(['sustained: slow attack, long release', 'baseline', 'plucked: instant, short'], (r, y) => env([[.5, .5], [.15, .5], [.02, .15]][r])(r, y), true),
      variants: [{ label: 'Sustained', hll: layer('pad', '{ articulation: .1 }') }, { label: 'Baseline', hll: layer('pad', '{}') }, { label: 'Plucked', hll: layer('pad', '{ articulation: .9 }') }] },
    { title: 'Aggression', tags: ['aggression', 'bass', 'spectral', 'one-sided'], blurb: 'Smooth to abrasive: distortion on the bass. One-sided, so the baseline is already as clean as it gets.',
      svg: bands(['baseline: clean', 'gritty: clipped', 'abrasive: squared off'], (r, y) => wave([1, .55, .12][r])(r, y)),
      variants: [{ label: 'Baseline', hll: layer('bass', '{}') }, { label: 'Gritty', hll: layer('bass', '{ aggression: .75 }') }, { label: 'Abrasive', hll: layer('bass', '{ aggression: 1 }') }] },
    { title: 'Groove', tags: ['groove', 'drums', 'timing', 'one-sided'], blurb: 'Rigid to swung: the second half of every beat is delayed. Density .8 so the 16th hats carry the swing.',
      svg: grid([ALL, ALL.map((i) => ({ i, dx: i % 4 >= 2 ? 3 : 0 })), ALL.map((i) => ({ i, dx: i % 4 >= 2 ? 6 : 0 }))], ['straight', 'swung: second half of each beat late', 'heavy swing'], { beats: true }),
      variants: [{ label: 'Straight', hll: layer('drums', '{ density: .8 }') }, { label: 'Swung', hll: layer('drums', '{ density: .8, groove: .75 }') }, { label: 'Heavy swing', hll: layer('drums', '{ density: .8, groove: 1 }') }] },
    { title: 'Variation', tags: ['variation', 'drums', 'structural', 'one-sided'], blurb: 'Repetitive to variable. .5 is a pure loop; above it fills appear with rising probability, and from .75 every fourth bar plays reversed. Eight cycles so the fills get a chance.',
      svg: grid([EVENS, [...EVENS, { i: 13, on: true }, { i: 15, on: true }], [{ i: 1, on: true }, { i: 3, on: true }, 5, 7, 9, { i: 11, on: true }, { i: 13, on: true }, { i: 15, on: true }]], ['loop: every bar the same', 'fills: extra hits, some bars', 'wild: fills, every 4th bar reversed']),
      variants: [{ label: 'Loop', hll: layer('drums', '{ density: .7 }', 8) }, { label: 'Fills', hll: layer('drums', '{ density: .7, variation: .7 }', 8) }, { label: 'Wild', hll: layer('drums', '{ density: .7, variation: 1 }', 8) }] },
    { title: 'Organicness', tags: ['organicness', 'drums', 'timing', 'one-sided'], blurb: 'Mechanical to humanized: random timing (up to ±40 ms) and level (up to ±20%) jitter on every hit.',
      svg: grid([EVENS, EVENS.map((i, k) => ({ i, dx: HUMAN[k][0], a: HUMAN[k][1] })), EVENS.map((i, k) => ({ i, dx: HUMAN[k][0] * 2.5, a: 1 - (1 - HUMAN[k][1]) * 2 }))], ['machine: on the grid, same level', 'human: a little early, late, softer', 'sloppy'], { beats: true }),
      variants: [{ label: 'Machine', hll: layer('drums', '{ density: .7 }') }, { label: 'Human', hll: layer('drums', '{ density: .7, organicness: .8 }') }, { label: 'Sloppy', hll: layer('drums', '{ density: .7, organicness: 1 }') }] },
    { title: 'Width', tags: ['width', 'pad', 'spatial'], blurb: 'Narrow to wide stereo image of the pad: a slow pan sweep that grows with the value, and from .8 a reversed copy on the other side (jux). Headphones help.',
      svg: bands(['mono', 'baseline: slight sweep', 'wide: full sweep'], (r, y) => stereo([4, 20, 95][r])(r, y)),
      variants: [{ label: 'Mono', hll: layer('pad', '{ width: .1 }') }, { label: 'Baseline', hll: layer('pad', '{}') }, { label: 'Wide', hll: layer('pad', '{ width: .9 }') }] },
    { title: 'Register', tags: ['register', 'melody', 'structural'], blurb: 'Low to high octave placement of the melody; the line itself is the same.', svg: contour, variants: lbh('melody', 'register', .1, .9) },
  ] },
  { id: 'descriptors', title: 'Descriptors', blurb: 'A descriptor is a named bundle of axis deltas (lib/descriptors.json), not hidden magic. "Dreamy" on a baseline pad is exactly the numbers it expands to, and the numbers below are computed by the same resolver that edits songs. The picture beside each one is those deltas: a bar per axis from where it was to where the word puts it. A layer without a cell for one of the axes simply ignores that delta.', items: [
    { title: 'Dreamy', tags: ['descriptor', 'pad'], blurb: `dreamy = ${deltasOf('dreamy')}. On the pad: more reverb, slower attack and release, no pulse duck, a touch darker.`, ...ab('pad', 'dreamy') },
    { title: 'Punchy', tags: ['descriptor', 'drums'], blurb: `punchy = ${deltasOf('punchy')}. Short hits, more level, on the beat, drier.`, ...ab('drums', 'punchy', { density: .7 }) },
    { title: 'Massive', tags: ['descriptor', 'pad'], blurb: `massive = ${deltasOf('massive')}. Four chord tones, low voicing, wide and roomy.`, ...ab('pad', 'massive') },
    { title: 'Frantic', tags: ['descriptor', 'drums'], blurb: `frantic = ${deltasOf('frantic')}. Every step, on the pulse, fills, short hits. Eight cycles so the fills land.`, ...ab('drums', 'frantic', {}, 8) },
    { title: 'Delicate', tags: ['descriptor', 'bass'], blurb: `delicate = ${deltasOf('delicate')}. Fewer, quieter, softer notes; aggression cannot go below its baseline, so that delta is inert here.`, ...ab('bass', 'delicate', { density: .7 }) },
    { title: 'Heavy', tags: ['descriptor', 'bass'], blurb: `heavy = ${deltasOf('heavy')}. More body, a little grit, an octave down.`, ...ab('bass', 'heavy') },
    { title: 'Spacious', tags: ['descriptor', 'pad'], blurb: `spacious = ${deltasOf('spacious')}. Bigger room and a wider sweep.`, ...ab('pad', 'spacious') },
    { title: 'Tight', tags: ['descriptor', 'drums'], blurb: `tight = ${deltasOf('tight')}. Shorter hits, less swing, less jitter. The baseline is already straight and mechanical, so this starts from a swung, human kit.`, ...ab('drums', 'tight', { density: .8, groove: .8, organicness: .8 }) },
    { title: 'Loose', tags: ['descriptor', 'drums'], blurb: `loose = ${deltasOf('loose')}. Longer hits, swing, timing and level jitter.`, ...ab('drums', 'loose', { density: .8 }) },
    { title: 'Mechanical', tags: ['descriptor', 'drums'], blurb: `mechanical = ${deltasOf('mechanical')}. Starts from a human, swung kit with fills and takes all three away.`, ...ab('drums', 'mechanical', { density: .7, groove: .8, organicness: .9, variation: .7 }, 8) },
    { title: 'Human', tags: ['descriptor', 'drums'], blurb: `human = ${deltasOf('human')}. Jittered timing and level, a hint of swing.`, ...ab('drums', 'human', { density: .7 }) },
  ] },
  { id: 'modifiers', title: 'Modifiers', blurb: `Modifiers scale a descriptor's deltas: ${Object.entries(MODIFIERS).map(([w, k]) => `${w} ×${k}`).join(', ')}. "less" flips the sign before scaling. The change is deterministic: the same words on the same numbers always give the same numbers, clamped to 0..1.`, items: [
    { title: 'Heavier, four ways', tags: ['modifier', 'heavy', 'bass'], blurb: `heavy = ${deltasOf('heavy')}. Each step scales those three deltas; "much" already pins weight at 1, so "extremely" only has aggression and register left to move.`,
      svg: deltaBars(['slightly heavier', 'heavier', 'much heavier', 'extremely heavier']), explain: 'Per axis, top to bottom: slightly (×0.5), plain (×1), much (×2), extremely (×3). The bars stop at the edge of the track: that is the clamp.',
      variants: [{ label: 'Baseline', hll: layer('bass', '{}') }, ...['slightly heavier', 'heavier', 'much heavier', 'extremely heavier'].map((p) => ({ label: p, hll: layer('bass', said(p), 4, `"${p}"`) }))] },
    { title: 'Less: the negative form', tags: ['modifier', 'negative', 'bright', 'spacious', 'pad'], blurb: `Starting from a bright, spacious pad. "less bright" subtracts bright = ${deltasOf('bright')}; "much less spacious" subtracts twice spacious = ${deltasOf('spacious')}.`,
      svg: bars([['brightness', .8, .5], ['register', .5, .45], ['space', .9, .2], ['width', .8, .4]].map(([name, from, to]) => ({ name, segs: [{ from, to }] }))), explain: 'Bars now run leftward from where the pad started, not from the baseline: "less" is a delta with its sign flipped, applied to the current numbers.',
      variants: [{ label: 'Bright, spacious pad', hll: layer('pad', { brightness: .8, space: .9, width: .8 }) }, ...['less bright', 'much less spacious'].map((p) => ({ label: p, hll: layer('pad', said(p, { brightness: .8, space: .9, width: .8 }), 4, `"${p}"`) }))] },
  ] },
  { id: 'harmony', title: 'Harmony', blurb: 'Harmony is material, not an axis: a section has a key and a roman-numeral progression, one chord per cycle. Harmony words (lib/harmony.json) pick those; they take no modifiers. The bass follows the roots, the pad voices the chords, and a melody with follow: true is transposed by them.', items: [
    { title: 'Major vs minor', tags: ['harmony', 'key', 'pad', 'bass'], blurb: 'Same section, same progression, the key\'s mode changes.',
      svg: strip([['C major', 'major'], ['C minor', 'minor']]), explain: 'Twelve semitones from the root; the filled cells are the scale. Minor lowers the third, sixth and seventh.',
      variants: [{ label: 'C minor', hll: `song({ cps: .5, key: 'C:minor' }, [section('a', 4, { progression: 'i iv v i', pad: {}, bass: {} })])` }, { label: 'C major', hll: `song({ cps: .5, key: 'C:major' }, [section('a', 4, { progression: 'I IV V I', pad: {}, bass: {} })])` }] },
    { title: 'Resolved vs tense', tags: ['harmony', 'progression', 'pad', 'bass'], blurb: 'resolved = I IV V I comes home on the last bar; tense = i VII VI VII never does. The word becomes the progression string.',
      svg: chords([['resolved', 'I IV V I'], ['tense', 'i VII VI VII']]), explain: 'One box per cycle. The filled box is the tonic: resolved ends on it, tense leaves it after the first bar and never returns.',
      variants: [{ label: 'Resolved', hll: `song({ cps: .5, key: 'C:major' }, [section('a', 4, { progression: 'I IV V I', pad: {}, bass: {} })])` }, { label: 'Tense', hll: `song({ cps: .5, key: 'C:minor' }, [section('a', 4, { progression: 'i VII VI VII', pad: {}, bass: {} })])` }] },
    { title: 'Progression words', tags: ['harmony', 'progression', 'pad', 'bass', 'melody'], blurb: 'The remaining words, each on the same C-rooted section with a following melody: pop = I V vi IV, epic = vi IV I V, circular = i VI III VII, static = i, unresolved = i VI VII.',
      svg: chords([['pop', 'I V vi IV'], ['epic', 'vi IV I V'], ['circular', 'i VI III VII'], ['static', 'i'], ['unresolved', 'i VI VII']]),
      variants: [['pop', 'C:major', 'I V vi IV'], ['epic', 'C:major', 'vi IV I V'], ['circular', 'C:minor', 'i VI III VII'], ['static', 'C:minor', 'i'], ['unresolved', 'C:minor', 'i VI VII']]
        .map(([w, key, p]) => ({ label: w, hll: `song({ cps: .5, key: '${key}', seed: 3 }, [section('a', 4, { progression: '${p}', pad: {}, bass: {}, melody: { follow: true } })]) // "${w}"` })) },
    { title: 'Relative major / minor', tags: ['harmony', 'key', 'relative'], blurb: 'The word "relative" switches to the relative key: the same seven notes, a different home. C minor and Eb major share every note, so only the root the bass and pad gravitate to changes.',
      svg: strip([['C minor', 'minor', 0], ['Eb major', 'major', 3]]), explain: 'Both rows are drawn from C. The filled cells are identical; only the accented root moves, from C to Eb.',
      variants: [{ label: 'C minor', hll: `song({ cps: .5, key: 'C:minor', seed: 3 }, [section('a', 4, { progression: 'i VI III VII', pad: {}, bass: {}, melody: { follow: true } })])` }, { label: 'relative → Eb major', hll: `song({ cps: .5, key: 'Eb:major', seed: 3 }, [section('a', 4, { progression: 'I IV V I', pad: {}, bass: {}, melody: { follow: true } })]) // "relative"` }] },
    { title: 'Modes', tags: ['harmony', 'mode'], blurb: 'A mode word swaps the scale on the same root: dorian is minor with a raised sixth, phrygian minor with a flattened second, lydian major with a raised fourth, mixolydian major with a flattened seventh.',
      svg: strip([['dorian', 'dorian'], ['phrygian', 'phrygian'], ['lydian', 'lydian'], ['mixolydian', 'mixolydian']]),
      variants: ['dorian', 'phrygian', 'lydian', 'mixolydian'].map((m) => ({ label: m, hll: `song({ cps: .5, key: 'D:${m}', seed: 3 }, [section('a', 4, { progression: 'i VII', pad: {}, bass: {}, melody: { follow: true } })]) // "${m}"` })) },
  ] },
  { id: 'sections', title: 'Section-level edits', blurb: 'The editing workflow: a request names a section, and only that section\'s numbers move. Everything else stays byte-identical, so the change is easy to hear and easy to review. Each Before/After pair below differs in exactly one section, the filled block in its picture.', items: [
    { title: 'Make the verse dreamier', tags: ['section', 'dreamy', 'pad', 'melody'], blurb: `"dreamier" (${deltasOf('dreamy')}) applied to the verse's pad and melody. Intro and chorus are untouched.`,
      svg: timeline([['intro', 4, .3], ['verse', 4, .5, true], ['chorus', 4, .9]], '"make the verse dreamier": only the verse moves'),
      variants: [
        { label: 'Before', hll: `${SONG}\n  section('intro', 4, { drums: { density: .3 }, pad: { space: .6 } }),\n  section('verse', 4, { drums: { density: .6 }, bass: {}, melody: { follow: true }, pad: {} }),\n  section('chorus', 4, { drums: { density: .8, drive: .7 }, bass: { weight: .7 }, melody: { follow: true }, pad: { brightness: .7 } }),\n])` },
        { label: 'After', hll: `${SONG}\n  section('intro', 4, { drums: { density: .3 }, pad: { space: .6 } }),\n  section('verse', 4, { drums: { density: .6 }, bass: {}, melody: ${attrs({ follow: 'true', ...said('dreamier') })}, pad: ${attrs(said('dreamier'))} }), // "make the verse dreamier"\n  section('chorus', 4, { drums: { density: .8, drive: .7 }, bass: { weight: .7 }, melody: { follow: true }, pad: { brightness: .7 } }),\n])` },
      ] },
    { title: 'Make the drop heavier', tags: ['section', 'heavy', 'drums', 'bass'], blurb: `"heavier" (${deltasOf('heavy')}) applied to the drop's bass and drums. The intro is unchanged; drums have no register cell, so that delta is inert there.`,
      svg: timeline([['intro', 4, .3], ['drop', 4, .9, true]], '"make the drop heavier"'),
      variants: [
        { label: 'Before', hll: s2(`section('intro', 4, { drums: { density: .4 }, pad: { space: .7 } })`, `section('drop', 4, { drums: { density: .8 }, bass: { weight: .5 }, pad: {} })`) },
        { label: 'After', hll: s2(`section('intro', 4, { drums: { density: .4 }, pad: { space: .7 } })`, `section('drop', 4, { drums: ${attrs(said('heavier', { density: .8 }))}, bass: ${attrs(said('heavier', { weight: .5 }))}, pad: {} }) // "make the drop heavier"`) },
      ] },
    { title: 'Make the chorus more spacious', tags: ['section', 'spacious', 'pad', 'melody'], blurb: `"more spacious" (${deltasOf('spacious')}, ×1) on the chorus pad and melody. The verse stays dry.`,
      svg: timeline([['verse', 4, .5], ['chorus', 4, .9, true]], '"make the chorus more spacious"'),
      variants: [
        { label: 'Before', hll: s2(`section('verse', 4, { drums: { density: .6 }, bass: {}, melody: { follow: true }, pad: { space: .3 } })`, `section('chorus', 4, { drums: { density: .8, drive: .7 }, bass: { weight: .7 }, melody: { follow: true }, pad: { space: .3 } })`) },
        { label: 'After', hll: s2(`section('verse', 4, { drums: { density: .6 }, bass: {}, melody: { follow: true }, pad: { space: .3 } })`, `section('chorus', 4, { drums: { density: .8, drive: .7 }, bass: { weight: .7 }, melody: ${attrs({ follow: 'true', ...said('more spacious') })}, pad: ${attrs(said('more spacious', { space: .3 }))} }) // "make the chorus more spacious"`) },
      ] },
    { title: 'Make the second section brighter', tags: ['section', 'bright', 'all layers'], blurb: `"brighter" (${deltasOf('bright')}) on every layer of the second section only. Register moves the bass and melody up a little; drums and pad have no register cell.`,
      svg: timeline([['a', 4, .6], ['b', 4, .6, true]], '"make the second section brighter": every layer of b'),
      variants: [
        { label: 'Before', hll: s2(`section('a', 4, { drums: { density: .7 }, bass: {}, melody: { follow: true }, pad: {} })`, `section('b', 4, { drums: { density: .7 }, bass: {}, melody: { follow: true }, pad: {} })`) },
        { label: 'After', hll: s2(`section('a', 4, { drums: { density: .7 }, bass: {}, melody: { follow: true }, pad: {} })`, `section('b', 4, { drums: ${attrs(said('brighter', { density: .7 }))}, bass: ${attrs(said('brighter'))}, melody: ${attrs({ follow: 'true', ...said('brighter') })}, pad: ${attrs(said('brighter'))} }) // "make the second section brighter"`) },
      ] },
    { title: 'Increase variation only in the final drop', tags: ['section', 'variation', 'drums', 'bass'], blurb: 'Two identical drops around a break. Variation goes to .9 in the last one only: fills, reversed bars and bass octave jumps appear there and nowhere else.',
      svg: timeline([['drop', 8, .9], ['break', 4, .3], ['drop2', 8, .9, true]], '"more variation in the final drop": drop stays a loop'),
      variants: [
        { label: 'Before', hll: `${SONG}\n  section('drop', 8, { drums: { density: .8, drive: .7 }, bass: { weight: .7 }, pad: {} }),\n  section('break', 4, { drums: { density: .3 }, pad: { space: .8 } }),\n  section('drop2', 8, { drums: { density: .8, drive: .7 }, bass: { weight: .7 }, pad: {} }),\n])` },
        { label: 'After', hll: `${SONG}\n  section('drop', 8, { drums: { density: .8, drive: .7 }, bass: { weight: .7 }, pad: {} }),\n  section('break', 4, { drums: { density: .3 }, pad: { space: .8 } }),\n  section('drop2', 8, { drums: { density: .8, drive: .7, variation: .9 }, bass: { weight: .7, variation: .9 }, pad: {} }), // "more variation in the final drop"\n])` },
      ] },
  ] },
  { id: 'trajectories', title: 'Trajectories', blurb: 'A continuous axis can take a signal instead of a number. ramp(a, b) is a saw that spans exactly the section it sits in; any Strudel signal (saw, sine, perlin…) works too. Structural axes (density, drive, variation, register) take numbers only. Open the expanded Strudel to see the signal mapped through the same control the constant would use.', items: [
    { title: 'Brightness rising through a section', tags: ['trajectory', 'brightness', 'pad', 'signal'], blurb: 'The pad opens from dark to bright over eight cycles. ramp(.1, .9) and the explicit saw are the same thing; ramp just knows the section length.',
      svg: rampSvg(.1, .9, 'brightness: ramp(.1, .9), one section'), explain: 'A constant sits on one horizontal line for the whole section. A ramp draws the diagonal instead: the value the control sees keeps moving.',
      variants: [{ label: 'Constant', hll: layer('pad', '{ brightness: .5 }', 8) }, { label: 'ramp(.1, .9)', hll: layer('pad', '{ brightness: ramp(.1, .9) }', 8) }, { label: 'saw.range(.1, .9).slow(8)', alias: true, hll: layer('pad', '{ brightness: saw.range(.1, .9).slow(8) }', 8) }] },
    { title: 'Width opening gradually', tags: ['trajectory', 'width', 'pad', 'signal'], blurb: 'The pan sweep grows from nothing to full over the section. Headphones.',
      svg: rampSvg(.5, 1, 'width: ramp(.5, 1), centred to full sweep'),
      variants: [{ label: 'Fixed width', hll: layer('pad', '{ width: .5 }', 8) }, { label: 'ramp(.5, 1)', hll: layer('pad', '{ width: ramp(.5, 1) }', 8) }] },
    { title: 'Space swelling into a transition', tags: ['trajectory', 'space', 'sections', 'signal'], blurb: 'The build\'s pad gets wetter every bar, then the drop lands dry. The ramp spans the build only; the drop has a plain number.',
      svg: timeline([['build', 8, .5, true, [.3, 1]], ['drop', 4, .9]], 'pad space: ramp(.3, 1) in the build, .3 in the drop'),
      variants: [
        { label: 'Flat build', hll: s2(`section('build', 8, { drums: { density: .5 }, pad: { space: .5, articulation: .3 } })`, `section('drop', 4, { drums: { density: .9, drive: .8 }, bass: { weight: .8 }, pad: { space: .3 } })`) },
        { label: 'Swelling build', hll: s2(`section('build', 8, { drums: { density: .5 }, pad: { space: ramp(.3, 1), articulation: .3 } })`, `section('drop', 4, { drums: { density: .9, drive: .8 }, bass: { weight: .8 }, pad: { space: .3 } })`) },
      ] },
    { title: 'Aggression increasing toward a drop', tags: ['trajectory', 'aggression', 'bass', 'sections', 'signal'], blurb: 'Bass distortion climbs through the build and stays high in the drop.',
      svg: timeline([['build', 8, .6, true, [.5, 1]], ['drop', 4, .9, false, [.8, .8]]], 'bass aggression: ramp(.5, 1), then .8 in the drop'),
      variants: [
        { label: 'Flat build', hll: s2(`section('build', 8, { drums: { density: .7 }, bass: { density: .7, aggression: .5 } })`, `section('drop', 4, { drums: { density: .9, drive: .8 }, bass: { density: .7, aggression: .8, weight: .8 } })`) },
        { label: 'Rising build', hll: s2(`section('build', 8, { drums: { density: .7 }, bass: { density: .7, aggression: ramp(.5, 1) } })`, `section('drop', 4, { drums: { density: .9, drive: .8 }, bass: { density: .7, aggression: .8, weight: .8 } })`) },
      ] },
  ] },
  { id: 'songs', title: 'Full songs', blurb: 'Sections, layers, axes, descriptors, harmony and trajectories together: the system as a composition tool. The miniature is inline; the rest play the files in songs/, and the comments in each file name the words the numbers came from. Each picture is the song\'s form: block width is cycles, height is roughly how much is going on.', items: [
    { title: 'miniature', tags: ['song', 'sections', 'descriptor', 'harmony', 'trajectory'], blurb: 'Sixteen cycles: a dreamy intro, a verse, a chorus that lifts into the relative major with a pop progression and a rising melody, and an outro whose pad swells and darkens away.',
      svg: timeline([['intro', 4, .2], ['verse', 4, .5], ['chorus', 4, .9, false, [.5, .9]], ['outro', 4, .3, false, [.6, 1]]], 'dreamy · circular · relative, pop, punchy, heavy · static'),
      variants: [{ label: 'miniature', hll: `song({ cps: .5, key: 'A:minor', seed: 7, kit: 'RolandTR808' }, [
  section('intro', 4, { role: 'establish',
    pad: ${attrs(said('dreamy'))} }), // "dreamy"
  section('verse', 4, { role: 'develop', progression: 'i VI III VII', // "circular"
    drums: { density: .6, groove: .65 }, bass: { weight: .7, register: .3 }, melody: { follow: true }, pad: { space: .6 } }),
  section('chorus', 4, { role: 'climax', key: 'C:major', progression: 'I V vi IV', // "relative", "pop"
    drums: ${attrs(said('punchy', { density: .85 }))}, // "punchy"
    bass: ${attrs(said('heavy'))}, // "heavy"
    melody: { follow: true, brightness: ramp(.5, .9), width: .8 },
    pad: ${attrs(said('spacious brighter'))} }), // "spacious, brighter"
  section('outro', 4, { role: 'release', progression: 'i',  // "static"
    drums: { density: .3, space: .8 }, pad: { space: ramp(.6, 1), brightness: ramp(.6, .2), articulation: .3 } }),
])` }] },
    { title: 'demo', tags: ['song', 'sections', 'trajectory', 'harmony'], blurb: 'intro → verse → drop. The verse melody\'s brightness is a saw ramp; the drop switches progression.',
      svg: timeline([['intro', 4, .3], ['verse', 8, .6, false, [.3, .7]], ['drop', 8, .95]], '20 cycles, C minor; the drop goes circular'), variants: [{ label: 'demo.strudel', src: 'songs/demo.strudel' }] },
    { title: 'arc', tags: ['song', 'sections', 'key change'], blurb: 'Sad to happy over 40 cycles: intro → verse → lift → drop → outro, with a key change into the drop.',
      svg: timeline([['intro', 8, .25], ['verse', 8, .5, false, [.2, .5]], ['lift', 8, .7], ['drop', 8, .95], ['outro', 8, .6]], '40 cycles, C minor into Eb major at the drop'), variants: [{ label: 'arc.strudel', src: 'songs/arc.strudel' }] },
    { title: 'nocturne', tags: ['song', 'sections', 'hypnotic'], blurb: 'Dark, sleek pop-funk at 117 BPM over 62 cycles. Drums alone, then the bass becomes the hook; choruses open the width, verses pull it back.',
      svg: timeline([['intro', 2, .2], ['arrive', 4, .4], ['verse', 8, .55], ['chorus', 8, .8], ['verse2', 8, .55], ['chorus2', 8, .85], ['breakdown', 4, .3], ['rebuild', 4, .5], ['final', 8, .9], ['outro', 8, .4]], '62 cycles, 117 BPM'), variants: [{ label: 'nocturne.strudel', src: 'songs/nocturne.strudel' }] },
    { title: 'machine', tags: ['song', 'sections', 'aggression', 'static'], blurb: 'Industrial rock at 120 BPM on one static minor chord for 68 cycles. All the tension is density, drive, distortion and filtering; harmony never moves.',
      svg: timeline([['intro', 4, .2], ['arrive', 4, .4], ['verse', 8, .6], ['build', 4, .7], ['chorus', 8, .85], ['breakdown', 4, .3], ['rebuild', 4, .5], ['verse2', 8, .6], ['chorus2', 8, .9], ['chorus3', 8, .95], ['burnout', 8, .5]], '68 cycles, E minor, i only'), variants: [{ label: 'machine.strudel', src: 'songs/machine.strudel' }] },
  ] },
];
