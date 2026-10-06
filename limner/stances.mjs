// A stance is how one body stands: the head's tilt and lean, the turn off the torso, a dropped shoulder, and the hands
// it puts up. It is not where that body is in a frame -- `dx`, `k` and reaching an arm around a neighbour are blocking,
// and blocking belongs to whoever is composing the shot, because those are facts about a composition and not a body.
//
// These are the keys `dress(identity, { pose })` already takes, which is why the split falls here and not elsewhere.
//
// Two entries still carry a blocking field: `swaggerLean.dx` and `graveReach.dy`. They carried it before the split and
// phase 1 changes no output, so they keep it; they are the two to clean up when blocking becomes a table of its own.

export const STANCES = {
  // the editorial stances, in the order the editor has always offered them (POSE_NAMES reads Object.keys of this)
  editorial: {
    directFrontal: { turn: 0.15, shoulder: 0.3, tilt: 0.02 },
    slightLeanLeft: { tilt: -0.12, bodyTilt: -0.06, headX: -8, turn: -0.4, shoulder: 0.5 },
    slightLeanRight: { tilt: 0.12, bodyTilt: 0.06, headX: 8, turn: 0.4, shoulder: -0.5 },
    swaggerLean: { tilt: 0.16, bodyTilt: 0.12, headX: 14, dx: -0.06, turn: 0.6, shoulder: 0.7, headY: -6 },
    statueStill: { turn: -0.2, shoulder: -0.25, headY: 4 },
    handsAtSides: { turn: -0.3, shoulder: 0.4, tilt: -0.04 },
    handHeart: { props: ['handHeartGesture'], headY: 8, tilt: 0.06, turn: 0.2 },
    handsUp: { props: ['handsUp'], headY: -6, tilt: -0.05 },
  },
  // the Thriller choreography as it reads on one body: the claw, the stiff-legged shuffle, the head snapped round, the
  // lean, the shimmy. The lines and duos that arrange several of these are blocking and stayed with the dance.
  undead: {
    thrillerClaw: { props: ['clawHands'], turn: 0.2, tilt: 0.1, headY: 6, shoulder: 0.3 },
    clawSweep: { props: ['clawRaisedRight'], turn: -0.5, tilt: -0.14, shoulder: -0.6, headY: 4 },
    clawsUp: { props: ['clawsUp'], headY: -4, tilt: 0.06, turn: 0.1 },
    armsRight: { props: ['clawsRight'], tilt: 0.12, headX: 6, turn: 0.5, shoulder: -0.4, bodyTilt: 0.03 },
    armsLeft: { props: ['clawsLeft'], tilt: -0.12, headX: -6, turn: -0.5, shoulder: 0.4, bodyTilt: -0.03 },
    zombieShuffle: { props: ['armsForward'], bodyTilt: 0.05, headY: 14, tilt: 0.12, turn: 0.3, shoulder: 0.5 },
    hunchedLurch: { props: ['reachRight'], headY: 18, tilt: 0.2, turn: -0.4, shoulder: 0.8, bodyTilt: -0.06, headX: -6 },
    graveReach: { props: ['clawsUp'], headY: 10, tilt: -0.16, turn: 0.5, dy: 0.08 },
    headSnapLeft: { turn: -0.95, tilt: 0.02 },
    headSnapRight: { turn: 0.95, tilt: -0.02 },
    theLean: { props: ['clawHands'], bodyTilt: 0.13, tilt: -0.18, headX: 10, turn: 0.35, shoulder: -0.8 },
    shoulderShimmy: { shoulder: 0.95, tilt: -0.06, turn: 0.1 },
    deadStill: { headY: 2 },
  },
};

/** The stances a shot spreads across every figure rather than placing once: the three that were the `stance` table,
 * reached through layoutOf's default case, which lays n figures out evenly. The other five return exactly one figure
 * however many were asked for, which is behaviour the layout golden pins. */
export const SPREAD_STANCES = ['directFrontal', 'statueStill', 'handsAtSides'];

/** One stance by name, searching the named pack first and then the editorial set; null when no pack has it, so a caller
 * can tell "no such stance" from "a stance with no fields set". */
export const stanceOf = (name, pack = null) => (pack && STANCES[pack]?.[name]) ?? STANCES.editorial[name] ?? null;

/** Every stance name, the editorial set first. For a menu. */
export const stanceNames = (pack = null) => [...Object.keys(STANCES.editorial), ...(pack && STANCES[pack] ? Object.keys(STANCES[pack]) : [])];
