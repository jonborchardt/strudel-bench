// The character generators every world shares, over portrait.mjs. `characterOf(s, role, energy)` is a random
// character from the state's seeded generator (faces: a new one on every cut). `identityOf(s, archetype, id)` is a
// stable person: the base a portrait keeps across scenes (skin, face, features, hair, beard, glasses, build) plus a
// home styling (costume, makeup, marks, prop) the archetype suggests; `dress(identity, styling)` puts a shot's
// styling on that base (a COSTUMES family, makeup, marks, props, a hat, an expression, a pose) and returns what
// portraitOps takes, so the same face is recognisable in every outfit. All randomness is rand(s) on the caller's state.
import { clamp, lerp, rand } from './kit.mjs';
import { SKIN_COLORS, HAIR_COLORS, EYE_COLORS, CLOTHING_COLORS, FACE_SHAPES, NECK_TYPES, EYE_STYLES, BROW_STYLES, NOSE_STYLES, MOUTH_STYLES, HAIR_STYLES, HAIR, LONG_HAIR, DETAIL_STYLES, shade, merge, parts } from './portrait.mjs';

// the hats a section role wears: bare or a beanie to establish, a cap or a brim to develop, everyone hatted at the climax
const WARDROBE = { establish: ['none', 'beanie', 'baseballCap', 'none', 'cuffedBeanie'], develop: ['dadCap', 'flatCap', 'bucketHat', 'none', 'fishermanBeanie', 'snapback', 'beret'], climax: ['wideBrimFelt', 'cowboy', 'sunHat', 'snapback', 'truckerCap', 'bucketHat'], release: ['none', 'sunHat', 'beanie', 'none', 'bucketHat'], none: ['none', 'beanie', 'baseballCap', 'dadCap', 'flatCap', 'wideBrimFelt', 'bucketHat'] };
const vals = (o) => Object.values(o);
const SKINS = vals(SKIN_COLORS), HAIRS = vals(HAIR_COLORS), IRIS = vals(EYE_COLORS), CLOTHES = vals(CLOTHING_COLORS), NECKS = vals(NECK_TYPES);
const BEARDS = parts('facialHair', { all: ['everyday'] }), JACKETS = parts('jacket', { all: ['everyday'] });
const PLAIN_TOPS = parts('top', { all: ['everyday'] }); // the everyday tops a random character wears
const notLong = (shape, styles) => (shape === FACE_SHAPES.longOval ? styles.filter((h) => !LONG_HAIR.includes(h)) : styles), pickFrom = (a, t) => a[Math.floor(t * a.length)]; // long hair never on a long oval head
const ONE_SIDED = ['studEarringLeft', 'studEarringRight', 'hoopLeft', 'hoopRight', 'studRowLeft', 'studRowRight', 'earCuffLeft', 'earCuffRight'], EXTRAS = ['earbuds', 'overEarHeadphones'];

