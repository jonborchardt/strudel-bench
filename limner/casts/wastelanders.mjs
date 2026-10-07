// The wastelanders cast: five survivors after the end, built as a human is but a little leaner in the shoulder
// (`postApocalypticHuman` in ANATOMY), sun-darkened. The wasteland pack (parts/wasteland.mjs) dresses them: grime on
// everyone and sun on most, then one or two things to remember each by -- a soot band across the eyes and a tyre for a
// pauldron, a bandaged head over a stitched scar, a salvaged helmet over welding goggles and a road sign for a
// breastplate, a respirator under dust goggles, a shemagh with goggles pushed up on it over a goggle tan -- in rags,
// wraps and whatever everyday clothes survived, patched and dirty, in dust, rust and oil.
import '../parts/wasteland.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf, pickIn } from '../people.mjs';
import { parts, HAIR_COLORS } from '../portrait.mjs';

const DUST = '#9a8466', RUST = '#8a4a2a', OIL = '#2e2a26', KHAKI = '#6e6448', LEATHER = '#4a3527', OLIVE = '#5e6248', BLEACH = '#b3a684';
/** What they wear: rags under the tyre-shouldered vest, rags alone, a surviving field jacket, a road sign strapped over a shirt, a shemagh over rags. */
export const WASTELAND_COSTUMES = {
  raider: (v) => ({ top: { style: 'ragWrap', color: v ? RUST : DUST }, jacket: { style: 'spikedVest', color: LEATHER }, props: ['tyrePauldronLeft'], pants: { style: 'trousers', color: OIL } }),
  rags: (v) => ({ top: { style: 'ragWrap', color: v ? KHAKI : DUST }, jacket: { style: 'none' }, pants: { style: 'trousers', color: v ? OIL : KHAKI } }),
  scavenger: (v) => ({ top: { style: v ? 'henley' : 'heavyweightTshirt', color: v ? DUST : KHAKI }, jacket: { style: 'fieldJacket', color: v ? KHAKI : OLIVE }, pants: { style: 'trousers', color: OIL } }),
  plated: (v) => ({ top: { style: v ? 'henley' : 'heavyweightTshirt', color: v ? KHAKI : OIL }, jacket: { style: 'scrapArmor', color: LEATHER }, props: ['tyrePauldronRight'], pants: { style: 'trousers', color: OIL } }),
  nomad: (v) => ({ top: { style: 'ragWrap', color: v ? KHAKI : BLEACH }, jacket: { style: 'none' }, hat: { style: 'shemagh', color: v ? DUST : BLEACH, accent: RUST }, pants: { style: 'trousers', color: KHAKI } }),
};
Object.assign(COSTUMES, WASTELAND_COSTUMES);
export const WASTELAND_BUILD = buildOf('postApocalypticHuman');
const HELMET = { style: 'scrapHelmet', color: OLIVE, accent: RUST };
/** The five, each remembered by one or two things: what is over the eyes, the head, or the shoulder. */
export const WASTELANDERS = {
  roadWarrior: { family: 'squareJaw', hair: 'shortMohawk', hairColors: ['jetBlack'], beard: 'heavyStubble', costume: 'raider', makeup: ['sunweathered', 'grime', 'sootBand'], marks: ['clothGrime'], set: { face: { width: 172, height: 202, corner: 44 }, eyes: { style: 'narrow', spacing: 50, depth: 0.9, browLift: -3 }, nose: { style: 'broad', width: 24, length: 40 }, mouth: { width: 50, fullness: 0.3 }, body: { width: 1.2 }, pose: { turn: 0.3, shoulder: 0.5 } } },
  scrapper: { family: 'fineBoned', hair: 'pixie', hairColors: ['copper', 'auburn'], costume: 'scavenger', makeup: ['grime', 'scarStitched', 'headBandage'], marks: ['patched'], set: { face: { width: 150, height: 206 }, eyes: { style: 'upturned', spacing: 56 }, nose: { style: 'upturned', width: 17, length: 38 }, mouth: { width: 42, fullness: 0.5 }, body: { width: 0.88 }, pose: { turn: -0.35, headTilt: 0.08 } } },
  welder: { family: 'heavyBrow', hair: 'buzz', hairColors: ['gray', 'saltPepper'], beard: 'shortBeard', age: 'mid', glasses: 'weldingGoggles', hat: HELMET, costume: 'plated', makeup: ['sunweathered', 'grime'], marks: ['clothGrime'], set: { face: { width: 176, height: 204, jaw: 0.84 }, eyes: { style: 'hooded', spacing: 50 }, nose: { style: 'roundedTip', width: 24, length: 42 }, mouth: { width: 50, fullness: 0.3 }, body: { width: 1.25 }, pose: { turn: 0.2 } } },
  breather: { family: 'longMidface', hair: 'longStraight', hairColors: ['darkBrown', 'softBlack'], glasses: 'dustGoggles', costume: 'rags', makeup: ['grime', 'respirator'], marks: ['patched', 'clothGrime'], set: { face: { width: 152, height: 214 }, eyes: { style: 'almond', spacing: 54 }, nose: { style: 'long', width: 17, length: 44 }, mouth: { width: 42, fullness: 0.4 }, body: { width: 0.94 }, pose: { turn: -0.4 } } },
  elderScout: { family: 'wideCheek', hair: 'receding', hairColors: ['white', 'gray'], beard: 'fullBeard', age: 'old', costume: 'nomad', makeup: ['sunweathered', 'goggleTan', 'grime', 'browGoggles'], set: { face: { width: 168, height: 204 }, eyes: { style: 'downturned', spacing: 54, bags: 0.8 }, nose: { style: 'aquiline', width: 22, length: 44 }, mouth: { width: 46, fullness: 0.3 }, body: { width: 1.05 }, pose: { turn: 0.35, headTilt: -0.05 } } },
};
const pool = (kind) => parts(kind, { any: ['only:wasteland', 'everyday'] }); // the pack beside what survived
/** What a random one of them carries: grime always, then the sun or one mark of the road, and dirt or patches on the clothes. Drawn from the person's own stream. */
const FACE_MARKS = [['sunweathered'], ['sunweathered'], ['sunweathered', 'goggleTan'], ['sootBand'], ['fingerStripes'], ['scarStitched'], ['sunweathered', 'fingerStripes']];
const CLOTH_MARKS = [['clothGrime'], ['patched'], ['clothGrime', 'patched'], []];
const TROUSERS = [OIL, KHAKI, LEATHER, OLIVE, '#3e3a32'];
const signature = (s) => { const a = pickIn(s, FACE_MARKS), b = pickIn(s, CLOTH_MARKS), t = pickIn(s, TROUSERS);
  return { makeup: [...a.filter((n) => n === 'sunweathered' || n === 'goggleTan'), 'grime', ...a.filter((n) => n !== 'sunweathered' && n !== 'goggleTan')], marks: b, pants: { style: 'trousers', color: t } }; }; // the sun and the tan under the dirt, paint and soot over it; trousers in the road's colours (a crowd's otherwise follow the hair, and a white-haired one would wear white)
