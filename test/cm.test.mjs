// The CodeMirror inline controls: the schema decides which literals get one, the document is the only state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { ensureSyntaxTree } from '@codemirror/language';
import { findControls, editFor, quantize, hllControls, toggleControls, controlsOf, controlsShown, decorationsOf } from '../web/cm-controls.mjs';
import { SCHEMA } from '../web/hll-schema.mjs';
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
  assert.deepEqual(Object.keys(c).sort(), ['bpm', 'drums.density', 'drums.level', 'drums.template', 'melody.arp', 'section(1)'].sort());
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
  assert.equal(controls(`section('a', 4, { drums: { sound: 'bd', notes: 'c e g', level: 'loud', density: '.5' } })`).length, 1, 'only the cycles argument: a string where a number is expected is not a control');
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

test('half-typed source does not throw and keeps the controls it can still see', () => {
  for (const doc of [`section('a', 4, { drums: { density: .`, `section('a', 4, { drums: { density: .7, `, `section('a', 4, { drums: { density: .7, template: "hou`, `section(`, ``, `{{{`]) {
    const s = state(doc);
    assert.ok(Array.isArray(controlsOf(s)), doc);
  }
  const partial = controlsOf(state(`section('a', 4, { drums: { density: .7, `));
  assert.ok(partial.some((c) => c.path === 'drums.density' && c.value === 0.7), 'the finished literal is still a control mid-edit');
});
