// web/visual/hooks.mjs: what a world publishes about the things it does, and what the music feeds each of them.
// The runtime is world-agnostic, so it is tested on its own; faces' own test pins that its defaults did not move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { READS, feeds, drive, defaults, changed, slotOf, DEFAULT_SLOT } from '../web/visual/hooks.mjs';
import faces, { hooks as faceHooks } from '../web/visual/faces.mjs';

const ev = (o = {}) => ({ layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse', gain: 1, velocity: 1, pan: 0.5, note: null, cutoff: null, dur: 0.25, ...o });
const slots = { drums: 'impulse', bass: 'ground', melody: 'line' };

test('READS: every control comes out on the same 0..1 scale, and is null where the event has none', () => {
  assert.equal(READS.gain(ev({ gain: 1.5, velocity: 1 })), 1, 'a full-scale hit is 1');
  assert.ok(READS.gain(ev({ gain: 0.3 })) < 0.3, 'and a quiet one is well under it');
  assert.equal(READS.pan(ev({ pan: 0.25 })), 0.25);
  assert.equal(READS.note(ev()), null, 'a drum hit carries no pitch');
  assert.equal(READS.note(ev({ note: 24 })), 0, 'the bottom of the range');
  assert.equal(READS.note(ev({ note: 84 })), 1, 'and the top');
  assert.equal(READS.cutoff(ev()), null);
  assert.ok(READS.cutoff(ev({ cutoff: 8000 })) > 0.9, 'a wide-open filter reads high');
  for (const r of Object.values(READS)) for (const e of [ev(), ev({ note: 60, cutoff: 200, gain: 9 })]) {
    const v = r(e);
    assert.ok(v === null || (v >= 0 && v <= 1), `every reading is null or inside 0..1, got ${v}`);
  }
});

test('feeds: a source is a job, a job and a role, a part, a part and a voice, or anything', () => {
  assert.ok(feeds('@impulse', ev(), slots), 'the drums have the impulse job in this cast');
  assert.ok(!feeds('@ground', ev(), slots));
  assert.ok(feeds('@impulse:impact', ev({ role: 'impact' }), slots));
  assert.ok(!feeds('@impulse:impact', ev({ role: 'pulse' }), slots), 'a kick is not a snare');
  assert.ok(feeds('drums', ev(), slots) && !feeds('bass', ev(), slots), 'by part name');
  assert.ok(feeds('drums:bd', ev(), slots) && !feeds('drums:hh', ev(), slots), 'and down to the voice');
  assert.ok(feeds('*', ev({ layer: 'anything' }), slots), 'anything that sounds');
  assert.ok(!feeds('@impulse', ev({ role: 'impact' }), slots, ['impact']), 'except drops the roles another hook claimed');
  // a part with no cast entry still has a job, from the kind of part it is
  assert.equal(slotOf(ev({ layer: 'nowhere' }), slots), DEFAULT_SLOT.drums);
  assert.ok(feeds('@impulse', ev({ layer: 'nowhere' }), {}), 'so a plain pattern still reaches its hooks');
});

test('drive: how hard, past a threshold and scaled, and zero when it is not this hook\'s event', () => {
  const hook = { src: '@impulse', reads: 'gain' };
  assert.ok(drive(hook, null, ev(), slots) > 0.6, 'a loud kick drives it');
  assert.equal(drive(hook, null, ev({ layer: 'bass', kind: 'bass' }), slots), 0, 'the bass does not');
  assert.equal(drive(hook, { src: 'bass' }, ev({ layer: 'bass', kind: 'bass' }), slots) > 0, true, 'until it is bound to');
  assert.equal(drive(hook, { over: 0.9 }, ev({ gain: 0.5 }), slots), 0, 'under the threshold is nothing');
  assert.ok(drive(hook, { over: 0.2 }, ev({ gain: 1.5 }), slots) > 0, 'over it is something');
  assert.ok(drive(hook, { depth: 2 }, ev(), slots) > drive(hook, { depth: 1 }, ev(), slots), 'depth scales it');
  assert.equal(drive(hook, { depth: 0 }, ev(), slots), 0, 'and nothing at zero');
  assert.equal(drive({ src: '@impulse', reads: 'note' }, null, ev(), slots), 0, 'a hook reading pitch ignores a drum');
  assert.ok(drive(hook, null, ev({ gain: 9 }), slots) <= 2, 'the result is bounded whatever the event claims');
});

test('defaults and changed: a world at rest binds nothing, and only real differences are kept', () => {
  const d = defaults(faceHooks);
  assert.deepEqual(Object.keys(d), Object.keys(faceHooks));
  assert.equal(d.cut.src, faceHooks.cut.src);
  assert.deepEqual(changed(faceHooks, d), {}, 'the defaults are not a change');
  assert.deepEqual(Object.keys(changed(faceHooks, { ...d, eyes: { ...d.eyes, src: 'bass' } })), ['eyes']);
  assert.deepEqual(changed(faceHooks, {}), {}, 'and nothing is nothing');
});

test('faces publishes a hooks table the page can build controls from', () => {
  assert.ok(Object.keys(faceHooks).length >= 12, 'enough of them to be worth a patch bay');
  for (const [k, h] of Object.entries(faceHooks)) {
    assert.ok(h.label && h.label.length > 3, `${k} needs a label in the world's own words`);
    assert.ok(h.src, `${k} needs something driving it by default`);
    assert.ok(READS[h.reads], `${k} reads "${h.reads}", which is not a control an event carries`);
  }
  assert.ok(!Object.values(faceHooks).some((h) => /impulse|ground|counter|transition/.test(h.label)), 'the labels are the world\'s language, not the engine\'s');
  assert.equal(faces.name, 'faces');
});
