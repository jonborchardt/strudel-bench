// tableau: the song as a fashion-editorial music video shot on three sets with a recurring cast of twenty-four
// procedural actors (cast.mjs over portrait.mjs): a red velvet curtain (theatrical, intimate, gold and black and
// pale skin), a white cyclorama (huge negative space, graphic silhouettes, statues behind the actors) and a black
// void used as punctuation. The cast is fixed at init from the archetypes, each person recognisable in every
// costume; a timeline of shots is composed per section at init from the section's phase (opening, development,
// escalation, peak, release: from its role and energy) with weighted shot templates and phrase lengths, so it reads
// as authored: long still portraits and duos first, then both sets and props and gold, then face paint, tattoos,
// groups and jump-cut costume cascades, then the peak's fast alternation with mirrored, split, gridded and black
// interruption frames, and a long clean portrait to release. Everything moves by editing: the actors breathe, blink,
// turn a degree, and no more. A snare jump-cuts the shot's mutation (the same pose in another costume, hat or face
// paint) when the shot allows it, a kick now and then punches the camera in, the melody moves the eyes a little, a
// hi-hat blinks one actor every few seconds, an fx impact is a graphic flash frame, a riser is a slow push-in, a
// dropout holds the shot dark with the eyes shut. Deterministic: randomness only from the state's own generator.
import { clamp, lerp, decay, ease, seed, rand, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn } from './portrait.mjs';
import { identityOf, dress, exprVals, ARCHETYPE_NAMES, COSTUME_FAMILIES, METALLIC, WHITE, RED, GOLD } from './cast.mjs';
import { curtain, cyclorama, voidSet, floorShadow, vignette, sculpture, SCULPTURES } from './sets.mjs';

const MIN_GAP = 0.15; // seconds between two cuts a hit may cause
const BLINK_GAP = 3; // seconds between one actor's blinks
// framings: sheet units per canvas height and where the eye line sits (a fraction of the height)
export const FRAMING = { eyes: { u: 90, ey: 0.5 }, extreme: { u: 170, ey: 0.46 }, close: { u: 330, ey: 0.42 }, medium: { u: 460, ey: 0.36 }, full: { u: 640, ey: 0.3 }, wide: { u: 900, ey: 0.3 } };
const FEET = 600; // the sheet's torso runs to here: where the floor meets a standing figure
const floorOf = (fr) => fr.ey + (FEET - 196) / fr.u;

/** The shot templates: set, cast size, framing, the poses and costumes allowed, and any effect. `any` takes the phase's alternating set. */
export const TEMPLATES = {
  redCurtainSoloPortrait: { set: 'red', n: 1, framing: 'medium', poses: ['directFrontal', 'slightLeanLeft', 'slightLeanRight', 'statueStill'] },
  redCurtainDuo: { set: 'red', n: 2, framing: 'medium', poses: ['linkedArmDuo', 'shoulderLeanDuo', 'protectiveDuo', 'pairFrontal'] },
  redCurtainGroup: { set: 'red', n: 3, framing: 'full', poses: ['smallGroupCluster', 'rowFrontal', 'oneBehindAnother'] },
  redCurtainWideTableau: { set: 'red', n: 3, framing: 'wide', poses: ['rowFrontal', 'smallGroupCluster'], gap: true },
  whiteStudioSolo: { set: 'white', n: 1, framing: 'full', poses: ['directFrontal', 'swaggerLean', 'statueStill', 'handsAtSides'] },
  whiteStudioDuo: { set: 'white', n: 2, framing: 'full', poses: ['pairFrontal', 'linkedArmDuo', 'oneBehindAnother', 'dominantForeground'] },
  whiteStudioGroup: { set: 'white', n: 3, framing: 'full', poses: ['rowFrontal', 'smallGroupCluster', 'oneBehindAnother'] },
  whiteStudioWideNegativeSpace: { set: 'white', n: 1, framing: 'wide', poses: ['statueStill', 'directFrontal'], offset: true },
  whiteStudioSculptureTableau: { set: 'white', n: 2, framing: 'wide', poses: ['pairFrontal', 'linkedArmDuo'], sculptures: true },
  goldHoodCloseup: { set: 'red', n: 1, framing: 'close', costume: 'goldHoodedMetallic', poses: ['directFrontal', 'statueStill'] },
  blackSuitPortrait: { set: 'red', n: 1, framing: 'medium', costume: 'severeBlackSuit', makeup: ['paleCorpseBase'], poses: ['directFrontal', 'statueStill'] },
  bluePerformerPortrait: { set: 'white', n: 1, framing: 'medium', costume: 'bluePerformerSuit', makeup: ['clownGraphic'], poses: ['directFrontal', 'slightLeanRight'] },
  graphicHoodiePortrait: { set: 'white', n: 1, framing: 'medium', costume: 'oversizedGraphicHoodie', poses: ['directFrontal', 'swaggerLean'] },
  tattooedGoldFashionDuo: { set: 'red', n: 2, framing: 'full', costumes: ['shirtlessTattooed', 'loudGoldRedFashion'], marks: [['chestDense'], []], poses: ['pairFrontal', 'shoulderLeanDuo'] },
  whiteCeremonialPair: { set: 'white', n: 2, framing: 'full', costume: 'whiteCeremonialOversize', poses: ['ceremonialOffering', 'pairFrontal'] },
  directStare: { set: 'any', n: 1, framing: 'close', expression: 'stare', poses: ['statueStill'] },
  extremeFaceCrop: { set: 'any', n: 1, framing: 'extreme', poses: ['statueStill'] },
  eyesCrop: { set: 'any', n: 1, framing: 'eyes', poses: ['statueStill'] },
  propPortrait: { set: 'any', n: 1, framing: 'medium', prop: true, poses: ['propPresentation'] },
  handGestureShot: { set: 'any', n: 1, framing: 'medium', poses: ['handHeart', 'handsUp'] },
  ceremonialExchange: { set: 'red', n: 2, framing: 'full', poses: ['ceremonialOffering'] },
  mirroredFace: { set: 'void', n: 1, framing: 'close', fx: 'mirror', poses: ['statueStill'] },
  splitFace: { set: 'void', n: 2, framing: 'close', fx: 'split', poses: ['statueStill'] },
  duplicateGrid: { set: 'white', n: 1, framing: 'close', fx: 'grid', grid: 2, poses: ['directFrontal'] },
  repeatedCharacterGrid: { set: 'red', n: 1, framing: 'close', fx: 'grid', grid: 3, poses: ['directFrontal'] },
  blackVoidPortrait: { set: 'void', n: 1, framing: 'close', band: true, poses: ['directFrontal', 'statueStill'] },
  graphicFlash: { set: 'void', n: 0, band: true, flash: true },
};
const SPECIAL = new Set(['mirroredFace', 'splitFace', 'duplicateGrid', 'repeatedCharacterGrid', 'blackVoidPortrait', 'graphicFlash', 'eyesCrop', 'extremeFaceCrop']); // punctuation: never two in a row

