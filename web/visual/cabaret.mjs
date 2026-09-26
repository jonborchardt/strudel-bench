// cabaret: the parlor's walker, the resident behind the walking frame, given the stage he always wanted. A
// proscenium seen from the stalls: boards, a footlight rail along the front, a painted backdrop rolling slowly
// behind, red velvet at either side and a spotlight from the gods. He is the star and the song is his act. The
// impulse part (the kit) is his feet: a kick is one step of the shuffle, along the stage the way he is already going
// and turning at the wings, so a steady kick walks him across and back; a snare or a clap is a hop, frame and all; the
// beat bobs him. He has a hard time of it: a kick that lands while he is
// still mid-step staggers him (a lean, the frame tipping), and a run of quick kicks, a fill, spins him round to face
// the other way. Two follow-spots from the back corners of the house: the melody drives the first (every note pulls it
// to where that note sits in the part's own register, low stage-left, high stage-right, tinted by the pitch class, so a
// rising line walks the light across the boards ahead of him; between notes it drifts back to him), a counter part the
// second, in its own colour, which goes out when its part stops. The curtains hang still
// and only their leading edges flap, a little always, more when a pad note stirs them; a boundary flaps them hard,
// changes the flat behind, and turns him to face the other way. The backdrop is three painted flats the way a school play does it, a sky
// with the sun or moon, a row of hills, and the near scenery (trees, a town or the sea) on its own roller, each rolling
// at its own speed so they slide past each other; the bass shoves them (a low note a jolt, the near flat wobbling on
// its roller), and the roll itself follows the energy. The grain parts (hats, perc) are the chorus line: a hit now and then
// sends another walker with a frame crossing upstage behind him, more of them at a climax, stepping on the hits as he
// does and off at the far wing; now and then one of them comes across on wires from the flies instead, frame held
// out in front, legs stepping on nothing, swinging a little as he goes. A riser dims the house and tightens the spot to a pin on him; a climax is the big number: the
// footlights go to colour and the second spot comes up and sweeps the stage; the dropout is his bow, held until the song comes back; an fx impact
// is the flash bulb. Deterministic: randomness only from the state's own
// generator (kit.mjs); units are the canvas height; the whole frame is repainted from state every draw.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, DEFAULT_SLOT } from './kit.mjs';
import { character, walker as figure, pitch, pc, seen, place } from './parlor.mjs';

const TAU = Math.PI * 2;
const ACT = { establish: { chorus: 0.15, roll: 0.6, glitz: 0 }, develop: { chorus: 0.3, roll: 1, glitz: 0 }, climax: { chorus: 0.6, roll: 1.6, glitz: 1 }, release: { chorus: 0.2, roll: 0.7, glitz: 0 }, none: { chorus: 0.3, roll: 1, glitz: 0 } };
const FLATS = [0.35, 0.65, 1]; // how fast each painted flat rolls against the roll: the sky, the hills, the near scenery
const SKY = { cool: { top: [215, 55, 30], low: [205, 45, 60], moon: 0 }, warm: { top: [265, 45, 30], low: [25, 85, 62], moon: 0 }, dim: { top: [235, 45, 8], low: [240, 35, 18], moon: 1 }, pale: { top: [205, 15, 55], low: [200, 12, 78], moon: 0 } };
const MAX_CHORUS = 5, FLOOR = 0.86, BACK = 0.62, OPEN = 0.72; // the star's floor line and the chorus line's, in canvas heights; how far the curtains stand open

