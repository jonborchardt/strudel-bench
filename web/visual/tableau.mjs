// tableau: the song as a fashion-editorial music video shot on three sets with a recurring cast of twenty-four
// procedural actors (cast.mjs over portrait.mjs): a red velvet curtain (theatrical, intimate, gold and black and
// pale skin), a white cyclorama (huge negative space, graphic silhouettes, statues behind the actors) and a black
// void used as punctuation. The cast is fixed at init from the archetypes, each person recognisable in every
// costume; a timeline of shots is composed per section at init from the section's phase (opening, development,
// escalation, peak, release: from its role and energy) with weighted shot templates and phrase lengths, so it reads
// as authored: long still portraits and duos first, then both sets and props and gold, then face paint, tattoos,
// (the cast dances the music with the body, not the face: a sway over two bars of the song's own clock, each figure
// a little behind the one before, a nod on the kick, while the brows and the smile only cross slowly between
// expressions; a statueStill shot holds everyone completely still.)
// groups and jump-cut costume cascades, then the peak's fast alternation with mirrored, split, gridded and black
// interruption frames, and a long clean portrait to release. Everything moves by editing: the actors breathe, blink,
// turn a degree, and no more. A snare jump-cuts the shot's mutation (the same pose in another costume, hat or face
// paint) when the shot allows it, a kick now and then punches the camera in, the melody moves the eyes a little, a
// hi-hat blinks one actor every few seconds, an fx impact is a graphic flash frame, a riser is a slow push-in, a
// dropout holds the shot dark with the eyes shut. Deterministic: randomness only from the state's own generator.
import { clamp, lerp, decay, ease, seed, rand, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY, feetY, stanceOf, STANCES, SPREAD_STANCES } from './limner.mjs';
import { identityOf, dress, exprVals, ARCHETYPE_NAMES, COSTUME_FAMILIES, METALLIC, wearable, WHITE, RED, GOLD } from './limner.mjs';
import { curtain, cyclorama, voidSet, floorShadow, vignette, sculpture, SCULPTURES } from './sets.mjs';
import { THEMES } from './themes.mjs';

// A theme is another cast and another set of poses on the same machinery: the sets, the timeline, the cuts, the
// dance and the sheet all stay. A song picks one with `visual: { world: 'tableau', theme: 'thriller' }` (validated
// in lib/song.mjs against lib/visual.json's `themes`, carried as `score.theme`); with none written nothing below
// changes. themes.mjs binds each theme from lib/visual.json: a cast (its people and expression pools), the part packs
// it wears and a dance (templates, phases, poses, opening and closing shots, motion dials and the styling rules its
// shots use, closed over the cast), into one object of the shape read below.
const themeOf = (s) => (s.theme && THEMES[s.theme]) || null;
const OPEN = { tpl: 'redCurtainSoloPortrait', set: 'red', pose: 'statueStill', framing: 'medium', expression: 'deadpan' }, CLOSE = { tpl: 'redCurtainDuo', set: 'red', pose: 'pairFrontal', framing: 'medium' }; // the first and last shots of the song
const MOTION = { sway: 1, tilt: 1, nod: 1, jaw: 0 }; // the dance's amplitudes (a theme scales them: a zombie lurches further and its jaw drops on the kick)

const MIN_GAP = 0.15; // seconds between two cuts a hit may cause
const BLINK_GAP = 3; // seconds between one actor's blinks
// How the cast plays the music. It is in the body, not the face: DANCE scales the whole sway and bob (0 holds
// everyone still), EXPR_EASE is how slowly one expression crosses to the next (a change of mood over about a
// second, never a twitch), MUSIC_FACE how much of a note or a kick reaches the brows and the smile at all, and
// BROW_PLAY how far the brows move even then. Turn MUSIC_FACE and BROW_PLAY up for a face that mugs.
const DANCE = 1, EXPR_EASE = 1.4, MUSIC_FACE = 0.25, BROW_PLAY = 0.5;
const EMOTE_GAP = 1.5; // seconds between two changes of expression: an actor holds a face, they do not run through them
// framings: sheet units per canvas height and where the eye line sits (a fraction of the height)
export const FRAMING = { eyes: { u: 90, ey: 0.5 }, extreme: { u: 170, ey: 0.46 }, close: { u: 330, ey: 0.42 }, medium: { u: 460, ey: 0.36 }, full: { u: 640, ey: 0.3 }, wide: { u: 900, ey: 0.3 }, figure: { u: 1300, ey: 0.17 } }; // figure: the whole standing body, feet on the floor
const FEET = 1078; // the figure's shoes meet the floor here (portrait's FEET_Y)
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
  blackSuitPortrait: { set: 'red', n: 1, framing: 'medium', costume: 'severeBlackSuit', makeup: ['severeContour'], poses: ['directFrontal', 'statueStill'] },
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
};
const SPECIAL = new Set(['mirroredFace', 'splitFace', 'duplicateGrid', 'repeatedCharacterGrid', 'blackVoidPortrait', 'eyesCrop', 'extremeFaceCrop']); // punctuation: never two in a row. Every template holds somebody: a frame of the cast is the point, so there is no empty graphic frame to cut to (one was removed on 2026-09-26)