// the phases: shot lengths in bars, the odds of a cascade phrase (one pose cut through four stylings at a beat each), of a shot mutating on snares, of restrained makeup, theatrical paint, a gold costume, a prop, body marks, a hat; and the template weights
export const PHASES = {
  opening: { lens: [4, 8, 4, 2], cascade: 0, mutate: 0.05, makeup: 0.15, paint: 0, gold: 0.08, props: 0.05, marks: 0.05, hats: 0.1, punch: 0.01, emote: 0.3, tpls: { redCurtainSoloPortrait: 5, redCurtainDuo: 3, blackSuitPortrait: 2, directStare: 1, redCurtainWideTableau: 1, whiteStudioSolo: 1 } },
  development: { lens: [2, 4, 2, 4, 1], cascade: 0.08, mutate: 0.2, makeup: 0.35, paint: 0.1, gold: 0.25, props: 0.35, marks: 0.15, hats: 0.2, punch: 0.02, emote: 0.5, tpls: { redCurtainSoloPortrait: 2, redCurtainDuo: 2, whiteStudioSolo: 3, whiteStudioDuo: 2, whiteStudioWideNegativeSpace: 2, propPortrait: 2, whiteStudioSculptureTableau: 1, goldHoodCloseup: 1, graphicHoodiePortrait: 1, redCurtainGroup: 1, directStare: 1 } },
  escalation: { lens: [1, 2, 1, 2, 4], cascade: 0.25, mutate: 0.5, makeup: 0.6, paint: 0.35, gold: 0.45, props: 0.4, marks: 0.4, hats: 0.25, punch: 0.04, emote: 0.6, tpls: { tattooedGoldFashionDuo: 2, bluePerformerPortrait: 2, whiteStudioGroup: 2, redCurtainGroup: 2, goldHoodCloseup: 2, extremeFaceCrop: 1, ceremonialExchange: 1, whiteCeremonialPair: 1, handGestureShot: 1, redCurtainDuo: 1, whiteStudioDuo: 1, propPortrait: 1 } },
  peak: { lens: [0.5, 1, 1, 2, 0.5], cascade: 0.3, mutate: 0.7, makeup: 0.8, paint: 0.55, gold: 0.55, props: 0.35, marks: 0.5, hats: 0.2, punch: 0.08, emote: 0.7, tpls: { redCurtainDuo: 2, whiteStudioDuo: 2, goldHoodCloseup: 2, tattooedGoldFashionDuo: 2, redCurtainGroup: 1, whiteStudioGroup: 1, blackVoidPortrait: 2, graphicFlash: 1, mirroredFace: 1, splitFace: 1, duplicateGrid: 1, repeatedCharacterGrid: 1, eyesCrop: 1, extremeFaceCrop: 1, bluePerformerPortrait: 1, directStare: 1 } },
  release: { lens: [8, 16, 8], cascade: 0, mutate: 0, makeup: 0.2, paint: 0, gold: 0.15, props: 0.1, marks: 0.1, hats: 0.05, punch: 0, emote: 0.4, tpls: { whiteStudioSolo: 3, redCurtainDuo: 3, blackSuitPortrait: 2, whiteStudioWideNegativeSpace: 1, redCurtainSoloPortrait: 2 } },
};
const RESTRAINED = ['paleCorpseBase', 'darkEyeSockets', 'heavyUnderEye', 'sharpEditorialEyes', 'severeContour', 'blackLipLine', 'metallicEyeAccent', 'foreheadMark', 'cheekMark'];
const PAINTS = ['geometricEyePaint', 'asymmetricGraphicPaint', 'clownGraphic', 'smearedClown', 'whiteMaskBase'];
const MARKS = ['chestSparse', 'chestDense', 'neckMarks', 'faceMarkSmall', 'abstractLineWork', 'redGraphicLines', 'scriptLikeMarks', 'ceremonialSymbols', 'geometricBodyMarks'];
const PROPS = ['flamingFlower', 'sunglassesInHand', 'gloves', 'ceremonialObject', 'abstractGoldObject', 'abstractToyLikeProp', 'flower'];
const SKIN_MARKS = ['neckMarks', 'faceMarkSmall'];
const HATS = ['baseballCap', 'beanie', 'bucketHat', 'cuffedBeanie', 'snapback', 'flatCap'];
const STRONG = COSTUME_FAMILIES.filter((c) => !c.startsWith('plain'));
const EXPRESSIONS = ['deadpan', 'deadpan', 'deadpan', 'stare', 'slightSmile', 'sneer', 'halfSmile', 'smirk', 'pout', 'squint', 'grin', 'wideEyed'];
const EMOTES = ['deadpan', 'stare', 'slightSmile', 'sneer', 'halfSmile', 'smirk', 'pout', 'squint', 'grin', 'wideEyed']; // what an emoting actor moves to: the mouth changes shape, it never opens