export default {
  name: 'cabaret',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng), aspect = size.w / size.h;
    const s = {
      pal, aspect, temp: SKY[p.temperature] ? p.temperature : 'cool', motion: lerp(0.7, 1.3, p.motion),
      cps: score.cps, roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0, energy: 0.5, act: { ...ACT.none }, riser: 0, dark: 0, flash: 0, beat: 0, lastBeat: -1,
      parts: {}, // per part: its register so far, { lo, hi }
      star: null, // the resident with the frame, centre stage
      spots: [0, 1].map((side) => ({ side, x: aspect / 2, to: aspect / 2, hue: pal.hue + side * 150, hueTo: pal.hue + side * 150, on: 1 - side, pin: 0, away: 9 })), // the follow-spots, one from each back corner: where each is, where a note sent it, seconds since a note; the first is the melody's and always on, the second a counter part's
      curtain: { breath: 0, call: 0, flap: 1 }, // the pad's stir, a boundary's, and how hard the edge flaps
      scene: { roll: 0, shove: 0, wobble: 0, kind: 0, stars: [], hills: [] }, // the backdrop's scroll, the bass's jolt and the near flat's wobble from it, which painted scenery, its stars and hills
      chorus: [], // walkers crossing upstage: { ...walker, x, to, dir, life }
      bow: 0, bulb: 0,
    };
    seed(s, rng);
    s.star = { ...walker(s), x: aspect / 2, to: aspect / 2 };
    for (let k = 0; k < 24; k++) s.scene.stars.push({ u: rand(s), v: rand(s) * 0.5, tw: rand(s) * TAU });
    for (let k = 0; k < 7; k++) s.scene.hills.push({ u: k / 7 + rand(s) * 0.1, h: 0.08 + rand(s) * 0.12, w: 0.2 + rand(s) * 0.2 });
    s.scene.kind = Math.floor(rand(s) * 3);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = ACT[role] ?? ACT.none;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.act[k] = ease(s.act[k], want[k], 1.2, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.bow = ease(s.bow, clock.dropout ? 1 : 0, 2.5, dt);
    s.flash = decay(s.flash, 6, dt); s.bulb = decay(s.bulb, 8, dt);
    if (clock.beat !== s.lastBeat) { s.lastBeat = clock.beat; s.beat = 1; }
    s.beat = decay(s.beat, 6, dt);
    const S = s.star, C = s.curtain, [P, P2] = s.spots;
    if (clock.boundary) { // a call: the curtain flaps, the near flat changes, he turns to face the other way
      C.call = 1; s.scene.kind = (s.scene.kind + 1) % 3; S.dir = -S.dir; S.turn = 1;
      for (const w of s.chorus) w.step = 1;
    }
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      const q = s.parts[e.layer ?? slot] ?? (s.parts[e.layer ?? slot] = { lo: 0.45, hi: 0.55 });
      if (e.note !== null) seen(q, pitch(e.note));
      if (slot === 'transition') { if (e.dur >= 1) s.flash = Math.max(s.flash, 1); s.bulb = 1; continue; }
      if (slot === 'impulse') { // his feet: a kick a step, a snare a hop; a kick while he is still mid-step is a stagger, a run of them a spin
        if (e.role === 'impact') { S.hop = 1; for (const w of s.chorus) w.hop = 0.6; }
        else {
          if (S.bob > 0.45) S.stagger = 1;
          stepTo(s, S, 0.05 * g * (S.bob > 0.45 ? 0.5 : 1), s.aspect * 0.2, s.aspect * 0.8);
          S.burst += 1; if (S.burst > 3.2) { S.burst = 0; S.dir = -S.dir; S.turn = 1; S.stagger = 1; }
        }
        S.bob = 1;
      } else if (slot === 'ground') { s.scene.shove = clamp(s.scene.shove + g * (0.6 + 0.6 * (1 - pitch(e.note ?? 48))), 0, 3); S.nod = 1; }
      else if (slot === 'line' || slot === 'counter') { // its spot goes where the note sits in this part's register, in the pitch class's colour
        const where = e.note === null ? rand(s) : place(q, pitch(e.note)), Q = slot === 'line' ? P : P2;
        Q.to = s.aspect * lerp(0.22, 0.78, where); Q.hueTo = e.note === null ? Q.hueTo : pc(e.note) + Q.side * 150; Q.away = 0; Q.pin = Math.max(Q.pin, 0.4 * g);
      } else if (slot === 'field') { C.breath = Math.min(1, C.breath + 0.5 * g); }
      else { // grain: the chorus steps, and now and then one more joins from a wing
        for (const w of s.chorus) w.step = 1;
        if (s.chorus.length < MAX_CHORUS && rand(s) < s.act.chorus * 0.35 * g) {
          const dir = rand(s) < 0.5 ? 1 : -1, w = { ...walker(s), dir, x: dir > 0 ? -0.3 : s.aspect + 0.3, life: 0, z: rand(s), step: 1, fly: rand(s) < 0.22 ? 0.15 + rand(s) * 0.12 : 0 }; // fly: how high off the boards, on wires from the flies (his head clear of the pelmet)
          w.to = w.x; s.chorus.push(w);
        }
      }
    }
    // the star: eases to where his last step sent him, bobs, and settles
    S.x = ease(S.x, S.to, 7, dt); S.bob = decay(S.bob, 5, dt); S.hop = decay(S.hop, 4, dt); S.nod = decay(S.nod, 3, dt); S.turn = decay(S.turn, 2.5, dt);
    S.stagger = decay(S.stagger, 3, dt); S.burst = decay(S.burst, 3, dt);
    S.rest = ease(S.rest, S.bob < 0.05 ? 1 : 0, 0.7, dt);
    // the spots: the first to the note's place, then back to him, a riser pinning it tight; the second on while its part plays, or sweeping in a climax
    P.away += dt; P2.away += dt;
    if (P.away > 0.6) P.to = ease(P.to, S.x, 1.5, dt);
    P.x = ease(P.x, P.to, 6, dt); P.hue = ease(P.hue, P.hueTo, 3, dt); P.pin = ease(P.pin, s.riser, 2, dt);
    P.on = ease(P.on, 1 - 0.6 * s.dark, 2, dt);
    const sweeping = P2.away > 2 && s.act.glitz > 0.3;
    if (sweeping) P2.to = s.aspect * (0.5 + 0.3 * Math.sin(s.t * 0.9));
    P2.x = ease(P2.x, P2.to, sweeping ? 3 : 6, dt); P2.hue = ease(P2.hue, P2.hueTo, 3, dt); P2.pin = decay(P2.pin, 1, dt);
    P2.on = ease(P2.on, (P2.away < 2 ? 1 : 0.7 * s.act.glitz) * (1 - 0.6 * s.dark), 2, dt);
    // the curtains hang still; only the leading edge flaps, a little always, more with a pad note or a call
    C.breath = decay(C.breath, 1.5, dt); C.call = decay(C.call, 1.1, dt);
    C.flap = ease(C.flap, 1 + 2 * C.breath + 3 * C.call, 3, dt);
    // the backdrop rolls: by energy and the act, plus the bass's shove
    s.scene.shove = decay(s.scene.shove, 2, dt); s.scene.wobble = ease(s.scene.wobble, Math.sin(s.t * 9) * 0.006 * s.scene.shove, 8, dt);
    s.scene.roll += dt * 0.012 * s.motion * s.act.roll * (0.5 + s.energy) * (1 + s.scene.shove);
    // the chorus crosses upstage: a step per hit, and always a little drift so nobody stands still, off at the far wing
    for (const w of s.chorus) {
      w.life += dt;
      if (w.step) { w.to += w.dir * 0.06; w.bob = 1; w.foot = -w.foot; w.step = 0; }
      w.to += w.dir * dt * 0.03 * (0.5 + s.energy);
      w.x = ease(w.x, w.to, 7, dt); w.bob = decay(w.bob, 5, dt); w.hop = decay(w.hop, 4, dt);
      w.rest = ease(w.rest, w.bob < 0.05 ? 1 : 0, 0.7, dt);
    }
    s.chorus = s.chorus.filter((w) => w.x > -0.5 && w.x < s.aspect + 0.5);
  },

  draw(s, ctx, w, h) {
    const { pal, aspect } = s, night = s.temp === 'dim', lit = 1 - 0.7 * s.dark - 0.35 * s.riser, hue = pal.hue;
    const X = (x) => (x / aspect) * w, R = (u) => u * h;
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the house: black, and the backdrop between the flats
    ctx.fillStyle = hsla(hue, 20, 3); ctx.fillRect(0, 0, w, h);
    const bx0 = X(aspect * 0.08), bx1 = X(aspect * 0.92), by0 = R(0.1), by1 = R(BACK + 0.02);
    ctx.save(); ctx.beginPath(); ctx.rect(bx0, by0, bx1 - bx0, by1 - by0); ctx.clip();
    backdrop(ctx, s, bx0, bx1, by0, by1, lit);
    ctx.restore();
    // the boards, from the back line down to the footlights, grained, lit from the front
    const boards = ctx.createLinearGradient(0, by1, 0, h); boards.addColorStop(0, hsla(30, 35, 22 * lit)); boards.addColorStop(1, hsla(30, 40, 38 * lit));
    ctx.fillStyle = boards; ctx.fillRect(0, by1, w, h - by1);
    ctx.strokeStyle = hsla(30, 30, 14 * lit, 0.6); ctx.lineWidth = Math.max(1, R(0.002));
    for (let k = 0; k < 14; k++) { const u = k / 14, x0 = lerp(bx0, bx1, u), x1 = lerp(0, w, u); ctx.beginPath(); ctx.moveTo(x0, by1); ctx.lineTo(x1, h); ctx.stroke(); }
    // each follow-spot's pool on the boards and its beam from its back corner of the house
    ctx.globalCompositeOperation = 'lighter';
    for (const P of s.spots) {
      if (P.on < 0.02) continue;
      const sx = X(P.x), pin = P.pin, pr = R(lerp(0.32, 0.14, pin)), sat = 55 + 30 * pin, ox = P.side ? w + R(0.05) : -R(0.05);
      const pool = ctx.createRadialGradient(sx, R(FLOOR), 0, sx, R(FLOOR), pr); pool.addColorStop(0, hsla(P.hue, sat, 70, 0.5 * P.on)); pool.addColorStop(1, hsla(P.hue, sat, 70, 0));
      ctx.save(); ctx.translate(sx, R(FLOOR)); ctx.scale(1, 0.35); ctx.translate(-sx, -R(FLOOR)); ctx.fillStyle = pool; ctx.fillRect(sx - pr, R(FLOOR) - pr, pr * 2, pr * 2); ctx.restore();
      const beam = ctx.createLinearGradient(0, 0, 0, R(FLOOR)); beam.addColorStop(0, hsla(P.hue, sat, 75, 0.02 * P.on)); beam.addColorStop(1, hsla(P.hue, sat, 75, 0.16 * P.on));
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(ox - R(0.02), 0); ctx.lineTo(ox + R(0.02), 0); ctx.lineTo(sx + pr, R(FLOOR)); ctx.lineTo(sx - pr, R(FLOOR)); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // the chorus line, upstage, small, then the star downstage
    const chorus = s.chorus.slice().sort((a, b) => a.z - b.z);
    for (const c of chorus) {
      const U = R(lerp(0.13, 0.16, c.z)), dimz = lerp(0.55, 0.7, c.z) * lit, tone = ([hh, ss, ll], a = 1) => hsla(hh, ss, ll * dimz, a), fy = R(lerp(BACK + 0.07, FLOOR - 0.12, c.z));
      if (!c.fly) { figure(ctx, c, X(c.x), fy, U, s, tone); continue; }
      // on wires from the flies: hung from the pelmet, swinging as he goes, the frame held out in front and the legs stepping on nothing
      const top = R(0.085), L = fy - R(c.fly) - top, ang = Math.sin(s.t * 1.4 * s.motion + c.ph) * 0.07 * (1 + c.bob) + c.dir * 0.03;
      ctx.fillStyle = 'rgba(0 0 0 / 0.15)'; ctx.beginPath(); ctx.ellipse(X(c.x) + Math.sin(ang) * L, fy, U * 0.7, U * 0.08, 0, 0, TAU); ctx.fill(); // his shadow, on the boards below
      ctx.save(); ctx.translate(X(c.x), top); ctx.rotate(ang);
      ctx.strokeStyle = 'rgba(0 0 0 / 0.6)'; ctx.lineWidth = Math.max(1, R(0.0015));
      ctx.beginPath(); ctx.moveTo(-U * 0.1, 0); ctx.lineTo(c.dir * U * 0.05, L - U * 1.45); ctx.moveTo(U * 0.1, 0); ctx.lineTo(c.dir * U * 0.28, L - U * 0.75); ctx.stroke(); // two wires: one to the harness, one to the frame
      figure(ctx, c, 0, L, U, s, tone, 0, false);
      ctx.restore();
    }
    const S = s.star, U = R(0.22), glow = Math.max(...s.spots.map((P) => clamp(1 - Math.abs(S.x - P.x) / 0.5) * P.on));
    figure(ctx, S, X(S.x), R(FLOOR), U, s, ([hh, ss, ll], a = 1) => hsla(hh, ss, ll * lerp(0.55, 1.1, glow) * lit, a), s.bow);
    // the footlights, a rail of lamps along the front, up on the beat
    ctx.fillStyle = hsla(30, 30, 10); ctx.fillRect(0, R(0.965), w, R(0.035));
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 11; k++) {
      const fx = lerp(R(0.04), w - R(0.04), k / 10), fl = ctx.createRadialGradient(fx, R(0.965), 0, fx, R(0.965), R(0.12));
      const fh = s.act.glitz < 0.02 ? 42 : 42 + s.act.glitz * ((k * 55 + s.t * 90) % 360); // warm, or every lamp its own colour going round in a climax
      fl.addColorStop(0, hsla(fh, 90, 70, (0.35 + 0.25 * s.beat) * lit)); fl.addColorStop(1, hsla(fh, 90, 70, 0));
      ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(fx, R(0.965), R(0.12), Math.PI, TAU); ctx.fill();
      ctx.fillStyle = hsla(fh, 60, 92, 0.9); ctx.beginPath(); ctx.arc(fx, R(0.965), R(0.007), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // the curtains, each half hung from the pelmet in folds, drawn to its opening; the proscenium and pelmet over all
    const C = s.curtain, half = w * 0.5 * (1 - OPEN) + R(0.06);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 0 : w, x1 = side < 0 ? half : w - half, sway = Math.sin(s.t * 1.1 * s.motion + side) * R(0.004) * C.flap;
      curtain(ctx, x0, x1, R(0.02), R(0.97), side, sway, s.t, hue, lit);
    }
    ctx.fillStyle = hsla(35, 45, 24 * lit); ctx.fillRect(0, 0, w, R(0.075)); // the pelmet
    ctx.fillStyle = hsla(42, 70, 55 * lit); ctx.fillRect(0, R(0.072), w, R(0.012));
    for (let k = 0; k < 15; k++) { ctx.fillStyle = hsla(42, 70, 62 * lit); ctx.beginPath(); ctx.arc(lerp(0, w, (k + 0.5) / 15), R(0.09), R(0.012), 0, Math.PI); ctx.fill(); } // its fringe
    ctx.fillStyle = hsla(35, 45, 18 * lit); ctx.fillRect(0, 0, R(0.03), h); ctx.fillRect(w - R(0.03), 0, R(0.03), h);
    if (s.bulb > 0.02 || s.flash > 0.02) { ctx.fillStyle = hsla(45, 30, 96, 0.6 * Math.max(s.bulb, s.flash)); ctx.fillRect(0, 0, w, h); }
    if (s.dark > 0.02) { ctx.fillStyle = `rgba(0 0 0 / ${0.4 * s.dark})`; ctx.fillRect(0, 0, w, h); }
  },
};

