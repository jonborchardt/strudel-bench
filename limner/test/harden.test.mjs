// The hardening loop's hands: the lints that rank a cell for eyes, the sampler that fills a sheet, the sheet's html,
// the ledger that remembers. No browser here: the screenshot is the script's business.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portraitOps, renderFigure, HAIR } from '../index.mjs';
import { blank } from '../schema.mjs';
import { SHEET, pointsOf, lintOps, lintState, muzzleGap, hairOverEye, HAIR_EYE_CLEAR, hornStrokesOut, mouthPastMuzzle, MOUTH_PAST_MUZZLE } from '../scripts/harden/lint.mjs';
import { CASTS } from '../registry.mjs';
import { EXPRESSIONS } from '../people.mjs';
import { params, decode, encode } from '../schema.mjs';
import { CALIBRATION, gridOf, keyOf, stateFor, nowState, pickCells, bump, relatedCells, drawsPart } from '../scripts/harden/sampler.mjs';
import { CROPS, LAYOUT, svgOf, sheetHtml, pairsHtml, chromePath } from '../scripts/harden/sheet.mjs';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATEGORIES, fingerprint, nextId, record, merge, rank, close, load, save, MAX_ATTEMPTS, attempt, isParked, statsOf } from '../scripts/harden/ledger.mjs';

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
  const [vx, vy, vw, vh] = renderFigure({}).match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  assert.deepEqual(SHEET, { x0: vx, x1: vx + vw, y0: vy, y1: vy + vh }, 'the bounds are renderFigure\'s own frame, no margin');
});

