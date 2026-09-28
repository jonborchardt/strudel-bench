import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPortrait } from '../web/visual/portrait.mjs';
import { GROUPS, CONTROLS, blank, base, params, encode, decode, setOv, at, expand, flat, report, presetMatch, idle } from '../web/visual/editor.mjs';
import { FAMILIES } from '../web/visual/cast.mjs';

const state = (ov = {}, over = {}) => ({ ...blank(), ...over, ov });
const svg = (st) => renderPortrait(params(st)).replace(/c\d+/g, 'c'); // clip ids are document-global, so two renders of one face differ only there

test('every control names a parameter that exists, with the value in its range', () => {
  const p = params(state());
  for (const c of CONTROLS) {
    if (c.state || c.kind === 'preset') continue;
    const v = at(p, c.path);
    const parent = c.path.includes('.') && at(p, c.path.split('.').slice(0, -1).join('.'));
    assert.ok(v !== undefined || c.nullable || parent === null, `${c.path} is not a portrait parameter`);
    if (c.kind === 'num' && typeof v === 'number') assert.ok(v >= c.min && v <= c.max, `${c.path} = ${v} outside ${c.min}..${c.max}`);
    if (c.kind === 'enum' && !c.nullable && v !== undefined) assert.ok(c.options.includes(v), `${c.path} = ${v} not an option`);
    if (c.kind === 'multi') assert.ok((v ?? []).every((x) => c.options.includes(x)), `${c.path} has an unlisted name`);
  }
  assert.equal(new Set(GROUPS.map((g) => g.name)).size, GROUPS.length);
});

test('the hash is the whole face: encode/decode round trips and the same state draws the same portrait', () => {
  const st = state({ 'face.width': 170, 'hair.style': 'afroMedium', 'glasses': null, 'accessories': ['tie'] }, { seed: 4321, family: 'heavyBrow' });
  assert.deepEqual(decode(encode(st)), st);
  assert.deepEqual(decode('#' + encode(st)), st);
  assert.deepEqual(decode('not base64'), blank());
  assert.ok(svg(st) === svg(decode(encode(st))), 'the same hash draws the same portrait');
  assert.ok(svg(st) !== svg(state({}, { seed: 4322 })), 'another seed draws another portrait');
});

test('one edit changes one parameter', () => {
  const before = params(state());
  const after = params(state({ 'eyes.spacing': 61 }));
  const [a, b] = [flat(before), flat(after)];
  assert.deepEqual(Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])), ['eyes.spacing']);
  assert.equal(after.eyes.spacing, 61);
});

test('setOv drops the entries an edit contradicts', () => {
  assert.deepEqual(setOv(setOv({}, 'glasses', null), 'glasses.style', 'round'), { 'glasses.style': 'round' }); // a style un-nulls the object
  assert.deepEqual(setOv(setOv({}, 'glasses.style', 'round'), 'glasses', null), { glasses: null }); // and 'none' clears the style
  assert.deepEqual(expand({ 'face.asym.chin': 0.5, 'hat.style': 'cowboy' }), { face: { asym: { chin: 0.5 } }, hat: { style: 'cowboy' } });
});

test('the base character is the seed, constrained to a family when asked', () => {
  assert.deepEqual(base(7, 'any'), base(7, 'any'));
  assert.notDeepEqual(base(7, 'any'), base(8, 'any'));
  for (const fam of Object.keys(FAMILIES)) {
    const c = base(11, fam);
    assert.ok(FAMILIES[fam].eyes.includes(c.eyes.style) && FAMILIES[fam].noses.includes(c.nose.style), `${fam}: ${c.eyes.style}/${c.nose.style} is outside the family`);
  }
});

test('every option of every list draws', () => {
  for (const c of CONTROLS) {
    if (c.kind === 'enum' && !c.state) for (const o of c.options) renderPortrait(params(state({ [c.nullable && o === 'none' ? (c.clears ?? c.path) : c.path]: c.nullable && o === 'none' ? null : o })));
    if (c.kind === 'multi') for (const o of c.options) renderPortrait(params(state({ [c.path]: [o] })));
    if (c.kind === 'preset') for (const o of c.options) { const ov = {}; for (const [k, v] of Object.entries(c.apply(o))) setOv(ov, k, v); renderPortrait(params(state(ov))); }
  }
  for (const c of CONTROLS) if (c.kind === 'num' && !c.state) for (const v of [c.min, c.max]) renderPortrait(params(state({ [c.path]: v })));
});

test('a preset reads back as itself, and the report says what the face is', () => {
  const shape = CONTROLS.find((c) => c.path === 'shape'), expr = CONTROLS.find((c) => c.path === 'expression');
  for (const c of [shape, expr]) {
    const ov = {}; for (const [k, v] of Object.entries(c.apply(c.options[1]))) setOv(ov, k, v);
    assert.equal(presetMatch(c, params(state(ov))), c.options[1]);
  }
  const txt = report(state({ 'hair.style': 'bob' }), 'the hair is bad', 'http://x/#abc');
  assert.match(txt, /the hair is bad/);
  assert.match(txt, /hair: bob/);
  assert.match(txt, /edits: hair\.style="bob"/);
  assert.match(txt, /link: http:\/\/x\/#abc/);
});

test('the idle animation drifts the pose, moves the gaze and blinks, and never leaves the sliders behind', () => {
  const p = params(state()), lim = CONTROLS.filter((c) => c.kind === 'num' && /^(pose|eyes\.look|eyes\.brow|mouth\.(smile|open|fullness))/.test(c.path));
  assert.deepEqual(idle(p, 3.7), idle(p, 3.7)); // deterministic: the same second is the same face
  const at2 = idle(p, 2), at9 = idle(p, 9);
  assert.notDeepEqual(at2.pose, at9.pose);
  assert.notDeepEqual(at2.eyes.look, at9.eyes.look);
  assert.notDeepEqual(at2.mouth, at9.mouth); // the expression drifts too: mouth and brows
  assert.notEqual(at2.eyes.browLift, at9.eyes.browLift);
  let shut = 0;
  for (let t = 0; t < 30; t += 0.02) {
    const q = idle(p, t);
    shut += q.eyes.openness < p.eyes.openness * 0.3 ? 1 : 0;
    for (const c of lim) assert.ok(at(q, c.path) >= c.min && at(q, c.path) <= c.max, `${c.path} ${at(q, c.path)}`);
    if (t % 1 < 0.02) renderPortrait(q);
  }
  assert.ok(shut > 5 && shut < 200, `blinks: ${shut} frames shut`);
});