/** A walker with a frame: the parlor's character plus what his shuffle keeps. */
const walker = (s) => ({ c: character(s), dir: rand(s) < 0.5 ? -1 : 1, ph: rand(s) * TAU, bob: 0, foot: 1, hop: 0, nod: 0, turn: 0, stagger: 0, burst: 0, rest: 1, step: 0, x: 0, to: 0 });
/** One step along the stage the way he is going; at a wing, turn. */
function stepTo(s, S, d, lo, hi) {
  S.to += S.dir * d;
  if (S.to > hi) { S.dir = -1; S.to = hi; } else if (S.to < lo) { S.dir = 1; S.to = lo; }
  S.foot = -S.foot;
}

/** One half of the curtain from x0 (the wall) to x1 (where its leading edge would hang free): velvet in folds, gathered in at the waist by a tieback, the rope round the bunch and the tassel hanging from the knot; only the hem below the waist flaps. */
function curtain(ctx, x0, x1, y0, y1, side, sway, t, hue, lit) {
  const W = x1 - x0, H = y1 - y0, folds = Math.max(3, Math.round(Math.abs(W) / (H * 0.08))), WAIST = 0.64, PINCH = 0.3;
  const gather = (v) => 1 - PINCH * Math.max(0, 1 - ((v - WAIST) / 0.3) ** 2) ** 1.5; // how much of the full width the curtain has at height v: pulled in at the waist
  const flap = (v) => sway * 3 * Math.max(0, (v - WAIST) / (1 - WAIST)) ** 2; // the hem swings, the waist is held
  const edge = (u, v) => x0 + W * u * gather(v) + flap(v) * u; // where the fold line at top fraction u is at height v
  const N = 12, path = (u0, u1) => { ctx.beginPath(); for (let i = 0; i <= N; i++) { const v = i / N; const x = edge(u1, v), y = y0 + v * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } for (let i = N; i >= 0; i--) { const v = i / N; ctx.lineTo(edge(u0, v), y0 + v * H); } ctx.closePath(); };
  const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, hsla(355, 65, 22 * lit)); g.addColorStop(1, hsla(355, 70, 30 * lit));
  ctx.fillStyle = g; path(0, 1); ctx.fill();
  for (let k = 0; k < folds; k++) { // each fold a strip that narrows into the waist with the rest
    const u0 = k / folds, u1 = (k + 1) / folds, fx0 = lerp(x0, x1, u0), fx1 = lerp(x0, x1, u1);
    const fg = ctx.createLinearGradient(fx0, 0, fx1, 0); fg.addColorStop(0, hsla(355, 70, 12 * lit, 0.8)); fg.addColorStop(0.5, hsla(355, 65, 34 * lit, 0.6)); fg.addColorStop(1, hsla(355, 70, 12 * lit, 0.8));
    ctx.fillStyle = fg; path(u0, u1); ctx.fill();
  }
  ctx.fillStyle = hsla(355, 60, 10 * lit, 0.9); path(0.97, 1); ctx.fill(); // the leading edge, in shadow
  // the tieback: a gold rope round the bunch at the waist, hooked to the wall behind, knotted at the front, the tassel below the knot
  const wy = y0 + WAIST * H, ex = edge(1, WAIST), cx = (x0 + ex) / 2, rx = Math.abs(ex - x0) / 2, ry = H * 0.022, rope = Math.max(1, H * 0.014);
  ctx.strokeStyle = hsla(42, 55, 38 * lit); ctx.lineWidth = rope * 1.6; ctx.beginPath(); ctx.ellipse(cx, wy, rx, ry, 0, 0, Math.PI); ctx.stroke(); // its shadow on the velvet
  ctx.strokeStyle = hsla(42, 70, 58 * lit); ctx.lineWidth = rope; ctx.beginPath(); ctx.ellipse(cx, wy, rx, ry, 0, 0, Math.PI); ctx.stroke(); // the rope across the front of the bunch
  ctx.strokeStyle = hsla(42, 70, 50 * lit, 0.8); ctx.lineWidth = Math.max(1, rope * 0.35); for (let k = 0; k < 7; k++) { const a = Math.PI * (k + 0.5) / 7, px = cx + Math.cos(a) * rx, py = wy + Math.sin(a) * ry; ctx.beginPath(); ctx.moveTo(px - rope * 0.4, py - rope * 0.5); ctx.lineTo(px + rope * 0.4, py + rope * 0.5); ctx.stroke(); } // the twist
  const kx = ex - side * rope * 0.2, ky = wy + ry * 0.6; // the knot, on the leading edge where the rope comes round
  ctx.fillStyle = hsla(42, 70, 62 * lit); ctx.strokeStyle = hsla(42, 60, 30 * lit); ctx.lineWidth = Math.max(1, rope * 0.3);
  ctx.beginPath(); ctx.ellipse(kx, ky, rope * 1.1, rope * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
  const tl = H * 0.07, tx = kx + Math.sin(t * 1.3 + side) * rope * 0.6; // the tassel, hanging from the knot, swinging a touch
  ctx.strokeStyle = hsla(42, 70, 58 * lit); ctx.lineWidth = Math.max(1, rope * 0.5); ctx.beginPath(); ctx.moveTo(kx, ky + rope * 0.8); ctx.lineTo(tx, ky + tl * 0.45); ctx.stroke(); // the cord
  ctx.fillStyle = hsla(42, 70, 58 * lit); ctx.beginPath(); ctx.ellipse(tx, ky + tl * 0.5, rope * 1.2, rope * 0.9, 0, 0, TAU); ctx.fill(); // the head
  ctx.beginPath(); ctx.moveTo(tx - rope * 1.1, ky + tl * 0.55); ctx.lineTo(tx + rope * 1.1, ky + tl * 0.55); ctx.lineTo(tx + rope * 1.5, ky + tl); ctx.lineTo(tx - rope * 1.5, ky + tl); ctx.closePath(); ctx.fill(); // the skirt
  ctx.strokeStyle = hsla(42, 60, 40 * lit, 0.8); ctx.lineWidth = Math.max(1, rope * 0.15); for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(tx + k * rope * 0.35, ky + tl * 0.58); ctx.lineTo(tx + k * rope * 0.42, ky + tl * 0.98); ctx.stroke(); } // its threads
}

