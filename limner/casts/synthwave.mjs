// The synthwave cast: neon nightlife, five of them, built as a human is. One club: every one of them stands in the
// same two lights, magenta from the left and cyan from the right (`neonKey`, the cast's signature and on every
// archetype), in dark clothes the lights pick out. The synthwave pack (parts/synthwave.mjs) dresses them -- mirrored
// shades and a wrap visor with a sunset in them, neon liner, a holographic lid, chrome drops, black vinyl, a mesh top,
// a padded jacket with lit piping -- beside the eighties pack's mullet, big hair, headband and aerobics (`era:80s`).
// Each archetype carries one or two things worth remembering, and no more.
import '../parts/synthwave.mjs'; // the parts this cast is made of register by name
import '../parts/eighties.mjs';
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, HAIR_COLORS } from '../portrait.mjs';
import { rand } from '../rng.mjs';

const MAGENTA = '#ff2fa8', CYAN = '#2fe6ff', VIOLET = '#4a2a7a', BLACK = '#141218', CHROME = '#c9ccd6', VINYL = '#17141c';
/** What they wear: dark cloth, so the lights do the colouring. */
export const SYNTHWAVE_COSTUMES = {
  neonNight: (v) => ({ top: { style: 'neonMesh', color: v ? MAGENTA : VIOLET }, jacket: { style: 'neonPaddedJacket', color: BLACK, accent: v ? CYAN : MAGENTA }, pants: { style: 'trousers', color: BLACK } }),
  meshOnly: (v) => ({ top: { style: 'neonMesh', color: v ? CYAN : BLACK }, jacket: { style: 'none' }, pants: { style: 'trousers', color: v ? VIOLET : BLACK } }),
  chromeJacket: (v) => ({ top: { style: 'crewTshirt', color: BLACK }, jacket: { style: 'neonPaddedJacket', color: v ? VIOLET : CHROME, accent: MAGENTA, metal: v ? 0 : 1 }, pants: { style: 'trousers', color: BLACK } }),
  vinylNight: (v) => ({ top: { style: v ? 'vneckTshirt' : 'crewTshirt', color: v ? MAGENTA : BLACK }, jacket: { style: 'vinylJacket', color: VINYL }, pants: { style: 'trousers', color: BLACK } }),
  aerobics: (v) => ({ top: { style: v ? 'leotard' : 'offShoulderSweat', color: v ? BLACK : VIOLET, accent: CYAN }, jacket: { style: 'none' }, pants: { style: 'trousers', color: BLACK } }),
};
Object.assign(COSTUMES, SYNTHWAVE_COSTUMES);
const KEY = ['neonKey'];
/** The five: a driver in the sunset shades, a diva in glitter and chrome, a DJ under the visor, a runner in a headband, a kid in a chrome jacket. */
export const SYNTHS = {
  driver: { family: 'squareJaw', hair: 'mullet', hairColors: ['darkBlond'], glasses: 'mirrorShades', costume: 'vinylNight', makeup: KEY, set: { face: { width: 166, height: 206 }, eyes: { spacing: 52 }, nose: { style: 'straight', width: 22, length: 40 }, mouth: { width: 48, fullness: 0.35, skew: 0.5 }, body: { width: 1.12 }, pose: { turn: 0.25, headTilt: -0.04 } } },
  diva: { family: 'fineBoned', hair: 'bigHair', hairColors: ['platinum'], accessories: ['chromeDrops'], costume: 'neonNight', makeup: [...KEY, 'holoGlitter', 'neonLiner'], set: { face: { width: 150, height: 208 }, eyes: { style: 'upturned', spacing: 56, openness: 0.82 }, nose: { style: 'narrow', width: 16, length: 40 }, mouth: { style: 'full', width: 44, fullness: 0.8, color: '#d01f78' }, body: { width: 0.88 }, pose: { turn: -0.35, headTilt: 0.1 } } },
  dj: { family: 'roundSoft', hair: 'shortMohawk', glasses: 'wrapVisor', accessories: ['overEarHeadphones'], costume: 'meshOnly', makeup: KEY, set: { hairColor: MAGENTA, face: { width: 160, height: 204 }, eyes: { spacing: 56 }, nose: { style: 'roundedTip', width: 20, length: 38 }, mouth: { width: 46, fullness: 0.5 }, body: { width: 1.04 }, pose: { turn: 0.3, headTilt: -0.08 } } },
  runner: { family: 'longMidface', hair: 'bluntBob', hairColors: ['jetBlack'], hat: { style: 'headband', color: CYAN, accent: MAGENTA }, costume: 'aerobics', makeup: [...KEY, 'neonLiner'], set: { face: { width: 148, height: 214 }, eyes: { style: 'monolid', spacing: 54 }, nose: { style: 'straight', width: 16, length: 42 }, mouth: { style: 'thin', width: 40, fullness: 0.4 }, body: { width: 0.9 }, pose: { turn: -0.4, shoulder: 0.4 } } },
  arcadeKid: { family: 'wideCheek', hair: 'curlyMedium', hairColors: ['auburn'], costume: 'chromeJacket', makeup: KEY, set: { details: ['frecklesMedium'], face: { width: 164, height: 196 }, eyes: { style: 'round', spacing: 58, openness: 1.1 }, nose: { style: 'upturned', width: 19, length: 34 }, mouth: { width: 44, fullness: 0.5 }, body: { width: 0.96 }, pose: { turn: 0.4, headTilt: 0.06 } } },
};
const pool = (kind) => parts(kind, { any: ['only:synthwave'] });
const NIGHT_HATS = ['none', 'none', 'none', 'none', 'headband'];
/** Everyone in the club stands in its light; some have done their eyes for it. One draw. */
const NATURAL = ['#1c1714', '#2e221a', '#3e2c20', '#5a3e2a']; // the colour hair grows: a dyed head keeps the brows and the beard it grew
const base = (s) => { const r = rand(s), grown = NATURAL[Math.floor(rand(s) * NATURAL.length)]; return { makeup: r < 0.25 ? [...KEY, 'neonLiner'] : r < 0.4 ? [...KEY, 'holoGlitter'] : KEY, facialHair: { color: grown }, eyes: { browColor: grown } }; };
export default {
  name: 'synthwave', families: FAMILIES,
  skins: [], hairColors: ['jetBlack', 'platinum', 'darkBlond', 'auburn'].map((k) => HAIR_COLORS[k]).concat(['#c0287f', '#2a8ad0']), irises: ['#3a2a22', '#4a6a8a', '#5a4a7a'], clothes: [BLACK, VINYL, VIOLET, BLACK, '#9a1f68', '#1d7f99'],
  // a club, not a costume drawer: the pack's own clothes, the eighties pieces that go out at night, and plain dark tees under them
  pools: { tops: [...pool('top'), 'leotard', 'offShoulderSweat', 'crewTshirt', 'vneckTshirt'], jackets: [...pool('jacket'), 'padShoulderBlazer', 'redLeatherChevron', 'leatherJacket'], beards: parts('facialHair', { all: ['everyday'] }), hair: [...parts('hair', { any: ['era:80s'] }), 'shortMohawk', 'bluntBob', 'pixie', 'sweptBack', 'crewCut'], glasses: parts('glasses', { any: ['only:synthwave'] }), details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { establish: NIGHT_HATS, develop: NIGHT_HATS, climax: NIGHT_HATS, release: NIGHT_HATS, none: NIGHT_HATS },
  archetypes: SYNTHS, archetypeNames: Object.keys(SYNTHS), costumes: Object.keys(SYNTHWAVE_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: buildOf('synthwaveHuman'), contrast: 1.6, asym: 1,
  base, // every one of them under the club's light
};
