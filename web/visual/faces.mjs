// faces: the song as portraits (portrait.mjs), one face close up, hat to collar, and now and then the camera pulls
// back to show three, the last two it cut from at its sides. Every face is drawn from the song: skin, hair, features
// and wardrobe by the state's seeded generator, the hat by the section's role, hat and shirt colours from the
// palette, the smile from the section's energy. An impact (snare, clap) pops to a new face, and a bar that passes with
// no impact pops one too, so a song without a snare still cuts; a boundary pops with the new section's wardrobe and
// picks the shot again (as does every fourth bar): close most of the time, wide one time in three, eased like a
// camera move. The live face is played: the character sways with the bar, the head riding on the neck and the
// shoulders leaning a little the other way, harder the more energy; the smile is the music's,
// the section's energy underneath, a grin on every kick, wider on a high melody note and flatter on a low one; a
// kick nods the head, a snare widens the eyes and cocks a brow, a blink lands on a hi-hat but only every few
// seconds, the melody moves the eyes (pan is left-right, height is up-down) and lifts the brows, a counter part tilts the head, the bass tints the background by pitch class, the pad is a glow behind the
// head (its cutoff warm or cold), the section's energy blushes the cheeks, a riser zooms in on the eyes, an fx
// impact flashes, a dropout shuts the eyes and dims the room. Deterministic: randomness only from the
// state's own generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY } from './portrait.mjs';
import { characterOf } from './cast.mjs';
import { drive, reading } from './hooks.mjs';
export { characterOf }; // the generator lives in cast.mjs (shared with tableau); faces.html and the test still read it here

/**
 * What this world does, in its own words, and what drives each of them by default. A binding replaces the `src` (who
 * feeds it) and scales the result, so "the melody moves the eyes" is the default and "the bass moves the eyes, when
 * it is loud" is a source and a threshold away. The defaults are exactly what faces did before it published these.
 */
export const hooks = {
  cut: { label: 'cuts to a new face', src: '@impulse:impact', reads: 'gain' },
  stare: { label: 'widens the eyes', src: '@impulse:impact', reads: 'gain' },
  cock: { label: 'cocks a brow and tilts', src: '@impulse:impact', reads: 'pan' },
  blink: { label: 'blinks', src: '@impulse:grain', reads: 'gain' },
  nod: { label: 'nods the head', src: '@impulse', except: ['impact', 'grain'], reads: 'gain' },
  grin: { label: 'grins', src: '@impulse', except: ['impact', 'grain'], reads: 'gain' },
  eyes: { label: 'moves the eyes', src: '@line', reads: 'note' },
  brow: { label: 'lifts the brows', src: '@line', reads: 'note' },
  smile: { label: 'bends the smile', src: '@line', reads: 'note' },
  lean: { label: 'leans the head', src: '@counter', reads: 'pan' },
  tint: { label: 'tints the room', src: '@ground', reads: 'note' },
  sway: { label: 'sways to it', src: '@ground', reads: 'gain' },
  glow: { label: 'glows behind the head', src: '@field', reads: 'gain' },
  warm: { label: 'warms or cools the glow', src: '@field', reads: 'cutoff' },
  flash: { label: 'flashes the frame', src: '@transition', reads: 'dur' },
};

const SHEET = { w: 400, h: 480 };
const MIN_GAP = 0.15; // seconds between two pops
const CLOSE = 480 / 330, WIDE = 0.8; // the sheet's scale in the two shots: close crops hat to collar, wide stands three
const WIDE_ODDS = 1 / 3;
const BLINK_GAP = 2.5; // seconds between blinks: a blink lands on a hit, but a face does not blink on every hi-hat

/** A blink on this hit, with a brow twitch, unless one landed in the last few seconds. */
const blink = (s) => { if (s.t - s.lastBlink < BLINK_GAP) return; s.blink = 1; s.lastBlink = s.t; s.skewSide = -s.skewSide; s.skew = 0.4 * s.skewSide; };
/** Pick the shot: close most of the time, wide (three faces) one time in three. */
const shot = (s) => { s.wideTo = rand(s) < WIDE_ODDS ? 1 : 0; };
/** Cut to a new face: the live one steps aside. */
function pop(s, role, energy) {
  s.faces.unshift(characterOf(s, role, energy));
  s.faces.length = Math.min(s.faces.length, 3);
  s.pop = 1; s.count++; s.lastPop = s.t; s.popped = true;
}

