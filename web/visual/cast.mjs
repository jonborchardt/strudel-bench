// The character generators every world shares, over portrait.mjs. `characterOf(s, role, energy)` is a random
// character from the state's seeded generator (faces: a new one on every cut). `identityOf(s, archetype, id)` is a
// stable person: the base a portrait keeps across scenes (skin, face, features, hair, beard, glasses, build) plus a
// home styling (costume, makeup, marks, prop) the archetype suggests; `dress(identity, styling)` puts a shot's
// styling on that base (a COSTUMES family, makeup, marks, props, a hat, an expression, a pose) and returns what
// portraitOps takes, so the same face is recognisable in every outfit. All randomness is rand(s) on the caller's state.
import { clamp, lerp, rand } from './kit.mjs';
import { SKIN_COLORS, HAIR_COLORS, EYE_COLORS, CLOTHING_COLORS, FACE_SHAPES, NECK_TYPES, EYE_STYLES, BROW_STYLES, NOSE_STYLES, MOUTH_STYLES, HAIR_STYLES, HAT_HAIR, LONG_HAIR, FACIAL_HAIR_STYLES, GLASSES_STYLES, TOP_STYLES, JACKET_STYLES, DETAIL_STYLES, shade, merge } from './portrait.mjs';

// the hats a section role wears: bare or a beanie to establish, a cap or a brim to develop, everyone hatted at the climax
const WARDROBE = { establish: ['none', 'beanie', 'baseballCap', 'none', 'cuffedBeanie'], develop: ['dadCap', 'flatCap', 'bucketHat', 'none', 'fishermanBeanie', 'snapback'], climax: ['wideBrimFelt', 'cowboy', 'sunHat', 'snapback', 'truckerCap', 'bucketHat'], release: ['none', 'sunHat', 'beanie', 'none', 'bucketHat'], none: ['none', 'beanie', 'baseballCap', 'dadCap', 'flatCap', 'wideBrimFelt', 'bucketHat'] };
const vals = (o) => Object.values(o);
const SKINS = vals(SKIN_COLORS), HAIRS = vals(HAIR_COLORS), IRIS = vals(EYE_COLORS), CLOTHES = vals(CLOTHING_COLORS), FACES = vals(FACE_SHAPES), NECKS = vals(NECK_TYPES);
const BEARDS = FACIAL_HAIR_STYLES.filter((x) => x !== 'none'), JACKETS = JACKET_STYLES.filter((x) => x !== 'none' && x !== 'openJacket');
const PLAIN_TOPS = TOP_STYLES.filter((x) => !['bare', 'tunic', 'hoodieBig', 'trackTop', 'openShirt'].includes(x)); // the everyday tops a random character wears
const notLong = (shape, styles) => (shape === FACE_SHAPES.longOval ? styles.filter((h) => !LONG_HAIR.includes(h)) : styles), pickFrom = (a, t) => a[Math.floor(t * a.length)]; // long hair never on a long oval head
const ONE_SIDED = ['studEarringLeft', 'studEarringRight', 'hoopLeft', 'hoopRight'], EXTRAS = ['chainNecklace', 'pendantNecklace', 'earbuds', 'overEarHeadphones'];

