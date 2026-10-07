// The robots cast: made people, built as a human is. A robot is not a mask: its eyes, mouth, ears and nose are the
// portrait's machine modes (`eyes.mode` lens/led/visor, `mouth.mode` grille/slot/speaker/matrix, `ears.mode`
// disc/antenna/bolt/fin/none, `nose.mode` vent/ridge/none), driven by the same expression dials as a face, so a robot
// still squints, frowns and smiles: the lids over its lights carry the brows, the mouth's line carries the smile. Its
// skin is its plating (gunmetal, white enamel, brass, chrome, oxide) and its eyes' iris is the colour of its light. The
// robot pack (parts/robot.mjs) gives every one the plating's light and some the faceplate, the jaw piece, cheek vents
// and a status light, and a plated torso. The heads are not skulls: flat-topped boxes, a tall can, a round pod.
import '../parts/robot.mjs'; // the parts this cast is made of register by name
import { COSTUMES, FAMILIES, buildOf } from '../people.mjs';
import { parts, merge } from '../portrait.mjs';
import { rand } from '../rng.mjs';

const GUNMETAL = '#5a6068', ENAMEL = '#e4e2dc', BRASS = '#b8904a', CHROME = '#a9b0b8', OXIDE = '#7a4a32', OLIVE = '#6b7048';
const LIGHTS = ['#6fe0ff', '#ff4a3a', '#7aff8a', '#ffb83a', '#c08aff'];
/** What they wear: the plated torso in their own metal or a contrasting one. */
export const ROBOT_COSTUMES = {
  plated: (v) => ({ top: { style: 'robotTorso', color: v ? GUNMETAL : CHROME }, jacket: { style: 'none' }, pants: { style: 'trousers', color: '#2a2e34' } }),
  enamelled: (v) => ({ top: { style: 'robotTorso', color: v ? BRASS : ENAMEL }, jacket: { style: 'none' }, pants: { style: 'trousers', color: v ? '#5a4020' : '#c9c6be' } }),
  coated: (v) => ({ top: { style: 'robotTorso', color: GUNMETAL }, jacket: { style: v ? 'trenchCoat' : 'fieldJacket', color: v ? '#2a2a2e' : '#4a4a3a' }, pants: { style: 'trousers', color: '#2a2a2e' } }),
};
Object.assign(COSTUMES, ROBOT_COSTUMES);
/** What makes any face a machine: no hair, no brows, a light for eyes, metal modelled as metal (a low tonal contrast:
 *  the face's warm planes are for skin, the plating's own light is the pack's `plating`). */
const machine = (skin, light, eyes, mouth, ears, nose) => ({ skin, hairColor: '#2a2e34', hair: { style: 'bald' }, facialHair: { style: 'none' }, blush: 0, glasses: null, accessories: [], details: [], light: { contrast: 0.45 },
  eyes: { mode: eyes, iris: light, browStyle: 'none', bags: 0 }, mouth: { mode: mouth, color: light }, ears: { mode: ears, size: 1 }, nose: { mode: nose } });
