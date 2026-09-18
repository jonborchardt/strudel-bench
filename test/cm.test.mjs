// The CodeMirror inline controls: the schema decides which literals get one, the document is the only state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { ensureSyntaxTree } from '@codemirror/language';
import { findControls, editFor, quantize, hllControls, toggleControls, controlsOf, controlsShown, decorationsOf, languageFor } from '../web/cm-controls.mjs';
import { valuesOf, widgetFor, slider, spinner, check, select, pick, tokens } from '../web/cm-widgets.mjs';
import { SCHEMA, host } from '../web/hll-schema.mjs';
import { TEMPLATES } from '../lib/grid.mjs';

const state = (doc) => EditorState.create({ doc, extensions: [javascript(), hllControls(SCHEMA)] });
const controls = (doc) => { const s = state(doc); return findControls(ensureSyntaxTree(s, s.doc.length, 1000), doc, SCHEMA); };
const byPath = (doc) => Object.fromEntries(controls(doc).map((c) => [c.path, c]));
const lit = (doc, c) => doc.slice(c.from, c.to);

const SRC = `song({ bpm: 128, key: 'C:minor' }, [
  section('intro', 4, { role: 'establish', drums: { density: .7, level: -1.5, template: "house", sound: 'bd' }, melody: { arp: 'up' } }),
])`;

test('the schema picks out the known literals with their kind, range and path', () => {
  const c = byPath(SRC);
  assert.deepEqual(Object.keys(c).sort(), ['bpm', 'key', 'role', 'drums.density', 'drums.level', 'drums.template', 'drums.sound', 'melody.arp', 'section(1)'].sort());
  assert.equal(c['drums.density'].kind, 'number'); assert.equal(c['drums.density'].spec.max, 1); assert.equal(c['drums.density'].value, 0.7);
  assert.equal(c['drums.level'].value, -1.5); assert.equal(c['drums.level'].spec.max, 2);
  assert.equal(c['bpm'].spec.step, 1); assert.equal(c['bpm'].value, 128);
  assert.equal(c['drums.template'].kind, 'enum'); assert.deepEqual(c['drums.template'].spec.values, Object.keys(TEMPLATES)); assert.equal(c['drums.template'].value, 'house');
  assert.equal(c['melody.arp'].kind, 'enum'); assert.equal(c['melody.arp'].quote, "'");
  assert.equal(c['section(1)'].value, 4, 'the cycles argument of section()');
  assert.equal(lit(SRC, c['drums.density']), '.7'); assert.equal(lit(SRC, c['drums.level']), '-1.5'); assert.equal(lit(SRC, c['drums.template']), '"house"');
});

test('literals without metadata, and known keys outside the HLL calls, get no control', () => {
  assert.equal(controls(`gain(0.72)\nfilter(2400)\nfoo(3, 'bar')\nconst x = { density: .5, template: 'house' }`).length, 0);
  assert.deepEqual(controls(`section('a', 4, { drums: { sound: 'bd', notes: 'c e g', level: 'loud', density: '.5' } })`).map((c) => c.path), ['section(1)', 'drums.sound'], 'a string where a number is expected is not a control, and notes is free text');
  assert.deepEqual(controls(`section('a', 4, { drums: { density: sine, level: ramp(0, 1), template: \`house\` } })`).map((c) => c.path), ['section(1)', 'drums.density.signal', 'drums.level.ramp(0)', 'drums.level.ramp(1)'], 'a signal and ramp arguments are controls of the number they stand in for; a template string is not a literal');
  assert.equal(controls(`section('a', 4, { drums: { ...base, density: .5 } })`).length, 2, 'a spread does not hide the literals beside it');
  assert.deepEqual(controls(`const M = { organicness: 0, sounds: { bd: 'bd' }, gain: 3 };\nconst B = { ...M, level: .4 };\nconst x = { density: .5 };\nsection('a', 4, { drums: { ...B } })`).map((c) => c.path), ['M.organicness', 'M.sounds.bd', 'B.level', 'section(1)'], 'a const object the file spreads (directly or through another) is a layer object; one it never spreads is not');
  assert.deepEqual(controls(`const A = { density: .5 }, B = { space: .2 };\nsection('a', 4, { drums: { ...B } })`).map((c) => c.path), ['B.space', 'section(1)'], 'a multi-declarator const: each object goes by its own name');
  assert.equal(byPath(`other('a', 4, { drums: { density: .5 } })`)['drums.density'], undefined, 'an unknown command is ordinary code');
});

