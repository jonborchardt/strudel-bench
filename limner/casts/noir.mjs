// The noir cast: a 1940s city at night, five of them, built as a human is. The noir pack (parts/noir.mjs) dresses them
// (the fedora, the patrolman's cap, the pinstripe, the trench with its collar up, the gown and the stole, the
// cigarette) and lights them: every one of them wears the pack's key (`noirKey`: half the face in hard shadow, the
// brim's shadow over the eyes, a rim of street light on the dark jaw). The grade is not a part: every one of them
// carries `LOOKS.noir` from people.mjs (the colour graded nearly to grey, the planes deepened) as the cast's
// signature, the same look any other cast can be dressed in for a section (`dress(idn, { lighting: 'noir' })`).
import '../parts/noir.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, LOOKS, buildOf } from '../people.mjs';
import { parts, HAIR_COLORS } from '../portrait.mjs';

const CHARCOAL = '#2e2c2a', CAMEL = '#9a8262', NAVY = '#1f2533', CREAM = '#e4ddcf', WINE = '#5a1a22', DOVE = '#b8b2a8', BLACK = '#141414';
/** What they wear: the pinstripe and its hat, the trench and its hat over a shirt and a loosened tie, the patrol
 *  uniform, a rumpled jacket, the gown under the stole. */
export const NOIR_COSTUMES = {
  suitAndHat: (v) => ({ top: { style: 'noirDoubleBreasted', color: v ? CHARCOAL : NAVY, accent: v ? WINE : CREAM }, jacket: { style: 'none' }, pants: { style: 'trousers', color: v ? CHARCOAL : NAVY }, hat: { style: 'fedora', color: v ? CHARCOAL : DOVE, accent: BLACK } }), // the pale hat and the pale tie over the dark stripe: the man who owns the club
  trench: (v) => ({ top: { style: 'buttonDown', color: CREAM, accent: v ? NAVY : WINE }, jacket: { style: 'noirTrench', color: v ? CHARCOAL : CAMEL }, pants: { style: 'trousers', color: CHARCOAL }, props: ['noirCollarUp'], accessories: ['noirLooseTie'], hat: { style: 'fedora', color: v ? BLACK : '#4a4640', accent: BLACK } }),
  patrol: (v) => ({ top: { style: 'noirTunic', color: v ? CHARCOAL : NAVY }, jacket: { style: 'none' }, pants: { style: 'trousers', color: NAVY }, hat: { style: 'noirCap', color: v ? CHARCOAL : NAVY, accent: BLACK } }),
  rumpled: (v) => ({ top: { style: 'buttonDown', color: v ? CREAM : '#d8d0c0', accent: '#3a3030' }, jacket: { style: 'blazer', color: v ? '#5a5650' : '#6a6050' }, pants: { style: 'trousers', color: CHARCOAL }, accessories: ['noirLooseTie'] }),
  evening: (v) => ({ top: { style: 'noirGown', color: v ? WINE : BLACK }, jacket: { style: 'none' }, pants: { style: 'skirt', color: v ? WINE : BLACK }, props: ['noirStole', 'gloves'], accessories: ['noirPearls'] }),
};
Object.assign(COSTUMES, NOIR_COSTUMES);
/** The five. */
export const NOIRS = {
  detective: { family: 'squareJaw', hair: 'sidePart', hairColors: ['darkBrown'], beard: 'lightStubble', age: 'mid', costume: 'trench', makeup: ['noirKey', 'cigarette'], set: { face: { width: 166, height: 206 }, eyes: { style: 'hooded', spacing: 50, depth: 0.9, browLift: -2, bags: 0.6 }, nose: { style: 'straight', width: 22, length: 42 }, mouth: { width: 48, fullness: 0.3 }, body: { width: 1.1 }, pose: { turn: 0.3, headTilt: -0.05 } } },
  femmeFatale: { family: 'fineBoned', hair: 'wavyMedium', hairColors: ['jetBlack'], hat: { style: 'noirVeil', color: '#141414', accent: '#141414' }, costume: 'evening', makeup: ['noirEyeLight'], set: { face: { width: 150, height: 208, chin: 0.26 }, eyes: { style: 'upturned', spacing: 56, openness: 0.86 }, nose: { style: 'narrow', width: 16, length: 40 }, mouth: { style: 'cupidBow', width: 42, fullness: 0.75, color: '#4a1a1a' }, body: { width: 0.86 }, pose: { turn: -0.4, headTilt: 0.08 } } },
  gangster: { family: 'heavyBrow', hair: 'sweptBack', hairColors: ['jetBlack'], costume: 'suitAndHat', makeup: ['noirKey'], set: { face: { width: 176, height: 204, jaw: 0.84 }, eyes: { style: 'narrow', spacing: 48, depth: 1, browLift: -3 }, nose: { style: 'broad', width: 26, length: 42 }, mouth: { style: 'wide', width: 52, fullness: 0.3 }, body: { width: 1.25 }, pose: { turn: 0.2, shoulder: 0.4 } } },
  beatCop: { family: 'wideCheek', hair: 'crewCut', hairColors: ['chestnut'], beard: 'mustache', costume: 'patrol', makeup: ['noirKey'], set: { face: { width: 170, height: 202 }, eyes: { spacing: 54 }, nose: { style: 'roundedTip', width: 22, length: 40 }, mouth: { width: 48, fullness: 0.4 }, body: { width: 1.15 }, pose: { turn: -0.25 } } },
  informant: { family: 'longMidface', hair: 'combOver', hairColors: ['gray'], age: 'old', hat: { style: 'flatCap', color: '#5a5650', accent: '#3a3836' }, costume: 'rumpled', makeup: ['noirKey', 'noirBlinds', 'cigarette'], set: { face: { width: 150, height: 214 }, eyes: { style: 'downturned', spacing: 52, bags: 0.8 }, nose: { style: 'long', width: 18, length: 48 }, mouth: { style: 'thin', width: 40, fullness: 0.25 }, body: { width: 0.9 }, pose: { turn: 0.45, headTilt: 0.08, shoulder: -0.4 } } },
};
export default {
  name: 'noir', families: FAMILIES,
  skins: [], hairColors: ['jetBlack', 'softBlack', 'darkBrown', 'chestnut', 'platinum', 'gray'].map((k) => HAIR_COLORS[k]), irises: ['#3a2a22', '#4a5a6a'], clothes: [CHARCOAL, CAMEL, NAVY, CREAM, WINE, DOVE],
  pools: { tops: ['noirDoubleBreasted', 'buttonDown', 'turtleneck'], jackets: ['noirTrench', 'blazer'], beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: [], accessories: ['studEarringLeft', 'studEarringRight', 'noirPearls'], details: [], graphics: [] },
  wardrobe: { establish: ['fedora', 'none'], develop: ['none', 'fedora'], climax: ['fedora', 'noirCap'], release: ['none'], none: ['fedora', 'none'] },
  archetypes: NOIRS, archetypeNames: Object.keys(NOIRS), costumes: Object.keys(NOIR_COSTUMES), build: buildOf('human'), contrast: 2, asym: 1.1,
  base: { ...LOOKS.noir, makeup: ['noirKey'] }, // the look and the key, on every one of them (a dressed archetype wears its own makeup list, which carries the key)
};