/** The structural families a face is built from, each one dominant characteristic (a heavy brow with deep eyes and a broad nose; a long midface with a narrow jaw and thin lips; wide cheekbones with a short nose and a small chin; a square jaw with low brows and a wide mouth; fine bones; soft and round) with the ranges the seed perturbs inside. Every part at random gives generic people; a family gives an identity. */
export const FAMILIES = {
  heavyBrow: { faces: ['square', 'broad', 'softSquare'], brows: ['thickStraight', 'angled', 'tapered'], browLift: [-2.5, 0.5], eyes: ['hooded', 'narrow', 'downturned'], depth: [0.75, 1], noses: ['broad', 'roundedTip', 'aquiline'], noseW: [22, 28], noseL: [36, 44], mouthW: [40, 50], full: [0.25, 0.5] },
  longMidface: { faces: ['longOval', 'narrow', 'diamond'], brows: ['thin', 'highArch', 'softArch'], browLift: [1, 4], eyes: ['almond', 'narrow', 'monolid'], depth: [0.3, 0.6], noses: ['long', 'narrow', 'aquiline'], noseW: [15, 20], noseL: [42, 48], mouthW: [36, 44], full: [0.15, 0.35], mouths: ['thin', 'plain'] },
  wideCheek: { faces: ['heart', 'diamond', 'round'], brows: ['softArch', 'straight'], eyes: ['almond', 'upturned', 'round'], spacing: [54, 62], depth: [0.35, 0.65], noses: ['short', 'upturned', 'roundedTip'], noseL: [30, 36], mouthW: [40, 48], full: [0.35, 0.6] },
  squareJaw: { faces: ['square', 'softSquare', 'broad'], brows: ['straight', 'thickStraight'], browLift: [-3, 0], eyes: ['narrow', 'hooded', 'almond'], depth: [0.5, 0.85], noses: ['straight', 'broad'], mouthW: [50, 58], full: [0.3, 0.55], mouths: ['wide', 'plain'] },
  fineBoned: { faces: ['oval', 'heart', 'narrow'], brows: ['thin', 'highArch'], browLift: [1, 3], eyes: ['round', 'almond', 'upturned'], depth: [0.2, 0.45], sclera: [0.55, 0.85], noses: ['narrow', 'straight', 'upturned'], noseW: [14, 18], mouthW: [38, 46], full: [0.4, 0.7] },
  roundSoft: { faces: ['round', 'softSquare', 'oval'], brows: ['softArch', 'thin'], eyes: ['round', 'hooded', 'downturned'], depth: [0.2, 0.5], bags: [0.2, 0.6], noses: ['roundedTip', 'short', 'broad'], mouthW: [40, 48], full: [0.45, 0.7], mouths: ['full', 'plain'] },
};
export const FAMILY_NAMES = Object.keys(FAMILIES);
const between = (s, [lo, hi]) => lo + rand(s) * (hi - lo);
/** The structure of a face from a family, perturbed by the seed: the shape, the eyes, the nose, the mouth, and three or four coherent asymmetries tied to one side (the fuller cheek's jaw corner is the softer one, the eye over it a little lower, the chin toward it, a temple wider). `a` (an archetype) overrides the family's lists. */
export function faceOf(s, fam, a = {}) {
  const f = FAMILIES[fam] ?? FAMILIES.fineBoned, r = () => rand(s), j = (k) => 1 + (r() - 0.5) * k, sd = r() < 0.5 ? -1 : 1;
  const shape = FACE_SHAPES[choose(s, a.faces ?? f.faces, Object.keys(FACE_SHAPES))];
  // the features are tied to each other, not placed each on its own: the eyes sit in the face's width, the nose's wings and the mouth's corners follow the eyes (wings inside the inner corners, corners under the pupils), and the mouth sits a lip's height under the nose tip wherever the nose ends, so a face is one face and not parts
  const width = shape.width * j(0.08), height = shape.height * j(0.06), spacing = (f.spacing ? between(s, f.spacing) : 52) * (width / 156) * j(0.1), k = spacing / 52;
  const eyeY = 190 + r() * 10, noseL = between(s, f.noseL ?? [32, 44]), lip = LIP_GAP[0] + r() * (LIP_GAP[1] - LIP_GAP[0]);
  return {
    shape,
    face: { width, height, jaw: clamp(shape.jaw * j(0.1), 0.55, 1), chin: shape.chin, corner: shape.corner ?? 32, skew: (r() - 0.5) * 0.6, fullness: (r() - 0.5) * 1.1, asym: { cheek: sd * (0.4 + r() * 0.6), jaw: -sd * (0.3 + r() * 0.7), temple: (r() < 0.5 ? sd : -sd) * r(), chin: sd * r() * 0.6 } }, // fullness: how much weight this one carries, apart from the skull the shape gives it
    eyes: { y: eyeY, spacing, openness: 0.85 + r() * 0.3, asym: 0.92 + r() * 0.16, dy: sd * (0.5 + r() * 2.5), depth: between(s, f.depth ?? [0.3, 0.7]), sclera: f.sclera ? between(s, f.sclera) : null, bags: f.bags ? between(s, f.bags) : r() < 0.55 ? 0.15 + r() * 0.6 : 0, squint: r() < 0.4 ? r() * 0.45 : 0, style: choose(s, a.eyes ?? f.eyes, EYE_STYLES), iris: IRIS[Math.floor(r() * IRIS.length)], browStyle: choose(s, a.brows ?? f.brows, BROW_STYLES), browLift: between(s, f.browLift ?? [0, 3]), browSkew: (r() - 0.5) * 0.2 },
    nose: { style: choose(s, a.nose ?? f.noses, NOSE_STYLES), width: between(s, f.noseW ?? [16, 24]) * k, length: noseL },
    mouth: { style: choose(s, a.mouth ?? f.mouths ?? MOUTH_STYLES.filter((m) => m !== 'asym'), MOUTH_STYLES), y: eyeY + 10 + noseL + lip, width: between(s, f.mouthW ?? [40, 52]) * k, fullness: between(s, f.full ?? [0.3, 0.7]) },
  };
}
export const LIP_GAP = [12, 17]; // the upper lip: how far the mouth sits under the nose tip (sheet units on the 204 head)
const lightOf = (s, amount) => ({ side: rand(s) < 0.5 ? -1 : 1, amount }); // the soft light on a face: how strong, and which side its shadows fall away from
/** A resting stance (the crowd's): the head tilts and slides a little toward one side and the shoulder on that side drops, the body leans back the other way by less, and the head turns off the torso on its own. One direction ties them, so the figure stands rather than being assembled; `STANCE` is how far it goes. */
const stanceOf = (s) => { const r = () => rand(s), d = r() < 0.5 ? -1 : 1, lean = (0.3 + r() * 0.7) * STANCE; return { headX: d * 4 * lean, headY: (r() - 0.5) * 8, headTilt: d * 0.08 * lean, bodyX: 0, bodyTilt: -d * 0.03 * lean, turn: (r() - 0.5) * 0.9, shoulder: d * 0.5 * lean }; };
export const STANCE = 1; // the crowd's stance amplitude: 0 is a passport photo, 1 the resting lean, more is theatrical

