// The portrait editor's data (portrait.html is the DOM around it): one CONTROLS spec naming every parameter of
// portrait.mjs with the control that fits it (slider, dropdown, colour, toggle, multi-select), grouped in the order
// the face is built — base, head, features, hair, clothing, then pose and light last — plus the presets that write
// several parameters at once (a face shape, a neck type, a costume family, an expression).
// The state is small and total: `{ seed, family, ov }`. `base(seed, family)` is a random character from the seeded
// generator (constrained to one FAMILIES entry unless family is 'any'), `ov` the edits as flat dotted paths over it,
// so one edit changes one option and nothing else, and `encode`/`decode` put the whole state in the URL hash: the
// same hash is the same face every time, and every commit is a history entry, so Back steps through the edits.
import { DEFAULTS, COLORS, LEG_STYLES, FACE_SHAPES, NECK_TYPES, EYE_STYLES, BROW_STYLES, NOSE_STYLES, MOUTH_STYLES, TEETH_STYLES, HAIR_STYLES, FACIAL_HAIR_STYLES, MUSTACHE_STYLES, GLASSES_STYLES, HAT_STYLES, TOP_STYLES, JACKET_STYLES, ACCESSORY_STYLES, DETAIL_STYLES, MAKEUP_STYLES, MARK_STYLES, PROP_STYLES, GRAPHIC_STYLES, LONG_HAIR, merge, parts, tagsOf } from './portrait.mjs';
import { FAMILY_NAMES, characterFrom, faceOf, EXPRESSIONS, COSTUMES, COSTUME_FAMILIES, signatureOf } from './cast.mjs';
import { CASTS, themeNames } from './themes.mjs'; // every theme's cast and parts register by name on import; the editor offers them only when the state's theme is on (groupsFor)
import VISUAL from '../../lib/visual.json' with { type: 'json' };
import { seed as seedState, rand } from './kit.mjs';
import { prng } from '../../lib/random.mjs';
const EXPRESSION_NAMES = Object.keys(EXPRESSIONS).filter((e) => !Object.values(CASTS).some((c) => c.expressions?.includes(e))); // the editorial expressions: the casts registered their own by name before this module ran

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
export const THEME_NAMES = ['none', ...themeNames()]; // the themes the editor offers (THEMES below says what each adds)
/** The cast a theme draws its people from (lib/visual.json's row), else the editorial one: with a theme on, a random character is a random one of that cast, in its clothes and with its signature. */
const castFor = (theme) => (on(theme) && VISUAL.themes[theme] && CASTS[VISUAL.themes[theme].cast]) || CASTS.editorial;
const pickOf = (r, a) => (a.length ? a[Math.floor(r() * a.length)] : null);
const castTags = (cast) => (cast === CASTS.editorial ? [] : themeTags(cast));
/** The layers a random one of this cast may wear: its own pack's with a theme on, else exactly what the editorial menu lists, so a pack that registers a part without tagging it never turns up on an editorial face. */
const layerPool = (kind, listed, cast) => { const tags = castTags(cast); return tags.length ? parts(kind, { any: tags }) : parts(kind).filter((n) => listed.includes(n)); };
/** What randomize draws that no generator sets. A cast's character leaves most of the panel on the portrait's own
 *  default for ever (the whole body, the lips, the lids, the light's contrast, what is worn under the clothes), so a
 *  reroll moved half the sliders and left the rest. Each entry draws inside its control's range from the state's own
 *  generator, and only where the cast does not decide it, so an elf's build and a zombie's teeth are the cast's and
 *  the rest is the seed's. Order is the draw order: deterministic, the seed is still the whole face. */
