// The gnomes cast: five of them, the smallest build in the set (`build`, solved from `ANATOMY` in people.mjs: a halfling's
// height exactly, and the slighter of the two — narrower, a shorter torso, a larger head and larger hands on it) with big round eyes, long tapered ears (`ears.pointed` well past a
// halfling's) and hair that goes everywhere. They wear the tinker's apron, the tall pointed hat and brass goggles
// from the gnome pack (parts/gnome.mjs) over the shared kit (parts/fantasy.mjs), on the tableau's own shots.
import '../parts/gnome.mjs'; // the parts this cast is made of register by name
import '../parts/fantasy.mjs'; // the shared pack beside them
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, SKIN_COLORS, HAIR_COLORS, EYE_COLORS } from '../portrait.mjs';

const RUST = '#a4532c', TEAL = '#3f6b6b', BRASS = '#b08d3c', LOAM = '#5c4631', SKY = '#6f8ea8', WINE = '#6b3246';
/** What they wear: the apron over a shirt, the apron under the pointed hat, a bright tunic, a cloak for the road. */
export const GNOME_COSTUMES = {
  tinker: (v) => ({ top: { style: 'tinkerApron', color: v ? TEAL : RUST }, jacket: { style: 'none' }, pants: { style: 'trousers', color: LOAM } }),
  pointedHatTinker: () => ({ top: { style: 'tinkerApron', color: TEAL }, jacket: { style: 'none' }, hat: { style: 'pointedFeltHat', color: WINE, accent: BRASS }, pants: { style: 'trousers', color: '#3a2e24' } }),
  brightTunic: (v) => ({ top: { style: 'roughTunic', color: v ? SKY : RUST }, jacket: { style: 'none' }, pants: { style: 'trousers', color: LOAM } }),
  burrowCloak: (v) => ({ top: { style: 'roughTunic', color: v ? WINE : TEAL }, jacket: { style: 'hoodedCloak', color: LOAM }, pants: { style: 'trousers', color: '#4a3f33' } }),
};
Object.assign(COSTUMES, GNOME_COSTUMES);
export const GNOME_BUILD = buildOf('gnome'); // the anatomy table in people.mjs: a halfling's height, the slighter of the two, with the larger head and hands
const tiny = (width, height, face = {}) => ({ face: { width, height, ...face }, neck: { width: 66, height: 42 }, ears: { pointed: 0.75, size: 1.15 } }); // every gnome: a small head on a short neck, the ear long and drawn to a point
/** The five, by the hair's and beard's mass, the hat, the goggles and the costume's colour block. */
export const GNOMES = {
  cogwhistle: { family: 'roundSoft', hair: 'shortTextured', hairColors: ['copper', 'auburn'], beard: 'boxedBeard', glasses: 'brassGoggles', costume: 'pointedHatTinker', set: { ...tiny(166, 168, { chin: 0.08, jaw: 0.94 }), eyes: { style: 'round', spacing: 62, openness: 1.18, sclera: 0.9 }, nose: { style: 'broad', width: 26, length: 32 }, mouth: { width: 42, fullness: 0.5 }, body: { width: 0.92 }, pose: { turn: 0.35, headTilt: 0.1 } } },
  sprocketmire: { family: 'wideCheek', hair: 'curlyMedium', hairColors: ['white', 'platinum'], beard: 'fullBeard', age: 'old', costume: 'tinker', set: { ...tiny(170, 164, { jaw: 0.96 }), eyes: { style: 'hooded', spacing: 60, bags: 1, openness: 0.88 }, nose: { style: 'roundedTip', width: 28, length: 34 }, mouth: { style: 'thin', width: 40, fullness: 0.3 }, body: { width: 0.98 }, pose: { turn: -0.3, shoulder: -0.4 } } },
  fizzlebright: { family: 'fineBoned', hair: 'highBun', hairColors: ['lightBlond', 'silver'], costume: 'brightTunic', set: { ...tiny(158, 172, { chin: 0.16 }), eyes: { style: 'round', spacing: 64, openness: 1.22, sclera: 0.95 }, nose: { style: 'upturned', width: 18, length: 26 }, mouth: { style: 'cupidBow', width: 38, fullness: 0.68 }, body: { width: 0.8 }, pose: { headTilt: -0.12, turn: 0.4 } } },
  gearhollow: { family: 'roundSoft', hair: 'bald', hairColors: ['saltPepper'], beard: 'garibaldi', glasses: 'brassGoggles', costume: 'tinker', set: { ...tiny(172, 162, { jaw: 0.98 }), eyes: { spacing: 58, bags: 0.8, openness: 0.95 }, nose: { style: 'short', width: 24, length: 28 }, mouth: { style: 'wide', width: 44, fullness: 0.4 }, body: { width: 1 }, pose: { turn: 0.2, bodyTilt: 0.05 } } },
  lanternquill: { family: 'wideCheek', hair: 'pixie', hairColors: ['chestnut', 'darkBlond'], costume: 'burrowCloak', set: { ...tiny(162, 170), eyes: { style: 'upturned', spacing: 60, openness: 1.1 }, nose: { style: 'narrow', width: 18, length: 28 }, mouth: { width: 40, fullness: 0.55 }, body: { width: 0.84 }, pose: { turn: -0.45, shoulder: 0.5 } } },
};
const pool = (kind, own) => parts(kind, { any: [own, 'era:fantasy'] }); // its own tag and the shared pack, never a registry
// the cast object (the shape people.mjs's EDITORIAL documents): three of the editorial families, fair and warm skins, bright and white hair, blue and green eyes, the gnome apron beside the shared kit, the goggles its own glasses pool, the pointed hat on most roles, the build, the long ear on everyone
export default {
  name: 'gnomes', families: { roundSoft: FAMILIES.roundSoft, wideCheek: FAMILIES.wideCheek, fineBoned: FAMILIES.fineBoned },
  skins: ['porcelain', 'fair', 'lightWarm', 'lightOlive', 'mediumWarm', 'mediumOlive', 'tan', 'brown'].map((k) => SKIN_COLORS[k]), hairColors: ['copper', 'auburn', 'white', 'platinum', 'lightBlond', 'chestnut'].map((k) => HAIR_COLORS[k]), irises: ['lightBlue', 'blue', 'green', 'hazel'].map((k) => EYE_COLORS[k]), clothes: [RUST, TEAL, BRASS, LOAM, SKY, WINE],
  pools: { tops: pool('top', 'only:gnome'), jackets: pool('jacket', 'only:gnome'), beards: parts('facialHair', { all: ['everyday'] }), hair: parts('hair', { all: ['everyday'] }), glasses: pool('glasses', 'only:gnome'), details: parts('details', { all: ['everyday'] }), graphics: [] },
  wardrobe: { establish: ['none', 'pointedFeltHat'], develop: ['pointedFeltHat', 'none', 'feltTravelHat'], climax: ['pointedFeltHat', 'pointedFeltHat', 'feltTravelHat'], release: ['none', 'pointedFeltHat'], none: ['none', 'pointedFeltHat', 'feltTravelHat'] },
  archetypes: GNOMES, archetypeNames: Object.keys(GNOMES), costumes: Object.keys(GNOME_COSTUMES), build: GNOME_BUILD, contrast: 1.3, asym: 1.3,
  base: { ears: { pointed: 0.75, size: 1.15 }, build: GNOME_BUILD }, // the signature every random one in a crowd carries too, the skeleton with it (an identity takes the build from the cast)
  limits: { 'ears.pointed': [0.5, 1], 'ears.size': [0.9, 1.4], 'nose.muzzle': [0, 0], 'build.legs': [0.32, 0.5], 'build.trunk': [0.44, 0.64], 'build.head': [0.64, 0.84], 'build.shoulders': [0.46, 0.68] }, // the build bands are the table's row either side of GNOME_BUILD: a gnome stands a halfling's height and is the slighter of the two
};
