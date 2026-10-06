// The tieflings cast: six of them, built as a human is (`build`, solved from `ANATOMY` in cast.mjs: a human's
// height and a human's proportions, the horns and the slightly larger hands and feet the only difference), red- and violet-skinned, gold- and ember-eyed,
// horned in every shot (the `curvedHorns` makeup is each archetype's and the cast's `base`) and pointed of ear more
// than a halfling and less than an elf. They wear the brocade robe and the sigil from the tiefling pack
// (parts/tiefling.mjs) over the shared adventurer's kit (parts/fantasy.mjs), on the tableau's own shots.
import '../parts/tiefling.mjs'; // the parts this cast is made of register by name
import '../parts/fantasy.mjs'; // the shared pack beside them
import { COSTUMES, FAMILIES, buildOf } from '../cast.mjs';
import { parts, HAIR_COLORS } from '../portrait.mjs';

const INK = '#1f1a24', WINE = '#5e1f2a', GOLD = '#c9a03c', ASH = '#3d3642', EMBER = '#8d3a22', VIOLET = '#4a3357';
/** What they wear: the brocade robe, the robe under a cloak, leather for the road, black with gold at the collar. */
export const TIEFLING_COSTUMES = {
  brocade: (v) => ({ top: { style: 'brocadeRobe', color: v ? WINE : VIOLET, accent: GOLD }, jacket: { style: 'none' }, pants: { style: 'skirt', color: v ? WINE : VIOLET } }),
  hoodedBrocade: (v) => ({ top: { style: 'brocadeRobe', color: v ? ASH : INK, accent: EMBER }, jacket: { style: 'hoodedCloak', color: INK }, pants: { style: 'trousers', color: INK } }),
  emberLeather: (v) => ({ top: { style: 'leatherJerkin', color: v ? '#4a2e2a' : EMBER }, jacket: { style: 'hoodedCloak', color: ASH }, pants: { style: 'trousers', color: '#2e2622' } }),
  blackAndGold: () => ({ top: { style: 'brocadeRobe', color: INK, accent: GOLD }, jacket: { style: 'none' }, pants: { style: 'trousers', color: INK } }),
};
Object.assign(COSTUMES, TIEFLING_COSTUMES);
export const TIEFLING_BUILD = buildOf('tiefling'); // the anatomy table in cast.mjs: a human's height and a human's proportions; the horns are the difference
const horned = (width, height, face = {}) => ({ face: { width, height, ...face }, neck: { width: 54, height: 82 }, ears: { pointed: 0.6 } }); // every tiefling: a narrow head on a long neck, the ear drawn to a point
/** The six, by the hair's colour and mass, the sigil, the robe's colour block and how the horns sit over it. */
export const TIEFLINGS = {
  emberquill: { family: 'longMidface', hair: 'sweptBack', hairColors: ['jetBlack'], costume: 'blackAndGold', makeup: ['curvedHorns', 'infernalSigil'], set: { ...horned(150, 222, { chin: 0.24 }), eyes: { style: 'narrow', spacing: 52, depth: 0.8, browLift: -2 }, nose: { style: 'aquiline', width: 18, length: 48 }, mouth: { style: 'thin', width: 42, fullness: 0.3 }, body: { width: 0.94 }, pose: { turn: -0.35, shoulder: 0.4 } } },
  nightbell: { family: 'fineBoned', hair: 'longStraight', hairColors: ['white', 'platinum'], costume: 'brocade', makeup: ['curvedHorns'], set: { ...horned(146, 226, { chin: 0.3 }), eyes: { style: 'almond', spacing: 58, openness: 1.08, sclera: 0.9 }, nose: { style: 'narrow', width: 16, length: 44 }, mouth: { style: 'full', width: 40, fullness: 0.7 }, body: { width: 0.86 }, pose: { headTilt: 0.1, turn: 0.35 } } },
  ashcantor: { family: 'squareJaw', hair: 'crewCut', hairColors: ['softBlack', 'espresso'], beard: 'heavyStubble', costume: 'emberLeather', makeup: ['curvedHorns'], set: { ...horned(168, 208, { corner: 44 }), eyes: { spacing: 50, browLift: -3 }, nose: { style: 'straight', width: 22, length: 42 }, mouth: { style: 'wide', width: 50, fullness: 0.35 }, body: { width: 1.08 }, pose: { turn: 0.3, shoulder: -0.5 } } },
  verminwitch: { family: 'fineBoned', hair: 'boxBraids', hairColors: ['jetBlack', 'auburn'], costume: 'hoodedBrocade', makeup: ['curvedHorns', 'infernalSigil'], set: { ...horned(152, 216), eyes: { style: 'round', spacing: 60, openness: 1.15 }, nose: { style: 'upturned', width: 17, length: 40 }, mouth: { style: 'cupidBow', width: 40, fullness: 0.65 }, body: { width: 0.9 }, pose: { headTilt: -0.12, turn: -0.4 } } },
  gravelow: { family: 'heavyBrow', hair: 'bald', hairColors: ['gray'], age: 'mid', costume: 'hoodedBrocade', makeup: ['curvedHorns'], set: { ...horned(170, 206, { corner: 42, jaw: 0.84 }), eyes: { style: 'hooded', spacing: 48, depth: 1, bags: 0.8 }, nose: { style: 'broad', width: 26, length: 44 }, mouth: { style: 'thin', width: 46, fullness: 0.25 }, body: { width: 1.06 }, pose: { turn: 0.2, bodyTilt: 0.05, headTilt: 0.06 } } },
  silkmoth: { family: 'longMidface', hair: 'highBun', hairColors: ['darkBrown', 'jetBlack'], costume: 'brocade', makeup: ['curvedHorns', 'infernalSigil'], set: { ...horned(148, 230, { chin: 0.26 }), eyes: { style: 'upturned', spacing: 56, openness: 1.05, browLift: 3 }, nose: { style: 'long', width: 16, length: 50 }, mouth: { width: 42, fullness: 0.5 }, body: { width: 0.88 }, pose: { turn: 0.5, shoulder: 0.5 } } },
};
const pool = (kind, own) => parts(kind, { any: [own, 'era:fantasy'] }); // its own tag and the shared pack, never a registry
// the cast object (the shape cast.mjs's EDITORIAL documents): three of the editorial families, red and violet skins, dark and white hair, gold and ember eyes, the tiefling robe beside the shared kit, no hats (the horns have the crown), the build, the horns on everyone
export default {
  name: 'tieflings', families: { longMidface: FAMILIES.longMidface, fineBoned: FAMILIES.fineBoned, squareJaw: FAMILIES.squareJaw, heavyBrow: FAMILIES.heavyBrow },
  // red through rust and plum to violet, slate blue and a dusky pale: a tiefling is not one colour
  skins: ['#a84a3f', '#8d3a3a', '#b05a4a', '#c06a52', '#6e4258', '#8a5a6b', '#5f4a6b', '#4a5570', '#7a8a9a', '#9a6a52', '#6b3a3a', '#b98a74'], hairColors: ['jetBlack', 'softBlack', 'white', 'platinum', 'auburn', 'darkBrown'].map((k) => HAIR_COLORS[k]), irises: ['#d9a22a', '#b3202a', '#2b2220', '#c9a03c'], clothes: [INK, WINE, GOLD, ASH, EMBER, VIOLET],
  pools: { tops: pool('top', 'only:tiefling'), jackets: pool('jacket', 'only:tiefling'), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: parts('glasses', { all: ['everyday'] }), details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { establish: ['none'], develop: ['none'], climax: ['none'], release: ['none'], none: ['none'] },
  archetypes: TIEFLINGS, archetypeNames: Object.keys(TIEFLINGS), costumes: Object.keys(TIEFLING_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: TIEFLING_BUILD, contrast: 1.7, asym: 1.3,
  base: { makeup: ['curvedHorns'], ears: { pointed: 0.6 }, build: TIEFLING_BUILD }, // the signature every random one in a crowd carries too, the skeleton with it (an identity takes the build from the cast)
  limits: { 'ears.pointed': [0.4, 0.8], 'nose.muzzle': [0, 0] },
};
