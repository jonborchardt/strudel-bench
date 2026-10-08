// Which cells a sheet shows. The grid is every cast x its stances x its expressions x view; a sheet is one calibration
// face, then the cells the lints flag out of a seeded pool, then the tuples rendered least often. A state is the
// editor's own { seed, family, theme, ov }, built through schema.mjs's presets, so every cell is an editor link.
import { CASTS } from '../../registry.mjs';
import { stanceNames } from '../../stances.mjs';
import { EXPRESSIONS, EDITORIAL_EXPRESSIONS } from '../../people.mjs';
import { controlsFor, posePreset, decode, encode, params } from '../../schema.mjs';
import { prng, pick } from '../../rng.mjs';
import { lintState } from './lint.mjs';

/** The known-good face every sheet opens with (renders/portrait-match/links.md, entry 9, FINAL): the reader's scale. */
export const CALIBRATION = 'eyJzZWVkIjo3LCJmYW1pbHkiOiJhbnkiLCJvdiI6eyJza2luIjoiI2U3Yjk5YSIsImhhaXJDb2xvciI6IiMzYjJhMjAiLCJoYWlyLnN0eWxlIjoic2lkZVBhcnQiLCJmYWNpYWxIYWlyLnN0eWxlIjoiaGVhdnlTdHViYmxlIiwiZ2xhc3NlcyI6bnVsbCwiYWNjZXNzb3JpZXMiOltdLCJkZXRhaWxzIjpbImNyb3dzRmVldCJdLCJtYWtldXAiOltdLCJtYXJrcyI6W10sInByb3BzIjpbXSwiaGF0LnN0eWxlIjoibm9uZSIsImphY2tldC5zdHlsZSI6Im5vbmUiLCJmYWNlLndpZHRoIjoxNzQsImZhY2UuaGVpZ2h0IjoxOTYsImZhY2UuamF3IjowLjg1LCJmYWNlLmNoaW4iOjAuMSwiZmFjZS5jb3JuZXIiOjMyLCJmYWNlLnNrZXciOjAsImZhY2UuYXN5bS5jaGVlayI6MCwiZmFjZS5hc3ltLmphdyI6MCwiZmFjZS5hc3ltLnRlbXBsZSI6MCwiZmFjZS5hc3ltLmNoaW4iOjAsIm5lY2sud2lkdGgiOjcwLCJuZWNrLmhlaWdodCI6NjgsImVhcnMuc2l6ZSI6MC45LCJleWVzLnN0eWxlIjoiYWxtb25kIiwiZXllcy5icm93U3R5bGUiOiJ0aGluIiwiZXllcy5pcmlzIjoiIzYxNzc4MyIsImV5ZXMub3Blbm5lc3MiOjAuODgsImV5ZXMuYnJvd0xpZnQiOi0xLjUsImV5ZXMuYnJvd1NrZXciOjAsImV5ZXMuYmFncyI6MC40NSwiZXllcy5kZXB0aCI6MC41NSwibm9zZS5zdHlsZSI6InJvdW5kZWRUaXAiLCJub3NlLmxlbmd0aCI6NDIsIm5vc2Uud2lkdGgiOjIyLCJtb3V0aC5zdHlsZSI6InBsYWluIiwibW91dGgud2lkdGgiOjU2LCJtb3V0aC5zbWlsZSI6MC42NSwibW91dGgub3BlbiI6MC4xNSwibW91dGguZnVsbG5lc3MiOjAuNCwiZXllcy55IjoyMDIsImV5ZXMuc3BhY2luZyI6NTYsIm1vdXRoLnkiOjI3NCwidG9wLnN0eWxlIjoiY3Jld1RzaGlydCIsInRvcC5jb2xvciI6IiM1ZjY0NjgiLCJ0b3AuZ3JhcGhpYyI6ImNvbmNlbnRyaWMiLCJiYWNrZ3JvdW5kIjoiIzNkNTM0MCIsInBvc2UudHVybiI6LTEsInBvc2UuaGVhZFRpbHQiOi0wLjA1LCJwb3NlLmdhemUiOiJjYW1lcmEiLCJleWVzLmxvb2sueSI6MCwicG9zZS5zaG91bGRlciI6MC4yLCJwb3NlLmhlYWRYIjowLCJwb3NlLmhlYWRZIjowLCJwb3NlLmJvZHlYIjowLCJwb3NlLmJvZHlUaWx0IjowLCJib2R5LndpZHRoIjoxLjE1LCJibHVzaCI6MC4zLCJsaWdodC5zaWRlIjoxLCJsaWdodC5hbW91bnQiOjAuNSwibGlnaHQuY29udHJhc3QiOjEsImZhY2lhbEhhaXIuZGVuc2l0eSI6MC40MiwiZmFjaWFsSGFpci5jaGVla0xpbmUiOjAuNSwiZmFjaWFsSGFpci5tdXN0YWNoZSI6MSwiZXllcy5zcXVpbnQiOjAuMzUsImZhY2UuZnVsbG5lc3MiOjAuNCwiaGFpci5oYWlybGluZSI6MC40LCJoYWlyLnJlY2Vzc2lvbiI6MC4xNX19';

