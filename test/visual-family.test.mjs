// web/visual/family.mjs: the tree (children between their parents, caps, a layout with no overlaps), then the world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../web/visual/kit.mjs';
import { blend, childOf, newTree, birth, marry, layout, MAX_PEOPLE } from '../web/visual/family.mjs';

const tree = (n = 1) => { const s = { t: 0 }; seed(s, () => n / 7); newTree(s); return s; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('a child sits between its parents: colours mixed, numbers in range, no hat, deterministic', () => {
  const s = tree(), [A, B] = s.people.map((p) => p.char);
  const kid = childOf(A, B, s);
  rgb(kid.skin).forEach((v, i) => assert.ok(v >= Math.min(rgb(A.skin)[i], rgb(B.skin)[i]) - 1 && v <= Math.max(rgb(A.skin)[i], rgb(B.skin)[i]) + 1, 'skin channel between'));
  const lo = Math.min(A.face.width, B.face.width) * 0.97, hi = Math.max(A.face.width, B.face.width) * 1.03;
  assert.ok(kid.face.width >= lo && kid.face.width <= hi, 'face width between, give or take the noise');
  assert.equal(kid.hat.style, 'none');
  const s2 = tree(); assert.deepEqual(childOf(...s2.people.map((p) => p.char), s2), kid, 'same generator, same child');
  assert.equal(blend('round', 'round', s), 'round');
  assert.equal(blend(null, null, s), null);
});

test('births fill the focused couple up to its room, then the youngest couple with room; the cap holds', () => {
  const s = tree();
  assert.equal(s.people.length, 2); assert.equal(s.couples.length, 1);
  const room = s.couples[0].room;
  assert.ok(room >= 2 && room <= 5);
  for (let i = 0; i < 10; i++) { s.t += 1; birth(s); }
  assert.equal(s.couples[0].kids.length, room, 'founders stop at their room');
  assert.equal(s.people.length, 2 + room, 'and with nobody else married, births stop');
  s.t += 0.1; const n = s.people.length; s.t += 5; marry(s); s.lastBirth = s.t; assert.equal(birth(s), false, 'births are 0.4 s apart');
  assert.equal(s.people.length, n + 1, 'the marriage brought one in-law');
  for (let i = 0; i < 2000; i++) { s.t += 1; birth(s); if (i % 3 === 0) marry(s); }
  assert.ok(s.people.length <= MAX_PEOPLE, 'never past the cap');
  assert.ok(s.maxGen >= 3, 'the tree went deep');
});

test('marry takes the oldest unmarried blood child, old enough, and focuses the new couple', () => {
  const s = tree();
  s.t = 1; birth(s); s.t = 2; birth(s);
  assert.equal(marry(s), false, 'a newborn does not marry');
  s.t = 10; assert.equal(marry(s), true);
  const c = s.couples[s.focus], p = s.people[c.a], q = s.people[c.b];
  assert.equal(p.id, s.couples[0].kids[0], 'the first-born marries first');
  assert.ok(q.inlaw && q.gen === p.gen && p.partner === q.id && q.partner === p.id);
});

test('layout: no two people in one row overlap, children under their parents', () => {
  const s = tree(3);
  for (let i = 0; i < 400; i++) { s.t += 1; birth(s); if (i % 4 === 0) marry(s); }
  layout(s);
  const rows = new Map(); for (const p of s.people) { const r = rows.get(p.gen) ?? []; r.push(p.x); rows.set(p.gen, r); }
  for (const xs of rows.values()) { xs.sort((a, b) => a - b); for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 0.999, 'a slot apart'); }
  for (const c of s.couples) if (c.kids.length) {
    const mid = (s.people[c.a].x + s.people[c.b].x) / 2, kx = c.kids.map((k) => s.people[k].x);
    // the kids' blocks are centred on the couple; a married kid stands half a slot off its block's centre, so the drop lands within half a slot of the kids' span
    assert.ok(mid >= Math.min(...kx) - 0.5 - 1e-9 && mid <= Math.max(...kx) + 0.5 + 1e-9, 'kids under their parents');
  }
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'plain data');
});
