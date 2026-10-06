// The dragonborn cast: five of them, the heaviest build in the set (`build`, solved from `ANATOMY` in cast.mjs:
// six foot six, the longest torso and the broadest shoulders of the eight), scaled in the chromatic and metallic hides, and drawn with a muzzle, scale rows and backswept horns in
// every shot (the three makeups are each archetype's and the cast's `base`). They have no hair worth drawing, so
// the hair pool is the shaved styles alone and the beard pool is empty; they wear scale mail and a wing mantle from
// the dragonborn pack (parts/dragonborn.mjs) over the shared kit (parts/fantasy.mjs), on the tableau's own shots.
import '../parts/dragonborn.mjs'; // the parts this cast is made of register by name
import '../parts/fantasy.mjs'; // the shared pack beside them
import { COSTUMES, FAMILIES, buildOf } from '../cast.mjs';
import { parts } from '../portrait.mjs';

const BRONZE = '#9a7b46', SLATE = '#4a5560', OXIDE = '#7a4232', MOSS = '#48553f', BONE = '#cfc3a4', NIGHT = '#232a30';
/** What they wear: scale mail, scale mail under a wing mantle, leather and the mantle, a clan tunic and cloak. */
export const DRAGONBORN_COSTUMES = {
  scaleMail: (v) => ({ top: { style: 'scaleMailShirt', color: v ? SLATE : BRONZE }, jacket: { style: 'none' }, pants: { style: 'trousers', color: NIGHT } }),
  wingedScale: () => ({ top: { style: 'scaleMailShirt', color: BRONZE }, jacket: { style: 'wingMantle', color: OXIDE }, pants: { style: 'trousers', color: '#2e2622' } }),
  drakeLeather: (v) => ({ top: { style: 'leatherJerkin', color: v ? '#4a3a2e' : OXIDE }, jacket: { style: 'wingMantle', color: NIGHT }, pants: { style: 'trousers', color: NIGHT } }),
  clanTunic: (v) => ({ top: { style: 'roughTunic', color: v ? BONE : MOSS }, jacket: { style: 'hoodedCloak', color: MOSS }, pants: { style: 'trousers', color: '#3a3128' } }),
};
Object.assign(COSTUMES, DRAGONBORN_COSTUMES);
export const DRAGONBORN_BUILD = buildOf('dragonborn'); // the anatomy table in cast.mjs: the tallest and heaviest, the broadest shoulders and the longest torso in the set
const FACE = ['scaleHide', 'hornCrest']; // what the head wears: the scales and the horns. The muzzle is not worn, it is the face: nose.muzzle below
const drake = (width, height, face = {}) => ({ face: { width, height, ...face }, neck: { width: 100, height: 60 }, ears: { size: 0.6, pointed: 0 }, nose: { muzzle: 1 }, mouth: { teeth: 'fangs' } }); // every dragonborn: a long head on a thick neck, no ear to speak of, and the nose drawn as a muzzle with fangs in it (the portrait's own dials, not something worn)
/** The five, by the scale's colour, the head's length and the costume's colour block. */
export const DRAGONBORN = {
  bronzemaw: { family: 'squareJaw', hair: 'bald', costume: 'wingedScale', makeup: FACE, set: { ...drake(182, 214, { corner: 44, jaw: 0.82 }), eyes: { style: 'narrow', spacing: 52, depth: 0.9, browLift: -3 }, nose: { style: 'broad', width: 28, length: 46 }, mouth: { style: 'wide', width: 54, fullness: 0.25 }, body: { width: 1.28 }, pose: { turn: 0.25, shoulder: 0.4 } } },
  emberscale: { family: 'heavyBrow', hair: 'shavedHead', costume: 'scaleMail', makeup: FACE, set: { ...drake(186, 208, { corner: 46 }), eyes: { style: 'hooded', spacing: 50, depth: 1 }, nose: { style: 'aquiline', width: 26, length: 48 }, mouth: { style: 'thin', width: 50, fullness: 0.2 }, body: { width: 1.3 }, pose: { turn: -0.35, shoulder: -0.4 } } },
  stormjaw: { family: 'squareJaw', hair: 'bald', costume: 'drakeLeather', makeup: FACE, set: { ...drake(190, 204, { corner: 50, jaw: 0.76 }), eyes: { spacing: 48, browLift: -4 }, nose: { style: 'straight', width: 26, length: 44 }, mouth: { style: 'wide', width: 56, fullness: 0.3 }, body: { width: 1.34 }, pose: { turn: 0.4, bodyTilt: 0.05 } } },
  whitecrest: { family: 'heavyBrow', hair: 'bald', age: 'old', costume: 'clanTunic', makeup: FACE, set: { ...drake(180, 218, { chin: 0.08 }), eyes: { style: 'round', spacing: 56, bags: 0.8, openness: 0.95 }, nose: { style: 'long', width: 24, length: 50 }, mouth: { width: 48, fullness: 0.3 }, body: { width: 1.2 }, pose: { headTilt: 0.08, turn: -0.25 } } },
  greenhide: { family: 'squareJaw', hair: 'buzz', costume: 'clanTunic', makeup: FACE, set: { ...drake(184, 210), eyes: { spacing: 54, openness: 1.05 }, nose: { style: 'broad', width: 30, length: 44 }, mouth: { width: 52, fullness: 0.35 }, body: { width: 1.26 }, pose: { turn: 0.5, shoulder: 0.5 } } },
};
const pool = (kind, own) => parts(kind, { any: [own, 'era:fantasy'] }); // its own tag and the shared pack, never a registry
// the cast object (the shape cast.mjs's EDITORIAL documents): two of the editorial families, scale hues for skin, no hair colour that matters, amber eyes, the dragonborn mail and mantle beside the shared kit, the shaved hair styles alone, an empty beard pool, no hats (the crest has the crown), the build, the head on everyone
export default {
  name: 'dragonborn', families: { squareJaw: FAMILIES.squareJaw, heavyBrow: FAMILIES.heavyBrow },
  // the chromatic and metallic hides: bronze, gold, copper, green, red, blue, white, silver and black
  skins: ['#9a7b46', '#c0a95e', '#a8702f', '#5f7a56', '#3f5a4a', '#8d4a3a', '#7a3a3a', '#4a6b82', '#5a7f8d', '#b9b4a8', '#8a8d94', '#4a4a52'], hairColors: ['#2b2824'], irises: ['#d9a22a', '#c98a2a', '#8d1f22'], clothes: [BRONZE, SLATE, OXIDE, MOSS, BONE, NIGHT],
  pools: { tops: pool('top', 'only:dragonborn'), jackets: pool('jacket', 'only:dragonborn'), beards: parts('facialHair', { all: ['only:dragonborn'] }), hair: parts('hair', { all: ['everyday'] }).filter((n) => ['bald', 'shavedHead', 'buzz'].includes(n)), glasses: parts('glasses', { all: ['everyday'] }), details: [], graphics: [] },
  wardrobe: { establish: ['none'], develop: ['none'], climax: ['none'], release: ['none'], none: ['none'] },
  archetypes: DRAGONBORN, archetypeNames: Object.keys(DRAGONBORN), costumes: Object.keys(DRAGONBORN_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: DRAGONBORN_BUILD, contrast: 1.6, asym: 1.2,
  base: { makeup: FACE, ears: { size: 0.6 }, nose: { muzzle: 1 }, mouth: { teeth: 'fangs' }, build: DRAGONBORN_BUILD }, // the signature every random one in a crowd carries too, the skeleton with it (an identity takes the build from the cast)
  limits: { 'nose.muzzle': [1, 1], 'ears.pointed': [0, 0.2], 'ears.size': [0.4, 0.9], 'mouth.teeth': ['fangs'], 'build.shoulders': [1.38, 1.7], 'build.trunk': [1.22, 1.5] }, // the build bands are the table's row either side of DRAGONBORN_BUILD: the broadest shoulders and the longest torso of the eight
};
