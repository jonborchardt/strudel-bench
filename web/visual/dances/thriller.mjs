// The thriller dance: the Thriller choreography as the tableau's shots. The single-body stances -- the claw, the
// stiff-legged shuffle, the head snapped to one side, the lean, the shimmy -- are limner's now (STANCES.undead, named
// by `stances` below); what is left here is blocking: the line clawing in step, the duos, the horde closing on the
// camera. Its shot templates and phases on the same three sets, the opening and closing
// shots, the motion dials (the head lurches further, the kick drops the jaw) and the styling rules its shots use. What
// a cast does in it comes from the cast: `styling`, `alts` and `odd` take the cast first (its expression pool, its
// extra marks), and themes.mjs closes them over the bound cast.
import { rand } from '../kit.mjs';

const pick = (s, a) => a[Math.floor(rand(s) * a.length)];

// --- the poses: the Thriller choreography as it reads on a bust (tableau's layout fields, partial; `sw` is the stage's width in sheet units) ---
export const POSES = {
  swingDuoRight: (n, sw) => [{ dx: -sw * 0.34, props: ['clawsRight'], tilt: 0.1, turn: 0.4, shoulder: -0.3 }, { dx: sw * 0.34, props: ['clawsRight'], tilt: 0.1, turn: 0.4, shoulder: -0.3 }],
  swingDuoLeft: (n, sw) => [{ dx: -sw * 0.34, props: ['clawsLeft'], tilt: -0.1, turn: -0.4, shoulder: 0.3 }, { dx: sw * 0.34, props: ['clawsLeft'], tilt: -0.1, turn: -0.4, shoulder: 0.3 }],
  swingLineRight: (n, sw) => [{ props: ['clawsRight'], tilt: 0.1, turn: 0.45, shoulder: -0.3 }, { dx: -sw * 0.74, props: ['clawsRight'], tilt: 0.12, turn: 0.5, shoulder: -0.35, k: 0.96 }, { dx: sw * 0.74, props: ['clawsRight'], tilt: 0.08, turn: 0.4, shoulder: -0.25, k: 0.96 }], // the line, every pair of hands to the right in step
  swingLineLeft: (n, sw) => [{ props: ['clawsLeft'], tilt: -0.1, turn: -0.45, shoulder: 0.3 }, { dx: -sw * 0.74, props: ['clawsLeft'], tilt: -0.08, turn: -0.4, shoulder: 0.25, k: 0.96 }, { dx: sw * 0.74, props: ['clawsLeft'], tilt: -0.12, turn: -0.5, shoulder: 0.35, k: 0.96 }],
  clawDuo: (n, sw) => [{ dx: -sw * 0.34, props: ['clawHands'], turn: 0.3, tilt: 0.08, shoulder: 0.3 }, { dx: sw * 0.34, props: ['clawHands'], turn: -0.3, tilt: -0.08, shoulder: -0.3 }],
  stalkingPair: (n, sw) => [{ dx: -sw * 0.1, dy: 0.04, props: ['armsForward'], turn: 0.4, headY: 10, tilt: 0.1 }, { dx: sw * 0.28, dy: -0.1, k: 0.86, props: ['clawRaisedLeft'], turn: -0.5, tilt: -0.1 }],
  faceOff: (n, sw) => [{ dx: -sw * 0.3, turn: 0.9, props: ['reachRight'], tilt: 0.1 }, { dx: sw * 0.3, turn: -0.9, tilt: -0.1, props: ['clawHands'] }], // turned on each other
  overShoulderDuo: (n, sw) => [{ dx: sw * 0.08, dy: 0.05, k: 0.95, turn: -0.2, headY: 8, props: ['clawHands'] }, { dx: -sw * 0.2, dy: -0.06, k: 1.02, arm: 0, over: true, turn: 0.4, tilt: 0.08 }], // one's arm over the other's shoulders, the way the tableau draws it
  hordeLine: (n, sw) => [{ turn: 0.15, props: ['clawHands'], tilt: 0.05 }, { dx: -sw * 0.72, turn: 0.45, tilt: 0.1, shoulder: 0.4, props: ['clawHands'] }, { dx: sw * 0.72, turn: -0.45, tilt: -0.1, shoulder: -0.4, props: ['clawHands'] }], // the line, every hand up
  closingIn: (n, sw) => [{ dy: 0.06, k: 1.2, props: ['armsForward'], turn: 0.2, headY: 10, tilt: 0.08 }, { dx: -sw * 0.46, dy: -0.08, k: 0.86, props: ['clawRaisedRight'], turn: 0.5, tilt: 0.14 }, { dx: sw * 0.46, dy: -0.08, k: 0.86, props: ['clawRaisedLeft'], turn: -0.5, tilt: -0.14 }], // the nearest reaching, two behind with an arm up
  shimmyLine: (n, sw) => [{ shoulder: 0.9, tilt: -0.05 }, { dx: -sw * 0.7, shoulder: -0.9, tilt: 0.05, turn: 0.3 }, { dx: sw * 0.7, shoulder: 0.9, tilt: -0.05, turn: -0.3 }],
  lurchLine: (n, sw) => [{ props: ['armsForward'], headY: 12, tilt: 0.1, turn: 0.2 }, { dx: -sw * 0.74, props: ['armsForward'], headY: 14, tilt: 0.14, turn: 0.4, k: 0.96 }, { dx: sw * 0.74, props: ['armsForward'], headY: 12, tilt: -0.12, turn: -0.4, k: 0.96 }],
};