/** A new character from the state's generator: a face from one structural family (FAMILIES), hair and wardrobe from the part library, the role picking the hat, the energy the smile; one memorable thing per face (a detail, an earring or a chain, glasses, or a beard), never every detail system at once; a resting pose of its own. */
export function characterOf(s, role = 'none', energy = 0.5) {
  const r = () => rand(s), pick = (a) => a[Math.floor(r() * a.length)], hats = WARDROBE[role] ?? WARDROBE.none;
  const { shape, face, eyes, nose, mouth } = faceOf(s, pick(FAMILY_NAMES)), hair = pick(HAIRS), hat = pick(hats), hairStyle = pick(notLong(shape, hat === 'none' ? parts('hair', { all: ['everyday'] }) : parts('hair', { all: ['everyday'] }).filter((s) => s !== 'highBun')));
  const beard = r() < 0.35 && !LONG_HAIR.includes(hairStyle), sig = beard ? pick(['none', 'none', 'accessory', 'glasses']) : pick(['detail', 'detail', 'accessory', 'glasses', 'none']); // no beard under a bob or long hair
  return {
    skin: pick(SKINS), hairColor: hair,
    face, ears: { size: 0.85 + r() * 0.3 }, eyes, nose, mouth: { ...mouth, smile: lerp(-0.15, 0.45, energy) },
    hair: { style: hairStyle, hairline: (r() - 0.5) * 0.7, recession: r() < 0.25 ? r() * 0.5 : 0 }, // where this one's hair sits on the forehead, and the quarter of them whose temples have gone back
    // a beard is a style and then how much of it there is: the density and the cheek line are what separate two men
    // with the same beard, and a beard is often a shade off the hair, so the dials are drawn here and not left at their defaults
    facialHair: beard
      ? { style: pick(BEARDS), density: 0.3 + r() * 0.7, cheekLine: 0.2 + r() * 0.7, color: r() < 0.35 ? shade(hair, 0.85 + r() * 0.5) : null, mustache: r() < 0.25 ? r() < 0.5 : null }
      : { style: 'none' },
    hat: { style: hat, color: pick(CLOTHES), accent: shade(pick(CLOTHES), 0.75) },
    top: { style: pick(PLAIN_TOPS), color: pick(CLOTHES), ...(r() < 0.25 ? { graphic: pick(parts('graphics', { all: ['everyday'] })), graphicScale: 0.65 + r() * 0.8, graphicY: (r() - 0.5) * 50 } : {}) }, // a quarter of them wear something printed, at their own size and height on the chest
    jacket: r() < 0.35 ? { style: pick(JACKETS), color: pick(CLOTHES) } : { style: 'none' },
    pants: { style: 'trousers', color: shade(hair, 1.6) }, // dark trousers off the hair's tone: no draw from the generator, so every seeded face stays the face it was
    glasses: sig === 'glasses' ? { style: pick(parts('glasses', { all: ['everyday'] })), color: pick(['#2b2927', '#211f1e', '#5c5a57', '#6b4a3a']) } : null,
    accessories: sig === 'accessory' ? [pick([...ONE_SIDED, ...EXTRAS])] : [], details: sig === 'detail' ? [pick(parts('details', { all: ['everyday'] }))] : [],
    cheeks: r() < 0.35 ? 0 : 0.3 + r() * 0.7, // how much this face colours: a third not at all (the faces world's key)
    blush: r() < 0.45 ? 0 : 0.2 + r() * 0.7, // and the portrait's own: colour in the cheeks on rather more than half of them
    light: lightOf(s, 0.55 + r() * 0.3), // one lighting language across a crowd: every face modelled, none flat, none harsh
    neck: { ...pick(NECKS) },
    pose: { ...stanceOf(s), gaze: r() < 0.5 ? 'camera' : null }, // how this person holds themself: one stance, not five dice; half of them look back at the viewer through the turn, half let their eyes go with the head
    frame: r() < 0.4 ? 0 : (r() - 0.5) * 0.36, // where they enter the frame: off centre by this much of the frame's height, more often than not
  };
}

// The editorial palette: five colours that read on velvet and on white
export const GOLD = '#b8892b', BLACK = '#1a1a1c', WHITE = '#eeeae2', OFFWHITE = '#e4dfd4', RED = '#b3202a', BLUE = '#2b4b8f';
/** Costume families: a name → the garments (portrait keys) it puts on a body; `v` is a variant (a second print, a jacket on or off). Each is one strong silhouette; the gold ones are metallic. */
export const COSTUMES = {
  goldHoodedMetallic: (v) => ({ top: { style: 'hoodieBig', color: GOLD, metal: 1 }, jacket: { style: 'none' }, hat: { style: 'hood', color: GOLD, accent: shade(GOLD, 0.6), metal: 1 }, hair: { style: 'bald' }, props: v ? ['gloves'] : [] }),
  severeBlackSuit: (v) => ({ top: { style: 'buttonDown', color: BLACK }, jacket: { style: 'blazer', color: '#141416' }, ...(v ? { props: ['gloves'] } : {}) }),
  whiteMinimalStreetwear: (v) => ({ top: { style: 'heavyweightTshirt', color: WHITE, graphic: v ? 'strokes' : 'redLabel' }, jacket: { style: 'none' } }),
  whiteCeremonialOversize: (v) => ({ top: { style: 'tunic', color: '#f1eee8', graphic: v ? 'stripes' : 'symbol' }, jacket: { style: 'none' } }),
  redWhiteSportPop: (v) => ({ top: { style: 'trackTop', color: WHITE, accent: RED }, jacket: { style: 'none' }, ...(v ? { hat: { style: 'baseballCap', color: RED, accent: WHITE } } : {}) }),
  loudGoldRedFashion: (v) => ({ top: { style: 'openShirt', color: RED }, jacket: { style: v ? 'blazer' : 'bomber', color: GOLD, metal: 1 }, props: ['chain'] }),
  bluePerformerSuit: () => ({ top: { style: 'buttonDown', color: '#f2efe9', accent: RED }, jacket: { style: 'blazer', color: BLUE }, accessories: ['tie'] }),
  shirtlessTattooed: (v) => ({ top: { style: 'bare' }, jacket: v ? { style: 'openJacket', color: GOLD, metal: 1 } : { style: 'none' }, props: ['chain'] }),
  oversizedGraphicHoodie: (v) => ({ top: { style: 'hoodieBig', color: OFFWHITE, graphic: v ? 'concentric' : 'geometric' }, jacket: { style: 'none' } }),
  streetPuffer: () => ({ top: { style: 'crewTshirt', color: BLACK }, jacket: { style: 'puffer', color: '#202124' }, hat: { style: 'cuffedBeanie', color: BLACK, accent: '#2a2a2d' } }),
  minimalTurtleneck: (v) => ({ top: { style: 'turtleneck', color: v ? WHITE : BLACK }, jacket: { style: 'none' } }),
  denimFashion: () => ({ top: { style: 'crewTshirt', color: WHITE }, jacket: { style: 'denimJacket', color: '#4e6377' } }),
  bomberStreetwear: (v) => ({ top: { style: 'crewTshirt', color: WHITE }, jacket: { style: 'bomber', color: v ? RED : BLACK } }),
  whiteGraphicTunic: (v) => ({ top: { style: 'tunic', color: WHITE, graphic: v ? 'blocks' : 'concentric' }, jacket: { style: 'none' } }),
  plainPolo: () => ({ top: { style: 'polo', color: '#8b8f8a' }, jacket: { style: 'none' } }),
  plainTee: () => ({ top: { style: 'crewTshirt', color: '#6e7278' }, jacket: { style: 'none' } }),
  // the tableau's clashing wardrobe: colour pairs chosen to sit badly together, each with a silhouette that reads at a thumbnail (a big hood, a puffer, a wide tunic, a brimmed hat)
  mustardPurpleHoodie: (v) => ({ top: { style: 'hoodieBig', color: '#c9a227', graphic: v ? 'blocks' : null }, jacket: { style: 'none' }, hat: { style: 'cuffedBeanie', color: '#6b4f8a', accent: '#553a72' } }),
  rustSagePuffer: () => ({ top: { style: 'crewTshirt', color: '#7f9a6e' }, jacket: { style: 'puffer', color: '#a6552f' } }),
  pinkForestBlazer: (v) => ({ top: { style: 'turtleneck', color: v ? '#2f5d3a' : '#c77b8f' }, jacket: { style: 'blazer', color: v ? '#c77b8f' : '#2f5d3a' } }),
  orangeTealTrack: () => ({ top: { style: 'trackTop', color: '#e07a1f', accent: '#1f8f8f' }, jacket: { style: 'none' }, hat: { style: 'baseballCap', color: '#1f8f8f', accent: '#e07a1f' } }),
  limeBrownField: () => ({ top: { style: 'henley', color: '#b9c93a' }, jacket: { style: 'fieldJacket', color: '#5a3d2e' } }),
  magentaOliveDenim: () => ({ top: { style: 'heavyweightTshirt', color: '#b0287a' }, jacket: { style: 'denimJacket', color: '#6d6b3a' } }),
  cyanBrickTunic: (v) => ({ top: { style: 'tunic', color: '#9c3b2a', graphic: v ? 'stripes' : null }, jacket: { style: 'none' }, hat: { style: 'bucketHat', color: '#3fb6c9', accent: '#2a8fa0' } }),
  tealMaroonPuffer: () => ({ top: { style: 'crewTshirt', color: '#3fb6c9' }, jacket: { style: 'puffer', color: '#6b1f33' } }),
  mintPlumSuit: (v) => ({ top: { style: 'buttonDown', color: '#9fd4b8', accent: '#e07a1f' }, jacket: { style: 'blazer', color: '#5a2a4e' }, ...(v ? {} : { accessories: ['tie'] }) }),
  salmonOlivePolo: () => ({ top: { style: 'polo', color: '#e9a07a' }, jacket: { style: 'fieldJacket', color: '#6d6b3a' } }),
  lilacRustField: () => ({ top: { style: 'henley', color: '#b79fd6' }, jacket: { style: 'fieldJacket', color: '#a6552f' } }),
  violetOrangeBomber: () => ({ top: { style: 'crewTshirt', color: '#6b3fa0' }, jacket: { style: 'bomber', color: '#e07a1f' } }),
  oxbloodTealLeather: () => ({ top: { style: 'turtleneck', color: '#1f8f8f' }, jacket: { style: 'leatherJacket', color: '#5e1f2a' } }),
};
export const COSTUME_FAMILIES = Object.keys(COSTUMES);
export const METALLIC = COSTUME_FAMILIES.filter((c) => JSON.stringify(COSTUMES[c](0)).includes('"metal":1'));
export const HOODED = COSTUME_FAMILIES.filter((c) => COSTUMES[c](0).hat?.style === 'hood'); // the costumes that put the hood up
export const HOOD_MAX_WIDTH = 162; // a hood frames a narrow face; wider than this it reads as a face stuffed into a bag
/** Whether this person's face is narrow enough for a hood; `wearable(idn, costume)` says whether a costume may go on them at all. */
export const hoodFits = (idn) => idn.base.face.width <= HOOD_MAX_WIDTH;
export const wearable = (idn, costume) => !HOODED.includes(costume) || hoodFits(idn);

