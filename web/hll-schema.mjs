// Control metadata for the song()/section() HLL: which literals have known semantics, and therefore an inline control in
// the CodeMirror editor (web/cm-controls.mjs). Everything else is plain code: a literal without an entry here never gets
// a control, so a wrong range cannot be invented for it. test/cm.test.mjs checks that every key the HLL accepts is
// either here or listed in `free` with the reason.
//
//   hll:   the calls whose object arguments the props apply inside (a `density` key in some other object is not an axis)
//   props: an object key inside a song(...) header or a section(...) spec, or one of the spec's layer objects
//   calls: positional arguments by callee name (null = no control for that position)
//   free:  keys that take hand-written text or structures, with why they have no control
//
// Specs: { type: 'number', min, max, step, scale?: 'log' }  min/max are the slider's bounds (a ui window when the language
//                                                           allows more, said in the title); log for ratios such as tempo
//        { type: 'enum', values, labels?, list? }            the legal strings; `values` may be a function for lists only the
//                                                           host knows (loaded sounds, kits); `labels` maps a value to its
//                                                           option text; `list` names a shared datalist for long lists
//        { type: 'bool' }                                   true / false
//        { type: 'map', keys?, values }                     an object whose string values are each an enum over `values`
//                                                           (optionally only under `keys`)
// Adding a key is a data edit here; the editor reads the shape, not the names.
import { AXES } from '../lib/axes.mjs';
import { TEMPLATES } from '../lib/grid.mjs';
import { ARP_ORDERS, DRUM_ORDER } from '../lib/layers.mjs';
import { SYNTHS } from '../lib/packs.mjs';
import { HARMONY } from '../lib/vocab.mjs';

/** Lists only the host knows: the page fills these once the packs are loaded; Node keeps the synths and no kits. */
export const host = { sounds: () => SYNTHS, kits: () => [] };

const unit = { type: 'number', min: 0, max: 1, step: 0.01 };
const sound = (title) => ({ type: 'enum', values: () => host.sounds(), list: 'sounds', title });
const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const METERS = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '9/8', '12/8']; // the common ones; parseMeter takes any n/4, n/8, n/16
export const ROLES = ['establish', 'develop', 'climax', 'release']; // the vocabulary the songs use; only climax has a rule (the fill before it)

export const SCHEMA = {
  hll: ['song', 'section'],
  props: {
    // axes: every layer, 0..1, .5 is the baseline
    ...Object.fromEntries(AXES.map((a) => [a.name, { ...unit, title: a.meaning }])),
    // song header and section tempo, meter, harmony, kit
    bpm: { type: 'number', min: 40, max: 240, step: 1, title: 'tempo in beats per minute' },
    cps: { type: 'number', min: 0.125, max: 2, step: 0.001, scale: 'log', title: 'tempo in cycles per second' },
    seed: { type: 'number', min: 1, max: 99, step: 1, title: 'seed of the generated lines: any positive integer, 1..99 on the slider' },
    meter: { type: 'enum', values: METERS, title: 'beats per bar over the beat unit: any n/4, n/8 or n/16' },
    key: { type: 'enum', values: () => ROOTS.flatMap((r) => HARMONY.modes.map((m) => `${r}:${m}`)), list: 'keys', title: 'root and mode' },
    progression: { type: 'enum', values: () => Object.values(HARMONY.progressions), labels: () => Object.fromEntries(Object.entries(HARMONY.progressions).map(([w, p]) => [p, `${w}: ${p}`])), title: 'roman numerals over the key, one chord per bar; the named ones from the vocabulary' },
    role: { type: 'enum', values: ROLES, title: "the section's role in the arc" },
    kit: { type: 'enum', values: () => host.kits(), title: 'drum machine bank' },
    // layer material
    level: { type: 'number', min: 0, max: 2, step: 0.01, title: "the part's gain multiplier" },
    template: { type: 'enum', values: Object.keys(TEMPLATES), title: 'drum pattern template' },
    sounds: { type: 'map', keys: DRUM_ORDER, values: () => host.sounds(), list: 'sounds', title: 'the sample a drum voice plays' },
    fill: { type: 'bool', title: 'a fill in the last bar' },
    sound: sound('the synth or sample the part plays'),
    follow: { type: 'bool', title: 'the melody follows the chords' },
    phrase: { type: 'number', min: 1, max: 8, step: 1, title: 'bars of seeded melody before it repeats: any positive integer, 1..8 on the slider' },
    arp: { type: 'enum', values: Object.keys(ARP_ORDERS), title: 'arpeggio order' },
    riser: { type: 'number', min: 0, max: 16, step: 1, title: 'bars of riser into the next section (true = 4)' },
    impact: sound('the impact sample on the downbeat (true = bd)'),
  },
  calls: {
    section: { args: [null, { type: 'number', min: 1, max: 32, step: 1, title: 'bars in this section' }, null] },
  },
  free: {
    packs: 'a list of sample pack names',
    notes: 'a line in mini-notation, written by hand',
    chord: 'a scale degree or a pattern of them',
  },
};