export const JITTER = {
  'mouth.smile': (r) => -0.25 + r() * 0.8, 'mouth.open': (r) => (r() < 0.22 ? 0.06 + r() * 0.36 : 0),
  'mouth.teeth': (r) => (r() < 0.3 ? pickOf(r, ['gapped', 'crooked', 'even']) : 'even'),
  'mouth.color': (r) => (r() < 0.22 ? pickOf(r, ['#8a4a46', '#a05a52', '#6e3a38', '#b07068']) : null),
  'eyes.lidWeight': (r) => (r() < 0.35 ? 0.2 + r() * 0.75 : null), 'eyes.corner': (r) => (r() < 0.3 ? 0.2 + r() * 0.75 : null),
  'eyes.look.x': (r) => (r() - 0.5) * 0.7, 'eyes.look.y': (r) => (r() - 0.5) * 0.5,
  'light.contrast': (r) => 0.85 + r() * 0.6, 'pose.bodyX': (r) => (r() - 0.5) * 12,
  'body.width': (r) => 0.82 + r() * 0.46, // the figure: a crowd of one width is a crowd of paper dolls
  'build.trunk': (r) => 0.94 + r() * 0.12, 'build.legs': (r) => 0.92 + r() * 0.16, 'build.shoulders': (r) => 0.9 + r() * 0.2, 'build.arms': (r) => 0.94 + r() * 0.12, 'build.head': (r) => 0.95 + r() * 0.1,
  'pants.style': (r) => (r() < 0.25 ? 'skirt' : 'trousers'), 'shoes.color': (r) => pickOf(r, ['#1f1d1b', '#2b2622', '#3a2f26', '#4a4038']),
  'top.accent': (r) => (r() < 0.3 ? pickOf(r, Object.values(COLORS.clothing)) : null),
  'facialHair.mustacheStyle': (r) => (r() < 0.3 ? pickOf(r, MUSTACHE_STYLES) : null),
  'top.metal': (r) => (r() < 0.06 ? 1 : 0), 'jacket.metal': (r) => (r() < 0.06 ? 1 : 0), 'hat.metal': (r) => (r() < 0.06 ? 1 : 0),
  seed: (r) => Math.floor(r() * 100), // the portrait's own seed: where the metallic sheen's folds fall
  makeup: (r, cast) => (r() < 0.2 ? [pickOf(r, layerPool('makeup', MAKEUP_STYLES, cast))].filter(Boolean) : []),
  marks: (r, cast) => (r() < 0.12 ? [pickOf(r, layerPool('marks', MARK_STYLES, cast).filter((n) => n !== 'none'))].filter(Boolean) : []),
  props: (r, cast) => (r() < 0.1 ? [pickOf(r, layerPool('props', PROP_STYLES, cast).filter((n) => !['none', 'handsAtSides', 'gloves'].includes(n)))].filter(Boolean) : []),
};
/** Which parameters a cast decides for everyone in it: its build and its signature's keys (the values are a throwaway draw; only the shape is read, so this costs the character's own stream nothing). */
const pinnedBy = (cast) => { const t = {}; seedState(t, prng(1)); return merge(cast.build && cast.build !== 'default' ? { build: cast.build } : {}, signatureOf(cast, t)); };
/** The character the edits sit on: a random one from the seed, of the theme's cast, its face constrained to one structural family when asked, and everything the cast leaves at the portrait's default drawn by JITTER. */
export function base(seed = 1, family = 'any', theme = 'none') {
  const s = {}, r = () => rand(s);
  seedState(s, prng(seed));
  const cast = castFor(theme);
  const c = characterFrom(cast, s, 'none', 0.5);
  if (family !== 'any' && FAMILY_NAMES.includes(family)) {
    const { shape, ...f } = faceOf(s, family, {}, cast.irises);
    Object.assign(c, f);
    if (cast.base) Object.assign(c, merge(c, signatureOf(cast, s))); // the cast's signature back over the chosen skull: a zombie keeps its milky eyes and its teeth
    if (shape === FACE_SHAPES.longOval && LONG_HAIR.includes(c.hair.style)) c.hair = { style: 'sidePart' }; // long hair never on a long oval head
  }
  const theirs = pinnedBy(cast), drawn = {};
  for (const [path, draw] of Object.entries(JITTER)) if (at(theirs, path) === undefined) drawn[path] = draw(r, cast);
  delete c.cheeks; delete c.frame; // the faces world's own keys, not the portrait's
  return merge(c, expand(drawn));
}
/** The portrait options a state draws: the defaults, the seed's character of its theme's cast, then the edits. */
export const params = (st) => merge(merge(DEFAULTS, base(st.seed, st.family, st.theme)), expand(st.ov ?? {}));

