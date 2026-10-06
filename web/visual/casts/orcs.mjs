// The orcs cast: six of them, built heavy and tall (`build`, solved from `ANATOMY` in cast.mjs: six foot four, a
// long thick torso, shoulders half again as wide, long arms, legs short for the height), their faces from the heavy-browed and square-jawed families with broad heads on thick necks, green and
// grey-skinned, amber-eyed, tusked in every shot (the `tusks` makeup is each archetype's and the cast's `base`, so a
// random one in the crowd has them too) and lightly pointed of ear. They wear hide, pelt and bone from the orc pack
// (parts/orc.mjs) over the shared adventurer's kit (parts/fantasy.mjs), and dance the tableau's own shots.
import '../parts/orc.mjs'; // the parts this cast is made of register by name
import '../parts/fantasy.mjs'; // the shared pack beside them
import { COSTUMES, FAMILIES, buildOf } from '../cast.mjs';
import { parts, HAIR_COLORS, EYE_COLORS } from 'limner';

const HIDE = '#6b4a30', FUR = '#4b3b2a', IRON = '#6c7278', BONE = '#cfc3a4', BLOOD = '#6e2a24', MOSS = '#48553f';
/** What they wear: hide under a wolf pelt, hide under a bone helm, a scout's leather and cloak, stripped to the waist. */
export const ORC_COSTUMES = {
  hideAndPelt: (v) => ({ top: { style: 'hideArmor', color: v ? '#7a5638' : HIDE }, jacket: { style: 'wolfPelt', color: FUR }, pants: { style: 'trousers', color: '#3a2e24' } }),
  boneHelmed: () => ({ top: { style: 'hideArmor', color: HIDE }, jacket: { style: 'none' }, hat: { style: 'boneHelm', color: IRON, accent: BONE }, pants: { style: 'trousers', color: '#332a22' } }),
  orcScout: (v) => ({ top: { style: 'leatherJerkin', color: v ? '#4a3a2e' : HIDE }, jacket: { style: 'hoodedCloak', color: MOSS }, pants: { style: 'trousers', color: '#3a3128' } }),
  strippedToTheWaist: () => ({ top: { style: 'bare', color: '#000' }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#2e2622' } }),
};
Object.assign(COSTUMES, ORC_COSTUMES);
export const ORC_BUILD = buildOf('orc'); // the anatomy table in cast.mjs: tall, heavy of shoulder, long-armed, the legs short for the height
/** An orc's hide: green through moss, olive and grey-green to stone and ash, light to dark, because a camp is not one colour. */
export const ORC_SKINS = ['#7d8f63', '#6b7d57', '#8a9a6e', '#5f7350', '#9aa882', '#4e6147', '#6e7d6a', '#8d8d84', '#747a6c', '#5c5f58', '#a4a893', '#6b6355'];
const heavy = (width, height, face = {}) => ({ face: { width, height, ...face }, neck: { width: 96, height: 56 }, ears: { pointed: 0.4 } }); // every orc: a broad head on a thick neck, the ear drawn to a slight point
/** The six, by the tusks' size, the hair's mass, the helm and the costume's colour block. */
export const ORCS = {
  warChief: { family: 'heavyBrow', hair: 'ponytailLow', hairColors: ['jetBlack'], costume: 'boneHelmed', makeup: ['tusks'], marks: ['clanTattoo'], set: { ...heavy(192, 198, { corner: 46, jaw: 0.8 }), eyes: { style: 'narrow', spacing: 48, depth: 1, browLift: -4 }, nose: { style: 'broad', width: 34, length: 38 }, mouth: { style: 'wide', width: 56, fullness: 0.3 }, body: { width: 1.3 }, pose: { turn: 0.25, shoulder: 0.4 } } },
  boneSinger: { family: 'squareJaw', hair: 'shortMohawk', hairColors: ['softBlack', 'gray'], costume: 'hideAndPelt', makeup: ['tusks', 'warPaint'], set: { ...heavy(186, 204, { corner: 44 }), eyes: { spacing: 52, browLift: -3 }, nose: { style: 'straight', width: 28, length: 42 }, mouth: { width: 52, fullness: 0.35 }, body: { width: 1.22 }, pose: { turn: -0.35, headTilt: 0.06 } } },
  greyTusk: { family: 'heavyBrow', hair: 'bald', hairColors: ['gray'], age: 'old', costume: 'strippedToTheWaist', makeup: ['tusks'], marks: ['clanTattoo'], set: { ...heavy(194, 196, { corner: 48, jaw: 0.76 }), eyes: { style: 'hooded', spacing: 50, bags: 1, openness: 0.8 }, nose: { style: 'aquiline', width: 30, length: 44 }, mouth: { style: 'thin', width: 50, fullness: 0.2 }, body: { width: 1.34 }, pose: { turn: 0.3, shoulder: -0.5, bodyTilt: 0.05 } } },
  campRunner: { family: 'squareJaw', hair: 'buzz', hairColors: ['espresso', 'jetBlack'], costume: 'orcScout', makeup: ['tusks'], set: { ...heavy(180, 200), eyes: { spacing: 54, openness: 1.05 }, nose: { style: 'short', width: 26, length: 34 }, mouth: { width: 48, fullness: 0.4 }, body: { width: 1.12 }, pose: { turn: 0.5, shoulder: 0.6 } } },
  ironJaw: { family: 'squareJaw', hair: 'locsShort', hairColors: ['jetBlack', 'espresso'], beard: 'heavyStubble', costume: 'hideAndPelt', makeup: ['tusks'], set: { ...heavy(190, 192, { corner: 50, jaw: 0.72 }), eyes: { style: 'narrow', spacing: 46, depth: 0.9 }, nose: { style: 'broad', width: 32, length: 36 }, mouth: { style: 'wide', width: 58, fullness: 0.25 }, body: { width: 1.3 }, pose: { turn: -0.2, shoulder: 0.5 } } },
  marshWitch: { family: 'heavyBrow', hair: 'boxBraids', hairColors: ['softBlack'], costume: 'orcScout', makeup: ['tusks', 'warPaint'], marks: ['clanTattoo'], set: { ...heavy(182, 206, { chin: 0.1 }), eyes: { style: 'round', spacing: 58, openness: 1.1 }, nose: { style: 'roundedTip', width: 28, length: 38 }, mouth: { style: 'full', width: 50, fullness: 0.6 }, body: { width: 1.16 }, pose: { headTilt: 0.12, turn: -0.4 } } },
};
const pool = (kind, own) => parts(kind, { any: [own, 'era:fantasy'] }); // its own tag and the shared pack, never a registry
// the cast object (the shape cast.mjs's EDITORIAL documents): two of the editorial families, green and grey skins, dark hair, amber eyes, the orc tops and pelts beside the shared kit, a helm on the loud roles, the build, the tusks on everyone
export default {
  name: 'orcs', families: { heavyBrow: FAMILIES.heavyBrow, squareJaw: FAMILIES.squareJaw },
  skins: ORC_SKINS, hairColors: ['jetBlack', 'softBlack', 'espresso', 'gray'].map((k) => HAIR_COLORS[k]), irises: ['amber', 'hazel', 'brown'].map((k) => EYE_COLORS[k]), clothes: [HIDE, FUR, IRON, BLOOD, MOSS, '#3a2e24'],
  pools: { tops: pool('top', 'only:orc'), jackets: pool('jacket', 'only:orc'), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: parts('glasses', { all: ['everyday'] }), details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { establish: ['none', 'none', 'boneHelm'], develop: ['boneHelm', 'none', 'feltTravelHat'], climax: ['boneHelm', 'boneHelm', 'none'], release: ['none', 'boneHelm'], none: ['none', 'boneHelm', 'feltTravelHat'] },
  archetypes: ORCS, archetypeNames: Object.keys(ORCS), costumes: Object.keys(ORC_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: ORC_BUILD, contrast: 1.7, asym: 1.5,
  base: { makeup: ['tusks'], ears: { pointed: 0.4 }, build: ORC_BUILD }, // the signature every random one in a crowd carries too, the skeleton with it (an identity takes the build from the cast)
  limits: { 'ears.pointed': [0.2, 0.6], 'nose.muzzle': [0, 0], 'build.shoulders': [1.3, 1.65], 'build.trunk': [1.15, 1.45], 'build.legs': [0.9, 1.25] }, // the build bands are the table's row either side of ORC_BUILD: an orc is never narrow or short in the torso
};
