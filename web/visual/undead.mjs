// undead: the song as a night-street dance video after Thriller. One lead in a red jacket, alive, stands front and
// centre; behind them, in rows, the dead (cast.mjs identities over portrait.mjs, with the undead treatment on top)
// dance the same routine in unison, one step a beat, snapping into each position and holding it, the lead precise
// and every corpse a little off. The arrangement is the choreography: the song opens close on the lead alone (a
// sway), the horde rises out of the ground as the sections develop (three, then six, then nine), the loud sections
// dance the full routine (head snaps, claws up, the shoulder drop), the climax does it at full amplitude in the wide
// shot, and the release empties the street and pushes back in on the lead, whose face goes the way of the others as
// the song ends. A kick is a nod, a snare a head snap, a hi-hat a blink somewhere in the horde, the melody moves the
// lead's eyes, an fx impact is a flash frame, a riser raises the dead (they come up through the ground, clipped at
// their own floor line), a dropout freezes everyone mid-move and dims the moon. Deterministic: randomness only from
// the state's own generator.
//
// Two seams are left open for work landing elsewhere (the tableau's `thriller` theme, web/visual/thriller.mjs, in
// progress on main: zombie faces as makeup layers and poses as layoutOf partials), each one table or function here
// and nothing else aware of it: UNDEAD/undeadOf (the faces: today a stand-in from the parts that exist) and
// STEPS/ROUTINES (the poses: today head, shoulders and the two arm props the portrait has). See each seam's comment.
import { clamp, lerp, decay, ease, seed, rand, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY, mix } from './portrait.mjs';
import { identityOf, dress, ARCHETYPE_NAMES } from './cast.mjs';
import { graveyard, floorShadow, vignette } from './sets.mjs';
import { phaseOf } from './tableau.mjs';

const FEET = 600; // the sheet's torso runs to here: where the ground meets a standing figure
const SNAP = 9; // how fast a figure arrives in a step: a dance move lands, then holds
const BLINK_GAP = 2.5, MIN_GAP = 0.12; // seconds between blinks in the horde; between two snare snaps
const LEAD = 'slickGoldRed', LEAD_COSTUME = { costume: 'bomberStreetwear', variant: 1 }; // the red bomber
/** Framings: sheet units per canvas height and where the eye line sits (a fraction of the height), as the tableau's. */
export const FRAMING = { close: { u: 330, ey: 0.42 }, full: { u: 640, ey: 0.3 }, wide: { u: 900, ey: 0.3 } };
const floorOf = (u, ey) => ey + (FEET - 196) / u; // where the front row's feet land for a framing
/** Where the horde stands, in filling order: dx in figure widths from the centre, and the row back (0 is just behind the lead). */
export const SPOTS = [{ dx: -0.9, row: 0 }, { dx: 0.9, row: 0 }, { dx: 0, row: 1 }, { dx: -1.4, row: 1 }, { dx: 1.4, row: 1 }, { dx: -0.7, row: 2 }, { dx: 0.7, row: 2 }, { dx: -2.1, row: 2 }, { dx: 2.1, row: 2 }];
const ROW_BACK = 0.1, ROW_SHRINK = 0.16; // each row back: higher on the ground by this much of the height, and this much smaller
/** Ground fog lying on one row's line: the sheet's torso runs on past the feet, so every row stands in fog to the chest rather than ending in a cut. */
function fogAt(ctx, w, h, y, lit) {
  const g = ctx.createLinearGradient(0, y - 0.07 * h, 0, y + 0.18 * h); g.addColorStop(0, 'rgba(120 132 142 / 0)'); g.addColorStop(0.3, `rgba(120 132 142 / ${0.85 * lit})`); g.addColorStop(1, `rgba(60 70 76 / ${0.9 * lit})`);
  ctx.fillStyle = g; ctx.fillRect(-w, y - 0.07 * h, w * 3, 0.25 * h); // runs on below the line in a darker grey, so the sheet's end (a hundred units under the feet) never shows
}
/** How many of the dead are up in each phase (tableau's phaseOf names them from role and energy), which routine the street dances, and how big. */
export const PHASES = {
  opening: { horde: 0, routine: 'sway', amp: 0.5 },
  development: { horde: 3, routine: 'shamble', amp: 0.7 },
  escalation: { horde: 6, routine: 'thriller', amp: 0.85 },
  peak: { horde: 9, routine: 'thriller', amp: 1 },
  release: { horde: 0, routine: 'sway', amp: 0.4 },
};

