import test from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { lanePoints, laneSvg } from '../web/lane.mjs';

test('lanePoints samples a signal across the section; laneSvg draws it with bar lines', async () => {
  const g = await ready;
  const pts = lanePoints(g.saw.range(0, 1).slow(2), 2, 4);
  assert.equal(pts.length, 8); assert.ok(pts[0] < .1 && pts[7] > .8);
  const svg = laneSvg(pts, 2);
  assert.match(svg, /^<svg class="lane" viewBox="0 0 100 20"/); assert.match(svg, /<polyline points="/); assert.equal((svg.match(/<line /g) ?? []).length, 1, 'one bar line between two bars');
});
