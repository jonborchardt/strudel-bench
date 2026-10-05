// undead: the song as a night-street dance video after Thriller. One lead in a red jacket, alive, stands front and
// centre; behind them, in rows, the dead (cast.mjs identities over portrait.mjs, with the undead treatment on top)
// dance the same routine in unison, one step a beat, snapping into each position and holding it, the lead precise
// and every corpse a little off. The arrangement is the choreography: a timeline of shots is planned per section at
// init from its phase (opening, development, escalation, peak, release, tableau's phaseOf), the horde as big as the
// section is loud (a quiet verse brings four up, a chorus eight, the climax all nine), each section drawing its own
// routine from the phase's list, and the shots cutting among the line of dancers, a close-up of one corpse (another
// on every snare), a mirrored pair, a face-off between the lead and one of the dead, a wall of nine faces, the rows
// with the lead gone, and the lead alone close. The song opens close on the lead with no one behind, and the release
// empties the street and pushes back in on the lead, whose face goes the way of the others as the song ends. A kick
// is a nod, a snare a head snap (and the next corpse in a close-up), a hi-hat a blink somewhere in the horde, the
// melody moves the lead's eyes, an fx impact is a flash frame, a riser raises the dead (they come up through the
// ground fog, clipped at their own floor line), a dropout freezes everyone mid-move and dims the moon.
// Deterministic: randomness only from the state's own generator.
//
// The cast and the choreography are the tableau's `thriller` theme's (web/visual/thriller.mjs): the horde is its
// ZOMBIES in its `styling` (the rot as home makeup, the grave on the clothes), the lead its `thrillerLead` kept
// alive by `aliveOf` until the release, and every step is one of its POSES (layoutOf partials), so a new pose there
// is a step here by name. Two places know this and nothing else does: LIVE/aliveOf and STEPS/ROUTINES.
import { clamp, lerp, decay, ease, seed, rand, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY, mix, SKIN_COLORS, EYE_COLORS } from './portrait.mjs';
import { identityOf, dress } from './cast.mjs';
import { graveyard, floorShadow, vignette } from './sets.mjs';
import { phaseOf } from './tableau.mjs';
import thriller, { POSES as ZOMBIE_POSES, ZOMBIE_NAMES } from './thriller.mjs'; // the cast and the choreography: importing registers the zombie parts by name

const FEET = 600; // the sheet's torso runs to here: where the ground meets a standing figure
const SNAP = 9; // how fast a figure arrives in a step: a dance move lands, then holds
const BLINK_GAP = 2.5, MIN_GAP = 0.12; // seconds between blinks in the horde; between two snare snaps
const LEAD = 'thrillerLead'; // the one in the red leather jacket, alive until the end
/** Framings: sheet units per canvas height and where the eye line sits (a fraction of the height), as the tableau's. */
export const FRAMING = { close: { u: 330, ey: 0.42 }, medium: { u: 460, ey: 0.36 }, full: { u: 640, ey: 0.3 }, wide: { u: 900, ey: 0.3 } };
const floorOf = (u, ey) => ey + (FEET - 196) / u; // where the front row's feet land for a framing
/** Where the horde stands, in filling order: dx in figure widths from the centre, and the row back (0 is just behind the lead). */
export const SPOTS = [{ dx: -0.9, row: 0 }, { dx: 0.9, row: 0 }, { dx: 0, row: 1 }, { dx: -1.4, row: 1 }, { dx: 1.4, row: 1 }, { dx: -0.7, row: 2 }, { dx: 0.7, row: 2 }, { dx: -2.1, row: 2 }, { dx: 2.1, row: 2 }];
const ROW_BACK = 0.1, ROW_SHRINK = 0.16; // each row back: higher on the ground by this much of the height, and this much smaller
/** Ground fog lying on one row's line: the sheet's torso runs on past the feet, so every row stands in fog to the chest rather than ending in a cut. */
const FOG_CUT = 60, FOG_SOLID = 70; // sheet units below a figure's feet: where the figure is clipped, and where the fog is solid (the sheet's torso runs a hundred units past the feet, so it is never seen); in sheet units so a wide shot's fog is as thin as its figures are small
/** Ground fog on one line, for figures at scale `k` (canvas units per sheet unit): a soft ramp from above the line to solid at FOG_SOLID below it and on past the frame, so the rows dissolve into one bank rather than each standing in a stripe. */
function fogAt(ctx, w, h, y, lit, k) {
  const top = y - 40 * k, span = h * 1.4 - top, at = (u) => clamp((u + 40) * k / span);
  const g = ctx.createLinearGradient(0, top, 0, top + span); g.addColorStop(0, 'rgba(108 120 132 / 0)'); g.addColorStop(at(10), `rgba(108 120 132 / ${0.5 * lit})`); g.addColorStop(at(FOG_SOLID), `rgba(104 116 128 / ${lit})`); g.addColorStop(1, `rgba(96 108 120 / ${lit})`);
  ctx.fillStyle = g; ctx.fillRect(-w, top, w * 3, span);
}

