// The CodeMirror inline controls: the schema decides which literals get one, the document is the only state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { ensureSyntaxTree } from '@codemirror/language';
import { findControls, editFor, quantize, hllControls, toggleControls, controlsOf, controlsShown, decorationsOf, valuesOf } from '../web/cm-controls.mjs';
import { SCHEMA, host } from '../web/hll-schema.mjs';
import { TEMPLATES } from '../lib/grid.mjs';

const state = (doc) => EditorState.create({ doc, extensions: [javascript(), hllControls(SCHEMA)] });
const controls = (doc) => { const s = state(doc); return findControls(ensureSyntaxTree(s, s.doc.length, 1000), doc, SCHEMA, SCHEMA.hll); };
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
  assert.equal(controls(`section('a', 4, { drums: { density: sine, level: ramp(0, 1), template: \`house\` } })`).length, 1, 'signals, calls and template strings are not literals');
  assert.equal(controls(`section('a', 4, { drums: { ...base, density: .5 } })`).length, 2, 'a spread does not hide the literals beside it');
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
  assert.equal(c['kit'].kind, 'enum'); assert.equal(c['key'].kind, 'enum'); assert.equal(c['meter'].kind, 'enum'); assert.equal(c['seed'].kind, 'number'); assert.equal(c['progression'].kind, 'enum');
  assert.ok(valuesOf(c['key'].spec).includes('Eb:dorian'), 'roots x the vocabulary modes');
  assert.ok(valuesOf(c['progression'].spec).includes('I V vi IV'));
  assert.ok(valuesOf(c['melody.sound'].spec).includes('sawtooth'), 'the synths in Node');
  const was = host.sounds;
  try {
    host.sounds = () => ['bd', 'jazz', 'custom'];
    assert.deepEqual(valuesOf(c['drums.sounds.hh'].spec), ['bd', 'jazz', 'custom'], 'the map reads the host list at use time');
    assert.deepEqual(valuesOf(c['fx.impact'].spec), ['bd', 'jazz', 'custom']);
  } finally { host.sounds = was; }
  assert.deepEqual(valuesOf(c['kit'].spec), [], 'no kits in Node: the page fills host.kits');
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
    assert.ok(['number', 'enum', 'bool', 'map'].includes(s.type), `${k}: type`);
    if (s.type === 'number') assert.ok(s.min < s.max && s.step > 0, `${k}: bounds`);
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