// ---- SEAM: the zombie faces -----------------------------------------------------------------------------------------
// What makes a cast member one of the dead, at `decay` 0..1. Today a stand-in from the parts the portrait already
// has: the skin greyed and drained, dark sockets and heavy under-eyes, the mouth hanging open, the brows down. When
// the zombie faces land (the theme's own makeup and mark layers, registered into portrait.mjs's MAKEUP/MARKS, and
// its `styling(s, idn, P, tpl, i)` that dresses a corpse), UNDEAD.makeup takes those layer names and undeadOf keeps
// only what a dial still needs; the world calls nothing else.
export const UNDEAD = { makeup: ['darkEyeSockets', 'heavyUnderEye'], expression: 'stare', tint: '#6f7e62', drain: '#d9d6cf' };
export function undeadOf(p, decay = 1) {
  if (decay <= 0) return p;
  p.skin = mix(mix(p.skin, UNDEAD.drain, 0.45 * decay), UNDEAD.tint, 0.35 * decay);
  p.eyes = { ...p.eyes, openness: p.eyes.openness * (1 + 0.2 * decay), browLift: p.eyes.browLift - 2 * decay };
  p.mouth = { ...p.mouth, open: Math.max(p.mouth.open ?? 0, 0.3 * decay), smile: p.mouth.smile - 0.2 * decay };
  p.blush = 0; p.cheeks = 0;
  return p;
}

// ---- SEAM: the poses --------------------------------------------------------------------------------------------------
// A dance is a routine: a list of step names, one step a beat, repeating. A step is written in the tableau's layoutOf
// fields (headX, headY, tilt, bodyTilt, turn, shoulder, props), so a theme's pose partial (`poses[name](n, sw)[0]`)
// is a step as it stands. The world eases the numbers toward each step and swaps the arm props on the beat; nothing
// in it knows what a step contains. The new pose tech (full arms, hips, legs, a hand that interpolates) replaces
// STEPS' entries and `poseOf`; a routine stays a list of names.
export const STEPS = {
  rest: {},
  stare: { headY: -4 },
  leanL: { headX: -10, tilt: -0.14, bodyTilt: -0.08, turn: -0.5, shoulder: 0.6 },
  leanR: { headX: 10, tilt: 0.14, bodyTilt: 0.08, turn: 0.5, shoulder: -0.6 },
  snapL: { headX: -14, turn: -0.9, shoulder: 0.3 }, // the head snapped to one side, the body square
  snapR: { headX: 14, turn: 0.9, shoulder: -0.3 },
  clawsUp: { headY: -6, tilt: 0.05, shoulder: 0.2, props: ['handsUp'] },
  clawR: { headX: 6, turn: 0.3, shoulder: -0.5, props: ['armRaised'] },
  hunch: { headY: 14, tilt: 0.1, bodyTilt: 0.04, shoulder: 0.8 }, // the shamble: head forward, one shoulder dropped
};
export const ROUTINES = {
  sway: ['leanL', 'rest', 'leanR', 'rest'],
  shamble: ['hunch', 'leanL', 'hunch', 'leanR', 'hunch', 'leanL', 'snapR', 'stare'],
  thriller: ['snapR', 'clawsUp', 'snapL', 'clawsUp', 'leanR', 'leanL', 'clawR', 'hunch'],
  freeze: ['stare'],
};
const POSE_KEYS = ['headX', 'headY', 'tilt', 'bodyTilt', 'turn', 'shoulder'];
/** The step a routine is on at this moment of the clock: one step a beat, from the song's own bar and beat so live and offline agree. */
export const stepAt = (routine, clock) => { const r = ROUTINES[routine] ?? ROUTINES.sway; return r[(clock.bar * clock.beats + clock.beat) % r.length]; };
/** A step as numbers to ease and props to wear: every pose field present, zero where the step says nothing. */
const poseOf = (name) => { const { props = [], ...pose } = STEPS[name] ?? STEPS.rest; return { pose: { headX: 0, headY: 0, tilt: 0, bodyTilt: 0, turn: 0, shoulder: 0, ...pose }, props }; };

