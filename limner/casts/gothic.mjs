// The gothic cast: mourning clothes and night, in two kinds that share the wardrobe and differ in the face. A mortal goth
// is pale, dark-lipped and lined. A vampire reads at a glance and is still not one of the undead: a colder pallor
// (violet in the sockets and down the shadow side, `vampirePallor`), red irises lit from inside (`vampireEyes`), the
// temples gone back to a widow's peak, and the fangs (`vampireFangs`, a TEETH entry, so they show only when the mouth
// parts, their tips over the lower lip from `fangTips`). A crowd mixes the two (`base` draws the kind), one in three a
// vampire. Built as a human is. The gothic pack (parts/gothic.mjs) dresses them, in black, oxblood, ivory and silver.
import '../parts/gothic.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, HAIR_COLORS } from '../portrait.mjs';
import { rand } from '../rng.mjs';

const BLACK = '#1a1718', OXBLOOD = '#5a1622', IVORY = '#e9e2d6', PLUM = '#3a1f30', ASH = '#4a4448', VIOLET = '#2a1a3a';
/** What they wear: lace under velvet, lace under the cape, a gown under the cape, and widow's weeds. */
export const GOTHIC_COSTUMES = {
  laceAndVelvet: (v) => ({ top: { style: 'laceHighCollar', color: v ? BLACK : IVORY, accent: OXBLOOD }, jacket: { style: 'velvetFrock', color: v ? OXBLOOD : PLUM }, pants: { style: 'trousers', color: BLACK }, accessories: ['cravatPin'] }),
  bloodVelvet: (v) => ({ top: { style: 'laceHighCollar', color: v ? IVORY : BLACK, accent: v ? BLACK : '#8a1424' }, jacket: { style: 'velvetFrock', color: v ? BLACK : OXBLOOD }, pants: { style: 'trousers', color: BLACK } }),
  caped: (v) => ({ top: { style: 'laceHighCollar', color: BLACK, accent: v ? VIOLET : OXBLOOD }, jacket: { style: 'highCollarCape', color: BLACK, accent: v ? '#3a2458' : '#6a1424' }, pants: { style: 'trousers', color: BLACK }, accessories: ['cravatPin'] }),
  regal: (v) => ({ top: { style: 'mourningGown', color: v ? BLACK : OXBLOOD }, jacket: { style: 'highCollarCape', color: BLACK, accent: v ? OXBLOOD : '#2a1418' }, pants: { style: 'skirt', color: BLACK }, accessories: ['velvetChoker'] }),
  mourning: (v) => ({ top: { style: 'mourningGown', color: v ? ASH : BLACK }, jacket: { style: 'none' }, pants: { style: 'skirt', color: BLACK }, hat: { style: 'mourningHat', color: '#141214', accent: v ? PLUM : '#241c22' }, accessories: ['velvetChoker'] }),
};
Object.assign(COSTUMES, GOTHIC_COSTUMES);
/** The two kinds, as portrait keys over the person. */
export const KINDS = {
  mortal: { mouth: { color: '#3a1a24' }, eyes: { bags: 0.3 } },
  vampire: { mouth: { color: '#4a0c18', teeth: 'vampireFangs' }, eyes: { iris: '#c8202e', white: '#f2eaea', depth: 0.85 }, hair: { recession: 0.55 } },
};
/** What each kind wears on the face. */
export const KIND_MAKEUP = { mortal: ['gothLiner'], vampire: ['vampirePallor', 'gothLiner', 'vampireEyes', 'fangTips'] };
const PALE = ['#efe6e0', '#e6dcd6', '#d9cfc8', '#c9b8ae', '#b89c8a', '#8a6a5a'], COLD = ['#ece9ee', '#e2dee6', '#d6d0dc', '#c4bccc'];
/** The five: two mortals, three vampires. */
export const GOTHS = {
  mourner: { family: 'fineBoned', hair: 'longStraight', hairColors: ['jetBlack'], costume: 'mourning', makeup: KIND_MAKEUP.mortal, set: { ...KINDS.mortal, skin: PALE[0], face: { width: 148, height: 212 }, eyes: { ...KINDS.mortal.eyes, style: 'almond', spacing: 54 }, nose: { style: 'narrow', width: 16, length: 42 }, mouth: { ...KINDS.mortal.mouth, style: 'cupidBow', width: 40, fullness: 0.65 }, body: { width: 0.88 }, pose: { turn: -0.3, headTilt: 0.06 } } },
  poet: { family: 'longMidface', hair: 'wavyMedium', hairColors: ['softBlack'], costume: 'laceAndVelvet', makeup: KIND_MAKEUP.mortal, set: { ...KINDS.mortal, skin: PALE[2], face: { width: 152, height: 216 }, eyes: { ...KINDS.mortal.eyes, style: 'hooded', spacing: 52 }, nose: { style: 'long', width: 17, length: 46 }, mouth: { ...KINDS.mortal.mouth, style: 'thin', width: 42, fullness: 0.35 }, body: { width: 0.9 }, pose: { turn: 0.35 } } },
  count: { family: 'squareJaw', hair: 'widowsPeak', hairColors: ['jetBlack', 'silver'], age: 'mid', costume: 'caped', makeup: KIND_MAKEUP.vampire, set: { ...KINDS.vampire, skin: COLD[1], face: { width: 162, height: 214, jaw: 0.8 }, eyes: { ...KINDS.vampire.eyes, style: 'narrow', spacing: 50, browLift: -2 }, nose: { style: 'aquiline', width: 20, length: 46 }, mouth: { ...KINDS.vampire.mouth, width: 46, fullness: 0.3 }, body: { width: 1.05 }, pose: { turn: 0.25, shoulder: 0.3 } } },
  countess: { family: 'fineBoned', hair: 'highBun', hairColors: ['jetBlack', 'auburn'], costume: 'regal', makeup: [...KIND_MAKEUP.vampire, 'bloodTrickle'], set: { ...KINDS.vampire, skin: COLD[0], face: { width: 150, height: 210, chin: 0.26 }, eyes: { ...KINDS.vampire.eyes, style: 'upturned', spacing: 56 }, nose: { style: 'narrow', width: 16, length: 42 }, mouth: { ...KINDS.vampire.mouth, style: 'full', width: 42, fullness: 0.7 }, body: { width: 0.88 }, pose: { turn: -0.35, headTilt: -0.06 } } },
  fledgling: { family: 'roundSoft', hair: 'bluntBob', hairColors: ['platinum', 'jetBlack'], costume: 'bloodVelvet', makeup: KIND_MAKEUP.vampire, set: { ...KINDS.vampire, skin: COLD[2], face: { width: 156, height: 204 }, eyes: { ...KINDS.vampire.eyes, style: 'round', spacing: 58, openness: 1.08 }, nose: { style: 'upturned', width: 17, length: 38 }, mouth: { ...KINDS.vampire.mouth, width: 42, fullness: 0.55 }, body: { width: 0.92 }, pose: { turn: 0.4, headTilt: 0.08 } } },
};
/** A random one in a crowd: two in three mortal, one in three a vampire, whose skin is drawn from the cold tones. */
const base = (s) => { const kind = rand(s) < 0.34 ? 'vampire' : 'mortal', sk = rand(s); return { ...KINDS[kind], eyes: { ...KINDS[kind].eyes }, makeup: KIND_MAKEUP[kind], ...(kind === 'vampire' ? { skin: COLD[Math.floor(sk * COLD.length)] } : {}) }; };
const own = (kind) => parts(kind, { any: ['only:gothic'] });
export default {
  name: 'gothic', families: FAMILIES,
  skins: PALE, hairColors: ['jetBlack', 'softBlack', 'auburn', 'platinum', 'silver', 'white'].map((k) => HAIR_COLORS[k]), irises: ['#3a2a22', '#4a5a6a', '#2a2a2a'], clothes: [BLACK, OXBLOOD, IVORY, PLUM, ASH],
  pools: { tops: own('top'), jackets: own('jacket'), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: [], accessories: ['studEarringLeft', 'studEarringRight', 'hoopLeft', 'hoopRight', 'earCuffLeft', 'earCuffRight', 'velvetChoker'], details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { establish: ['none'], develop: ['none', 'mourningHat'], climax: ['none'], release: ['none', 'mourningHat'], none: ['none'] },
  archetypes: GOTHS, archetypeNames: Object.keys(GOTHS), costumes: Object.keys(GOTHIC_COSTUMES), build: buildOf('human'), contrast: 1.7, asym: 1,
  base,
};
