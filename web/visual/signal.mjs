// signal: the song as an instrumented experiment on a dark panel, always moving, never accumulating. The bass is the
// carrier: a field of ticks across the whole frame whose wavelength is the bass note (a low note a long wave), whose
// amplitude is fed by each note and decays between them, and whose phase runs at the tempo. Every part in the cast is
// a node routed to a central bus by a bent trace, as on a schematic; a hit lights its node and sends a pulse down the
// route to the bus. A kick rings the bus (a ring expanding across the field), an impact discharges an arc between two
// nodes, hats tick along the routes. Each line part is a probe swept across the field once per bar, its pitch the
// height, leaving a phosphor trail that fades over a few bars; the ticks near a probe turn toward it. The pad is a
// contour field around its node: isolines breathing outward, their spacing the cutoff, their number the level. A
// section's role is the instrument's mode (establish: a few routes live, a slack field; climax: every route live, the
// field coherent, the sweep bright; release: dim and slow); a boundary re-routes the topology (the nodes move to new
// places over a second); a riser accelerates the sweep and aligns the field; a dropout stops the carrier and leaves the
// probes. Deterministic: randomness only from the state's own seeded generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, fadeFrame } from './kit.mjs';

const TAU = Math.PI * 2;
const GX = 44, GY = 24; // the field's ticks
const BUS = { x: 0.5, y: 0.52 };
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
// the instrument's mode per section role: how much of the field shows, how coherent it is, route brightness, the sweep's glow, the frame's persistence
const MODE = {
  establish: { field: 0.5, cohere: 0.3, routes: 0.5, glow: 0.7, trail: 0.5 },
  develop: { field: 0.8, cohere: 0.6, routes: 0.8, glow: 1, trail: 0.42 },
  climax: { field: 1, cohere: 1, routes: 1.2, glow: 1.4, trail: 0.36 },
  release: { field: 0.6, cohere: 0.4, routes: 0.6, glow: 0.8, trail: 0.5 },
  none: { field: 0.8, cohere: 0.6, routes: 0.8, glow: 1, trail: 0.42 },
};

/** A node's place on the panel from the state's generator: on one of two rings around the bus, never on the bus. */
const place = (s, i) => { const a = rand(s) * TAU, r = i % 2 ? 0.3 : 0.42; return { x: BUS.x + Math.cos(a) * r * 0.85, y: BUS.y + Math.sin(a) * r }; };