// --- the shots and the phases: the same grammar as the tableau's, on the same three sets ---
export const TEMPLATES = {
  riseSolo: { set: 'void', n: 1, framing: 'medium', poses: ['graveReach', 'hunchedLurch'], expression: 'slackJaw', band: true },
  theatreStare: { set: 'red', n: 1, framing: 'medium', poses: ['deadStill', 'headSnapLeft', 'headSnapRight'], expression: 'deadStare' },
  lurchSolo: { set: 'red', n: 1, framing: 'figure', poses: ['zombieShuffle', 'hunchedLurch', 'theLean'] },
  clawSolo: { set: 'white', n: 1, framing: 'full', poses: ['thrillerClaw', 'clawSweep', 'clawsUp', 'armsRight', 'armsLeft'] },
  sideSwing: { set: 'white', n: 3, framing: 'figure', poses: ['swingLineRight', 'swingLineLeft'] }, // the line swinging both hands to one side; cut short and often at the peak, so the plan alternates the sides across cuts
  headSnap: { set: 'any', n: 1, framing: 'close', poses: ['headSnapLeft', 'headSnapRight'], expression: 'deadStare' },
  hungerClose: { set: 'any', n: 1, framing: 'close', poses: ['deadStill'], expression: 'hunger' },
  snarlExtreme: { set: 'any', n: 1, framing: 'extreme', poses: ['deadStill'], expression: 'snarl' },
  eyesCrop: { set: 'void', n: 1, framing: 'eyes', poses: ['deadStill'], expression: 'deadStare' },
  clawDuo: { set: 'white', n: 2, framing: 'full', poses: ['clawDuo', 'faceOff', 'swingDuoRight', 'swingDuoLeft'] },
  stalkDuo: { set: 'void', n: 2, framing: 'full', poses: ['stalkingPair', 'overShoulderDuo'] },
  hordeLine: { set: 'white', n: 3, framing: 'figure', poses: ['hordeLine', 'shimmyLine', 'lurchLine'] },
  closingIn: { set: 'red', n: 3, framing: 'full', poses: ['closingIn', 'hordeLine'] },
  mirroredZombie: { set: 'void', n: 1, framing: 'close', fx: 'mirror', poses: ['deadStill'], expression: 'hunger' },
  splitZombie: { set: 'void', n: 2, framing: 'close', fx: 'split', poses: ['deadStill'] },
  hordeGrid: { set: 'red', n: 1, framing: 'close', fx: 'grid', grid: 3, poses: ['deadStill'], expression: 'deadStare' },
};
export const SPECIAL = new Set(['mirroredZombie', 'splitZombie', 'hordeGrid', 'eyesCrop', 'snarlExtreme']); // punctuation: never two in a row
export const PHASES = {
  opening: { lens: [8, 4, 8, 4], cascade: 0, mutate: 0.05, marks: 0.2, punch: 0.01, emote: 0.4, tpls: { riseSolo: 4, theatreStare: 3, eyesCrop: 1, hungerClose: 1 } },
  development: { lens: [2, 4, 4, 2], cascade: 0.05, mutate: 0.2, marks: 0.4, punch: 0.02, emote: 0.6, tpls: { lurchSolo: 3, stalkDuo: 2, theatreStare: 1, headSnap: 2, hungerClose: 1, clawSolo: 1, closingIn: 1 } },
  escalation: { lens: [1, 2, 2, 4], cascade: 0.2, mutate: 0.5, marks: 0.6, punch: 0.04, emote: 0.7, tpls: { clawSolo: 3, clawDuo: 2, hordeLine: 2, sideSwing: 2, closingIn: 2, headSnap: 1, snarlExtreme: 1, stalkDuo: 1 } },
  peak: { lens: [0.5, 1, 1, 2, 0.5], cascade: 0.3, mutate: 0.7, marks: 0.7, punch: 0.08, emote: 0.8, tpls: { clawSolo: 2, clawDuo: 2, hordeLine: 2, sideSwing: 4, closingIn: 2, headSnap: 2, mirroredZombie: 1, splitZombie: 1, hordeGrid: 1, snarlExtreme: 1, eyesCrop: 1 } },
  release: { lens: [8, 16, 8], cascade: 0, mutate: 0, marks: 0.2, punch: 0, emote: 0.3, tpls: { theatreStare: 3, lurchSolo: 2, riseSolo: 1, hungerClose: 1 } },
};

