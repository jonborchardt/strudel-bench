// The scifi cast: a starship's crew, five of them, built as a human is (`scifiHuman` in ANATOMY solves to all 1s).
// They wear the sci-fi pack (parts/scifi.mjs) and nothing else, and each reads by silhouette before colour: the
// captain's long coat closed on the diagonal, the pilot's orange pressure suit with its neck ring and helmet, the
// science officer's HUD visor, the engineer's padded armour with a lit power cell, the navigator's open shell jacket
// with lit piping and a temple implant. One memorable thing per face. Everyday hair and beards; the crowd draws the
// same tops and outer layers, a helmet now and then, the visor as its glasses and the implant on about one in six.
import '../parts/scifi.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, HAIR_COLORS } from '../portrait.mjs';
import { rand } from '../rng.mjs';

const NAVY = '#1f2d4a', SLATE = '#4a5566', COMMAND = '#a8323a', SCIENCE = '#2f7a8a', ENGINE = '#c08a2a', WHITE = '#d9dde2', ORANGE = '#d2652a', GUNMETAL = '#3b4048', COAT = '#1b1e26';
/** What they wear, by department: the flight suit, the bridge tunic, the shell jacket over a suit, the command coat over the tunic, the pressure suit and helmet, padded armour over a suit. */
export const SCIFI_COSTUMES = {
  flightCrew: (v) => ({ top: { style: 'crewSuit', color: v ? SLATE : NAVY, accent: WHITE }, jacket: { style: 'none' }, pants: { style: 'trousers', color: v ? SLATE : NAVY } }),
  bridgeUniform: (v) => ({ top: { style: 'uniformTunic', color: [COMMAND, SCIENCE, ENGINE][v % 3], accent: '#e9c46a' }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#1a1c22' } }),
  shellCrew: (v) => ({ top: { style: 'crewSuit', color: v ? '#2b2f36' : SLATE, accent: v ? ENGINE : SCIENCE }, jacket: { style: 'shellJacket', color: v ? '#3a4250' : NAVY, accent: v ? '#ffc45a' : '#7fe3ff' }, pants: { style: 'trousers', color: '#22262e' } }),
  commandCoat: (v) => ({ top: { style: 'uniformTunic', color: v ? SCIENCE : COMMAND, accent: '#e9c46a' }, jacket: { style: 'commandCoat', color: v ? '#2a2630' : COAT, accent: '#e9c46a' }, pants: { style: 'trousers', color: COAT } }),
  pressureSuit: (v) => ({ top: { style: 'pressureSuit', color: v ? '#c9ccd0' : ORANGE, accent: '#2a2d33' }, jacket: { style: 'none' }, pants: { style: 'trousers', color: v ? '#c9ccd0' : ORANGE }, hat: { style: 'flightHelmet', color: v ? '#e3e5e8' : '#d9dce0', accent: v ? NAVY : COMMAND } }),
  armoured: (v) => ({ top: { style: 'crewSuit', color: '#2b2f36', accent: WHITE }, jacket: { style: 'padArmour', color: v ? '#4a4438' : GUNMETAL, accent: v ? '#7fe3ff' : '#ffc45a' }, pants: { style: 'trousers', color: '#22262e' } }),
};
Object.assign(COSTUMES, SCIFI_COSTUMES);
export const SCIFI_BUILD = buildOf('scifiHuman');
/** The five, by department and by what each one's silhouette carries. */
export const SCIFI = {
  captain: { family: 'squareJaw', hair: 'crewCut', hairColors: ['saltPepper', 'gray'], age: 'mid', costume: 'commandCoat', set: { face: { width: 168, height: 206 }, eyes: { style: 'hooded', spacing: 50, depth: 0.8, browLift: -2 }, nose: { style: 'straight', width: 22, length: 40 }, mouth: { width: 50, fullness: 0.35 }, body: { width: 1.1 }, pose: { turn: 0.2, shoulder: 0.3 } } },
  pilot: { family: 'fineBoned', hair: 'pixie', hairColors: ['jetBlack', 'platinum'], costume: 'pressureSuit', set: { face: { width: 150, height: 208 }, eyes: { style: 'almond', spacing: 56 }, nose: { style: 'narrow', width: 16, length: 40 }, mouth: { width: 42, fullness: 0.55 }, body: { width: 0.9 }, pose: { turn: -0.4, headTilt: 0.06 } } },
  scienceOfficer: { family: 'longMidface', hair: 'sweptBack', hairColors: ['darkBrown', 'softBlack'], glasses: 'visorBand', costume: 'bridgeUniform', set: { face: { width: 150, height: 218 }, eyes: { style: 'narrow', spacing: 52, browLift: 2 }, nose: { style: 'long', width: 17, length: 46 }, mouth: { style: 'thin', width: 40, fullness: 0.3 }, body: { width: 0.92 }, pose: { turn: 0.4 } } },
  engineer: { family: 'wideCheek', hair: 'curlyMedium', hairColors: ['auburn', 'copper'], beard: 'heavyStubble', accessories: ['commLink'], costume: 'armoured', set: { face: { width: 172, height: 200 }, eyes: { spacing: 56 }, nose: { style: 'broad', width: 24, length: 38 }, mouth: { width: 50, fullness: 0.45 }, body: { width: 1.2 }, pose: { turn: -0.3, shoulder: -0.5 } } },
  navigator: { family: 'roundSoft', hair: 'boxBraids', hairColors: ['jetBlack'], makeup: 'templeLight', costume: 'shellCrew', set: { face: { width: 158, height: 204 }, eyes: { style: 'round', spacing: 58, openness: 1.08 }, nose: { style: 'roundedTip', width: 20, length: 38 }, mouth: { style: 'full', width: 44, fullness: 0.7 }, body: { width: 0.96 }, pose: { turn: 0.35, headTilt: -0.06 } } },
};
const own = (kind) => parts(kind, { any: ['only:scifi'] }); // its own pack alone: a crew in a t-shirt is off duty
export default {
  name: 'scifi', families: FAMILIES,
  skins: [], hairColors: ['jetBlack', 'softBlack', 'darkBrown', 'auburn', 'blond', 'platinum', 'saltPepper'].map((k) => HAIR_COLORS[k]), irises: ['#5a7a8a', '#3a2a22', '#4a6a4a', '#7a8a9a'], clothes: [NAVY, SLATE, COMMAND, SCIENCE, ENGINE, GUNMETAL],
  pools: { tops: own('top'), jackets: own('jacket'), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: own('glasses'), details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { establish: ['none'], develop: ['none'], climax: ['none', 'flightHelmet'], release: ['none'], none: ['none', 'none', 'none', 'flightHelmet'] }, // a helmet on one in four of a crowd, half of them at the climax
  archetypes: SCIFI, archetypeNames: Object.keys(SCIFI), costumes: Object.keys(SCIFI_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: SCIFI_BUILD, contrast: 1.4, asym: 1,
  base: (s) => (rand(s) < 0.16 ? { makeup: ['templeLight'] } : {}), // the implant on about one in six; an archetype's own makeup is its home styling, so this reaches the crowd alone
};
