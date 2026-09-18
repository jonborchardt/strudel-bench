// Control metadata for the song()/section() HLL: which literals have known semantics, and therefore an inline control in
// the CodeMirror editor (web/cm-controls.mjs, widgets in web/cm-widgets.mjs). Everything else is plain code: a literal
// without an entry here never gets a control, so a wrong range cannot be invented for it. test/cm.test.mjs checks that
// every key the HLL accepts is either here or listed in `free` with the reason.
//
//   hll:     the calls whose object arguments the props apply inside (a `density` key in some other object is not an axis)
//   props:   an object key inside a song(...) header or a section(...) spec, or one of the spec's layer objects
//   calls:   positional arguments by callee name (null = no control for that position)
//   methods: positional arguments of a Strudel method anywhere (`.slow(8)`, `.range(.3, .7)`)
//   signals: bare identifiers that may stand in for a number (`density: saw`, `saw.range(...)`), offered as a pick
//   free:    keys that take hand-written text or structures, with why they have no control
//
// Specs: { type: 'number', min, max?, step, scale?: 'log' }  with max: a slider between the bounds (log for ratios such as
//                                                             tempo); without: a spinner from min up, nothing invented
//        { type: 'enum', values, labels?, list? }              the legal strings; `values` may be a function for lists only
//                                                             the host knows (loaded sounds, kits); `labels` maps a value to
//                                                             its text; `list` names a shared list for long ones
//        { type: 'bool' }                                     true / false
//        { type: 'map', keys?, values }                       an object whose string values are each an enum over `values`
//        { type: 'tokens', values, sep }                      a string of tokens, each from `values`, any number of them
//        'inherit' (an argument spec)                         the bounds of the HLL number this expression is the value of
// Adding a key is a data edit here; the editor reads the shape, not the names.
import { AXES } from '../lib/axes.mjs';
import { TEMPLATES } from '../lib/grid.mjs';
import { ARP_ORDERS, DRUM_ORDER } from '../lib/layers.mjs';
import { SYNTHS } from '../lib/packs.mjs';
import { HARMONY } from '../lib/vocab.mjs';
import { FLATS, NUMERALS } from '../lib/harmony.mjs';

/** Lists only the host knows: the page fills these once the packs are loaded; Node keeps the synths and no kits. */
export const host = { sounds: () => SYNTHS, kits: () => [] };

const unit = { type: 'number', min: 0, max: 1, step: 0.01 };
const int = (min, title) => ({ type: 'number', min, step: 1, title });
const sound = (title) => ({ type: 'enum', values: () => host.sounds(), list: 'sounds', title });
export const ROOTS = FLATS; // the roots as lib/harmony spells them
const METERS = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '9/8', '12/8']; // the common ones; parseMeter takes any n/4, n/8, n/16
const ROLES = ['establish', 'develop', 'climax', 'release']; // the vocabulary the songs use; only climax has a rule (the fill before it)
// the chord tokens parseProgression reads: diatonic numerals in both cases, their sevenths, the common altered roots, diminished
const NUM = NUMERALS.map((n) => n.toUpperCase());
export const CHORDS = [...NUM.map((n) => n.toLowerCase()), ...NUM, ...NUM.map((n) => `${n}7`), ...NUM.map((n) => `${n.toLowerCase()}7`), 'bII', 'bIII', 'bVI', 'bVII', 'bIII7', 'bVII7', '#iv', 'iidim', 'viidim', 'iidim7', 'viidim7'];
const SIGNALS = ['sine', 'cosine', 'saw', 'isaw', 'tri', 'square', 'rand', 'perlin'];

export const SCHEMA = {
  hll: ['song', 'section'],
  props: {
    // axes: every layer, 0..1, .5 is the baseline
    ...Object.fromEntries(AXES.map((a) => [a.name, { ...unit, title: a.meaning }])),
    // song header and section tempo, meter, harmony, kit
    bpm: { type: 'number', min: 40, max: 240, step: 1, title: 'tempo in beats per minute' },
    cps: { type: 'number', min: 0.125, max: 2, step: 0.001, scale: 'log', title: 'tempo in cycles per second' },
    seed: int(1, 'seed of the generated lines'),
    meter: { type: 'enum', values: METERS, title: 'beats per bar over the beat unit: any n/4, n/8 or n/16' },
    key: { type: 'enum', values: () => ROOTS.flatMap((r) => HARMONY.modes.map((m) => `${r}:${m}`)), list: 'keys', title: 'root and mode' },
    progression: { type: 'tokens', values: CHORDS, sep: ' ', title: 'one chord per bar, roman numerals over the key; [a b] shares a bar' },
    role: { type: 'enum', values: ROLES, title: "the section's role in the arc" },
    kit: { type: 'enum', values: () => host.kits(), title: 'drum machine bank' },
    // layer material
    level: { type: 'number', min: 0, max: 2, step: 0.01, title: "the part's gain multiplier" },
    duckDepth: { ...unit, title: 'how deep the named part ducks this one' },
    template: { type: 'enum', values: Object.keys(TEMPLATES), title: 'drum pattern template' },
    sounds: { type: 'map', keys: DRUM_ORDER, values: () => host.sounds(), list: 'sounds', title: 'the sample a drum voice plays' },
    fill: { type: 'bool', title: 'a fill in the last bar' },
    sound: sound('the synth or sample the part plays'),
    follow: { type: 'bool', title: 'the melody follows the chords' },
    phrase: int(1, 'bars of seeded melody before it repeats'),
    arp: { type: 'enum', values: Object.keys(ARP_ORDERS), title: 'arpeggio order' },
    riser: int(0, 'bars of riser into the next section (true = 4)'),
    impact: sound('the impact sample on the downbeat (true = bd)'),
    // the sample part (lib/layers.mjs): the region of the file, what it stands for, how it is cut and played
    begin: { ...unit, title: 'where the used region of the sample starts, as a fraction of the file' },
    end: { ...unit, title: 'where the used region of the sample ends, as a fraction of the file' },
    bars: { type: 'number', min: 0.25, step: 0.25, title: 'bars the region stands for at the section tempo' },
    slices: int(1, 'equal slices the region is cut into; a list of break points instead is plain code'),
    stretch: { type: 'bool', title: 'fit each slice to its step (off: a slice keeps its own length at the fitted speed)' },
  },
  calls: {
    section: { args: [null, int(1, 'bars in this section'), null] },
    ramp: { args: ['inherit', 'inherit'] }, // from, to across the section, in the bounds of the number it stands in for
  },
  methods: {
    range: { args: ['inherit', 'inherit'] }, // the signal swings between low and high, in the bounds of the number it stands in for
    slow: { args: [{ type: 'number', min: 0.125, step: 1, title: 'cycles per repeat' }] },
    fast: { args: [{ type: 'number', min: 0.125, step: 1, title: 'repeats per cycle' }] },
    segment: { args: [int(1, 'steps per cycle the signal is sampled at')] },
  },
  signals: SIGNALS,
  free: {
    packs: 'a list of sample pack names',
    duck: 'the name of the part in this section that ducks this one',
    notes: 'a line in mini-notation, written by hand',
    rhythm: 'a grid string (x X o . | or p/s), written by hand',
    chord: 'a scale degree or a pattern of them',
    pattern: 'on a sample part, slice indices in mini-notation spanning its bars (0 1 [2 3] 0); on a raw part, a plain strudel pattern',
  },
};
