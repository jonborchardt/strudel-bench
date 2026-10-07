// The cyborgs cast: six people with machine fitted into them, a touch broader and heavier-handed than a human
// (`cyborg` in ANATOMY). The machine is the cyborg pack (parts/cyborg.mjs), worn, and each of them carries a different
// share of it, one or two systems and never all of them: light traced under one cheek and an ear gone to a receiver; a
// visor and a jack in the temple; an eye and a jaw; a plated hand raised; a whole arm; half a face. A random one in a
// crowd draws its own degree of machine from the same stream (`base`), so the street is as mixed as the archetypes.
import '../parts/cyborg.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, HAIR_COLORS } from '../portrait.mjs';
import { rand } from '../rng.mjs';

const GUNMETAL = '#4a5058', CHROME = '#8a9099', BLACK = '#1c1e22', RED = '#8a2a2a', TEAL = '#2f6a70', OLIVE = '#4e5440';
/** What they wear: the chassis bare, the chassis under a street jacket, street clothes over the machine, and the street with a machine hand raised. */
export const CYBORG_COSTUMES = {
  chassisBare: (v) => ({ top: { style: 'chassis', color: v ? CHROME : GUNMETAL, accent: v ? '#e0262c' : '#6fe0ff' }, jacket: { style: 'none' }, pants: { style: 'trousers', color: BLACK } }),
  chassisCoat: (v) => ({ top: { style: 'chassis', color: GUNMETAL }, jacket: { style: v ? 'trenchCoat' : 'leatherJacket', color: BLACK }, pants: { style: 'trousers', color: BLACK } }),
  streetChrome: (v) => ({ top: { style: v ? 'hoodieBig' : 'heavyweightTshirt', color: v ? TEAL : BLACK }, jacket: { style: v ? 'none' : 'bomber', color: RED }, pants: { style: 'trousers', color: '#22242a' } }),
  machineHand: (v) => ({ top: { style: v ? 'turtleneck' : 'crewSweater', color: v ? BLACK : '#55606c' }, jacket: { style: 'none' }, pants: { style: 'trousers', color: BLACK }, props: ['mechHand'] }),
  machineArm: (v) => ({ top: { style: v ? 'heavyweightTshirt' : 'henley', color: v ? OLIVE : '#2a2c30' }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#22242a' }, props: ['mechArm'] }),
};
Object.assign(COSTUMES, CYBORG_COSTUMES);
export const CYBORG_BUILD = buildOf('cyborg');
/** The six, from least machine to most. */
export const CYBORGS = {
  tracer: { family: 'fineBoned', hair: 'shortMohawk', hairColors: ['platinum', 'white'], costume: 'streetChrome', makeup: ['circuitLines', 'earReceiver'], set: { face: { width: 150, height: 206 }, eyes: { style: 'upturned', spacing: 56, iris: '#6fe0ff' }, nose: { style: 'narrow', width: 16, length: 40 }, mouth: { width: 42, fullness: 0.5 }, body: { width: 0.9 }, pose: { turn: -0.35, headTilt: 0.08 } } },
  netrunner: { family: 'longMidface', hair: 'sweptBack', hairColors: ['jetBlack', 'softBlack'], glasses: 'visorBar', costume: 'streetChrome', makeup: ['templePort'], set: { face: { width: 148, height: 214 }, eyes: { style: 'monolid', spacing: 54 }, nose: { style: 'straight', width: 16, length: 42 }, mouth: { style: 'thin', width: 40, fullness: 0.35 }, body: { width: 0.88 }, pose: { turn: 0.3 } } },
  medic: { family: 'roundSoft', hair: 'lowBun', hairColors: ['chestnut', 'darkBrown'], glasses: 'lensRig', costume: 'machineHand', makeup: [], set: { face: { width: 160, height: 202 }, eyes: { style: 'almond', spacing: 56, openness: 1.05 }, nose: { style: 'roundedTip', width: 19, length: 38 }, mouth: { style: 'full', width: 44, fullness: 0.6 }, body: { width: 1 }, pose: { turn: -0.25, headTilt: -0.05 } } },
  enforcer: { family: 'squareJaw', hair: 'buzz', hairColors: ['jetBlack'], costume: 'chassisCoat', makeup: ['ocularImplant', 'jawPlate'], set: { face: { width: 178, height: 200, corner: 46, jaw: 0.8 }, eyes: { style: 'narrow', spacing: 48, depth: 0.9, browLift: -3 }, nose: { style: 'broad', width: 26, length: 40 }, mouth: { style: 'wide', width: 52, fullness: 0.3 }, body: { width: 1.35 }, pose: { turn: 0.3, shoulder: 0.5 } } },
  stevedore: { family: 'heavyBrow', hair: 'crewCut', hairColors: ['darkBrown', 'softBlack'], beard: 'heavyStubble', costume: 'machineArm', makeup: ['neckCabling', 'browPlate'], set: { face: { width: 170, height: 202, jaw: 0.86 }, eyes: { style: 'hooded', spacing: 50, depth: 0.85 }, nose: { style: 'broad', width: 24, length: 40 }, mouth: { style: 'wide', width: 50, fullness: 0.35 }, body: { width: 1.3 }, pose: { turn: 0.2, shoulder: -0.4 } } },
  rebuilt: { family: 'heavyBrow', hair: 'bald', hairColors: ['gray'], age: 'mid', costume: 'chassisBare', makeup: ['halfPlate', 'ocularImplant'], set: { face: { width: 172, height: 204, jaw: 0.84 }, eyes: { style: 'hooded', spacing: 50, depth: 1 }, nose: { style: 'aquiline', width: 22, length: 44 }, mouth: { width: 48, fullness: 0.3 }, body: { width: 1.25 }, pose: { turn: -0.25, shoulder: -0.4 } } },
};
/** A random one's machine, one or two systems: the share of each is the odds a street of them shows. */
const DEGREES = [['circuitLines'], ['circuitLines'], ['circuitLines', 'earReceiver'], ['earReceiver'], ['templePort'], ['ocularImplant'], ['jawPlate'], ['neckCabling'], ['neckCabling', 'circuitLines'], ['ocularImplant', 'halfPlate']];
const pool = (kind) => parts(kind, { any: ['only:cyborg', 'everyday'] }); // the chassis beside street clothes
export default {
  name: 'cyborgs', families: FAMILIES,
  skins: [], hairColors: ['jetBlack', 'softBlack', 'platinum', 'white', 'gray', 'darkBrown'].map((k) => HAIR_COLORS[k]), irises: ['#3a2a22', '#5a7a8a', '#4a3a2e', '#6a8a7a', '#6fe0ff'], clothes: [GUNMETAL, CHROME, BLACK, RED, TEAL, OLIVE],
  pools: { tops: pool('top'), jackets: parts('jacket', { all: ['everyday'] }), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: parts('glasses', { all: ['only:cyborg'] }), details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { establish: ['none'], develop: ['none'], climax: ['none'], release: ['none'], none: ['none'] },
  archetypes: CYBORGS, archetypeNames: Object.keys(CYBORGS), costumes: Object.keys(CYBORG_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: CYBORG_BUILD, contrast: 1.6, asym: 1.1,
  // every random one carries some machine, drawn from the stream (an archetype's own makeup is its home styling, so for them this is only a draw)
  base: (s) => { const deg = DEGREES[Math.floor(rand(s) * DEGREES.length)], arm = rand(s) < 0.2; return { makeup: deg, props: arm ? ['mechArm'] : [], build: CYBORG_BUILD }; },
};
