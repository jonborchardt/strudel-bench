// The aliens cast: five kinds of visitor in one cast, each with its own skeleton from ANATOMY.
//  - a grey (`greyAlien`): a long thin body, a bulbous cranium lit like a dome over a narrow pointed chin, eyes black
//    from corner to corner, huge and tilted up at the outer corner, wet with one glint; no brows, a slit of a mouth;
//  - a green (`greenAlien`): slighter than a human, a swollen two-lobed cranium, round wet eyes and two antennae;
//  - a reptilian (`reptilianAlien`): heavier than a human, slit gold eyes under bony ridges, a short snout, a hide of
//    scales laid in as tone, and two low spines off the crown;
//  - an insectoid (the `greenAlien` row: slight and long-limbed is the nearest skeleton the table has): a chitin
//    shell of plates, black compound eyes, mandibles either side of the mouth and jointed feelers;
//  - a nordic (the `elf` row: the tall, slender, nearly human visitor): pale to the point of blue, white hair, large
//    ice-pale eyes set wide. The one that could pass, and doesn't quite.
// The heads are the portrait's own dials (`eyes.size`, `eyes.white`, `eyes.slit`, `nose.muzzle`, the `none` brow),
// pinned per kind in KINDS; what is drawn on and what is worn is the alien pack (parts/alien.mjs). An archetype is one
// kind; a random one in a crowd draws its kind, body and all, from the cast's own `base`.
import '../parts/alien.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, merge } from '../portrait.mjs';
import { rand } from '../rng.mjs';