const pick = (s, a) => a[Math.floor(rand(s) * a.length)];
const wpick = (s, w) => { const e = Object.entries(w), t = e.reduce((n, [, v]) => n + v, 0); let x = rand(s) * t; for (const [k, v] of e) { x -= v; if (x <= 0) return k; } return e[e.length - 1][0]; };

/** A section's phase from its role, else its place and energy. */
export function phaseOf(sections, i, climax) {
  const s = sections[i], n = sections.length, cix = sections.findIndex((x) => x.role === 'climax' || x.name === climax);
  if (s.role === 'establish') return 'opening'; if (s.role === 'climax') return 'peak'; if (s.role === 'release') return 'release';
  if (i === 0) return 'opening';
  if (i === n - 1 && s.energy < 0.7) return 'release';
  if (s.energy >= 0.9) return 'peak';
  if (i + 1 === cix || s.energy >= 0.7) return 'escalation';
  return 'development';
}

/** Where each figure stands for a pose: dx (canvas heights from the centre), dy (from the eye line), k (scale), the head's tilt and lean, props the pose adds, a look, `arm` (the index of the figure this one puts an arm on) and `over` (that arm goes over their shoulders, not linked at the hip). Index 0 is nearest the camera. */
export function layoutOf(pose, n, fr) {
  const sw = 400 / fr.u, F = (o = {}) => ({ dx: 0, dy: 0, k: 1, tilt: 0, bodyTilt: 0, headX: 0, props: [], look: null, arm: null, over: false, ...o });
  switch (pose) {
    case 'slightLeanLeft': return [F({ tilt: -0.06, bodyTilt: -0.025, headX: -4 })];
    case 'slightLeanRight': return [F({ tilt: 0.06, bodyTilt: 0.025, headX: 4 })];
    case 'swaggerLean': return [F({ tilt: 0.1, bodyTilt: 0.06, headX: 8, dx: -0.04 })];
    case 'handHeart': return [F({ props: ['handHeartGesture'] })];
    case 'handsUp': return [F({ props: ['handsUp'] })];
    case 'pairFrontal': return [F({ dx: -sw * 0.36 }), F({ dx: sw * 0.36 })];
    case 'linkedArmDuo': return [F({ dx: -sw * 0.3, tilt: 0.03, arm: 1 }), F({ dx: sw * 0.3, tilt: -0.03 })];
    case 'shoulderLeanDuo': return [F({ dx: -sw * 0.34 }), F({ dx: sw * 0.3, tilt: -0.16, headX: -10, dy: 0.02 })];
    case 'protectiveDuo': return [F({ dx: sw * 0.12, dy: 0.05, k: 0.94 }), F({ dx: -sw * 0.18, dy: -0.06, k: 1.02, arm: 0, over: true })];
    case 'ceremonialOffering': return [F({ dx: -sw * 0.32, props: ['ceremonialObject'], look: { x: 1, y: 1 } }), F({ dx: sw * 0.32, look: { x: -1, y: 1 }, tilt: -0.05 })];
    case 'oneBehindAnother': return n === 2 ? [F({ dx: -sw * 0.08, dy: 0.03 }), F({ dx: sw * 0.26, dy: -0.08, k: 0.86 })] : [F({ dx: -sw * 0.2, dy: 0.03 }), F({ dx: sw * 0.1, dy: -0.06, k: 0.9 }), F({ dx: sw * 0.38, dy: -0.12, k: 0.82 })];
    case 'dominantForeground': return [F({ dx: -sw * 0.2, dy: 0.08, k: 1.25 }), F({ dx: sw * 0.34, dy: -0.1, k: 0.7 })];
    case 'smallGroupCluster': return [F({ dy: 0.02 }), F({ dx: -sw * 0.42, dy: -0.05, k: 0.95, tilt: 0.05 }), F({ dx: sw * 0.42, dy: -0.05, k: 0.95, tilt: -0.05 })];
    case 'rowFrontal': return [F(), F({ dx: -sw * 0.75 }), F({ dx: sw * 0.75 })];
    default: return Array.from({ length: n }, (_, i) => F({ dx: n === 1 ? 0 : (i - (n - 1) / 2) * sw * 0.7 }));
  }
}

