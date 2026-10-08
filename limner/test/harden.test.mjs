// The hardening loop's hands: the lints that rank a cell for eyes, the sampler that fills a sheet, the sheet's html,
// the ledger that remembers. No browser here: the screenshot is the script's business.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portraitOps } from '../index.mjs';
import { blank } from '../schema.mjs';
import { SHEET, pointsOf, lintOps, lintState } from '../scripts/harden/lint.mjs';

test('lint: pointsOf reads every op kind as x,y pairs', () => {
  assert.deepEqual(pointsOf({ k: 'path', d: 'M 10 20 L 30 40 C 1 2 3 4 5 6 Z' }), [[10, 20], [30, 40], [1, 2], [3, 4], [5, 6]]);
  assert.deepEqual(pointsOf({ k: 'ellipse', cx: 5, cy: 6, rx: 1, ry: 2 }), [[5, 6]]);
  assert.deepEqual(pointsOf({ k: 'rect', x: 1, y: 2, w: 3, h: 4 }), [[1, 2], [4, 6]]);
  assert.deepEqual(pointsOf({ k: 'line', x1: 1, y1: 2, x2: 3, y2: 4 }), [[1, 2], [3, 4]]);
  assert.deepEqual(pointsOf({ k: 'push', cx: 200, cy: 308, sc: 1.2 }), []);
});

test('lint: the default figure is clean, a stray point is offsheet, a NaN is nan', () => {
  assert.deepEqual(lintOps(portraitOps({})), []);
  const stray = [...portraitOps({}), { k: 'path', d: 'M 200 300 L 9000 9000', fill: '#000' }];
  assert.deepEqual(lintOps(stray).map((f) => f.name), ['render:offsheet']);
  assert.match(lintOps(stray)[0].detail, /9000/);
  const nan = [{ k: 'ellipse', cx: NaN, cy: 100, rx: 1, ry: 1 }];
  assert.ok(lintOps(nan).some((f) => f.name === 'render:nan'));
  assert.ok(SHEET.x0 < -30 && SHEET.x1 > 430 && SHEET.y0 < -200 && SHEET.y1 > 1084, 'the bounds are the figure sheet plus a margin');
});

test('lint: a stance that moves nothing is pose:stance-noop, a real one is not', () => {
  const st = { ...blank(), ov: { 'pose.turn': 0.6, 'pose.shoulder': 0.7, props: ['handsUp'] } };
  assert.deepEqual(lintState(st, { cast: 'editorial', stance: 'handsUp', expression: 'deadpan', view: 'figure' }), []);
  const still = { ...blank(), ov: {} };
  const flags = lintState(still, { cast: 'editorial', stance: 'deadStill', expression: 'deadpan', view: 'figure' });
  assert.deepEqual(flags.map((f) => f.name), ['pose:stance-noop']);
  assert.deepEqual(flags[0].parts, ['stance:deadStill']);
  assert.deepEqual(lintState(still, { cast: 'editorial', stance: 'none', expression: 'deadpan', view: 'bust' }), [], 'no stance, no noop check');
});