/** The tableau's own dials, read nowhere else: how hard its people are shadowed (`light.contrast`, 1 is the renderer's soft default) and how far the seed's asymmetries go (a multiplier on `face.asym`). Turn them up for a stranger cast, down toward 1 for a plainer one; the generic portrait never sees them. */
export const TABLEAU = { contrast: 1.9, asym: 1.6 };
/** The tableau's cast: twenty-four caricatures, not a random draw. Each archetype names the FAMILIES entry its face is built in and the lists the seed may pick from, then `set` pins the numbers that make the person (portrait keys, merged over the generated base). The direction is structural before it is wardrobe: the test is that in the same grey shirt, with no paint and no halo, each is still told apart at a hundred pixels. So every one pushes several of: head width and height (the widest is 192 by 176, the narrowest 138 by 236), jaw breadth, eye spacing (42 to 70), eye size and openness, brow weight and lift, nose length and width, mouth width and fullness, neck length and thickness, shoulder width (0.76 to 1.5), hair or hat mass, glasses or outerwear that change the outline, a head tilt, a body lean, the head turned against the lean, and asymmetry (TABLEAU.asym scales the seed's, a few pin their own). Read as a group: no two neighbours share a silhouette, a head shape or a dominant colour; the costumes are the clashing families, with gold, white and paint kept to one or two people each, and nothing behind the head: no halo, no disc, no ring (removed 2026-09-26; a background gimmick is not a face). Ages: young (nothing), mid (a line or two), old (lines, crow's feet). */
export const ARCHETYPES = {
  // the massive: broad heads, thick necks, wide shoulders; told apart by the head's height, the beard, the hat and the hair
  severeShaved: { family: 'squareJaw', hair: 'buzz', hairColors: ['jetBlack', 'softBlack'], faces: ['square'], brows: ['thickStraight'], beard: 'none', age: 'mid', costume: 'severeBlackSuit', makeup: 'severeContour', set: { face: { width: 186, height: 194, corner: 48, chin: 0.02, jaw: 0.7, asym: { cheek: 0.4, jaw: -1, temple: 0.8, chin: 0.5 } }, eyes: { style: 'narrow', spacing: 42, openness: 0.75, depth: 1, browLift: -4 }, nose: { style: 'broad', width: 32, length: 36 }, mouth: { style: 'wide', width: 54, fullness: 0.1 }, neck: { width: 92, height: 52 }, body: { width: 1.45 }, pose: { turn: 0.55, shoulder: -0.7, headTilt: -0.1, bodyTilt: 0.05 } } },
  tattooedFlashy: { family: 'heavyBrow', hair: 'shortTextured', faces: ['broad'], beard: 'mustache', costume: 'shirtlessTattooed', marks: 'chestDense', set: { face: { width: 188, height: 200, corner: 44 }, eyes: { style: 'hooded', spacing: 42, depth: 1, browLift: -2, openness: 0.85 }, nose: { style: 'broad', width: 34, length: 36 }, mouth: { style: 'wide', width: 46, fullness: 0.5 }, neck: { width: 88, height: 58 }, body: { width: 1.42 }, pose: { headTilt: -0.12, turn: 0.35, shoulder: 0.55, bodyTilt: -0.04 } } },
  broadBearded: { family: 'heavyBrow', hair: 'shortTextured', beard: 'fullBeard', faces: ['broad'], brows: ['thickStraight'], age: 'mid', hat: { style: 'wideBrimFelt', color: '#c9a227', accent: '#5a2a4e' }, costume: 'rustSagePuffer', set: { face: { width: 190, height: 212, corner: 44 }, eyes: { style: 'hooded', spacing: 48, depth: 1, browLift: -3, openness: 0.8 }, nose: { style: 'roundedTip', width: 30, length: 44 }, mouth: { width: 44 }, neck: { width: 90, height: 60 }, body: { width: 1.4 }, pose: { turn: -0.5, shoulder: 0.5, headTilt: 0.06, bodyTilt: -0.05 } } },
  heavyStreet: { family: 'roundSoft', hair: 'bald', faces: ['round'], beard: 'heavyStubble', costume: 'tealMaroonPuffer', set: { face: { width: 192, height: 176, chin: 0, jaw: 0.96 }, eyes: { style: 'round', spacing: 62, openness: 0.7, bags: 1, depth: 0.6 }, nose: { style: 'upturned', width: 26, length: 28 }, mouth: { style: 'full', width: 40, fullness: 1 }, neck: { width: 96, height: 44 }, body: { width: 1.5 }, pose: { bodyTilt: 0.1, turn: -0.25, headTilt: 0.05, headY: 6 } } },
  olderHeavy: { family: 'heavyBrow', hair: 'receding', hairColors: ['saltPepper', 'gray'], faces: ['softSquare'], age: 'old', beard: 'shortBeard', glasses: 'aviator', costume: 'cyanBrickTunic', set: { face: { width: 180, height: 204, chin: 0.06 }, eyes: { style: 'hooded', spacing: 58, bags: 1, depth: 0.9, openness: 0.8 }, nose: { style: 'aquiline', width: 24, length: 48 }, mouth: { width: 46, fullness: 0.5 }, neck: { width: 84, height: 56 }, body: { width: 1.32 }, pose: { bodyTilt: 0.09, turn: -0.4, headTilt: 0.04 } } },
  // the long: narrow heads on long necks; told apart by the shoulders (broad or slight), the hair (bald, a bun, a ponytail, a middle part, silver) and the glasses
  goldHood: { hair: 'bald', faces: ['narrow'], costume: 'goldHoodedMetallic', set: { face: { width: 138, height: 236, chin: 0.35 }, eyes: { style: 'round', spacing: 68, sclera: 0.95, depth: 0.25, openness: 1.15 }, nose: { style: 'long', width: 13, length: 54 }, mouth: { style: 'thin', width: 30, fullness: 0.15 }, neck: { width: 46, height: 104 }, body: { width: 0.76 }, pose: { turn: -0.4, headTilt: 0.08, shoulder: 0.25 } } },
  tallPaleSuit: { family: 'longMidface', hair: 'middlePart', hairColors: ['jetBlack'], skins: ['porcelain', 'fair'], faces: ['longOval'], brows: ['thickStraight'], glasses: 'rectangularBold', costume: 'mintPlumSuit', set: { face: { width: 146, height: 232, chin: 0.25 }, eyes: { style: 'almond', spacing: 48, browLift: -4, depth: 0.85 }, nose: { style: 'long', width: 16, length: 52 }, mouth: { style: 'thin', width: 42, fullness: 0.1 }, neck: { width: 52, height: 100 }, body: { width: 1.36 }, pose: { turn: 0.3, shoulder: 0.7, headTilt: 0.12, bodyTilt: -0.04 } } },
  olderSilver: { family: 'longMidface', hair: 'receding', hairColors: ['silver', 'white'], faces: ['narrow'], age: 'old', glasses: 'round', costume: 'limeBrownField', set: { face: { width: 142, height: 226, chin: 0.24 }, eyes: { style: 'hooded', spacing: 54, bags: 1, depth: 0.9, openness: 0.8 }, nose: { style: 'aquiline', width: 20, length: 54 }, mouth: { style: 'thin', width: 40, fullness: 0.15 }, neck: { width: 48, height: 86 }, body: { width: 0.92 }, pose: { headTilt: 0.1, shoulder: -0.5, turn: 0.25 } } },
  turtleneck: { family: 'longMidface', hair: 'highBun', faces: ['longOval'], costume: 'minimalTurtleneck', set: { face: { width: 150, height: 228, chin: 0.22 }, eyes: { style: 'monolid', spacing: 58, depth: 0.5, openness: 0.8 }, nose: { style: 'long', width: 16, length: 48 }, mouth: { style: 'thin', width: 36, fullness: 0.2 }, neck: { width: 50, height: 100 }, body: { width: 0.86 }, pose: { headTilt: -0.16, bodyTilt: 0.06, turn: 0.3 } } },
  ponytailSevere: { family: 'longMidface', hair: 'ponytailLow', hairColors: ['jetBlack'], faces: ['narrow'], brows: ['thin'], costume: 'magentaOliveDenim', makeup: 'darkEyeSockets', set: { face: { width: 140, height: 228, chin: 0.26, asym: { cheek: 0.8, jaw: -0.9, temple: 0.9, chin: 0.8 } }, eyes: { style: 'almond', spacing: 46, depth: 0.9, lidWeight: 1, browLift: 5 }, nose: { style: 'narrow', width: 14, length: 50 }, mouth: { style: 'thin', width: 32, fullness: 0.2 }, neck: { width: 48, height: 98 }, body: { width: 0.9 }, pose: { headTilt: 0.16, shoulder: -0.7, turn: -0.35, bodyTilt: 0.04 } } },
  ceremonialWhite: { hair: 'bald', faces: ['oval'], costume: 'whiteGraphicTunic', makeup: 'whiteMaskBase', set: { face: { width: 152, height: 216, chin: 0.2 }, eyes: { style: 'round', spacing: 70, sclera: 1, depth: 0.2 }, nose: { style: 'narrow', width: 14, length: 46 }, mouth: { width: 38, fullness: 0.3 }, neck: { width: 46, height: 102 }, body: { width: 0.76 }, pose: { headTilt: 0.18, turn: 0.2 } } },
  // the compact: round heads on short necks; told apart by the hair or hat (a crew cut, a pixie, a mass of curls, a bucket hat, a platinum bob) and the mouth
  whiteHoodie: { family: 'roundSoft', hair: 'crewCut', faces: ['round'], costume: 'mustardPurpleHoodie', set: { face: { width: 178, height: 184, chin: 0.02, jaw: 0.95 }, eyes: { style: 'round', spacing: 56, sclera: 0.9, bags: 0.7, openness: 1.05 }, nose: { style: 'roundedTip', width: 28, length: 30 }, mouth: { style: 'full', width: 40, fullness: 0.9 }, neck: { width: 76, height: 46 }, body: { width: 1.3 }, pose: { bodyTilt: 0.08, turn: -0.3, headTilt: 0.05 } } },
  sportPop: { family: 'wideCheek', hair: 'pixie', faces: ['round'], costume: 'orangeTealTrack', set: { face: { width: 170, height: 178, chin: 0.04, jaw: 0.92 }, eyes: { style: 'round', spacing: 50, openness: 1.25, sclera: 0.9 }, nose: { style: 'upturned', width: 20, length: 26 }, mouth: { style: 'wide', width: 52, fullness: 0.5 }, neck: { width: 66, height: 44 }, body: { width: 0.88 }, pose: { bodyTilt: -0.1, turn: 0.45, headTilt: 0.12 } } },
  curlyGraphic: { hair: 'curlyMedium', faces: ['round'], costume: 'oversizedGraphicHoodie', set: { face: { width: 174, height: 188, chin: 0.05, jaw: 0.9 }, eyes: { style: 'round', spacing: 60, sclera: 0.85 }, nose: { style: 'roundedTip', width: 28, length: 34 }, mouth: { style: 'wide', width: 48, fullness: 0.6 }, neck: { width: 70, height: 48 }, body: { width: 1.15 }, pose: { headTilt: 0.12, turn: -0.5, shoulder: 0.3 } } },
  suburban: { family: 'roundSoft', hair: 'sidePart', hairColors: ['lightBrown', 'darkBlond'], faces: ['softSquare'], age: 'mid', glasses: 'rectangularBold', hat: { style: 'bucketHat', color: '#e07a1f', accent: '#1f8f8f' }, costume: 'salmonOlivePolo', set: { face: { width: 178, height: 200, chin: 0.06 }, eyes: { style: 'narrow', spacing: 60, openness: 0.75, bags: 0.6 }, nose: { style: 'roundedTip', width: 30, length: 34 }, mouth: { width: 44, fullness: 0.5 }, neck: { width: 82, height: 54 }, body: { width: 1.32 }, pose: { bodyTilt: 0.07, turn: 0.3, shoulder: -0.4 } } },
  bluntBob: { family: 'fineBoned', hair: 'bluntBob', hairColors: ['platinum', 'jetBlack'], faces: ['heart'], costume: 'pinkForestBlazer', makeup: 'sharpEditorialEyes', set: { face: { width: 172, height: 194, chin: 0.36 }, eyes: { style: 'upturned', spacing: 62, sclera: 0.7, openness: 1.1 }, nose: { style: 'short', width: 18, length: 28 }, mouth: { style: 'full', width: 54, fullness: 0.95 }, neck: { width: 64, height: 50 }, body: { width: 0.84 }, pose: { headTilt: 0.16, bodyTilt: -0.07, turn: -0.35 } } },
  // the big-haired: a mass of hair over narrow shoulders; told apart by the hair's shape (an afro, long waves, straight platinum, braids) and the eyes' spacing
  afroStudio: { family: 'wideCheek', hair: 'afroMedium', skins: ['brown', 'deepBrown', 'deep'], faces: ['oval'], costume: 'whiteCeremonialOversize', set: { face: { width: 158, height: 204 }, eyes: { style: 'almond', spacing: 66, depth: 0.4 }, nose: { style: 'short', width: 22, length: 30 }, mouth: { style: 'wide', width: 44, fullness: 0.6 }, neck: { width: 44, height: 72 }, body: { width: 0.8 }, pose: { headTilt: 0.14, turn: 0.3, shoulder: -0.3 } } },
  glamAccessorized: { family: 'wideCheek', hair: 'wavyMedium', hairColors: ['copper', 'auburn'], faces: ['heart'], accessories: ['hoopLeft', 'hoopRight'], costume: 'loudGoldRedFashion', makeup: 'metallicEyeAccent', set: { face: { width: 176, height: 198, chin: 0.34 }, eyes: { style: 'upturned', spacing: 60, openness: 1.2 }, nose: { style: 'short', width: 20, length: 28 }, mouth: { style: 'full', width: 56, fullness: 1 }, neck: { width: 56, height: 74 }, body: { width: 0.95 }, pose: { bodyTilt: -0.09, turn: 0.45, headTilt: -0.08 } } },
  platinumLong: { hair: 'longStraight', hairColors: ['platinum', 'white'], faces: ['diamond'], costume: 'lilacRustField', set: { face: { width: 164, height: 216, chin: 0.28 }, eyes: { style: 'narrow', spacing: 46, lidWeight: 1, depth: 0.75 }, nose: { style: 'aquiline', width: 18, length: 50 }, mouth: { style: 'asym', width: 44, fullness: 0.4 }, neck: { width: 54, height: 94 }, body: { width: 1.05 }, pose: { turn: 0.65, shoulder: -0.45, headTilt: 0.05 } } },
  braided: { family: 'fineBoned', hair: 'boxBraids', skins: ['tan', 'brown', 'deepBrown'], faces: ['diamond'], costume: 'violetOrangeBomber', set: { face: { width: 162, height: 214, chin: 0.28 }, eyes: { style: 'upturned', spacing: 64, sclera: 0.7 }, nose: { style: 'narrow', width: 14, length: 42 }, mouth: { style: 'full', width: 46, fullness: 0.95 }, neck: { width: 52, height: 90 }, body: { width: 0.85 }, pose: { turn: 0.5, headTilt: -0.12, shoulder: 0.45 } } },
  // the sharp: angular heads, slicked or hidden hair, severe brows; told apart by the jaw, the hair line and the outerwear
  slickGoldRed: { hair: 'sweptBack', hairColors: ['jetBlack', 'espresso'], faces: ['diamond'], brows: ['angled'], costume: 'oxbloodTealLeather', set: { face: { width: 166, height: 212, chin: 0.26 }, eyes: { style: 'narrow', spacing: 50, lidWeight: 1, depth: 0.8, browLift: -3 }, nose: { style: 'aquiline', width: 18, length: 48 }, mouth: { style: 'thin', width: 42, fullness: 0.25 }, neck: { width: 60, height: 80 }, body: { width: 1.1 }, pose: { turn: 0.6, shoulder: -0.6, headTilt: 0.06 } } },
  bluePerformer: { hair: 'sidePart', faces: ['longOval'], costume: 'bluePerformerSuit', makeup: 'clownGraphic', set: { face: { width: 148, height: 224, chin: 0.22 }, eyes: { style: 'downturned', spacing: 52, depth: 0.3 }, nose: { style: 'long', width: 16, length: 52 }, mouth: { style: 'thin', width: 36, fullness: 0.2 }, neck: { width: 56, height: 92 }, body: { width: 1 }, pose: { headTilt: -0.14, shoulder: 0.5, turn: -0.25 } } },
  pufferBeanie: { hair: 'locsShort', faces: ['square'], costume: 'streetPuffer', set: { face: { width: 174, height: 198, corner: 42, chin: 0.03 }, eyes: { style: 'almond', spacing: 44, depth: 0.7 }, nose: { style: 'straight', width: 22, length: 44 }, mouth: { style: 'asym', width: 50, fullness: 0.5 }, neck: { width: 72, height: 58 }, body: { width: 1.22 }, pose: { turn: -0.6, shoulder: 0.6, headTilt: -0.04 } } },
  plainContrast: { hair: 'crewCut', hairColors: ['brown', 'darkBrown'], faces: ['softSquare'], brows: ['thickStraight'], beard: 'heavyStubble', costume: 'plainTee', set: { face: { width: 168, height: 204, chin: 0.08 }, eyes: { style: 'almond', spacing: 52, depth: 0.5, browLift: -1 }, nose: { style: 'straight', width: 22, length: 38 }, mouth: { width: 48, fullness: 0.45 }, neck: { width: 63, height: 72 }, body: { width: 1 }, pose: { turn: 0.2, shoulder: 0.2 } } }, // the model: near the default (a heavy brow and stubble apart), so the sheets show the wardrobe on a plain face
};
export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);
const TORSOS = { narrow: 0.9, average: 1, broad: 1.14, heavy: 1.22, lanky: 0.92 };
const AGE_DETAILS = { young: [], mid: ['underEyeLines'], old: ['crowsFeet', 'foreheadLines', 'underEyeLines'] };
const choose = (s, v, all) => (Array.isArray(v) ? v[Math.floor(rand(s) * v.length)] : v ?? all[Math.floor(rand(s) * all.length)]);