/** The shot kinds: `line` is the street (the lead and the rows), the rest cut away from it. */
export const SHOTS = {
  line: { framing: null }, // full or wide by the horde's size
  leadClose: { framing: 'close' },
  corpseClose: { framing: 'close', who: 1 },
  pair: { framing: 'medium', who: 2 },
  faceOff: { framing: 'medium', who: 1 },
  wall: { framing: 'close', who: 9 },
  noLead: { framing: null },
};
/** The phases: the horde's size (a span the section's energy picks inside; opening and release stand the lead alone), the routines a section may draw, how big the dance is, shot lengths in bars, the shot weights, and the odds a snare cuts to the next corpse in a close-up. */
export const PHASES = {
  opening: { horde: [0, 0], routines: ['sway'], amp: 0.5, lens: [8, 4], shots: { leadClose: 4, line: 1 } },
  development: { horde: [3, 7], routines: ['shamble', 'lurch', 'sway'], amp: 0.7, lens: [4, 2, 4, 2, 1], shots: { line: 4, corpseClose: 2, pair: 1, faceOff: 1, leadClose: 1 } },
  escalation: { horde: [5, 9], routines: ['thriller', 'thriller2', 'lurch'], amp: 0.85, lens: [2, 1, 2, 1, 4], shots: { line: 3, pair: 2, corpseClose: 2, wall: 1, faceOff: 1, noLead: 1 } },
  peak: { horde: [8, 9], routines: ['thriller', 'thriller2'], amp: 1, lens: [1, 1, 2, 0.5], shots: { line: 3, wall: 2, pair: 2, corpseClose: 2, noLead: 1, leadClose: 1 } },
  release: { horde: [0, 0], routines: ['sway'], amp: 0.4, lens: [8, 4], shots: { leadClose: 3, line: 1 } },
};

// ---- the faces: the thriller theme's. The horde is its cast (ZOMBIES: the dead skin, the milky eyes, the rotten teeth
// and the rot as home makeup, each in what they were buried in), dressed once at init by its `styling`. The lead is
// its `thrillerLead` brought back to life: `aliveOf` puts a living skin, living eyes, even teeth and a clean face over
// the zombie identity at decay 0 and lets the zombie back through as decay climbs (the release), so the ending is the
// same person going the way of the others.
export const LIVE = { skin: SKIN_COLORS.mediumWarm, iris: EYE_COLORS.darkBrown, pupil: '#1a1412' };
export function aliveOf(p, decay = 0, idn = null) {
  const dead = idn?.base ?? p, d = clamp(decay);
  p.skin = mix(LIVE.skin, dead.skin, d);
  p.eyes = { ...p.eyes, iris: d < 0.5 ? LIVE.iris : dead.eyes.iris, pupil: d < 0.5 ? LIVE.pupil : dead.eyes.pupil, sclera: d < 0.5 ? null : dead.eyes.sclera, bags: lerp(0.1, dead.eyes.bags ?? 1, d), depth: lerp(0.45, dead.eyes.depth ?? 0.95, d) };
  p.mouth = { ...p.mouth, teeth: d < 0.5 ? 'even' : 'rotten', open: (p.mouth.open ?? 0) * d };
  if (d < 0.5) { p.makeup = []; p.marks = []; } // the rot comes back with the face
  return p;
}