/** A new character from the state's generator: a face shape, eyes, brows, nose, mouth, hair and wardrobe from the part library, the role picking the hat, the energy the smile; a little asymmetry in every face (uneven eyes, a brow off level, a one-sided detail). */
export function characterOf(s, role = 'none', energy = 0.5) {
  const r = () => rand(s), pick = (a) => a[Math.floor(r() * a.length)], j = (k) => 1 + (r() - 0.5) * k, hats = WARDROBE[role] ?? WARDROBE.none;
  const shape = pick(FACES), hair = pick(HAIRS), hat = pick(hats), hairStyle = pick(notLong(shape, hat === 'none' ? HAIR_STYLES : HAT_HAIR)), extras = [];
  if (r() < 0.3) extras.push(pick(ONE_SIDED)); if (r() < 0.25) extras.push(pick(EXTRAS));
  const details = []; if (r() < 0.35) details.push(pick(DETAIL_STYLES)); if (r() < 0.2) details.push(pick(DETAIL_STYLES));
  return {
    skin: pick(SKINS), hairColor: hair,
    face: { width: shape.width * j(0.08), height: shape.height * j(0.06), jaw: clamp(shape.jaw * j(0.1), 0.55, 1), chin: shape.chin, corner: shape.corner ?? 32, skew: (r() - 0.5) * 0.9 },
    ears: { size: 0.85 + r() * 0.3 },
    eyes: { y: 190 + r() * 12, spacing: 46 + r() * 14, openness: 0.85 + r() * 0.3, asym: 0.9 + r() * 0.2, style: pick(EYE_STYLES), iris: pick(IRIS), browStyle: pick(BROW_STYLES), browLift: r() * 3, browSkew: (r() - 0.5) * 0.3 },
    nose: { style: pick(NOSE_STYLES), width: 16 + r() * 10, length: 32 + r() * 14 },
    mouth: { style: pick(MOUTH_STYLES), y: 254 + r() * 14, width: 40 + r() * 16, smile: lerp(-0.15, 0.45, energy), fullness: 0.3 + r() * 0.5 },
    hair: { style: hairStyle },
    facialHair: { style: r() < 0.55 || hairStyle === 'longWavy' ? 'none' : pick(BEARDS) }, // long wavy hair and a beard together read as a wig
    hat: { style: hat, color: pick(CLOTHES), accent: shade(pick(CLOTHES), 0.75) },
    top: { style: pick(PLAIN_TOPS), color: pick(CLOTHES) },
    jacket: r() < 0.35 ? { style: pick(JACKETS), color: pick(CLOTHES) } : { style: 'none' },
    glasses: r() < 0.3 ? { style: pick(GLASSES_STYLES), color: pick(['#2b2927', '#211f1e', '#5c5a57', '#6b4a3a']) } : null,
    accessories: extras, details,
    cheeks: r() < 0.35 ? 0 : 0.3 + r() * 0.7, // how much this face colours: a third not at all
    light: { side: r() < 0.5 ? -1 : 1, amount: r() < 0.25 ? 0 : 0.2 + r() * 0.8 }, // which cheek the light falls on and how much, a quarter of faces flat
    neck: { ...pick(NECKS) },
  };
}

// The editorial palette: five colours that read on velvet and on white
export const GOLD = '#b8892b', BLACK = '#1a1a1c', WHITE = '#eeeae2', OFFWHITE = '#e4dfd4', RED = '#b3202a', BLUE = '#2b4b8f';
/** Costume families: a name → the garments (portrait keys) it puts on a body; `v` is a variant (a second print, a jacket on or off). Each is one strong silhouette; the gold ones are metallic. */
export const COSTUMES = {
  goldHoodedMetallic: (v) => ({ top: { style: 'hoodieBig', color: GOLD, metal: 1 }, jacket: { style: 'none' }, hat: { style: 'hood', color: GOLD, accent: shade(GOLD, 0.6), metal: 1 }, hair: { style: 'bald' }, props: v ? ['goldField', 'gloves'] : ['goldField'] }),
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
};
export const COSTUME_FAMILIES = Object.keys(COSTUMES);
export const METALLIC = COSTUME_FAMILIES.filter((c) => JSON.stringify(COSTUMES[c](0)).includes('"metal":1'));