const figure = (id, lead) => ({ id, lead, up: lead ? 1 : 0, cur: poseOf('rest').pose, step: 'rest', props: [], jitter: 0, blink: 0, lastBlink: -BLINK_GAP });

export default {
  name: 'undead',

  init(score, rng, size) {
    const s = { size: { ...size }, slotOf: Object.fromEntries(Object.entries(score.cast ?? {}).map(([n, c]) => [n, c.slot])), cast: [], lead: 0, order: [], phases: [], section: -1, phase: 'opening', routine: 'sway', wanted: 0, t: 0, energy: 0.5, amp: 0.5, u: FRAMING.close.u, ey: FRAMING.close.ey, freeze: 0, dark: 0, flash: 0, bob: 0, snap: 0, snapDir: 1, lastSnap: -1, rise: 1, leadDecay: 0, look: { x: 0, y: 0 }, lookTo: { x: 0, y: 0 }, stones: [], figures: [] };
    seed(s, rng);
    s.cast = ARCHETYPE_NAMES.map((name, i) => identityOf(s, name, i));
    s.lead = ARCHETYPE_NAMES.indexOf(LEAD);
    s.order = s.cast.map((_, i) => i).filter((i) => i !== s.lead); for (let i = s.order.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [s.order[i], s.order[j]] = [s.order[j], s.order[i]]; }
    s.figures = [figure(s.lead, true), ...SPOTS.map((_, i) => ({ ...figure(s.order[i], false), jitter: rand(s) * Math.PI * 2 }))]; // the lead, then one corpse per spot, each with its own wobble phase
    let x = -0.1; while (x < 1.1) { if (rand(s) < 0.7) s.stones.push({ x, w: 0.03 + rand(s) * 0.03, h: 0.07 + rand(s) * 0.08 }); x += 0.06 + rand(s) * 0.1; }
    const sections = score.sections.length ? score.sections : [{ name: null, role: null, energy: 0.5, bars: 64 }];
    s.phases = sections.map((_, i) => phaseOf(sections, i, score.climax));
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    const ix = Math.max(0, Math.min(clock.index, s.phases.length - 1)); s.section = ix; s.phase = s.phases[ix] ?? 'opening';
    const P = PHASES[s.phase], local = clock.bar + clock.barPhase;
    s.routine = P.routine; s.wanted = P.horde;
    s.freeze = ease(s.freeze, clock.dropout ? 1 : 0, 6, dt); // a dropout: everyone holds mid-move
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.rise = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 1; // a riser: the dead come up through the ground over its bars
    s.leadDecay = ease(s.leadDecay, s.phase === 'release' ? 1 : 0, 0.5, dt); // the ending: the lead's face goes the way of the others
    const close = (s.phase === 'opening' && local < 4) || (s.phase === 'release' && s.leadDecay > 0.35), fr = close ? FRAMING.close : s.wanted >= 6 ? FRAMING.wide : FRAMING.full;
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
        if (e.role === 'impact') { if (s.t - s.lastSnap > MIN_GAP) { s.snap = 1; s.snapDir = -s.snapDir; s.lastSnap = s.t; } }
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
    const lit = 1 - 0.7 * s.dark, floor = floorOf(s.u, s.ey), far = floor - 3 * ROW_BACK;
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    graveyard(ctx, w, h, s.stones, { lit, floor, far });
    const k0 = h / s.u, sw = (400 / s.u) * h; // the front row's scale, and a figure's sheet width in canvas units
    // ponytail: up to ten portraits built and drawn every frame (portraitOps is a few hundred ops each); cache a figure's ops across frames while its pose holds if the listen wall stutters
    const paint = (f, x, feetY, k, dead) => {
      const amp = s.amp * (1 - s.freeze), jit = f.lead ? 0 : 0.4 * Math.sin(s.t * 1.7 + f.jitter), snap = s.snap * s.snapDir * (f.lead ? 1 : 0.7);
      const p = dress(s.cast[f.id], { ...(f.lead ? LEAD_COSTUME : {}), ...(dead ? { makeup: UNDEAD.makeup, expression: UNDEAD.expression } : { expression: 'deadpan' }), props: f.props, look: f.lead ? s.look : { x: 0, y: 0.2 },
        pose: { headX: f.cur.headX * amp + 6 * snap, headY: f.cur.headY * amp - 5 * s.bob * amp + 4 * jit, headTilt: f.cur.tilt * amp + 0.02 * jit, bodyX: 0, bodyTilt: f.cur.bodyTilt * amp, turn: f.cur.turn * amp + 0.25 * snap, shoulder: f.cur.shoulder * amp + 0.15 * jit } });
      if (dead) undeadOf(p, 0.6 + 0.4 * s.energy); else if (s.leadDecay > 0.01) undeadOf(p, s.leadDecay);
      p.eyes.openness = p.eyes.openness * (1 - f.blink) * (1 - 0.9 * s.dark) + 0.02;
      const ey = eyeY(p), y = feetY - (FEET - ey) * k;
      floorShadow(ctx, x, feetY, (0.2 * h * k / k0) * p.body.width, 0.3 * lit);
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-200, -ey); drawOn(ctx, portraitOps(p), lit); ctx.restore();
    };
    for (let row = 2; row >= 0; row--) { // the horde, back row first, each row clipped at its own ground line so the dead rise out of it
      const rowFloor = (floor - (row + 1) * ROW_BACK) * h, k = k0 * (1 - ROW_SHRINK * (row + 1));
      ctx.save(); ctx.beginPath(); ctx.rect(-w, -h, w * 3, rowFloor + h); ctx.clip();
      SPOTS.forEach((sp, i) => { const f = s.figures[i + 1], up = f.up * s.rise; if (sp.row !== row || up < 0.02) return; paint(f, w / 2 + sp.dx * sw * (1 - ROW_SHRINK * (row + 1)), rowFloor + (1 - up) * 0.55 * h * (k / k0), k, true); });
      ctx.restore();
      fogAt(ctx, w, h, rowFloor, lit);
    }
    paint(s.figures[0], w / 2, floor * h, k0, false);
    if (floor < 1.05) fogAt(ctx, w, h, floor * h, lit);
    vignette(ctx, w, h, 0.45);
    if (s.flash > 0.02) { ctx.fillStyle = '#e8ecf4'; ctx.globalAlpha = 0.6 * s.flash; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (s.dark > 0.01) { ctx.fillStyle = `rgba(0 0 0 / ${0.4 * s.dark})`; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  },
};

/** A blink on one standing corpse, unless it blinked in the last few seconds. */
function blinkOne(s) {
  const up = s.figures.filter((f) => !f.lead && f.up > 0.5); if (!up.length) return;
  const f = up[Math.floor(rand(s) * up.length)]; if (s.t - f.lastBlink < BLINK_GAP) return; f.blink = 1; f.lastBlink = s.t;
}