/** A blank state. A function, not a constant: its `ov` is written in place, so a shared one would alias every reset. */
export const blank = () => ({ seed: 1, family: 'any', theme: 'none', ov: { background: '#c8102e' } }); // red behind the sitter by default: an edge against the page's beige is invisible
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
    en('$theme', THEME_NAMES, { state: 'theme' }), // a theme widens the menus below with its own parts and adds its presets (groupsFor); none is the editorial editor
  ] },
  { name: 'head', items: [
    preset('shape', Object.keys(FACE_SHAPES), shapePreset),
    int('face.width', 118, 205), int('face.height', 158, 245), num('face.jaw', 0.45, 1.05), num('face.chin', 0, 0.5), int('face.corner', 0, 64),
    num('face.skew', -1, 1, 0.02), num('face.fullness', -1, 1, 0.02),
    num('face.asym.cheek', -2, 2, 0.05), num('face.asym.jaw', -2, 2, 0.05), num('face.asym.temple', -2, 2, 0.05), num('face.asym.chin', -2, 2, 0.05),
    num('ears.size', 0.5, 1.6, 0.02), num('ears.pointed', 0, 1, 0.02),
    preset('neck', Object.keys(NECK_TYPES), neckPreset), int('neck.width', 34, 98), int('neck.height', 44, 102),
    num('body.width', 0.7, 1.6), col('skin', 'skin'),
    col('hairColor', 'hair'), en('hair.style', HAIR_STYLES), num('hair.hairline', -1, 1, 0.02), num('hair.recession', 0, 1, 0.02),
    en('facialHair.style', FACIAL_HAIR_STYLES), col('facialHair.color', 'hair', { nullable: true }), num('facialHair.density', 0, 1, 0.02, { nullable: true }), num('facialHair.cheekLine', 0, 1, 0.02, { nullable: true }), num('facialHair.mustache', 0, 1, 1, { nullable: true }), en('facialHair.mustacheStyle', MUSTACHE_STYLES, { nullable: true }),
  ] },
  { name: 'features', items: [
    preset('expression', EXPRESSION_NAMES, exprPreset),
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
    en('pants.style', LEG_STYLES), col('pants.color', 'clothing'), col('shoes.color'),
    en('hat.style', HAT_STYLES), col('hat.color', 'clothing'), col('hat.accent', 'clothing'), bool('hat.metal'),
    en('glasses.style', ['none', ...GLASSES_STYLES], { nullable: true, clears: 'glasses' }), col('glasses.color'),
    multi('accessories', ACCESSORY_STYLES), multi('props', PROP_STYLES),
  ] },
  { name: 'build', items: [ // the body's proportions, 1 the figure as drawn: a cast's build (a dwarf is a different skeleton, not a scaled pose)
    num('build.trunk', 0.5, 1.5, 0.01), num('build.legs', 0.3, 1.5, 0.01), num('build.shoulders', 0.6, 1.6, 0.01), num('build.arms', 0.6, 1.4, 0.01), num('build.head', 0.7, 1.4, 0.01),
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

// Themes in the editor: a theme is a set of extra options on the menus that already exist (by control path) plus a
// preset that writes one of its characters over the base. GROUPS and CONTROLS stay the editorial editor, so a test or
// a page that reads them sees no theme; groupsFor(state) is what a page builds its panel from.
const on = (x) => x && x !== 'none';
/** One of a cast's archetypes as edits over the base: the cast's signature (its ears, a dead eye), its pins (skin, eyes,
 *  teeth, face, neck, body, stance), its hair, beard, home makeup and marks, the cast's build and contrast, and its home
 *  costume. The build and the ears are always written, the cast's own or the portrait's defaults, so picking a person of
 *  one cast sets back what a person of the last one left on the face; a signature that is a rule is drawn once per
 *  archetype, so the preset is the same person every time and reads back as itself. */
const castPreset = (cast, name) => {
  const a = cast.archetypes[name], { props = [], accessories = [], ...garments } = COSTUMES[a.costume](0);
  const s = {}; seedState(s, prng(1 + cast.archetypeNames.indexOf(name)));
  const sig = signatureOf(cast, s);
  return flat({ ...sig, ...a.set, hairColor: COLORS.hair[a.hairColors?.[0]] ?? '#30231e', hair: { style: a.hair }, facialHair: { style: a.beard ?? 'none' }, makeup: [a.makeup ?? 'none'].flat().filter(on), marks: [a.marks ?? 'none'].flat().filter(on), props, accessories, glasses: a.glasses ? { style: a.glasses, color: '#1d1b1a' } : null, blush: 0, light: { contrast: cast.contrast }, mouth: { ...(sig.mouth ?? {}), ...(a.set?.mouth ?? {}), smile: -0.05 }, hat: a.hat ?? { style: 'none' }, jacket: { style: 'none' },
    ears: { pointed: a.set?.ears?.pointed ?? sig.ears?.pointed ?? DEFAULTS.ears.pointed }, build: cast.build && cast.build !== 'default' ? cast.build : DEFAULTS.build, ...garments });
}; // the base's own hat, glasses, smile and blush go, as identityFrom and dress leave them: the costume says what is worn, the cast's contrast lights it
// the menu each kind of part lands on, and the pools' keys as kinds
const MENU = { top: 'top.style', jacket: 'jacket.style', hat: 'hat.style', hair: 'hair.style', facialHair: 'facialHair.style', glasses: 'glasses.style', teeth: 'mouth.teeth', makeup: 'makeup', marks: 'marks', props: 'props' }, POOL_KIND = { tops: 'top', jackets: 'jacket', beards: 'facialHair', hair: 'hair', glasses: 'glasses', details: 'details', graphics: 'graphics' };
/** A theme's tags: `only:<cast>` and every tag (but `everyday`) on a part in the cast's pools, which is how its packs' shared parts (`era:80s`) reach the menus without a hand-written list. */
const themeTags = (cast) => [...new Set([`only:${cast.name}`, ...Object.entries(cast.pools ?? {}).flatMap(([k, names]) => names.flatMap((n) => [...tagsOf(POOL_KIND[k], n)]))])].filter((t) => t !== 'everyday');
const editorial = Object.fromEntries(CONTROLS.filter((c) => c.options).map((c) => [c.path, new Set(c.options)]));
/** What a theme adds to the editor: every part its tags reach that the editorial menus lack, by control path, plus the cast's costumes and expressions, and one preset of its archetypes named by the cast. */
function themeEntry(cast) {
  const tags = themeTags(cast), extras = {};
  for (const [kind, path] of Object.entries(MENU)) { const add = parts(kind, { any: tags }).filter((n) => !editorial[path]?.has(n)); if (add.length) extras[path] = add; }
  const costumes = (cast.costumes ?? []).filter((c) => !editorial.costume.has(c)), expressions = [...new Set(cast.expressions ?? [])].filter((e) => !editorial.expression.has(e));
  if (costumes.length) extras.costume = costumes; if (expressions.length) extras.expression = expressions;
  return { extras, presets: cast.archetypeNames?.length ? [preset(cast.name, cast.archetypeNames, (n) => castPreset(cast, n))] : [] };
}
export const THEMES = Object.fromEntries(themeNames().map((name) => [name, themeEntry(CASTS[VISUAL.themes[name].cast])])); // one entry per bound theme, from the cast its json row names
/** The groups a page builds its panel from: GROUPS, and with a theme on, its options added to the menus they belong to and its presets after the base group's. */
export function groupsFor(st) {
  const t = THEMES[st?.theme]; if (!t) return GROUPS;
  return GROUPS.map((g, i) => ({ ...g, items: [...g.items.map((c) => (t.extras[c.path] ? { ...c, options: [...c.options, ...t.extras[c.path]] } : c)), ...(i === 0 ? t.presets : [])] }));
}
export const controlsFor = (st) => groupsFor(st).flatMap((g) => g.items);

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
    `seed ${st.seed} · family ${st.family}${on(st.theme) ? ` · theme ${st.theme}` : ''}`,
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
