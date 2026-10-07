// The steampunks cast: seven Victorians with brass about them, built as a human is (`steampunkHuman` in ANATOMY).
// The steampunk pack (parts/steampunk.mjs) dresses them: a waistcoat in shirtsleeves or under a frock coat, a corset
// over a high-necked blouse, a high-collared military jacket with brass frogging, an aviator's leather coat with a
// fleece collar, a duster with a coachman's cape; a top hat with goggles strapped round its band, a bowler, an
// aviator's cap with its goggles pushed up, a small tilted lady's top hat; a monocle, brass goggles, a jeweller's
// loupe, goggles up on the forehead, a brass ear and a brass forearm. Each archetype is one silhouette and one or two
// memorable things. Everyday hair and the fuller beards; the colours are a gentleman's club's: oxblood, bottle green,
// tobacco, black, plum, with linen for the shirts and the dust coats.
import '../parts/steampunk.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, HAIR_COLORS } from '../portrait.mjs';

const OXBLOOD = '#6a2a2a', BOTTLE = '#2a4a3a', TOBACCO = '#6a4a2a', BLACK = '#1e1c1c', PLUM = '#4a2a4a', LINEN = '#e8dfcc', DUST = '#9a8466', BRASSY = '#c9a03c', NAVY = '#24304a', LEATHER = '#5a3a26';
/** What they wear. A waistcoat or corset with `vest` is worn in shirtsleeves: `color` is the shirt. */
export const STEAMPUNK_COSTUMES = {
  shirtsleeves: (v) => ({ top: { style: 'waistcoat', color: LINEN, vest: v ? TOBACCO : BOTTLE, cravat: v ? BOTTLE : OXBLOOD }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#2a2622' } }),
  frockAndWaistcoat: (v) => ({ top: { style: 'waistcoat', color: v ? TOBACCO : PLUM, cravat: v ? OXBLOOD : '#2a2a4a' }, jacket: { style: 'frockCoat', color: v ? BLACK : BOTTLE }, pants: { style: 'trousers', color: '#1e1c1c' } }),
  corsetAndBlouse: (v) => ({ top: { style: 'corset', color: v ? '#e8e0d4' : LINEN, vest: v ? PLUM : OXBLOOD }, jacket: { style: 'none' }, pants: { style: 'skirt', color: v ? PLUM : '#2a2226' } }),
  regimentals: (v) => ({ top: { style: 'militaryJacket', color: v ? OXBLOOD : NAVY, accent: BRASSY }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#1e1c1c' } }),
  flyingLeathers: (v) => ({ top: { style: 'waistcoat', color: LINEN, vest: BOTTLE, cravat: '#e8e0d4' }, jacket: { style: 'aviatorCoat', color: v ? '#3a2a20' : LEATHER, accent: '#e6dcc6' }, pants: { style: 'trousers', color: '#3a3026' } }),
  dusterAndCorset: (v) => ({ top: { style: 'corset', color: LINEN, vest: v ? BLACK : OXBLOOD }, jacket: { style: 'duster', color: v ? '#5a4a3a' : DUST }, pants: { style: 'trousers', color: '#2a2622' } }),
  mechanicsArm: (v) => ({ top: { style: 'waistcoat', color: v ? '#cfc4ae' : LINEN, vest: v ? '#3a3026' : TOBACCO, cravat: OXBLOOD }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#2a2622' }, props: ['brassArm'] }),
};
Object.assign(COSTUMES, STEAMPUNK_COSTUMES);
export const STEAMPUNK_BUILD = buildOf('steampunkHuman');
/** The seven, by silhouette and by what sits on the head and over the eye. */
export const STEAMPUNKS = {
  inventor: { family: 'longMidface', hair: 'wavyMedium', hairColors: ['chestnut', 'auburn'], beard: 'vanDyke', glasses: 'loupeGoggles', costume: 'shirtsleeves', set: { face: { width: 156, height: 212 }, eyes: { spacing: 54 }, nose: { style: 'aquiline', width: 19, length: 46 }, mouth: { width: 44, fullness: 0.4 }, body: { width: 0.96 }, pose: { turn: 0.3, headTilt: 0.05 } } },
  aeronaut: { family: 'fineBoned', hair: 'lowBun', hairColors: ['copper', 'darkBlond'], hat: { style: 'aviatorCap', color: '#5a3a26', accent: '#3a2a20' }, costume: 'flyingLeathers', set: { face: { width: 150, height: 206 }, eyes: { style: 'almond', spacing: 56 }, nose: { style: 'narrow', width: 16, length: 40 }, mouth: { style: 'cupidBow', width: 42, fullness: 0.6 }, body: { width: 0.9 }, pose: { turn: -0.35 } } },
  baron: { family: 'heavyBrow', hair: 'sweptBack', hairColors: ['saltPepper', 'silver'], beard: 'garibaldi', age: 'old', glasses: 'monocle', costume: 'regimentals', set: { face: { width: 172, height: 208, jaw: 0.82 }, eyes: { style: 'hooded', spacing: 50, bags: 0.6 }, nose: { style: 'roundedTip', width: 24, length: 44 }, mouth: { width: 48, fullness: 0.3 }, body: { width: 1.3 }, pose: { turn: 0.2, shoulder: 0.3 } } },
  mechanic: { family: 'wideCheek', hair: 'curlyMedium', hairColors: ['darkBrown', 'jetBlack'], beard: 'heavyStubble', accessories: ['foreheadGoggles'], costume: 'mechanicsArm', set: { face: { width: 168, height: 200 }, eyes: { spacing: 56 }, nose: { style: 'broad', width: 22, length: 38 }, mouth: { width: 50, fullness: 0.45 }, body: { width: 1.15 }, pose: { turn: -0.3, shoulder: -0.4 } } },
  dowager: { family: 'roundSoft', hair: 'lowBun', hairColors: ['white', 'silver'], age: 'old', accessories: ['brassEar'], hat: { style: 'ladyTopHat', color: PLUM, accent: OXBLOOD }, costume: 'corsetAndBlouse', set: { face: { width: 158, height: 204 }, eyes: { style: 'downturned', spacing: 54, bags: 0.5 }, nose: { style: 'straight', width: 19, length: 42 }, mouth: { style: 'thin', width: 42, fullness: 0.35 }, body: { width: 1.05 }, pose: { turn: 0.4, headTilt: -0.06 } } },
  dandy: { family: 'squareJaw', hair: 'sidePart', hairColors: ['jetBlack', 'darkBrown'], beard: 'pencilStache', hat: { style: 'bowler', color: BLACK, accent: '#2a2a2a' }, costume: 'frockAndWaistcoat', set: { face: { width: 160, height: 210 }, eyes: { style: 'narrow', spacing: 54, browLift: 2 }, nose: { style: 'straight', width: 18, length: 44 }, mouth: { width: 44, fullness: 0.35 }, body: { width: 1 }, pose: { turn: -0.2, headTilt: 0.04 } } },
  corsair: { family: 'fineBoned', hair: 'wavyMedium', hairColors: ['jetBlack', 'auburn'], hat: { style: 'topHatGoggles', color: '#2a2422', accent: OXBLOOD }, costume: 'dusterAndCorset', set: { face: { width: 148, height: 210 }, eyes: { style: 'upturned', spacing: 56, browLift: -2 }, nose: { style: 'narrow', width: 16, length: 42 }, mouth: { style: 'full', width: 42, fullness: 0.6 }, body: { width: 0.92 }, pose: { turn: 0.35, shoulder: 0.4 } } },
};
const own = (kind) => parts(kind, { any: ['only:steampunk'] });
export default {
  name: 'steampunks', families: FAMILIES,
  skins: [], hairColors: ['jetBlack', 'darkBrown', 'chestnut', 'auburn', 'copper', 'saltPepper', 'silver', 'white'].map((k) => HAIR_COLORS[k]), irises: ['#3a2a22', '#4a6a5a', '#5a7a8a'], clothes: [OXBLOOD, BOTTLE, TOBACCO, BLACK, PLUM, NAVY, DUST],
  pools: { tops: own('top'), jackets: own('jacket'), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: own('glasses'), accessories: ['studEarringLeft', 'studEarringRight', 'hoopLeft', 'hoopRight', 'foreheadGoggles', 'brassEar'], details: [], graphics: [] },
  wardrobe: { establish: ['bowler', 'none', 'none'], develop: ['aviatorCap', 'bowler', 'none'], climax: ['topHatGoggles', 'ladyTopHat', 'bowler'], release: ['none'], none: ['none', 'topHatGoggles', 'bowler', 'aviatorCap'] },
  archetypes: STEAMPUNKS, archetypeNames: Object.keys(STEAMPUNKS), costumes: Object.keys(STEAMPUNK_COSTUMES), build: STEAMPUNK_BUILD, contrast: 1.6, asym: 1.1,
};