const SILVER = '#a9b2b8', VOID = '#1e2230', VIOLET = '#4a3a6a', MOSS = '#3e5a3a', GOLD = '#c9a03c', BONE = '#d8d4cc', RUST = '#7a3b2a', CYAN = '#6fe0ff';
/** What they wear: the silver suit, the envoy's robe, a flight crew's one-piece, a warrior's banded plate and the nordic's high collar, each in two colourings. */
export const ALIEN_COSTUMES = {
  silverEnvoy: (v) => ({ top: { style: 'silverSuit', color: v ? '#7f8a92' : SILVER, accent: v ? CYAN : '#dfe6ea', metal: 1 }, jacket: { style: 'none' }, pants: { style: 'trousers', color: v ? '#5f6a72' : '#8a949a' } }),
  robedEnvoy: (v) => ({ top: { style: 'envoyRobe', color: v ? MOSS : VIOLET, accent: GOLD }, jacket: { style: 'none' }, pants: { style: 'skirt', color: v ? MOSS : VIOLET } }),
  flightCrew: (v) => ({ top: { style: 'flightSuit', color: v ? '#2e3a48' : VOID, accent: v ? '#f0a040' : CYAN }, jacket: { style: 'none' }, pants: { style: 'trousers', color: v ? '#2e3a48' : VOID } }),
  warPlate: (v) => ({ top: { style: 'warPlate', color: v ? RUST : '#3a4a32', accent: GOLD }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#2a2622' } }),
  nordicWhite: (v) => ({ top: { style: 'highCollar', color: v ? '#cfd8e0' : '#ece9e2', accent: v ? '#4a6fa8' : '#7fb8d8' }, jacket: { style: 'none' }, pants: { style: 'trousers', color: v ? '#b8c2cc' : BONE } }),
};
Object.assign(COSTUMES, ALIEN_COSTUMES);
export const ALIEN_BUILDS = { grey: buildOf('greyAlien'), green: buildOf('greenAlien'), reptilian: buildOf('reptilianAlien'), insectoid: buildOf('greenAlien'), nordic: buildOf('elf') };
// Every kind writes every head key any kind changes, so one kind's dial never leaks into another: an archetype's `set`
// goes over the cast's `base`, which is a random kind, and a grey must not inherit a reptile's muzzle from it.
const NEUTRAL = { hair: { style: 'bald' }, facialHair: { style: 'none' }, glasses: null, accessories: [], details: [], blush: 0, makeup: [],
  face: { jaw: 0.75, chin: 0.2, corner: 32, fullness: 0 }, ears: { size: 1, pointed: 0, mode: 'human' }, neck: { width: 56, height: 74 },
  eyes: { style: 'almond', size: 1, spacing: 56, openness: 1, white: null, iris: '#1a1a1a', pupil: '#050506', slit: 0, browStyle: 'none', browLift: 0, sclera: null, lidWeight: null, corner: null, bags: 0, depth: 0.5, squint: 0, tilt: 0 },
  nose: { style: 'short', muzzle: 0, width: 14, length: 30, mode: 'human' }, mouth: { style: 'thin', width: 40, fullness: 0.2 } };
const kind = (k) => merge(NEUTRAL, k);
/** Each kind's head and body, as portrait keys: what every one of that kind shares. */
export const KINDS = {
  grey: kind({ build: ALIEN_BUILDS.grey, face: { width: 190, height: 228, chin: 0.62, jaw: 0.3, corner: 22 }, ears: { size: 0.5, mode: 'none' }, neck: { width: 40, height: 84 }, makeup: ['greyCranium', 'eyeGloss'],
    eyes: { style: 'upturned', size: 2.4, spacing: 90, openness: 1.75, white: '#0a0a0e', iris: '#0a0a0e', pupil: '#050506', sclera: 1, lidWeight: 0, corner: 0, depth: 0.7, tilt: 0.45 },
    nose: { style: 'short', width: 6, length: 20, mode: 'slits' }, mouth: { style: 'thin', width: 22, fullness: 0 } }),
  green: kind({ build: ALIEN_BUILDS.green, face: { width: 184, height: 214, chin: 0.3, jaw: 0.52, corner: 26 }, ears: { size: 0.6 }, neck: { width: 46, height: 76 }, makeup: ['craniumLobes', 'eyeGloss', 'antennae'],
    eyes: { style: 'round', size: 2, spacing: 70, openness: 1.15, white: '#e8f0c8', iris: '#141414', sclera: 0.25, depth: 0.4 },
    nose: { style: 'short', width: 9, length: 26 }, mouth: { style: 'wide', width: 46, fullness: 0.25 } }),
  reptilian: kind({ build: ALIEN_BUILDS.reptilian, face: { width: 176, height: 210, jaw: 0.86, chin: 0.12, corner: 40 }, ears: { size: 0.5 }, neck: { width: 70, height: 66 }, makeup: ['reptileScales', 'browRidge'],
    eyes: { style: 'narrow', size: 1.1, spacing: 58, openness: 1.25, slit: 0.9, iris: '#d9b02a', white: '#c8b860', sclera: 0.9, depth: 0.9 },
    nose: { style: 'broad', muzzle: 1, width: 22, length: 40 }, mouth: { style: 'wide', width: 52, fullness: 0.12 } }),
  insectoid: kind({ build: ALIEN_BUILDS.insectoid, face: { width: 168, height: 226, chin: 0.7, jaw: 0.42, corner: 30 }, ears: { size: 0.5, mode: 'none' }, neck: { width: 38, height: 86 }, makeup: ['carapace', 'compoundEyes', 'mandibles', 'feelers'],
    eyes: { style: 'round', size: 1.75, spacing: 92, openness: 1.25, white: '#16180f', iris: '#16180f', pupil: '#16180f', sclera: 1, depth: 0.3 },
    nose: { style: 'short', width: 5, length: 22 }, mouth: { style: 'thin', width: 18, fullness: 0 } }),
  nordic: kind({ build: ALIEN_BUILDS.nordic, hair: { style: 'longStraight' }, hairColor: '#ece6d6', face: { width: 150, height: 222, chin: 0.3, jaw: 0.66 }, ears: { size: 0.85 }, neck: { width: 50, height: 88 }, makeup: ['circlet'],
    eyes: { style: 'almond', size: 1.5, spacing: 68, openness: 1.05, white: '#f2f4f6', iris: '#9cc8e0', sclera: 0.75, browStyle: 'thin', browLift: 3, depth: 0.35 },
    nose: { style: 'narrow', width: 14, length: 42 }, mouth: { style: 'thin', width: 38, fullness: 0.3 } }),
};
const SKINS = { grey: ['#9da3a6', '#b4b8b4', '#8e9496', '#a7aaa0', '#c2c4c4'], green: ['#7fb35c', '#6aa35a', '#8cc06a', '#5f9a6a'], reptilian: ['#5e7a4a', '#6b7f3e', '#4f6b55', '#7a7a4a', '#8a6a3e'], insectoid: ['#5a6a3a', '#7a6a2e', '#3f5248', '#8a7a4a'], nordic: ['#eef0f4', '#e4e8f0', '#f0ece6'] };
const HAIRS = { nordic: ['#ece6d6', '#f4f2ee', '#d8d0bc'] };
const KIND_NAMES = Object.keys(KINDS);
const withKind = (k, extra = {}) => merge(KINDS[k], extra);
/** Seven: two greys, a green, two reptilians, an insectoid and a nordic. */
export const ALIENS = {
  greyWatcher: { family: 'fineBoned', costume: 'silverEnvoy', makeup: KINDS.grey.makeup, set: { ...withKind('grey'), skin: SKINS.grey[0], body: { width: 0.78 }, pose: { turn: 0.12 } } },
  greyElder: { family: 'fineBoned', costume: 'robedEnvoy', makeup: KINDS.grey.makeup, set: { ...withKind('grey', { face: { width: 198, height: 234 }, eyes: { openness: 1.5 } }), skin: SKINS.grey[2], body: { width: 0.76 }, pose: { turn: -0.25, headTilt: 0.08 } } },
  greenScout: { family: 'roundSoft', costume: 'flightCrew', makeup: KINDS.green.makeup, set: { ...withKind('green'), skin: SKINS.green[0], body: { width: 0.9 }, pose: { turn: 0.3, headTilt: -0.1 } } },
  reptilianWarlord: { family: 'heavyBrow', costume: 'warPlate', makeup: KINDS.reptilian.makeup, set: { ...withKind('reptilian', { face: { width: 184 } }), skin: SKINS.reptilian[0], body: { width: 1.3 }, pose: { turn: 0.25, shoulder: 0.4 } } },
  reptilianSpy: { family: 'longMidface', costume: 'flightCrew', makeup: KINDS.reptilian.makeup, set: { ...withKind('reptilian', { face: { width: 164, height: 218 }, eyes: { openness: 1 } }), skin: SKINS.reptilian[2], body: { width: 1.05 }, pose: { turn: -0.4 } } },
  mantisOracle: { family: 'fineBoned', costume: 'robedEnvoy', makeup: KINDS.insectoid.makeup, set: { ...withKind('insectoid'), skin: SKINS.insectoid[0], body: { width: 0.82 }, pose: { turn: -0.15, headTilt: 0.12 } } },
  nordicEmissary: { family: 'longMidface', costume: 'nordicWhite', makeup: KINDS.nordic.makeup, set: { ...withKind('nordic'), skin: SKINS.nordic[0], body: { width: 0.92 }, pose: { turn: 0.2 } } },
};
/** A random one in a crowd: a kind, its head, its body, its skin and what it carries, all from the state's own draws. */
const base = (s) => { const k = KIND_NAMES[Math.floor(rand(s) * KIND_NAMES.length)], sk = SKINS[k], hs = HAIRS[k]; return { ...withKind(k), skin: sk[Math.floor(rand(s) * sk.length)], ...(hs ? { hairColor: hs[Math.floor(rand(s) * hs.length)] } : {}) }; };
export default {
  name: 'aliens', families: { fineBoned: FAMILIES.fineBoned, roundSoft: FAMILIES.roundSoft, heavyBrow: FAMILIES.heavyBrow, longMidface: FAMILIES.longMidface },
  skins: Object.values(SKINS).flat(), hairColors: HAIRS.nordic, irises: ['#0b0b0f', '#1a1a1a', '#d9b02a', '#9cc8e0'], clothes: [SILVER, VOID, VIOLET, MOSS, GOLD, BONE, RUST],
  pools: { tops: parts('top', { any: ['only:alien'] }), jackets: [], beards: ['none'], hair: ['bald'], glasses: [], details: [], graphics: [] },
  wardrobe: { establish: ['none'], develop: ['none'], climax: ['none'], release: ['none'], none: ['none'] },
  archetypes: ALIENS, archetypeNames: Object.keys(ALIENS), costumes: Object.keys(ALIEN_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: ALIEN_BUILDS.green, contrast: 1.5, asym: 0.6,
  base,
};
