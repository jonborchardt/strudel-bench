// The drawing, pinned. A change to the figure is made on purpose or not at all, and `build` all 1 draws exactly the
// figure that existed before builds did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { portraitOps, toSvg, drawOn, eyeY, mouthY, feetY } from '../index.mjs';
import { ctxStub } from './_stub.mjs';

// the drawing is pinned: four portraits' ops as they were on 2026-10-05, so a change to the figure is made on purpose or not at all (UPDATE_GOLDEN=1, then read the diff)
const OPS_CASES = { plain: {}, up: { props: ['handsUp'] }, skirt: { pants: { style: 'skirt' }, top: { style: 'tunic' }, jacket: { style: 'blazer' } }, tall: { face: { height: 230 }, neck: { height: 90 } } };
test('the portrait draws the ops it drew before build existed (test/fixtures/portrait-ops-golden.json)', () => {
  const url = new URL('./fixtures/portrait-ops-golden.json', import.meta.url), now = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(OPS_CASES).map(([k, o]) => [k, portraitOps(o)]))));
  if (process.env.UPDATE_GOLDEN) writeFileSync(url, JSON.stringify(now));
  const golden = JSON.parse(readFileSync(url, 'utf8'));
  for (const k of Object.keys(OPS_CASES)) assert.deepEqual(now[k], golden[k], k);
});

test('build: the body\'s proportions, all 1 the figure as it was', () => {
  const plain = portraitOps({}), dwarf = portraitOps({ build: { trunk: 0.8, legs: 0.55, shoulders: 1.3, arms: 0.8, head: 1.15 } });
  assert.deepEqual(portraitOps({ build: { trunk: 1, legs: 1, shoulders: 1, arms: 1, head: 1 } }), plain, 'all 1 draws today\'s figure');
  assert.ok(feetY({}) === 1078 && feetY({ build: { legs: 0.55 } }) < 900, 'the feet rise with short legs');
  const legs = (ops) => ops.find((o) => o.k === 'path' && o.fill === '#2e3136'); assert.ok(legs(dwarf) && /^M 83 548 L 317 548 /.test(legs(dwarf).d), 'the legs are drawn from the shorter trunk\'s hem (356 + 240 x 0.8), as wide as the shoulders build makes the body');
  assert.equal(Math.round(feetY({ build: { trunk: 0.8, legs: 0.55 } }) * 10) / 10, 824.1, 'and the feet land where the hem plus the shortened legs put them');
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(portraitOps({ build: { trunk: 0, legs: -1, head: 0 } }))), 'a zero or negative build is clamped, never NaN');
  const headScale = (ops) => ops.find((o) => o.k === 'push' && o.cy === 308)?.sc ?? 1; assert.equal(headScale(dwarf), 1.15, 'the head group carries its scale'); assert.equal(headScale(plain), 1, 'and none when it is 1');
  assert.ok(toSvg(dwarf).includes('scale(1.15)'), 'and the svg prints it');
  const ctx = ctxStub(); drawOn(ctx, dwarf); assert.equal(ctx.calls.save, ctx.calls.restore); assert.ok(ctx.calls.scale >= 2, 'the canvas scales the head group (twice: the back hair and the head)');
  const shoulder = (ops) => Math.max(...ops.filter((o) => o.k === 'clip' && o.d.startsWith('M 200 330')).flatMap((o) => o.d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2 === 0))) - 200; // the trunk clip's half width about the centre
  assert.ok(Math.abs(shoulder(dwarf) - shoulder(plain) * 1.3) < 1e-6, 'the trunk is wider by the shoulders build');
  // the eye line a world frames on is where the eyes draw: the head group scales about the neck base (308), so a bigger head lifts its eyes
  assert.equal(Math.round(eyeY({ build: { head: 1.15 } }) * 10) / 10, 179.2, 'eyeY follows the head\'s scale about the neck base (308 + (196 - 308) x 1.15)'); assert.equal(eyeY({}), 196);
  assert.equal(Math.round(mouthY({ build: { head: 1.15 } }) * 10) / 10, Math.round((308 + (260 - 308) * 1.15) * 10) / 10, 'and so does mouthY');
});

