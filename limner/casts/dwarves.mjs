// The dwarves cast: eight of them, built short and broad (`build`, solved from `ANATOMY` in cast.mjs: four and a
// half foot, a human's own head on it, shoulders a sixth wider than a human's, legs two thirds the length), their faces from the heavy, square and round families with broad heads
// (178 to 192 wide), short thick necks and wide bodies pinned in `set`, every one bearded, in mail, fur and leather
// from the dwarf pack (parts/dwarf.mjs) beside the everyday clothes. They dance the tableau's own shots and poses
// (lib/visual.json: dance `editorial`), which is the proof that a kind of person is a pack, a cast and a row.
import '../parts/dwarf.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, SKIN_COLORS, HAIR_COLORS } from '../portrait.mjs';
import { rand } from '../rng.mjs';

const STEEL = '#8d939a', IRON = '#5f6670', LEATHER = '#5a3d2a', FUR = '#5a4634', WOOL = '#7a6a4a', MOSS = '#5b6b4a', OAK = '#6b4a33';
/** What they wear: mail under a fur mantle, leather with a cap, a plain wool tunic, a helm over mail. */
export const DWARF_COSTUMES = {
  mailAndMantle: (v) => ({ top: { style: 'mailShirt', color: v ? IRON : STEEL }, jacket: { style: 'furMantle', color: FUR }, pants: { style: 'trousers', color: '#3a2f26' } }),
  leatherAndCap: (v) => ({ top: { style: 'henley', color: v ? '#8b6b4a' : OAK }, jacket: { style: 'waistcoat', color: '#3b2a20' }, hat: { style: 'leatherCap', color: LEATHER, accent: '#3b2a20' }, pants: { style: 'trousers', color: '#2e2622' } }),
  plainTunic: (v) => ({ top: { style: 'tunic', color: v ? MOSS : WOOL }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#3a3128' } }),
  helmAndMail: () => ({ top: { style: 'mailShirt', color: STEEL }, jacket: { style: 'none' }, hat: { style: 'hornlessHelm', color: '#9aa0a6', accent: FUR }, pants: { style: 'trousers', color: '#2e2a26' } }),
};
Object.assign(COSTUMES, DWARF_COSTUMES);
export const DWARF_BUILD = buildOf('dwarf'); // the anatomy table in cast.mjs: four and a half foot, a human's head on it, very broad, the legs short and the arms long for the height
export const DWARF_EARS = [0, 0.2]; // a dwarf's ear is round, a few of them with the hint of a point: their own range, so a face that came from another cast is set back to it and not left with elf ears
const stout = (width, height, face = {}) => ({ face: { width, height, ...face }, neck: { width: 90, height: 44 } }); // every dwarf: a broad head on a short thick neck
/** The eight, by what tells them apart at a hundred pixels: the hair's mass or its absence, the beard's shape, the hat, the costume's colour block. */
export const DWARVES = {
  ironBrow: { family: 'heavyBrow', hair: 'sweptBack', hairColors: ['auburn', 'copper'], beard: 'braidedBeard', costume: 'mailAndMantle', marks: ['beadedBraids'], set: { ...stout(186, 196, { corner: 44, jaw: 0.82 }), eyes: { spacing: 46, depth: 1, browLift: -3 }, nose: { style: 'broad', width: 30, length: 38 }, mouth: { width: 46, fullness: 0.35 }, body: { width: 1.45 }, pose: { turn: 0.25, shoulder: 0.3 } } },
  oldForge: { family: 'squareJaw', hair: 'bald', hairColors: ['saltPepper'], beard: 'garibaldi', age: 'old', costume: 'leatherAndCap', set: { ...stout(190, 192, { corner: 46, jaw: 0.78 }), eyes: { spacing: 50, bags: 1, openness: 0.8 }, nose: { style: 'roundedTip', width: 30, length: 40 }, mouth: { style: 'wide', width: 50, fullness: 0.3 }, body: { width: 1.5 }, pose: { turn: -0.3, shoulder: -0.4, headTilt: 0.05 } } },
  redBraid: { family: 'roundSoft', hair: 'middlePart', hairColors: ['copper', 'auburn'], beard: 'forkedBeard', costume: 'plainTunic', marks: ['beadedBraids'], set: { ...stout(182, 190, { chin: 0.08, jaw: 0.92 }), eyes: { spacing: 58, openness: 1.05 }, nose: { style: 'short', width: 26, length: 32 }, mouth: { style: 'full', width: 46, fullness: 0.7 }, body: { width: 1.3 }, pose: { turn: 0.4, headTilt: 0.1 } } },
  stoutKeeper: { family: 'roundSoft', hair: 'receding', hairColors: ['chestnut'], beard: 'fullBeard', age: 'mid', costume: 'helmAndMail', set: { ...stout(192, 186, { chin: 0.02, jaw: 0.96 }), eyes: { spacing: 60, bags: 0.6 }, nose: { style: 'broad', width: 32, length: 34 }, mouth: { width: 48, fullness: 0.5 }, body: { width: 1.5 }, pose: { bodyTilt: 0.06, turn: -0.2 } } },
  youngSmith: { family: 'squareJaw', hair: 'crewCut', hairColors: ['chestnut', 'auburn'], beard: 'boxedBeard', costume: 'leatherAndCap', set: { ...stout(180, 198, { corner: 42 }), eyes: { spacing: 52, browLift: -2 }, nose: { style: 'straight', width: 24, length: 38 }, mouth: { width: 50, fullness: 0.4 }, body: { width: 1.3 }, pose: { turn: 0.5, shoulder: 0.6 } } },
  greyWarden: { family: 'heavyBrow', hair: 'ponytailLow', hairColors: ['white', 'saltPepper'], beard: 'ducktail', age: 'old', costume: 'mailAndMantle', set: { ...stout(184, 200, { corner: 44, jaw: 0.8 }), eyes: { style: 'hooded', spacing: 48, depth: 1, browLift: -4 }, nose: { style: 'aquiline', width: 26, length: 44 }, mouth: { style: 'thin', width: 44, fullness: 0.2 }, body: { width: 1.4 }, pose: { turn: -0.45, shoulder: 0.5, headTilt: -0.06 } } },
  broadMiner: { family: 'heavyBrow', hair: 'shortTextured', hairColors: ['darkBrown', 'chestnut'], beard: 'braidedBeard', costume: 'plainTunic', marks: ['beadedBraids'], set: { ...stout(192, 194, { corner: 48, jaw: 0.74 }), eyes: { style: 'narrow', spacing: 44, depth: 1, openness: 0.8 }, nose: { style: 'broad', width: 34, length: 36 }, mouth: { style: 'wide', width: 54, fullness: 0.3 }, body: { width: 1.5 }, pose: { turn: 0.3, shoulder: -0.5, bodyTilt: 0.04 } } },
  copperBard: { family: 'roundSoft', hair: 'wavyMedium', hairColors: ['copper'], beard: 'circleBeard', costume: 'helmAndMail', set: { ...stout(178, 192, { chin: 0.1, jaw: 0.9 }), eyes: { style: 'round', spacing: 56, openness: 1.1 }, nose: { style: 'upturned', width: 24, length: 30 }, mouth: { style: 'wide', width: 50, fullness: 0.6 }, body: { width: 1.28 }, pose: { headTilt: 0.14, turn: -0.35, bodyTilt: -0.05 } } },
};
const pickKeys = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
// the cast object (the shape cast.mjs's EDITORIAL documents): three of the editorial families, the editorial skins, the hair of the hills, the dwarf tops and the dwarf beards beside the everyday ones, a hat on most roles, the build
export default {
  name: 'dwarves', families: pickKeys(FAMILIES, ['heavyBrow', 'squareJaw', 'roundSoft']),
  skins: Object.values(SKIN_COLORS), hairColors: ['auburn', 'copper', 'chestnut', 'saltPepper', 'white'].map((k) => HAIR_COLORS[k]), clothes: [STEEL, IRON, LEATHER, FUR, WOOL, MOSS, OAK, '#3a2f26'],
  pools: { tops: parts('top', { any: ['only:dwarf'] }), jackets: parts('jacket', { any: ['only:dwarf', 'everyday'] }), beards: parts('facialHair', { any: ['only:dwarf', 'everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: parts('glasses', { all: ['everyday'] }), details: parts('details', { all: ['everyday'] }), graphics: parts('graphics', { all: ['everyday'] }) },
  wardrobe: { establish: ['none', 'leatherCap', 'none'], develop: ['leatherCap', 'hornlessHelm', 'none'], climax: ['hornlessHelm', 'hornlessHelm', 'leatherCap'], release: ['none', 'leatherCap'], none: ['none', 'leatherCap', 'hornlessHelm'] },
  archetypes: DWARVES, archetypeNames: Object.keys(DWARVES), costumes: Object.keys(DWARF_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: DWARF_BUILD, contrast: 1.6, asym: 1.4,
  base: (s) => ({ ears: { pointed: DWARF_EARS[0] + rand(s) * (DWARF_EARS[1] - DWARF_EARS[0]) } }), // the cast's signature as a rule: mostly round, now and then a little drawn out
  limits: { 'ears.pointed': [0, 0.15], 'nose.muzzle': [0, 0], 'build.legs': [0.55, 0.85], 'build.shoulders': [1.05, 1.35], 'build.head': [0.88, 1.08] }, // what a dwarf may not be: tall, long-legged, narrow or pointed of ear. The build bands are the table's row either side of DWARF_BUILD (groupsFor)
};