/** A stable person from an archetype: `{ id, name, base, home, torso }`, `base` what every portrait of them starts from, `home` the styling they arrive in. The seed jitters the face inside the archetype, so two people of one archetype differ. */
export function identityOf(s, name, id = 0) {
  const a = ARCHETYPES[name] ?? ARCHETYPES.plainContrast, r = () => rand(s);
  const { shape, face, eyes, nose, mouth } = faceOf(s, a.family ?? pickFrom(FAMILY_NAMES, r()), a), skin = SKIN_COLORS[choose(s, a.skins, Object.keys(SKIN_COLORS))], hairColor = HAIR_COLORS[choose(s, a.hairColors, Object.keys(HAIR_COLORS))];
  for (const k of Object.keys(face.asym)) face.asym[k] *= TABLEAU.asym; // the tableau's faces are more lopsided than a crowd's
  const age = a.age ?? 'young', torso = a.torso ?? 'average', hairStyle = a.hair ?? pickFrom(notLong(shape, HAIR_STYLES), r()), plain = !a.glasses && !a.accessories?.length; // one memorable thing: a face that already wears glasses or jewellery takes no extra detail
  const base = merge({
    skin, hairColor,
    face, ears: { size: 0.85 + r() * 0.3 }, eyes, nose, mouth: { ...mouth, smile: -0.05 },
    hair: { style: hairStyle },
    facialHair: { style: LONG_HAIR.includes(hairStyle) ? 'none' : a.beard ?? (r() < 0.7 ? 'none' : BEARDS[Math.floor(r() * BEARDS.length)]) }, // no beard under a bob or long hair, pinned or drawn
    glasses: a.glasses ? { style: a.glasses, color: '#1d1b1a' } : null,
    accessories: [...(a.accessories ?? [])], details: [...AGE_DETAILS[age], ...(plain && r() < 0.3 ? [DETAIL_STYLES[Math.floor(r() * DETAIL_STYLES.length)]] : [])],
    body: { width: TORSOS[torso] ?? 1 },
    light: { ...lightOf(s, 0.8 + r() * 0.2), contrast: TABLEAU.contrast }, // full light, hard shadow: the tableau's dial, not the renderer's default
    neck: { ...(NECK_TYPES[a.neck] ?? NECK_TYPES[torso === 'lanky' ? 'long' : torso === 'heavy' ? 'thick' : 'average']) },
    pose: { turn: (r() - 0.5) * 0.5, shoulder: (r() - 0.5) * 0.6 }, // how this person stands: a shot's pose adds to it
  }, a.set ?? {}); // the archetype's pinned numbers over the seed's draw: the art direction
  if (a.set?.mouth?.y === undefined) base.mouth.y = base.eyes.y + 10 + base.nose.length + LIP_GAP[0] + r() * (LIP_GAP[1] - LIP_GAP[0]); // a pinned nose moves the mouth with it, as the seed's draw would have
  return { id, name, torso, base, home: { costume: a.costume ?? 'plainTee', makeup: a.makeup ?? 'none', marks: a.marks ?? 'none', prop: 'none', hat: a.hat ?? null } };
}