export const VIEWS = ['bust', 'figure'];
export const keyOf = (t) => `${t.cast}/${t.stance}/${t.expression}/${t.view}`;

/** Every cell: each cast, 'none' plus its stances (the editorial set and its own pack), its expressions (its pool, else the editorial set; only names EXPRESSIONS has), both views for 'none' and the figure alone for a stance. */
export function gridOf(casts = CASTS) {
  const out = [];
  for (const [cast, c] of Object.entries(casts)) {
    const stances = ['none', ...new Set(stanceNames(cast === 'editorial' ? null : cast))];
    const exprs = [...new Set(c.expressions?.length ? c.expressions : EDITORIAL_EXPRESSIONS)].filter((e) => EXPRESSIONS[e]);
    for (const stance of stances) for (const expression of exprs) for (const view of stance === 'none' ? VIEWS : ['figure']) out.push({ cast, stance, expression, view });
  }
  return out;
}

/** The editor state of a cell: a seed's person of the cast, in the expression and the stance. */
export function stateFor(t, seed) {
  const st = { seed, family: 'any', theme: t.cast === 'editorial' ? 'none' : t.cast, ov: {} };
  const expr = controlsFor(st).find((c) => c.kind === 'preset' && c.path === 'expression');
  st.ov = { ...(t.expression !== 'none' ? expr.apply(t.expression) : {}), ...(t.stance !== 'none' ? posePreset(t.stance) : {}) };
  return st;
}

/** One sheet's cells. `lint(state, tuple)` ranks a pool of random cells; coverage counts fill the rest, least seen first, grid order breaking ties; `sheet` seeds everything, so the same inputs give the same sheet. */
export function pickCells({ coverage = {}, n = 9, view = 'bust', sheet = 1, lint = lintState, pool = 200, casts = CASTS } = {}) {
  const rng = prng(sheet), draw = () => 1 + Math.floor(rng() * 999998);
  const grid = gridOf(casts).filter((t) => t.view === view);
  const cells = [{ tuple: { cast: 'calibration', stance: 'none', expression: 'none', view }, state: decode(CALIBRATION), flags: [], source: 'calibration' }];
  const taken = new Set();
  const flagged = [];
  for (let i = 0; i < pool && grid.length; i++) {
    const tuple = pick(rng, grid), state = stateFor(tuple, draw()), flags = lint(state, tuple);
    if (flags.length) flagged.push({ tuple, state, flags, source: 'flagged' });
  }
  flagged.sort((a, b) => b.flags.length - a.flags.length);
  for (const c of flagged) { const k = keyOf(c.tuple); if (cells.length < n && !taken.has(k)) { taken.add(k); cells.push(c); } }
  const rest = grid.map((t, i) => ({ t, i, c: coverage[keyOf(t)] ?? 0 })).sort((a, b) => a.c - b.c || a.i - b.i);
  for (const { t } of rest) { const k = keyOf(t); if (cells.length >= n) break; if (taken.has(k)) continue; taken.add(k); cells.push({ tuple: t, state: stateFor(t, draw()), flags: [], source: 'coverage' }); }
  return cells;
}

/** Whether a cell draws one of the parts a todo names: a stance or expression by its tuple, any other `kind:name` by the name appearing as a value in the drawn params, `unknown` never. */
export function drawsPart(state, tuple, part) {
  const [kind, name] = part.split(':');
  if (kind === 'unknown' || !name) return false;
  if (kind === 'stance') return tuple.stance === name;
  if (kind === 'expression') return tuple.expression === name;
  return JSON.stringify(params(state)).includes(`"${name}"`); // ponytail: a value match, not a path match; a colour named like a part would false-positive, and none is
}

/** Other combinations that carry a todo's parts, for the regression check after a fix: a seeded pool of random cells, keeping those that draw one of the parts and are not the todo's own evidence, no tuple twice. The seed is the todo's number, so the same todo always gets the same neighbours. */
export function relatedCells(todo, { n = 8, pool = 2000, casts = CASTS } = {}) {
  const rng = prng(1000 + +todo.id.slice(1)), draw = () => 1 + Math.floor(rng() * 999998);
  const stancePart = todo.parts.some((p) => p.startsWith('stance:'));
  const grid = gridOf(casts).filter((t) => (stancePart ? t.view === 'figure' : true));
  const cells = [], taken = new Set(todo.evidence);
  for (let i = 0; i < pool && cells.length < n; i++) {
    const tuple = pick(rng, grid), state = stateFor(tuple, draw()), hash = encode(state);
    if (taken.has(hash) || taken.has(keyOf(tuple))) continue;
    if (todo.parts.some((p) => drawsPart(state, tuple, p))) { taken.add(hash); taken.add(keyOf(tuple)); cells.push({ tuple, state, flags: [], source: 'related' }); }
  }
  return cells;
}

/** Count the sheet's cells into the coverage map (the calibration face is not coverage). */
export function bump(coverage, cells) {
  for (const c of cells) if (c.tuple.cast !== 'calibration') { const k = keyOf(c.tuple); coverage[k] = (coverage[k] ?? 0) + 1; }
  return coverage;
}
