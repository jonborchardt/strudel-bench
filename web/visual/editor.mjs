// The portrait editor's data (portrait.html is the DOM around it): one CONTROLS spec naming every parameter of
// portrait.mjs with the control that fits it (slider, dropdown, colour, toggle, multi-select), grouped in the order
// the face is built — base, head, features, hair, clothing, then pose and light last — plus the presets that write
// several parameters at once (a face shape, a neck type, a costume family, an expression).
// The state is small and total: `{ seed, family, ov }`. `base(seed, family)` is a random character from the seeded
// generator (constrained to one FAMILIES entry unless family is 'any'), `ov` the edits as flat dotted paths over it,
// so one edit changes one option and nothing else, and `encode`/`decode` put the whole state in the URL hash: the
// same hash is the same face every time, and every commit is a history entry, so Back steps through the edits.
import { DEFAULTS, COLORS, FACE_SHAPES, NECK_TYPES, EYE_STYLES, BROW_STYLES, NOSE_STYLES, MOUTH_STYLES, TEETH_STYLES, HAIR_STYLES, FACIAL_HAIR_STYLES, MUSTACHE_STYLES, GLASSES_STYLES, HAT_STYLES, TOP_STYLES, JACKET_STYLES, ACCESSORY_STYLES, DETAIL_STYLES, MAKEUP_STYLES, MARK_STYLES, PROP_STYLES, GRAPHIC_STYLES, LONG_HAIR, merge } from './portrait.mjs';
import { FAMILY_NAMES, characterOf, faceOf, EXPRESSIONS, COSTUMES, COSTUME_FAMILIES } from './cast.mjs';
import { seed as seedState } from './kit.mjs';
import { prng } from '../../lib/random.mjs';

const num = (path, min, max, step = 0.01, o = {}) => ({ kind: 'num', path, min, max, step, ...o });
const int = (path, min, max, o = {}) => num(path, min, max, 1, o);
const en = (path, options, o = {}) => ({ kind: 'enum', path, options, ...o });
const col = (path, palette, o = {}) => ({ kind: 'color', path, palette, ...o });
const multi = (path, options) => ({ kind: 'multi', path, options });
const bool = (path) => ({ kind: 'bool', path });
const preset = (path, options, apply) => ({ kind: 'preset', path, options, apply });