/** The recurring archetypes: what a person's base is drawn from (lists are picked from by the seed, a single value is fixed) and the styling they arrive in. Ages: young (nothing), mid (a line or two), old (lines, crow's feet). Torsos scale the shoulders. */
export const ARCHETYPES = {
  severeShaved: { hair: 'buzz', hairColors: ['jetBlack', 'softBlack'], faces: ['square', 'softSquare'], brows: ['thickStraight', 'angled'], beard: 'none', torso: 'average', age: 'mid', costume: 'severeBlackSuit', makeup: 'paleCorpseBase' },
  goldHood: { hair: 'bald', faces: ['oval', 'narrow'], torso: 'narrow', costume: 'goldHoodedMetallic' },
  tallPaleSuit: { hair: 'sweptBack', hairColors: ['jetBlack'], skins: ['porcelain', 'fair'], faces: ['longOval', 'narrow'], neck: 'long', torso: 'lanky', costume: 'severeBlackSuit', makeup: 'severeContour' },
  bluntBob: { hair: 'bluntBob', hairColors: ['jetBlack', 'platinum'], faces: ['heart', 'oval'], torso: 'narrow', costume: 'minimalTurtleneck', makeup: 'sharpEditorialEyes' },
  platinumLong: { hair: 'longStraight', hairColors: ['platinum', 'white'], faces: ['oval', 'diamond'], costume: 'loudGoldRedFashion' },
  tattooedFlashy: { hair: 'shortTextured', faces: ['square', 'broad'], torso: 'broad', costume: 'shirtlessTattooed', marks: 'chestDense' },
  whiteHoodie: { hair: 'crewCut', faces: ['round', 'softSquare'], torso: 'heavy', costume: 'whiteMinimalStreetwear' },
  afroStudio: { hair: 'afroMedium', skins: ['brown', 'deepBrown', 'deep'], faces: ['oval', 'round'], costume: 'whiteCeremonialOversize' },
  sportPop: { hair: 'pixie', faces: ['round', 'heart'], torso: 'narrow', costume: 'redWhiteSportPop' },
  bluePerformer: { hair: 'sidePart', faces: ['longOval', 'oval'], costume: 'bluePerformerSuit', makeup: 'clownGraphic' },
  broadBearded: { hair: 'shortTextured', beard: 'fullBeard', faces: ['broad', 'square'], torso: 'heavy', age: 'mid', costume: 'bomberStreetwear' },
  olderSilver: { hair: 'receding', hairColors: ['silver', 'gray', 'white'], faces: ['longOval', 'oval'], age: 'old', costume: 'severeBlackSuit' },
  braided: { hair: 'boxBraids', skins: ['tan', 'brown', 'deepBrown'], faces: ['oval', 'diamond'], costume: 'denimFashion' },
  suburban: { hair: 'sidePart', hairColors: ['lightBrown', 'darkBlond'], faces: ['round', 'softSquare'], torso: 'heavy', age: 'mid', glasses: 'rectangularThin', costume: 'plainPolo' },
  pufferBeanie: { hair: 'locsShort', faces: ['oval', 'square'], costume: 'streetPuffer' },
  ceremonialWhite: { hair: 'bald', faces: ['oval', 'narrow'], costume: 'whiteGraphicTunic', makeup: 'whiteMaskBase' },
  slickGoldRed: { hair: 'sweptBack', hairColors: ['jetBlack', 'espresso'], faces: ['diamond', 'narrow'], costume: 'loudGoldRedFashion', makeup: 'metallicEyeAccent' },
  turtleneck: { hair: 'lowBun', faces: ['longOval', 'oval'], torso: 'lanky', costume: 'minimalTurtleneck' },
  glamAccessorized: { hair: 'longWavy', hairColors: ['auburn', 'copper', 'jetBlack'], faces: ['heart', 'oval'], accessories: ['hoopLeft', 'hoopRight', 'pendantNecklace'], costume: 'loudGoldRedFashion', makeup: 'sharpEditorialEyes' },
  plainContrast: { hair: 'crewCut', hairColors: ['brown', 'darkBrown'], faces: ['oval', 'softSquare'], torso: 'average', costume: 'plainTee' },
  curlyGraphic: { hair: 'curlyMedium', faces: ['round', 'oval'], costume: 'oversizedGraphicHoodie' },
  heavyStreet: { hair: 'buzz', faces: ['broad', 'round'], torso: 'heavy', beard: 'heavyStubble', costume: 'oversizedGraphicHoodie' },
  ponytailSevere: { hair: 'ponytailLow', hairColors: ['jetBlack'], faces: ['narrow', 'diamond'], costume: 'severeBlackSuit', makeup: 'sharpEditorialEyes' },
  olderHeavy: { hair: 'receding', hairColors: ['saltPepper', 'gray'], faces: ['broad', 'round'], torso: 'heavy', age: 'old', beard: 'shortBeard', costume: 'plainPolo' },
};
export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);
const TORSOS = { narrow: 0.9, average: 1, broad: 1.14, heavy: 1.22, lanky: 0.92 };
const AGE_DETAILS = { young: [], mid: ['underEyeLines'], old: ['crowsFeet', 'foreheadLines', 'underEyeLines'] };
const choose = (s, v, all) => (Array.isArray(v) ? v[Math.floor(rand(s) * v.length)] : v ?? all[Math.floor(rand(s) * all.length)]);

