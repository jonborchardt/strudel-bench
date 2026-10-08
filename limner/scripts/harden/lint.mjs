// Geometric checks over a figure's ops, no eyes: what ranks a cell for a reader to look at. A lint is a hint, never a
// verdict. Each closed todo whose fault is geometric adds one here and a test in ../../test/harden.test.mjs over a state
// that used to show it, so the reader's job shrinks as the list grows.
// ponytail: bounding points, not path intersection; good enough to rank a cell, not to judge it.
import { portraitOps, feetY, FEET_Y, eyeY, mouthY, NOSES, HAIR, LONG_HAIR, facePath, eyeShape, PROPS, headBox, FACIAL_HAIR, HATS } from '../../index.mjs';
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
export const hornStrokesOut = (ops) => strokesOut(ops, 'horn');
/** A hat crown's fine strokes (the strawCap's coiled rows, drawn right after its crown) end inside the crown; a band (FINE_SW and wider) is laid on the brim and not checked (T053: the top rows ran past the crown into the background as whiskers). */
export const FINE_SW = 3;
export const crownStrokesOut = (ops) => strokesOut(ops, 'crown', FINE_SW);
/** The strokes drawn right after a shape flagged by key (narrower than maxSw) end inside its outline. */
function strokesOut(ops, key, maxSw = Infinity) {
  let horn = null;
  for (const op of ops) {
    if (op[key]) { horn = outline(op.d); continue; }
    if (!horn || op.k !== 'path' || op.fill !== 'none' || op.sw >= maxSw) { horn = null; continue; }
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

/** How far a muzzle's mouth runs past the muzzle's pad on its wider side, in head units: the mouth's ops against the ops a nudge of the nose's width moves. T058: a wide style on top of the muzzle's own widening ran the line 30 and more past the pad, cheek to cheek and off a turned jaw; a plain mouth there sat up to ~25 past it, and on a straight nose's narrow pad that was still a slash cheek to cheek (T066, 28..37). With the mouth capped at the pad plus MOUTH_PAD_MARGIN it sits at most ~11 past. */
export const MOUTH_PAST_MUZZLE = 16;
const moved = (a, q) => { const b = new Set(portraitOps(q).map((o) => JSON.stringify(o))); return a.filter((o) => !b.has(JSON.stringify(o))); };
const span = (os) => { const xs = os.flatMap(pointsOf).map(([x]) => x); return [Math.min(...xs), Math.max(...xs)]; };
export function mouthPastMuzzle(p, ops = portraitOps(p)) { // the mouth is the ops a change of its colour repaints (T066: its width alone no longer moves a mouth capped by the pad); the pad, the ops a nudge of the nose's width moves that are not the mouth, which follows it
  const mouth = moved(ops, { ...p, mouth: { ...p.mouth, color: p.mouth.color === '#010203' ? '#030201' : '#010203' } }), mine = new Set(mouth);
  const m = span(mouth), n = span(moved(ops, { ...p, nose: { ...p.nose, width: p.nose.width + 0.5 } }).filter((o) => !mine.has(o)));
  return Math.max(n[0] - m[0], m[1] - n[1]);
}

/** A path's outline as points, its curves flattened (absolute M/L/C/Q/Z only), so an edge is measured between its vertices too. */
export function outlinePts(d, steps = 12) {
  const t = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [], out = [], N = { M: 2, L: 2, C: 6, Q: 4 };
  let c = [0, 0], cmd = 'M', start = c;
  for (let i = 0; i < t.length;) {
    if (/[MLCQZ]/i.test(t[i])) { cmd = t[i++].toUpperCase(); if (cmd === 'Z') { for (let k = 1; k <= steps; k++) out.push([0, 1].map((j) => c[j] + (k / steps) * (start[j] - c[j]))); c = start; } continue; } // Z closes with a line back to the start
    const n = N[cmd], v = t.slice(i, i + n).map(Number); i += n;
    for (let k = 1; k <= (cmd === 'M' ? 1 : steps); k++) { const u = cmd === 'M' ? 1 : k / steps, w = 1 - u;
      out.push(cmd === 'C' ? [0, 1].map((j) => w * w * w * c[j] + 3 * w * w * u * v[j] + 3 * w * u * u * v[2 + j] + u * u * u * v[4 + j]) : cmd === 'Q' ? [0, 1].map((j) => w * w * c[j] + 2 * w * u * v[j] + u * u * v[2 + j]) : cmd === 'L' ? [0, 1].map((j) => w * c[j] + u * v[j]) : [v[0], v[1]]); }
    c = [v[n - 2], v[n - 1]]; if (cmd === 'M') start = c;
  }
  return out;
}
export const HAIR_TURN = 8; // how far the features slide past the hair per unit of turn (12 against 4)

/** Where a face-framing panel (LONG_HAIR) leaves the face showing beside or under it: the most the face's own outline runs past the panel's outer edge between the cheekbone and the jaw corner, and how far the panel's cut stops short of the jaw corner, in sheet units, the worse of the two (positive: the face shows). T113: the panels were the default head's, scaled by width alone, so a full cheek or a broad jaw stood out past them and the jaw came out under a flat cut at the mouth, and the hair read as a see-through sheet on the face. */
export const PANEL_OFF_FACE = 2; // how much face may show past a panel's outer edge or under its cut before it reads as a sheet on the face
export function panelOffFace(p) {
  if (!LONG_HAIR.includes(p.hair?.style)) return -Infinity;
  const k = p.face.width / 156, face = outlinePts(facePath(p), 32), jawY = 112 + p.face.height - (p.face.corner ?? 32);
  const hair = (HAIR[p.hair.style].front(p)).filter((o) => o.k === 'path').flatMap((o) => outlinePts(o.d, 32)).map(([x, y]) => [200 + (x - 200) * k, y]);
  let worst = -Infinity;
  for (const s of [-1, 1]) {
    const side = hair.filter(([x]) => s * (x - 200) > 0), bottom = Math.max(...side.map(([, y]) => y));
    worst = Math.max(worst, jawY - bottom);
    for (let y = 216; y <= Math.min(bottom, jawY); y += 4) {
      const reach = (pts) => Math.max(0, ...pts.filter(([x, py]) => s * (x - 200) > 0 && Math.abs(py - y) <= 3).map(([x]) => s * (x - 200)));
      worst = Math.max(worst, reach(face) - reach(side));
    }
  }
  return worst;
}

/** How far a hanging front panel of hair reaches in past an eye's outer corner near the eye line, in sheet units (negative: how far it stays outside). A panel is a front hair path that hangs past the eye line; a temple wing or a fringe is not one. T012: a bluntBob's panels at -5..-8 laid a slab of hair across the eye corners and cheeks, since the lashes and the eye's shadow run past the white's corner. The hair follows the face's width; the eyes sit at their spacing on the laid-out eye line, and on a turn slide HAIR_TURN past the hair (12 x turn against its 4). The edge is read along its curves, not at its vertices: the stretched panels of T113 have no vertex at the eye line. */
export function hairOverEye(p) {
  const r = HAIR[p.hair?.style]; if (!r) return -Infinity;
  const k = (p.face?.width ?? 156) / 156, ey = 112 + (p.eyes.y - 112) * (p.face?.height ?? 204) / 204, [l, rt] = [-1, 1].map((s) => eyeShape(p, s).xo + HAIR_TURN * (p.pose?.turn ?? 0));
  const panels = (typeof r === 'function' ? r(p) : r.front(p)).filter((o) => o.k === 'path' && o.fill && o.fill !== 'none' && (o.op ?? 1) > 0.5 && pointsOf(o).some(([, y]) => y > ey + 30)); // a shaved head's shadow is not hair over anything
  let over = -Infinity;
  for (const op of panels) for (const [x0, y] of outlinePts(op.d)) if (Math.abs(y - ey) <= 25) { const x = 200 + (x0 - 200) * k; over = Math.max(over, Math.min(x - l, rt - x)); }
  return over;
}
/** The horn this face wears, as a part: the makeup whose name says horn (T061: the lint named curvedHorns on every dragonborn, whose horns are the hornCrest). */
/** How much of the white shows over the iris at the lid's peak, the smaller side (T015: a narrow or hooded eye opened to 1.45 kept its iris against the lid). */
export function whiteOverIris(p) {
  return Math.min(...[-1, 1].map((s) => { const E = eyeShape(p, s); return E.th - (E.st.top * 0.22 + E.st.iris * (1.5 - 0.55 * (p.eyes.sclera ?? E.st.sclera))); }));
}
export const WIDE_OPEN = 1.4, WIDE_WHITE = 4; // an eye opened to WIDE_OPEN shows at least WIDE_WHITE of white over the iris, past the lid's shadow. Only wideEyed (1.45) and the like ask for white above the iris: openMouth (1.35) and deadStare (1.32) read open at cell size with white beside it (T079)
export const hornParts =(p) => { const h = (p.makeup ?? []).filter((n) => /horn/i.test(n)).map((n) => `makeup:${n}`); return h.length ? h : ['unknown:horn']; };

/** A shaved head's hair is only a shadow on the scalp (the hair colour, faint): drawn outside any clip it is the default cap fitted to a head whose skull may be lower or flatter, and stands clear above the crown as a halo (T008). The first such op drawn at clip depth 0, or null. */
export function shadowHairOut(p, ops) {
  if (p.hair?.style !== 'shavedHead') return null;
  let depth = 0;
  for (const op of ops) { if (op.k === 'clip') depth++; else if (op.k === 'unclip') depth = Math.max(0, depth - 1); else if (!depth && op.fill === p.hairColor && (op.op ?? 1) < 0.5) return op; }
  return null;
}

/** How wide a beard's mass still is near its bottom, against the face's half width: the hull (the clip every banded beard opens with) traced as curves, the widest point in its lowest fifth between the cheekbone and the beard's foot. A box keeps the jaw's full width down there (T062: the hull was the face outline stretched down, ~0.8); a beard tapers under the chin. null with no hull. */
export function beardBox(p) {
  const [hull] = (FACIAL_HAIR[p.facialHair?.style] ?? (() => []))(p); if (hull?.k !== 'clip') return null;
  const tok = hull.d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [], pts = []; let cur = [0, 0], cmd = '';
  for (let i = 0; i < tok.length;) { if (/[MLCQZ]/.test(tok[i])) { cmd = tok[i++]; if (cmd === 'Z') continue; } const n = { M: 2, L: 2, Q: 4, C: 6 }[cmd], a = tok.slice(i, i + n).map(Number); i += n;
    if (cmd === 'C') for (let t = 0.05; t <= 1; t += 0.05) { const u = 1 - t; pts.push([u ** 3 * cur[0] + 3 * u * u * t * a[0] + 3 * u * t * t * a[2] + t ** 3 * a[4], u ** 3 * cur[1] + 3 * u * u * t * a[1] + 3 * u * t * t * a[3] + t ** 3 * a[5]]); }
    else pts.push([a[n - 2], a[n - 1]]);
    cur = [a[n - 2], a[n - 1]]; }
  const foot = Math.max(...pts.map(([, y]) => y)), low = 216 + 0.8 * (foot - 216);
  if (foot - (112 + p.face.height + 16 * p.face.chin) < 2) return null; // a stubble (chin 0) hangs nothing past the chin: its foot is the face's own jaw, as wide as that jaw is, and no box (T117)
  return Math.max(...pts.filter(([, y]) => y >= low).map(([x]) => Math.abs(x - 200))) / (p.face.width / 2);
}
export const BEARD_BOX = 0.58; // the 21 evidence beards measured 0.45..0.80 as boxes and 0.41..0.56 tapered; a beard's mass in its lowest fifth no wider than this much of the face's half width

/** How far a leafCirclet's band reaches past the skull at the temples, where it should turn behind the head: its widest point (fitted to this face as the hat is) less the face's half width less CIRCLET_IN. Over 0 the band runs out past the head (T088). null with no circlet. */
export function circletPastHead(p) {
  if (p.hat?.style !== 'leafCirclet') return null;
  const [band] = HATS.leafCirclet(p), xs = pointsOf(band).map(([x]) => Math.abs(x - 200) * (p.face.width / 156));
  return Math.max(...xs) - (p.face.width / 2 - CIRCLET_IN);
}
export const CIRCLET_IN = 6; // the skull at the band's height is about this much inside the face's half width

export const HAIR_EYE_CLEAR = 10; // how far outside an eye's outer corner a panel's edge must hang

/** A raised hand (a prop that lifts an arm) whose centre lands on the face: inside the face's half width, between the top of the head and the chin. The handsUp hands sat on the temples, and a short-armed people's on the cheeks (T043). The hand ellipses are the skin- or glove-coloured ellipses the prop adds over the same figure with no prop. The offending hand's centre, or null. */
export function handOnFace(p, ops = portraitOps(p)) {
  if (!(p.props ?? []).some((n) => PROPS[n]?.lift)) return null;
  const without = new Set(portraitOps({ ...p, props: [] }).map((o) => JSON.stringify(o)));
  const hb = headBox(p), k = (hb.chin - hb.top) / (p.face.height + 16 * p.face.chin), half = (p.face.width / 2) * k, cx = 200 + (p.pose?.headX ?? 0);
  const hands = ops.filter((o) => o.k === 'ellipse' && (o.fill === p.skin || o.fill === '#161517') && !without.has(JSON.stringify(o)));
  const on = hands.find((o) => Math.abs(o.cx - cx) < half && o.cy > hb.top && o.cy < hb.chin);
  return on ? [on.cx, on.cy] : null;
}

const POSE_KEYS =['pose.headX', 'pose.headY', 'pose.headTilt', 'pose.bodyTilt', 'pose.turn', 'pose.shoulder', 'props'];
/** The lints over a sheet cell: the ops lints, plus the ones that need the state (a stance compared against no stance). */
export function lintState(st, tuple) {
  const p = params(st), ops = portraitOps(p), out = lintOps(ops, { dy: FEET_Y - feetY(p) });
  if ((p.nose?.muzzle ?? 0) > 0 && (p.nose.mode ?? 'human') === 'human' && (p.mouth.mode ?? 'human') === 'human' && muzzleGap(p) < 2) out.push({ name: 'anatomy:muzzle-mouth', parts: ['unknown:muzzle'], detail: `the mouth line is ${muzzleGap(p).toFixed(1)} under the nostrils` });
  if ((p.nose?.muzzle ?? 0) > 0 && (p.nose.mode ?? 'human') === 'human' && (p.mouth.mode ?? 'human') === 'human') { const past = mouthPastMuzzle(p, ops); if (past > MOUTH_PAST_MUZZLE) out.push({ name: 'anatomy:mouth-past-muzzle', parts: [`mouth:${p.mouth.style}`], detail: `the mouth runs ${past.toFixed(1)} past the muzzle pad (over ${MOUTH_PAST_MUZZLE})` }); }
  const crownOut = crownStrokesOut(ops); if (crownOut) out.push({ name: 'render:crown-stroke-out', parts: [`hat:${p.hat.style}`], detail: `a crown's stroke ends at ${crownOut.map((v) => v.toFixed(1))}, outside the crown` });
  const hornOut = hornStrokesOut(ops); if (hornOut) out.push({ name: 'render:horn-stroke-out', parts: hornParts(p), detail: `a horn's stroke ends at ${hornOut.map((v) => v.toFixed(1))}, outside the horn` });
  const box = beardBox(p); if (box > BEARD_BOX) out.push({ name: 'stack:beard-box', parts: [`facialHair:${p.facialHair.style}`], detail: `the beard's foot is ${box.toFixed(2)} of the face's half width (over ${BEARD_BOX})` });
  if (shadowHairOut(p, ops)) out.push({ name: 'stack:shaved-halo', parts: ['hair:shavedHead'], detail: 'the shaved head\'s shadow is drawn outside the head\'s clip' });
  if ((p.eyes.mode ?? 'human') === 'human' && p.eyes.openness >= WIDE_OPEN) { const w = whiteOverIris(p); if (w < WIDE_WHITE) out.push({ name: 'expression:wide-no-white', parts: [`eyes:${p.eyes.style}`], detail: `opened to ${p.eyes.openness}, the lid clears the iris by ${w.toFixed(1)} (under ${WIDE_WHITE})` }); }
  const circ = circletPastHead(p); if (circ > 0) out.push({ name: 'stack:circlet-past-head', parts: ['hat:leafCirclet'], detail: 'the circlet runs ' + circ.toFixed(1) + ' past the skull at the temples' });
  const off = panelOffFace(p); if (off > PANEL_OFF_FACE) out.push({ name: 'stack:panel-off-face', parts: [`hair:${p.hair.style}`], detail: `the face shows ${off.toFixed(1)} past or under a hanging panel (over ${PANEL_OFF_FACE})` });
  const hair = hairOverEye(p); if (hair > -HAIR_EYE_CLEAR) out.push({ name: 'stack:hair-over-eye', parts: [`hair:${p.hair.style}`], detail: `a front hair panel hangs ${(-hair).toFixed(1)} outside an eye's outer corner (under ${HAIR_EYE_CLEAR})` });
  const onFace = handOnFace(p, ops); if (onFace) out.push({ name: 'pose:hand-on-face', parts: tuple.stance && tuple.stance !== 'none' ? [`stance:${tuple.stance}`] : p.props.filter((n) => PROPS[n]?.lift).map((n) => `props:${n}`), detail: `a raised hand lands at ${onFace.map((v) => v.toFixed(1))}, on the face` });
  if (tuple.stance && tuple.stance !== 'none') {
    const ov = { ...st.ov }; for (const k of POSE_KEYS) delete ov[k];
    if (JSON.stringify(ops) === JSON.stringify(portraitOps(params({ ...st, ov })))) out.push({ name: 'pose:stance-noop', parts: [`stance:${tuple.stance}`], detail: 'the stance draws the same figure as no stance' });
  }
  return out;
}