// expressions: what the face does, over the identity's own features; deadpan is the default
export const EXPRESSIONS = {
  deadpan: { eyes: { openness: 1, browLift: 0 }, mouth: { smile: -0.05, open: 0 } },
  stare: { eyes: { openness: 1.18, browLift: -2 }, mouth: { smile: -0.1, open: 0 } },
  slightSmile: { eyes: { openness: 0.95 }, mouth: { smile: 0.28, open: 0 } },
  openMouth: { eyes: { openness: 1.05, browLift: 3 }, mouth: { smile: 0, open: 0.45 } },
  sneer: { eyes: { openness: 0.85, browSkew: 0.45 }, mouth: { style: 'asym', smile: -0.15, open: 0 } },
  shut: { eyes: { openness: 0.04 }, mouth: { smile: -0.05, open: 0 } },
  grin: { eyes: { openness: 0.9, browLift: 2 }, mouth: { smile: 0.82, open: 0 } },
  smirk: { eyes: { openness: 0.92, browSkew: 0.3 }, mouth: { style: 'asym', smile: 0.3, open: 0 } },
  halfSmile: { eyes: { openness: 1 }, mouth: { smile: 0.16, open: 0 } },
  pout: { eyes: { openness: 0.95, browLift: -1 }, mouth: { style: 'full', smile: -0.32, open: 0 } },
  wideEyed: { eyes: { openness: 1.28, browLift: 6 }, mouth: { smile: 0.05, open: 0 } },
  squint: { eyes: { openness: 0.6, browLift: -3 }, mouth: { smile: 0.1, open: 0 } },
};
/** An expression as the five numbers a world animates between: smile, open, eyes (an openness factor), brow (a lift), skew. */
export const exprVals = (name) => { const e = EXPRESSIONS[name] ?? EXPRESSIONS.deadpan; return { smile: e.mouth.smile, open: e.mouth.open ?? 0, eyes: e.eyes.openness ?? 1, brow: e.eyes.browLift ?? 0, skew: e.eyes.browSkew ?? 0 }; };
/** The identity dressed for a shot: `styling` = { costume, variant, makeup: [names], marks: [names], props: [names], hat: { style, color, accent } | name, expression, pose, look, stance }; unset keys fall back to the identity's home styling. Returns portraitOps' options. */
export function dress(idn, styling = {}) {
  const st = styling, family = st.costume ?? idn.home.costume, cos = (COSTUMES[family] ?? COSTUMES.plainTee)(st.variant ?? 0);
  const { props: cprops = [], accessories: cacc = [], ...garments } = cos;
  const p = merge(idn.base, garments);
  p.hat ??= { style: 'none', color: BLACK, accent: '#2a2a2d' }; p.jacket ??= { style: 'none' }; p.top ??= { style: 'crewTshirt', color: '#6e7278' };
  const hat = st.hat ?? idn.home.hat; if (hat && !cos.hat) p.hat = typeof hat === 'string' ? { style: hat, color: BLACK, accent: '#2a2a2d' } : { ...p.hat, ...hat }; // the shot's hat, else the person's own
  if (p.hat.style !== 'none' && (p.hair.style === 'highBun' || !HAIR[p.hair.style])) p.hair = { style: 'lowBun' }; // a hat sits on any registered style but a high bun (a theme's styles included): HAT_HAIR is the list a random hat picks from, not this check
  const mk = st.makeup ?? [idn.home.makeup].flat(), marks = st.marks ?? [idn.home.marks].flat(), props = [...cprops, ...(st.props ?? [idn.home.prop])]; // a home makeup or marks may be a list (a theme's zombie wears its rot in several layers)
  p.makeup = mk.filter((x) => x && x !== 'none'); p.marks = marks.filter((x) => x && x !== 'none'); p.props = props.filter((x) => x && x !== 'none');
  p.accessories = [...new Set([...(idn.base.accessories ?? []), ...cacc])];
  const ex = EXPRESSIONS[st.expression] ?? EXPRESSIONS.deadpan;
  p.eyes = { ...p.eyes, openness: idn.base.eyes.openness * ex.eyes.openness, browLift: idn.base.eyes.browLift + (ex.eyes.browLift ?? 0), browSkew: idn.base.eyes.browSkew + (ex.eyes.browSkew ?? 0), look: st.look ?? { x: 0, y: 0 } };
  p.mouth = { ...p.mouth, ...ex.mouth, smile: ex.mouth.smile + (st.smile ?? 0) }; // smile: a per-shot offset, so two deadpans differ
  const own = st.stance === false ? {} : idn.base.pose ?? {}; // stance false: the shot's pose alone, none of the person's own, so two people can hold exactly the same one (the two halves of a split face)
  p.pose = { headX: 0, headY: 0, headTilt: 0, bodyX: 0, bodyTilt: 0, turn: 0, shoulder: 0, ...own }; for (const [k, v] of Object.entries(st.pose ?? {})) p.pose[k] = (own[k] ?? 0) + v; // the shot's pose over the person's own stance
  p.seed = idn.id * 13 + (st.variant ?? 0) * 3 + 1;
  p.blush = 0;
  return p;
}