// the phases: shot lengths in bars, the odds of a cascade phrase (one pose cut through four stylings at a beat each), of a shot mutating on snares, of restrained makeup, theatrical paint, a gold costume, a prop, body marks, a hat; and the template weights
export const PHASES = {
  opening: { lens: [4, 8, 4, 2], cascade: 0, mutate: 0.05, makeup: 0.15, paint: 0, gold: 0.08, props: 0.05, marks: 0.05, hats: 0.1, punch: 0.01, emote: 0.3, tpls: { redCurtainSoloPortrait: 5, redCurtainDuo: 3, blackSuitPortrait: 2, directStare: 1, redCurtainWideTableau: 1, whiteStudioSolo: 1 } },
  development: { lens: [2, 4, 2, 4, 1], cascade: 0.08, mutate: 0.2, makeup: 0.35, paint: 0.1, gold: 0.25, props: 0.35, marks: 0.15, hats: 0.2, punch: 0.02, emote: 0.5, tpls: { redCurtainSoloPortrait: 2, redCurtainDuo: 2, whiteStudioSolo: 3, whiteStudioDuo: 2, whiteStudioWideNegativeSpace: 2, propPortrait: 2, whiteStudioSculptureTableau: 1, goldHoodCloseup: 1, graphicHoodiePortrait: 1, redCurtainGroup: 1, directStare: 1 } },
  escalation: { lens: [1, 2, 1, 2, 4], cascade: 0.25, mutate: 0.5, makeup: 0.6, paint: 0.35, gold: 0.45, props: 0.4, marks: 0.4, hats: 0.25, punch: 0.04, emote: 0.6, tpls: { tattooedGoldFashionDuo: 2, bluePerformerPortrait: 2, whiteStudioGroup: 2, redCurtainGroup: 2, goldHoodCloseup: 2, extremeFaceCrop: 1, ceremonialExchange: 1, whiteCeremonialPair: 1, handGestureShot: 1, redCurtainDuo: 1, whiteStudioDuo: 1, propPortrait: 1 } },
  peak: { lens: [0.5, 1, 1, 2, 0.5], cascade: 0.3, mutate: 0.7, makeup: 0.8, paint: 0.55, gold: 0.55, props: 0.35, marks: 0.5, hats: 0.2, punch: 0.08, emote: 0.7, tpls: { redCurtainDuo: 2, whiteStudioDuo: 2, goldHoodCloseup: 2, tattooedGoldFashionDuo: 2, redCurtainGroup: 1, whiteStudioGroup: 1, blackVoidPortrait: 2, mirroredFace: 1, splitFace: 1, duplicateGrid: 1, repeatedCharacterGrid: 1, eyesCrop: 1, extremeFaceCrop: 1, bluePerformerPortrait: 1, directStare: 1 } },
  release: { lens: [8, 16, 8], cascade: 0, mutate: 0, makeup: 0.2, paint: 0, gold: 0.15, props: 0.1, marks: 0.1, hats: 0.05, punch: 0, emote: 0.4, tpls: { whiteStudioSolo: 3, redCurtainDuo: 3, blackSuitPortrait: 2, whiteStudioWideNegativeSpace: 1, redCurtainSoloPortrait: 2 } },
};
const RESTRAINED = ['darkEyeSockets', 'heavyUnderEye', 'sharpEditorialEyes', 'severeContour', 'blackLipLine', 'metallicEyeAccent', 'foreheadMark', 'cheekMark'];
const PAINTS = ['geometricEyePaint', 'asymmetricGraphicPaint']; // paint on a face that still acts
const MASKS = ['whiteMaskBase', 'clownGraphic', 'smearedClown'], MASK_SHARE = 0.15, HOME_MASK = 0.3; // a rigid shell over the face, which stops acting: a mask is punctuation, so only MASK_SHARE of the paint that goes on is one, and the two who wear one as their own face put it on HOME_MASK of the time (a lead holds most of a song's screen time, so a masked lead would make the whole song a mask)
const MARKS = ['chestSparse', 'chestDense', 'neckMarks', 'faceMarkSmall', 'abstractLineWork', 'redGraphicLines', 'scriptLikeMarks', 'ceremonialSymbols', 'geometricBodyMarks'];
const PROPS = ['flamingFlower', 'sunglassesInHand', 'gloves', 'ceremonialObject', 'abstractGoldObject', 'abstractToyLikeProp', 'flower'];
const SKIN_MARKS = ['neckMarks', 'faceMarkSmall'];
const HATS = ['baseballCap', 'beanie', 'bucketHat', 'cuffedBeanie', 'snapback', 'flatCap'];
const STRONG = COSTUME_FAMILIES.filter((c) => !c.startsWith('plain'));
const EXPRESSIONS = ['deadpan', 'deadpan', 'deadpan', 'stare', 'slightSmile', 'sneer', 'halfSmile', 'smirk', 'pout', 'squint', 'grin', 'wideEyed'];
const EMOTES = ['deadpan', 'deadpan', 'stare', 'slightSmile', 'halfSmile', 'smirk', 'pout', 'squint']; // what an emoting actor moves to, and mostly back to rest: the smile changes, slowly; the loud ones (a grin, wide eyes, a sneer) are a shot's own expression, not something the face does on a snare

