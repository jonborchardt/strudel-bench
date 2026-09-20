// loom: the song operates a weaving machine, and the machine makes cloth. Seen from the front: the warp runs top to
// bottom through two shafts that lift alternate threads to open the shed (the pad's level is how many threads hang, let down from the beam and taken up again), twelve shuttles in their own lanes cross the shed carrying wefts (thrown in turn by kicks, impacts, hats and melody notes),
// a beater packs each row down onto the fell, and the cloth grows below and hangs away. An unseen drive shaft turns at
// the tempo (its speed is the machine's draught). Every mechanism is moved by a part and every movement leaves something in the cloth: the bass drives the
// shaft (its level the torque, its note the tension of the warp, and its pitch class picks the weave structure of the
// bar: plain, twill or satin), a kick is the beater's stroke (a row is packed: the shed's lift pattern becomes the row),
// an impact throws the next shuttle across (the weft changes side and colour), hats flick the heddles and throw a light one, each line part is a
// pattern thread laid into the current row where its pitch falls across the warp, so the melody plots a figure down the
// cloth; the pad is the warp itself, its count and colour. A section's role is the machine's mode (establish: slow,
// a slack warp; climax: everything engaged, fast, sparks off the beater; release: the loom idling, rows rare) and a
// boundary starts a new band of cloth; a riser winds the flywheel up; a dropout stops the shaft. Aggression sparks,
// organicness slackens (rows wobble, threads vary). Around the mechanism the machine shows its working: two treadles rocking with the shafts, the cloth
// running off the bottom of the frame, a bobbin at the side feeding the shuttle its weft (it
// spins while a shuttle flies), lint drifting in the air, shaken loose by every flick, and the cloth itself billowing
// in the machine's draught with loose weft ends fringing its selvedges. Deterministic:
// randomness only from the state's own generator.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const WARPS = 48, ROW = 0.011, FELL = 0.56; // warp threads across, the height of a woven row, where the fell line sits
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
const MODE = {
  establish: { speed: 0.7, engage: 0.5, glow: 0.7, sparks: 0 },
  develop: { speed: 1, engage: 0.8, glow: 1, sparks: 0.3 },
  climax: { speed: 1.4, engage: 1, glow: 1.3, sparks: 1 },
  release: { speed: 0.5, engage: 0.3, glow: 0.8, sparks: 0 },
  none: { speed: 1, engage: 0.8, glow: 1, sparks: 0.3 },
};
/** The weave structures: which warps a row lifts, by warp index and row index. */
const WEAVES = [(i, r) => (i + r) % 2 === 0, (i, r) => (i + r) % 4 < 2, (i, r) => (i + 3 * r) % 5 === 0]; // plain, twill, satin

