// The examples page is data: adding an example is an entry here, not UI code (examples.html renders every entry through one card).
// Example fields: title, blurb, tags, variants: [{ label, hll | src }], and optionally svg (an inline <svg>, shown at 219×135 on the
// left) and explain (HTML shown beside it). `src` fetches a file from songs/ instead of inlining the code. The expanded Strudel is
// generated in the browser on first show. `stub: true` renders a placeholder in the intended spot until a follow-up fills it in.
// Variants of one example must produce different event streams (test/examples.test.mjs), except one marked `alias: true`, which
// must produce exactly the previous variant's stream: a second spelling of the same thing.
// Put a space before the slash of a self-closing svg tag: test/pages.test.mjs reads a quote followed by a slash as a root-absolute url.
// Descriptor and modifier examples compute their numbers with the resolver's own parsePhrase/applyDeltas, so the page shows
// exactly what `npm run resolve` would write, never a hand-copied approximation.
import { DESCRIPTORS, OVERLAYS, MODIFIERS, parsePhrase, applyDeltas, loadVocab } from '../lib/vocab.mjs';
import { melodyLine } from '../lib/layers.mjs';
import { parseMeter } from '../lib/song.mjs';
if (typeof window !== 'undefined') await loadVocab((f) => fetch(new URL(`../lib/${f}`, import.meta.url)).then((r) => r.json()));