const pick = (s, a) => a[Math.floor(rand(s) * a.length)];
// A cast's list-valued home makeup or marks is its face (pointed ears, the beads down a braid, a zombie's rot), not a styling: it is in every shot and every mutation, under whatever the phase adds. A string home makeup is the editorial kind, worn by the phase's odds.
const own = (v) => (Array.isArray(v) ? v.filter((x) => x && x !== 'none') : []), ownFace = (idn) => own(idn.home.makeup), ownGrave = (idn) => own(idn.home.marks);
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

/** Where each figure stands for a pose: dx (canvas heights from the centre), dy (from the eye line), k (scale), the head's tilt and lean, `turn` (the head off the torso), `shoulder` (one dropped), `headY` (craned forward or tilted back), props the pose adds, a look, `arm` (the index of the figure this one puts an arm on) and `over` (that arm goes over their shoulders, not linked at the hip). Index 0 is nearest the camera. Nothing here is a passport photo: every pose leans, turns or drops a shoulder. */
export function layoutOf(pose, n, fr, theme = null) {
  const sw = 400 / fr.u, F = (o = {}) => ({ dx: 0, dy: 0, k: 1, tilt: 0, bodyTilt: 0, headX: 0, headY: 0, turn: 0, shoulder: 0, props: [], look: null, arm: null, over: false, ...o });
  const tp = theme?.poses?.[pose]; if (tp) { const list = tp(n, sw); return (list.length >= n ? list : Array.from({ length: n }, (_, i) => ({ dx: n === 1 ? 0 : (i - (n - 1) / 2) * sw * 0.7, ...list[0] }))).map((o) => F(o)); } // a theme's own pose: the same fields, written as partials; a single-figure one stands every figure the same way (a split face is two)
  // One body's stance is limner's; where the bodies go is this function's. Two kinds spread across every figure asked
  // for: a theme's own stances (a themed pose always did, through the branch above, so a split shot of two gets two)
  // and the three editorial ones that were the `stance` table. The other five editorial stances place exactly one
  // figure however many were asked for, which is what they did before and what the layout golden pins.
  const stance = stanceOf(pose, theme?.stances);
  const themed = !!(theme?.stances && STANCES[theme.stances]?.[pose]);
  if (stance && !themed && !SPREAD_STANCES.includes(pose)) return [F(stance)];
  if (stance) return Array.from({ length: n }, (_, i) => F({ dx: n === 1 ? 0 : (i - (n - 1) / 2) * sw * 0.7, ...stance }));
  switch (pose) {
    case 'pairFrontal': return [F({ dx: -sw * 0.36, turn: 0.35, tilt: 0.05, shoulder: -0.3 }), F({ dx: sw * 0.36, turn: -0.35, tilt: -0.05, shoulder: 0.3 })];
    case 'linkedArmDuo': return [F({ dx: -sw * 0.3, tilt: 0.06, arm: 1, turn: 0.4, shoulder: 0.4 }), F({ dx: sw * 0.3, tilt: -0.06, turn: -0.3, shoulder: -0.4 })];
    case 'shoulderLeanDuo': return [F({ dx: -sw * 0.34, turn: 0.3, shoulder: -0.4 }), F({ dx: sw * 0.3, tilt: -0.22, headX: -14, dy: 0.02, turn: -0.5, shoulder: 0.6 })];
    case 'protectiveDuo': return [F({ dx: sw * 0.12, dy: 0.05, k: 0.94, turn: -0.3, headY: 6 }), F({ dx: -sw * 0.18, dy: -0.06, k: 1.02, arm: 0, over: true, turn: 0.4, tilt: 0.06, shoulder: -0.5 })];
    case 'ceremonialOffering': return [F({ dx: -sw * 0.32, props: ['ceremonialObject'], look: { x: 1, y: 1 }, turn: 0.5, headY: 10, tilt: 0.05 }), F({ dx: sw * 0.32, look: { x: -1, y: 1 }, tilt: -0.1, turn: -0.5, headY: 6 })];
    case 'oneBehindAnother': return n === 2 ? [F({ dx: -sw * 0.08, dy: 0.03, turn: 0.5, shoulder: 0.5 }), F({ dx: sw * 0.26, dy: -0.08, k: 0.86, turn: -0.4 })] : [F({ dx: -sw * 0.2, dy: 0.03, turn: 0.5, shoulder: 0.5 }), F({ dx: sw * 0.1, dy: -0.06, k: 0.9, turn: -0.2 }), F({ dx: sw * 0.38, dy: -0.12, k: 0.82, turn: -0.5 })];
    case 'dominantForeground': return [F({ dx: -sw * 0.2, dy: 0.08, k: 1.25, turn: 0.6, tilt: 0.08, shoulder: 0.6 }), F({ dx: sw * 0.34, dy: -0.1, k: 0.7, turn: -0.3 })];
    case 'smallGroupCluster': return [F({ dy: 0.02, turn: 0.2, shoulder: 0.3 }), F({ dx: -sw * 0.42, dy: -0.05, k: 0.95, tilt: 0.1, turn: 0.5, bodyTilt: 0.05 }), F({ dx: sw * 0.42, dy: -0.05, k: 0.95, tilt: -0.1, turn: -0.5, bodyTilt: -0.05 })];
    case 'rowFrontal': return [F({ turn: 0.15 }), F({ dx: -sw * 0.75, turn: 0.5, tilt: 0.06, shoulder: 0.4 }), F({ dx: sw * 0.75, turn: -0.5, tilt: -0.06, shoulder: -0.4 })];
    default: return Array.from({ length: n }, (_, i) => F({ dx: n === 1 ? 0 : (i - (n - 1) / 2) * sw * 0.7, ...(stance ?? {}) }));
  }
}