/** The painted backdrop rolling behind him: a sky by the palette, then hills, a town or a sea by the flat, going by at the scene's roll. */
function backdrop(ctx, s, x0, x1, y0, y1, lit) {
  const sk = SKY[s.temp], W = x1 - x0, H = y1 - y0, night = s.temp === 'dim';
  const sky = ctx.createLinearGradient(0, y0, 0, y1); sky.addColorStop(0, hsla(sk.top[0], sk.top[1], sk.top[2] * lit)); sky.addColorStop(1, hsla(sk.low[0], sk.low[1], sk.low[2] * lit));
  ctx.fillStyle = sky; ctx.fillRect(x0, y0, W, H);
  // three flats on their own rollers: the sky (the sun or moon, the stars) slowest, the hills, then the near scenery; each wraps
  const at = (f) => { const roll = (s.scene.roll * f) % 1; return (v) => x0 + ((((v - roll) % 1) + 1) % 1) * W; };
  let u = at(FLATS[0]);
  if (sk.moon) for (const st of s.scene.stars) { ctx.fillStyle = hsla(50, 20, 90 * lit, 0.5 + 0.5 * Math.sin(s.t * 2 + st.tw)); ctx.fillRect(u(st.u), y0 + st.v * H, 2, 2); }
  const mx = u(0.7), my = y0 + H * (s.temp === 'warm' ? 0.55 : 0.28);
  ctx.fillStyle = sk.moon ? hsla(50, 20, 90 * lit) : hsla(48, 90, 92 * lit, 0.9); ctx.beginPath(); ctx.arc(mx, my, H * 0.08, 0, TAU); ctx.fill();
  const kind = s.scene.kind, edge = hsla(30, 30, (night ? 6 : 16) * lit, 0.7); // the cut-out's painted edge
  u = at(FLATS[1]); ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1, H * 0.004);
  for (const hl of s.scene.hills) { // the hills, a cut-out row standing a little proud of the boards' back line
    const hx = u(hl.u), hw = hl.w * W, hh = hl.h * H, hy = y1 - H * 0.06;
    ctx.fillStyle = hsla(kind === 2 ? 210 : 110, 30, (night ? 12 : 34) * lit);
    for (const ox of hx - hw < x0 ? [0, W] : [0]) { ctx.beginPath(); ctx.ellipse(hx + ox, hy, hw, hh * (kind === 2 ? 0.4 : 1), 0, Math.PI, TAU); ctx.fill(); ctx.stroke(); }
  }
  ctx.fillStyle = hsla(kind === 2 ? 210 : 110, 30, (night ? 12 : 34) * lit); ctx.fillRect(x0, y1 - H * 0.06, W, H * 0.06); // the row's base
  u = at(FLATS[2]); ctx.save(); ctx.translate((x0 + x1) / 2, y1); ctx.rotate(s.scene.wobble); ctx.translate(-(x0 + x1) / 2, -y1); // the near flat wobbles on its roller when the bass shoves it
  if (kind === 1) { // the town: rooftops and lit windows
    for (let k = 0; k < 9; k++) { const tx = u((k * 0.113) % 1), tw = W * 0.04, th = H * (0.18 + (k % 3) * 0.08); ctx.fillStyle = hsla(30, 20, (night ? 14 : 30) * lit); ctx.fillRect(tx - tw / 2, y1 - th, tw, th); ctx.strokeRect(tx - tw / 2, y1 - th, tw, th); ctx.fillStyle = hsla(42, 80, 70 * lit, night ? 0.9 : 0.4); for (let j = 0; j < 3; j++) ctx.fillRect(tx - tw * 0.3, y1 - th + H * 0.03 + j * H * 0.06, tw * 0.2, H * 0.03); }
  } else if (kind === 2) { // the sea: a boat and the swell
    ctx.fillStyle = hsla(205, 50, (night ? 18 : 42) * lit); ctx.fillRect(x0, y1 - H * 0.2, W, H * 0.2);
    ctx.strokeStyle = hsla(205, 40, (night ? 30 : 70) * lit, 0.5); ctx.lineWidth = Math.max(1, H * 0.006);
    for (let k = 0; k < 6; k++) { const wy = y1 - H * (0.17 - k * 0.028); ctx.beginPath(); for (let j = 0; j <= 12; j++) { const wx = x0 + (j / 12) * W; ctx.lineTo(wx, wy + Math.sin(j * 1.7 + s.t * 1.2 + k) * H * 0.006); } ctx.stroke(); }
    const bx = u(0.35); ctx.fillStyle = hsla(25, 40, 25 * lit); ctx.beginPath(); ctx.moveTo(bx - W * 0.03, y1 - H * 0.12); ctx.lineTo(bx + W * 0.03, y1 - H * 0.12); ctx.lineTo(bx + W * 0.02, y1 - H * 0.08); ctx.lineTo(bx - W * 0.02, y1 - H * 0.08); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hsla(0, 0, 90 * lit); ctx.beginPath(); ctx.moveTo(bx, y1 - H * 0.12); ctx.lineTo(bx, y1 - H * 0.26); ctx.lineTo(bx + W * 0.025, y1 - H * 0.13); ctx.closePath(); ctx.fill();
  } else { // the country: trees on the hills
    for (let k = 0; k < 8; k++) { const tx = u((k * 0.131 + 0.05) % 1), th = H * 0.1; ctx.fillStyle = hsla(30, 30, 20 * lit); ctx.fillRect(tx - 1, y1 - th, Math.max(2, W * 0.004), th); ctx.fillStyle = hsla(115, 30, (night ? 12 : 30) * lit); ctx.beginPath(); ctx.arc(tx, y1 - th, H * 0.05, 0, TAU); ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}