const on = (x) => x && x !== 'none';
export default {
  name: 'thriller',
  templates: TEMPLATES, phases: PHASES, special: SPECIAL, fallback: { red: 'lurchSolo', white: 'clawSolo' },
  open: { tpl: 'riseSolo', set: 'void', pose: 'graveReach', framing: 'medium', expression: 'slackJaw' }, // the song opens on one rising out of the ground
  close: { tpl: 'clawDuo', set: 'white', pose: 'clawDuo', framing: 'full' }, // and ends on the two leads clawing at the camera
  poses: POSES, still: 'deadStill', stances: 'undead', // the single-body stances are limner's (limner/stances.mjs STANCES.undead); POSES is what is left: the lines and duos, which are blocking
  motion: { sway: 1.6, tilt: 2.2, nod: 1.8, jaw: 0.35 }, // the lurch: the head rides further, the kick drops the jaw
  /** A dancer keeps its outfit and its home makeup in every shot; a phase adds the cast's extra marks by its odds, the template its own expression. */
  styling(cast, s, idn, P, tpl, i) {
    return { costume: tpl.costumes?.[i] ?? tpl.costume ?? idn.home.costume, variant: rand(s) < 0.3 ? 1 : 0, expression: tpl.expression ?? pick(s, cast.expressions), smile: (rand(s) - 0.5) * 0.16, makeup: [...[idn.home.makeup].flat().filter(on), ...(tpl.makeup ?? [])], marks: [...[idn.home.marks].flat().filter(on), ...(rand(s) < P.marks ? [pick(s, cast.extraMarks)] : [])], props: [] };
  },
  /** What a snare cuts through on a mutating shot: more of the grave on the clothes, or the face moving through hunger, a snarl and a moan. */
  alts(cast, s, base) {
    const kind = pick(s, ['marks', 'marks', 'expression']), out = [base];
    for (let k = 1; k < 4; k++) { const st = { ...base[0] }; if (kind === 'marks') st.marks = [...new Set([...base[0].marks, cast.extraMarks[k - 1]])]; else st.expression = ['hunger', 'snarl', 'moan'][k - 1]; out.push([st, ...base.slice(1)]); }
    return out;
  },
  /** A grid's odd cell: the same one snarling, blood on the shirt. */
  odd: (cast, s, st) => ({ ...st, expression: 'snarl', marks: [...new Set([...st.marks, 'bloodSplatter'])] }),
};