const num = (v) => (v === 1 || v === 0 ? String(v) : String(v).replace(/^0\./, '.'));
const attrs = (o) => (Object.keys(o).length ? `{ ${Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'number' ? num(v) : v}`).join(', ')} }` : '{}');
export const layer = (name, a, cycles = 4, note = '') => `${name}(${typeof a === 'string' ? a : attrs(a)}, { cycles: ${cycles} })${note ? ` // ${note}` : ''}`;
export const lbh = (name, axis, lo = .1, hi = .9, base = {}) => [
  { label: 'Low', hll: layer(name, { ...base, [axis]: lo }) },
  { label: 'Baseline', hll: layer(name, base) },
  { label: 'High', hll: layer(name, { ...base, [axis]: hi }) },
];
/** The numbers the resolver writes for `phrase` on top of `base` (missing axes are 0.5). */
export const said = (phrase, base = {}) => {
  const { deltas, unknown } = parsePhrase(phrase);
  if (unknown.length) throw new Error(`examples: unknown word(s) ${unknown.join(', ')} in "${phrase}"`);
  return { ...base, ...Object.fromEntries(Object.entries(applyDeltas(base, deltas)).map(([a, r]) => [a, r.to])) };
};
const signed = (d) => `${d < 0 ? '−' : '+'}${num(Math.abs(d))}`;
/** "weight +.35, aggression +.15, register −.15" for a descriptor or overlay word. */
export const deltasOf = (word) => Object.entries(DESCRIPTORS[word] ?? OVERLAYS[word]).map(([a, d]) => `${a} ${signed(d)}`).join(', ');
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
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], 'harmonic minor': [0, 2, 3, 5, 7, 8, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
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

/** Baseline against one word, or a list of words (opposites side by side), on one layer. */
const ab = (name, word, base = {}, cycles = 4) => ({ svg: deltaBars([].concat(word), base), variants: [
  { label: 'Baseline', hll: layer(name, base, cycles) },
  ...[].concat(word).map((w) => ({ label: w, hll: layer(name, said(w, base), cycles, `"${w}"`) })),
] });
const HUMAN = [[1, .9], [-1, 1], [2, .8], [0, 1], [-2, .85], [1, 1], [0, .75], [-1, .95]];
// an overlay lands on every layer of a section; each layer keeps the axes it has a cell for
const FOUR = { drums: { density: .7 }, bass: {}, melody: { follow: 'true' }, pad: {} };
const sec4 = (spec, cycles = 4, note = '') => `${SONG}\n  section('a', ${cycles}, { ${Object.entries(spec).map(([l, a]) => `${l}: ${attrs(a)}`).join(', ')} }),${note ? ` // ${note}` : ''}\n])`;
const overlay = (word, cycles = 4) => ({ svg: deltaBars([word]), variants: [
  { label: 'Before', hll: sec4(FOUR, cycles) },
  { label: word, hll: sec4(Object.fromEntries(Object.entries(FOUR).map(([l, a]) => [l, said(word, a)])), cycles, `"${word}" on every layer`) },
] });
const BUILD = (fx) => `section('build', 4, { drums: { density: .5 }, pad: { space: .6 }${fx ? `, fx: ${attrs(fx)}` : ''} })`;
const DROP = (fx) => `section('drop', 4, { drums: { density: .9, drive: .8 }, bass: { weight: .8 }, pad: {}${fx ? `, fx: ${attrs(fx)}` : ''} })`;
const keyed = (key, p) => `song({ cps: .5, key: '${key}', seed: 3 }, [section('a', 4, { progression: '${p}', pad: {}, bass: {} })])`;
/** [key, progression, chord names] behind every progression-syntax variant; test/examples.test.mjs checks the names against chordNames(). */
export const PROGRESSIONS = [];
const prog = (key, p, names, extra = {}) => { PROGRESSIONS.push([key, p, names]); return { label: `${p} → ${names}`, hll: keyed(key, p), ...extra }; };
const MODS = ['slightly more spacious', 'a little more spacious', 'a bit more spacious', 'somewhat more spacious', 'more spacious', 'very spacious', 'much more spacious', 'way more spacious', 'a lot more spacious', 'extremely spacious'];
const DRY = { space: .1, width: .3 };
const VERSE = `const verse = { drums: { density: .6 }, bass: {}, melody: { follow: true }, pad: {} };`;
/** A mini-notation line of degrees (`0 1@2 ~ 3`, eight slots a bar) as grid hits, height by pitch, so a picture is drawn from the notes themselves. */
const line = (notes, on = false, per = 2) => { let i = 0; return notes.split(' ').flatMap((t) => { const [n, k = 1] = t.split('@'), at = i; i += per * Number(k); return n === '~' ? [] : [{ i: at, a: .4 + .6 * Number(n) / 7, on }]; }); }; // per: steps a slot takes (a bass line has four slots a bar)
const BASS = '0 0 4 3'; // the bass layer's seeded four-note line
/** Rows of one waveform each, three cycles wide, drawn beside the label. */
const waves = (rows) => svg(rows.map(([label, fn], r) => { const y = 12 + r * 30, pts = []; for (let x = 84; x <= 211; x += 2) pts.push(`${x},${(y + 13 - 10 * fn((x - 84) / 127 * 3)).toFixed(1)}`); return txt(8, y + 16, label) + `<polyline points="${pts.join(' ')}" fill="none" stroke="${r ? HI : MID}" stroke-width="1.5" />`; }).join(''));
/** The generated melody at each phrase length over four bars: the first pass of the phrase in accent, its repeats pale. */
const phrases = (seed, ps) => svg(ps.map((p, r) => { const y = 20 + r * 38, hits = line(melodyLine(seed, 8 * p)), w = 203 / 64; return txt(8, y - 6, `phrase: ${p}`)
  + [1, 2, 3].map((b) => `<line x1="${8 + b * 203 / 4}" y1="${y}" x2="${8 + b * 203 / 4}" y2="${y + 26}" stroke="#ddd" />`).join('')
  + Array.from({ length: 4 / p }, (_, k) => hits.map(({ i, a }) => `<rect x="${(8 + (k * 16 * p + i) * w).toFixed(1)}" y="${(y + (1 - a) * 26).toFixed(1)}" width="${(w * 1.2).toFixed(1)}" height="${(26 * a).toFixed(1)}" rx="1" fill="${k ? LO : HI}" />`).join('')).join(''); }).join('') + head());
/** Two sections as blocks, each showing the icon and name of the kit it plays. */
const kits = (rows) => svg(rows.map(([label, ...ks], r) => { const y = 20 + r * 60; return txt(8, y - 6, label) + ks.map((k, i) => { const x = 8 + i * 104; return `<rect x="${x}" y="${y}" width="98" height="36" rx="3" fill="${i && ks[0] !== k ? MID : LO}" /><image href="web/kits/${k}.svg" x="${x + 4}" y="${y + 4}" width="28" height="28" />` + txt(x + 38, y + 16, `section ${'ab'[i]}`) + txt(x + 38, y + 30, k.replace('Roland', ''), ' font-size="8"'); }).join(''); }).join(''));
/** One bar of each meter as its sixteenths, the same width for every one (a bar is one cycle): downbeat in accent, beats mid. */
const meters = (ms) => svg(ms.map((m, r) => { const { steps, pulse } = parseMeter(m), y = 14 + r * 24, w = 171 / steps; return txt(8, y + 12, m) + Array.from({ length: steps }, (_, i) => `<rect x="${(40 + i * w).toFixed(1)}" y="${y}" width="${(w - 1.5).toFixed(1)}" height="16" rx="1.5" fill="${i === 0 ? HI : i % pulse === 0 ? MID : LO}" />`).join(''); }).join(''));
/** cps .5 and 120 bpm in 4/4 are the same two-second bar: one block against four beats, one playhead over both. */
const tempo = svg(txt(8, 14, 'cps: .5') + `<rect x="8" y="20" width="203" height="26" rx="3" fill="${LO}" />` + txt(58, 37, 'one cycle = one bar = 2 s')
  + txt(8, 66, 'bpm: 120 in 4/4') + [0, 1, 2, 3].map((b) => `<rect x="${(8 + b * 50.75).toFixed(2)}" y="72" width="49" height="26" rx="3" fill="${b ? LO : MID}" />` + txt(8 + b * 50.75 + 20, 89, `${b + 1}`)).join('')
  + txt(8, 118, 'four beats a bar, 120 a minute: a bar every 2 s') + head(2));
const THEME = '0 2 3@2 ~ 4 3 2', COUNTER = '~ 7 ~ ~ 5 ~ 4 ~';
/** The demo pack's folder, and the two lines of the song that reach it. */
const ct = (x, y, s, c = INK) => `<text x="${x}" y="${y}" fill="${c}">${s}</text>`;
const tree = svg(ct(8, 28, 'samples/user/') + ct(24, 48, 'demo-pack/', MID) + ct(40, 68, 'pack.json') + `<text x="94" y="68" fill="${INK}" font-size="8">{ deploy: true, license: 'CC0-1.0' }</text>` + ct(40, 88, 'ping.wav', HI)
  + `<path d="M50,94 V112 H72" fill="none" stroke="${HI}" stroke-width="1.5" />` + ct(76, 115, `melody: { sound: 'ping' }`, HI) + ct(8, 131, `song({ ..., packs: ['demo-pack'] }`));

/** A file as a waveform (fake, decaying bursts), the used region lit, a line at every slice point, played slices in accent. */
const sliced = (begin, end, points, played, label) => svg(txt(8, 14, label)
  + `<rect x="${8 + begin * 203}" y="24" width="${(end - begin) * 203}" height="80" fill="${PALE}" />`
  + Array.from({ length: 100 }, (_, i) => { const x = 8 + i * 2.03, t = i / 100, a = 30 * Math.abs(Math.sin(t * Math.PI * 8)) * Math.exp(-((t * 8) % 1) * 3); return `<line x1="${x.toFixed(1)}" y1="${(64 - a).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(64 + a).toFixed(1)}" stroke="${INK}" stroke-width="1" />`; }).join('')
  + points.map((p, i) => `<line x1="${(8 + p * 203).toFixed(1)}" y1="24" x2="${(8 + p * 203).toFixed(1)}" y2="104" stroke="${played.includes(i) ? HI : MID}" stroke-width="${played.includes(i) ? 2 : 1}" />`).join('')
  + points.slice(0, -1).map((p, i) => txt(10 + p * 203, 118, String(i), played.includes(i) ? ` fill="${HI}"` : '')).join(''));
const PACKED = `song({ cps: .5, key: 'C:minor', seed: 3, packs: ['demo-pack'] }, [`;
const sp = (spec, cycles = 4, note = '') => `${PACKED}\n  section('a', ${cycles}, { ${spec} }),${note ? ` // ${note}` : ''}\n])`;

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
  { id: 'cells', title: 'Axes across layers', blurb: 'An axis means the same thing on every layer but is implemented per layer (lib/layers.mjs): weight is level plus low-pass on the bass and level plus drive on the drums, register is an octave on any pitched layer. A layer with no cell for an axis changes nothing, and the expanded Strudel shows that honestly.', items: [
    { title: 'Weight on the drums', tags: ['weight', 'drums', 'cell'], blurb: 'The same axis the bass card shows, on the kit: gain ×0.6 to ×1.2 and a little drive above the baseline. No octave drop, because drums have no pitch.',
      svg: grid([spectrum(-.3), spectrum(0), spectrum(.65)], ['low: thin', 'baseline', 'high: louder, driven'], { bottom: true }), variants: lbh('drums', 'weight', .2, .9, { density: .7 }) },
    { title: 'Register on the bass', tags: ['register', 'bass', 'cell'], blurb: 'Octave 1, 2 or 3 for the bass line, where the melody card moved between 3, 4 and 5. Same line, same chord roots.', svg: contour, variants: lbh('bass', 'register', .1, .9) },
    { title: 'Space on the drums', tags: ['space', 'drums', 'cell', 'one-sided'], blurb: 'The pad has a dry side below .5; the kit starts dry, so its space cell is one-sided: room and size only grow above the baseline.',
      svg: bands(['baseline: dry', 'roomy', 'huge'], (r, y) => tail([12, 90, 190][r])(r, y)), variants: [{ label: 'Baseline', hll: layer('drums', { density: .7 }) }, { label: 'Roomy', hll: layer('drums', { density: .7, space: .75 }) }, { label: 'Huge', hll: layer('drums', { density: .7, space: 1 }) }] },
    { title: 'Density on the melody', tags: ['density', 'melody', 'cell'], blurb: 'Below .5 the line loses notes (up to 80% of them); above it notes double with rising probability. The drums card added voices, the meaning is the same: how much is happening.',
      svg: grid([[0, 6, 12], [0, 2, 4, 6, 8, 10, 12, 14], [0, 1, 2, 4, 5, 6, 8, 10, 11, 12, 14, 15]], ['low: notes dropped', 'baseline: the line', 'high: notes doubled']), variants: lbh('melody', 'density', .1, .9, { follow: 'true' }) },
    { title: 'Density on the pad', tags: ['density', 'pad', 'cell'], blurb: 'One chord tone, a power chord, a triad or four tones: density on the pad is how thick the voicing is.',
      svg: grid([[0], [0, 4], [0, 2, 4, 6]], ['low: root only', 'baseline: triad', 'high: four tones']), variants: lbh('pad', 'density', .2, .9) },
    { title: 'Register on the drums: no cell', tags: ['register', 'drums', 'cell', 'no-op'], blurb: 'Drums have no register cell, so register .9 is accepted and changes nothing: the two variants are byte-identical. A word carrying a register delta (heavy, bright) is inert on the kit for the same reason.',
      svg: bars([{ name: 'register', segs: [{ from: .5, to: .9 }] }]), variants: [{ label: 'Baseline', hll: layer('drums', { density: .7 }) }, { label: 'register: .9', alias: true, hll: layer('drums', { density: .7, register: .9 }, 4, 'no register cell on drums: identical') }] },
  ] },
  { id: 'descriptors', title: 'Descriptors', blurb: 'A descriptor is a named bundle of axis deltas (lib/descriptors.json), not hidden magic. "Dreamy" on a baseline pad is exactly the numbers it expands to, and the numbers below are computed by the same resolver that edits songs. The picture beside each one is those deltas: a bar per axis from where it was to where the word puts it. A layer without a cell for one of the axes simply ignores that delta.', items: [
    { title: 'Dreamy', tags: ['descriptor', 'pad'], blurb: `dreamy = ${deltasOf('dreamy')}. On the pad: more reverb, slower attack and release, no pulse duck, a touch darker.`, ...ab('pad', 'dreamy') },
    { title: 'Punchy', tags: ['descriptor', 'drums'], blurb: `punchy = ${deltasOf('punchy')}. Short hits, more level, on the beat, drier.`, ...ab('drums', 'punchy', { density: .7 }) },
    { title: 'Massive', tags: ['descriptor', 'pad'], blurb: `massive = ${deltasOf('massive')}. Four chord tones, low voicing, wide and roomy.`, ...ab('pad', 'massive') },
    { title: 'Frantic', tags: ['descriptor', 'drums'], blurb: `frantic = ${deltasOf('frantic')}. Every step, on the pulse, fills, short hits. Eight cycles so the fills land.`, ...ab('drums', 'frantic', {}, 8) },
    { title: 'Delicate', tags: ['descriptor', 'bass'], blurb: `delicate = ${deltasOf('delicate')}. Fewer, quieter, softer notes; aggression cannot go below its baseline, so that delta is inert here.`, ...ab('bass', 'delicate', { density: .7 }) },
    { title: 'Light / heavy', tags: ['descriptor', 'light', 'heavy', 'bass'], blurb: `light = ${deltasOf('light')}; heavy = ${deltasOf('heavy')}. Light thins the bass and drops to two notes a bar; heavy adds body, a little grit and an octave down.`, ...ab('bass', ['light', 'heavy']) },
    { title: 'Dark / bright', tags: ['descriptor', 'dark', 'bright', 'pad'], blurb: `dark = ${deltasOf('dark')}; bright = ${deltasOf('bright')}. The pad's filter closes or opens; the register deltas are too small to change its octave.`, ...ab('pad', ['dark', 'bright']) },
    { title: 'Dry / spacious', tags: ['descriptor', 'dry', 'spacious', 'pad'], blurb: `dry = ${deltasOf('dry')}; spacious = ${deltasOf('spacious')}. Dry takes the room away (the width delta lands below the centred baseline, so it is inert); spacious adds a bigger room and a wider sweep.`, ...ab('pad', ['dry', 'spacious']) },
    { title: 'Busy / sparse', tags: ['descriptor', 'busy', 'sparse', 'drums'], blurb: `busy = ${deltasOf('busy')}; sparse = ${deltasOf('sparse')}. From a kick-snare-hat kit: busy adds every voice, 16th hats and fills; sparse leaves the kick alone. Eight cycles so the fills land.`, ...ab('drums', ['busy', 'sparse'], { density: .5 }, 8) },
    { title: 'Wide / narrow', tags: ['descriptor', 'wide', 'narrow', 'pad'], blurb: `wide = ${deltasOf('wide')}; narrow = ${deltasOf('narrow')}. From a slightly swept pad (width .6): wide crosses .8 and gets the reversed copy on the other side, narrow returns to mono. Headphones.`, ...ab('pad', ['wide', 'narrow'], { width: .6 }) },
    { title: 'Driving / floating', tags: ['descriptor', 'driving', 'floating', 'drums'], blurb: `driving = ${deltasOf('driving')}; floating = ${deltasOf('floating')}. Driving pulls kick and snare onto the pulse and chokes the hats; floating pushes them off the beat into a little room.`, ...ab('drums', ['driving', 'floating'], { density: .7 }) },
    { title: 'Swung / straight', tags: ['descriptor', 'swung', 'straight', 'drums'], blurb: `swung = ${deltasOf('swung')}; straight = ${deltasOf('straight')}. Groove is one-sided, so this starts from a swung kit (groove .7): swung pins it at the maximum, straight lands below .5, which is straight.`, ...ab('drums', ['swung', 'straight'], { density: .8, groove: .7 }) },
    { title: 'Aggressive / smooth', tags: ['descriptor', 'aggressive', 'smooth', 'bass'], blurb: `aggressive = ${deltasOf('aggressive')}; smooth = ${deltasOf('smooth')}. From a gritty, short bass (aggression .7, articulation .6): aggressive squares it off, smooth removes the distortion and lets the notes ring.`, ...ab('bass', ['aggressive', 'smooth'], { aggression: .7, articulation: .6 }) },
    { title: 'Tight', tags: ['descriptor', 'drums'], blurb: `tight = ${deltasOf('tight')}. Shorter hits, less swing, less jitter. The baseline is already straight and mechanical, so this starts from a swung, human kit.`, ...ab('drums', 'tight', { density: .8, groove: .8, organicness: .8 }) },
    { title: 'Loose', tags: ['descriptor', 'drums'], blurb: `loose = ${deltasOf('loose')}. Longer hits, swing, timing and level jitter.`, ...ab('drums', 'loose', { density: .8 }) },
    { title: 'Mechanical', tags: ['descriptor', 'drums'], blurb: `mechanical = ${deltasOf('mechanical')}. Starts from a human, swung kit with fills and takes all three away.`, ...ab('drums', 'mechanical', { density: .7, groove: .8, organicness: .9, variation: .7 }, 8) },
    { title: 'Human', tags: ['descriptor', 'drums'], blurb: `human = ${deltasOf('human')}. Jittered timing and level, a hint of swing.`, ...ab('drums', 'human', { density: .7 }) },
  ] },
  { id: 'overlays', title: 'Overlays', blurb: 'An overlay is a descriptor that spans several layers: an emotion or a genre (lib/overlays.json) rather than one control. It resolves exactly like a descriptor, the same deltas through the same resolver, but it is meant for a whole section, so each card applies it to every layer at once and each layer keeps only the axes it has a cell for.', items: [
    { title: 'Sad', tags: ['overlay', 'sad', 'all layers'], blurb: `sad = ${deltasOf('sad')}. Darker, off the pulse, a little room, longer notes; the register delta is too small to move an octave.`, ...overlay('sad') },
    { title: 'Happy', tags: ['overlay', 'happy', 'all layers'], blurb: `happy = ${deltasOf('happy')}. Brighter, onto the pulse, shorter notes.`, ...overlay('happy') },
    { title: 'Ominous', tags: ['overlay', 'ominous', 'all layers'], blurb: `ominous = ${deltasOf('ominous')}. Dark and low with room and less going on: the bass drops to two notes, the pad to a power chord.`, ...overlay('ominous') },
    { title: 'Euphoric', tags: ['overlay', 'euphoric', 'all layers'], blurb: `euphoric = ${deltasOf('euphoric')}. Bright, full, wide and roomy: every drum voice with 16th hats, doubled melody notes, the pad swept wide.`, ...overlay('euphoric') },
    { title: 'Hypnotic', tags: ['overlay', 'hypnotic', 'all layers'], blurb: `hypnotic = ${deltasOf('hypnotic')}. Variation is one-sided, so that delta is inert from the baseline; what changes is a nudge onto the pulse, the open hat dropping out and a bass with two notes a bar instead of four.`, ...overlay('hypnotic') },
    { title: 'Chaotic', tags: ['overlay', 'chaotic', 'all layers'], blurb: `chaotic = ${deltasOf('chaotic')}. Fills, reversed bars, bass octave jumps, melody bursts, more of everything, a little grit. Eight cycles so the fills land.`, ...overlay('chaotic', 8) },
    { title: 'Playful', tags: ['overlay', 'playful', 'all layers'], blurb: `playful = ${deltasOf('playful')}. Some fills, some swing, a little brighter; the register delta is too small to move an octave.`, ...overlay('playful', 8) },
    { title: 'Cinematic', tags: ['overlay', 'cinematic', 'all layers'], blurb: `cinematic = ${deltasOf('cinematic')}. Big room, wide image, more body, slower notes.`, ...overlay('cinematic') },
  ] },
  { id: 'modifiers', title: 'Modifiers', blurb: `Modifiers scale a descriptor's deltas: ${Object.entries(MODIFIERS).map(([w, k]) => `${w} ×${k}`).join(', ')}. That is the full set. "less" flips the sign before scaling. The change is deterministic: the same words on the same numbers always give the same numbers, clamped to 0..1.`, items: [
    { title: 'Every modifier', tags: ['modifier', 'spacious', 'pad'], blurb: `The whole set on one word, from a dry, narrow pad (space .1, width .3). Synonyms give identical numbers: a little and a bit are slightly, way and a lot are much, and more is ×1, the plain form. Stacked modifiers multiply: "slightly more spacious" is ×0.5 × ×1.`,
      svg: deltaBars(MODS.filter((_, i) => ![1, 2, 7, 8].includes(i)), DRY), explain: 'Per axis, top to bottom: ×0.5, ×0.75, ×1, ×1.5, ×2, ×3. Width only starts to matter once it passes the centred baseline.',
      variants: [{ label: 'Dry pad', hll: layer('pad', DRY) }, ...MODS.map((p, i) => ({ label: p, alias: [1, 2, 7, 8].includes(i) || undefined, hll: layer('pad', said(p, DRY), 4, `"${p}"`) }))] },
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
  { id: 'progressions', title: 'Progression syntax', blurb: 'Beyond the words: a progression string takes b or # before a numeral, m, M or dim after it, 7 or M7 for sevenths, and [..] to put several chords in one bar. Degrees are diatonic to the section key, any Strudel scale name. Each variant label shows the chord names npm run check prints for it, straight from lib/harmony.mjs.', items: [
    { title: 'Accidentals and borrowed chords', tags: ['progression', 'accidental', 'borrowed', 'C major'], blurb: 'b and # move the root a semitone and set the triad from the numeral\'s case; a suffix sets the quality outright. bVI in C major is Ab, #iv is F# minor, IVm the borrowed F minor.',
      svg: chords([['diatonic', 'I IV V I'], ['bVI', 'I bVI V I'], ['#iv', 'I #iv V I'], ['IVm', 'I IVm V I']]),
      variants: [prog('C:major', 'I IV V I', 'C F G C'), prog('C:major', 'I bVI V I', 'C Ab G C'), prog('C:major', 'I #iv V I', 'C F#m G C'), prog('C:major', 'I IVm V I', 'C Fm G C')] },
    { title: 'Case and quality suffixes', tags: ['progression', 'quality', 'C minor'], blurb: 'Case never changes a plain diatonic triad: I IV V I in C minor is still Cm Fm Gm Cm (an alias of i iv v i). To raise the leading tone write VM, to get a diminished chord write dim.',
      svg: chords([['i iv v i', 'i iv v i'], ['VM', 'i iv VM i'], ['viidim', 'i iv viidim i']]),
      variants: [prog('C:minor', 'i iv v i', 'Cm Fm Gm Cm'), prog('C:minor', 'I IV V I', 'Cm Fm Gm Cm', { alias: true }), prog('C:minor', 'i iv VM i', 'Cm Fm G Cm'), prog('C:minor', 'i iv viidim i', 'Cm Fm Bbdim Cm')] },
    { title: 'Sevenths', tags: ['progression', 'seventh', 'C minor'], blurb: 'A 7 makes a four-tone chord and here the case does set the triad: V7 is the dominant seventh in any key, v7 the diatonic minor seventh, VM7 a major seventh. The pad voices all four tones.',
      svg: chords([['triads', 'i iv v i'], ['V7', 'i iv V7 i'], ['v7', 'i iv v7 i'], ['VM7', 'i iv VM7 i']]),
      variants: [prog('C:minor', 'i iv v i', 'Cm Fm Gm Cm'), prog('C:minor', 'i iv V7 i', 'Cm Fm G7 Cm'), prog('C:minor', 'i iv v7 i', 'Cm Fm Gm7 Cm'), prog('C:minor', 'i iv VM7 i', 'Cm Fm Gmaj7 Cm')] },
    { title: 'Several chords in one bar', tags: ['progression', 'bracket', 'C minor'], blurb: 'Brackets put chords inside one cycle: the same four chords take four bars or two, and the bass and pad change twice a bar.',
      svg: chords([['one per bar', 'i VI III VII'], ['two per bar', '[i VI] [III VII]']]),
      variants: [prog('C:minor', 'i VI III VII', 'Cm Ab Eb Bb'), prog('C:minor', '[i VI] [III VII]', '[Cm Ab] [Eb Bb]')] },
    { title: 'Any Strudel scale as the key', tags: ['progression', 'key', 'harmonic minor'], blurb: 'The key is any scale name Strudel knows. Natural minor has a minor v; C:harmonic minor raises the seventh, so the same i iv v i gets a real major V.',
      svg: strip([['C minor', 'minor'], ['C harmonic minor', 'harmonic minor']]), explain: 'Same root, one cell moves: the seventh goes from Bb to B, and the v chord built on G picks it up as its third.',
      variants: [prog('C:minor', 'i iv v i', 'Cm Fm Gm Cm'), prog('C:harmonic minor', 'i iv v i', 'Cm Fm G Cm')] },
    { title: 'The default progression', tags: ['progression', 'default', 'C minor'], blurb: 'A section with no progression gets i VI: the two variants are identical.',
      svg: chords([['default', 'i VI']]),
      variants: [{ label: 'no progression', hll: `song({ cps: .5, key: 'C:minor', seed: 3 }, [section('a', 4, { pad: {}, bass: {} })])` }, prog('C:minor', 'i VI', 'Cm Ab', { alias: true })] },
  ] },
  { id: 'material', title: 'Material', blurb: 'Material is a literal value on a layer, never an axis: a template, a sound, a line of notes, a gain. It has no baseline to move around, so the resolver never touches it; omit it and the layer\'s default stands. Each card is that default against one literal.', items: [
    { title: 'Drum template', tags: ['material', 'drums', 'template'], blurb: 'template is the base grid the axes then thin out, place or fill: house (the default), breaks, minimal or halftime. Density and drive are the same in all four.',
      svg: grid([[0, 3, 6, 10, 12], [0, 8], [0, 10]], ['breaks: kick', 'minimal: kick', 'halftime: kick'], { beats: true }),
      variants: ['house', 'breaks', 'minimal', 'halftime'].map((t) => ({ label: t, hll: layer('drums', { template: `'${t}'`, density: .7 }) })) },
    { title: 'Drum sounds', tags: ['material', 'drums', 'sounds'], blurb: 'sounds swaps one voice at a time; the kit still applies, so rim is the 909 rim and hh:2 its third hat sample.',
      svg: grid([[0, 8], [4, 12].map((i) => ({ i, on: true })), EVENS.map((i) => ({ i, on: true }))], ['bd: the kit voice', "sd: sounds.sd = 'rim'", "hh: sounds.hh = 'hh:2'"], { beats: true }), explain: 'The grid is the same in both variants; only what two of the voices play changes. The accented rows are the swapped ones.',
      variants: [{ label: 'Kit voices', hll: layer('drums', { density: .7 }) }, { label: "sounds: { sd: 'rim', hh: 'hh:2' }", hll: layer('drums', { density: .7, sounds: "{ sd: 'rim', hh: 'hh:2' }" }) }] },
    { title: 'Drum fill', tags: ['material', 'drums', 'fill'], blurb: 'fill: true rolls the snare over the last half bar of the section, rising in level. It is on by default before a climax section (see Song and section metadata); this forces it on a lone layer.',
      svg: grid([EVENS, [...EVENS, ...[8, 9, 10, 11, 12, 13, 14, 15].map((i) => ({ i, on: true, a: .4 + (i - 8) * .08 }))]], ['no fill', 'fill: snare roll over the last half bar, rising']),
      variants: [{ label: 'No fill', hll: layer('drums', { density: .7 }) }, { label: 'fill: true', hll: layer('drums', { density: .7, fill: 'true' }) }] },
    { title: 'Notes', tags: ['material', 'bass', 'melody', 'notes'], blurb: 'notes replaces the seeded line with your own scale degrees (mini-notation). The bass line still transposes by the chord root and the melody still follows; density then thins or doubles what you wrote instead of choosing a line.',
      svg: grid([line(BASS, false, 4), line('0 2 4 5', true, 4), line('0 2 4 7 ~ 4 2 0', true)], [`bass: the seeded ${BASS}`, "bass: notes '0 2 4 5'", "melody: notes '0 2 4 7 ~ 4 2 0'"], { bottom: true }), explain: 'Scale degrees over one bar, height by degree: a bass line has four slots, a melody eight, and ~ is a rest.',
      variants: [{ label: 'Seeded lines', hll: sec4({ bass: {}, melody: { follow: 'true' } }) }, { label: 'bass: notes', hll: sec4({ bass: { notes: "'0 2 4 5'" }, melody: { follow: 'true' } }) }, { label: 'melody: notes', hll: sec4({ bass: {}, melody: { follow: 'true', notes: "'0 2 4 7 ~ 4 2 0'" } }) }] },
    { title: 'Melody phrase', tags: ['material', 'melody', 'phrase'], blurb: 'phrase is how many bars the seeded line spans before it repeats: 1 by default, so a 2 or 4 gives a longer line from the same seed. The progression still advances every bar. Eight cycles so the long phrases repeat once.',
      svg: phrases(3, [1, 2, 4]), explain: 'Four bars of the line seed 3 generates at each phrase length, drawn by the generator itself: the first pass in accent, its repeats pale. phrase 4 never repeats within the four bars.',
      variants: [{ label: 'phrase: 1 (default)', hll: layer('melody', { follow: 'true' }, 8) }, { label: 'phrase: 2', hll: layer('melody', { follow: 'true', phrase: 2 }, 8) }, { label: 'phrase: 4', hll: layer('melody', { follow: 'true', phrase: 4 }, 8) }] },
    { title: 'Pad chord', tags: ['material', 'pad', 'chord'], blurb: 'chord pins the pad to a scale degree (a number or a mini-notation of degrees) instead of the progression; the bass keeps following the progression. Here the default progression is i VI.',
      svg: chords([['progression', 'i VI'], ['chord: 0', 'i i'], ['chord: &lt;0 3 4 3&gt;', 'i iv v iv']]),
      variants: [{ label: 'Follows the progression', hll: layer('pad', {}) }, { label: 'chord: 0', hll: layer('pad', { chord: 0 }) }, { label: "chord: '<0 3 4 3>'", hll: layer('pad', { chord: "'<0 3 4 3>'" }) }] },
    { title: 'Pad arp', tags: ['material', 'pad', 'arp'], blurb: 'arp plays the chord one tone at a time in 8ths: up, down, updown, or an index pattern into the chord tones ("0 2 1 2" is root, fifth, third, fifth).',
      svg: grid([[0, 2, 4, 6, 8, 10, 12, 14].map((i, k) => ({ i, a: [.4, .7, 1][k % 3] })), [0, 2, 4, 6, 8, 10, 12, 14].map((i, k) => ({ i, a: [1, .7, .4][k % 3] })), [0, 2, 4, 6, 8, 10, 12, 14].map((i, k) => ({ i, a: [.4, .7, 1, .7][k % 4] }))], ['up', 'down', 'updown'], { bottom: true }),
      variants: [{ label: 'Block chord', hll: layer('pad', {}) }, ...['up', 'down', 'updown'].map((a) => ({ label: `arp: '${a}'`, hll: layer('pad', { arp: `'${a}'` }) })), { label: 'arp: "0 2 1 2"', hll: layer('pad', { arp: '"0 2 1 2"' }) }] },
    { title: 'Sound', tags: ['material', 'sound', 'bass', 'melody', 'pad'], blurb: 'sound replaces the default sawtooth on any melodic layer with a synth or a sample name from the loaded packs; the axes still shape it. The melody and pad add a little vibrato to a synth only, so a sampled piano or bell plays as recorded.',
      svg: waves([['sawtooth: default', (t) => (t % 1) * 2 - 1], ['square', (t) => (t % 1 < .5 ? 1 : -1)], ['triangle', (t) => 1 - 4 * Math.abs(((t + .25) % 1) - .5)], ['piano: a sample', (t) => Math.sin(t * Math.PI * 8) * Math.exp(-t * 1.1)]]), explain: 'The three synths are raw waveforms, each with its own harmonics; a sample is a recording, so it has an attack and a decay of its own before any axis touches it.',
      variants: [{ label: 'bass: sawtooth (default)', hll: layer('bass', {}) }, { label: "bass: sound: 'square'", hll: layer('bass', { sound: "'square'" }) }, { label: "melody: sound: 'triangle'", hll: layer('melody', { sound: "'triangle'" }) }, { label: "pad: sound: 'piano'", hll: layer('pad', { sound: "'piano'" }) }] },
    { title: 'Sound per hit', tags: ['material', 'sound', 'list', 'melody', 'drums'], blurb: 'sound as a list plays one of the names per hit, picked by a hash of the hit\'s time, so the choice is fixed for every play and every host; as { name: weight } the pick is weighted; as a double-quoted "<a b>" it alternates per bar. Drum voices take the same forms in sounds. One part where hunted needed four.',
      svg: grid([EVENS, EVENS.map((i, k) => ({ i, on: k % 3 === 1 })), EVENS.map((i, k) => ({ i, on: k >= 4 }))], ["one sound", "['piano', 'kalimba']: a pick per hit", '"<piano kalimba>": per bar']), explain: 'The same eight hits. The accented ones play the second name: scattered when the list picks per hit, the whole second bar when the mini string alternates.',
      variants: [{ label: "sound: 'piano'", hll: layer('melody', { follow: 'true', notes: "'0 2 3 5 4 3 2 0'", sound: "'piano'" }) }, { label: "['piano', 'kalimba', 'marimba']", hll: layer('melody', { follow: 'true', notes: "'0 2 3 5 4 3 2 0'", sound: "['piano', 'kalimba', 'marimba']" }) }, { label: '{ piano: 3, kalimba: 1 }', hll: layer('melody', { follow: 'true', notes: "'0 2 3 5 4 3 2 0'", sound: '{ piano: 3, kalimba: 1 }' }) }, { label: '"<piano kalimba>"', hll: layer('melody', { follow: 'true', notes: "'0 2 3 5 4 3 2 0'", sound: '"<piano kalimba>"' }) }] },
    { title: 'Drum voice takes', tags: ['material', 'drums', 'sounds', 'list'], blurb: 'sounds.sd as a list: the snare is the kit snare, the rim or the clap per hit. The kit still applies because every name is a voice the kit has.',
      svg: grid([[4, 12], [4, 12].map((i) => ({ i, on: i === 12 }))], ['sd', "sd: ['sd', 'rim', 'cp']"], { beats: true }),
      variants: [{ label: 'Kit snare', hll: layer('drums', { density: .7 }, 8) }, { label: "sounds: { sd: ['sd', 'rim', 'cp'] }", hll: layer('drums', { density: .7, sounds: "{ sd: ['sd', 'rim', 'cp'] }" }, 8) }] },
    { title: 'Sample takes', tags: ['material', 'sample', 'list', 'definition'], blurb: 'On a sample part a list is a list of definitions, each keeping its own region; bars and the slice count must agree (write them on the part when they do not). Kick or snare per hit, from the two demo definitions.',
      svg: sliced(0, .1875, [0, .0625, .125, .1875], [0, 2], "['loop-kick', 'loop-snare']"),
      variants: [{ label: 'loop-kick', hll: sp(`sample: { sound: 'loop-kick', pattern: '<0 ~>' }`, 4, 'the pattern spans an eighth of a bar: <0 ~> is a hit every quarter') }, { label: "['loop-kick', 'loop-snare']", hll: sp(`sample: { sound: ['loop-kick', 'loop-snare'], pattern: '<0 ~>' }`, 4, 'a take per hit') }] },
    { title: 'Level', tags: ['material', 'level', 'drums'], blurb: 'level is a plain gain multiplier applied after every axis, 1 meaning untouched (that variant is identical to the baseline). Use it to balance layers; weight is the axis that changes how they sound.',
      svg: grid([EVENS.map((i) => ({ i, a: .33 })), EVENS.map((i) => ({ i, a: .67 })), EVENS.map((i) => ({ i, a: 1 }))], ['level: .5', 'level: 1, untouched', 'level: 1.5'], { bottom: true }), explain: 'The same hits at three gains. Nothing moves and nothing changes tone; the bars are just shorter or taller.',
      variants: [{ label: 'Baseline', hll: layer('drums', { density: .7 }) }, { label: 'level: 1', alias: true, hll: layer('drums', { density: .7, level: 1 }) }, { label: 'level: .5', hll: layer('drums', { density: .7, level: .5 }) }, { label: 'level: 1.5', hll: layer('drums', { density: .7, level: 1.5 }) }] },
    { title: 'Second parts', tags: ['material', 'melody2', 'pad2', 'drums2', 'counter-line'], blurb: 'A section key with a trailing number is a second part built by the layer the key names without it: melody2 is another melody, pad2 another pad, drums2 another kit. Each has its own material and axes, so a counter-line sits next to the line instead of replacing it. Here a glockenspiel answers the piano an octave up, at half level.',
      svg: grid([line(THEME), line(COUNTER, true)], ['melody: piano', 'melody2: glockenspiel, higher and sparser'], { bottom: true }), explain: 'Both parts over one bar, height by pitch. The counter-line has three notes against the theme\'s six, all above it, and its register puts them an octave higher still.',
      variants: [{ label: 'One melody', hll: sec4({ bass: {}, melody: { follow: 'true', sound: "'piano'", notes: `'${THEME}'` } }) }, { label: 'melody2: a counter-line', hll: sec4({ bass: {}, melody: { follow: 'true', sound: "'piano'", notes: `'${THEME}'` }, melody2: { follow: 'true', sound: "'glockenspiel'", notes: `'${COUNTER}'`, register: .8, level: .5 } }) }] },
    { title: 'Seed per part', tags: ['material', 'seed', 'melody'], blurb: 'The song\'s seed picks every generated line. A melody without notes can carry its own seed and get a different line from the same song; the song\'s own value is the default, so writing it changes nothing (identical variants). A signal or expression is refused: the seed must be a number.',
      svg: grid([line(melodyLine(3)), line(melodyLine(9), true)], [`seed 3: ${melodyLine(3)}`, `seed 9: ${melodyLine(9)}`], { bottom: true }), explain: 'The two lines the generator writes for those seeds, drawn by the same function the song calls: root first, stepwise with a leap, holds and rests, back to the root.',
      variants: [{ label: 'Song seed (3)', hll: sec4({ bass: {}, melody: { follow: 'true' } }) }, { label: 'melody: seed: 3', alias: true, hll: sec4({ bass: {}, melody: { follow: 'true', seed: 3 } }) }, { label: 'melody: seed: 9', hll: sec4({ bass: {}, melody: { follow: 'true', seed: 9 } }) }] },
    { title: 'Sample packs', tags: ['material', 'packs', 'sound', 'melody'], blurb: 'A folder under samples/user/ is a pack: a loose audio file is a one-shot sound, a subfolder a sound with variants. A song declares what it uses with packs: [...] on the song, so the checker refuses an undeclared pack sound and the page badge says whether each pack is deployed, local or missing. A pack ships to the static site only when its pack.json says deploy and names a license; a song declaring a pack that does not ship is dropped from the build rather than playing silence. ping.strudel and demo-pack are the shipped example: the melody\'s sound is the pack\'s one file.',
      svg: tree, explain: 'What the checker and the build read: the folder name is the pack, the file name is the sound, pack.json says whether it ships, and the song names the pack it needs.',
      variants: [{ label: 'ping.strudel', src: 'songs/ping.strudel' }] },
  ] },
  { id: 'samples', title: 'Samples', blurb: 'A sample part plays a region of any loaded file as slices. begin and end are fractions of the file, bars is what that region stands for at the section tempo, slices cuts it (a count, or a list of break points), pattern orders the slices in mini-notation over those bars, and stretch fits each slice to its step. A pack can name a definition of all that in its pack.json, so a song says sound: \'loop\' and gets the region for free. Every card here plays the demo pack\'s generated two-bar loop.', items: [
    { title: 'A sample part', tags: ['sample', 'sound', 'pattern', 'material'], blurb: 'The loop as recorded is every slice in order; a pattern re-orders them. The pack defines loop as two bars in eight slices, so the first variant writes nothing but the name.',
      svg: sliced(0, 1, [0, .125, .25, .375, .5, .625, .75, .875, 1], [0, 1, 2, 3, 4, 5, 6, 7], 'loop: 2 bars, 8 slices'), explain: 'The file, the region it plays (all of it), a line per slice, and the slices the pattern uses. Play spans the sample\'s bars, not the section\'s: eight tokens over two bars is one slice per half beat.',
      variants: [{ label: 'As recorded', hll: sp(`sample: { sound: 'loop' }`) }, { label: 'bars 2, slices 8 written out', alias: true, hll: sp(`sample: { sound: 'loop', bars: 2, slices: 8, pattern: '0 1 2 3 4 5 6 7' }`, 4, 'the same as the definition') }, { label: "pattern: '0 1 0 3 4 [6 7] 7 6'", hll: sp(`sample: { sound: 'loop', pattern: '0 1 0 3 4 [6 7] 7 6' }`) }] },
    { title: 'The region', tags: ['sample', 'begin', 'end', 'bars'], blurb: 'begin and end trim the file; bars says how long that piece is, which sets its playback speed (speed = cps × region / bars). The second bar of the loop alone, quartered, at one bar.',
      svg: sliced(.5, 1, [.5, .625, .75, .875, 1], [0, 1, 2, 3], 'begin .5, end 1, bars 1, slices 4'),
      variants: [{ label: 'Whole file', hll: sp(`sample: { sound: 'loop' }`) }, { label: 'begin: .5, bars: 1, slices: 4', hll: sp(`sample: { sound: 'loop', begin: .5, end: 1, bars: 1, slices: 4 }`) }, { label: 'the same region, twice as slow', hll: sp(`sample: { sound: 'loop', begin: .5, end: 1, bars: 2, slices: 4 }`, 4, 'bars 2: half speed, an octave down') }] },
    { title: 'Break points', tags: ['sample', 'slices', 'break points'], blurb: 'slices as a list is break points, fractions of the file inside the region, so a slice can be exactly one hit. The loop is two bars, a sixteenth of it is one eighth note: .0625 ends the first kick, .125..1875 is the first snare.',
      svg: sliced(0, 1, [0, .0625, .125, .1875, .5, 1], [0, 2, 3, 4], 'slices: [.0625, .125, .1875, .5]'),
      variants: [{ label: 'Even slices', hll: sp(`sample: { sound: 'loop', slices: 8, pattern: '0 ~ 2 ~ 0 0 2 [3 4]' }`) }, { label: 'Break points', hll: sp(`sample: { sound: 'loop', slices: [.0625, .125, .1875, .5], pattern: '0 ~ 2 ~ 0 0 2 [3 4]' }`, 4, 'slice 0 the kick, 2 the snare') }] },
    { title: 'Stretch', tags: ['sample', 'stretch', 'speed'], blurb: 'Without stretch a slice keeps its own length at the fitted speed, so a slice on a short step overlaps the next. stretch: true fits each slice to its step by changing its speed, which also changes its pitch: timing locked, pitch not.',
      svg: bands(['natural: each slice its own length', 'stretch: each slice fits its step'], (r, y) => [0, 1, 2, 3].map((k) => `<rect x="${8 + k * 51}" y="${y}" width="${r ? [48, 22, 22, 48][k] : 48}" height="26" rx="2" fill="${k % 2 ? LO : HI}" opacity="${r ? 1 : [1, .6, .6, 1][k]}" />`).join(''), true),
      variants: [{ label: 'Natural', hll: sp(`sample: { sound: 'loop', pattern: '0 1 [2 3] [4 5] 6 7' }`) }, { label: 'stretch: true', hll: sp(`sample: { sound: 'loop', pattern: '0 1 [2 3] [4 5] 6 7', stretch: true }`) }] },
    { title: 'Named definitions', tags: ['sample', 'pack.json', 'definition'], blurb: 'samples/user/demo-pack/pack.json defines loop, loop-kick (the first sixteenth of the file, an eighth of a bar) and loop-snare. A part names one and can override any key; the checker prints the pack sound the events carry.',
      svg: tree, explain: 'The definition lives in the pack, next to the file, so every song that declares the pack shares it. The materials row on Compose shows a definition\'s keys greyed under the part\'s own; samples.html is where they are edited.',
      variants: [{ label: "sound: 'loop-kick'", hll: sp(`sample: { sound: 'loop-kick' }`, 4, 'bars .125: a kick every eighth of a bar') }, { label: "sound: 'loop-snare'", hll: sp(`sample: { sound: 'loop-snare' }`) }, { label: 'loop-kick, bars overridden', hll: sp(`sample: { sound: 'loop-kick', bars: .25 }`, 4, 'the part\'s key wins: slower, lower') }] },
    { title: 'A kit out of one loop', tags: ['sample', 'sample2', 'definition', 'second parts'], blurb: 'Two sample parts on two definitions of the same file: the kick definition on beats one and three, the snare on two and four. The pattern spans the definition\'s bars (an eighth of a bar), so a plain 0 would repeat eight times a bar; the angle brackets step one token per pass, and <0 ~ ~ ~> is a kick every half bar.',
      svg: grid([[0, 8], [4, 12].map((i) => ({ i, on: true }))], ['sample: loop-kick', 'sample2: loop-snare'], { beats: true }),
      variants: [{ label: 'Kick only', hll: sp(`sample: { sound: 'loop-kick', pattern: '<0 ~ ~ ~>' }`) }, { label: 'Kick and snare', hll: sp(`sample: { sound: 'loop-kick', pattern: '<0 ~ ~ ~>' }, sample2: { sound: 'loop-snare', pattern: '<~ ~ ~ ~ 0 ~ ~ ~>' }`) }] },
    { title: 'Where definitions are made', tags: ['sample', 'samples.html', 'waveform', 'workshop'], blurb: 'chop.strudel is the worked example: one section per way of cutting the loop. On Compose the materials row draws the waveform, drags the trim and the break points, snaps to a detected beat grid and auditions a slice; the local-only samples.html page edits and saves the definitions themselves into the pack.', svg: sliced(0, 1, [0, .0625, .125, .1875, .5, 1], [0, 2], 'chop.strudel, section breaks'),
      variants: [{ label: 'chop.strudel', src: 'songs/chop.strudel' }] },
  ] },
  { id: 'rhythm', title: 'Rhythm you write', blurb: 'A grid string is the one rhythm notation: x hit, X accent, o ghost, . rest, | between bars, or p/s for p euclidean hits over s slots (p/s+r rotates). Drums take one per voice as template: { ... } (any voice name; the five kit voices stay density-gated, others always play), the bass takes rhythm, and the perc part is one bare sound on a rhythm. raw is the escape hatch: a plain Strudel pattern inside a section.', items: [
    { title: 'A written drum template', tags: ['rhythm', 'drums', 'template', 'grid'], blurb: 'The house template as an object, then the same with an accented backbeat and a ghost kick. Accents are gain ×1.25, ghosts ×.4; the axes still apply on top.',
      svg: grid([[0, 4, 8, 12], [0, { i: 4, on: true }, 8, { i: 12, on: true }], [0, { i: 4, on: true }, { i: 7, a: .4 }, 8, { i: 12, on: true }]], ['x...x...x...x...', 'X on 2 and 4', 'o: a ghost before 3'], { beats: true }),
      variants: [{ label: "template: 'house'", hll: layer('drums', { template: "'house'", density: .7 }) }, { label: 'written out', alias: true, hll: layer('drums', { template: `{ bd: 'x...x...x...x...', sd: '....x.......x...', hh: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.', cp: '....x.......x...' }`, density: .7 }, 4, 'the same grids') }, { label: 'accents and a ghost', hll: layer('drums', { template: `{ bd: 'x......ox...x...', sd: '....X.......X...', hh: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.', cp: '....x.......x...' }`, density: .7 }) }] },
    { title: 'Euclid and rotation', tags: ['rhythm', 'euclid', 'drums'], blurb: "'3/8' spreads three hits over eight slots of the bar as evenly as possible (the tresillo); '+1' rotates it. A voice written this way is still placed by drive.",
      svg: grid([[0, 6, 12], [4, 10, 14], [0, 3, 6, 9, 12]], ["bd: '3/8'", "bd: '3/8+1'", "bd: '5/16'"], { beats: true }),
      variants: ["'3/8'", "'3/8+1'", "'5/16'"].map((e) => ({ label: `bd: ${e}`, hll: layer('drums', { template: `{ bd: ${e}, hh: 'x.x.x.x.x.x.x.x.' }`, density: .7 }) })) },
    { title: 'Voices the kit has', tags: ['rhythm', 'drums', 'ride', 'rim'], blurb: 'A written template may name any voice: rd, rim, cb, lt. The five density voices are gated by density as always; a written extra voice always plays, so a ride survives a sparse section.',
      svg: grid([[0, 4, 8, 12], EVENS.map((i) => ({ i, on: true })), [7, 15].map((i) => ({ i, a: .4 }))], ['bd', 'rd: 8ths', 'rim: ghosts'], { beats: true }),
      variants: [{ label: 'Kit voices only', hll: layer('drums', { density: .4 }) }, { label: 'rd and rim added', hll: layer('drums', { template: `{ bd: 'x...x...x...x...', sd: '....x.......x...', hh: 'x.x.x.x.x.x.x.x.', rd: 'x.x.x.x.x.x.x.x.', rim: '.......o.......o' }`, density: .4 }, 4, 'density .4: no hats, but the ride is written') }] },
    { title: 'Two bars with |', tags: ['rhythm', 'drums', 'bars', 'phrase'], blurb: 'A | in a grid separates bars: the second bar of the snare answers the first. That is the changed last bar of a phrase, written where it happens.',
      svg: grid([[4, 12], [4, 12, { i: 14, on: true }, { i: 15, on: true }]], ['bar 1', 'bar 2: a pickup at the end'], { beats: true }),
      variants: [{ label: 'One bar', hll: layer('drums', { template: `{ bd: 'x...x...x...x...', sd: '....x.......x...', hh: 'x.x.x.x.x.x.x.x.' }`, density: .7 }, 8) }, { label: 'sd over two bars', hll: layer('drums', { template: `{ bd: 'x...x...x...x...', sd: '....x.......x...|....x.......x.xx', hh: 'x.x.x.x.x.x.x.x.' }`, density: .7 }, 8) }] },
    { title: 'Fill every n bars', tags: ['rhythm', 'drums', 'fill'], blurb: 'fill: 2 rolls the snare over the last half of every second bar; true is only the section end. Four bars so it lands twice.',
      svg: timeline([['1', 1, .5], ['2', 1, .9, true], ['3', 1, .5], ['4', 1, .9, true]], 'fill: 2'),
      variants: [{ label: 'No fill', hll: layer('drums', { density: .7 }, 4) }, { label: 'fill: 2', hll: layer('drums', { density: .7, fill: 2 }, 4) }, { label: 'fill: true', hll: layer('drums', { density: .7, fill: 'true' }, 4) }] },
    { title: 'Bass rhythm', tags: ['rhythm', 'bass', 'grid'], blurb: 'rhythm on the bass replaces the density grid with a written one; notes still gives the pitches and drive still places the hits. Accents and ghosts work here too.',
      svg: grid([[0, 4, 8, 12], [0, 3, 6, 10, 12], [{ i: 0, on: true }, 3, { i: 6, a: .4 }, 10, 12]], ['density grid', "rhythm: 'x..x..x...x.x...'", "'X..x..o...x.x...'"], { beats: true }),
      variants: [{ label: 'Density grid', hll: layer('bass', { notes: "'0 0 4 3'" }) }, { label: "rhythm: 'x..x..x...x.x...'", hll: layer('bass', { notes: "'0 0 4 3 0'", rhythm: "'x..x..x...x.x...'" }) }, { label: 'accents', hll: layer('bass', { notes: "'0 0 4 3 0'", rhythm: "'X..x..o...x.x...'" }) }] },
    { title: 'A perc part', tags: ['rhythm', 'perc', 'sound'], blurb: 'perc is one bare sound (no kit: a pack name, or a kit voice written in full) on a rhythm, with the drum cells for one voice. Density thins the written hits below .5 and adds off-pulse hits above it.',
      svg: grid([[0, 6, 12], [0], [0, 2, 6, 10, 12, 14]], ["'3/8'", 'density .2', 'density .9'], { beats: true }),
      variants: [{ label: "perc: { sound: 'RolandTR909_rim', rhythm: '3/8' }", hll: sec4({ drums: { density: .6 }, perc: { sound: "'RolandTR909_rim'", rhythm: "'3/8'" } }) }, { label: 'density .2', hll: sec4({ drums: { density: .6 }, perc: { sound: "'RolandTR909_rim'", rhythm: "'3/8'", density: .2 } }) }, { label: 'density .9', hll: sec4({ drums: { density: .6 }, perc: { sound: "'RolandTR909_rim'", rhythm: "'3/8'", density: .9 } }) }] },
    { title: 'A raw part', tags: ['rhythm', 'raw', 'strudel', 'texture'], blurb: 'raw takes a plain Strudel pattern as its material, so a texture lives in the section with the parts instead of in a stack() around the song: mute, solo, pin, the check table and the dump all see it. brightness, space, weight and width act on it; level too.',
      svg: bands(['metal:2 ticks', 'hiss'], (r, y) => (r ? `<rect x="8" y="${y + 8}" width="203" height="10" fill="${LO}" />` : [0, 2, 3, 5, 7].map((i) => `<rect x="${8 + i * 26}" y="${y}" width="6" height="26" fill="${HI}" />`).join('')), true),
      variants: [{ label: 'Parts only', hll: sec4({ drums: { density: .6 }, bass: {} }) }, { label: 'raw: ticks and hiss', hll: `${SONG}\n  section('a', 4, { drums: { density: .6 }, bass: {},\n    raw: { pattern: s("metal:2").struct("x ~ x x ~ x ~ x").lpf(1800).clip(.3), level: .45, width: .7 },\n    raw2: { pattern: s("pink").clip(1), level: .12, brightness: .8 } }),\n])` }] },
  ] },
  { id: 'fx', title: 'FX layer', blurb: 'The fx layer is transition material: a noise riser into the next section and an impact on this one\'s downbeat. It carries three axes (brightness, space, weight) and is silent unless you give it a riser or an impact. Every card is a build into a drop.', items: [
    { title: 'Riser', tags: ['fx', 'riser', 'sections'], blurb: 'riser: true sweeps filtered noise up over the last four bars of its section; a number is the bar count. The build is four bars, so true covers all of it and 2 only its second half.',
      svg: timeline([['build', 4, .5, true, [.1, 1]], ['drop', 4, .9]], 'fx riser in the build'),
      variants: [{ label: 'No fx', hll: s2(BUILD(), DROP()) }, { label: 'riser: true', hll: s2(BUILD({ riser: 'true' }), DROP()) }, { label: 'riser: 2', hll: s2(BUILD({ riser: 2 }), DROP()) }] },
    { title: 'Impact', tags: ['fx', 'impact', 'sections'], blurb: 'impact: true drops one bd on the section\'s first downbeat at half speed in a big room; a sound name uses that instead.',
      svg: timeline([['build', 4, .5], ['drop', 4, .9, true]], 'fx impact on the drop\'s downbeat'),
      variants: [{ label: 'No fx', hll: s2(BUILD(), DROP()) }, { label: 'impact: true', hll: s2(BUILD(), DROP({ impact: 'true' })) }, { label: "impact: 'metal'", hll: s2(BUILD(), DROP({ impact: "'metal'" })) }] },
    { title: 'Brightness on the fx', tags: ['fx', 'brightness'], blurb: 'The riser\'s filter sweep is scaled by ×0.25 to ×2.5: a dark riser stays a rumble, a bright one opens to hiss.', svg: lowpass, variants: lbh('fx', 'brightness', .1, .9, { riser: 'true' }) },
    { title: 'Space on the fx', tags: ['fx', 'space'], blurb: 'Room and size on the riser, from dry to washed out.', svg: bands(['low: dry', 'baseline', 'high: long tail'], (r, y) => tail([12, 60, 190][r])(r, y)), variants: lbh('fx', 'space', .1, .95, { riser: 'true' }) },
    { title: 'Weight on the fx', tags: ['fx', 'weight'], blurb: 'Level of the riser, ×0.5 to ×1.5: how much the sweep dominates the mix as it arrives.', svg: grid([spectrum(-.3), spectrum(0), spectrum(.65)], ['low', 'baseline', 'high'], { bottom: true }), variants: lbh('fx', 'weight', .1, .9, { riser: 'true' }) },
  ] },
  { id: 'metadata', title: 'Song and section metadata', blurb: 'Keys on song() and section() that are neither axes nor layer material: kit, meter, bpm or cps, and role. Whatever they say, one bar is still one cycle.', items: [
    { title: 'Kit', tags: ['metadata', 'kit', 'drums'], blurb: 'kit on the song names the drum machine every section uses; a section can override it. Here the song is an 808 and section b switches to the 909.',
      svg: kits([['kit on the song only', 'RolandTR808', 'RolandTR808'], ["b: kit: 'RolandTR909'", 'RolandTR808', 'RolandTR909']]), explain: 'Each block is a section with the icon of the kit it plays (the same icons as the kit menu). The song\'s kit reaches every section unless one names its own.',
      variants: [{ label: 'Song kit only', hll: `song({ cps: .5, key: 'C:minor', seed: 3, kit: 'RolandTR808' }, [\n  section('a', 4, { drums: { density: .7 } }),\n  section('b', 4, { drums: { density: .7 } }),\n])` }, { label: "b: kit: 'RolandTR909'", hll: `song({ cps: .5, key: 'C:minor', seed: 3, kit: 'RolandTR808' }, [\n  section('a', 4, { drums: { density: .7 } }),\n  section('b', 4, { kit: 'RolandTR909', drums: { density: .7 } }),\n])` }] },
    { title: 'Meter', tags: ['metadata', 'meter', 'drums', 'bass'], blurb: 'meter sets the grid: 3/4 is 12 sixteenths a bar, 6/8 twelve with a pulse every two, 7/8 fourteen, 5/4 twenty. A bar is still one cycle, so with cps fixed every bar lasts the same two seconds and the beats get faster or slower; with bpm the beat stays put instead.',
      svg: meters(['4/4', '3/4', '6/8', '7/8', '5/4']), explain: 'One bar of each meter as its sixteenths, every bar the same width because a bar is one cycle. The downbeat is accented and the beats are mid-toned: 6/8 and 7/8 count in eighths, so their pulses are two sixteenths apart.',
      variants: ['4/4', '3/4', '6/8', '7/8', '5/4'].map((m) => ({ label: m, hll: `song({ cps: .5, key: 'C:minor', seed: 3, meter: '${m}' }, [section('a', 4, { drums: { density: .7 }, bass: {} })])` })) },
    { title: 'bpm instead of cps', tags: ['metadata', 'bpm', 'cps'], blurb: 'bpm is beats per minute on the meter\'s denominator: in 4/4, 120 bpm is four beats a bar at two seconds a bar, exactly cps .5 (identical variants). Give one or the other, not both. Tempo is only the clock, so any other bpm plays the same events faster or slower; to hear a tempo change inside a song, see Per-section tempo.',
      svg: tempo, explain: 'Both rows are the same two seconds: the cycle above, the four beats it holds below, one playhead over both.',
      variants: [{ label: 'cps: .5', hll: `song({ cps: .5, key: 'C:minor', seed: 3 }, [section('a', 4, { drums: { density: .7 }, bass: {} })])` }, { label: 'bpm: 120', alias: true, hll: `song({ bpm: 120, key: 'C:minor', seed: 3 }, [section('a', 4, { drums: { density: .7 }, bass: {} })])` }] },
    { title: 'Per-section tempo', tags: ['metadata', 'bpm', 'cps', 'sections'], blurb: 'A section can carry its own bpm or cps. Its bars are still cycles of its own; the song just spends less or more time on them.',
      svg: timeline([['a', 4, .5], ['b', 3, .7, true]], 'b at its own tempo: same bars, less time'),
      variants: [{ label: 'One tempo', hll: s2(`section('a', 4, { drums: { density: .7 }, bass: {} })`, `section('b', 4, { drums: { density: .7 }, bass: {} })`) }, { label: 'b: bpm: 160', hll: s2(`section('a', 4, { drums: { density: .7 }, bass: {} })`, `section('b', 4, { bpm: 160, drums: { density: .7 }, bass: {} })`) }, { label: 'b: cps: .75', hll: s2(`section('a', 4, { drums: { density: .7 }, bass: {} })`, `section('b', 4, { cps: .75, drums: { density: .7 }, bass: {} })`) }] },
    { title: 'Role', tags: ['metadata', 'role', 'fill', 'drums'], blurb: 'role names what a section is for. Its one automatic effect: the section before a climax gets a drum fill. Nothing else reads it, so a climax with fill: false on the section before is identical to no role at all.',
      svg: timeline([['a', 4, .5, true], ['climax', 4, .9]], 'role: climax on b, so a fills into it'),
      variants: [{ label: "b: role: 'climax'", hll: s2(`section('a', 4, { drums: { density: .7 } })`, `section('b', 4, { role: 'climax', drums: { density: .9 } })`) }, { label: 'No role', hll: s2(`section('a', 4, { drums: { density: .7 } })`, `section('b', 4, { drums: { density: .9 } })`) }, { label: 'climax, a: fill: false', alias: true, hll: s2(`section('a', 4, { drums: { density: .7, fill: false } })`, `section('b', 4, { role: 'climax', drums: { density: .9 } })`) }] },
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
    { title: 'Reuse a section with spread', tags: ['section', 'reuse', 'spread'], blurb: 'Sections are JavaScript: keep one in a const and spread it, overriding a layer\'s axes with a nested spread. The spread variant is identical to writing the section twice. The resolver refuses to edit a spread layer (it cannot see the baseline it would be editing), so set those axes by hand.',
      svg: timeline([['verse', 4, .5], ['verse2', 4, .5, true]], 'verse2 = { ...verse, drums: { ...verse.drums, variation: .7 } }'),
      variants: [
        { label: 'Written twice', hll: `${SONG}\n  section('verse', 4, { drums: { density: .6 }, bass: {}, melody: { follow: true }, pad: {} }),\n  section('verse2', 4, { drums: { density: .6 }, bass: {}, melody: { follow: true }, pad: {} }),\n])` },
        { label: 'Spread', alias: true, hll: `${VERSE}\n${SONG}\n  section('verse', 4, verse),\n  section('verse2', 4, verse),\n])` },
        { label: 'Spread with an override', hll: `${VERSE}\n${SONG}\n  section('verse', 4, verse),\n  section('verse2', 4, { ...verse, drums: { ...verse.drums, variation: .7 } }), // the resolver will not edit this layer\n])` },
      ] },
  ] },
  { id: 'trajectories', title: 'Trajectories', blurb: 'A continuous axis can take a signal instead of a number. ramp(a, b) is a saw that spans exactly the section it sits in; any Strudel signal (saw, sine, perlin…) works too. Structural axes (density, drive, variation, register) take numbers only. Open the expanded Strudel to see the signal mapped through the same control the constant would use.', items: [
    { title: 'Brightness rising through a section', tags: ['trajectory', 'brightness', 'pad', 'signal'], blurb: 'The pad opens from dark to bright over eight cycles. ramp(.1, .9) and the explicit saw are the same thing; ramp just knows the section length.',
      svg: rampSvg(.1, .9, 'brightness: ramp(.1, .9), one section'), explain: 'A constant sits on one horizontal line for the whole section. A ramp draws the diagonal instead: the value the control sees keeps moving.',
      variants: [{ label: 'Constant', hll: layer('pad', '{ brightness: .5 }', 8) }, { label: 'ramp(.1, .9)', hll: layer('pad', '{ brightness: ramp(.1, .9) }', 8) }, { label: 'saw.range(.1, .9).slow(8)', alias: true, hll: layer('pad', '{ brightness: saw.range(.1, .9).slow(8) }', 8) }] },
    { title: 'Sine and perlin', tags: ['trajectory', 'brightness', 'pad', 'signal', 'sine', 'perlin'], blurb: 'Any Strudel signal works where a number would: a sine breathes the pad\'s filter open and closed every four bars, perlin wanders it. Each chord samples the signal where it starts, so a slow signal reads as a value per bar.',
      svg: svg(`<line x1="8" y1="67" x2="211" y2="67" stroke="#c9c9c9" stroke-dasharray="3 3" />` + `<path d="M8,67 ${Array.from({ length: 34 }, (_, i) => `L${8 + i * 6},${(67 - 45 * Math.sin(i / 33 * Math.PI * 4)).toFixed(1)}`).join(' ')}" fill="none" stroke="${HI}" stroke-width="2" />` + txt(8, 14, 'brightness: sine.range(.2, .9).slow(4)') + txt(150, 63, 'baseline .5')),
      variants: [{ label: 'Constant', hll: layer('pad', '{ brightness: .5 }', 8) }, { label: 'sine.range(.2, .9).slow(4)', hll: layer('pad', '{ brightness: sine.range(.2, .9).slow(4) }', 8) }, { label: 'perlin.range(.2, .9)', hll: layer('pad', '{ brightness: perlin.range(.2, .9) }', 8) }] },
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
    { title: 'machine', tags: ['song', 'sections', 'aggression', 'static'], blurb: 'Industrial rock at 120 BPM on one static minor chord for 68 cycles. All the tension is density, drive, distortion and filtering; harmony never moves.',
      svg: timeline([['intro', 4, .2], ['arrive', 4, .4], ['verse', 8, .6], ['build', 4, .7], ['chorus', 8, .85], ['breakdown', 4, .3], ['rebuild', 4, .5], ['verse2', 8, .6], ['chorus2', 8, .9], ['chorus3', 8, .95], ['burnout', 8, .5]], '68 cycles, E minor, i only'), variants: [{ label: 'machine.strudel', src: 'songs/machine.strudel' }] },
    { title: 'arrival', tags: ['song', 'sections', 'second parts', 'spread', 'orchestral'], blurb: 'An orchestral score at 64 BPM in D minor over 59 cycles: an alien arrival as a battle of wills. Every voice is a const spread into pad, pad2, pad3, melody and melody2; the human theme follows the harmony, the alien signal never does, and the climaxes play both at once.',
      svg: timeline([['void', 1, .15], ['signal', 8, .3], ['approach', 8, .5], ['contact', 8, .75], ['will', 8, .8], ['plea', 8, .4], ['threshold', 12, .95], ['after', 6, .3]], '59 cycles, 64 BPM, D minor'), variants: [{ label: 'arrival.strudel', src: 'songs/arrival.strudel' }] },
    { title: 'breakwater', tags: ['song', 'sample', 'break points', 'bpm'], blurb: 'A breakbeat piece in F minor whose lead voice is the demo loop cut a different way in every section: whole, halved, a trimmed bar dragged at its own tempo, quarters, a break-point chop on the isolated kick and snare, then one hit a bar.',
      svg: timeline([['shoreline', 8, .3], ['swell', 8, .5], ['undertow', 8, .6], ['surge', 8, .75], ['breakwater', 12, .95], ['backwash', 8, .3]], '52 bars, F minor; undertow at 99 bpm'), variants: [{ label: 'breakwater.strudel', src: 'songs/breakwater.strudel' }] },
    { title: 'hunted', tags: ['song', 'sample', 'voice', 'phrygian', 'second parts', 'template'], blurb: 'A voice on the radio calls directions from a shared pack of shouted takes (samples/user/voice, one folder per phrase, each take trimmed by a definition), a theme that follows the harmony and a thing that never does: E and F against every chord. Five parts a section is what one sound per part costs; the sound lists in the Material group are the fix. hide\'s second drum layer is template: \'heartbeat\', a named template with nothing but a bare kick, so the heart is one sound and no other voice can join it.',
      svg: timeline([['alley', 8, .3], ['chase', 16, .7], ['hide', 8, .3], ['run', 16, .95], ['found', 8, .35]], '56 bars, E phrygian'), variants: [{ label: 'hunted.strudel', src: 'songs/hunted.strudel' }] },
  ] },
];
