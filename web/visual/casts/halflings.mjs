// The halflings cast: six of them, built small (`build`, solved from `ANATOMY` in cast.mjs: half a human's
// height, a head to match since 1:5 of three feet is a child's head, and the stockier of the two small folk —
// broader and longer in the torso than a gnome of the same height, with bigger feet under it), their faces round
// and soft and wide-cheeked with short necks, warm-skinned, curly-haired, slightly pointed of ear
// (`ears.pointed` at a third, not an elf's blade). They wear a patchwork waistcoat, a quilted coat and a straw cap
// from the halfling pack (parts/halfling.mjs) over the shared kit (parts/fantasy.mjs), on the tableau's own shots.
import '../parts/halfling.mjs'; // the parts this cast is made of register by name
import '../parts/fantasy.mjs'; // the shared pack beside them
import { COSTUMES, FAMILIES, buildOf } from '../cast.mjs';
import { parts, SKIN_COLORS, HAIR_COLORS, EYE_COLORS } from '../portrait.mjs';

const WHEAT = '#c2a86a', BERRY = '#8d4a52', LEAF = '#5f7a4a', OAK = '#6b4a33', CREAM = '#d9cdb0', PLUM = '#5e4257';
/** What they wear: a patchwork waistcoat, the waistcoat under a quilted coat, a straw cap over homespun, a cloak for the road. */
export const HALFLING_COSTUMES = {
  patchwork: (v) => ({ top: { style: 'patchworkVest', color: v ? BERRY : LEAF }, jacket: { style: 'none' }, pants: { style: 'trousers', color: OAK } }),
  quiltedSunday: (v) => ({ top: { style: 'patchworkVest', color: v ? WHEAT : PLUM }, jacket: { style: 'quiltedCoat', color: OAK }, pants: { style: 'trousers', color: '#4a3f33' } }),
  strawAndHomespun: () => ({ top: { style: 'roughTunic', color: CREAM }, jacket: { style: 'none' }, hat: { style: 'strawCap', color: WHEAT, accent: BERRY }, pants: { style: 'trousers', color: '#6b5a3a' } }),
  footpathCloak: (v) => ({ top: { style: 'roughTunic', color: v ? LEAF : WHEAT }, jacket: { style: 'hoodedCloak', color: '#55603f' }, pants: { style: 'trousers', color: OAK } }),
};
Object.assign(COSTUMES, HALFLING_COSTUMES);
export const HALFLING_BUILD = buildOf('halfling'); // the anatomy table in cast.mjs: half a human's height, 1:5 of that being a child's head, and the stockier of the two small folk
const small = (width, height, face = {}) => ({ face: { width, height, ...face }, neck: { width: 72, height: 44 }, ears: { pointed: 0.32 } }); // every halfling: a round head on a short neck, the ear tapered a little
/** The six, by the hair's curl and colour, the cap, the waistcoat's patches and the costume's colour block. */
export const HALFLINGS = {
  appleward: { family: 'roundSoft', hair: 'curlyMedium', hairColors: ['chestnut', 'auburn'], costume: 'patchwork', set: { ...small(168, 176, { chin: 0.06, jaw: 0.96 }), eyes: { style: 'round', spacing: 60, openness: 1.12 }, nose: { style: 'upturned', width: 22, length: 30 }, mouth: { style: 'wide', width: 46, fullness: 0.6 }, body: { width: 1.06 }, pose: { headTilt: 0.12, turn: 0.3 } } },
  burrowkeep: { family: 'roundSoft', hair: 'receding', hairColors: ['lightBrown', 'saltPepper'], beard: 'circleBeard', age: 'mid', costume: 'quiltedSunday', set: { ...small(172, 174, { jaw: 0.98 }), eyes: { spacing: 62, bags: 0.7 }, nose: { style: 'roundedTip', width: 24, length: 32 }, mouth: { width: 44, fullness: 0.5 }, body: { width: 1.14 }, pose: { turn: -0.3, bodyTilt: 0.05 } } },
  pennywhistle: { family: 'wideCheek', hair: 'shortTextured', hairColors: ['copper', 'chestnut'], costume: 'strawAndHomespun', set: { ...small(170, 172, { chin: 0.08 }), eyes: { style: 'upturned', spacing: 60, openness: 1.08 }, nose: { style: 'short', width: 21, length: 28 }, mouth: { style: 'full', width: 44, fullness: 0.7 }, body: { width: 1.02 }, pose: { turn: 0.45, shoulder: 0.5 } } },
  marrowfield: { family: 'wideCheek', hair: 'curlyMedium', hairColors: ['darkBrown', 'brown'], costume: 'footpathCloak', set: { ...small(166, 180), eyes: { spacing: 58, browLift: 2 }, nose: { style: 'straight', width: 20, length: 32 }, mouth: { width: 42, fullness: 0.5 }, body: { width: 0.98 }, pose: { turn: -0.4, headTilt: -0.06 } } },
  thistledown: { family: 'fineBoned', hair: 'bluntBob', hairColors: ['darkBlond', 'lightBrown'], costume: 'patchwork', set: { ...small(162, 178, { chin: 0.14 }), eyes: { style: 'round', spacing: 58, sclera: 0.85, openness: 1.1 }, nose: { style: 'narrow', width: 18, length: 28 }, mouth: { style: 'cupidBow', width: 40, fullness: 0.65 }, body: { width: 0.94 }, pose: { headTilt: -0.1, turn: 0.35 } } },
  oldBramble: { family: 'roundSoft', hair: 'horseshoe', hairColors: ['white', 'gray'], beard: 'garibaldi', age: 'old', costume: 'quiltedSunday', set: { ...small(174, 170, { jaw: 0.94 }), eyes: { style: 'hooded', spacing: 60, bags: 1, openness: 0.82 }, nose: { style: 'broad', width: 26, length: 32 }, mouth: { style: 'thin', width: 42, fullness: 0.3 }, body: { width: 1.18 }, pose: { turn: 0.2, shoulder: -0.4, headTilt: 0.05 } } },
};
const pool = (kind, own) => parts(kind, { any: [own, 'era:fantasy'] }); // its own tag and the shared pack, never a registry
// the cast object (the shape cast.mjs's EDITORIAL documents): three of the editorial families, warm skins, brown and copper hair, green and hazel eyes, the halfling tops and coats beside the shared kit, a straw cap on most roles, the build, the tapered ear on everyone
export default {
  name: 'halflings', families: { roundSoft: FAMILIES.roundSoft, wideCheek: FAMILIES.wideCheek, fineBoned: FAMILIES.fineBoned },
  skins: ['fair', 'lightWarm', 'lightOlive', 'mediumWarm', 'mediumOlive', 'tan', 'brown', 'deepBrown'].map((k) => SKIN_COLORS[k]), hairColors: ['chestnut', 'auburn', 'copper', 'lightBrown', 'darkBlond', 'white'].map((k) => HAIR_COLORS[k]), irises: ['green', 'hazel', 'brown', 'amber'].map((k) => EYE_COLORS[k]), clothes: [WHEAT, BERRY, LEAF, OAK, CREAM, PLUM],
  pools: { tops: pool('top', 'only:halfling'), jackets: pool('jacket', 'only:halfling'), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: parts('glasses', { all: ['everyday'] }), details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { establish: ['none', 'strawCap'], develop: ['strawCap', 'none', 'feltTravelHat'], climax: ['strawCap', 'feltTravelHat'], release: ['none', 'strawCap'], none: ['none', 'strawCap', 'feltTravelHat'] },
  archetypes: HALFLINGS, archetypeNames: Object.keys(HALFLINGS), costumes: Object.keys(HALFLING_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: HALFLING_BUILD, contrast: 1.3, asym: 1.2,
  base: { ears: { pointed: 0.32 }, build: HALFLING_BUILD }, // the signature every random one in a crowd carries too, the skeleton with it (an identity takes the build from the cast)
  limits: { 'ears.pointed': [0.15, 0.5], 'nose.muzzle': [0, 0], 'build.legs': [0.32, 0.5], 'build.trunk': [0.46, 0.66], 'build.head': [0.62, 0.82], 'build.shoulders': [0.5, 0.72] }, // the build bands are the table's row either side of HALFLING_BUILD: a halfling stands a gnome's height and is the stockier of the two
};