const HEADS = ['none', 'none', 'none', 'shemagh', 'shemagh', 'scrapHelmet']; // a crowd's heads: mostly bare, a wrap, now and then a helmet
export default {
  name: 'wastelanders', families: FAMILIES,
  skins: ['#d29a74', '#c98f68', '#b9845e', '#b77a55', '#a86a48', '#9a5f40', '#87543a', '#7c4e36', '#6e4430', '#57372a'], // every one of them sun-darkened: no pale skin survives out there
  hairColors: ['jetBlack', 'softBlack', 'darkBrown', 'copper', 'gray', 'white', 'saltPepper'].map((k) => HAIR_COLORS[k]), irises: ['#3a2a22', '#5a6a4a', '#6a7a8a'], clothes: [DUST, RUST, OIL, KHAKI, LEATHER, OLIVE, BLEACH],
  pools: { tops: pool('top'), jackets: pool('jacket'), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: parts('glasses', { any: ['only:wasteland'], not: ['workshop'] }), details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { none: HEADS }, // every role
  archetypes: WASTELANDERS, archetypeNames: Object.keys(WASTELANDERS), costumes: Object.keys(WASTELAND_COSTUMES), build: WASTELAND_BUILD, contrast: 1.8, asym: 1.3,
  base: signature,
};