/** One figure's styling for a shot: the template's costume or the person's own (a metallic one by the phase's odds), makeup restrained or theatrical by the phase, marks, a prop, a hat, an expression. */
function stylingOf(s, idn, P, tpl, i) {
  const st = { costume: tpl.costumes?.[i] ?? tpl.costume ?? idn.home.costume, variant: rand(s) < 0.3 ? 1 : 0, expression: tpl.expression ?? pick(s, EXPRESSIONS), smile: (rand(s) - 0.5) * 0.3 };
  if (!tpl.costume && !tpl.costumes && rand(s) < P.gold) st.costume = pick(s, METALLIC);
  st.makeup = tpl.makeup ?? (rand(s) < P.paint ? [pick(s, PAINTS)] : rand(s) < P.makeup ? [pick(s, RESTRAINED)] : idn.home.makeup !== 'none' && rand(s) < 0.6 ? [idn.home.makeup] : []);
  const bare = st.costume === 'shirtlessTattooed' || st.costume === 'loudGoldRedFashion'; // body marks want skin: on a shirt only the neck and face ones
  st.marks = tpl.marks?.[i] ?? (rand(s) < P.marks ? [pick(s, bare ? MARKS : SKIN_MARKS)] : st.costume === 'shirtlessTattooed' ? [idn.home.marks] : []);
  st.props = tpl.prop || rand(s) < P.props ? [pick(s, PROPS)] : [];
  if (rand(s) < P.hats && !['goldHoodedMetallic', 'streetPuffer'].includes(st.costume)) st.hat = pick(s, HATS);
  return st;
}
/** The stylings a mutating shot cuts through: the same pose in other costumes, other hats or other face paint; figure 0 mutates, the others hold. */
function altsOf(s, base, P) {
  const kind = pick(s, ['costume', 'costume', 'hat', 'makeup']), out = [base];
  for (let k = 1; k < 4; k++) {
    const st = { ...base[0] };
    if (kind === 'costume') st.costume = pick(s, STRONG); else if (kind === 'hat') st.hat = ['none', 'baseballCap', 'beanie', 'bucketHat'][k]; else st.makeup = [[], ['paleCorpseBase'], ['geometricEyePaint'], ['whiteMaskBase']][k];
    if (st.hat === 'none') delete st.hat;
    out.push([st, ...base.slice(1)]);
  }
  return out;
}
/** The ids in a shot: a costume-bound template takes the person who owns that costume (the recurring gold hood, the blue performer), else the company with its leads weighted, and a duo reuses a pair it has made before more often than not. */
function idsOf(s, tpl, company) {
  const n = tpl.n, out = [];
  const owner = (fam) => { const c = company.find((id) => s.cast[id].home.costume === fam); if (c !== undefined) return c; const all = s.cast.findIndex((x) => x.home.costume === fam); return all >= 0 ? all : pick(s, company); };
  if (tpl.costume) out.push(owner(tpl.costume));
  if (tpl.costumes) for (const f of tpl.costumes) { const id = owner(f); if (!out.includes(id)) out.push(id); }
  if (n === 2 && !out.length && s.pairs.length && rand(s) < 0.6) { const pr = pick(s, s.pairs); out.push(...pr); }
  while (out.length < n) { const id = rand(s) < 0.45 ? pick(s, s.leads) : pick(s, company); if (!out.includes(id)) out.push(id); }
  if (n === 2 && !s.pairs.some((p) => p[0] === out[0] && p[1] === out[1])) { s.pairs.push([out[0], out[1]]); if (s.pairs.length > 6) s.pairs.shift(); }
  return out.slice(0, n);
}
function makeShot(s, name, set, at, len, company, P, phase, cascade) {
  const tpl = TEMPLATES[name], pose = tpl.n ? pick(s, tpl.poses) : 'none', fr = FRAMING[tpl.framing ?? 'close'], ids = tpl.n ? idsOf(s, tpl, company) : [];
  const base = ids.map((id, i) => stylingOf(s, s.cast[id], P, tpl, i)), mutate = !!tpl.n && !tpl.fx && rand(s) < P.mutate;
  const layout = layoutOf(pose, tpl.n, fr); if (tpl.fx === 'split') for (const l of layout) l.dx = 0;
  return {
    at, len, tpl: name, set, framing: tpl.framing ?? 'close', pose, phase, ids, layout,
    alts: mutate || cascade ? altsOf(s, base, P) : tpl.fx === 'grid' ? [base, [{ ...base[0], makeup: [pick(s, PAINTS.filter((m) => !base[0].makeup.includes(m)))] }]] : [base], mutate, cascade, beat: len / 4, // a grid's odd cell wears paint
    cam: { scale: 1 + (rand(s) < 0.2 ? 0.06 : 0), x: tpl.offset ? (rand(s) < 0.5 ? -0.3 : 0.3) : 0, y: 0, rot: rand(s) < 0.08 ? (rand(s) - 0.5) * 0.03 : 0, push: rand(s) < 0.3 ? 0.05 : 0 },
    fx: tpl.fx ?? null, grid: tpl.grid ?? 0, side: rand(s) < 0.5 ? -1 : 1, odd: Math.floor(rand(s) * (tpl.grid ?? 1) ** 2),
    band: tpl.band ? { color: pick(s, [WHITE, RED, GOLD]), dir: rand(s) < 0.5 ? 'h' : 'v', at: 0.15 + rand(s) * 0.65, size: 0.04 + rand(s) * 0.1 } : null,
    sculptures: tpl.sculptures ? [{ kind: pick(s, SCULPTURES), x: -0.64, size: 0.5 + rand(s) * 0.1 }, { kind: pick(s, SCULPTURES), x: 0.64, size: 0.5 + rand(s) * 0.1 }] : [],
    gap: !!tpl.gap, flash: !!tpl.flash, emote: !!tpl.n && pose !== 'statueStill' && rand(s) < P.emote, // the lead actor's face plays along with the music
  };
}
/** The people of a section: the two leads and a few more taken in turn from the whole cast, so everyone appears over the song. */
function companyOf(s) {
  const out = [...s.leads];
  for (let i = 0; i < 4; i++) { out.push(s.order[s.cursor % s.order.length]); s.cursor++; }
  return out;
}
/** A section's shots, back to back in bars: phrases of the phase's lengths and templates, no two punctuation shots in a row, the first section opening on a long still portrait of the first lead and the last closing on a long duo of the leads. */
export function planSection(s, sec, i, n, phase) {
  const P = PHASES[phase], bars = sec.bars, shots = [], company = companyOf(s); let b = 0, special = false;
  if (i === 0) { const len = Math.min(8, bars); const sh = makeShot(s, 'redCurtainSoloPortrait', 'red', 0, len, company, PHASES.opening, phase, false); sh.ids = [s.leads[0]]; sh.pose = 'statueStill'; sh.layout = layoutOf('statueStill', 1, FRAMING.medium); sh.alts = [[{ costume: s.cast[s.leads[0]].home.costume, variant: 0, expression: 'deadpan', makeup: [], marks: [], props: [] }]]; sh.mutate = false; shots.push(sh); b = len; }
  while (b < bars - 1e-6) {
    if (i === n - 1 && bars - b <= 8 + 1e-6) { const sh = makeShot(s, 'redCurtainDuo', 'red', b, bars - b, company, PHASES.release, 'release', false); sh.ids = [...s.leads]; sh.pose = 'pairFrontal'; sh.layout = layoutOf('pairFrontal', 2, FRAMING.medium); sh.mutate = false; sh.cam = { scale: 1, x: 0, y: 0, rot: 0, push: 0 }; shots.push(sh); break; }
    let name = wpick(s, P.tpls); if (special && SPECIAL.has(name)) name = s.altSet === 'red' ? 'redCurtainSoloPortrait' : 'whiteStudioSolo'; special = SPECIAL.has(name);
    const tpl = TEMPLATES[name]; let len = pick(s, P.lens); if (b + len > bars) len = bars - b; if (len < 0.25) break;
    if (tpl.flash) len = Math.min(len, 0.25); // a flash frame is one beat
    const set = tpl.set === 'any' ? (s.altSet = s.altSet === 'red' ? 'white' : 'red') : tpl.set;
    const cascade = tpl.n === 1 && !tpl.fx && len >= 1 && rand(s) < P.cascade;
    shots.push(makeShot(s, name, set, b, len, company, P, phase, cascade));
    b += len;
  }
  return shots;
}

