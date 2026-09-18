// Harmony is material, not an axis (README rule 4). Diatonic roman numerals over a per-section key.
import { S } from './strudel.mjs';

export const DEFAULT_PROGRESSION = 'i VI';
export const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

export const rootOf = (key) => key.split(':')[0].replace(/\d+$/, '');
export const modeOf = (key) => key.split(':').slice(1).join(':') || 'minor';
// a two-word scale ('C:harmonic minor') must not go through mini-notation, which would split it at the space
export const keyAt = (key, octave) => { const k = `${rootOf(key)}${octave}:${modeOf(key)}`; return k.includes(' ') ? S.pure(k) : k; };

// group3 skips a lone 'M' immediately before '7' so "VM7" lands whole in group4 (seventh), not split m3='M' m4='7'
const TOKEN = /^([b#]?)([ivIV]+)(m|dim|M(?!7))?(7|M7)?(?:\/([0-9]))?(?:@(\d+))?$/;
const QUAL = { m: 'minor', M: 'major', dim: 'dim' };

/** 'i [VI VII] bIII7' -> [[chord], [chord, chord], [chord]]: one inner array per cycle. @n repeats a chord over n bars; /k (1 or 2) inverts it. */
export function parseProgression(text) {
  const src = (text ?? '').trim() || DEFAULT_PROGRESSION;
  const chord = (t) => {
    const m = TOKEN.exec(t);
    const degree = m ? NUMERALS.indexOf(m[2].toLowerCase()) : -1;
    if (degree < 0) throw new Error(`bad numeral "${t}" in progression "${src}" (I..VII with optional b/#, m/M/dim, 7, and [..] groups)`);
    const acc = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
    const upper = m[2] === m[2].toUpperCase(), seventh = !!m[4], major7 = m[4] === 'M7';
    const inversion = m[5] ? +m[5] : 0;
    if (inversion > 2) throw new Error(`inversion /${m[5]} in "${t}" in progression "${src}": only /1 and /2`);
    const bars = m[6] ? +m[6] : 1;
    if (bars < 1) throw new Error(`"${t}" in progression "${src}": bars after @ must be 1 or more`);
    // case sets the triad for altered roots and for seventh chords (V7 is the dominant seventh in any key);
    // a plain diatonic numeral keeps the key's own quality whatever its case.
    const quality = m[3] ? QUAL[m[3]] : acc || seventh ? (upper ? 'major' : 'minor') : null;
    return { numeral: t, degree, acc, quality, seventh, major7, lowerDiatonic: !m[3] && !acc && !upper, inversion, bars };
  };
  const cycles = [];
  let group = null;
  for (const t of src.replace(/\[/g, ' [ ').replace(/\]/g, ' ] ').trim().split(/\s+/)) {
    if (t === '[') { if (group) throw new Error(`nested [ in progression "${src}"`); group = []; }
    else if (t === ']') { if (!group?.length) throw new Error(`empty or stray ] in progression "${src}"`); cycles.push(group); group = null; }
    else if (group) { const c = chord(t); if (c.bars !== 1) throw new Error(`"${t}" in progression "${src}": bars (@n) inside [..] must be 1`); group.push(c); }
    else { const c = chord(t); for (let k = 0; k < c.bars; k++) cycles.push([c]); }
  }
  if (group) throw new Error(`unclosed [ in progression "${src}"`);
  return cycles;
}

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']; // the roots as the songs spell them
const pcOf = (name) => (PC[name[0].toUpperCase()] + (name.slice(1).match(/#/g)?.length ?? 0) - (name.slice(1).match(/b/g)?.length ?? 0) + 12) % 12;

/** MIDI number of scale step `step` in `key`, via Strudel's own scale() so both hosts agree. Memoised: harmony was half of song() build time. */
const midiMemo = new Map();
const stepMidi = (key, step) => {
  const k = `${key}|${step}`;
  if (!midiMemo.has(k)) midiMemo.set(k, S.n(step).scale(keyAt(key, 4)).add(S.note(0)).queryArc(0, 1)[0].value.note);
  return midiMemo.get(k);
};
/** Note name of scale step `step` in `key`, straight from scale() (octave digits stripped) — scale() spells correctly, we don't. */
const nameMemo = new Map();
const stepName = (key, step) => {
  const k = `${key}|${step}`;
  if (!nameMemo.has(k)) nameMemo.set(k, String(S.n(step).scale(keyAt(key, 4)).queryArc(0, 1)[0].value.note).replace(/\d+$/, ''));
  return nameMemo.get(k);
};

/** Semitone intervals of the chord above its root: diatonic from the key unless the token says otherwise.
 * An inversion rotates the voiced tones (3 for a triad, all 4 for a seventh chord; a triad's implied
 * seventh stays at the end) and `bass` names the lowest tone, in semitones above the numeral root. */
export function chordSpec(key, c) {
  const [r, t, f, s] = [0, 2, 4, 6].map((k) => stepMidi(key, c.degree + k));
  let third = (t - r + 12) % 12, fifth = (f - r + 12) % 12, seventh = (s - r + 12) % 12;
  // lowercase diatonic sevenths (ii7, vii7, i7) keep the key's own quality: minor or diminished triad, minor seventh
  if (c.quality === 'major' && !c.lowerDiatonic) { third = 4; fifth = 7; }
  if (c.quality === 'minor' && !c.lowerDiatonic) { third = 3; fifth = 7; }
  if (c.quality === 'dim') { third = 3; fifth = 6; }
  // `M7` is a major seventh (11); every other seventh is minor (10), so `V7` is the dominant seventh
  if (c.seventh) seventh = c.major7 ? 11 : 10;
  else if (c.quality || c.acc) seventh = /M/.test(c.numeral) ? 11 : 10; // a non-diatonic triad's implied seventh, for 4-tone voicings
  let intervals = [0, third, fifth, seventh];
  const n = c.seventh ? 4 : 3, head = intervals.slice(0, n), tail = intervals.slice(n);
  for (let k = 0; k < (c.inversion || 0); k++) head.push(head.shift() + 12);
  intervals = [...head, ...tail];
  return { degree: c.degree, acc: c.acc, intervals, bass: intervals[0] };
}

/** Per cycle: the semitones above the key root of each chord tone of that cycle's first chord (rotated for inversion),
 * for a melody that walks chord tones. A multi-chord bar takes only its first chord. */
export const chordToneTable = (key, prog) => prog.map(([c]) => { const s = chordSpec(key, c); const root = stepMidi(key, c.degree) + s.acc - stepMidi(key, 0); return s.intervals.map((iv) => root + iv); });

// Tone-count -> intervals indices, matching the pre-v2 PAD_TONES voicings (root/third/fifth/seventh at
// indices 0/1/2/3): 1 tone is just the root, 2 is a power chord (root+fifth, index 2, skipping the third).
const TONE_IDX = { 1: [0], 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

/** One mini-string token per cycle; a multi-chord cycle is bracketed. */
const perCycle = (prog, f) => prog.map((cy) => (cy.length > 1 ? `[${cy.map(f).join(' ')}]` : f(cy[0]))).join(' ');

/** The three parallel mini-strings the layers add: chord root degrees, root accidentals, tone stacks (cut to n). */
export function chordPatterns(key, prog) {
  const cyc = (f) => `<${perCycle(prog, f)}>`;
  return {
    roots: cyc((c) => c.degree),
    acc: cyc((c) => chordSpec(key, c).acc),
    tones: (n) => cyc((c) => {
      const iv = chordSpec(key, c).intervals;
      const idx = TONE_IDX[c.seventh ? Math.max(n, 4) : n] ?? iv.map((_, i) => i).slice(0, n);
      return `[${idx.map((i) => iv[i]).join(',')}]`;
    }),
  };
}

const QUALITY = { '4,7': '', '3,7': 'm', '3,6': 'dim', '4,8': 'aug' };
const spellPc = (key, pc, acc) => ((rootOf(key).includes('b') || (!rootOf(key).includes('#') && acc < 0)) ? FLATS : SHARPS)[(pc + 120) % 12];
/** The key's own diatonic spelling of `pc`, or null when `pc` is not one of its seven scale tones (an altered chord's bass, say). */
const diatonicName = (key, pc) => { for (let s = 0; s < 7; s++) { const nm = stepName(key, s); if (pcOf(nm) === pc) return nm; } return null; };
export function chordName(key, c) {
  // quality/seventh come from the root-position spec: inversion only rotates which tone is lowest, not what the chord is
  const { acc, intervals: [, third, fifth, seventh] } = chordSpec(key, { ...c, inversion: 0 });
  const root = acc ? spellPc(key, stepMidi(key, c.degree) + acc, acc) : stepName(key, c.degree);
  const q = QUALITY[`${third},${fifth}`] ?? '?';
  let name;
  if (!c.seventh) name = root + q;
  else if (q === 'dim') name = root + (seventh === 9 ? 'dim7' : 'm7b5'); // a dim triad with a minor seventh is half-diminished
  else name = root + q + (seventh === 11 ? 'maj7' : '7');
  // an unaltered chord's inverted bass is still a scale tone: spell it the key's own way (Eb, not D#), not by the accidental's sign
  if (c.inversion) { const bass = stepMidi(key, c.degree) + acc + chordSpec(key, c).bass; name += `/${(!acc && diatonicName(key, ((bass % 12) + 12) % 12)) || spellPc(key, bass, acc)}`; }
  return name;
}
export const chordNames = (key, prog) => perCycle(prog, (c) => chordName(key, c));

const MAJORISH = ['major', 'ionian'], MINORISH = ['minor', 'aeolian'];
const sameMode = (a, b) => a === b || (MAJORISH.includes(a) && MAJORISH.includes(b)) || (MINORISH.includes(a) && MINORISH.includes(b));
export function withMode(key, mode) { return `${rootOf(key)}:${mode}`; }

/** Relative major of a minor key (+3 semitones) or relative minor of a major key (-3). Other modes: refuse. */
export function relativeKey(key) {
  const root = rootOf(key), mode = modeOf(key);
  const toMajor = MINORISH.includes(mode), toMinor = MAJORISH.includes(mode);
  if (!toMajor && !toMinor) throw new Error(`relative key is only defined from major or minor, not "${mode}"`);
  const pc = (pcOf(root) + (toMajor ? 3 : 9)) % 12;
  const flats = root.includes('b') || (!root.includes('#') && toMajor);
  return `${(flats ? FLATS : SHARPS)[pc]}:${toMajor ? 'major' : 'minor'}`;
}

/** Apply parsed harmony words (from vocab.parsePhrase) as states on { key, progression }. */
export function applyHarmonyWords(state, harmony) {
  let { key, progression } = state;
  for (const h of harmony) {
    if (h.kind === 'relative') key = relativeKey(key);
    else if (h.kind === 'mode') key = withMode(h.relative && !sameMode(modeOf(key), h.value) ? relativeKey(key) : key, h.value);
    else if (h.kind === 'progression') progression = h.value;
  }
  return { key, progression };
}
