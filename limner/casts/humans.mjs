// The humans cast: six of them, the ordinary people of the same world as the dwarves and the elves, so nothing is
// pinned far from the middle: every editorial family, every skin, the everyday hair and beards, and a build left at
// 'default'. What makes them this cast is only what they wear — the shared adventurer's kit (parts/fantasy.mjs) and
// nothing modern — which is the point: a cast with no part pack of its own, dressed entirely out of the shared one.
// They dance the tableau's own shots (lib/visual.json: dance `editorial`).
import '../parts/fantasy.mjs'; // the shared pack: every fantasy cast reaches it through its pools
import { COSTUMES, FAMILIES } from '../people.mjs';
import { parts, SKIN_COLORS, HAIR_COLORS } from '../portrait.mjs';

const BARK = '#4a3a2e', OLIVE = '#5e6342', MOSS = '#48553f', LINEN = '#b3a287', CLAY = '#9c6f4e', STONE = '#8d8f96', SLATE = '#54585f', DARK = '#2e2622';
/** What they wear: leather and a cloak on the road, homespun at home, a brimmed hat over leather, grey robes for an order. */
export const HUMAN_COSTUMES = {
  ranger: (v) => ({ top: { style: 'leatherJerkin', color: v ? OLIVE : BARK }, jacket: { style: 'hoodedCloak', color: MOSS }, pants: { style: 'trousers', color: '#3a3128' } }),
  villager: (v) => ({ top: { style: 'roughTunic', color: v ? LINEN : CLAY }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#4a3f33' } }),
  sellsword: () => ({ top: { style: 'leatherJerkin', color: BARK }, jacket: { style: 'none' }, hat: { style: 'feltTravelHat', color: DARK, accent: '#6b4a30' }, pants: { style: 'trousers', color: DARK } }),
  greyOrder: (v) => ({ top: { style: 'roughTunic', color: v ? STONE : SLATE }, jacket: { style: 'hoodedCloak', color: SLATE }, pants: { style: 'skirt', color: SLATE } }),
};
Object.assign(COSTUMES, HUMAN_COSTUMES);
/** The six, by the face's family, the hair's mass and the costume's colour block: nothing exaggerated, which is what a human is next to the other casts. */
export const HUMANS = {
  swordCaptain: { family: 'squareJaw', hair: 'crewCut', hairColors: ['darkBrown', 'softBlack'], beard: 'heavyStubble', costume: 'sellsword', set: { face: { width: 164, height: 206 }, eyes: { spacing: 52, browLift: -2 }, nose: { style: 'straight', width: 22, length: 40 }, mouth: { width: 50, fullness: 0.35 }, body: { width: 1.1 }, pose: { turn: 0.3, shoulder: 0.4 } } },
  hedgeWitch: { family: 'fineBoned', hair: 'longStraight', hairColors: ['auburn', 'chestnut'], costume: 'greyOrder', set: { face: { width: 152, height: 210 }, eyes: { style: 'almond', spacing: 56, openness: 1.05 }, nose: { style: 'narrow', width: 17, length: 40 }, mouth: { width: 42, fullness: 0.55 }, body: { width: 0.94 }, pose: { headTilt: 0.1, turn: -0.35 } } },
  roadWarden: { family: 'heavyBrow', hair: 'shortTextured', hairColors: ['jetBlack', 'espresso'], beard: 'shortBeard', costume: 'ranger', set: { face: { width: 170, height: 202 }, eyes: { style: 'hooded', spacing: 50, depth: 0.9, browLift: -3 }, nose: { style: 'broad', width: 26, length: 40 }, mouth: { width: 46, fullness: 0.4 }, body: { width: 1.14 }, pose: { turn: -0.4, shoulder: -0.4 } } },
  marketCarter: { family: 'roundSoft', hair: 'receding', hairColors: ['lightBrown', 'darkBlond'], beard: 'fullBeard', age: 'mid', costume: 'villager', set: { face: { width: 168, height: 198 }, eyes: { style: 'round', spacing: 58, bags: 0.6 }, nose: { style: 'roundedTip', width: 25, length: 36 }, mouth: { style: 'wide', width: 50, fullness: 0.55 }, body: { width: 1.22 }, pose: { bodyTilt: 0.05, turn: 0.2 } } },
  youngScribe: { family: 'longMidface', hair: 'middlePart', hairColors: ['brown', 'darkBrown'], glasses: 'round', costume: 'greyOrder', set: { face: { width: 150, height: 216 }, eyes: { spacing: 52, browLift: 2 }, nose: { style: 'long', width: 18, length: 46 }, mouth: { style: 'thin', width: 40, fullness: 0.3 }, body: { width: 0.9 }, pose: { turn: 0.45, headTilt: -0.05 } } },
  villageElder: { family: 'wideCheek', hair: 'lowBun', hairColors: ['gray', 'white'], age: 'old', costume: 'villager', set: { face: { width: 160, height: 200 }, eyes: { spacing: 58, bags: 1, openness: 0.85 }, nose: { style: 'short', width: 22, length: 34 }, mouth: { width: 44, fullness: 0.3 }, body: { width: 1 }, pose: { turn: -0.25, shoulder: 0.3, headTilt: 0.06 } } },
};
const pool = (kind, own) => parts(kind, { any: [own, 'era:fantasy'] }); // every fantasy cast picks from its own tag and the shared pack, never a registry
// the cast object (the shape people.mjs's EDITORIAL documents): all six families, every skin and hair colour, the shared tops and cloaks, the everyday beards and hair, a brimmed hat or none, the default build
export default {
  name: 'humans', families: FAMILIES,
  skins: Object.values(SKIN_COLORS), hairColors: Object.values(HAIR_COLORS), clothes: [BARK, OLIVE, MOSS, LINEN, CLAY, STONE, SLATE, DARK],
  pools: { tops: pool('top', 'only:human'), jackets: pool('jacket', 'only:human'), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: parts('glasses', { all: ['everyday'] }), details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { establish: ['none', 'none', 'feltTravelHat'], develop: ['none', 'feltTravelHat'], climax: ['feltTravelHat', 'none'], release: ['none'], none: ['none', 'feltTravelHat'] },
  archetypes: HUMANS, archetypeNames: Object.keys(HUMANS), costumes: Object.keys(HUMAN_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: 'default', contrast: 1.5, asym: 1.3,
  limits: { 'ears.pointed': [0, 0.15], 'nose.muzzle': [0, 0] }, // what a human may not be: a pointed ear or a muzzle. The editor's menus and sliders are narrowed to this (groupsFor)
};