/** A shot built by hand for a sheet (poses.html) or a test: a pose on a set with these people in these costumes and props, still, no effects unless asked. */
export function previewShot(s, { pose = 'directFrontal', n = 1, framing = 'medium', set = 'white', ids = null, costumes = [], props = [], expressions = [], fx = null, grid = 0, sculptures = [], band = null, flash = false, gap = false } = {}) {
  const fr = FRAMING[framing] ?? FRAMING.medium, layout = layoutOf(pose, n, fr); if (fx === 'split') for (const l of layout) l.dx = 0;
  const who = ids ?? [...s.leads, ...s.order.filter((i) => !s.leads.includes(i))].slice(0, n);
  return { at: 0, len: 4, tpl: 'preview', set, framing, pose, phase: 'opening', ids: who, layout, alts: [who.map((id, i) => ({ costume: costumes[i] ?? s.cast[id].home.costume, variant: 0, makeup: [], marks: [], props: props[i] ?? [], expression: expressions[i] ?? 'deadpan' }))], mutate: false, cascade: false, beat: 1, cam: { scale: 1, x: 0, y: 0, rot: 0, push: 0 }, fx, grid, side: 1, odd: 0, band, sculptures, gap, flash, emote: false };
}
const cut = (s, k) => { s.shotIx = k; s.variant = 0; s.punch = 1; s.lastCut = s.t; s.cuts++; const sh = shotOf(s); if (sh?.alts[0][0]) { s.exprTo = exprVals(sh.alts[0][0].expression); s.expr = { ...s.exprTo }; } }; // a cut lands on the shot's expression at once
const emote = (s, sh) => { if (!sh?.emote || s.t - s.lastEmote < 0.4) return; s.exprTo = exprVals(pick(s, EMOTES)); s.lastEmote = s.t; }; // the same actor moves to another expression
const shotOf = (s) => s.plan[s.section]?.[s.shotIx] ?? null;
const sleeveOf = (p) => (p.jacket.style !== 'none' ? p.jacket.color : p.top.style === 'bare' ? p.skin : p.top.color);