// ---- the poses: the theme's POSES (layoutOf partials) are the steps as they stand; a routine is a list of their names,
// one step a beat, repeating. The world eases the numbers toward each step and swaps the arm props (the claws) on the
// beat; nothing in it knows what a step contains, so new pose tech lands in STEPS and `poseOf` alone.
const stepOf = (name) => { const { dx, dy, k, arm, over, look, ...st } = (ZOMBIE_POSES[name]?.(1, 400) ?? [{}])[0]; return st; }; // a single-figure pose, the layout's placement dropped
export const STEPS = Object.fromEntries(['deadStill', 'theLean', 'shoulderShimmy', 'zombieShuffle', 'hunchedLurch', 'headSnapLeft', 'headSnapRight', 'thrillerClaw', 'clawSweep', 'clawsUp', 'armsRight', 'armsLeft'].map((n) => [n, stepOf(n)]));
STEPS.rest = {};
export const ROUTINES = {
  sway: ['theLean', 'deadStill', 'shoulderShimmy', 'deadStill'],
  // the side swing (both claws up beside the head on one side, then the other, a beat each) is the move: the loud routines are built on it
  shamble: ['zombieShuffle', 'zombieShuffle', 'armsRight', 'armsLeft', 'hunchedLurch', 'headSnapLeft', 'armsRight', 'armsLeft'],
  lurch: ['hunchedLurch', 'headSnapLeft', 'armsRight', 'armsLeft', 'clawSweep', 'zombieShuffle', 'armsRight', 'armsLeft'],
  thriller: ['armsRight', 'armsLeft', 'armsRight', 'armsLeft', 'thrillerClaw', 'headSnapRight', 'thrillerClaw', 'headSnapLeft'],
  thriller2: ['armsRight', 'armsLeft', 'armsRight', 'armsLeft', 'clawsUp', 'clawsUp', 'clawSweep', 'theLean'],
  freeze: ['deadStill'],
};
const POSE_KEYS = ['headX', 'headY', 'tilt', 'bodyTilt', 'turn', 'shoulder'];
/** The step a routine is on at this moment of the clock: one step a beat, from the song's own bar and beat so live and offline agree. */
export const stepAt = (routine, clock) => { const r = ROUTINES[routine] ?? ROUTINES.sway; return r[(clock.bar * clock.beats + clock.beat) % r.length]; };
/** A step as numbers to ease and props to wear: every pose field present, zero where the step says nothing. */
const poseOf = (name) => { const { props = [], ...pose } = STEPS[name] ?? STEPS.rest; return { pose: { headX: 0, headY: 0, tilt: 0, bodyTilt: 0, turn: 0, shoulder: 0, ...pose }, props }; };

const pick = (s, a) => a[Math.floor(rand(s) * a.length)];
const wpick = (s, w) => { const e = Object.entries(w), t = e.reduce((n, [, v]) => n + v, 0); let x = rand(s) * t; for (const [k, v] of e) { x -= v; if (x <= 0) return k; } return e[e.length - 1][0]; };
const figure = (id, lead, st = null) => ({ id, lead, st, up: lead ? 1 : 0, cur: poseOf('rest').pose, step: 'rest', props: [], jitter: 0, blink: 0, lastBlink: -BLINK_GAP }); // st: the theme's styling of a corpse, drawn once so draw stays pure
/** A section's shots back to back in bars from the phase's lengths and weights, never the same cutaway twice in a row; `who` are corpse indices (into SPOTS) for the shots that single some out, drawn from those standing. */
export function planSection(s, bars, phase, standing) {
  const P = PHASES[phase], shots = []; let b = 0, last = null;
  while (b < bars - 1e-6) {
    let kind = wpick(s, P.shots); if (kind === last && kind !== 'line') kind = 'line'; last = kind;
    let len = pick(s, P.lens); if (b + len > bars) len = bars - b; if (len < 0.25) break;
    const n = SHOTS[kind].who ?? 0, pool = Array.from({ length: Math.max(standing, 1) }, (_, i) => i), who = [];
    for (let i = 0; i < n; i++) who.push(pool.length ? pool.splice(Math.floor(rand(s) * pool.length), 1)[0] : i % SPOTS.length);
    shots.push({ at: b, len, kind, who }); b += len;
  }
  return shots;
}
const shotOf = (s) => s.plan[s.section]?.[s.shotIx] ?? null;

