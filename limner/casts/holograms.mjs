// The holograms cast: five people projected in light, built as a human is (the `human` row). Most of what makes
// a hologram is the palette: every skin, hair and cloth a tint of one light, the eyes pale, the lips the cloth's
// colour. The light is per person -- the messenger in cyan, the archivist in phosphor green, the lecturer in the amber
// of old film, the guide in rose, the echo in a failing violet -- and a crowd member draws one, mostly cyan. The
// hologram pack (parts/hologram.mjs) reads the light off the skin and adds what says *projected*: the beam behind,
// the interlace and the torn rows over, the colour split and the rim; every one of them carries all four (the cast's
// `base`, and each archetype's makeup).
import '../parts/hologram.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf, pickIn } from '../people.mjs';
import { parts, shade, mix } from '../portrait.mjs';

/** The lights, and everything a person is coloured from one of them. */
export const HOLO_LIGHTS = { cyan: '#45cfe8', green: '#4fe08a', amber: '#f0a83c', rose: '#f07aa6', violet: '#9c86ff' };
const tints = (L) => ({ skin: mix(L, '#ffffff', 0.32), hair: shade(L, 0.66), cloth: [L, shade(L, 0.8), mix(L, '#ffffff', 0.4), shade(L, 0.6)], white: mix(L, '#ffffff', 0.82), iris: mix(L, '#ffffff', 0.9), pupil: shade(L, 0.38) });
const T = Object.fromEntries(Object.entries(HOLO_LIGHTS).map(([n, L]) => [n, tints(L)]));
const HOLO = ['holoBeam', 'holoScan', 'holoGhost', 'holoRim'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
/** What they wear, in each light: the grid tunic, or everyday clothes rendered in it. Cyan keeps the plain names. */
export const HOLOGRAM_COSTUMES = Object.fromEntries(Object.entries(T).flatMap(([n, t]) => { const [c1, c2, c3, c4] = t.cloth, sfx = n === 'cyan' ? '' : cap(n); return [
  [`holoTunic${sfx}`, (v) => ({ top: { style: 'gridTunic', color: v ? c4 : c2 }, jacket: { style: 'none' }, pants: { style: 'trousers', color: c4 } })],
  [`holoSuit${sfx}`, (v) => ({ top: { style: v ? 'buttonDown' : 'crewSweater', color: v ? c3 : c1 }, jacket: { style: 'blazer', color: c4 }, pants: { style: 'trousers', color: c4 } })]]; }));
Object.assign(COSTUMES, HOLOGRAM_COSTUMES);
/** One person's colouring in a light: skin, hair, the eyes and lips in it. No glasses, no jewellery, no headset: a projection carries nothing extra. */
const lit = (n) => { const t = T[n]; return { skin: t.skin, hairColor: t.hair, eyes: { white: t.white, iris: t.iris, pupil: t.pupil }, mouth: { color: t.cloth[1] }, glasses: null, accessories: [], figure: { opacity: 0.84 } }; }; // figure.opacity: the projection is see-through as a whole, the beam behind it at full strength
const set = (n, o) => { const l = lit(n); return { ...l, ...o, eyes: { ...l.eyes, ...o.eyes }, mouth: { ...l.mouth, ...o.mouth } }; };
/** The five: a messenger, a lecturer, a guide, an archivist, a ghost of someone. */
export const HOLOGRAMS = {
  messenger: { family: 'fineBoned', hair: 'longStraight', costume: 'holoTunic', makeup: HOLO, set: set('cyan', { face: { width: 150, height: 210 }, eyes: { style: 'almond', spacing: 56 }, nose: { style: 'narrow', width: 16, length: 42 }, mouth: { width: 42, fullness: 0.55 }, body: { width: 0.9 }, pose: { turn: 0.1 } }) },
  lecturer: { family: 'squareJaw', hair: 'combOver', age: 'old', costume: 'holoSuitAmber', makeup: HOLO, set: set('amber', { face: { width: 166, height: 206 }, eyes: { style: 'hooded', spacing: 50 }, nose: { style: 'aquiline', width: 22, length: 46 }, mouth: { style: 'thin', width: 46, fullness: 0.25 }, body: { width: 1.05 }, pose: { turn: -0.3, headTilt: 0.05 } }) },
  guide: { family: 'roundSoft', hair: 'curlyMedium', costume: 'holoTunicRose', makeup: HOLO, set: set('rose', { face: { width: 160, height: 202 }, eyes: { style: 'round', spacing: 58 }, nose: { style: 'roundedTip', width: 20, length: 38 }, mouth: { width: 46, fullness: 0.6, smile: 0.2 }, body: { width: 0.98 }, pose: { turn: 0.35 } }) },
  archivist: { family: 'longMidface', hair: 'lowBun', costume: 'holoSuitGreen', makeup: HOLO, set: set('green', { face: { width: 148, height: 216 }, eyes: { style: 'narrow', spacing: 52 }, nose: { style: 'long', width: 17, length: 46 }, mouth: { style: 'thin', width: 40, fullness: 0.35 }, body: { width: 0.9 }, pose: { turn: 0.4 } }) },
  echo: { family: 'wideCheek', hair: 'shortTextured', beard: 'shortBeard', costume: 'holoTunicViolet', makeup: [...HOLO, 'holoFail'], set: set('violet', { face: { width: 168, height: 202 }, eyes: { spacing: 54, openness: 0.9 }, nose: { style: 'straight', width: 22, length: 40 }, mouth: { width: 48, fullness: 0.4 }, body: { width: 1.1 }, pose: { turn: -0.2, shoulder: 0.3 } }) },
};
/** A crowd member's light: one draw, mostly cyan. Its clothes go over the crowd's own draw, so the whole figure is in it. */
const LIGHT_ODDS = ['cyan', 'cyan', 'cyan', 'green', 'amber', 'rose', 'violet'];
const base = (s) => { const n = pickIn(s, LIGHT_ODDS), t = T[n]; return { makeup: HOLO, ...lit(n), facialHair: { color: null }, top: { color: t.cloth[1] }, jacket: { color: t.cloth[3] }, pants: { color: t.cloth[3] }, hat: { color: t.cloth[3], accent: t.cloth[0] } }; };
export default {
  name: 'holograms', families: FAMILIES,
  skins: [T.cyan.skin], hairColors: [T.cyan.hair], irises: [T.cyan.iris], clothes: T.cyan.cloth, // the draws before the light is chosen; `base` recolours every one of them
  pools: { tops: parts('top', { any: ['only:hologram', 'everyday'] }), jackets: parts('jacket', { all: ['everyday'] }), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: [], details: [], graphics: [] },
  wardrobe: { none: ['none'] }, // every role
  archetypes: HOLOGRAMS, archetypeNames: Object.keys(HOLOGRAMS), costumes: Object.keys(HOLOGRAM_COSTUMES), build: buildOf('human'), contrast: 0.8, asym: 0.8,
  base,
};
