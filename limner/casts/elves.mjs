// The elves cast: six of them, slight and long-legged (`build`, solved from `ANATOMY` in cast.mjs: taller than a
// human and slighter with it, the extra height all in the leg, narrow shoulders, more heads tall), their faces from the fine-boned and long-midface families with narrow heads (138 to 150 wide, 220
// to 236 tall) on long necks and slight bodies pinned in `set`, pale, light-eyed, pointed-eared (the cast's `base`
// puts the portrait's own `ears.pointed` on every one of them, archetype and crowd alike, so the ear is drawn as one
// blade where an ear is drawn and the hair falls over it like hair), and beardless not by rule but because the beard
// pool is an empty query: the generator falls back to none. They dress from the elf pack
// (parts/elf.mjs) and dance the tableau's own shots (lib/visual.json: dance `editorial`). The third theme, added to
// prove the system: a pack, a cast and a row, nothing else touched.
import '../parts/elf.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, SKIN_COLORS, HAIR_COLORS, EYE_COLORS } from '../portrait.mjs';
import { rand } from '../rng.mjs';

const MOSS = '#405547', BARK = '#4a3a2e', SILVER = '#b9b8b3', MIST = '#8da0a8', FERN = '#5f7a56', NIGHT = '#2a3340', GOLD = '#c9a03c';
/** What they wear: a green tunic under a bark cloak, silver with a circlet, night colours under a dark cloak. */
export const ELF_COSTUMES = {
  greenwood: (v) => ({ top: { style: 'elvenTunic', color: v ? FERN : MOSS, accent: GOLD }, jacket: { style: 'travelCloak', color: BARK }, pants: { style: 'trousers', color: BARK } }),
  silverCourt: (v) => ({ top: { style: 'elvenTunic', color: v ? MIST : SILVER, accent: MOSS }, jacket: { style: 'none' }, hat: { style: 'leafCirclet', color: SILVER, accent: GOLD }, pants: { style: 'skirt', color: SILVER } }),
  nightWalker: () => ({ top: { style: 'turtleneck', color: NIGHT }, jacket: { style: 'travelCloak', color: '#1f2630' }, pants: { style: 'trousers', color: NIGHT } }),
};
Object.assign(COSTUMES, ELF_COSTUMES);
export const ELF_BUILD = buildOf('elf'); // the anatomy table in cast.mjs: taller than a human, all of it in the leg, narrow of shoulder, more heads tall
export const ELF_EARS = [0.72, 1]; // how far an elf's ear comes to a point: the cast's own range, drawn per person, so no two of them have the same ear and none of them is round
const slender = (width, height, face = {}) => ({ face: { width, height, ...face }, neck: { width: 48, height: 100 } }); // every elf: a narrow head on a long neck
/** The six, by what tells them apart: the hair's length and colour, the circlet, the cloak, the vine. */
export const ELVES = {
  silverleaf: { family: 'fineBoned', hair: 'lowBun', hairColors: ['platinum', 'white'], costume: 'silverCourt', makeup: ['vineMarks'], set: { ...slender(142, 226, { chin: 0.3 }), eyes: { spacing: 60, sclera: 0.9, openness: 1.1 }, nose: { style: 'narrow', width: 14, length: 46 }, mouth: { width: 38, fullness: 0.5 }, body: { width: 0.8 }, pose: { turn: 0.3, headTilt: 0.08 } } },
  nightbrook: { family: 'longMidface', hair: 'sweptBack', hairColors: ['jetBlack'], costume: 'nightWalker', makeup: 'none', set: { ears: { pointed: 0.78 }, ...slender(146, 232, { chin: 0.26 }), eyes: { style: 'narrow', spacing: 50, depth: 0.7, browLift: -2 }, nose: { style: 'long', width: 15, length: 52 }, mouth: { style: 'thin', width: 40, fullness: 0.2 }, body: { width: 0.9 }, pose: { turn: -0.4, shoulder: 0.4 } } },
  ashwarden: { family: 'longMidface', hair: 'ponytailLow', hairColors: ['silver', 'platinum'], age: 'mid', costume: 'greenwood', makeup: 'none', set: { ...slender(148, 230, { chin: 0.24 }), eyes: { style: 'almond', spacing: 52, depth: 0.6 }, nose: { style: 'aquiline', width: 16, length: 50 }, mouth: { style: 'thin', width: 40, fullness: 0.25 }, body: { width: 0.92 }, pose: { turn: 0.2, shoulder: -0.3, headTilt: -0.04 } } },
  moonsinger: { family: 'fineBoned', hair: 'highBun', hairColors: ['lightBlond', 'platinum'], costume: 'silverCourt', makeup: ['vineMarks'], set: { ears: { pointed: 1 }, ...slender(138, 236, { chin: 0.34 }), eyes: { style: 'round', spacing: 62, sclera: 0.95, openness: 1.15 }, nose: { style: 'upturned', width: 14, length: 44 }, mouth: { style: 'cupidBow', width: 36, fullness: 0.7 }, body: { width: 0.76 }, pose: { headTilt: 0.14, turn: 0.35 } } },
  fernstrider: { family: 'fineBoned', hair: 'middlePart', hairColors: ['copper', 'lightBlond'], costume: 'greenwood', makeup: 'none', set: { ...slender(150, 222, { chin: 0.28 }), eyes: { style: 'upturned', spacing: 58, openness: 1.05 }, nose: { style: 'straight', width: 16, length: 44 }, mouth: { width: 42, fullness: 0.55 }, body: { width: 0.88 }, pose: { turn: 0.5, shoulder: 0.5, bodyTilt: -0.04 } } },
  dawnherald: { family: 'longMidface', hair: 'bluntBob', hairColors: ['white', 'silver'], costume: 'nightWalker', makeup: ['vineMarks'], set: { ...slender(144, 228, { chin: 0.22 }), eyes: { style: 'almond', spacing: 54, depth: 0.5, browLift: 2 }, nose: { style: 'narrow', width: 15, length: 48 }, mouth: { style: 'full', width: 40, fullness: 0.75 }, body: { width: 0.84 }, pose: { headTilt: -0.12, turn: -0.3, shoulder: -0.4 } } },
};
const pickKeys = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
// the cast object (the shape cast.mjs's EDITORIAL documents): two of the editorial families, pale skins, light hair and eyes, the elf tops and cloak and nothing else, an empty beard pool, a circlet on some roles, the build, the ears on everyone
export default {
  name: 'elves', families: pickKeys(FAMILIES, ['fineBoned', 'longMidface']),
  skins: ['porcelain', 'fair', 'lightWarm', 'lightOlive'].map((k) => SKIN_COLORS[k]), hairColors: ['platinum', 'white', 'silver', 'lightBlond', 'jetBlack', 'copper'].map((k) => HAIR_COLORS[k]), irises: ['green', 'grayGreen', 'lightBlue', 'blueGray'].map((k) => EYE_COLORS[k]), clothes: [MOSS, BARK, SILVER, MIST, FERN, NIGHT],
  pools: { tops: parts('top', { any: ['only:elf'] }), jackets: parts('jacket', { any: ['only:elf'] }), beards: parts('facialHair', { all: ['only:elf'] }), hair: parts('hair', { all: ['everyday'], not: ['overEars'] }), glasses: parts('glasses', { all: ['everyday'] }), details: parts('details', { all: ['everyday'] }), graphics: parts('graphics', { all: ['everyday'] }) },
  wardrobe: { establish: ['none', 'leafCirclet'], develop: ['none', 'leafCirclet', 'none'], climax: ['leafCirclet'], release: ['none'], none: ['none', 'leafCirclet'] },
  archetypes: ELVES, archetypeNames: Object.keys(ELVES), costumes: Object.keys(ELF_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: ELF_BUILD, contrast: 1.4, asym: 1.2,
  base: (s) => ({ ears: { pointed: ELF_EARS[0] + rand(s) * (ELF_EARS[1] - ELF_EARS[0]) } }), // the cast's signature as a rule, on its archetypes and its crowd alike: the ear itself comes to a point (portrait's ears.pointed), by this much on this one, and an archetype may pin its own
  limits: { 'ears.pointed': [0.7, 1], 'nose.muzzle': [0, 0] }, // an elf's ear is the elf: the editor may not round it off (groupsFor)
};