test('editFor replaces exactly the literal, quantized to the spec, keeping the quote style', () => {
  const c = byPath(SRC);
  const apply = (ctl, v) => { const e = editFor(ctl, v); return SRC.slice(0, e.from) + e.insert + SRC.slice(e.to); };
  assert.match(apply(c['drums.density'], 0.35), /density: \.35, level/);
  assert.match(apply(c['drums.density'], 1.7), /density: 1, level/, 'clamped to the range');
  assert.match(apply(c['drums.density'], 0.123456), /density: \.12, level/, 'rounded to the step');
  assert.match(apply(c['drums.level'], 0), /level: 0, template/);
  assert.match(apply(c['bpm'], 130.4), /bpm: 130, key/);
  assert.match(apply(c['section(1)'], 8), /section\('intro', 8, \{/);
  assert.match(apply(c['drums.template'], 'breaks'), /template: "breaks", sound/);
  assert.match(apply(c['melody.arp'], 'updown'), /arp: 'updown' \}/);
  assert.equal(quantize(0.7000000001, SCHEMA.props.density), 0.7);
  assert.equal(quantize(-3, SCHEMA.props.level), 0);
});

test('a control stays on its node while text before it changes, and a typed edit re-finds it', () => {
  let s = state(SRC);
  const before = controlsOf(s).find((c) => c.path === 'drums.density');
  s = s.update({ changes: { from: SRC.indexOf("role: 'establish'"), insert: "key: 'G:dorian', progression: 'i iv v', " } }).state;
  const after = controlsOf(s).find((c) => c.path === 'drums.density');
  assert.ok(after.from > before.from);
  assert.equal(s.doc.sliceString(after.from, after.to), '.7');
  // typing a new value: the control's value follows the document
  s = s.update({ changes: { from: after.from, to: after.to, insert: '.25' } }).state;
  assert.equal(controlsOf(s).find((c) => c.path === 'drums.density').value, 0.25);
  // a control's own edit through editFor lands on the current position
  const arp = controlsOf(s).find((c) => c.path === 'melody.arp');
  s = s.update({ changes: editFor(arp, 'down') }).state;
  assert.match(s.doc.toString(), /arp: 'down'/);
});

test('toggling the controls on and off adds and removes widgets without touching the document', () => {
  let s = state(SRC);
  const widgets = (st) => { let n = 0; for (const it = decorationsOf(st).iter(); it.value; it.next()) if (it.value.spec.widget) n++; return n; };
  assert.equal(s.field(controlsShown), false);
  assert.equal(widgets(s), 0, 'hidden by default: the code reads clean');
  s = s.update({ effects: toggleControls.of(true) }).state;
  assert.equal(s.field(controlsShown), true);
  assert.equal(widgets(s), controlsOf(s).length, 'one widget per control');
  assert.equal(s.doc.toString(), SRC);
  s = s.update({ effects: toggleControls.of(false) }).state;
  assert.equal(widgets(s), 0);
  assert.equal(s.doc.toString(), SRC);
});

test('booleans, the drum voice map, and host-supplied lists', () => {
  const doc = `song({ kit: 'RolandTR909', key: 'C:minor', meter: '4/4', seed: 7 }, [section('a', 4, { progression: 'I V vi IV', drums: { fill: true, sounds: { bd: 'bd', hh: 'jazz', zz: 'x', density: .5 } }, melody: { follow: false, sound: 'sawtooth', phrase: 2 }, fx: { riser: 4, impact: 'bd' } })])`;
  const c = byPath(doc);
  assert.equal(c['drums.fill'].kind, 'bool'); assert.equal(c['drums.fill'].value, true);
  assert.equal(c['melody.follow'].value, false);
  assert.match(doc.slice(0, editFor(c['drums.fill'], false).from) + editFor(c['drums.fill'], false).insert, /fill: false$/);
  assert.equal(c['drums.sounds.bd'].kind, 'enum', 'a voice inside the sounds map'); assert.equal(c['drums.sounds.hh'].value, 'jazz');
  assert.equal(c['drums.sounds.zz'], undefined, 'not a drum voice');
  assert.equal(c['drums.sounds.density'], undefined, 'an axis name inside a map is not an axis');
  assert.equal(c['drums.sounds'], undefined, 'the map itself is not a control');
  assert.equal(c['melody.phrase'].spec.step, 1); assert.equal(c['fx.riser'].value, 4); assert.equal(c['fx.impact'].kind, 'enum');
  assert.equal(c['kit'].kind, 'enum'); assert.equal(c['key'].kind, 'enum'); assert.equal(c['meter'].kind, 'enum'); assert.equal(c['seed'].kind, 'number'); assert.equal(c['progression'].kind, 'tokens');
  assert.ok(valuesOf(c['key'].spec).includes('Eb:dorian'), 'roots x the vocabulary modes');
  assert.ok(valuesOf(c['progression'].spec).includes('V7'), 'chord tokens');
  assert.ok(valuesOf(c['melody.sound'].spec).includes('sawtooth'), 'the synths in Node');
  const was = host.sounds;
  try {
    host.sounds = () => ['bd', 'jazz', 'custom'];
    assert.deepEqual(valuesOf(c['drums.sounds.hh'].spec), ['bd', 'jazz', 'custom'], 'the map reads the host list at use time');
    assert.deepEqual(valuesOf(c['fx.impact'].spec), ['bd', 'jazz', 'custom']);
  } finally { host.sounds = was; }
  assert.deepEqual(valuesOf(c['kit'].spec), [], 'no kits in Node: the page fills host.kits');
});

test('strudel expressions as values: signals, .range/.slow/.fast/.segment and ramp() take the bounds of the number they stand in for', () => {
  const doc = `section('a', 4, { drums: { density: saw.range(.3, .7).slow(8), level: ramp(0, 1.5), weight: sine.segment(4).fast(2) }, melody: { notes: sine.range(1, 5) } })\nfoo.range(1, 2)\nx.slow(3)`;
  const c = byPath(doc);
  assert.equal(c['drums.density.signal'].kind, 'ident'); assert.equal(c['drums.density.signal'].value, 'saw'); assert.ok(valuesOf(c['drums.density.signal'].spec).includes('perlin'));
  assert.equal(c['drums.density.range(0)'].value, 0.3); assert.equal(c['drums.density.range(0)'].spec.max, 1, 'range takes the axis bounds');
  assert.equal(c['drums.density.range(1)'].value, 0.7);
  assert.equal(c['drums.level.ramp(1)'].spec.max, 2, 'ramp takes the level bounds'); assert.equal(c['drums.level.ramp(0)'].value, 0);
  assert.deepEqual(controls(doc).filter((x) => x.path === 'slow(0)').map((x) => x.value), [8, 3], 'slow means the same inside the HLL and out'); assert.equal(c['slow(0)'].spec.max, undefined, 'slow has a floor, no ceiling');
  assert.equal(c['segment(0)'].value, 4); assert.equal(c['fast(0)'].value, 2);
  assert.equal(c['weight.signal'], undefined); assert.equal(c['drums.weight.signal'].value, 'sine');
  assert.equal(c['melody.notes.range(0)'], undefined, 'notes is free text: a range inside it has no bounds to take');
  assert.equal(c['melody.notes.signal'], undefined);
  assert.equal(c['range(0)'], undefined, 'a range outside an HLL number has no bounds');
  const apply = (ctl, v) => { const e = editFor(ctl, v); return doc.slice(0, e.from) + e.insert + doc.slice(e.to); };
  assert.match(apply(c['drums.density.signal'], 'perlin'), /density: perlin\.range/, 'an identifier is written bare');
  assert.match(apply(c['drums.density.range(1)'], 0.95), /range\(\.3, \.95\)/);
  assert.match(apply(c['slow(0)'], 12), /slow\(12\)/);
  assert.match(apply(c['slow(0)'], 0), /slow\(\.125\)/, 'clamped to the floor');
});

test('movement calls take the bounds of the number they stand in for', () => {
  const c = byPath(`section('a', 4, { pad: { brightness: wobble(.2, .8, 2), space: swell(.3, 1) } })`);
  assert.equal(c['pad.brightness.wobble(0)'].spec.max, 1); assert.equal(c['pad.brightness.wobble(2)'].spec.step, 1, 'bars is a spinner');
  assert.equal(c['pad.space.swell(1)'].value, 1);
});

test('progression is a row of chord tokens, and the widget chooser follows the spec and the host', () => {
  const c = byPath(`song({ seed: 3 }, [section('a', 4, { progression: 'i [VI VII] bIII7', drums: { fill: true, template: 'house' }, melody: { phrase: 2 } })])`);
  assert.equal(c['progression'].kind, 'tokens'); assert.ok(valuesOf(c['progression'].spec).includes('bVII'));
  assert.equal(editFor(c['progression'], 'i VI').insert, "'i VI'");
  const ui = { pick() {} };
  assert.equal(widgetFor(c['drums.density'] ?? { kind: 'number', spec: SCHEMA.props.density }), slider, 'a bounded number is a slider');
  assert.equal(widgetFor(c['seed']), spinner, 'an open integer is a spinner'); assert.equal(widgetFor(c['melody.phrase']), spinner); assert.equal(widgetFor(c['section(1)']), spinner);
  assert.equal(widgetFor(c['drums.fill']), check);
  assert.equal(widgetFor(c['drums.template'], ui), pick, 'with a host menu: the pick button'); assert.equal(widgetFor(c['drums.template']), select, 'without: a native select');
  assert.equal(widgetFor(c['progression'], ui), tokens); assert.equal(widgetFor(c['progression']), null, 'the chord row needs the host menu');
});

test('a pane over the song header: the document is the object itself, read as the argument of song(...)', () => {
  const doc = `{ cps: .5, kit: 'RolandTR909', key: 'C:minor', seed: 3, packs: ['mine'] }`;
  const st = (root) => EditorState.create({ doc, extensions: [languageFor(root), hllControls(SCHEMA, { root })] });
  assert.deepEqual(controlsOf(st('song')).map((c) => c.path), ['cps', 'kit', 'key', 'seed'], 'every header key with a spec; packs is free');
  assert.equal(controlsOf(st('song')).find((c) => c.path === 'cps').spec.scale, 'log');
  assert.deepEqual(controlsOf(st()).map((c) => c.path), [], 'as a script the same text is a block, not an object: nothing is read as song');
  assert.deepEqual(controlsOf(st('other')).map((c) => c.path), [], 'a root that is not an HLL call gives nothing');
  const s = st('song').update({ changes: { from: doc.indexOf('.5'), to: doc.indexOf('.5') + 2, insert: 'sine.range(.25, 1)' } }).state; // a signal in the header takes the header key's bounds
  assert.deepEqual(controlsOf(s).map((c) => c.path), ['cps.signal', 'cps.range(0)', 'cps.range(1)', 'kit', 'key', 'seed']);
});

test('every key the HLL accepts has a control spec or is listed as free, with the reason', async () => {
  const { META_KEYS, layerNames, layerMaterial } = await import('../lib/song.mjs');
  const { AXIS_NAMES } = await import('../lib/axes.mjs');
  const section = ['role', 'key', 'progression', 'meter', 'bpm', 'cps', 'kit'];
  const all = new Set([...META_KEYS, ...section, ...AXIS_NAMES, ...layerNames().flatMap(layerMaterial)]);
  const missing = [...all].filter((k) => !SCHEMA.props[k] && !SCHEMA.free[k]);
  assert.deepEqual(missing, [], 'keys without a spec or a reason');
  for (const [k, why] of Object.entries(SCHEMA.free)) { assert.ok(all.has(k), `free key ${k} is not an HLL key`); assert.ok(why.length > 8, `free ${k}: say why`); }
  for (const [k, s] of Object.entries(SCHEMA.props)) {
    assert.ok(['number', 'enum', 'bool', 'map', 'tokens'].includes(s.type), `${k}: type`);
    if (s.type === 'number') assert.ok(s.step > 0 && s.min != null && (s.max == null || s.min < s.max), `${k}: bounds`);
    if (s.type === 'tokens') assert.ok(Array.isArray(valuesOf(s)) && s.sep, `${k}: tokens`);
    if (s.type === 'enum' || s.type === 'map') assert.ok(Array.isArray(valuesOf(s)), `${k}: values`);
  }
});

test('half-typed source does not throw and keeps the controls it can still see', () => {
  for (const doc of [`section('a', 4, { drums: { density: .`, `section('a', 4, { drums: { density: .7, `, `section('a', 4, { drums: { density: .7, template: "hou`, `section(`, ``, `{{{`]) {
    const s = state(doc);
    assert.ok(Array.isArray(controlsOf(s)), doc);
  }
  const partial = controlsOf(state(`section('a', 4, { drums: { density: .7, `));
  assert.ok(partial.some((c) => c.path === 'drums.density' && c.value === 0.7), 'the finished literal is still a control mid-edit');
});

test('a sample part has sliders for its region, spinners for bars and slices, a toggle for stretch; the pattern is free', () => {
  const paths = controls(`section('a', 4, { sample: { sound: 'loop', begin: .1, end: .9, bars: 2, slices: 8, pattern: '0 1', stretch: true } })`).map((c) => c.path);
  assert.deepEqual(paths, ['section(1)', 'sample.sound', 'sample.begin', 'sample.end', 'sample.bars', 'sample.slices', 'sample.stretch']);
});