export default {
  name: 'undead',

  init(score, rng, size) {
    const s = { size: { ...size }, slotOf: Object.fromEntries(Object.entries(score.cast ?? {}).map(([n, c]) => [n, c.slot])), cast: [], lead: 0, order: [], phases: [], routines: [], hordes: [], plan: [], section: 0, shotIx: -1, variant: 0, phase: 'opening', routine: 'sway', wanted: 0, t: 0, energy: 0.5, amp: 0.5, u: FRAMING.close.u, ey: FRAMING.close.ey, freeze: 0, dark: 0, flash: 0, bob: 0, snap: 0, snapDir: 1, lastSnap: -1, rise: 1, leadDecay: 0, look: { x: 0, y: 0 }, lookTo: { x: 0, y: 0 }, stones: [], figures: [] };
    seed(s, rng);
    s.cast = ZOMBIE_NAMES.map((name, i) => identityOf(s, name, i));
    s.lead = Math.max(0, ZOMBIE_NAMES.indexOf(LEAD));
    s.order = s.cast.map((_, i) => i).filter((i) => i !== s.lead); for (let i = s.order.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [s.order[i], s.order[j]] = [s.order[j], s.order[i]]; }
    s.figures = [figure(s.lead, true), ...SPOTS.map((_, i) => ({ ...figure(s.order[i], false, { ...thriller.styling(s, s.cast[s.order[i]], { marks: 0.5 }, {}, 0), props: [] }), jitter: rand(s) * Math.PI * 2 }))]; // the lead, then one corpse per spot in the theme's styling, each with its own wobble phase
    let x = -0.1; while (x < 1.1) { if (rand(s) < 0.7) s.stones.push({ x, w: 0.03 + rand(s) * 0.03, h: 0.07 + rand(s) * 0.08 }); x += 0.06 + rand(s) * 0.1; }
    const sections = score.sections.length ? score.sections : [{ name: null, role: null, energy: 0.5, bars: 64 }];
    s.phases = sections.map((_, i) => phaseOf(sections, i, score.climax));
    s.hordes = sections.map((sec, i) => { const [lo, hi] = PHASES[s.phases[i]].horde; return Math.round(lerp(lo, hi, sec.energy)); }); // how many stand in each section: the phase's span, the energy's place in it
    s.routines = sections.map((_, i) => pick(s, PHASES[s.phases[i]].routines)); // each section its own dance, so two choruses differ
    s.plan = sections.map((sec, i) => planSection(s, sec.bars, s.phases[i], s.hordes[i]));
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    const ix = Math.max(0, Math.min(clock.index, s.phases.length - 1)), local = clock.bar + clock.barPhase;
    if (ix !== s.section) { s.section = ix; s.shotIx = -1; }
    s.phase = s.phases[ix] ?? 'opening'; s.routine = s.routines[ix] ?? 'sway'; s.wanted = s.hordes[ix] ?? 0;
    const plan = s.plan[ix] ?? [], cur = plan[s.shotIx];
    if (!cur || local < cur.at || local >= cur.at + cur.len) { let k = plan.findIndex((x) => local >= x.at && local < x.at + x.len); if (k < 0) k = plan.length - 1; if (k !== s.shotIx) { s.shotIx = k; s.variant = 0; } }
    const P = PHASES[s.phase], shot = shotOf(s);
    s.freeze = ease(s.freeze, clock.dropout ? 1 : 0, 6, dt); // a dropout: everyone holds mid-move
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.rise = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 1; // a riser: the dead come up through the ground over its bars
    s.leadDecay = ease(s.leadDecay, s.phase === 'release' ? 1 : 0, 0.5, dt); // the ending: the lead's face goes the way of the others
    const fr = FRAMING[SHOTS[shot?.kind ?? 'line'].framing ?? (s.wanted >= 6 ? 'wide' : 'full')];
    s.u = ease(s.u, fr.u, 1.5, dt); s.ey = ease(s.ey, fr.ey, 1.5, dt);
    s.amp = ease(s.amp, lerp(0.35, 1, s.energy) * P.amp, 2, dt);
    s.flash = decay(s.flash, 14, dt); s.bob = decay(s.bob, 7, dt); s.snap = decay(s.snap, 6, dt);
    s.look.x = ease(s.look.x, s.lookTo.x, 6, dt); s.look.y = ease(s.look.y, s.lookTo.y, 6, dt); s.lookTo.x = ease(s.lookTo.x, 0, 0.4, dt); s.lookTo.y = ease(s.lookTo.y, 0, 0.4, dt);
    const name = stepAt(s.routine, clock), target = poseOf(name);
    s.figures.forEach((f, i) => {
      f.up = ease(f.up, f.lead || i - 1 < s.wanted ? 1 : 0, 0.8, dt); // the wanted ones rise, the rest sink back
      f.blink = decay(f.blink, 18, dt);
      if (s.freeze > 0.5) return; // frozen: hold the position, whatever the beat does
      f.step = name; f.props = target.props;
      for (const k of POSE_KEYS) f.cur[k] = ease(f.cur[k], target.pose[k], SNAP, dt);
    });
    for (const e of events) {
      const slot = e.layer ? (s.slotOf?.[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain') : DEFAULT_SLOT[e.kind] ?? 'grain';
      if (slot === 'impulse') {
        if (e.role === 'impact') { if (s.t - s.lastSnap > MIN_GAP) { s.snap = 1; s.snapDir = -s.snapDir; s.lastSnap = s.t; s.variant++; } } // the snap, and the next corpse in a close-up
        else if (e.role === 'grain') blinkOne(s);
        else s.bob = Math.max(s.bob, clamp(e.gain * e.velocity)); // the kick is a nod
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        s.lookTo = { x: (e.pan - 0.5) * 0.9, y: (0.5 - clamp((e.note - 48) / 36)) * 0.7 }; // the melody moves the lead's eyes
      } else if (slot === 'transition') { if (e.dur >= 1) s.flash = 1; }
      else if (slot === 'grain') blinkOne(s);
    }
  },

  draw(s, ctx, w, h) {
    const shot = shotOf(s) ?? { kind: 'line', who: [] }, lit = 1 - 0.5 * s.dark, floor = floorOf(s.u, s.ey), far = floor - 3 * ROW_BACK; // lit dims the set and the fog; a figure is always drawn solid (a translucent portrait shows every layer through itself) and the dropout's dark is the overlay at the end
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    graveyard(ctx, w, h, s.stones, { lit, floor, far });
    const k0 = h / s.u, sw = (400 / s.u) * h; // the front row's scale, and a figure's sheet width in canvas units
    // ponytail: up to ten portraits built and drawn every frame (portraitOps is a few hundred ops each); cache a figure's ops across frames while its pose holds if the listen wall stutters
    const paint = (f, x, feetY, k, dead, { mirror = 1, look = null, turn = 0 } = {}) => {
      const amp = s.amp * (1 - s.freeze), jit = f.lead ? 0 : 0.4 * Math.sin(s.t * 1.7 + f.jitter), snap = s.snap * s.snapDir * (f.lead ? 1 : 0.7) * mirror, c = f.cur;
      const p = dress(s.cast[f.id], { ...(dead ? f.st : { expression: 'deadpan' }), props: f.props, look: look ?? (f.lead ? s.look : { x: 0, y: 0.2 }),
        pose: { headX: mirror * c.headX * amp + 6 * snap, headY: c.headY * amp - 5 * s.bob * amp + 4 * jit, headTilt: mirror * c.tilt * amp + 0.02 * jit, bodyX: 0, bodyTilt: mirror * c.bodyTilt * amp, turn: mirror * c.turn * amp + 0.25 * snap + turn, shoulder: mirror * c.shoulder * amp + 0.15 * jit } });
      if (!dead) aliveOf(p, s.leadDecay, s.cast[f.id]); // the lead: alive, until the release lets the zombie through
      p.eyes.openness = p.eyes.openness * (1 - f.blink) * (1 - 0.9 * s.dark) + 0.02;
      const ey = eyeY(p), y = feetY - (FEET - ey) * k;
      floorShadow(ctx, x, feetY, (0.2 * h * k / k0) * p.body.width, 0.3 * lit);
      ctx.save(); ctx.beginPath(); ctx.rect(-w, -h, w * 3, feetY + FOG_CUT * k + h); ctx.clip(); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-200, -ey); drawOn(ctx, portraitOps(p), 1); ctx.restore(); // cut in the fog, below the feet
    };
    const corpse = (i) => s.figures[1 + ((i + s.variant) % SPOTS.length)]; // a close-up's corpse, the next one on every snare
    const front = floor * h;
    if (shot.kind === 'leadClose') paint(s.figures[0], w / 2, front, k0, false);
    else if (shot.kind === 'corpseClose') paint(corpse(shot.who[0]), w / 2, front, k0, true);
    else if (shot.kind === 'pair') { paint(corpse(shot.who[0]), w / 2 - 0.5 * sw, front, k0, true); paint(corpse(shot.who[1]), w / 2 + 0.5 * sw, front, k0, true); } // two of them in unison, the swing going the same way
    else if (shot.kind === 'faceOff') { paint(corpse(shot.who[0]), w / 2 + 0.42 * sw, front, k0, true, { look: { x: -0.9, y: 0.1 }, turn: -0.8 }); paint(s.figures[0], w / 2 - 0.42 * sw, front, k0, false, { look: { x: 0.9, y: 0.1 }, turn: 0.8 }); } // eye to eye, heads turned to each other, the lead nearer
    else if (shot.kind === 'wall') { // nine faces, three by three, each in its own jitter, all snapping together
      const cw = w / 3, ch = h / 3, k = k0 / 3;
      for (let c = 0; c < 9; c++) { ctx.save(); ctx.beginPath(); ctx.rect((c % 3) * cw, Math.floor(c / 3) * ch, cw, ch); ctx.clip(); paint(corpse(shot.who[c] ?? c), (c % 3) * cw + cw / 2, Math.floor(c / 3) * ch + ch * floorOf(FRAMING.close.u, FRAMING.close.ey), k, true); ctx.restore(); }
    } else { // the street: the horde back row first, each row clipped at its own ground line so the dead rise out of it, then the lead unless gone
      for (let row = 2; row >= 0; row--) {
        const rowFloor = (floor - (row + 1) * ROW_BACK) * h, k = k0 * (1 - ROW_SHRINK * (row + 1));
        ctx.save(); ctx.beginPath(); ctx.rect(-w, -h, w * 3, rowFloor + FOG_CUT * k + h); ctx.clip(); // the row's own line, so a rising figure comes up through it
        SPOTS.forEach((sp, i) => { const f = s.figures[i + 1], up = f.up * s.rise; if (sp.row !== row || up < 0.02) return; paint(f, w / 2 + sp.dx * sw * (1 - ROW_SHRINK * (row + 1)), rowFloor + (1 - up) * 0.55 * h * (k / k0), k, true); });
        ctx.restore();
        fogAt(ctx, w, h, rowFloor, lit, k);
      }
      if (shot.kind !== 'noLead') paint(s.figures[0], w / 2, front, k0, false);
    }
    if (floor < 1.1) fogAt(ctx, w, h, front, lit, k0);
    vignette(ctx, w, h, 0.45);
    if (s.flash > 0.02) { ctx.fillStyle = '#e8ecf4'; ctx.globalAlpha = 0.6 * s.flash; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (s.dark > 0.01) { ctx.fillStyle = `rgba(0 0 0 / ${0.5 * s.dark})`; ctx.fillRect(0, 0, w, h); } // the dropout: the street half dark, everyone still in it
    ctx.restore();
  },
};

/** A blink on one standing corpse, unless it blinked in the last few seconds. */
function blinkOne(s) {
  const up = s.figures.filter((f) => !f.lead && f.up > 0.5); if (!up.length) return;
  const f = up[Math.floor(rand(s) * up.length)]; if (s.t - f.lastBlink < BLINK_GAP) return; f.blink = 1; f.lastBlink = s.t;
}
