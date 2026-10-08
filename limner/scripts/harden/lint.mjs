// Geometric checks over a figure's ops, no eyes: what ranks a cell for a reader to look at. A lint is a hint, never a
// verdict. Each closed todo whose fault is geometric adds one here and a test in ../../test/harden.test.mjs over a state
// that used to show it, so the reader's job shrinks as the list grows.
// ponytail: bounding points, not path intersection; good enough to rank a cell, not to judge it.
import { portraitOps, feetY, FEET_Y, eyeY, mouthY, NOSES, HAIR, eyeShape } from '../../index.mjs';
import { params } from '../../schema.mjs';
import { VIEWBOX } from './sheet.mjs';

/** The figure sheet, renderFigure's own viewBox with no slack: a drawn point past it is cut off at the frame (T006: a 40-unit margin let a dragonborn's hands and hem leave the frame unflagged). */
export const SHEET = (([x, y, w, h]) => ({ x0: x, x1: x + w, y0: y, y1: y + h }))(VIEWBOX.figure.split(' ').map(Number));

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

/** The lints that need only the ops. `dy` is renderFigure's floor shift (FEET_Y - feetY(p)): ops space is the sheet moved by it. */
export function lintOps(ops, { dy = 0 } = {}) {
  const out = [];
  // JSON.stringify prints a NaN as null, so look at the numbers themselves and at the path text
  if (ops.some((op) => /NaN|Infinity/.test(op.d ?? '') || pointsOf(op).some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y)))) out.push({ name: 'render:nan', parts: [], detail: 'NaN or Infinity in the ops' });
  let depth = 0; // a stroke under a clip shows only inside it (hair strands run long under the hair's clip), so only depth 0 can stray
  for (const op of ops) {
    if (op.k === 'clip') { depth++; continue; } // a clip is never drawn, and the pose clips run to x -97.6..502.4 by design (a hidden control region)
    if (op.k === 'unclip') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    const far = pointsOf(op).find(([x, y]) => x < SHEET.x0 || x > SHEET.x1 || y + dy < SHEET.y0 || y + dy > SHEET.y1);
    if (far) { out.push({ name: 'render:offsheet', parts: partsOf(op), detail: `${op.k} reaches ${far[0]},${far[1]}` }); break; }
  }
  return out;
}