/** A stable person from an archetype: `{ id, name, base, home, torso }`, `base` what every portrait of them starts from, `home` the styling they arrive in. The seed jitters the face inside the archetype, so two people of one archetype differ. */
export function identityOf(s, name, id = 0) {
  const a = ARCHETYPES[name] ?? ARCHETYPES.plainContrast, r = () => rand(s), j = (k) => 1 + (r() - 0.5) * k;
  const shape = FACE_SHAPES[choose(s, a.faces, Object.keys(FACE_SHAPES))], skin = SKIN_COLORS[choose(s, a.skins, Object.keys(SKIN_COLORS))], hairColor = HAIR_COLORS[choose(s, a.hairColors, Object.keys(HAIR_COLORS))];
  const age = a.age ?? 'young', torso = a.torso ?? 'average', hairStyle = a.hair ?? pickFrom(notLong(shape, HAIR_STYLES), r());
  return {
    id, name, torso,
    base: {
      skin, hairColor,
      face: { width: shape.width * j(0.08), height: shape.height * j(0.06), jaw: clamp(shape.jaw * j(0.1), 0.55, 1), chin: shape.chin, corner: shape.corner ?? 32, skew: (r() - 0.5) * 0.9 },
      ears: { size: 0.85 + r() * 0.3 },
      eyes: { y: 190 + r() * 12, spacing: 46 + r() * 14, openness: 0.85 + r() * 0.3, asym: 0.92 + r() * 0.16, style: choose(s, a.eyes, EYE_STYLES), iris: IRIS[Math.floor(r() * IRIS.length)], browStyle: choose(s, a.brows, BROW_STYLES), browLift: r() * 3, browSkew: (r() - 0.5) * 0.2 },
      nose: { style: choose(s, a.nose, NOSE_STYLES), width: 16 + r() * 10, length: 32 + r() * 14 },
      mouth: { style: choose(s, a.mouth, MOUTH_STYLES), y: 254 + r() * 14, width: 40 + r() * 16, smile: -0.05, fullness: 0.3 + r() * 0.5 },
      hair: { style: hairStyle },
      facialHair: { style: a.beard ?? (r() < 0.7 || hairStyle === 'longWavy' ? 'none' : BEARDS[Math.floor(r() * BEARDS.length)]) },
      glasses: a.glasses ? { style: a.glasses, color: '#1d1b1a' } : null,
      accessories: [...(a.accessories ?? [])], details: [...AGE_DETAILS[age], ...(r() < 0.3 ? [DETAIL_STYLES[Math.floor(r() * DETAIL_STYLES.length)]] : [])],
      body: { width: TORSOS[torso] ?? 1 },
      light: { side: r() < 0.5 ? -1 : 1, amount: 0.55 + r() * 0.4 },
      neck: { ...(NECK_TYPES[a.neck] ?? NECK_TYPES[torso === 'lanky' ? 'long' : torso === 'heavy' ? 'thick' : 'average']) },
    },
    home: { costume: a.costume ?? 'plainTee', makeup: a.makeup ?? 'none', marks: a.marks ?? 'none', prop: 'none' },
  };
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
/** The identity dressed for a shot: `styling` = { costume, variant, makeup: [names], marks: [names], props: [names], hat: { style, color, accent } | name, expression, pose, look }; unset keys fall back to the identity's home styling. Returns portraitOps' options. */
export function dress(idn, styling = {}) {
  const st = styling, family = st.costume ?? idn.home.costume, cos = (COSTUMES[family] ?? COSTUMES.plainTee)(st.variant ?? 0);
  const { props: cprops = [], accessories: cacc = [], ...garments } = cos;
  const p = merge(idn.base, garments);
  p.hat ??= { style: 'none', color: BLACK, accent: '#2a2a2d' }; p.jacket ??= { style: 'none' }; p.top ??= { style: 'crewTshirt', color: '#6e7278' };
  if (st.hat && !cos.hat) p.hat = typeof st.hat === 'string' ? { style: st.hat, color: BLACK, accent: '#2a2a2d' } : { ...p.hat, ...st.hat };
  if (p.hat.style !== 'none' && !HAT_HAIR.includes(p.hair.style)) p.hair = { style: 'lowBun' };
  const mk = st.makeup ?? [idn.home.makeup], marks = st.marks ?? [idn.home.marks], props = [...cprops, ...(st.props ?? [idn.home.prop])];
  p.makeup = mk.filter((x) => x && x !== 'none'); p.marks = marks.filter((x) => x && x !== 'none'); p.props = props.filter((x) => x && x !== 'none');
  p.accessories = [...new Set([...(idn.base.accessories ?? []), ...cacc])];
  const ex = EXPRESSIONS[st.expression] ?? EXPRESSIONS.deadpan;
  p.eyes = { ...p.eyes, openness: idn.base.eyes.openness * ex.eyes.openness, browLift: idn.base.eyes.browLift + (ex.eyes.browLift ?? 0), browSkew: idn.base.eyes.browSkew + (ex.eyes.browSkew ?? 0), look: st.look ?? { x: 0, y: 0 } };
  p.mouth = { ...p.mouth, ...ex.mouth, smile: ex.mouth.smile + (st.smile ?? 0) }; // smile: a per-shot offset, so two deadpans differ
  p.pose = { headX: 0, headY: 0, headTilt: 0, bodyX: 0, bodyTilt: 0, ...(st.pose ?? {}) };
  p.seed = idn.id * 13 + (st.variant ?? 0) * 3 + 1;
  p.blush = 0;
  return p;
}