/** A nested object as flat dotted paths (the leaves: numbers, strings, booleans, arrays and nulls). */
export function flat(o, at = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, at + k + '.', out);
    else out[at + k] = v;
  }
  return out;
}
/** The reverse: flat dotted paths back to a nested object. */
export function expand(ov) {
  const out = {};
  for (const [k, v] of Object.entries(ov)) {
    const seg = k.split('.');
    let o = out;
    for (const s of seg.slice(0, -1)) o = o[s] && typeof o[s] === 'object' ? o[s] : (o[s] = {});
    o[seg.at(-1)] = v;
  }
  return out;
}
export const at = (o, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
/** Write one path into the overrides, dropping the entries it would contradict (a parent set to null, or children of the path). */
export function setOv(ov, path, value) {
  for (const k of Object.keys(ov)) if (k.startsWith(path + '.') || (path.startsWith(k + '.') && ov[k] === null)) delete ov[k];
  ov[path] = value;
  return ov;
}

const FAMILIES_PLUS = ['any', ...FAMILY_NAMES];
/** The character the edits sit on: a random one from the seed, its face constrained to one structural family when asked. */
export function base(seed = 1, family = 'any') {
  const s = {};
  seedState(s, prng(seed));
  const c = characterOf(s, 'none', 0.5);
  if (family !== 'any' && FAMILY_NAMES.includes(family)) {
    const { shape, ...f } = faceOf(s, family);
    Object.assign(c, f);
    if (shape === FACE_SHAPES.longOval && LONG_HAIR.includes(c.hair.style)) c.hair = { style: 'sidePart' }; // long hair never on a long oval head
  }
  delete c.cheeks; delete c.frame; // the faces world's own keys, not the portrait's
  return c;
}
/** The portrait options a state draws: the defaults, the seed's character, then the edits. */
export const params = (st) => merge(merge(DEFAULTS, base(st.seed, st.family)), expand(st.ov ?? {}));

/** A blank state. A function, not a constant: its `ov` is written in place, so a shared one would alias every reset. */
export const blank = () => ({ seed: 1, family: 'any', ov: { background: '#c8102e' } }); // red behind the sitter by default: an edge against the page's beige is invisible
export const encode = (st) => btoa(JSON.stringify(st)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decode(hash) {
  try {
    const st = JSON.parse(atob(String(hash).replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/')));
    return { ...blank(), ...st, ov: { ...(st.ov ?? {}) } };
  } catch { return blank(); }
}

const shapePreset = (v) => ({ 'face.width': FACE_SHAPES[v].width, 'face.height': FACE_SHAPES[v].height, 'face.jaw': FACE_SHAPES[v].jaw, 'face.chin': FACE_SHAPES[v].chin, 'face.corner': FACE_SHAPES[v].corner ?? 32 });
const neckPreset = (v) => ({ 'neck.width': NECK_TYPES[v].width, 'neck.height': NECK_TYPES[v].height });
const costumePreset = (v) => flat(COSTUMES[v](0));
const exprPreset = (v) => { const e = EXPRESSIONS[v]; return { 'mouth.smile': e.mouth.smile, 'mouth.open': e.mouth.open ?? 0, 'mouth.style': e.mouth.style ?? 'plain', 'eyes.openness': e.eyes.openness ?? 1, 'eyes.browLift': e.eyes.browLift ?? 0, 'eyes.browSkew': e.eyes.browSkew ?? 0 }; };

/** Every parameter, grouped in build order: what the face is, then the head it is on (hair and beard included), its features, what it wears (glasses among the clothes), and how it stands. */
export const GROUPS = [
  { name: 'base', items: [
    en('$family', FAMILIES_PLUS, { state: 'family' }),
    int('$seed', 0, 999999, { state: 'seed' }),
  ] },
  { name: 'head', items: [
    preset('shape', Object.keys(FACE_SHAPES), shapePreset),
    int('face.width', 118, 205), int('face.height', 158, 245), num('face.jaw', 0.45, 1.05), num('face.chin', 0, 0.5), int('face.corner', 0, 64),
    num('face.skew', -1, 1, 0.02), num('face.fullness', -1, 1, 0.02),
    num('face.asym.cheek', -2, 2, 0.05), num('face.asym.jaw', -2, 2, 0.05), num('face.asym.temple', -2, 2, 0.05), num('face.asym.chin', -2, 2, 0.05),
    num('ears.size', 0.5, 1.6, 0.02),
    preset('neck', Object.keys(NECK_TYPES), neckPreset), int('neck.width', 34, 98), int('neck.height', 44, 102),
    num('body.width', 0.7, 1.6), col('skin', 'skin'),
    col('hairColor', 'hair'), en('hair.style', HAIR_STYLES), num('hair.hairline', -1, 1, 0.02), num('hair.recession', 0, 1, 0.02),
    en('facialHair.style', FACIAL_HAIR_STYLES), col('facialHair.color', 'hair', { nullable: true }), num('facialHair.density', 0, 1, 0.02, { nullable: true }), num('facialHair.cheekLine', 0, 1, 0.02, { nullable: true }), num('facialHair.mustache', 0, 1, 1, { nullable: true }), en('facialHair.mustacheStyle', MUSTACHE_STYLES, { nullable: true }),
  ] },
  { name: 'features', items: [
    preset('expression', Object.keys(EXPRESSIONS), exprPreset),
    en('eyes.style', EYE_STYLES), en('eyes.browStyle', BROW_STYLES),
    int('eyes.y', 176, 216), num('eyes.spacing', 36, 76, 0.5), num('eyes.openness', 0, 1.4, 0.02), num('eyes.asym', 0.55, 1.45, 0.02), num('eyes.dy', -6, 6, 0.1),
    num('eyes.depth', 0, 1, 0.02), num('eyes.sclera', 0, 1, 0.02, { nullable: true }), num('eyes.lidWeight', 0, 1, 0.02, { nullable: true }), num('eyes.corner', 0, 1, 0.02, { nullable: true }), num('eyes.bags', 0, 1, 0.02), num('eyes.squint', 0, 1, 0.02),
    col('eyes.iris', 'eyes'), col('eyes.pupil'),
    num('eyes.browLift', -6, 8, 0.1), num('eyes.browSkew', -0.6, 0.6, 0.02),
    num('eyes.look.x', -1, 1, 0.02), num('eyes.look.y', -1, 1, 0.02),
    en('nose.style', NOSE_STYLES), num('nose.length', 22, 58, 0.5), num('nose.width', 7, 36, 0.5),
    en('mouth.style', MOUTH_STYLES), en('mouth.teeth', TEETH_STYLES), int('mouth.y', 232, 298), num('mouth.width', 26, 70, 0.5), num('mouth.smile', -1, 1, 0.02), num('mouth.fullness', 0, 1, 0.02), num('mouth.open', 0, 1, 0.02), col('mouth.color', null, { nullable: true }),
    num('blush', 0, 1, 0.02),
    multi('details', DETAIL_STYLES), multi('makeup', MAKEUP_STYLES), multi('marks', MARK_STYLES),
  ] },
  { name: 'clothing', items: [
    preset('costume', COSTUME_FAMILIES, costumePreset),
    en('top.style', TOP_STYLES), col('top.color', 'clothing'), col('top.accent', 'clothing', { nullable: true }), en('top.graphic', ['none', ...GRAPHIC_STYLES], { nullable: true }), col('top.graphicColor', null, { nullable: true }), num('top.graphicScale', 0.4, 2, 0.05), int('top.graphicY', -60, 60), bool('top.metal'),
    en('jacket.style', JACKET_STYLES), col('jacket.color', 'clothing'), bool('jacket.metal'),
    en('hat.style', HAT_STYLES), col('hat.color', 'clothing'), col('hat.accent', 'clothing'), bool('hat.metal'),
    en('glasses.style', ['none', ...GLASSES_STYLES], { nullable: true, clears: 'glasses' }), col('glasses.color'),
    multi('accessories', ACCESSORY_STYLES), multi('props', PROP_STYLES),
  ] },
  { name: 'pose & light', items: [
    num('pose.headX', -25, 25, 0.5), num('pose.headY', -25, 25, 0.5), num('pose.headTilt', -0.4, 0.4, 0.01),
    num('pose.bodyX', -25, 25, 0.5), num('pose.bodyTilt', -0.15, 0.15, 0.005),
    num('pose.turn', -1, 1, 0.02), num('pose.shoulder', -1, 1, 0.02), en('pose.gaze', ['none', 'camera'], { nullable: true }),
    en('light.side', [-1, 1], { labels: ['left', 'right'] }), num('light.amount', 0, 1, 0.02), num('light.contrast', 0.4, 2, 0.05),
    int('seed', 0, 99), col('background'), // the portrait's own seed: where the metallic sheen's folds fall
  ] },
];
export const CONTROLS = GROUPS.flatMap((g) => g.items);
export const PALETTES = COLORS;

/** The label a control shows: its path in words. */
export const labelOf = (c) => (c.kind === 'preset' ? c.path : c.path.replace(/^\$/, '').split('.').join(' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
/** Which preset option (if any) the current portrait matches. */
export const presetMatch = (c, p) => c.options.find((v) => Object.entries(c.apply(v)).every(([k, x]) => JSON.stringify(at(p, k)) === JSON.stringify(x))) ?? '';

const styles = (p) => `${p.face.width}x${p.face.height} jaw ${p.face.jaw.toFixed(2)} chin ${p.face.chin} corner ${p.face.corner ?? 32} · neck ${p.neck.width}x${p.neck.height} · body ${p.body.width}`;
/** A bug report: what to paste back when a face looks wrong. The link reproduces it exactly. */
export function report(st, note, url) {
  const p = params(st);
  return [
    `portrait issue: ${note || '(say what looks wrong)'}`,
    `link: ${url}`,
    `seed ${st.seed} · family ${st.family}`,
    `head: ${styles(p)}`,
    `features: eyes ${p.eyes.style}/${p.eyes.browStyle} spacing ${p.eyes.spacing.toFixed(1)} · nose ${p.nose.style} ${p.nose.length.toFixed(1)}x${p.nose.width.toFixed(1)} · mouth ${p.mouth.style} w${p.mouth.width.toFixed(1)}`,
    `hair: ${p.hair.style} (${p.hairColor}) hairline ${p.hair.hairline ?? 0}/${p.hair.recession ?? 0} · beard ${p.facialHair.style} (${p.facialHair.color ?? 'hair'}) density ${p.facialHair.density ?? 'style'} cheek ${p.facialHair.cheekLine ?? 'style'} stache ${p.facialHair.mustache ?? 'style'} · glasses ${p.glasses?.style ?? 'none'} · hat ${p.hat.style} (${p.hat.color})`,
    `worn: top ${p.top.style} (${p.top.color})${p.top.graphic ? ' graphic ' + p.top.graphic : ''} · jacket ${p.jacket.style} (${p.jacket.color}) · accessories [${p.accessories}] · props [${p.props}] · makeup [${p.makeup}] · marks [${p.marks}] · details [${p.details}]`,
    `pose: ${Object.entries(p.pose).map(([k, v]) => `${k} ${v}`).join(' ')} · light side ${p.light.side} amount ${p.light.amount} contrast ${p.light.contrast}`,
    `edits: ${Object.entries(st.ov ?? {}).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ') || '(none)'}`,
    `params: ${JSON.stringify(p)}`,
  ].join('\n');
}

// --- idle animation (the animate toggle): the sitter waiting, on top of whatever the controls say ---
const wave = (t, period, phase) => Math.sin((t / period + phase) * Math.PI * 2);
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const fract = (n) => { const x = Math.sin(n * 127.1) * 43758.5; return x - Math.floor(x); }; // a deterministic 0..1 per saccade/blink index
const SACCADE = 2.4, BLINK = 4.3; // seconds between a look somewhere else, and between blinks (both jittered)
/** The portrait's params with the pose, the gaze, the lids and the expression drifting as if the sitter were bored at
 *  time `t` seconds: two slow moods (one for the mouth, one for the brows) carry the face through mild boredom,
 *  a flicker of interest and a wry half-smile, on top of whatever the controls say.
 *  Pure and deterministic: the same t gives the same face, and nothing is written back to the state. */
export function idle(p, t) {
  const k = Math.floor(t / SACCADE), e = Math.min(1, (t - k * SACCADE) / 0.12); // the flick itself is fast, the hold long
  const gaze = (i) => (fract(k * 2 + i) - 0.5) * 1.3, was = (i) => (fract((k - 1) * 2 + i) - 0.5) * 1.3;
  const b = Math.floor(t / BLINK), bt = t - (b * BLINK + fract(b) * 3); // one blink per window, somewhere in it
  const lid = bt >= 0 && bt < 0.16 ? Math.abs(Math.cos(bt / 0.16 * Math.PI)) : 1;
  const mood = wave(t, 37, 0.15), brow = wave(t, 26, 0.55); // the two slow swings the expression rides on
  const sigh = Math.max(0, wave(t, 13.7, 0.8)) ** 3; // now and then the lips part
  return merge(p, {
    pose: {
      headX: p.pose.headX + 6 * wave(t, 11, 0.1), headY: p.pose.headY + 3 * wave(t, 17, 0.4), headTilt: p.pose.headTilt + 0.05 * wave(t, 13, 0.7),
      bodyX: p.pose.bodyX + 3 * wave(t, 23, 0.2), bodyTilt: p.pose.bodyTilt + 0.02 * wave(t, 19, 0.9),
      turn: cl(p.pose.turn + 0.3 * wave(t, 29, 0.3) + 0.1 * wave(t, 8.5, 0), -1, 1), shoulder: cl(p.pose.shoulder + 0.1 * wave(t, 31, 0.6), -1, 1),
    },
    eyes: {
      openness: cl((p.eyes.openness + 0.1 * Math.max(0, brow)) * lid, 0, 1.4), // interest opens them a little, and the blink still shuts them all the way
      look: { x: cl(was(0) + (gaze(0) - was(0)) * e, -1, 1), y: cl((was(1) + (gaze(1) - was(1)) * e) * 0.6, -1, 1) },
      browLift: cl(p.eyes.browLift + 2 * brow, -6, 8), browSkew: cl(p.eyes.browSkew + 0.14 * wave(t, 21, 0.25), -0.6, 0.6), // one brow up: the wry half of the expression
    },
    mouth: {
      smile: cl(p.mouth.smile + 0.22 * mood + 0.06 * wave(t, 7.3, 0.5), -1, 1),
      open: cl(p.mouth.open + 0.12 * sigh, 0, 1),
      fullness: cl(p.mouth.fullness + 0.06 * wave(t, 18, 0.35), 0, 1),
    },
  });
}
