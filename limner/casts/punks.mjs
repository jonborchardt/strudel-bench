// The punks cast: five of them, built as a human is. The punk pack (parts/punk.mjs) dresses them: liberty spikes, a
// tall mohawk fin and a bleached chelsea, all dyed over grown-out roots; a studded perfecto, a band tee with its collar
// cut off and rips the skin shows through, a tartan shirt; a dog collar, a padlock on a chain, a bullet belt; safety
// pins, rings and tunnels in the ears, rings through the nose; heavy liner. Each is remembered by the hair and one or
// two things more, in black, tartan red and bleach. A random one of them is drawn from the same wardrobe.
import '../parts/punk.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf, pickIn } from '../people.mjs';
import { parts, HAIR_COLORS } from '../portrait.mjs';
import { rand } from '../rng.mjs';

const BLACK = '#18171a', TARTAN = '#a82a2a', BLEACH = '#d9d4c8', DENIM = '#3a4a6a', OLIVE = '#4a4a32', BOTTLE = '#2a4a32', YELLOW = '#e0c040';
const DYES = ['#e0368a', '#2ec46a', '#2a6ae0', '#f0d020', '#e04a1a', '#e8e0c4']; // magenta, green, blue, yellow, orange, bleach
/** What they wear: the studded perfecto over the ripped tee, the tee alone, the tartan shirt (under the perfecto, or alone), a denim jacket over the tee. */
export const PUNK_COSTUMES = {
  studded: (v) => ({ top: { style: 'rippedBandTee', color: v ? BLEACH : BLACK, accent: v ? BLACK : BLEACH }, jacket: { style: 'studdedLeather', color: BLACK }, pants: { style: 'trousers', color: v ? TARTAN : BLACK } }),
  teeOnly: (v) => ({ top: { style: 'rippedBandTee', color: v ? TARTAN : BLACK, accent: BLEACH }, jacket: { style: 'none' }, pants: { style: 'trousers', color: BLACK } }),
  tartan: (v) => ({ top: { style: 'tartanShirt', color: v ? BOTTLE : TARTAN, accent: YELLOW }, jacket: v ? { style: 'studdedLeather', color: BLACK } : { style: 'none' }, pants: { style: 'trousers', color: BLACK } }),
  denimVest: (v) => ({ top: { style: 'rippedBandTee', color: BLACK, accent: v ? TARTAN : BLEACH }, jacket: { style: 'denimJacket', color: v ? DENIM : OLIVE }, pants: { style: 'trousers', color: BLACK } }),
};
Object.assign(COSTUMES, PUNK_COSTUMES);
/** The five. Each names its own hardware in `set.accessories`, since the cast's signature (below) would otherwise hand them a random one. */
export const PUNKS = {
  spikes: { family: 'fineBoned', hair: 'libertySpikes', costume: 'studded', makeup: ['punkLiner'], marks: ['punkNostril'], set: { hairColor: DYES[1], accessories: ['safetyPinEar'], face: { width: 150, height: 208 }, eyes: { style: 'almond', spacing: 54 }, nose: { style: 'narrow', width: 16, length: 40 }, mouth: { width: 42, fullness: 0.5, color: '#2a1a24' }, body: { width: 0.88 }, pose: { turn: -0.3, headTilt: 0.08 } } },
  frontman: { family: 'longMidface', hair: 'mohawkFin', costume: 'teeOnly', makeup: ['punkLiner'], marks: ['bandolier', 'punkSeptum'], set: { hairColor: DYES[0], accessories: [], face: { width: 152, height: 214 }, eyes: { style: 'narrow', spacing: 52, browLift: -2 }, nose: { style: 'aquiline', width: 18, length: 46 }, mouth: { style: 'wide', width: 48, fullness: 0.35 }, body: { width: 0.92 }, pose: { turn: 0.35, shoulder: 0.4 } } },
  bassist: { family: 'squareJaw', hair: 'leopardCrop', beard: 'heavyStubble', costume: 'tartan', marks: ['padlockChain'], set: { hairColor: '#d8c890', accessories: ['lobeTunnels'], face: { width: 172, height: 202, corner: 44 }, eyes: { spacing: 50, depth: 0.9 }, nose: { style: 'broad', width: 24, length: 40 }, mouth: { width: 50, fullness: 0.35 }, body: { width: 1.2 }, pose: { turn: 0.2 } } },
  drummer: { family: 'roundSoft', hair: 'chelsea', costume: 'teeOnly', makeup: ['punkLiner'], marks: ['studCollar'], set: { hairColor: DYES[5], accessories: ['helixRings'], face: { width: 160, height: 202 }, eyes: { style: 'round', spacing: 58 }, nose: { style: 'upturned', width: 18, length: 36 }, mouth: { width: 44, fullness: 0.55 }, body: { width: 0.98 }, pose: { turn: -0.4, headTilt: -0.06 } } },
  oldGuard: { family: 'heavyBrow', hair: 'libertySpikes', age: 'mid', costume: 'studded', marks: ['studCollar', 'punkSeptum'], set: { hairColor: DYES[3], accessories: ['lobeTunnels'], face: { width: 168, height: 206 }, eyes: { style: 'hooded', spacing: 50, bags: 0.6 }, nose: { style: 'roundedTip', width: 22, length: 42 }, mouth: { style: 'thin', width: 46, fullness: 0.25 }, body: { width: 1.1 }, pose: { turn: 0.3, shoulder: -0.3 } } },
};
const OUTFITS = [['studded', 0], ['studded', 1], ['teeOnly', 0], ['teeOnly', 1], ['tartan', 0], ['tartan', 1], ['denimVest', 0]];
const BODY = [[], [], ['studCollar'], ['padlockChain'], ['bandolier'], ['punkSeptum'], ['punkNostril'], ['studCollar', 'punkNostril']];
const EARS = [[], ['safetyPinEar'], ['helixRings'], ['lobeTunnels']];
const NATURAL = ['#1c1714', '#2e221a', '#3e2c20', '#5a3e2a']; // the colour the hair grows: a beard is never dyed with the head
/** A random one of them: an outfit from the wardrobe, liner on most, and one or two pieces of hardware, drawn from the person's own stream. An archetype's costume, makeup and marks replace these; its `set.accessories` replaces the ears. */
const signature = (s) => { const [costume, v] = pickIn(s, OUTFITS), liner = rand(s) < 0.7, marks = pickIn(s, BODY), accessories = pickIn(s, EARS), beard = pickIn(s, NATURAL), { top, jacket, pants } = COSTUMES[costume](v);
  return { top, jacket, pants, makeup: liner ? ['punkLiner'] : [], marks, accessories, facialHair: { color: beard }, eyes: { browColor: beard } }; }; // the brows the hair grew, not the dye
export default {
  name: 'punks', families: FAMILIES,
  skins: [], hairColors: [...DYES, HAIR_COLORS.jetBlack], irises: ['#3a2a22', '#4a5a6a', '#5a6a4a'], clothes: [BLACK, TARTAN, BLEACH, DENIM, OLIVE],
  pools: { tops: parts('top', { any: ['only:punk'] }), jackets: ['studdedLeather', 'denimJacket', 'leatherJacket'], beards: parts('facialHair', { all: ['everyday'] }), hair: ['libertySpikes', 'mohawkFin', 'chelsea', 'leopardCrop', 'libertySpikes', 'mohawkFin'], glasses: [], details: [], graphics: [] },
  wardrobe: { none: ['none'] }, // every role
  archetypes: PUNKS, archetypeNames: Object.keys(PUNKS), costumes: Object.keys(PUNK_COSTUMES), build: buildOf('human'), contrast: 1.7, asym: 1.2,
  base: signature,
};