export default {
  name: 'tableau',

  init(score, rng, size) {
    const s = { size: { ...size }, slotOf: Object.fromEntries(Object.entries(score.cast ?? {}).map(([n, c]) => [n, c.slot])), cast: [], leads: [], order: [], cursor: 0, pairs: [], altSet: 'red', plan: [], phases: [], section: -1, shotIx: -1, variant: 0, cuts: 0, lastCut: -1, t: 0, prog: 0, energy: 0.5, punch: 1, riser: 0, dark: 0, flash: 0, expr: exprVals('deadpan'), exprTo: exprVals('deadpan'), pulse: 0, tune: 0, lastEmote: -1, lastBar: -1, blink: [0, 0, 0], lastBlink: [-BLINK_GAP, -BLINK_GAP, -BLINK_GAP], look: { x: 0, y: 0 }, lookTo: { x: 0, y: 0 }, folds: [] };
    seed(s, rng);
    s.cast = ARCHETYPE_NAMES.map((name, i) => identityOf(s, name, i));
    s.order = s.cast.map((_, i) => i); for (let i = s.order.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [s.order[i], s.order[j]] = [s.order[j], s.order[i]]; }
    s.leads = [s.order[0], s.order[1]]; s.cursor = 2;
    let x = -0.02; while (x < 1.02) { const w = 0.07 + rand(s) * 0.09; s.folds.push({ x, w, bright: rand(s) }); x += w * (0.85 + rand(s) * 0.3); }
    const sections = score.sections.length ? score.sections : [{ name: null, role: null, energy: 0.5, bars: 64 }];
    s.phases = sections.map((_, i) => phaseOf(sections, i, score.climax));
    s.plan = sections.map((sec, i) => planSection(s, sec, i, sections.length, s.phases[i]));
    s.section = 0; cut(s, 0); s.cuts = 0;
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    const ix = Math.max(0, Math.min(clock.index, s.plan.length - 1)), local = clock.bar + clock.barPhase;
    if (ix !== s.section) { s.section = ix; s.shotIx = -1; }
    const plan = s.plan[ix] ?? [], sh = plan[s.shotIx];
    if (!sh || local < sh.at || local >= sh.at + sh.len) { let k = plan.findIndex((x) => local >= x.at && local < x.at + x.len); if (k < 0) k = plan.length - 1; if (k !== s.shotIx) cut(s, k); }
    const shot = shotOf(s), P = PHASES[shot?.phase ?? 'opening'];
    s.prog = shot ? clamp((local - shot.at) / shot.len) : 0;
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.flash = decay(s.flash, 14, dt);
    for (let i = 0; i < 3; i++) s.blink[i] = decay(s.blink[i], 18, dt);
    for (const k of Object.keys(s.expr)) s.expr[k] = ease(s.expr[k], s.exprTo[k], 5, dt); // the expression animates over a third of a second
    s.pulse = decay(s.pulse, 8, dt); s.tune = ease(s.tune, 0, 0.5, dt);
    if (clock.bar !== s.lastBar) { if (s.lastBar >= 0 && rand(s) < 0.35) emote(s, shot); s.lastBar = clock.bar; }
    s.look.x = ease(s.look.x, s.lookTo.x, 6, dt); s.look.y = ease(s.look.y, s.lookTo.y, 6, dt); s.lookTo.x = ease(s.lookTo.x, 0, 0.4, dt); s.lookTo.y = ease(s.lookTo.y, 0, 0.4, dt);
    for (const e of events) {
      const slot = e.layer ? (s.slotOf?.[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain') : DEFAULT_SLOT[e.kind] ?? 'grain';
      if (slot === 'impulse') {
        if (e.role === 'impact') { if (shot?.mutate && s.t - s.lastCut > MIN_GAP && rand(s) < 0.6) { s.variant++; s.lastCut = s.t; s.cuts++; } else if (rand(s) < 0.5) emote(s, shot); }
        else if (e.role === 'grain') { const i = Math.floor(rand(s) * 3); if (s.t - s.lastBlink[i] > BLINK_GAP) { s.blink[i] = 1; s.lastBlink[i] = s.t; } }
        else { s.pulse = Math.max(s.pulse, clamp(e.gain * e.velocity)); if (rand(s) < P.punch) s.punch = 1.1; }
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const up = clamp((e.note - 48) / 36); s.lookTo = { x: (e.pan - 0.5) * 0.9, y: (0.5 - up) * 0.7 }; s.tune = up - 0.5; // a high note lifts the brows and the smile a little, a low one drops them
      } else if (slot === 'transition') { if (e.dur >= 1) s.flash = 1; }
      else if (slot === 'grain') { const i = Math.floor(rand(s) * 3); if (s.t - s.lastBlink[i] > BLINK_GAP) { s.blink[i] = 1; s.lastBlink[i] = s.t; } }
    }
  },

  draw(s, ctx, w, h) {
    const sh = shotOf(s);
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (!sh) { ctx.fillStyle = '#050405'; ctx.fillRect(0, 0, w, h); ctx.restore(); return; }
    const fr = FRAMING[sh.framing], lit = 1 - 0.75 * s.dark, floor = floorOf(fr);
    const cs = sh.cam.scale * (1 + sh.cam.push * s.prog) * (1 + 0.25 * s.riser) * s.punch;
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(cs, cs); ctx.rotate(sh.cam.rot); ctx.translate(-w / 2 - sh.cam.x * h, -h / 2 - sh.cam.y * h);
    if (sh.set === 'red') curtain(ctx, w, h, s.folds, { gap: sh.gap, lit, floor }); else if (sh.set === 'white') cyclorama(ctx, w, h, { lit, floor }); else voidSet(ctx, w, h, sh.band, lit);
    for (const sc of sh.sculptures) sculpture(ctx, sc.kind, w / 2 + sc.x * h, floor * h, sc.size * h);
    const still = sh.pose === 'statueStill', tv = sh.cascade ? Math.floor(s.prog * sh.len / sh.beat) : 0, alt = sh.alts[(tv + s.variant) % sh.alts.length];
    const figures = sh.ids.map((id, i) => {
      const lay = sh.layout[i], st = alt[i], breathe = still ? 0 : 1;
      const p = dress(s.cast[id], { ...st, props: [...st.props, ...lay.props], look: lay.look ?? s.look, pose: { headX: lay.headX + breathe * 1.2 * Math.sin(s.t * 0.37 + i * 2), headY: breathe * -1.4 * Math.sin(s.t * 1.1 + i), headTilt: lay.tilt + breathe * 0.008 * Math.sin(s.t * 0.29 + i * 3), bodyX: 0, bodyTilt: lay.bodyTilt } });
      if (!still) { // the face plays: the lead actor fully (an emoting shot animates between expressions), the others at a third
        const a = i === 0 ? 1 : 0.35, ex = s.expr, b = exprVals(st.expression);
        p.mouth.smile += a * (ex.smile - b.smile + 0.3 * s.tune); p.mouth.open = 0; // the mouth changes shape with the music, it never opens
        p.eyes.openness *= 1 + a * (ex.eyes - b.eyes + 0.1 * s.pulse); p.eyes.browLift += a * (ex.brow - b.brow + 4 * s.tune + 2.5 * s.pulse); p.eyes.browSkew += a * (ex.skew - b.skew);
      }
      p.eyes.openness = p.eyes.openness * (1 - (still ? 0 : s.blink[i])) * (1 - 0.9 * s.dark) + 0.02;
      const k = (h / fr.u) * lay.k;
      return { p, k, x: w / 2 + lay.dx * h, y: (fr.ey + lay.dy) * h, lay, sleeve: sleeveOf(p) };
    });
    const paint = (f, ops = portraitOps(f.p)) => { ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.k, f.k); ctx.translate(-200, -f.p.eyes.y); drawOn(ctx, ops, lit); ctx.restore(); };
    if (sh.fx === 'grid') { // the same person n × n, one cell in the next styling
      const n = sh.grid, f = figures[0], cw = w / n, ch = h / n;
      for (let c = 0; c < n * n; c++) {
        const st = c === sh.odd && sh.alts.length > 1 ? sh.alts[1][0] : alt[0], p = c === sh.odd ? dress(s.cast[sh.ids[0]], { ...st, look: s.look }) : f.p;
        ctx.save(); ctx.beginPath(); ctx.rect((c % n) * cw, Math.floor(c / n) * ch, cw, ch); ctx.clip();
        paint({ p, k: f.k / n, x: (c % n) * cw + cw / 2, y: Math.floor(c / n) * ch + ch * FRAMING.close.ey }); ctx.restore();
      }
    } else if (sh.fx === 'mirror') { // one half of the face, and that half again the other way
      const f = figures[0], cx = f.x, half = (side) => { ctx.save(); ctx.beginPath(); ctx.rect(side < 0 ? -w : cx, -h, w * 2, h * 3); ctx.clip(); paint(f); ctx.restore(); };
      half(sh.side); ctx.save(); ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); half(sh.side); ctx.restore();
    } else if (sh.fx === 'split' && figures.length > 1) { // left half one person, right half another
      const cx = figures[0].x; ctx.save(); ctx.beginPath(); ctx.rect(-w, -h, w + cx, h * 3); ctx.clip(); paint(figures[0]); ctx.restore(); ctx.save(); ctx.beginPath(); ctx.rect(cx, -h, w * 2, h * 3); ctx.clip(); paint(figures[1]); ctx.restore();
    } else {
      // an arm across to another figure, in two parts: the shoulder cap and upper arm go on right after their owner (so a figure in front hides them), the forearm and hand over everything.
      // Linked (`over` false): the elbow drops between the two and the hand rests on the other's near hip. Over the shoulders (`over` true): the upper arm passes behind the other's neck to an elbow on top of their far shoulder, and the forearm hangs down their chest from there.
      const crossArm = (f, part) => {
        const g = figures[f.lay.arm], dir = Math.sign(g.x - f.x) || 1, over = f.lay.over, sx = f.x + 86 * dir * f.k, sy = f.y + (392 - f.p.eyes.y) * f.k;
        const wx = over ? g.x + 50 * dir * g.k : g.x - 44 * dir * g.k, wy = over ? g.y + (448 - g.p.eyes.y) * g.k : g.y + (448 - g.p.eyes.y) * g.k;
        const ex = over ? g.x + 64 * dir * g.k : (sx + wx) / 2 + 10 * dir * f.k, ey = over ? g.y + (384 - g.p.eyes.y) * g.k : Math.max(sy, wy) + 44 * f.k;
        const hx = over ? wx - 2 * dir * g.k : wx - 12 * dir * g.k, hy = over ? wy + 18 * g.k : wy - 10 * g.k, fx = over ? hx - 4 * dir * f.k : hx - 10 * dir * f.k, fy = over ? hy + 14 * f.k : hy - 13 * f.k; // the hand, and where its fingers bunch
        ctx.globalAlpha = lit; ctx.fillStyle = f.sleeve; ctx.strokeStyle = f.sleeve; ctx.lineCap = 'round';
        if (part === 'back') { ctx.beginPath(); ctx.ellipse(sx, sy, 38 * f.k, 31 * f.k, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 64 * f.k; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); }
        else {
          ctx.lineWidth = 56 * f.k; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(wx, wy); ctx.stroke();
          ctx.fillStyle = f.p.props.includes('gloves') ? '#161517' : f.p.skin; ctx.beginPath(); ctx.ellipse(hx, hy, 19 * f.k, 21 * f.k, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(fx, fy, 15 * f.k, 15 * f.k, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      const armed = figures.filter((f) => f.lay.arm !== null && figures[f.lay.arm]);
      for (let i = figures.length - 1; i >= 0; i--) { // back to front
        const f = figures[i], feet = f.y + (FEET - f.p.eyes.y) * f.k;
        if (sh.set === 'white' && feet < h * 1.3) floorShadow(ctx, f.x + h * 0.03, feet - h * 0.005, 0.26 * h * f.lay.k * f.p.body.width, 0.16 * lit);
        if (sh.set === 'red') { const r = 0.5 * h * f.k * fr.u / 460, g = ctx.createRadialGradient(f.x, f.y + h * 0.12, 0, f.x, f.y + h * 0.12, r); g.addColorStop(0, `rgba(0 0 0 / ${0.32 * lit})`); g.addColorStop(1, 'rgba(0 0 0 / 0)'); ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y + h * 0.12 - r, 2 * r, 2 * r); } // the figure's shadow on the velvet behind it
        paint(f);
        if (armed.includes(f)) crossArm(f, 'back');
      }
      for (const f of armed) crossArm(f, 'front');
    }
    ctx.restore();
    if (sh.set === 'red') vignette(ctx, w, h, 0.5);
    if (sh.flash) { ctx.fillStyle = sh.band.color; ctx.globalAlpha = 0.9; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; ctx.fillStyle = '#050405'; if (sh.band.dir === 'h') ctx.fillRect(0, h * sh.band.at, w, h * sh.band.size * 2); else ctx.fillRect(w * sh.band.at, 0, h * sh.band.size * 2, h); }
    if (s.flash > 0.02) { ctx.fillStyle = '#050405'; ctx.globalAlpha = s.flash; ctx.fillRect(0, 0, w, h); ctx.fillStyle = WHITE; ctx.fillRect(0, h * 0.44, w, h * 0.12); ctx.globalAlpha = 1; }
    if (s.dark > 0.01) { ctx.fillStyle = `rgba(0 0 0 / ${0.45 * s.dark})`; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  },
};