/** Seven, each a different head and a different set of modes; their own numbers merged over the machine key by key (a spread would let a mouth: { width } drop the mouth's mode). */
export const ROBOTS = {
  android: { family: 'fineBoned', costume: 'enamelled', makeup: ['plating', 'panelSeams'], set: merge(machine(ENAMEL, LIGHTS[0], 'led', 'slot', 'none', 'ridge'), { face: { width: 150, height: 214, chin: 0.2 }, body: { width: 0.9 }, pose: { turn: -0.25, headTilt: 0.06 } }) },
  sentinel: { family: 'squareJaw', costume: 'plated', makeup: ['plating', 'panelSeams', 'jawSeam'], set: merge(machine(GUNMETAL, LIGHTS[1], 'visor', 'grille', 'bolt', 'vent'), { face: { width: 190, height: 196, corner: 56, jaw: 1, chin: 0 }, mouth: { width: 56 }, body: { width: 1.35 }, pose: { turn: 0.2, shoulder: 0.3 } }) },
  butler: { family: 'longMidface', costume: 'coated', makeup: ['plating', 'panelSeams', 'statusLight'], set: merge(machine(BRASS, LIGHTS[3], 'lens', 'speaker', 'disc', 'none'), { face: { width: 158, height: 226, corner: 40, jaw: 0.96, chin: 0.1 }, eyes: { spacing: 60 }, body: { width: 1 }, pose: { turn: 0.35 } }) },
  companion: { family: 'roundSoft', costume: 'enamelled', makeup: ['plating'], set: merge(machine(ENAMEL, LIGHTS[2], 'led', 'matrix', 'antenna', 'none'), { face: { width: 184, height: 186, corner: 50, jaw: 0.96, chin: 0.02 }, eyes: { spacing: 66, size: 1.15 }, mouth: { width: 46 }, body: { width: 0.95 }, pose: { turn: -0.3, headTilt: -0.08 } }) },
  scrapbot: { family: 'heavyBrow', costume: 'coated', makeup: ['plating', 'cheekVents', 'statusLight'], set: merge(machine(OXIDE, LIGHTS[4], 'lens', 'grille', 'fin', 'vent'), { face: { width: 172, height: 204, corner: 46, jaw: 0.95, asym: { cheek: 1, jaw: -1.2, temple: 0.6, chin: 0.5 } }, eyes: { asym: 0.8, size: 1.08 }, body: { width: 1.15 }, pose: { turn: 0.3, headTilt: 0.1 } }) },
  herald: { family: 'squareJaw', costume: 'plated', makeup: ['plating', 'panelSeams', 'cheekVents'], set: merge(machine(CHROME, LIGHTS[0], 'visor', 'matrix', 'fin', 'ridge'), { face: { width: 168, height: 220, corner: 50, jaw: 1, chin: 0.05 }, mouth: { width: 52 }, body: { width: 1.1 }, pose: { turn: -0.15, headTilt: -0.05 } }) },
  tinker: { family: 'wideCheek', costume: 'coated', makeup: ['plating', 'jawSeam', 'statusLight'], set: merge(machine(OLIVE, LIGHTS[3], 'lens', 'slot', 'antenna', 'vent'), { face: { width: 186, height: 190, corner: 52, jaw: 0.97, chin: 0 }, eyes: { spacing: 64, size: 1.2 }, mouth: { width: 50 }, body: { width: 1.05 }, pose: { turn: 0.25, headTilt: 0.12 } }) },
};
const pick = (s, a) => a[Math.floor(rand(s) * a.length)];
/** A random one in a crowd: a metal, a light and a mode for each feature, all from the state's own draws, and the plating's light. */
const base = (s) => ({ ...machine(pick(s, [GUNMETAL, ENAMEL, BRASS, CHROME, OXIDE, OLIVE]), pick(s, LIGHTS), pick(s, ['lens', 'led', 'visor']), pick(s, ['grille', 'slot', 'speaker', 'matrix']), pick(s, ['none', 'disc', 'antenna', 'bolt', 'fin']), pick(s, ['none', 'vent', 'ridge'])),
  face: { corner: 40 + rand(s) * 20, jaw: 0.94 + rand(s) * 0.06 }, makeup: ['plating', ...(rand(s) < 0.6 ? ['panelSeams'] : [])] });
export default {
  name: 'robots', families: FAMILIES,
  skins: [GUNMETAL, ENAMEL, BRASS, CHROME, OXIDE, OLIVE], hairColors: ['#2a2e34'], irises: LIGHTS, clothes: [GUNMETAL, ENAMEL, BRASS, CHROME],
  pools: { tops: parts('top', { any: ['only:robot'] }), jackets: ['trenchCoat', 'fieldJacket'], beards: ['none'], hair: ['bald'], glasses: [], details: [], graphics: [] },
  wardrobe: { establish: ['none'], develop: ['none'], climax: ['none'], release: ['none'], none: ['none'] },
  archetypes: ROBOTS, archetypeNames: Object.keys(ROBOTS), costumes: Object.keys(ROBOT_COSTUMES), expressions: null, emotes: null, extraMarks: [], build: buildOf('robot'), contrast: 0.45, asym: 0.4,
  base,
};