test('lint: the broadest build stands inside renderFigure\'s frame, hands and hem included (T006)', () => {
  const hashes = ['eyJzZWVkIjo4MzYyMDQsImZhbWlseSI6ImFueSIsInRoZW1lIjoiZHJhZ29uYm9ybiIsIm92Ijp7Im1vdXRoLnNtaWxlIjowLjA1LCJtb3V0aC5vcGVuIjowLCJtb3V0aC5za2V3IjowLjIsIm1vdXRoLnByZXNzIjowLjMsImV5ZXMub3Blbm5lc3MiOjAuNiwiZXllcy5icm93TGlmdCI6LTQsImV5ZXMuYnJvd1NrZXciOjAsImV5ZXMuYnJvd0lubmVyIjotMiwiZXllcy5zcXVpbnQiOjAuNSwicG9zZS5oZWFkWCI6MCwicG9zZS5oZWFkWSI6MCwicG9zZS5oZWFkVGlsdCI6MC4wMiwicG9zZS5ib2R5VGlsdCI6MCwicG9zZS50dXJuIjowLjE1LCJwb3NlLnNob3VsZGVyIjowLjMsInByb3BzIjpbXX19', 'eyJzZWVkIjoxODUxOTcsImZhbWlseSI6ImFueSIsInRoZW1lIjoiZHJhZ29uYm9ybiIsIm92Ijp7Im1vdXRoLnNtaWxlIjowLjA2LCJtb3V0aC5vcGVuIjowLCJtb3V0aC5za2V3IjowLCJtb3V0aC5wcmVzcyI6MCwiZXllcy5vcGVubmVzcyI6MC4wNCwiZXllcy5icm93TGlmdCI6MCwiZXllcy5icm93U2tldyI6MCwiZXllcy5icm93SW5uZXIiOjEsImV5ZXMuc3F1aW50IjowLCJwb3NlLmhlYWRYIjo4LCJwb3NlLmhlYWRZIjowLCJwb3NlLmhlYWRUaWx0IjowLjEyLCJwb3NlLmJvZHlUaWx0IjowLjA2LCJwb3NlLnR1cm4iOjAuNCwicG9zZS5zaG91bGRlciI6LTAuNSwicHJvcHMiOltdfX0'];
  for (const h of hashes) {
    const st = decode(h), p = params(st), ops = portraitOps(p);
    assert.ok(!lintState(st, { cast: 'dragonborn', stance: 'none', expression: 'none', view: 'figure' }).some((f) => f.name === 'render:offsheet'));
    let d = 0, x0 = Infinity, x1 = -Infinity; // the drawn extent with an ellipse's radius, which the lint's centre point leaves out: a hand is an ellipse
    for (const op of ops) { if (op.k === 'clip') d++; else if (op.k === 'unclip') d--; else if (!d) for (const [x] of op.k === 'ellipse' ? [[op.cx - op.rx], [op.cx + op.rx]] : pointsOf(op)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }
    assert.ok(x0 < -30 && x1 > 430, `the evidence is wider than the old frame (${x0}..${x1}), so the lint at no margin would have named it`);
    assert.ok(x0 >= SHEET.x0 && x1 <= SHEET.x1, `${x0}..${x1} inside ${SHEET.x0}..${SHEET.x1}`);
  }
});

test('lint: offsheet ignores strokes under a clip (T004) and stands the figure on its floor (T005)', () => {
  const hair = decode('eyJzZWVkIjo5NDgxMzUsImZhbWlseSI6ImFueSIsInRoZW1lIjoic3ludGh3YXZlIiwib3YiOnsibW91dGguc21pbGUiOjAuOTIsIm1vdXRoLm9wZW4iOjAsIm1vdXRoLnNrZXciOjAsIm1vdXRoLnByZXNzIjowLCJleWVzLm9wZW5uZXNzIjowLjg1LCJleWVzLmJyb3dMaWZ0IjoxLCJleWVzLmJyb3dTa2V3IjowLCJleWVzLmJyb3dJbm5lciI6MCwiZXllcy5zcXVpbnQiOjAuNzV9fQ');
  const tall = decode('eyJzZWVkIjozNzM2NTksImZhbWlseSI6ImFueSIsInRoZW1lIjoiZHJhZ29uYm9ybiIsIm92Ijp7Im1vdXRoLnNtaWxlIjotMC4wNSwibW91dGgub3BlbiI6MCwibW91dGguc2tldyI6MCwibW91dGgucHJlc3MiOjAsImV5ZXMub3Blbm5lc3MiOjEsImV5ZXMuYnJvd0xpZnQiOjAsImV5ZXMuYnJvd1NrZXciOjAsImV5ZXMuYnJvd0lubmVyIjowLCJleWVzLnNxdWludCI6MH19');
  for (const st of [hair, tall]) assert.ok(!lintState(st, { cast: st.theme, stance: 'none', expression: 'none', view: 'figure' }).some((f) => f.name === 'render:offsheet'), st.theme);
  const clipped = [{ k: 'clip', d: 'M 0 0 L 100 0 L 100 100 Z' }, { k: 'path', d: 'M 200 300 L 9000 9000' }, { k: 'unclip' }];
  assert.deepEqual(lintOps(clipped), [], 'a stroke under a clip cannot stray');
  assert.deepEqual(lintOps([...clipped, { k: 'path', d: 'M 200 300 L 9000 9000' }]).map((f) => f.name), ['render:offsheet'], 'after the unclip it can');
  assert.deepEqual(lintOps([{ k: 'ellipse', cx: 200, cy: 1140, rx: 5, ry: 5 }], { dy: -91 }), [], 'a tall figure\'s shoe lands on the floor');
});

test('lint: anatomy:mouth-past-muzzle, a wide mouth under a muzzle is no wider than a plain one there (T058)', () => {
  const st = decode('eyJzZWVkIjo1NDg1ODMsImZhbWlseSI6ImFueSIsInRoZW1lIjoiZHJhZ29uYm9ybiIsIm92Ijp7Im1vdXRoLnNtaWxlIjotMC4xLCJtb3V0aC5vcGVuIjowLCJtb3V0aC5za2V3IjowLCJtb3V0aC5wcmVzcyI6MCwiZXllcy5vcGVubmVzcyI6MS40NSwiZXllcy5icm93TGlmdCI6MTAsImV5ZXMuYnJvd1NrZXciOjAsImV5ZXMuYnJvd0lubmVyIjo0LCJleWVzLnNxdWludCI6MH19'), p = params(st);
  assert.equal(p.mouth.style, 'wide');
  assert.ok(mouthPastMuzzle(p) <= MOUTH_PAST_MUZZLE, `the evidence face's mouth stays near the pad (${mouthPastMuzzle(p)})`);
  assert.ok(!lintState(st, { cast: 'dragonborn', stance: 'none', expression: 'none', view: 'bust' }).some((f) => f.name === 'anatomy:mouth-past-muzzle'));
  assert.ok(mouthPastMuzzle({ ...p, mouth: { ...p.mouth, width: p.mouth.width * 1.3 } }) > MOUTH_PAST_MUZZLE, 'the old width, wide times the muzzle widening, is flagged');
});
test('lint: anatomy:muzzle-mouth, the mouth line runs under a muzzle\'s nostrils and not through them (T007)', () => {
  const st = decode('eyJzZWVkIjoxODUxOTcsImZhbWlseSI6ImFueSIsInRoZW1lIjoiZHJhZ29uYm9ybiIsIm92Ijp7Im1vdXRoLnNtaWxlIjowLjA2LCJtb3V0aC5vcGVuIjowLCJtb3V0aC5za2V3IjowLCJtb3V0aC5wcmVzcyI6MCwiZXllcy5vcGVubmVzcyI6MC4wNCwiZXllcy5icm93TGlmdCI6MCwiZXllcy5icm93U2tldyI6MCwiZXllcy5icm93SW5uZXIiOjEsImV5ZXMuc3F1aW50IjowLCJwb3NlLmhlYWRYIjo4LCJwb3NlLmhlYWRZIjowLCJwb3NlLmhlYWRUaWx0IjowLjEyLCJwb3NlLmJvZHlUaWx0IjowLjA2LCJwb3NlLnR1cm4iOjAuNCwicG9zZS5zaG91bGRlciI6LTAuNSwicHJvcHMiOltdfX0');
  const p = params(st);
  assert.ok(muzzleGap(p) >= 2, `the evidence face's mouth sits under the nostrils (${muzzleGap(p)})`);
  assert.ok(!lintState(st, { cast: 'dragonborn', stance: 'none', expression: 'none', view: 'bust' }).some((f) => f.name === 'anatomy:muzzle-mouth'));
  for (const style of ['straight', 'short', 'long', 'broad', 'aquiline']) for (const length of [22, 40, 58]) assert.ok(muzzleGap({ ...p, nose: { ...p.nose, style, length } }) >= 2, `${style} ${length}`);
});

test('lint: render:horn-stroke-out, a horn\'s ridges and highlight end inside the horn (T010)', () => {
  const st = decode('eyJzZWVkIjo2NDA0NzUsImZhbWlseSI6ImFueSIsInRoZW1lIjoidGllZmxpbmdzIiwib3YiOnsibW91dGguc21pbGUiOjAuMDUsIm1vdXRoLm9wZW4iOjAsIm1vdXRoLnNrZXciOjAuMiwibW91dGgucHJlc3MiOjAuMywiZXllcy5vcGVubmVzcyI6MC42LCJleWVzLmJyb3dMaWZ0IjotNCwiZXllcy5icm93U2tldyI6MCwiZXllcy5icm93SW5uZXIiOi0yLCJleWVzLnNxdWludCI6MC41fX0');
  const ops = portraitOps(params(st)), h = ops.findIndex((o) => o.horn);
  assert.ok(h >= 0, 'the evidence face wears horns');
  assert.equal(hornStrokesOut(ops), null);
  assert.ok(!lintState(st, { cast: 'tieflings', stance: 'none', expression: 'squint', view: 'bust' }).some((f) => f.name === 'render:horn-stroke-out'));
  const [x, y] = pointsOf(ops[h])[0], whisker = [...ops.slice(0, h + 1), { k: 'path', d: `M ${x} ${y - 10} Q ${x + 20} ${y - 18} ${x + 40} ${y - 14}`, fill: 'none' }, ...ops.slice(h + 1)];
  assert.ok(hornStrokesOut(whisker), 'a ridge run out past the horn is named');
});

test('lint: stack:hair-over-eye, a bluntBob\'s panels hang beside the eyes, not over them (T012)', () => {
  const st = decode('eyJzZWVkIjoxMDM5MDcsImZhbWlseSI6ImFueSIsInRoZW1lIjoibm9uZSIsIm92Ijp7Im1vdXRoLnNtaWxlIjowLjEyLCJtb3V0aC5vcGVuIjowLCJtb3V0aC5za2V3IjowLjgsIm1vdXRoLnByZXNzIjowLCJleWVzLm9wZW5uZXNzIjowLjksImV5ZXMuYnJvd0xpZnQiOjAsImV5ZXMuYnJvd1NrZXciOjAuMzUsImV5ZXMuYnJvd0lubmVyIjowLCJleWVzLnNxdWludCI6MC4yNSwicG9zZS5oZWFkWCI6MCwicG9zZS5oZWFkWSI6MCwicG9zZS5oZWFkVGlsdCI6MC4wMiwicG9zZS5ib2R5VGlsdCI6MCwicG9zZS50dXJuIjowLjE1LCJwb3NlLnNob3VsZGVyIjowLjMsInByb3BzIjpbXX19');
  const p = params(st), tuple = { cast: 'editorial', stance: 'directFrontal', expression: 'smirk', view: 'figure' };
  assert.equal(p.hair.style, 'bluntBob');
  assert.ok(!lintState(st, tuple).some((f) => f.name === 'stack:hair-over-eye'), `the evidence face's panels clear the eyes (${hairOverEye(p)})`);
  const front = HAIR.bluntBob.front;
  try { // the panels as they were cut before the fix: an inner edge ~6 outside the eye's corner
    HAIR.bluntBob.front = (q) => [{ k: 'path', d: 'M 116 170 C 108 121, 124 86, 154 73 C 178 62, 222 62, 246 73 C 276 86, 292 121, 284 170 L 272 245 L 243 245 C 248 210, 247 166, 236 140 C 221 112, 179 112, 164 140 C 153 166, 152 210, 157 245 L 128 245 Z', fill: q.hairColor }];
    assert.ok(lintState(st, tuple).some((f) => f.name === 'stack:hair-over-eye' && f.parts[0] === 'hair:bluntBob'));
  } finally { HAIR.bluntBob.front = front; }
  for (const width of [140, 156, 175]) assert.ok(hairOverEye({ ...p, face: { ...p.face, width, height: 204 }, eyes: { ...p.eyes, spacing: 56, y: 196 } }) < -HAIR_EYE_CLEAR, `width ${width}`);
  assert.ok(hairOverEye({ ...p, hair: { ...p.hair, style: 'combOver' } }) === -Infinity, 'temple wings are not panels');
});

test('lint: stack:hair-over-eye, the bob and long hair hang their panels beside the face, not across it (T022)', () => {
  const cases = [
    ['bob', { cast: 'halflings', stance: 'none', expression: 'halfSmile', view: 'bust' }, 'eyJzZWVkIjo5ODM3MzEsImZhbWlseSI6ImFueSIsInRoZW1lIjoiaGFsZmxpbmdzIiwib3YiOnsibW91dGguc21pbGUiOjAuMjQsIm1vdXRoLm9wZW4iOjAsIm1vdXRoLnNrZXciOjAsIm1vdXRoLnByZXNzIjowLCJleWVzLm9wZW5uZXNzIjoxLCJleWVzLmJyb3dMaWZ0IjowLCJleWVzLmJyb3dTa2V3IjowLCJleWVzLmJyb3dJbm5lciI6MCwiZXllcy5zcXVpbnQiOjAuMTV9fQ'],
    ['longStraight', { cast: 'gnomes', stance: 'none', expression: 'wideEyed', view: 'bust' }, 'eyJzZWVkIjo2MjkwMjYsImZhbWlseSI6ImFueSIsInRoZW1lIjoiZ25vbWVzIiwib3YiOnsibW91dGguc21pbGUiOi0wLjEsIm1vdXRoLm9wZW4iOjAsIm1vdXRoLnNrZXciOjAsIm1vdXRoLnByZXNzIjowLCJleWVzLm9wZW5uZXNzIjoxLjQ1LCJleWVzLmJyb3dMaWZ0IjoxMCwiZXllcy5icm93U2tldyI6MCwiZXllcy5icm93SW5uZXIiOjQsImV5ZXMuc3F1aW50IjowfX0'],
  ];
  for (const [style, tuple, hash] of cases) {
    const st = decode(hash), p = params(st);
    assert.equal(p.hair.style, style);
    assert.ok(!lintState(st, tuple).some((f) => f.name === 'stack:hair-over-eye'), `${style}: the evidence face's panels clear the eyes (${hairOverEye(p)})`);
    for (const width of [140, 156, 175]) assert.ok(hairOverEye({ ...p, face: { ...p.face, width, height: 204 }, eyes: { ...p.eyes, spacing: 68, y: 196 } }) < -HAIR_EYE_CLEAR, `${style} width ${width} at the widest eye spacing`);
  }
  const front = HAIR.bob.front;
  try { // the bob's panels as they were cut before the fix: the inner edge at x 152 on the eye line, narrowing to a point at the jaw
    HAIR.bob.front = (q) => [{ k: 'path', d: 'M 118 171 C 108 126, 121 90, 151 76 C 177 64, 223 64, 249 76 C 279 90, 292 126, 282 171 L 272 246 C 256 236, 250 211, 248 183 C 245 145, 228 117, 200 112 C 172 117, 155 145, 152 183 C 150 211, 144 236, 128 246 Z', fill: q.hairColor }];
    assert.ok(lintState(decode(cases[0][2]), cases[0][1]).some((f) => f.name === 'stack:hair-over-eye' && f.parts[0] === 'hair:bob'));
  } finally { HAIR.bob.front = front; }
});

test('the vanDyke moustache sits over the mouth, not cheek to cheek (T001)', () => {
  const st = decode('eyJzZWVkIjo4MTAzODQsImZhbWlseSI6ImFueSIsInRoZW1lIjoic2NpZmkiLCJvdiI6eyJtb3V0aC5zbWlsZSI6LTAuNSwibW91dGgub3BlbiI6MCwibW91dGguc2tldyI6MCwibW91dGgucHJlc3MiOjAsImV5ZXMub3Blbm5lc3MiOjAuOSwiZXllcy5icm93TGlmdCI6LTEsImV5ZXMuYnJvd1NrZXciOjAsImV5ZXMuYnJvd0lubmVyIjo1LCJleWVzLnNxdWludCI6MH19');
  const span = (style) => { const xs = portraitOps(params({ ...st, ov: { ...st.ov, 'facialHair.style': style } })).filter((o) => o.stache).flatMap((o) => pointsOf(o).map(([x]) => x)); return Math.max(...xs) - Math.min(...xs); };
  assert.ok(span('vanDyke') <= span('goatee') * 1.3, `vanDyke (control points included) ${span('vanDyke').toFixed(1)} against the goatee's chevron ${span('goatee').toFixed(1)}: a moustache is as wide as the mouth it sits on, its turned ends a little past`);
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

test('sampler: the grid is every cast x its stances x its expressions x view, stances only as figures', () => {
  const grid = gridOf();
  assert.ok(grid.length > 500, `${grid.length} cells`);
  assert.ok(grid.every((t) => CASTS[t.cast] && EXPRESSIONS[t.expression] && ['bust', 'figure'].includes(t.view)));
  assert.ok(grid.every((t) => t.stance === 'none' || t.view === 'figure'), 'a stance is a body');
  assert.ok(grid.some((t) => t.cast === 'undead' && t.stance === 'thrillerClaw'), 'a cast reaches its own stance pack');
  assert.ok(grid.some((t) => t.cast === 'undead' && t.expression === 'hunger'), 'and its own expressions');
  assert.ok(!grid.some((t) => t.cast === 'elves' && t.expression === 'hunger'), 'but not another cast\'s');
  assert.equal(new Set(grid.map(keyOf)).size, grid.length, 'every key is unique');
  const fake = { ghosts: { ...CASTS.editorial, name: 'ghosts', expressions: ['deadpan', 'notAnExpression'] } };
  assert.ok(!gridOf(fake).some((t) => t.expression === 'notAnExpression'), 'an expression EXPRESSIONS lacks is skipped, not thrown');
});

test('sampler: a tuple and a seed are a state the editor opens, drawn in that stance and expression', () => {
  const st = stateFor({ cast: 'elves', stance: 'swaggerLean', expression: 'grin', view: 'figure' }, 42);
  assert.equal(st.theme, 'elves'); assert.equal(st.seed, 42);
  assert.equal(st.ov['pose.turn'], 0.6); assert.equal(st.ov['mouth.smile'], 0.92);
  assert.equal(params(st).pose.turn, 0.6, 'the ov lands on the drawn params');
  assert.equal(stateFor({ cast: 'editorial', stance: 'none', expression: 'deadpan', view: 'bust' }, 1).theme, 'none');
  assert.ok(decode(CALIBRATION).seed, 'the calibration hash decodes');
});

test('sampler: cell 1 is calibration, flagged cells come first, the rest are the least covered, and it is deterministic', () => {
  const flagOn = (st, t) => (t.cast === 'orcs' ? [{ name: 'render:offsheet', parts: [], detail: '' }] : []);
  const covered = Object.fromEntries(gridOf().filter((t) => t.view === 'bust' && t.cast !== 'editorial').map((t) => [keyOf(t), 5]));
  const a = pickCells({ coverage: covered, n: 5, view: 'bust', sheet: 3, lint: flagOn, pool: 120 });
  const b = pickCells({ coverage: covered, n: 5, view: 'bust', sheet: 3, lint: flagOn, pool: 120 });
  assert.deepEqual(a, b, 'same inputs, same sheet');
  assert.equal(a.length, 5);
  assert.equal(a[0].source, 'calibration'); assert.equal(a[0].tuple.cast, 'calibration'); assert.equal(a[0].tuple.view, 'bust');
  assert.ok(a.slice(1).every((c) => c.tuple.view === 'bust'));
  const flagged = a.filter((c) => c.source === 'flagged');
  assert.ok(flagged.length >= 1 && flagged.every((c) => c.tuple.cast === 'orcs' && c.flags.length === 1));
  assert.ok(a.filter((c) => c.source === 'coverage').every((c) => c.tuple.cast === 'editorial'), 'the uncovered cast fills the rest');
  assert.ok(a.every((c) => c.flags.length === 0 || c.source === 'flagged'));
  const keys = a.slice(1).map((c) => keyOf(c.tuple)); assert.equal(new Set(keys).size, keys.length, 'no tuple twice on one sheet');
  const cov = bump({}, a);
  assert.equal(Object.keys(cov).length, 4, 'calibration is not coverage'); assert.ok(Object.values(cov).every((v) => v === 1));
  assert.notDeepEqual(pickCells({ coverage: {}, n: 3, view: 'figure', sheet: 4, lint: () => [], pool: 0 }), pickCells({ coverage: {}, n: 3, view: 'figure', sheet: 5, lint: () => [], pool: 0 }), 'another sheet, other seeds');
});

test('sheet: a cell draws as a bust or a figure, cropped when asked', () => {
  const st = stateFor({ cast: 'dwarves', stance: 'none', expression: 'grin', view: 'bust' }, 3);
  assert.match(svgOf(st, 'bust'), /viewBox="0 0 400 480"/);
  assert.match(svgOf(st, 'figure'), /viewBox="-90 -200 580 1284"/);
  assert.match(svgOf(st, 'bust', 'head'), new RegExp(`viewBox="${CROPS.head}"`));
  assert.match(svgOf(st, 'bust', '10 20 30 40'), /viewBox="10 20 30 40"/, 'a crop may be a viewBox of its own');
});

test('sheet: the html numbers and labels every cell and lays the view out', () => {
  const cells = pickCells({ coverage: {}, n: 3, view: 'figure', sheet: 9, lint: () => [], pool: 0 });
  const html = sheetHtml(cells, { view: 'figure' });
  assert.equal((html.match(/<figure id="c\d+"/g) ?? []).length, 3);
  assert.match(html, /<figcaption>1 calibration<\/figcaption>/);
  assert.match(html, new RegExp(`<figcaption>2 ${cells[1].tuple.cast}/${cells[1].tuple.stance}/${cells[1].tuple.expression}`));
  assert.match(html, new RegExp(`width:${LAYOUT.figure.cell}px`));
  assert.equal((html.match(/<svg/g) ?? []).length, 3);
  assert.match(sheetHtml(cells, { view: 'figure', crop: 'eyes' }), new RegExp(`viewBox="${CROPS.eyes}"`), 'a cropped sheet draws busts cropped');
});

test('sheet: verify pairs put the old cell crop beside the new drawing at one width', () => {
  const html = pairsHtml([{ label: 'T001 cell 4', before: { png: 'AAAA', rect: { x: 10, y: 20, w: 220, h: 600 } }, after: '<svg viewBox="0 0 1 1"></svg>' }], 220);
  assert.match(html, /margin:-20px 0 0 -10px/); assert.match(html, /data:image\/png;base64,AAAA/); assert.match(html, /T001 cell 4/); assert.match(html, /<svg viewBox/);
});

test('sheet: verify --crop enlarges the region of the then cell to the pair width', () => {
  const html = pairsHtml([{ label: 'T007 cell 7', before: { png: 'AAAA', rect: { x: 0, y: 0, w: 400, h: 480 }, crop: { x: 50, y: 40, w: 320, h: 330 } }, after: '<svg viewBox="50 40 320 330"></svg>' }], 320);
  assert.match(html, /transform:scale\(1\)/); assert.match(html, /margin:-40px 0 0 -50px/); assert.match(html, /width:320px;height:330px/); assert.match(html, /then \(enlarged\), now/);
  const half = pairsHtml([{ label: 'x', before: { png: 'AAAA', rect: { x: 10, y: 20, w: 200, h: 300 }, crop: { x: 50, y: 40, w: 320, h: 330 } }, after: '' }], 320);
  assert.match(half, /transform:scale\(2\)/); assert.match(half, /margin:-80px 0 0 -70px/, 'sx 10+25, sy 20+20, both doubled');
  const fig = pairsHtml([{ label: 'x', before: { png: 'AAAA', rect: { x: 0, y: 0, w: 230, h: 700 }, crop: { x: 50, y: 40, w: 320, h: 330 }, frame: { x: -30, y: -260, w: 460 } }, after: '' }], 320);
  assert.match(fig, /transform:scale\(2\)/); assert.match(fig, /margin:-300px 0 0 -80px/, 'a figure cell: (50+30)/2 and (40+260)/2 at half scale, doubled');
});

test('sheet: a pair with no then side labels the empty pane', () => {
  const html = pairsHtml([{ label: 'T001 evidence 1', before: null, after: '<svg viewBox="0 0 1 1"></svg>' }], 220);
  assert.match(html, /then: not on disk/); assert.match(html, /<svg viewBox/); assert.ok(!/data:image/.test(html));
});

const finding = (o = {}) => ({ cell: 2, category: 'stack', parts: ['hat:leafCirclet', 'hair:highBun'], severity: 2, note: 'circlet floats clear of the bun', hash: 'H1', tuple: 'elves/none/grin/bust', ...o });

test('ledger: a finding opens a todo, the same fingerprint seen again counts, a refused one writes nothing', () => {
  const todos = [];
  const r1 = record(todos, [finding()], { sheet: '0001', today: '2026-10-07' });
  assert.deepEqual(r1.opened, ['T001']); assert.equal(todos.length, 1);
  assert.equal(todos[0].title, 'circlet floats clear of the bun'); assert.deepEqual(todos[0].parts, ['hair:highBun', 'hat:leafCirclet'], 'parts are sorted');
  assert.equal(fingerprint(todos[0]), 'stack:hair:highBun+hat:leafCirclet');
  const r2 = record(todos, [finding({ hash: 'H2', note: 'again, on a bob', parts: ['hair:highBun', 'hat:leafCirclet'] })], { sheet: '0002', today: '2026-10-08' });
  assert.deepEqual(r2.seen, ['T001']); assert.equal(todos.length, 1); assert.equal(todos[0].seen, 2);
  assert.deepEqual(todos[0].evidence, ['H1', 'H2']); assert.deepEqual(todos[0].sheets, ['0001', '0002']); assert.deepEqual(todos[0].notes, ['circlet floats clear of the bun', 'again, on a bob']);
  const r3 = record(todos, [finding({ parts: [] }), finding({ category: 'ugly' }), finding({ severity: 7 }), finding({ hash: undefined }), finding({ parts: ['circlet'] })], { sheet: '0003', today: '2026-10-08' });
  assert.equal(r3.refused.length, 5); assert.match(r3.refused[4].why, /kind:name.*"circlet"/);
  assert.equal(record([], [finding({ parts: ['unknown', 'unknown:muzzle'] })], { sheet: '0003', today: '2026-10-08' }).refused.length, 0, 'unknown and unknown:word are shapes'); assert.equal(todos.length, 1); assert.equal(todos[0].seen, 2);
  assert.match(r3.refused[0].why, /parts/); assert.match(r3.refused[1].why, new RegExp(CATEGORIES.join('|')));
  assert.equal(nextId(todos), 'T002');
});

test('ledger: rank is severity x seen then older first; close records the commit; wontfix is reported, never reopened', () => {
  const todos = [];
  record(todos, [finding({ note: 'a', parts: ['x:a'], severity: 1 }), finding({ note: 'b', parts: ['x:b'], severity: 3 })], { sheet: '0001', today: '2026-10-01' });
  for (let i = 0; i < 4; i++) record(todos, [finding({ note: 'a', parts: ['x:a'], severity: 1, hash: 'H' + i })], { sheet: '000' + (2 + i), today: '2026-10-02' });
  assert.deepEqual(rank(todos).map((t) => t.id), ['T001', 'T002'], 'severity 1 seen five times outranks severity 3 seen once');
  record(todos, [finding({ note: 'c', parts: ['x:c'], severity: 3 })], { sheet: '0009', today: '2026-10-03' });
  assert.deepEqual(rank(todos).map((t) => t.id), ['T001', 'T002', 'T003'], 'ties go to the older');
  const done = close(todos, 'T002', { commit: 'abc1234', lint: 'stack:hat-below-eyes', today: '2026-10-04' });
  assert.equal(done.status, 'fixed'); assert.equal(done.commit, 'abc1234'); assert.equal(done.lint, 'stack:hat-below-eyes'); assert.equal(done.closed, '2026-10-04');
  assert.deepEqual(rank(todos).map((t) => t.id), ['T001', 'T003']);
  assert.throws(() => close(todos, 'T002', { commit: 'def', today: '2026-10-04' }), /T002 is already fixed/);
  assert.throws(() => close(todos, 'T003', { commit: undefined, wontfix: '', today: '2026-10-04' }), /close needs --commit/);
  assert.equal(todos[2].status, 'open', 'a refused close changes nothing');
  close(todos, 'T003', { wontfix: 'in character', today: '2026-10-04' });
  assert.equal(todos[2].status, 'wontfix');
  const r = record(todos, [finding({ note: 'c again', parts: ['x:c'], severity: 3 })], { sheet: '0010', today: '2026-10-05' });
  assert.deepEqual(r.wontfix, ['T003']); assert.deepEqual(r.opened, []); assert.equal(todos.length, 3); assert.equal(todos[2].seen, 1, 'untouched');
  assert.throws(() => close(todos, 'T099', { commit: 'x' }), /T099/);
});

test('ledger: load of a missing file is empty, save round trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'harden-')), file = join(dir, 'todos.json');
  try {
    assert.deepEqual(load(file), []);
    const todos = []; record(todos, [finding()], { sheet: '0001', today: '2026-10-07' });
    save(file, todos); assert.ok(existsSync(file)); assert.deepEqual(load(file), todos);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('nowState re-runs the tuple through the current presets; an unknown key falls back to the hash', () => {
  const t = { cast: 'editorial', stance: 'none', expression: 'grin', view: 'bust' }, hash = encode(stateFor(t, 7)), old = decode(hash).ov['mouth.smile'], g = EXPRESSIONS.grin.mouth;
  const was = g.smile; g.smile = old + 0.123;
  try {
    assert.equal(nowState(hash, 'editorial/none/grin/bust').ov['mouth.smile'], old + 0.123);
    assert.equal(decode(hash).ov['mouth.smile'], old);
  } finally { g.smile = was; }
  assert.deepEqual(nowState(hash, null), decode(hash));
  assert.deepEqual(nowState(hash, 'nobody/none/grin/bust'), decode(hash));
});

const HARDEN = fileURLToPath(new URL('../scripts/harden.mjs', import.meta.url));
const cli = (dir, ...args) => execFileSync(process.execPath, [HARDEN, ...args, '--dir', dir], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const cliIn = (dir, input, ...args) => execFileSync(process.execPath, [HARDEN, ...args, '--dir', dir], { encoding: 'utf8', input });

test('cli: a first run starts empty, next --html writes sheet 0001 without a browser, record fills the hash from the cell, todos ranks it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'harden-cli-'));
  try {
    const out = cli(dir, 'next', '--html', '--cells', '3', '--pool', '0');
    assert.match(out, /sheet 0001/); assert.match(out, /1\s+calibration/); assert.match(out, /limner\.html#editor\//);
    assert.ok(existsSync(join(dir, 'sheets', '0001.html')) && existsSync(join(dir, 'sheets', '0001.json')) && !existsSync(join(dir, 'sheets', '0001.png')));
    const sheet = JSON.parse(readFileSync(join(dir, 'sheets', '0001.json'), 'utf8'));
    assert.equal(sheet.view, 'bust'); assert.equal(sheet.cells.length, 3); assert.ok(sheet.cells[1].hash && sheet.cells[1].key);
    const cov = JSON.parse(readFileSync(join(dir, 'coverage.json'), 'utf8')); assert.equal(Object.values(cov).reduce((a, b) => a + b, 0), 2, 'two cells covered, calibration not');
    const good = { cell: 2, category: 'style', parts: ['eyes:almond'], severity: 1, note: 'flat iris' };
    const bad = cliIn(dir, JSON.stringify([good, { cell: 9, category: 'style', parts: ['x'], severity: 1, note: 'not on the sheet' }]), 'record', '0001');
    assert.match(bad, /refused cell 9/); assert.match(bad, /nothing recorded/); assert.ok(!/opened/.test(bad)); assert.ok(!existsSync(join(dir, 'todos.json')), 'a refusal writes no ledger');
    assert.equal(JSON.parse(readFileSync(join(dir, 'sheets', '0001.json'), 'utf8')).findings, undefined, 'nor the sheet');
    const r = cliIn(dir, JSON.stringify([good]), 'record', '0001');
    assert.match(r, /opened T001/);
    const todos = JSON.parse(readFileSync(join(dir, 'todos.json'), 'utf8'));
    assert.equal(todos[0].evidence[0], sheet.cells[1].hash); assert.deepEqual(todos[0].tuples, [sheet.cells[1].key]);
    assert.match(cli(dir, 'todos'), /T001\s+1x1\s+style\s+eyes:almond\s+flat iris/);
    assert.match(cli(dir, 'next', '--html', '--cells', '2', '--pool', '0'), /sheet 0002/); assert.equal(JSON.parse(readFileSync(join(dir, 'sheets', '0002.json'), 'utf8')).view, 'figure', 'even sheets are figures');
    assert.throws(() => cli(dir, 'close', 'T001'), (e) => e.status === 1 && /close needs --commit/.test(e.stderr), 'a bare close is refused');
    assert.throws(() => execFileSync(process.execPath, [HARDEN, '--dir', dir, 'close', 'T001', '--commit'], { encoding: 'utf8', stdio: 'pipe' }), (e) => e.status === 1 && /close needs --commit/.test(e.stderr), 'a --commit with no value is refused');
    assert.match(cli(dir, 'close', '--wontfix', 'in character', 'T001'), /T001 wontfix/);
    assert.match(cli(dir, 'verify', '--html', 'T001'), /T001-verify\.html/, 'a boolean flag before the id keeps the id; no png on disk, the now side alone');
    assert.match(readFileSync(join(dir, 'sheets', 'T001-verify.html'), 'utf8'), /then: not on disk/);
    assert.equal(cli(dir, 'todos').trim(), 'no open todos');
    assert.match(cli(dir, 'todos', '--all'), /T001.*wontfix/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cli: snap takes the before once, the after freely, and verify names the then source', () => {
  const dir = mkdtempSync(join(tmpdir(), 'harden-cli-'));
  try {
    const hs = [3, 4].map((seed) => encode(stateFor({ cast: 'elves', stance: 'none', expression: 'grin', view: 'bust' }, seed)));
    writeFileSync(join(dir, 'todos.json'), JSON.stringify([{ id: 'T001', status: 'open', category: 'style', severity: 1, seen: 1, parts: ['eyes:almond'], title: 't', sheets: ['0001'], evidence: hs, tuples: ['elves/none/grin/bust'], attempts: 0, tried: [] }]));
    assert.match(cli(dir, 'verify', 'T001', '--html'), /then: sheets/);
    assert.match(cli(dir, 'snap', 'T001', 'before', '--html'), /T001-before\.html/);
    const f = join(dir, 'sheets', 'fixes'), snap = JSON.parse(readFileSync(join(f, 'T001-before.json'), 'utf8')), html = readFileSync(join(f, 'T001-before.html'), 'utf8');
    assert.equal(snap.cells.length, 2); assert.equal(snap.sheet, 'T001-before'); assert.match(html, /T001 1 /);
    assert.throws(() => cli(dir, 'snap', 'T001', 'before', '--html'), (e) => e.status === 1 && /before is taken once, before any edit/.test(e.stderr));
    assert.equal(readFileSync(join(f, 'T001-before.html'), 'utf8'), html, 'the first before is untouched');
    assert.match(cli(dir, 'snap', 'T001', 'before', '--html', '--crop', 'head'), /T001-before-head\.html/, 'a crop is its own before');
    cli(dir, 'snap', 'T001', 'after', '--html'); cli(dir, 'snap', 'T001', 'after', '--html'); assert.ok(existsSync(join(f, 'T001-after.json')));
    assert.match(cli(dir, 'verify', 'T001', '--html'), /then: fixes\/T001-before\.json \(png needed to show it\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cli: sheet numbers pass every sheet the committed ledger names', () => {
  const dir = mkdtempSync(join(tmpdir(), 'harden-cli-'));
  try {
    const todos = []; record(todos, [finding()], { sheet: '0007', today: '2026-10-07' }); save(join(dir, 'todos.json'), todos);
    assert.match(cli(dir, 'next', '--html', '--cells', '2', '--pool', '0'), /sheet 0008/);
    assert.ok(existsSync(join(dir, 'sheets', '0008.json')) && !existsSync(join(dir, 'sheets', '0001.json')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cli: lint prints the flags of one state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'harden-cli-'));
  try {
    assert.match(cli(dir, 'lint', JSON.stringify({ seed: 3, ov: {} })), /clean/);
    assert.match(cli(dir, 'lint', JSON.stringify({ seed: 3, ov: {} }), '--stance', 'deadStill'), /pose:stance-noop/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ledger: three attempts park an entry out of the ranking, record names the entry each finding landed in', () => {
  const todos = [];
  const r = record(todos, [finding({ note: 'a', parts: ['x:a'] }), finding({ note: 'b', parts: ['x:b'] })], { sheet: '0001', today: '2026-10-07' });
  assert.deepEqual(r.accepted, [{ cell: 2, category: 'stack', severity: 2, id: 'T001' }, { cell: 2, category: 'stack', severity: 2, id: 'T002' }]);
  const two = record([], [finding({ note: 'a', parts: ['x:a'], severity: 3 }), finding({ note: 'b', category: 'style', parts: ['x:b'], severity: 1 })], { sheet: '0001', today: '2026-10-07' });
  assert.deepEqual(two.accepted.map((a) => [a.category, a.severity]), [['stack', 3], ['style', 1]], 'two findings on one cell keep their own severity');
  const mixed = [], m = record(mixed, [finding({ parts: ['x:a'] }), finding({ parts: [] })], { sheet: '0001', today: '2026-10-07' });
  assert.equal(m.refused.length, 1); assert.deepEqual(m.accepted, []); assert.equal(mixed.length, 0, 'one refusal records nothing');
  assert.equal(todos[0].attempts, 0); assert.deepEqual(todos[0].tried, []);
  for (let i = 1; i <= MAX_ATTEMPTS; i++) { const t = attempt(todos, 'T001', 'try ' + i, { today: '2026-10-08' }); assert.equal(t.attempts, i); }
  assert.ok(isParked(todos[0])); assert.deepEqual(todos[0].tried, ['2026-10-08: try 1', '2026-10-08: try 2', '2026-10-08: try 3']);
  assert.deepEqual(rank(todos).map((t) => t.id), ['T002'], 'a parked entry is not ranked');
  assert.ok(!isParked({ status: 'open' }), 'an entry from before attempts existed is not parked');
  const again = record(todos, [finding({ note: 'a', parts: ['x:a'], hash: 'H9' })], { sheet: '0002', today: '2026-10-09' });
  assert.deepEqual(again.seen, ['T001'], 'a parked entry still counts when seen');
  assert.throws(() => attempt(todos, 'T099', 'x', { today: '2026-10-09' }), /T099/);
});

test('ledger: merge folds open entries into one, the merged fingerprint counts on the target, bad ids change nothing; the CLI prints it', () => {
  const rec = (todos, parts, o) => record(todos, [finding({ parts, ...o })], { sheet: o.sheet, today: o.today });
  const todos = [];
  rec(todos, ['hair:a'], { hash: 'Ha', tuple: 'c1', note: 'na', severity: 1, sheet: '0001', today: '2026-10-05' });
  rec(todos, ['hair:b'], { hash: 'Hb', tuple: 'c2', note: 'nb', severity: 3, sheet: '0002', today: '2026-10-03' });
  rec(todos, ['hair:b'], { hash: 'Hb2', tuple: 'c2', note: 'nb', severity: 3, sheet: '0002', today: '2026-10-03' });
  rec(todos, ['hair:c'], { hash: 'Ha', tuple: 'c1', note: 'nc', severity: 2, sheet: '0003', today: '2026-10-06' });
  close(todos, 'T003', { wontfix: 'x', today: '2026-10-07' }).status; // closed one is not mergeable
  const before = JSON.stringify(todos);
  assert.throws(() => merge(todos, 'T001', ['T002', 'T003'], { today: 'D' }), /T003 is wontfix/);
  assert.throws(() => merge(todos, 'T001', ['T002', 'T099'], { today: 'D' }), /T099/);
  assert.throws(() => merge(todos, 'T001', ['T001'], { today: 'D' }), /T001/);
  assert.equal(JSON.stringify(todos), before, 'a refusal changes nothing');
  const fresh = [];
  rec(fresh, ['hair:a'], { hash: 'Ha', tuple: 'c1', note: 'na', severity: 1, sheet: '0001', today: '2026-10-05' });
  rec(fresh, ['hair:b'], { hash: 'Hb', tuple: 'c2', note: 'nb', severity: 3, sheet: '0002', today: '2026-10-03' });
  rec(fresh, ['hair:b'], { hash: 'Hb2', tuple: 'c2', note: 'nb', severity: 3, sheet: '0002', today: '2026-10-03' });
  rec(fresh, ['hair:c'], { hash: 'Ha', tuple: 'c1', note: 'nc', severity: 2, sheet: '0003', today: '2026-10-06' });
  const k = merge(fresh, 'T001', ['T002', 'T003'], { parts: ['unknown:hairPanel'], today: '2026-10-08' });
  assert.equal(k.seen, 4); assert.deepEqual(k.evidence, ['Ha', 'Hb', 'Hb2']); assert.deepEqual(k.sheets, ['0001', '0002', '0003']);
  assert.deepEqual(k.tuples, ['c1', 'c2']); assert.deepEqual(k.notes, ['na', 'nb', 'nc']);
  assert.equal(k.severity, 3); assert.equal(k.opened, '2026-10-03'); assert.deepEqual(k.parts, ['unknown:hairPanel']);
  assert.deepEqual(fresh.slice(1).map((t) => [t.status, t.mergedInto, t.closed]), [['merged', 'T001', '2026-10-08'], ['merged', 'T001', '2026-10-08']]);
  assert.deepEqual(rank(fresh).map((t) => t.id), ['T001']);
  const r = rec(fresh, ['hair:b'], { hash: 'Hz', tuple: 'c9', note: 'again', severity: 1, sheet: '0004', today: '2026-10-09' }).seen;
  assert.deepEqual(r, ['T001']); assert.equal(fresh.length, 3, 'opens nothing'); assert.equal(fresh[0].seen, 5);

  const dir = mkdtempSync(join(tmpdir(), 'harden-merge-'));
  try {
    const t2 = []; for (const p of ['x:a', 'x:b']) rec(t2, [p], { hash: 'H' + p, tuple: 't', note: p, severity: 2, sheet: '0001', today: '2026-10-05' });
    save(join(dir, 'todos.json'), t2);
    assert.match(cli(dir, 'merge', 'T001', 'T002', '--parts', 'unknown:w'), /^T001 now 2x, merged T002/);
    assert.match(cli(dir, 'todos', '--all'), /T002 .*\(merged into T001\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ledger: statsOf counts defects per sheet by severity and fresh defects early against late', () => {
  const sheet = (n, fresh, findings) => ({ sheet: n, cells: [{ n: 1, tuple: { cast: 'calibration' }, fresh: false }, { n: 2, tuple: { cast: 'elves' }, fresh: fresh[0] }, { n: 3, tuple: { cast: 'orcs' }, fresh: fresh[1] }], findings });
  const { rows, fresh } = statsOf([
    sheet('0001', [true, true], [{ cell: 2, category: 'stack', severity: 3, id: 'T001' }, { cell: 3, category: 'style', severity: 1, id: 'T002' }]),
    sheet('0002', [true, false], []),
    sheet('0003', [false, true], [{ cell: 2, category: 'pose', severity: 2, id: 'T003' }]),
    sheet('0004', [true, true], [{ cell: 3, category: 'stack', severity: 3, id: 'T001' }]),
  ]);
  assert.deepEqual(rows[0], { sheet: '0001', cells: 2, freshCells: 2, s3: 1, s2: 0, s1: 1, freshDefects: 2 });
  assert.deepEqual(rows[1], { sheet: '0002', cells: 2, freshCells: 1, s3: 0, s2: 0, s1: 0, freshDefects: 0 });
  assert.deepEqual(rows[2], { sheet: '0003', cells: 2, freshCells: 1, s3: 0, s2: 1, s1: 0, freshDefects: 0 }, 'a defect on a seen cell is not a fresh defect');
  assert.deepEqual(fresh.early, { cells: 3, defects: 2, rate: 0.67 }); assert.deepEqual(fresh.late, { cells: 3, defects: 1, rate: 0.33 });
  assert.deepEqual(statsOf([sheet('0001', [false, false], [])]).fresh, { early: { cells: 0, defects: 0, rate: null }, late: { cells: 0, defects: 0, rate: null } });
});

test('sampler: related cells draw one of the todo\'s parts and never its own evidence', () => {
  const todo = { id: 'T005', parts: ['hat:leafCirclet', 'stance:swaggerLean'], evidence: [] };
  const cells = relatedCells(todo, { n: 4, pool: 600 });
  assert.ok(cells.length >= 1 && cells.length <= 4, `${cells.length} related cells`);
  assert.ok(cells.every((c) => c.tuple.view === 'figure'), 'a stance part means figures');
  assert.ok(cells.every((c) => c.tuple.stance === 'swaggerLean' || JSON.stringify(params(c.state)).includes('"leafCirclet"')));
  assert.deepEqual(relatedCells(todo, { n: 4, pool: 600 }), cells, 'deterministic per todo');
  const seen = relatedCells({ ...todo, evidence: cells.map((c) => encode(c.state)) }, { n: 4, pool: 600 });
  assert.ok(!seen.some((c) => cells.some((d) => encode(d.state) === encode(c.state))), 'the evidence itself is never a neighbour');
  assert.deepEqual(relatedCells({ id: 'T006', parts: ['unknown'], evidence: [] }, { n: 4, pool: 100 }), [], 'unknown with no tuples has no neighbours');
  const lost = relatedCells({ id: 'T007', parts: ['unknown:muzzle'], tuples: ['dragonborn/none/grin/bust'], evidence: [] }, { n: 4, pool: 100 });
  assert.ok(lost.length >= 1 && lost.every((c) => c.tuple.cast === 'dragonborn'), 'an unattributed entry gets its cast\'s neighbours');
  assert.equal(drawsPart(stateFor({ cast: 'elves', stance: 'none', expression: 'grin', view: 'bust' }, 3), { stance: 'none', expression: 'grin' }, 'expression:grin'), true);
});

test('cli: next marks fresh cells, record writes findings into the sheet, attempt parks, related and stats run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'harden-cli-'));
  try {
    cli(dir, 'next', '--html', '--cells', '3', '--pool', '0');
    const s1 = JSON.parse(readFileSync(join(dir, 'sheets', '0001.json'), 'utf8'));
    assert.deepEqual(s1.cells.map((c) => c.fresh), [false, true, true], 'calibration is never fresh, the first sight of a tuple is');
    assert.match(cliIn(dir, JSON.stringify([{ cell: 2, category: 'stack', parts: ['hat:beanie'], severity: 2, note: 'x' }]), 'record', '0001'), /recorded 1 findings on sheet 0001/);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'sheets', '0001.json'), 'utf8')).findings, [{ cell: 2, category: 'stack', severity: 2, id: 'T001' }]);
    const before = readFileSync(join(dir, 'sheets', '0001.json'), 'utf8'), ledger = readFileSync(join(dir, 'todos.json'), 'utf8');
    assert.throws(() => cliIn(dir, '[]', 'record', '0001'), (e) => e.status === 1 && /already recorded; nothing changed/.test(e.stdout));
    assert.equal(readFileSync(join(dir, 'sheets', '0001.json'), 'utf8'), before, 'the sheet is unchanged'); assert.equal(readFileSync(join(dir, 'todos.json'), 'utf8'), ledger, 'so is the ledger');
    writeFileSync(join(dir, 'sheets', 'T001-related.json'), JSON.stringify({ sheet: 'T001-related', cells: [], findings: [{ cell: 1, category: 'stack', severity: 3, id: 'T001' }] }));
    const stats = cli(dir, 'stats'); assert.match(stats, /0001\s+cells 2\s+fresh 2\s+defects 3:0 2:1 1:0/); assert.ok(!/related/.test(stats), 'a related sheet is not a survey sheet');
    for (let i = 1; i <= 3; i++) assert.match(cli(dir, 'attempt', 'T001', 'try ' + i), new RegExp(`T001 attempt ${i}/3`));
    assert.match(cli(dir, 'todos'), /no open todos\s*\n?parked: T001/); assert.match(cli(dir, 'todos', '--all'), /parked 3\/3/);
    const rel = cli(dir, 'related', 'T001', '--html', '--cells', '2');
    assert.ok(/no other combination/.test(rel) || existsSync(join(dir, 'sheets', 'T001-related.json')), rel);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('sheet: the browser is the newest headless shell installed, CHROME overriding, nothing when none is there', () => {
  const home = mkdtempSync(join(tmpdir(), 'ms-playwright-')), had = process.env.CHROME; delete process.env.CHROME;
  try {
    assert.equal(chromePath(home), undefined, 'an empty install dir: playwright picks its own');
    for (const b of ['chromium_headless_shell-1208', 'chromium_headless_shell-1234', 'chromium-1243', 'chromium_headless_shell-1243']) mkdirSync(join(home, b, 'chrome-headless-shell-win64'), { recursive: true });
    for (const b of ['chromium_headless_shell-1208', 'chromium_headless_shell-1234']) writeFileSync(join(home, b, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'), '');
    assert.equal(chromePath(home), join(home, 'chromium_headless_shell-1234', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'), 'the newest build that has the binary (1243 has the folder and no exe)');
    process.env.CHROME = 'x/chrome.exe'; assert.equal(chromePath(home), 'x/chrome.exe', 'CHROME wins');
  } finally { if (had === undefined) delete process.env.CHROME; else process.env.CHROME = had; rmSync(home, { recursive: true, force: true }); }
});

test('cli: snap draws the re-derived state, not the frozen hash', () => {
  const dir = mkdtempSync(join(tmpdir(), 'harden-cli-'));
  try {
    const t = { cast: 'elves', stance: 'none', expression: 'grin', view: 'bust' }, st = stateFor(t, 5), stale = { ...st, ov: { ...st.ov, 'mouth.smile': 0.01 } }, hash = encode(stale);
    mkdirSync(join(dir, 'sheets'), { recursive: true });
    writeFileSync(join(dir, 'sheets', '0001.json'), JSON.stringify({ sheet: '0001', view: 'bust', cells: [{ n: 1, key: 'elves/none/grin/bust', hash }] }));
    writeFileSync(join(dir, 'todos.json'), JSON.stringify([{ id: 'T001', status: 'open', category: 'style', severity: 1, seen: 1, parts: ['x'], title: 't', sheets: ['0001'], evidence: [hash], tuples: [], attempts: 0, tried: [] }]));
    cli(dir, 'snap', 'T001', 'before', '--html');
    const html = readFileSync(join(dir, 'sheets', 'fixes', 'T001-before.html'), 'utf8');
    const flat = (x) => x.replace(/c\d+/g, 'c'); // clip ids count up across draws
    assert.ok(flat(html).includes(flat(svgOf(decode(encode(st)), 'bust'))), 'the preset-derived state is drawn');
    assert.ok(!flat(html).includes(flat(svgOf(decode(hash), 'bust'))), 'not the frozen one');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
