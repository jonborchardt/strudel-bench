// Every pose's layout, pinned before the single-figure stances moved to limner. This is a characterization test: it
// says nothing about whether the numbers are right, only that lifting the stances out did not change them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { layoutOf, FRAMING, TEMPLATES } from '../web/visual/tableau.mjs';
import { THEMES } from '../web/visual/themes.mjs';

const FILE = new URL('./fixtures/layout-golden.json', import.meta.url);

/** Every pose name any template or dance can ask for, with the theme it belongs to. */
export function cases() {
  const out = [];
  const editorial = new Set(['directFrontal', 'statueStill', 'handsAtSides', 'slightLeanLeft', 'slightLeanRight', 'swaggerLean', 'handHeart', 'handsUp', 'none', 'unknownPose']);
  for (const p of editorial) for (const n of [1, 2, 3]) for (const f of ['close', 'figure']) out.push({ pose: p, n, framing: f, theme: null });
  for (const [name, t] of Object.entries(THEMES)) for (const p of Object.keys(t.poses ?? {})) for (const n of [1, 2, 3]) for (const f of ['close', 'figure']) out.push({ pose: p, n, framing: f, theme: name });
  for (const tpl of Object.values(TEMPLATES)) for (const p of tpl.poses ?? []) for (const f of ['close', 'figure']) out.push({ pose: p, n: tpl.n ?? 1, framing: f, theme: null });
  return out;
}

const run = () => Object.fromEntries(cases().map((c) => [
  `${c.theme ?? 'editorial'}/${c.pose}/n${c.n}/${c.framing}`,
  layoutOf(c.pose, c.n, FRAMING[c.framing], c.theme ? THEMES[c.theme] : null),
]));

test('layoutOf draws the layouts it drew before the stances moved (test/fixtures/layout-golden.json)', () => {
  const now = JSON.parse(JSON.stringify(run()));
  if (process.env.UPDATE_LAYOUT_GOLDEN) { writeFileSync(FILE, JSON.stringify(now, null, 1) + '\n'); return; }
  assert.deepEqual(now, JSON.parse(readFileSync(FILE, 'utf8')));
});

test('every pose name is covered, and a pose with no entry falls back rather than throwing', () => {
  const all = run();
  const keys = Object.keys(all);
  assert.ok(keys.length > 150, `expected a broad sweep, got ${keys.length}`);
  for (const k of keys) assert.ok(Array.isArray(all[k]), `${k} returned no array`);
  assert.equal(all['editorial/unknownPose/n2/close'].length, 2, 'an unknown pose still places both figures');
});