export default {
  name: 'faces',

  init(score, rng, size) {
    const aspect = size.w / size.h, s = {
      pal: paletteOf(score, rng), size: { ...size }, aspect,
      roles: score.sections.map((x) => x.role ?? 'none'), section: null, role: 'none',
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      faces: [], count: 0, pop: 0, lastPop: -1, popped: false, bar: -1, t: 0, wide: 0, wideTo: 0,
      bob: 0, grin: 0, blink: 0, lastBlink: -BLINK_GAP, look: { x: 0, y: 0 }, lookTo: { x: 0, y: 0 }, brow: 0, browTo: 0, smile: 0.1, tilt: 0, tiltTo: 0,
      sway: 0, swayAmp: 0.3, stare: 0, tune: 0, skew: 0, skewSide: 1, blush: 0,
      hueShift: 0, hueTo: 0, glow: 0, warm: 0.5, flash: 0, riser: 0, dark: 0, energy: 0.5,
    };
    seed(s, rng);
    s.role = s.roles[0] ?? 'none';
    for (let i = 0; i < 3; i++) pop(s, s.role, score.sections[0]?.energy ?? 0.5);
    s.pop = 0; s.count = 0; s.lastPop = -1;
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    if (clock.boundary || (clock.index >= 0 && s.section === null)) { s.section = clock.section; s.role = s.roles[clock.index] ?? 'none'; pop(s, s.role, clock.energy); shot(s); }
    if (clock.bar !== s.bar) { if (s.bar >= 0 && !s.popped && s.t - s.lastPop > MIN_GAP) pop(s, s.role, clock.energy); if (clock.bar % 4 === 0 && s.bar >= 0) shot(s); s.bar = clock.bar; s.popped = false; }
    s.wide = ease(s.wide, s.wideTo, 2.5, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.sway = Math.sin(((clock.bar % 2) + clock.barPhase) * Math.PI) * s.swayAmp; // one sway per two bars, from the song's own clock
    s.swayAmp = ease(s.swayAmp, lerp(0.15, 1, s.energy) * (1 - 0.8 * s.dark), 1, dt); s.blush = ease(s.blush, 0.8 * s.energy, 0.5, dt);
    s.stare = decay(s.stare, 6, dt); s.tune = ease(s.tune, 0, 0.4, dt); s.skew = decay(s.skew, 5, dt);
    s.pop = decay(s.pop, 9, dt); s.bob = decay(s.bob, 6, dt); s.grin = decay(s.grin, 4, dt); s.blink = decay(s.blink, 20, dt); s.flash = decay(s.flash, 5, dt); s.glow = decay(s.glow, 0.5, dt);
    s.look.x = ease(s.look.x, s.lookTo.x, 9, dt); s.look.y = ease(s.look.y, s.lookTo.y, 9, dt); s.brow = ease(s.brow, s.browTo, 6, dt); s.tilt = ease(s.tilt, s.tiltTo, 5, dt);
    s.smile = ease(s.smile, lerp(-0.15, 0.45, s.energy) + 0.5 * s.tune + 0.35 * s.grin, 6, dt); s.hueShift = ease(s.hueShift, s.hueTo, 2, dt);
    s.lookTo.x = ease(s.lookTo.x, 0, 0.6, dt); s.lookTo.y = ease(s.lookTo.y, 0, 0.6, dt); s.browTo = ease(s.browTo, 0, 0.8, dt); s.tiltTo = ease(s.tiltTo, 0, 1, dt);
    // Every event is offered to every hook, and a hook takes it when its source says so. `drive` returns how hard,
    // which is the reading (gain, pitch, pan...) past the hook's threshold and scaled by its depth, so a slider on
    // any of them is felt without the world being rebuilt: the bindings are read here, every step.
    for (const e of events) {
      const b = s.bind ?? {}, at = (k) => drive(hooks[k], b[k], e, s.slotOf), g = clamp(e.gain * e.velocity, 0, 1.5);
      let took = false;
      if (at('cut') > 0) { if (s.t - s.lastPop > MIN_GAP) pop(s, s.role, clock.energy); took = true; }
      if (at('stare') > 0) { s.stare = 1; took = true; }
      if (at('cock') > 0) { const pan = reading(hooks.cock, b.cock, e, 'pan'); s.tiltTo = (pan - 0.5) * 0.3; s.skew = pan < 0.5 ? -1 : 1; took = true; }
      if (at('blink') > 0) { blink(s); took = true; }
      const nod = at('nod'); if (nod > 0) { s.bob = Math.max(s.bob, nod * 1.5); took = true; }
      const grin = at('grin'); if (grin > 0) { s.grin = Math.max(s.grin, grin * 1.5); took = true; }
      const sway = at('sway'); if (sway > 0) { s.bob = Math.max(s.bob, 0.3 * sway * 1.5); took = true; }
      if (at('tint') > 0 && e.note !== null) { s.hueTo = ((e.note % 12) / 12) * 80 - 40; took = true; }
      const up = e.note === null ? null : clamp((e.note - 48) / 36);
      if (at('eyes') > 0 && up !== null) { s.lookTo = { x: (e.pan - 0.5) * 2, y: 1 - 2 * up }; took = true; }
      if (at('brow') > 0 && up !== null) { s.browTo = 8 * up; took = true; }
      if (at('smile') > 0 && up !== null) { s.tune = up - 0.5; took = true; }
      if (at('lean') > 0 && up !== null) { s.tiltTo = (e.pan - 0.5) * 0.4 + (up - 0.5) * 0.2; took = true; }
      const glow = at('glow'); if (glow > 0) { s.glow = Math.min(1, 0.5 + 0.5 * glow * 1.5); took = true; }
      if (at('warm') > 0 && e.cutoff !== null) { s.warm = 1 - reading(hooks.warm, b.warm, e, 'cutoff'); took = true; }
      if (at('flash') > 0 && e.dur >= 1) { s.flash = 1; took = true; }
      if (!took) blink(s); // a part nothing claimed still registers, as it always did
    }
  },

  draw(s, ctx, w, h) {
    const lit = 1 - 0.55 * s.dark, hue = s.pal.hue + s.hueShift, k = h / SHEET.h;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = hsla(hue, s.pal.sat * 0.5, lerp(9, 22, s.energy) * lit); ctx.fillRect(0, 0, w, h);
    const glowHue = lerp(205, 40, s.warm), gx = w / 2, gy = h * 0.4, gr = h * 0.6;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr); g.addColorStop(0, hsla(glowHue, 60, 60, 0.45 * s.glow * lit + 0.06)); g.addColorStop(1, hsla(glowHue, 60, 50, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // the two last faces at the sides: in shadow (a filter, not alpha: a translucent face shows its hair through its skin), off frame in the close shot
    const zoom = (1 - 0.08 * s.pop) * (1 + 0.04 * s.bob) * (1 + 0.35 * s.riser), k0 = k * lerp(CLOSE, WIDE, s.wide), ey = s.faces[0] ? eyeY(s.faces[0]) : 196;
    const eyeLine = h * lerp(0.42, 0.98 - (SHEET.h - ey) * WIDE / SHEET.h, s.wide); // where the live eyes sit: high in the close crop, feet on the floor in the wide shot; the pivot of every scale
    for (let i = Math.min(2, s.faces.length - 1); i >= 1; i--) {
      const dx = (i === 1 ? -1 : 1) * lerp(1.4, 0.56, s.wide) * h, sk = k0 * 0.75;
      ctx.save(); ctx.filter = `brightness(${(0.55 * lit).toFixed(2)}) saturate(.75)`; ctx.translate(w / 2 + dx, eyeLine + h * 0.08); ctx.scale(sk, sk); ctx.translate(-SHEET.w / 2, -eyeY(s.faces[i]));
      drawOn(ctx, portraitOps(s.faces[i])); ctx.restore();
    }
    // the live face: bobbed, tilted, popped in, zoomed on the eyes by a riser
    const f = s.faces[0]; if (!f) return;
    const live = { ...f, blush: (f.cheeks ?? 0.5) * (0.3 + 0.7 * s.blush + 0.3 * s.stare), pose: { ...f.pose, headX: s.sway * 10.8, headY: (f.pose?.headY ?? 0) - 8 * s.bob, headTilt: (f.pose?.headTilt ?? 0) + s.sway * 0.08 + s.tilt, bodyX: -s.sway * 5, bodyTilt: (f.pose?.bodyTilt ?? 0) - s.sway * 0.035 }, // the dance over the character's own stance (turn, a dropped shoulder, a tilt)
      eyes: { ...f.eyes, openness: (f.eyes.openness * (1 + 0.5 * s.stare) * (1 - s.blink) * (1 - 0.85 * s.dark)) + 0.02, browLift: f.eyes.browLift + s.brow + 3 * s.bob + 4 * s.stare, browSkew: s.skew, look: { x: s.look.x, y: s.look.y } },
      mouth: { ...f.mouth, width: f.mouth.width * (1 + 0.15 * s.grin), smile: s.smile } };
    ctx.save(); // the sheet itself only scales about the eyes (a pop, a riser); the dance is in the pose
    ctx.translate(w / 2 + (f.frame ?? 0) * h * (1 - s.wide), eyeLine); ctx.scale(k0 * zoom, k0 * zoom); ctx.translate(-SHEET.w / 2, -ey); // the character enters the close shot where they stand, off centre; the wide shot centres the three
    drawOn(ctx, portraitOps(live), lit);
    ctx.restore();
    if (s.flash > 0.01) { ctx.fillStyle = `rgba(255 250 235 / ${0.6 * s.flash})`; ctx.fillRect(0, 0, w, h); }
    if (s.pop > 0.01) { ctx.fillStyle = `rgba(255 255 255 / ${0.18 * s.pop})`; ctx.fillRect(0, 0, w, h); }
    if (s.dark > 0.01) { ctx.fillStyle = `rgba(0 0 0 / ${0.4 * s.dark})`; ctx.fillRect(0, 0, w, h); }
  },
};