/** A split face is one face made of two: both halves stand in exactly the same pose, centred, or the seam reads as two photographs cut together. The layout is levelled here; `dress` is told to drop each person's own stance (`stance: false`) and the world holds them to one phase of the dance. */
const sameStance = (layout, fx) => { if (fx !== 'split') return; const one = { ...layout[0], dx: 0 }; for (const l of layout) Object.assign(l, one); };
/** One figure's styling for a shot: the template's costume or the person's own (a metallic one by the phase's odds), makeup restrained or theatrical by the phase, marks, a prop, a hat, an expression. */
function stylingOf(s, idn, P, tpl, i) {
  const T = themeOf(s); if (T?.styling) return T.styling(s, idn, P, tpl, i); // a theme with a dance of its own dresses its own cast (a zombie keeps its outfit and its rot); one on the editorial dance is styled below
  const st = { costume: tpl.costumes?.[i] ?? tpl.costume ?? idn.home.costume, variant: rand(s) < 0.3 ? 1 : 0, expression: tpl.expression ?? pick(s, EXPRESSIONS), smile: (rand(s) - 0.5) * 0.3 };
  if (!tpl.costume && !tpl.costumes && rand(s) < P.gold) st.costume = pick(s, METALLIC.filter((c) => wearable(idn, c))); // no hood on a wide face
  const face = ownFace(idn), grave = ownGrave(idn);
  st.makeup = [...face, ...(tpl.makeup ?? (rand(s) < P.paint ? [rand(s) < MASK_SHARE ? pick(s, MASKS) : pick(s, PAINTS)] : rand(s) < P.makeup ? [pick(s, RESTRAINED)] : !face.length && idn.home.makeup !== 'none' && rand(s) < (MASKS.includes(idn.home.makeup) ? HOME_MASK : 0.6) ? [idn.home.makeup] : []))];
  const bare = st.costume === 'shirtlessTattooed' || st.costume === 'loudGoldRedFashion'; // body marks want skin: on a shirt only the neck and face ones
  st.marks = [...grave, ...(tpl.marks?.[i] ?? (rand(s) < P.marks ? [pick(s, bare ? MARKS : SKIN_MARKS)] : st.costume === 'shirtlessTattooed' && !grave.length ? [idn.home.marks] : []))];
  st.props = tpl.prop || rand(s) < P.props ? [pick(s, PROPS)] : [];
  if (rand(s) < P.hats && !['goldHoodedMetallic', 'streetPuffer'].includes(st.costume)) st.hat = pick(s, HATS);
  return st;
}
/** The stylings a mutating shot cuts through: the same pose in other costumes, other hats or other face paint; figure 0 mutates, the others hold. */
function altsOf(s, base, P, idn) {
  const T = themeOf(s); if (T?.alts) return T.alts(s, base, P, idn);
  const kind = pick(s, ['costume', 'costume', 'hat', 'makeup']), out = [base], fits = STRONG.filter((c) => wearable(idn, c));
  for (let k = 1; k < 4; k++) {
    const st = { ...base[0] };
    if (kind === 'costume') st.costume = pick(s, fits); else if (kind === 'hat') st.hat = ['none', 'baseballCap', 'beanie', 'bucketHat'][k]; else st.makeup = [...ownFace(idn), ...[[], ['severeContour'], ['geometricEyePaint'], ['asymmetricGraphicPaint']][k]];
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
function makeShot(s, name, set, at, len, company, P, phase, cascade, only = null) {
  const T = themeOf(s), tpl = (T?.templates ?? TEMPLATES)[name], pose = tpl.n ? pick(s, tpl.poses) : 'none', fr = FRAMING[tpl.framing ?? 'close'], ids = only ?? (tpl.n ? idsOf(s, tpl, company) : []); // `only`: the people this shot holds, when the shot names them (the song's closing duo is the leads). They are chosen before their stylings, or each would wear the face of whoever idsOf picked instead
  const base = ids.map((id, i) => stylingOf(s, s.cast[id], P, tpl, i)), mutate = !!tpl.n && !tpl.fx && rand(s) < P.mutate;
  const layout = layoutOf(pose, tpl.n, fr, T); sameStance(layout, tpl.fx);
  return {
    at, len, tpl: name, set, framing: tpl.framing ?? 'close', pose, phase, ids, layout,
    alts: mutate || cascade ? altsOf(s, base, P, s.cast[ids[0]]) : tpl.fx === 'grid' ? [base, [T?.odd ? T.odd(s, base[0]) : { ...base[0], makeup: [...ownFace(s.cast[ids[0]]), pick(s, PAINTS.filter((m) => !base[0].makeup.includes(m)))] }]] : [base], mutate, cascade, beat: len / 4, // a grid's odd cell wears paint (a theme says what its odd one does)
    cam: { scale: 1 + (rand(s) < 0.2 ? 0.06 : 0), x: tpl.offset ? (rand(s) < 0.5 ? -0.3 : 0.3) : 0, y: 0, rot: rand(s) < 0.08 ? (rand(s) - 0.5) * 0.03 : 0, push: rand(s) < 0.3 ? 0.05 : 0 },
    fx: tpl.fx ?? null, grid: tpl.grid ?? 0, side: rand(s) < 0.5 ? -1 : 1, odd: Math.floor(rand(s) * (tpl.grid ?? 1) ** 2),
    band: tpl.band ? { color: pick(s, [WHITE, RED, GOLD]), dir: rand(s) < 0.5 ? 'h' : 'v', at: 0.15 + rand(s) * 0.65, size: 0.04 + rand(s) * 0.1 } : null,
    sculptures: tpl.sculptures ? [{ kind: pick(s, SCULPTURES), x: -0.64, size: 0.5 + rand(s) * 0.1 }, { kind: pick(s, SCULPTURES), x: 0.64, size: 0.5 + rand(s) * 0.1 }] : [],
    gap: !!tpl.gap, emote: !!tpl.n && pose !== (T?.still ?? 'statueStill') && rand(s) < P.emote, // the lead actor's face plays along with the music
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
  const T = themeOf(s), PH = T?.phases ?? PHASES, TP = T?.templates ?? TEMPLATES, SP = T?.special ?? SPECIAL, O = T?.open ?? OPEN, C = T?.close ?? CLOSE, FB = T?.fallback ?? { red: 'redCurtainSoloPortrait', white: 'whiteStudioSolo' };
  const P = PH[phase], bars = sec.bars, shots = [], company = companyOf(s); let b = 0, special = false;
  const closing = i === n - 1 ? Math.min(8, bars) : 0; // the song ends on a long duo of the leads: its bars are set aside here, so a long shot cannot eat them
  if (i === 0) { const len = Math.min(8, bars); const sh = makeShot(s, O.tpl, O.set, 0, len, company, PH.opening, phase, false); sh.ids = [s.leads[0]]; sh.pose = O.pose; sh.framing = O.framing; sh.layout = layoutOf(O.pose, 1, FRAMING[O.framing], T); sh.alts = [[T?.styling ? T.styling(s, s.cast[s.leads[0]], PH.opening, { expression: O.expression }, 0) : { costume: s.cast[s.leads[0]].home.costume, variant: 0, expression: O.expression, makeup: ownFace(s.cast[s.leads[0]]), marks: ownGrave(s.cast[s.leads[0]]), props: [] }]]; sh.mutate = false; shots.push(sh); b = len; }
  while (b < bars - closing - 1e-6) {
    let name = wpick(s, P.tpls); if (special && SP.has(name)) name = FB[s.altSet === 'red' ? 'red' : 'white']; special = SP.has(name);
    const tpl = TP[name]; let len = pick(s, P.lens); if (b + len > bars - closing) len = bars - closing - b; if (len < 0.25) break;
    const set = tpl.set === 'any' ? (s.altSet = s.altSet === 'red' ? 'white' : 'red') : tpl.set;
    const cascade = tpl.n === 1 && !tpl.fx && len >= 1 && rand(s) < P.cascade;
    shots.push(makeShot(s, name, set, b, len, company, P, phase, cascade));
    b += len;
  }
  if (closing && b < bars - 1e-6) { const sh = makeShot(s, C.tpl, C.set, b, bars - b, company, PH.release, 'release', false, [...s.leads]); sh.pose = C.pose; sh.framing = C.framing; sh.layout = layoutOf(C.pose, 2, FRAMING[C.framing], T); sh.mutate = false; sh.cam = { scale: 1, x: 0, y: 0, rot: 0, push: 0 }; shots.push(sh); }
  return shots;
}

/** A shot built by hand for a sheet (limner.html#poses) or a test: a pose on a set with these people in these costumes and props, still, no effects unless asked. */
export function previewShot(s, { pose = 'directFrontal', n = 1, framing = 'medium', set = 'white', ids = null, costumes = [], props = [], expressions = [], fx = null, grid = 0, sculptures = [], band = null, gap = false } = {}) {
  const T = themeOf(s), fr = FRAMING[framing] ?? FRAMING.medium, layout = layoutOf(pose, n, fr, T); sameStance(layout, fx);
  const who = ids ?? [...s.leads, ...s.order.filter((i) => !s.leads.includes(i))].slice(0, n);
  return { at: 0, len: 4, tpl: 'preview', set, framing, pose, phase: 'opening', ids: who, layout, alts: [who.map((id, i) => ({ costume: costumes[i] ?? s.cast[id].home.costume, variant: 0, ...(T ? {} : { makeup: [], marks: [] }), props: props[i] ?? [], expression: expressions[i] ?? T?.expressions?.[0] ?? 'deadpan' }))], mutate: false, cascade: false, beat: 1, cam: { scale: 1, x: 0, y: 0, rot: 0, push: 0 }, fx, grid, side: 1, odd: 0, band, sculptures, gap, emote: false }; // a themed sheet keeps the cast's own paint (a zombie's rot is its face), a plain one shows the pose on a clean face
}
const cut = (s, k) => { s.shotIx = k; s.variant = 0; s.punch = 1; s.lastCut = s.t; s.cuts++; const sh = shotOf(s); if (sh?.alts[0][0]) { s.exprTo = exprVals(sh.alts[0][0].expression); s.expr = { ...s.exprTo }; } }; // a cut lands on the shot's expression at once
const emote = (s, sh) => { if (!sh?.emote || s.t - s.lastEmote < EMOTE_GAP) return; s.exprTo = exprVals(pick(s, themeOf(s)?.emotes ?? EMOTES)); s.lastEmote = s.t; }; // the same actor moves to another expression
const shotOf = (s) => s.plan[s.section]?.[s.shotIx] ?? null;
const sleeveOf = (p) => (p.jacket.style !== 'none' ? p.jacket.color : p.top.style === 'bare' ? p.skin : p.top.color);

export default {
  name: 'tableau',

  init(score, rng, size) {
    const s = { size: { ...size }, slotOf: Object.fromEntries(Object.entries(score.cast ?? {}).map(([n, c]) => [n, c.slot])), cast: [], leads: [], order: [], cursor: 0, pairs: [], altSet: 'red', plan: [], phases: [], section: -1, shotIx: -1, variant: 0, cuts: 0, lastCut: -1, t: 0, prog: 0, energy: 0.5, punch: 1, riser: 0, dark: 0, flash: 0, expr: exprVals('deadpan'), exprTo: exprVals('deadpan'), pulse: 0, tune: 0, bob: 0, sway: 0, swayPhase: 0, swayAmp: 0.3, lastEmote: -1, lastBar: -1, blink: [0, 0, 0], lastBlink: [-BLINK_GAP, -BLINK_GAP, -BLINK_GAP], look: { x: 0, y: 0 }, lookTo: { x: 0, y: 0 }, folds: [] };
    seed(s, rng);
    s.theme = score.theme && THEMES[score.theme] ? score.theme : null; // the song's theme (plain data; themeOf resolves it): another cast and other poses, else the editorial one
    const T = themeOf(s); s.cast = (T?.cast ?? ARCHETYPE_NAMES).map((name, i) => (T?.identity ?? identityOf)(s, name, i)); // the theme's cast through its own generator (its families, palettes, pools and build), else the editorial twenty-four
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
    for (const k of Object.keys(s.expr)) s.expr[k] = ease(s.expr[k], s.exprTo[k], EXPR_EASE, dt); // the expression crosses slowly: a mood arriving, not a face pulled
    s.pulse = decay(s.pulse, 8, dt); s.tune = ease(s.tune, 0, 0.5, dt); s.bob = decay(s.bob, 7, dt);
    s.swayPhase = ((clock.bar % 2) + clock.barPhase) * Math.PI; // one sway over two bars, from the song's own clock, so every figure moves in time and an offline render agrees
    s.swayAmp = ease(s.swayAmp, lerp(0.15, 1, s.energy) * (1 - 0.9 * s.dark), 1, dt); s.sway = Math.sin(s.swayPhase) * s.swayAmp; // a quiet section barely moves, a loud one rides the bar
    if (clock.bar !== s.lastBar) { if (s.lastBar >= 0 && rand(s) < 0.12) emote(s, shot); s.lastBar = clock.bar; }
    s.look.x = ease(s.look.x, s.lookTo.x, 6, dt); s.look.y = ease(s.look.y, s.lookTo.y, 6, dt); s.lookTo.x = ease(s.lookTo.x, 0, 0.4, dt); s.lookTo.y = ease(s.lookTo.y, 0, 0.4, dt);
    for (const e of events) {
      const slot = e.layer ? (s.slotOf?.[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain') : DEFAULT_SLOT[e.kind] ?? 'grain';
      if (slot === 'impulse') {
        if (e.role === 'impact') { if (shot?.mutate && s.t - s.lastCut > MIN_GAP && rand(s) < 0.6) { s.variant++; s.lastCut = s.t; s.cuts++; } else if (rand(s) < 0.25) emote(s, shot); }
        else if (e.role === 'grain') { const i = Math.floor(rand(s) * 3); if (s.t - s.lastBlink[i] > BLINK_GAP) { s.blink[i] = 1; s.lastBlink[i] = s.t; } }
        else { s.pulse = Math.max(s.pulse, clamp(e.gain * e.velocity)); s.bob = Math.max(s.bob, clamp(e.gain * e.velocity)); if (rand(s) < P.punch) s.punch = 1.1; } // the kick is a nod, not a face
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
    const T = themeOf(s), M = T?.motion ?? MOTION, still = sh.pose === (T?.still ?? 'statueStill'), tv = sh.cascade ? Math.floor(s.prog * sh.len / sh.beat) : 0, alt = sh.alts[(tv + s.variant) % sh.alts.length];
    const figures = sh.ids.map((id, i) => {
      const lay = sh.layout[i], st = alt[i], breathe = still ? 0 : 1, dance = still ? 0 : DANCE, fi = sh.fx === 'split' ? 0 : i; // a split face's two halves move as one figure, not two
      const sw = Math.sin(s.swayPhase - fi * 0.6) * s.swayAmp, bob = s.bob * (fi === 0 ? 1 : 0.6); // each figure a little behind the one before: a company on the beat, not a chorus line
      const p = dress(s.cast[id], { ...st, ...(sh.fx === 'split' ? { stance: false } : {}), props: [...st.props, ...lay.props], look: lay.look ?? s.look, pose: { headX: lay.headX + breathe * 1.2 * Math.sin(s.t * 0.37 + fi * 2) + dance * 6 * sw * M.sway, headY: lay.headY + breathe * -1.4 * Math.sin(s.t * 1.1 + fi) - dance * 5 * bob * M.nod, headTilt: lay.tilt + breathe * 0.008 * Math.sin(s.t * 0.29 + fi * 3) + dance * 0.05 * sw * M.tilt, bodyX: 0, bodyTilt: lay.bodyTilt - dance * 0.02 * sw * M.sway, turn: lay.turn + dance * 0.2 * sw * M.sway, shoulder: lay.shoulder + dance * 0.25 * sw * M.sway } }); // the dance: the head rides the bar across and turns with it, the shoulders counter it, the kick nods (a theme scales how far)
      if (!still) { // the face plays, but barely: the music is in the body, the face only crosses slowly between expressions (the lead fully, the others at a third)
        const a = fi === 0 ? 1 : 0.35, ex = s.expr, b = exprVals(st.expression);
        p.mouth.smile += a * (ex.smile - b.smile + 0.3 * MUSIC_FACE * s.tune); p.mouth.open = M.jaw ? clamp(p.mouth.open + a * (ex.open - b.open) + M.jaw * s.pulse) : 0; // the smile arrives with the expression; a high note lifts it a hair and never opens it (a theme with a jaw dial lets the expression hold the mouth open and the kick drop it further)
        p.eyes.openness *= 1 + a * (ex.eyes - b.eyes + 0.1 * MUSIC_FACE * s.pulse); p.eyes.browLift += a * BROW_PLAY * (ex.brow - b.brow + (4 * s.tune + 2.5 * s.pulse) * MUSIC_FACE); p.eyes.browSkew += a * BROW_PLAY * (ex.skew - b.skew);
      }
      p.eyes.openness = p.eyes.openness * (1 - (still ? 0 : s.blink[i])) * (1 - 0.9 * s.dark) + 0.02;
      const k = (h / fr.u) * lay.k, stand = floor < 1.05 ? (FEET - feetY(p)) * k : 0; // where the floor is in shot a figure stands on it: a short build's eyes sit lower in the frame, not its feet in the air
      return { p, k, x: w / 2 + lay.dx * h, y: (fr.ey + lay.dy) * h + stand, lay, sleeve: sleeveOf(p) };
    });
    const paint = (f, ops = portraitOps(f.p)) => { ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.k, f.k); ctx.translate(-200, -eyeY(f.p)); drawOn(ctx, ops, lit); ctx.restore(); };
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
        const g = figures[f.lay.arm], dir = Math.sign(g.x - f.x) || 1, over = f.lay.over, fe = eyeY(f.p), ge = eyeY(g.p), sx = f.x + 86 * dir * f.k, sy = f.y + (392 - fe) * f.k;
        const wx = over ? g.x + 50 * dir * g.k : g.x - 44 * dir * g.k, wy = over ? g.y + (448 - ge) * g.k : g.y + (448 - ge) * g.k;
        const ex = over ? g.x + 64 * dir * g.k : (sx + wx) / 2 + 10 * dir * f.k, ey = over ? g.y + (384 - ge) * g.k : Math.max(sy, wy) + 44 * f.k;
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
        const f = figures[i], feet = f.y + (feetY(f.p) - eyeY(f.p)) * f.k; // this figure's own feet: a short build stands shorter
        if (sh.set === 'white' && feet < h * 1.3) floorShadow(ctx, f.x + h * 0.03, feet - h * 0.005, 0.26 * h * f.lay.k * f.p.body.width, 0.16 * lit);
        if (sh.set === 'red') { const r = 0.5 * h * f.k * fr.u / 460, g = ctx.createRadialGradient(f.x, f.y + h * 0.12, 0, f.x, f.y + h * 0.12, r); g.addColorStop(0, `rgba(0 0 0 / ${0.32 * lit})`); g.addColorStop(1, 'rgba(0 0 0 / 0)'); ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y + h * 0.12 - r, 2 * r, 2 * r); } // the figure's shadow on the velvet behind it
        paint(f);
        if (armed.includes(f)) crossArm(f, 'back');
      }
      for (const f of armed) crossArm(f, 'front');
    }
    ctx.restore();
    if (sh.set === 'red') vignette(ctx, w, h, 0.5);
    if (s.flash > 0.02) { ctx.fillStyle = '#050405'; ctx.globalAlpha = 0.5 * s.flash; ctx.fillRect(0, 0, w, h); ctx.fillStyle = WHITE; ctx.fillRect(0, h * 0.44, w, h * 0.12); ctx.globalAlpha = 1; } // an impact darkens the frame and lays a bar over it, never to black: the cast stays in shot
    if (s.dark > 0.01) { ctx.fillStyle = `rgba(0 0 0 / ${0.45 * s.dark})`; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  },
};