export default {
  name: 'loom',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const s = {
      pal, size: { ...size },
      bg: [pal.hue, 18, 9], wood: [pal.hue + 20, 30, 22],
      weight: lerp(0.7, 1.4, p.mass), slack: lerp(0, 1, p.jitter), spread: lerp(0.8, 1.2, p.spread), edge: p.edge,
      cps: score.cps,
      roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0, band: 0, hueShift: 0,
      wheel: { angle: 0, omega: 0, torque: 0 }, // the flywheel: driven by the bass
      warp: { tension: 0.5, count: 0.6, tint: 0.5, hue: pal.field }, // the pad
      shed: 0, shedTo: 0, // which shaft is up: 0 or 1, eased
      beater: 0, shuttles: Array.from({ length: 12 }, (_, k) => ({ x: k % 2 ? 0.9 : 0.1, tx: k % 2 ? 0.9 : 0.1, side: k % 2, hue: pal.line + k * 15, hot: 0, y: 0.32 + k * 0.019 })), lane: 0, thrown: 0, heddle: 0, tie: 0, // twelve shuttles in their own lanes of the shed, thrown in turn, resting on alternate sides
      warpShow: WARPS * 0.6, // how many warp threads hang from the beam right now: they are let down and taken up from the top as the pad comes and goes
      rows: [], // the cloth, newest first: { weave, r, hue, light, picks: [{ x, hue }], wobble }
      picks: [], // pattern picks waiting for the next row: { x, hue }
      sparks: [], mode: { ...MODE.none }, energy: 0.5, riser: 0, dark: 0, section: null, rowsWoven: 0,
      bobbin: 0, lint: [], // the bobbin's turn, lint in the air { x, y, vx, vy, life }
    };
    seed(s, rng);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = MODE[role] ?? MODE.none;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.mode[k] = ease(s.mode[k], want[k], 1.5, dt);
    if (clock.boundary) { s.band++; s.hueShift = ((clock.index * 37) % 50) - 25; s.section = clock.section; s.tie = (s.tie + 1) % WEAVES.length; }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    // the flywheel: torque from the bass decays, the wheel eases to a speed set by the tempo, the mode, the torque and the riser; stopped in a dropout
    const W = s.wheel; W.torque = decay(W.torque, 0.6, dt);
    W.omega = ease(W.omega, TAU * s.cps * clock.beats / 4 * s.mode.speed * (0.4 + 0.8 * W.torque) * (1 + 0.8 * s.riser) * (1 - s.dark), 2, dt);
    W.angle += W.omega * dt;
    s.shed = ease(s.shed, s.shedTo, 12, dt);
    s.beater = decay(s.beater, 7, dt); s.heddle = decay(s.heddle, 9, dt);
    for (const sh of s.shuttles) { sh.x = ease(sh.x, sh.tx, 9, dt); sh.hot = decay(sh.hot, 3, dt); }
    const throwShuttle = (sh, g) => { sh.side = sh.side ? 0 : 1; sh.tx = sh.side ? 0.9 : 0.1; sh.hue = s.pal.line + s.hueShift + s.shuttles.indexOf(sh) * 25 + (sh.side ? 40 : 0); sh.hot = Math.max(sh.hot, clamp(0.5 + 0.5 * g)); s.heddle = Math.max(s.heddle, 0.5 * g); s.thrown++; };
    const nextShuttle = () => { const sh = s.shuttles[s.lane]; s.lane = (s.lane + 1) % s.shuttles.length; return sh; };
    s.warp.count = ease(s.warp.count, 0.35 + 0.3 * s.energy, 0.5, dt); // the warp thins between pad chords, thicker in a loud section
    s.warpShow = ease(s.warpShow, WARPS * lerp(0.45, 1, s.warp.count), 1.2, dt);
    for (const sp of s.sparks) { sp.vy += 2 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.life -= dt; } s.sparks = s.sparks.filter((sp) => sp.life > 0);
    s.bobbin += Math.max(...s.shuttles.map((sh) => sh.hot)) * 14 * dt; // the bobbin spins while a shuttle flies
    for (const l of s.lint) { l.vx = ease(l.vx, Math.sin(s.t * 0.7 + l.y * 9) * 0.03 + 0.01 * W.omega, 1, dt); l.vy = ease(l.vy, 0.015 + Math.cos(s.t * 0.9 + l.x * 7) * 0.02, 1, dt); l.x += l.vx * dt; l.y += l.vy * dt; l.life -= dt; }
    s.lint = s.lint.filter((l) => l.life > 0 && l.y < 0.98);
    const shake = (n, x, y) => { for (let i = 0; i < n && s.lint.length < 60; i++) s.lint.push({ x: x + (rand(s) - 0.5) * 0.1, y: y + (rand(s) - 0.5) * 0.04, vx: (rand(s) - 0.5) * 0.1, vy: -0.05 - rand(s) * 0.08, life: 5 + rand(s) * 5 }); };
    if (rand(s) < dt * W.omega * 0.15) shake(1, 0.1 + rand(s) * 0.8, 0.3 + rand(s) * 0.25); // the running machine sheds a little on its own
    const weaveRow = (g) => { // the beater packs a row: the shed's lift pattern, the band's colour, the pattern picks waiting, a wobble by the slack
      s.rows.unshift({ weave: s.tie, r: s.rowsWoven++, hue: s.pal.hue + s.hueShift, light: lerp(38, 58, g) + (s.rowsWoven % 8 < 4 ? 0 : -4), picks: s.picks, wobble: (rand(s) - 0.5) * 0.004 * s.slack, hot: 1 });
      s.picks = []; if (s.rows.length > 70) s.rows.pop();
      shake(1 + Math.floor(g * 2), 0.1 + rand(s) * 0.8, FELL);
      throwShuttle(nextShuttle(), g); // every row is a weft: a shuttle crosses
      s.shedTo = s.shedTo ? 0 : 1; s.beater = Math.max(s.beater, g);
      if (s.mode.sparks * s.edge > 0.2) for (let i = 0; i < 2 + Math.floor(rand(s) * 5 * s.mode.sparks); i++) s.sparks.push({ x: 0.1 + rand(s) * 0.8, y: FELL, vx: (rand(s) - 0.5) * 0.4, vy: -0.4 - rand(s) * 0.6, life: 0.3 + rand(s) * 0.3 });
    };
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'pulse') weaveRow(g);
        else if (e.role === 'impact') throwShuttle(nextShuttle(), g);
        else if (e.role === 'grain') { s.heddle = Math.max(s.heddle, 0.6 * g); shake(1, 0.1 + rand(s) * 0.8, 0.26); throwShuttle(nextShuttle(), 0.5 * g); } // a hat throws a shuttle too, a lighter one
        else s.beater = Math.max(s.beater, 0.4 * g);
      } else if (slot === 'ground') {
        W.torque = Math.min(1.5, W.torque + 0.8 * g);
        if (e.note !== null) { s.warp.tension = clamp((e.note - 24) / 36); s.tie = ((e.note % 12) % 3); }
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        s.picks.push({ x: clamp(0.05 + 0.9 * clamp((e.note - 40) / 50) + (e.pan - 0.5) * 0.04, 0.02, 0.98), hue: (slot === 'line' ? s.pal.line : s.pal.line + 45) + s.hueShift, w: 0.5 + g }); // across the warp, 0..1
        if (s.picks.length > 12) s.picks.shift();
        throwShuttle(nextShuttle(), 0.7 * g); // the pattern thread crosses too
      } else if (slot === 'field') {
        s.warp.count = Math.min(1, s.warp.count + 0.4 * g);
        if (e.cutoff !== null) s.warp.tint = clamp(Math.log(e.cutoff / 200) / Math.log(40));
      } else if (slot === 'transition') {
        if (e.dur >= 1) { weaveRow(1.5); s.heddle = 1; for (const sh of s.shuttles) throwShuttle(sh, 1); } // the impact: every shuttle flies at once
      } else if (slot === 'grain' || e.role === 'grain') s.heddle = Math.max(s.heddle, 0.4 * g);
    }
    for (const r of s.rows) r.hot = decay(r.hot, 4, dt);
  },

  draw(s, ctx, w, h) {
    const { pal, mode } = s, lit = 1 - 0.5 * s.dark, hue = pal.hue + s.hueShift;
    const X = (x) => x * w, Y = (y) => y * h, R = (r) => r * h;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hsla(...s.bg); ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    const x0 = 0.06, x1 = 0.94, warps = Math.ceil(s.warpShow), wx = (i) => x0 + ((x1 - x0) * (i + 0.5)) / WARPS; // threads keep their places; the count shown grows and shrinks from the right
    const shedGap = R(0.05) * lerp(0.6, 1, s.warp.tension) * mode.engage, fellY = Y(FELL) + R(0.006) * s.beater;
    const warpCol = (a) => hsla(s.warp.hue + s.hueShift, pal.sat * 0.6, lerp(40, 70, s.warp.tint), a * lit);
    // the cloth below the fell: rows scroll down, each a strip of weft with the pattern picks laid in, and the warp threads running through, dashed by the weave (over where the row lifted them), off the bottom of the frame
    // the cloth hangs free below the fell, so it billows in the machine's draught (more the further from the fell, more with the wheel's speed and the section's energy), and loose weft ends fringe both selvedges, waving with it
    const cellW = ((x1 - x0) * w) / WARPS, wl = Math.max(1, R(0.0018) * s.weight), draught = (0.4 + 0.6 * clamp(s.wheel.omega / (TAU * s.cps)) + 0.5 * s.energy) * (1 - s.dark);
    const hang = Math.max(1, (h - fellY) / R(ROW)); // rows between the fell and the bottom of the frame: the cloth's free length
    for (let k = 0; k < s.rows.length; k++) {
      const r = s.rows[k], y = fellY + k * R(ROW) + (r.wobble * h), hh = R(ROW) * 0.96;
      if (y > h) break;
      const sag = Math.min(1, k / hang) ** 0.7, bx = (Math.sin(s.t * 1.9 + k * 0.16) * R(0.03) + Math.sin(s.t * 3.3 - k * 0.45) * R(0.01)) * sag * draught; // the ripple: the cloth hangs from the fell and swings more the further down
      ctx.fillStyle = hsla(r.hue, pal.sat * 0.7, r.light + 12 * r.hot + 3 * Math.sin(s.t * 1.7 + k * 0.21) * sag * draught, lit); ctx.fillRect(X(x0) + bx, y, X(x1 - x0), hh);
      for (const p of r.picks) { ctx.fillStyle = hsla(p.hue, 85, 70 + 15 * r.hot, lit); ctx.fillRect(X(x0 + (x1 - x0) * p.x) - cellW * 0.9 + bx, y, cellW * 1.8, hh); }
      ctx.fillStyle = warpCol(0.95);
      for (let i = 0; i < WARPS; i++) if (WEAVES[r.weave](i, r.r)) ctx.fillRect(X(wx(i)) - wl / 2 + bx, y - 1, wl, hh + 2);
      if (k % 2 === r.r % 2) { // the fringe: a weft end out past each selvedge, lifting in the draught
        const fl = R(0.014 + 0.006 * Math.sin(k * 2.3)), lift = Math.sin(s.t * 2.4 + k * 0.6) * R(0.008) * (0.3 + draught) * sag;
        ctx.strokeStyle = hsla(r.hue + 20, pal.sat * 0.8, r.light + 18, 0.8 * lit); ctx.lineWidth = Math.max(1, R(0.0012));
        ctx.beginPath(); ctx.moveTo(X(x0) + bx, y + hh / 2); ctx.quadraticCurveTo(X(x0) + bx - fl * 0.6, y + hh / 2 + lift * 0.5, X(x0) + bx - fl, y + hh / 2 - lift); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X(x1) + bx, y + hh / 2); ctx.quadraticCurveTo(X(x1) + bx + fl * 0.6, y + hh / 2 + lift * 0.5, X(x1) + bx + fl, y + hh / 2 - lift); ctx.stroke();
      }
    }
    // the treadles: two pedals at the left under the cloth beam, each down when its shaft is up, a cord up to its shaft
    for (const shaft of [0, 1]) {
      const up = shaft === 0 ? s.shed : 1 - s.shed, px = X(0.008), py = Y(0.93) + shaft * R(0.03), tilt = lerp(-0.4, 0.4, up), len = R(0.05);
      ctx.strokeStyle = hsla(...s.wood); ctx.lineWidth = Math.max(2, R(0.009));
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(tilt) * len, py - Math.sin(tilt) * len); ctx.stroke();
      ctx.strokeStyle = hsla(hue, 20, 60, 0.6 * lit); ctx.lineWidth = Math.max(1, R(0.0012));
      ctx.beginPath(); ctx.moveTo(px + Math.cos(tilt) * len, py - Math.sin(tilt) * len); ctx.lineTo(X(x0 - 0.02 + shaft * 0.01), Y(0.26) - (up * 2 - 1) * R(0.025) + (shaft ? R(0.02) : 0)); ctx.stroke();
    }
    // the warp above the fell: each thread from the top beam down to the fell, lifted or lowered through the shed by its shaft; a lifted thread bows toward the light and brightens, so the shed shows from the front
    const topY = Y(0.08);
    for (let i = 0; i < warps; i++) {
      const shaft = i % 2, up = shaft === 0 ? s.shed : 1 - s.shed, lift = up * 2 - 1, frac = clamp(s.warpShow - i); // +1 up, -1 down; frac: a thread being let down from the beam (or taken up) hangs only part way
      const x = X(wx(i)) + Math.sin(i * 1.7 + s.t * 3) * R(0.001) * s.slack + (i % 3 === 0 ? s.heddle * R(0.003) : 0);
      const shedY = Y(0.42), bow = lift * shedGap * 0.5 * (shaft ? 1 : -1);
      ctx.strokeStyle = warpCol(0.4 + 0.5 * up * mode.engage + 0.15 * s.warp.tension); ctx.lineWidth = Math.max(1, R(0.0015) * s.weight * (0.7 + 0.6 * up) * (1 + 0.5 * s.slack * ((i * 7) % 3) / 2));
      ctx.beginPath(); ctx.moveTo(x, topY);
      if (frac >= 1) ctx.quadraticCurveTo(x + bow, shedY, x, fellY); else { const ey = lerp(topY, fellY, frac); ctx.lineTo(x + Math.sin(s.t * 6 + i) * R(0.004), ey); } // a loose end swings as it comes down
      ctx.stroke();
    }
    // the shafts: two bars, one up one down, and the heddle eyes on them
    for (const shaft of [0, 1]) {
      const lift = (shaft === 0 ? s.shed : 1 - s.shed) * 2 - 1, y = Y(0.26) - lift * R(0.025) + (shaft ? R(0.02) : 0) + Math.sin(s.t * 45 + shaft) * R(0.004) * s.heddle; // a flick of the heddles rattles the shaft
      ctx.fillStyle = hsla(...s.wood); ctx.fillRect(X(x0 - 0.02), y - R(0.006), X(x1 - x0 + 0.04), R(0.012));
      ctx.fillStyle = hsla(hue, 30, 60, 0.5 * lit);
      for (let i = shaft; i < warps; i += 2) ctx.fillRect(X(wx(i)) - 1, y - R(0.004), 2, R(0.008));
    }
    // the shed's wefts: each shuttle trails its thread across the shed from its last side, whipping while it flies; the shuttle itself a pointed block in its lane, lit while it flies
    for (const sh of s.shuttles) {
      const shY = Y(sh.y);
      ctx.strokeStyle = hsla(sh.hue, 85, 65, (0.35 + 0.55 * sh.hot) * lit); ctx.lineWidth = Math.max(1, R(0.002));
      ctx.beginPath(); ctx.moveTo(X(sh.side ? x0 : x1), shY);
      for (let k = 1; k <= 12; k++) { const f = k / 12, xx = lerp(sh.side ? x0 : x1, sh.x, f); ctx.lineTo(X(xx), shY + Math.sin(f * 14 + s.t * 40) * R(0.006) * sh.hot * (1 - f)); }
      ctx.stroke();
      if (sh.hot > 0.05) { const g = ctx.createRadialGradient(X(sh.x), shY, 0, X(sh.x), shY, R(0.08)); g.addColorStop(0, hsla(sh.hue, 80, 70, 0.35 * sh.hot)); g.addColorStop(1, hsla(sh.hue, 80, 70, 0)); ctx.fillStyle = g; ctx.fillRect(X(sh.x) - R(0.08), shY - R(0.08), R(0.16), R(0.16)); }
      ctx.fillStyle = hsla(sh.hue, 40 * sh.hot + 20, lerp(45, 85, sh.hot), lit);
      ctx.beginPath(); ctx.moveTo(X(sh.x) - R(0.04), shY); ctx.lineTo(X(sh.x), shY - R(0.011)); ctx.lineTo(X(sh.x) + R(0.04), shY); ctx.lineTo(X(sh.x), shY + R(0.011)); ctx.closePath(); ctx.fill();
    }
    // the bobbin: a spool at the left feeding the shuttles, spinning while one flies, its thread sagging across to the one thrown last
    const sh = s.shuttles.reduce((a, b) => (b.hot > a.hot ? b : a)), shY = Y(sh.y), bx = X(0.025), byy = Y(0.5), br = R(0.014);
    ctx.fillStyle = hsla(...s.wood); ctx.fillRect(bx - br * 0.4, byy - br * 1.5, br * 0.8, br * 3);
    ctx.fillStyle = hsla(sh.hue, 60, 45, lit); ctx.beginPath(); ctx.arc(bx, byy, br, 0, TAU); ctx.fill();
    ctx.strokeStyle = hsla(sh.hue, 70, 75, 0.8 * lit); ctx.lineWidth = Math.max(1, R(0.0012));
    for (let k = 0; k < 6; k++) { const a = s.bobbin + (k / 6) * TAU; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * br * 0.3, byy + Math.sin(a) * br * 0.3); ctx.lineTo(bx + Math.cos(a) * br * 0.95, byy + Math.sin(a) * br * 0.95); ctx.stroke(); }
    ctx.strokeStyle = hsla(sh.hue, 85, 65, 0.5 * lit); ctx.beginPath(); ctx.moveTo(bx, byy - br); ctx.quadraticCurveTo(lerp(bx, X(sh.x), 0.5), shY + R(0.05) * (1 - sh.hot), X(sh.x), shY); ctx.stroke();
    // the beater: a bar that strikes the fell on a kick and springs back
    const by = lerp(Y(0.5), fellY - R(0.006), s.beater);
    ctx.fillStyle = hsla(...s.wood); ctx.fillRect(X(x0 - 0.03), by - R(0.008), X(x1 - x0 + 0.06), R(0.016));
    ctx.fillStyle = hsla(hue, 20, 40 + 30 * s.beater, lit); ctx.fillRect(X(x0 - 0.03), by - R(0.002), X(x1 - x0 + 0.06), R(0.004));
    // the beams: top and the cloth beam line at the fell
    ctx.fillStyle = hsla(...s.wood); ctx.fillRect(X(x0 - 0.04), topY - R(0.012), X(x1 - x0 + 0.08), R(0.012));
    ctx.strokeStyle = hsla(hue, 25, 70, 0.6 * lit); ctx.lineWidth = Math.max(1, R(0.0015)); ctx.beginPath(); ctx.moveTo(X(x0 - 0.02), fellY); ctx.lineTo(X(x1 + 0.02), fellY); ctx.stroke();
    // the lint in the air, lit a little by the warp's light
    ctx.fillStyle = hsla(s.warp.hue + s.hueShift, 20, 85, 0.55 * lit);
    for (const l of s.lint) { const rr = Math.max(1.5, R(0.003)) * clamp(l.life / 2); ctx.fillRect(X(l.x) - rr / 2, Y(l.y) - rr / 2, rr, rr); }
    // sparks off the beater
    ctx.globalCompositeOperation = 'lighter';
    for (const sp of s.sparks) { ctx.fillStyle = hsla(40, 90, 75, clamp(sp.life / 0.3)); ctx.fillRect(X(sp.x), Y(sp.y), Math.max(1.5, R(0.0025)), Math.max(1.5, R(0.0025))); }
    ctx.globalCompositeOperation = 'source-over';
    if (s.riser > 0.01) { ctx.fillStyle = hsla(hue, 40, 90, 0.08 * s.riser); ctx.fillRect(0, 0, w, h); }
  },
};
