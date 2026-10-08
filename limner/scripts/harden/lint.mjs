// Geometric checks over a figure's ops, no eyes: what ranks a cell for a reader to look at. A lint is a hint, never a
// verdict. Each closed todo whose fault is geometric adds one here and a test in ../../test/harden.test.mjs over a state
// that used to show it, so the reader's job shrinks as the list grows.
// ponytail: bounding points, not path intersection; good enough to rank a cell, not to judge it.
import { portraitOps } from '../../index.mjs';
import { params } from '../../schema.mjs';

/** The figure sheet (renderFigure's viewBox -30 -200 460 1284) plus 40 units of slack on every side. */
export const SHEET = { x0: -70, x1: 470, y0: -240, y1: 1124 };

const nums = (d) => (d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
/** Every op's coordinates as x,y pairs: a path's numbers in order (absolute M/L/C/Q/Z only, the rule in CLAUDE.md), an ellipse's centre, a rect's corners, a line's ends. Transforms carry none. */
export function pointsOf(op) {
  switch (op.k) {
    case 'path': case 'clip': { const n = nums(op.d ?? ''), out = []; for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]); return out; }
    case 'ellipse': return [[op.cx, op.cy]];
    case 'rect': return [[op.x, op.y], [op.x + op.w, op.y + op.h]];
    case 'line': return [[op.x1, op.y1], [op.x2, op.y2]];
    default: return [];
  }
}

const partsOf = (op) => (op.part ? [op.part] : []); // ops carry no part name today; when they do, the lint names it

/** The lints that need only the ops. */
export function lintOps(ops) {
  const out = [];
  // JSON.stringify prints a NaN as null, so look at the numbers themselves and at the path text
  if (ops.some((op) => /NaN|Infinity/.test(op.d ?? '') || pointsOf(op).some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y)))) out.push({ name: 'render:nan', parts: [], detail: 'NaN or Infinity in the ops' });
  for (const op of ops) {
    if (op.k === 'clip') continue; // a clip is never drawn, and the pose clips run to x -97.6..502.4 by design (a hidden control region)
    const far = pointsOf(op).find(([x, y]) => x < SHEET.x0 || x > SHEET.x1 || y < SHEET.y0 || y > SHEET.y1);
    if (far) { out.push({ name: 'render:offsheet', parts: partsOf(op), detail: `${op.k} reaches ${far[0]},${far[1]}` }); break; }
  }
  return out;
}

const POSE_KEYS = ['pose.headX', 'pose.headY', 'pose.headTilt', 'pose.bodyTilt', 'pose.turn', 'pose.shoulder', 'props'];
/** The lints over a sheet cell: the ops lints, plus the ones that need the state (a stance compared against no stance). */
export function lintState(st, tuple) {
  const ops = portraitOps(params(st)), out = lintOps(ops);
  if (tuple.stance && tuple.stance !== 'none') {
    const ov = { ...st.ov }; for (const k of POSE_KEYS) delete ov[k];
    if (JSON.stringify(ops) === JSON.stringify(portraitOps(params({ ...st, ov })))) out.push({ name: 'pose:stance-noop', parts: [`stance:${tuple.stance}`], detail: 'the stance draws the same figure as no stance' });
  }
  return out;
}