/** A path's outline as points along it (absolute M/L/C/Q/Z, each curve flattened in 12 steps), for an inside test. */
export function outline(d) {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [], out = []; let i = 0, cmd = 'M', cur = [0, 0];
  while (i < tok.length) {
    if (/[MLCQZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z') { if (i < tok.length && !/[MLCQZ]/.test(tok[i])) break; continue; }
    const c = Array.from({ length: { M: 1, L: 1, Q: 2, C: 3 }[cmd] }, () => [+tok[i++], +tok[i++]]);
    if (c.length === 1) { out.push(cur = c[0]); continue; }
    for (let s = 1; s <= 12; s++) { let q = [cur, ...c]; while (q.length > 1) q = q.slice(1).map((b, j) => [q[j][0] + (b[0] - q[j][0]) * s / 12, q[j][1] + (b[1] - q[j][1]) * s / 12]); out.push(q[0]); }
    cur = c[c.length - 1];
  }
  return out;
}
export const inside = ([x, y], poly) => poly.reduce((on, [x0, y0], j) => { const [x1, y1] = poly[(j + 1) % poly.length]; return (y0 > y) !== (y1 > y) && x < x0 + (x1 - x0) * (y - y0) / (y1 - y0) ? !on : on; }, false);

/** A horn's own strokes (the ridges and the highlight drawn right after its fill) end inside its outline (T010: the growth ridges ran past both edges into the background as whiskers). */
export function hornStrokesOut(ops) {
  let horn = null;
  for (const op of ops) {
    if (op.horn) { horn = outline(op.d); continue; }
    if (!horn || op.k !== 'path' || op.fill !== 'none') { horn = null; continue; }
    const pts = pointsOf(op), out = [pts[0], pts[pts.length - 1]].find((pt) => !inside(pt, horn));
    if (out) return out;
  }
  return null;
}

/** Where a muzzle's nostrils end below the eye line, on the sheet: the pad's nostril slits run to the tip plus its radius, in the nose's own scaling (T007). */
export function muzzleGap(p) {
  const fh = (p.face?.height ?? 204) / 204, st = NOSES[p.nose.style] ?? NOSES.straight, ey = eyeY(p);
  const k = (mouthY({ ...p, nose: { ...p.nose, muzzle: 0 } }) - ey) / ((p.mouth.y - p.eyes.y) * fh); // the head's scale on the sheet, read off the plain mouth
  return mouthY(p) - (ey + k * (10 + (st.len + st.tip) * (p.nose.length * fh) / 38)); // the parting below the nostrils' bottom: under 0 runs through them
}

/** How far a hanging front panel of hair reaches in past an eye's outer corner near the eye line, in sheet units (negative: how far it stays outside). A panel is a front hair path that hangs past the eye line; a temple wing or a fringe is not one. T012: a bluntBob's panels at -5..-8 laid a slab of hair across the eye corners and cheeks, since the lashes and the eye's shadow run past the white's corner. The hair follows the face's width only; the eyes sit at their spacing on the laid-out eye line. */
export function hairOverEye(p) {
  const r = HAIR[p.hair?.style]; if (!r) return -Infinity;
  const k = (p.face?.width ?? 156) / 156, ey = 112 + (p.eyes.y - 112) * (p.face?.height ?? 204) / 204, [l, rt] = [-1, 1].map((s) => eyeShape(p, s).xo);
  const panels = (typeof r === 'function' ? r(p) : r.front(p)).filter((o) => o.k === 'path' && o.fill && o.fill !== 'none' && (o.op ?? 1) > 0.5 && pointsOf(o).some(([, y]) => y > ey + 30)); // a shaved head's shadow is not hair over anything
  let over = -Infinity;
  for (const op of panels) for (const [x0, y] of pointsOf(op)) if (Math.abs(y - ey) <= 25) { const x = 200 + (x0 - 200) * k; over = Math.max(over, Math.min(x - l, rt - x)); }
  return over;
}
export const HAIR_EYE_CLEAR = 10; // how far outside an eye's outer corner a panel's edge must hang

const POSE_KEYS =['pose.headX', 'pose.headY', 'pose.headTilt', 'pose.bodyTilt', 'pose.turn', 'pose.shoulder', 'props'];
/** The lints over a sheet cell: the ops lints, plus the ones that need the state (a stance compared against no stance). */
export function lintState(st, tuple) {
  const p = params(st), ops = portraitOps(p), out = lintOps(ops, { dy: FEET_Y - feetY(p) });
  if ((p.nose?.muzzle ?? 0) > 0 && (p.nose.mode ?? 'human') === 'human' && (p.mouth.mode ?? 'human') === 'human' && muzzleGap(p) < 2) out.push({ name: 'anatomy:muzzle-mouth', parts: ['unknown:muzzle'], detail: `the mouth line is ${muzzleGap(p).toFixed(1)} under the nostrils` });
  const hornOut = hornStrokesOut(ops); if (hornOut) out.push({ name: 'render:horn-stroke-out', parts: ['makeup:curvedHorns'], detail: `a horn's stroke ends at ${hornOut.map((v) => v.toFixed(1))}, outside the horn` });
  const hair = hairOverEye(p); if (hair > -HAIR_EYE_CLEAR) out.push({ name: 'stack:hair-over-eye', parts: [`hair:${p.hair.style}`], detail: `a front hair panel hangs ${(-hair).toFixed(1)} outside an eye's outer corner (under ${HAIR_EYE_CLEAR})` });
  if (tuple.stance && tuple.stance !== 'none') {
    const ov = { ...st.ov }; for (const k of POSE_KEYS) delete ov[k];
    if (JSON.stringify(ops) === JSON.stringify(portraitOps(params({ ...st, ov })))) out.push({ name: 'pose:stance-noop', parts: [`stance:${tuple.stance}`], detail: 'the stance draws the same figure as no stance' });
  }
  return out;
}
