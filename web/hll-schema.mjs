// Control metadata for the song()/section() HLL: which literals have known semantics, and therefore an inline control in
// the CodeMirror editor (web/cm-controls.mjs). Everything else is plain code: a literal without an entry here never gets
// a control, so a wrong range cannot be invented for it.
//
//   props: an object key inside a song(...) header or a section(...) spec, or one of the spec's layer objects
//   calls: positional arguments by callee name (null = no control for that position)
//
// Specs: { type: 'number', min, max, step, scale?: 'log' } (min/max are the slider's bounds; log for ratios such as tempo)
//        { type: 'enum', values: [...] } (the legal strings; the select shows them)
// Adding a command or key is a data edit here; the editor reads the shape, not the names.
import { AXES } from '../lib/axes.mjs';
import { TEMPLATES } from '../lib/grid.mjs';
import { ARP_ORDERS } from '../lib/layers.mjs';

const unit = { type: 'number', min: 0, max: 1, step: 0.01 };

export const SCHEMA = {
  hll: ['song', 'section'], // the calls whose object arguments the props apply inside; a `density` key in some other object is not an axis
  props: {
    ...Object.fromEntries(AXES.map((a) => [a.name, { ...unit, title: a.meaning }])), // every axis: 0..1, .5 is the baseline
    level: { type: 'number', min: 0, max: 2, step: 0.01, title: "the part's gain multiplier" },
    bpm: { type: 'number', min: 40, max: 240, step: 1, title: 'tempo in beats per minute' },
    cps: { type: 'number', min: 0.125, max: 2, step: 0.001, scale: 'log', title: 'tempo in cycles per second' },
    template: { type: 'enum', values: Object.keys(TEMPLATES), title: 'drum pattern template' },
    arp: { type: 'enum', values: Object.keys(ARP_ORDERS), title: 'arpeggio order' },
  },
  calls: {
    section: { args: [null, { type: 'number', min: 1, max: 32, step: 1, title: 'bars in this section' }, null] },
  },
};