export default {
  name: 'signal',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const s = {
      pal, size: { ...size },
      bg: [pal.hue, 30, 5], grid: lerp(0.05, 0.12, p.luminance), // the panel: near black in the palette's hue, a faint grid
      weight: lerp(0.7, 1.4, p.mass), jitter: lerp(0, 1, p.jitter), spread: lerp(0.8, 1.25, p.spread), motion: lerp(0.6, 1.4, p.motion),
      cps: score.cps,
      roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0, nodes: {}, order: [], // nodes: part -> { x, y, tx, ty, slot, hot }; order: parts as they appeared
      carrier: { amp: 0, k: 4, phase: 0, note: 40 }, // the bass: amplitude fed by notes, wavelength by the note, phase at the tempo
      pulses: [], rings: [], arcs: [], ticks: [], // travelling on the routes, from the bus, between nodes, along the routes
      probes: {}, // line part -> { y, trail: [{ x, y, hot }], hot }
      contour: { level: 0, spacing: 0.06, phase: 0, x: BUS.x, y: BUS.y, tint: 0.5 },
      mode: { ...MODE.none }, energy: 0.5, riser: 0, wasRiser: 0, dark: 0, flash: 0, barPhase: 0, beats: 4, section: null, hueShift: 0,
    };
    seed(s, rng);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = MODE[role] ?? MODE.none;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.mode[k] = ease(s.mode[k], want[k], 1.5, dt);
    if (clock.boundary) { // a new topology: every node moves to a new place; the bus flashes
      s.flash = Math.max(s.flash, s.wasRiser > 0.3 ? 1 : 0.5); s.hueShift = ((clock.index * 37) % 50) - 25; s.section = clock.section;
      s.order.forEach((n, i) => { const q = place(s, i); s.nodes[n].tx = q.x; s.nodes[n].ty = q.y; });
      s.contour.spacing = 0.04 + rand(s) * 0.04;
    }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.wasRiser = s.riser > 0 ? s.riser : decay(s.wasRiser, 2, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 4, dt);
    s.barPhase = clock.barPhase; s.beats = clock.beats;
    // the carrier runs at the tempo (a wavelength per beat), faster into a riser, stopped in a dropout; its amplitude decays between notes
    const c = s.carrier;
    c.phase += TAU * s.cps * clock.beats * (1 + s.riser) * (1 - s.dark) * dt * 0.5;
    c.amp = decay(c.amp, 0.9, dt);
    // motion: nodes ease to their places, pulses travel, rings expand, arcs and ticks die, probes cool, contours breathe
    for (const n of Object.values(s.nodes)) { n.x = ease(n.x, n.tx, 3, dt); n.y = ease(n.y, n.ty, 3, dt); n.hot = decay(n.hot, 4, dt); }
    for (const p of s.pulses) p.p += dt / 0.35; s.pulses = s.pulses.filter((p) => p.p < 1);
    for (const r of s.rings) { r.r += dt * 1.5 * s.motion; r.hot = decay(r.hot, 3.5, dt); } s.rings = s.rings.filter((r) => r.hot > 0.03); // a ring is a blink, not a target
    for (const a of s.arcs) a.life -= dt; s.arcs = s.arcs.filter((a) => a.life > 0);
    for (const t of s.ticks) { t.p += dt * 1.4; t.life -= dt; } s.ticks = s.ticks.filter((t) => t.life > 0 && t.p < 1);
    for (const pr of Object.values(s.probes)) { pr.hot = decay(pr.hot, 3, dt); for (const q of pr.trail) q.hot = decay(q.hot, 0.55 / (1 + s.energy), dt); pr.trail = pr.trail.filter((q) => q.hot > 0.02); }
    s.contour.level = decay(s.contour.level, 0.5, dt); s.contour.phase = (s.contour.phase + dt * 0.25 * s.motion) % 1;
    s.flash = decay(s.flash, 7, dt);
    // the sweep: every live probe draws where the beam is now (bar phase across, pitch up), so a held note is a line
    for (const pr of Object.values(s.probes)) if (pr.on && pr.trail.length < 400) { const last = pr.trail[pr.trail.length - 1]; if (!last || Math.abs(last.x - s.barPhase) > 0.004) pr.trail.push({ x: s.barPhase, y: pr.y, hot: 1 }); }
    const node = (name, slot) => { if (!s.nodes[name]) { const q = place(s, s.order.length); s.nodes[name] = { ...q, tx: q.x, ty: q.y, slot, hot: 0 }; s.order.push(name); } return s.nodes[name]; };
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', name = e.layer ?? slot;
      const g = clamp(e.gain * e.velocity, 0, 1.5), n = node(name, slot);
      n.hot = Math.max(n.hot, g);
      if (slot === 'impulse') {
        s.pulses.push({ node: name, p: 0, w: g });
        if (e.role === 'pulse') s.rings.push({ r: 0.02, hot: g, w: 1 });
        else if (e.role === 'impact') { const others = s.order.filter((o) => o !== name); const b = others.length ? others[Math.floor(rand(s) * others.length)] : name; s.arcs.push({ a: name, b, life: 0.18, w: g, seed: Math.floor(rand(s) * 1e6) }); s.rings.push({ r: 0.02, hot: 0.5 * g, w: 0.5 }); }
        else if (e.role === 'grain') { if (s.ticks.length < 60) s.ticks.push({ node: name, p: 0, life: 0.3 }); }
      } else if (slot === 'ground') {
        const c = s.carrier; c.amp = Math.min(1.3, c.amp + 0.7 * g);
        if (e.note !== null) { c.note = e.note; c.k = lerp(2, 9, clamp((e.note - 24) / 40)); }
        s.pulses.push({ node: name, p: 0, w: g });
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const pr = (s.probes[name] ??= { y: 0.5, trail: [], hot: 0, on: false, until: 0, hue: slot === 'line' ? s.pal.line : s.pal.line + 45 });
        pr.y = 0.86 - clamp((e.note - 40) / 50) * 0.72 + (e.pan - 0.5) * 0.04; pr.hot = 1; pr.on = true; pr.until = s.t + Math.min(2, e.dur / s.cps);
        pr.trail.push({ x: s.barPhase, y: pr.y, hot: 1 });
      } else if (slot === 'field') {
        const c = s.contour; c.level = Math.min(1, 0.5 + 0.5 * g); c.x = n.x; c.y = n.y;
        if (e.cutoff !== null) { c.tint = clamp(Math.log(e.cutoff / 200) / Math.log(40)); c.spacing = lerp(0.03, 0.09, c.tint); }
      } else if (slot === 'transition') {
        if (e.dur >= 1) { s.flash = Math.max(s.flash, 0.8); s.rings.push({ r: 0.02, hot: 1.2, w: 1.5 }); }
      } else if (slot === 'grain' || e.role === 'grain') { if (s.ticks.length < 60) s.ticks.push({ node: name, p: 0, life: 0.3 }); }
    }
    for (const pr of Object.values(s.probes)) if (pr.on && s.t > pr.until) pr.on = false; // the note ends: the beam lifts
  },

  draw(s, ctx, w, h) {
    const { pal, mode } = s, lit = 1 - 0.6 * s.dark, hue = pal.hue + s.hueShift;
    const X = (x) => x * w, Y = (y) => y * h, R = (r) => r * h;
    fadeFrame(ctx, w, h, s.bg, clamp(mode.trail + 0.1 * s.riser, 0.1, 0.5));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the panel's grid
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = hsla(hue, 30, 40, s.grid); ctx.lineWidth = 1;
    for (let i = 1; i < 16; i++) { ctx.beginPath(); ctx.moveTo(X(i / 16), 0); ctx.lineTo(X(i / 16), h); ctx.stroke(); }
    for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(0, Y(i / 9)); ctx.lineTo(w, Y(i / 9)); ctx.stroke(); }
    // the field: a tick per cell, turned by the carrier (a wave along x at the bass note's wavelength, moving at the tempo), pulled toward a live probe, incoherent by the mode
    const c = s.carrier, probes = Object.values(s.probes).filter((p) => p.hot > 0.05), amp = c.amp * lit;
    ctx.globalCompositeOperation = 'source-over'; // the ticks are crisp, never a glow that piles up on the persisting frame
    const len = R(0.013) * s.weight, jit = (1 - mode.cohere) * 0.9 + s.jitter * 0.3;
    for (let i = 0; i < GX; i++) for (let k = 0; k < GY; k++) {
      const x = (i + 0.5) / GX, y = (k + 0.5) / GY;
      let a = Math.sin(x * c.k * TAU - c.phase + y * 1.7) * amp * 1.1 + Math.sin(i * 12.9898 + k * 78.233) * jit; // a stable pseudo-random turn per cell, no generator
      let pull = 0;
      for (const p of probes) { const d = Math.hypot((x - s.barPhase) * (w / h), y - p.y); if (d < 0.18) { const f = (1 - d / 0.18) * p.hot; a = lerp(a, Math.atan2(p.y - y, (s.barPhase - x) * (w / h)), f); pull = Math.max(pull, f); } }
      const bright = clamp((0.2 + 0.45 * Math.abs(amp) * mode.field + 0.6 * pull) * lit, 0, 0.75);
      if (bright < 0.03) continue;
      const cx = X(x), cy = Y(y), dx = Math.cos(a) * len * (0.6 + Math.abs(amp)), dy = Math.sin(a) * len * (0.6 + Math.abs(amp));
      ctx.strokeStyle = hsla(hue + 40 * pull, pal.sat, lerp(45, 75, bright), bright); ctx.lineWidth = Math.max(1, R(0.0016) * s.weight);
      ctx.beginPath(); ctx.moveTo(cx - dx, cy - dy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke();
    }
    // the contours: isolines around the pad's node, breathing outward, spacing the cutoff, count the level
    const ct = s.contour;
    if (ct.level > 0.02) {
      const n = Math.round(3 + 7 * ct.level);
      for (let i = 0; i < n; i++) {
        const r = (i + ct.phase) * ct.spacing * s.spread, a = clamp(ct.level * (1 - i / n) * 0.5 * lit);
        ctx.strokeStyle = hsla(pal.field + s.hueShift, pal.sat, lerp(35, 65, ct.tint), a); ctx.lineWidth = Math.max(1, R(0.0015));
        ctx.beginPath(); ctx.ellipse(X(ct.x), Y(ct.y), R(r) * (w / h) * 0.75, R(r), 0, 0, TAU); ctx.stroke();
      }
    }
    // the routes: each node to the bus by a bend, lit by the mode and the node's heat; pulses and ticks along them
    const route = (n) => [[n.x, n.y], [BUS.x, n.y], [BUS.x, BUS.y]]; // out along the node's row, then down the bus column
    const along = (pts, p) => { const l1 = Math.abs(pts[1][0] - pts[0][0]) * (w / h), l2 = Math.abs(pts[2][1] - pts[1][1]), L = l1 + l2 || 1e-6, d = p * L; return d < l1 ? [lerp(pts[0][0], pts[1][0], d / l1), pts[0][1]] : [pts[1][0], lerp(pts[1][1], pts[2][1], (d - l1) / l2)]; };
    ctx.globalCompositeOperation = 'source-over';
    for (const name of s.order) {
      const n = s.nodes[name], pts = route(n), a = clamp((0.12 + 0.5 * n.hot) * mode.routes * lit);
      ctx.strokeStyle = hsla(hue, pal.sat * 0.8, 60, a); ctx.lineWidth = Math.max(1, R(0.002) * s.weight);
      ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(pts[0][1])); ctx.lineTo(X(pts[1][0]), Y(pts[1][1])); ctx.lineTo(X(pts[2][0]), Y(pts[2][1])); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.pulses) { const n = s.nodes[p.node]; if (!n) continue; const [x, y] = along(route(n), p.p); ctx.fillStyle = hsla(hue + 30, pal.sat, 80, 0.9 * lit); ctx.beginPath(); ctx.arc(X(x), Y(y), R(0.005 + 0.004 * p.w), 0, TAU); ctx.fill(); }
    for (const t of s.ticks) { const n = s.nodes[t.node]; if (!n) continue; const [x, y] = along(route(n), t.p), [x2, y2] = along(route(n), Math.min(1, t.p + 0.03)); ctx.strokeStyle = hsla(hue + 60, pal.sat, 85, 0.7 * clamp(t.life / 0.3) * lit); ctx.lineWidth = Math.max(1, R(0.002)); ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); }
    // the arcs: a discharge between two nodes, jagged, gone in a blink
    for (const a of s.arcs) {
      const A = s.nodes[a.a], B = s.nodes[a.b]; if (!A || !B) continue;
      let r = a.seed; const rr = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; }; // the arc's own jag, from its seed: draw never touches the state
      ctx.strokeStyle = hsla(hue + 90, 90, 85, 0.9 * clamp(a.life / 0.18)); ctx.lineWidth = Math.max(1, R(0.003) * a.w);
      ctx.beginPath(); ctx.moveTo(X(A.x), Y(A.y));
      for (let i = 1; i < 8; i++) { const f = i / 8; ctx.lineTo(X(lerp(A.x, B.x, f) + (rr() - 0.5) * 0.03), Y(lerp(A.y, B.y, f) + (rr() - 0.5) * 0.05)); }
      ctx.lineTo(X(B.x), Y(B.y)); ctx.stroke();
    }
    // the bus and its rings
    for (const r of s.rings) { ctx.strokeStyle = hsla(hue + 20, pal.sat, 75, 0.6 * r.hot * lit); ctx.lineWidth = Math.max(1, R(0.0025) * r.w * s.weight); ctx.beginPath(); ctx.ellipse(X(BUS.x), Y(BUS.y), R(r.r) * (w / h) * 0.75, R(r.r), 0, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hsla(hue, pal.sat, 12); ctx.strokeStyle = hsla(hue, pal.sat, lerp(50, 85, s.energy), 0.9 * lit); ctx.lineWidth = Math.max(1, R(0.003) * s.weight);
    ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * TAU, x = X(BUS.x) + Math.cos(a) * R(0.03), y = Y(BUS.y) + Math.sin(a) * R(0.03); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke();
    // the nodes: a lamp per part, lit by its heat, its slot the shape (a ring for a line, a square for a field, a dot for the rest)
    for (const name of s.order) {
      const n = s.nodes[name], r = R(0.011 + 0.008 * n.hot) * s.weight, col = hsla(hue + (n.slot === 'field' ? -38 : n.slot === 'line' || n.slot === 'counter' ? 150 : 0), pal.sat, lerp(45, 85, n.hot), lit);
      ctx.strokeStyle = col; ctx.fillStyle = hsla(hue, pal.sat, 8); ctx.lineWidth = Math.max(1, R(0.0025));
      ctx.beginPath();
      if (n.slot === 'field') ctx.rect(X(n.x) - r, Y(n.y) - r, 2 * r, 2 * r); else ctx.arc(X(n.x), Y(n.y), r, 0, TAU);
      ctx.fill(); ctx.stroke();
      if (n.hot > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hsla(hue + 30, pal.sat, 80, 0.5 * n.hot * lit); ctx.beginPath(); ctx.arc(X(n.x), Y(n.y), r * 0.55, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    }
    // the probes: each line part's trail across the field, the beam a bright point with a crosshair where it writes
    ctx.globalCompositeOperation = 'lighter';
    for (const p of Object.values(s.probes)) {
      const col = (a) => hsla(p.hue + s.hueShift, 85, 70, a);
      if (p.trail.length > 1) for (let i = 1; i < p.trail.length; i++) {
        const a = p.trail[i - 1], b = p.trail[i]; if (b.x < a.x) continue; // the sweep wrapped: a new pass, no line back across
        ctx.strokeStyle = col(0.85 * b.hot * mode.glow * lit); ctx.lineWidth = Math.max(1, R(0.003) * (0.6 + b.hot));
        ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
      }
      if (p.hot > 0.03) {
        const px = X(s.barPhase), py = Y(p.y);
        ctx.strokeStyle = col(0.5 * p.hot); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py - R(0.03)); ctx.lineTo(px, py + R(0.03)); ctx.moveTo(px - R(0.03), py); ctx.lineTo(px + R(0.03), py); ctx.stroke();
        ctx.fillStyle = hsla(p.hue + s.hueShift, 90, 88, p.hot); ctx.beginPath(); ctx.arc(px, py, R(0.004 + 0.006 * p.hot), 0, TAU); ctx.fill();
      }
    }
    // the beam itself: a faint line at the sweep, brighter into a riser
    ctx.strokeStyle = hsla(hue, pal.sat, 70, (0.08 + 0.3 * s.riser) * lit); ctx.lineWidth = Math.max(1, R(0.0015)); ctx.beginPath(); ctx.moveTo(X(s.barPhase), 0); ctx.lineTo(X(s.barPhase), h); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    if (s.flash > 0.01) { ctx.fillStyle = hsla(hue, 40, 92, 0.4 * s.flash); ctx.fillRect(0, 0, w, h); }
  },
};
