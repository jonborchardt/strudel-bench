// The hardening loop's hands: the lints that rank a cell for eyes, the sampler that fills a sheet, the sheet's html,
// the ledger that remembers. No browser here: the screenshot is the script's business.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portraitOps } from '../index.mjs';
import { blank } from '../schema.mjs';
import { SHEET, pointsOf, lintOps, lintState } from '../scripts/harden/lint.mjs';
import { CASTS } from '../registry.mjs';
import { EXPRESSIONS } from '../people.mjs';
import { params, decode } from '../schema.mjs';
import { CALIBRATION, gridOf, keyOf, stateFor, pickCells, bump } from '../scripts/harden/sampler.mjs';
import { CROPS, LAYOUT, svgOf, sheetHtml, pairsHtml } from '../scripts/harden/sheet.mjs';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATEGORIES, fingerprint, nextId, record, rank, close, load, save } from '../scripts/harden/ledger.mjs';

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
  assert.match(svgOf(st, 'figure'), /viewBox="-30 -200 460 1284"/);
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
  const r3 = record(todos, [finding({ parts: [] }), finding({ category: 'ugly' }), finding({ severity: 7 }), finding({ hash: undefined })], { sheet: '0003', today: '2026-10-08' });
  assert.equal(r3.refused.length, 4); assert.equal(todos.length, 1); assert.equal(todos[0].seen, 2);
  assert.match(r3.refused[0].why, /parts/); assert.match(r3.refused[1].why, new RegExp(CATEGORIES.join('|')));
  assert.equal(nextId(todos), 'T002');
});

test('ledger: rank is severity x seen then older first; close records the commit; wontfix is reported, never reopened', () => {
  const todos = [];
  record(todos, [finding({ note: 'a', parts: ['a'], severity: 1 }), finding({ note: 'b', parts: ['b'], severity: 3 })], { sheet: '0001', today: '2026-10-01' });
  for (let i = 0; i < 4; i++) record(todos, [finding({ note: 'a', parts: ['a'], severity: 1, hash: 'H' + i })], { sheet: '000' + (2 + i), today: '2026-10-02' });
  assert.deepEqual(rank(todos).map((t) => t.id), ['T001', 'T002'], 'severity 1 seen five times outranks severity 3 seen once');
  record(todos, [finding({ note: 'c', parts: ['c'], severity: 3 })], { sheet: '0009', today: '2026-10-03' });
  assert.deepEqual(rank(todos).map((t) => t.id), ['T001', 'T002', 'T003'], 'ties go to the older');
  const done = close(todos, 'T002', { commit: 'abc1234', lint: 'stack:hat-below-eyes', today: '2026-10-04' });
  assert.equal(done.status, 'fixed'); assert.equal(done.commit, 'abc1234'); assert.equal(done.lint, 'stack:hat-below-eyes'); assert.equal(done.closed, '2026-10-04');
  assert.deepEqual(rank(todos).map((t) => t.id), ['T001', 'T003']);
  close(todos, 'T003', { wontfix: 'in character', today: '2026-10-04' });
  assert.equal(todos[2].status, 'wontfix');
  const r = record(todos, [finding({ note: 'c again', parts: ['c'], severity: 3 })], { sheet: '0010', today: '2026-10-05' });
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

