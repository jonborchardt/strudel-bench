// web/visual/coder.mjs: the architecture a world must honour (injected randomness only, deterministic plain state,
// a repaint from state), plus what this world is about: hats type, kicks press Enter, snares go back and retune a
// number, melody notes type whole tokens, the bass feeds the scope, the pad runs the cells, a riser retunes faster,
// a boundary saves and opens a new tab. The look is judged from renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import coder, { tokens } from '../web/visual/coder.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';
const run = (ir, seconds = 8) => runWorld(coder, ir, seconds);
const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'coder' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const HAT = { ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' };
const SNARE = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' };

test('coder is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    assert.equal(composeVisual(song(g)).world, 'coder');
    p.draw(ctx, 320, 180);
    assert.ok(p.state.buf.length > 3, 'lines have been typed');
    assert.ok(ctx.calls.fillText > p.state.buf.length, 'the lines, the gutter, the tabs, the status');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job is a reading: a hat types, a kick enters, a snare retunes an earlier line, a melody note types a token, the bass feeds the scope, the pad opens the cells', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const fresh = () => createPerformance(coder, score).state;
  const one = (st, evs, cycle = 0) => { coder.step(st, STEP, evs, clockOf(score, cycle)); return st; };
  const st = one(fresh(), [HAT]);
  assert.equal(st.buf.length, 1); assert.ok(st.buf[0].text.length >= 1 && !st.buf[0].done, 'a hat types a character into an open line');
  one(st, [KICK]);
  assert.ok(st.buf[0].done && st.buf[0].text.length > 1, 'a kick finishes the line and commits it');
  one(st, [KICK]); one(st, [KICK]);
  const before = st.buf.map((l) => l.text).join('\n');
  one(st, [SNARE]);
  assert.ok(st.edit && st.edit.line < st.buf.length - 1, 'the edit cursor sits on an earlier line');
  assert.notEqual(st.buf.map((l) => l.text).join('\n'), before, 'that line changed');
  assert.ok(st.popups.some((p) => p.kind === 'log'), 'the log opened');
  one(st, [KICK]);
  assert.equal(st.edit, null, 'the next kick brings the cursor back');
  const mel = one(fresh(), [{ ...base, layer: 'melody', kind: 'melody', note: 72 }]);
  assert.match(mel.buf[0].text, /\S+$/, 'a whole token'); assert.ok(mel.glow > 0.9);
  const bass = one(fresh(), [{ ...base, layer: 'bass', kind: 'bass', note: 36 }]);
  assert.ok(bass.scope.amp > 0.5 && bass.popups.some((p) => p.kind === 'scope'));
  const pad = one(fresh(), [{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1 }]);
  assert.ok(pad.popups.some((p) => p.kind === 'cells'));
});

test('a boundary saves the file and opens a new tab; a riser retunes by itself; a dropout halts', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(coder, score).state;
  for (let i = 0; i < 4; i++) coder.step(st, STEP, [KICK], clockOf(score, 0));
  assert.equal(st.tabs.length, 1);
  coder.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95)));
  assert.equal(st.tabs.length, 2); assert.ok(st.buf.length >= 4, 'the buffer stays, so the old file scrolls off'); assert.match(st.tabs[1], /^drop\./);
  const r = createPerformance(coder, score).state;
  for (let i = 0; i < 6; i++) coder.step(r, STEP, [KICK], clockOf(score, 1.2));
  for (let i = 0; i < 120; i++) coder.step(r, STEP, [], clockOf(score, 1.9)); // the intro's last bar: the riser
  assert.ok(r.buf.some((l) => l.edited), 'the riser went back and retuned');
  for (let i = 0; i < 120; i++) coder.step(r, STEP, [], clockOf(score, 3.5)); // the drop's dropout bar
  assert.ok(r.dark > 0.9);
});

test('tokens colour comments, strings, numbers and keywords', () => {
  assert.deepEqual(tokens('x = 1.5 // hi').map((t) => t.k), ['ident', 'plain', 'plain', 'plain', 'number', 'plain', 'comment']);
  assert.equal(tokens('#define TICK 240')[0].k, 'keyword');
  assert.equal(tokens('#[derive(Clone)]')[0].k, 'plain');
  assert.equal(tokens('# a python comment')[0].k, 'comment');
  assert.equal(tokens('return "worlds/default.uni"')[2].k, 'string');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(coder, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.equal(p.state.buf.length, 1);
  p.draw(ctxStub(), 320, 180);
});
