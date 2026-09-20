// loom: the song operates a weaving machine, and the machine makes cloth. Seen from the front: the warp runs top to
// bottom through two shafts that lift alternate threads to open the shed, a shuttle crosses the shed carrying the weft,
// a beater packs each row down onto the fell, and the cloth grows below and rolls away. A flywheel at the side turns at
// the tempo. Every mechanism is moved by a part and every movement leaves something in the cloth: the bass drives the
// shaft (its level the torque, its note the tension of the warp, and its pitch class picks the weave structure of the
// bar: plain, twill or satin), a kick is the beater's stroke (a row is packed: the shed's lift pattern becomes the row),
// an impact throws the shuttle across (the weft changes side and colour), hats flick the heddles, each line part is a
// pattern thread laid into the current row where its pitch falls across the warp, so the melody plots a figure down the
// cloth; the pad is the warp itself, its count and colour. A section's role is the machine's mode (establish: slow,
// a slack warp; climax: everything engaged, fast, sparks off the beater; release: the loom idling, rows rare) and a
// boundary starts a new band of cloth; a riser winds the flywheel up; a dropout stops the shaft. Aggression sparks,
// organicness slackens (rows wobble, threads vary). Around the mechanism the machine shows its working: a drive belt
// from the flywheel up to a pulley (its dashes run with the wheel), two treadles rocking with the shafts, the cloth
// rolling onto a beam below that thickens as rows are woven, a bobbin at the side feeding the shuttle its weft (it
// spins while the shuttle flies), and lint drifting in the air, shaken loose by every flick. Deterministic:
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
      beater: 0, shuttle: { x: 0.1, tx: 0.1, side: 0, hue: pal.line, hot: 0 }, heddle: 0, tie: 0,
      rows: [], // the cloth, newest first: { weave, r, hue, light, picks: [{ x, hue }], wobble }
      picks: [], // pattern picks waiting for the next row: { x, hue }
      sparks: [], mode: { ...MODE.none }, energy: 0.5, riser: 0, dark: 0, section: null, rowsWoven: 0,
      belt: 0, bobbin: 0, roll: 0, lint: [], // the belt's run (a length), the bobbin's turn, the cloth wound on the beam, lint in the air { x, y, vx, vy, life }
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
    const sh = s.shuttle; sh.x = ease(sh.x, sh.tx, 9, dt); sh.hot = decay(sh.hot, 3, dt);
    s.warp.count = ease(s.warp.count, 0.6, 0.3, dt);
    for (const sp of s.sparks) { sp.vy += 2 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.life -= dt; } s.sparks = s.sparks.filter((sp) => sp.life > 0);
    s.belt += W.omega * dt; s.bobbin += sh.hot * 14 * dt; // the belt runs with the wheel, the bobbin spins while the shuttle flies
    for (const l of s.lint) { l.vx = ease(l.vx, Math.sin(s.t * 0.7 + l.y * 9) * 0.03 + 0.01 * W.omega, 1, dt); l.vy = ease(l.vy, 0.015 + Math.cos(s.t * 0.9 + l.x * 7) * 0.02, 1, dt); l.x += l.vx * dt; l.y += l.vy * dt; l.life -= dt; }
    s.lint = s.lint.filter((l) => l.life > 0 && l.y < 0.98);
    const shake = (n, x, y) => { for (let i = 0; i < n && s.lint.length < 60; i++) s.lint.push({ x: x + (rand(s) - 0.5) * 0.1, y: y + (rand(s) - 0.5) * 0.04, vx: (rand(s) - 0.5) * 0.1, vy: -0.05 - rand(s) * 0.08, life: 5 + rand(s) * 5 }); };
    if (rand(s) < dt * W.omega * 0.15) shake(1, 0.1 + rand(s) * 0.8, 0.3 + rand(s) * 0.25); // the running machine sheds a little on its own
    const weaveRow = (g) => { // the beater packs a row: the shed's lift pattern, the band's colour, the pattern picks waiting, a wobble by the slack
      s.rows.unshift({ weave: s.tie, r: s.rowsWoven++, hue: s.pal.hue + s.hueShift, light: lerp(38, 58, g) + (s.rowsWoven % 8 < 4 ? 0 : -4), picks: s.picks, wobble: (rand(s) - 0.5) * 0.004 * s.slack, hot: 1 });
      s.picks = []; if (s.rows.length > 70) s.rows.pop();
      s.roll += ROW; shake(1 + Math.floor(g * 2), 0.1 + rand(s) * 0.8, FELL);
      s.shedTo = s.shedTo ? 0 : 1; s.beater = Math.max(s.beater, g);
      if (s.mode.sparks * s.edge > 0.2) for (let i = 0; i < 2 + Math.floor(rand(s) * 5 * s.mode.sparks); i++) s.sparks.push({ x: 0.1 + rand(s) * 0.8, y: FELL, vx: (rand(s) - 0.5) * 0.4, vy: -0.4 - rand(s) * 0.6, life: 0.3 + rand(s) * 0.3 });
    };
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'pulse') weaveRow(g);
        else if (e.role === 'impact') { sh.side = sh.side ? 0 : 1; sh.tx = sh.side ? 0.9 : 0.1; sh.hue = s.pal.line + s.hueShift + (sh.side ? 40 : 0); sh.hot = 1; s.heddle = Math.max(s.heddle, 0.5 * g); }
        else if (e.role === 'grain') { s.heddle = Math.max(s.heddle, 0.6 * g); shake(1, 0.1 + rand(s) * 0.8, 0.26); }
        else s.beater = Math.max(s.beater, 0.4 * g);
      } else if (slot === 'ground') {
        W.torque = Math.min(1.5, W.torque + 0.8 * g);
        if (e.note !== null) { s.warp.tension = clamp((e.note - 24) / 36); s.tie = ((e.note % 12) % 3); }
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        s.picks.push({ x: clamp(0.05 + 0.9 * clamp((e.note - 40) / 50) + (e.pan - 0.5) * 0.04, 0.02, 0.98), hue: (slot === 'line' ? s.pal.line : s.pal.line + 45) + s.hueShift, w: 0.5 + g }); // across the warp, 0..1
        if (s.picks.length > 12) s.picks.shift();
      } else if (slot === 'field') {
        s.warp.count = Math.min(1, s.warp.count + 0.3 * g);
        if (e.cutoff !== null) s.warp.tint = clamp(Math.log(e.cutoff / 200) / Math.log(40));
      } else if (slot === 'transition') {
        if (e.dur >= 1) { weaveRow(1.5); s.heddle = 1; }
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
    const x0 = 0.06, x1 = 0.86, warps = Math.round(WARPS * lerp(0.6, 1, s.warp.count)), wx = (i) => x0 + ((x1 - x0) * (i + 0.5)) / warps;
    const shedGap = R(0.05) * lerp(0.6, 1, s.warp.tension) * mode.engage, fellY = Y(FELL) + R(0.006) * s.beater;
    const warpCol = (a) => hsla(s.warp.hue + s.hueShift, pal.sat * 0.6, lerp(40, 70, s.warp.tint), a * lit);
    // the cloth roll: the beam below the cloth, thicker with every row wound on, turning as the cloth goes round it
    const rollR = R(0.022 + Math.min(0.05, s.roll * 0.06)), rollY = Y(0.975), rollAngle = (s.roll * h) / rollR;
    // the cloth below the fell: rows scroll down, each a strip of weft with the pattern picks laid in, and the warp threads running through, dashed by the weave (over where the row lifted them), until it meets the roll
    const cellW = ((x1 - x0) * w) / warps, wl = Math.max(1, R(0.0018) * s.weight);
    for (let k = 0; k < s.rows.length; k++) {
      const r = s.rows[k], y = fellY + k * R(ROW) + (r.wobble * h), hh = R(ROW) * 0.96;
      if (y > rollY - rollR * 0.9) break;
      ctx.fillStyle = hsla(r.hue, pal.sat * 0.7, r.light + 12 * r.hot, lit); ctx.fillRect(X(x0), y, X(x1 - x0), hh);
      for (const p of r.picks) { ctx.fillStyle = hsla(p.hue, 85, 70, lit); ctx.fillRect(X(x0 + (x1 - x0) * p.x) - cellW * 0.9, y, cellW * 1.8, hh); }
      ctx.fillStyle = warpCol(0.95);
      for (let i = 0; i < warps; i++) if (WEAVES[r.weave](i, r.r)) ctx.fillRect(X(wx(i)) - wl / 2, y - 1, wl, hh + 2);
    }
    // the roll itself: a cylinder in the band's colour with the cloth's texture turning round it, on a wooden axle
    ctx.fillStyle = hsla(...s.wood); ctx.fillRect(X(x0 - 0.05), rollY - R(0.006), X(x1 - x0 + 0.1), R(0.012));
    { const g = ctx.createLinearGradient(0, rollY - rollR, 0, rollY + rollR); g.addColorStop(0, hsla(hue, pal.sat * 0.6, 22, lit)); g.addColorStop(0.35, hsla(hue, pal.sat * 0.6, 52, lit)); g.addColorStop(1, hsla(hue, pal.sat * 0.6, 16, lit)); ctx.fillStyle = g; ctx.fillRect(X(x0), rollY - rollR, X(x1 - x0), rollR * 2); } // a cylinder: lit along its top
    ctx.strokeStyle = hsla(hue, pal.sat * 0.5, 70, 0.6 * lit); ctx.lineWidth = Math.max(1, R(0.0012));
    for (let k = 0; k < 14; k++) { const a = rollAngle + (k / 14) * TAU, yy = rollY + Math.sin(a) * rollR; if (Math.cos(a) > 0) { ctx.globalAlpha = 0.3 + 0.7 * Math.cos(a); ctx.beginPath(); ctx.moveTo(X(x0), yy); ctx.lineTo(X(x1), yy); ctx.stroke(); } }
    ctx.globalAlpha = 1;
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
      const shaft = i % 2, up = shaft === 0 ? s.shed : 1 - s.shed, lift = up * 2 - 1; // +1 up, -1 down
      const x = X(wx(i)) + Math.sin(i * 1.7 + s.t * 3) * R(0.001) * s.slack + (i % 3 === 0 ? s.heddle * R(0.003) : 0);
      const shedY = Y(0.42), bow = lift * shedGap * 0.5 * (shaft ? 1 : -1);
      ctx.strokeStyle = warpCol(0.4 + 0.5 * up * mode.engage + 0.15 * s.warp.tension); ctx.lineWidth = Math.max(1, R(0.0015) * s.weight * (0.7 + 0.6 * up) * (1 + 0.5 * s.slack * ((i * 7) % 3) / 2));
      ctx.beginPath(); ctx.moveTo(x, topY); ctx.quadraticCurveTo(x + bow, shedY, x, fellY); ctx.stroke();
    }
    // the shafts: two bars, one up one down, and the heddle eyes on them
    for (const shaft of [0, 1]) {
      const lift = (shaft === 0 ? s.shed : 1 - s.shed) * 2 - 1, y = Y(0.26) - lift * R(0.025) + (shaft ? R(0.02) : 0) + Math.sin(s.t * 45 + shaft) * R(0.004) * s.heddle; // a flick of the heddles rattles the shaft
      ctx.fillStyle = hsla(...s.wood); ctx.fillRect(X(x0 - 0.02), y - R(0.006), X(x1 - x0 + 0.04), R(0.012));
      ctx.fillStyle = hsla(hue, 30, 60, 0.5 * lit);
      for (let i = shaft; i < warps; i += 2) ctx.fillRect(X(wx(i)) - 1, y - R(0.004), 2, R(0.008));
    }
    // the shed's weft: the thread the shuttle trails behind it across the shed, from its last side, whipping while it flies
    const sh = s.shuttle, shY = Y(0.45);
    ctx.strokeStyle = hsla(sh.hue, 85, 65, (0.4 + 0.5 * sh.hot) * lit); ctx.lineWidth = Math.max(1, R(0.002));
    ctx.beginPath(); ctx.moveTo(X(sh.side ? x0 : x1), shY);
    for (let k = 1; k <= 12; k++) { const f = k / 12, xx = lerp(sh.side ? x0 : x1, sh.x, f); ctx.lineTo(X(xx), shY + Math.sin(f * 14 + s.t * 40) * R(0.006) * sh.hot * (1 - f)); }
    ctx.stroke();
    // the bobbin: a spool at the left feeding the shuttle, spinning while it flies, the thread sagging across to it
    const bx = X(0.025), byy = Y(0.5), br = R(0.014);
    ctx.fillStyle = hsla(...s.wood); ctx.fillRect(bx - br * 0.4, byy - br * 1.5, br * 0.8, br * 3);
    ctx.fillStyle = hsla(sh.hue, 60, 45, lit); ctx.beginPath(); ctx.arc(bx, byy, br, 0, TAU); ctx.fill();
    ctx.strokeStyle = hsla(sh.hue, 70, 75, 0.8 * lit); ctx.lineWidth = Math.max(1, R(0.0012));
    for (let k = 0; k < 6; k++) { const a = s.bobbin + (k / 6) * TAU; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * br * 0.3, byy + Math.sin(a) * br * 0.3); ctx.lineTo(bx + Math.cos(a) * br * 0.95, byy + Math.sin(a) * br * 0.95); ctx.stroke(); }
    ctx.strokeStyle = hsla(sh.hue, 85, 65, 0.5 * lit); ctx.beginPath(); ctx.moveTo(bx, byy - br); ctx.quadraticCurveTo(lerp(bx, X(sh.x), 0.5), shY + R(0.05) * (1 - sh.hot), X(sh.x), shY); ctx.stroke();
    // the shuttle itself: a pointed block, lit while it flies
    if (sh.hot > 0.05) { const g = ctx.createRadialGradient(X(sh.x), shY, 0, X(sh.x), shY, R(0.08)); g.addColorStop(0, hsla(sh.hue, 80, 70, 0.35 * sh.hot)); g.addColorStop(1, hsla(sh.hue, 80, 70, 0)); ctx.fillStyle = g; ctx.fillRect(X(sh.x) - R(0.08), shY - R(0.08), R(0.16), R(0.16)); }
    ctx.fillStyle = hsla(pal.hue + 30, 40, lerp(45, 85, sh.hot), lit);
    ctx.beginPath(); ctx.moveTo(X(sh.x) - R(0.045), shY); ctx.lineTo(X(sh.x), shY - R(0.014)); ctx.lineTo(X(sh.x) + R(0.045), shY); ctx.lineTo(X(sh.x), shY + R(0.014)); ctx.closePath(); ctx.fill();
    // the beater: a bar that strikes the fell on a kick and springs back
    const by = lerp(Y(0.5), fellY - R(0.006), s.beater);
    ctx.fillStyle = hsla(...s.wood); ctx.fillRect(X(x0 - 0.03), by - R(0.008), X(x1 - x0 + 0.06), R(0.016));
    ctx.fillStyle = hsla(hue, 20, 40 + 30 * s.beater, lit); ctx.fillRect(X(x0 - 0.03), by - R(0.002), X(x1 - x0 + 0.06), R(0.004));
    // the beams: top and the cloth beam line at the fell
    ctx.fillStyle = hsla(...s.wood); ctx.fillRect(X(x0 - 0.04), topY - R(0.012), X(x1 - x0 + 0.08), R(0.012));
    ctx.strokeStyle = hsla(hue, 25, 70, 0.6 * lit); ctx.lineWidth = Math.max(1, R(0.0015)); ctx.beginPath(); ctx.moveTo(X(x0 - 0.02), fellY); ctx.lineTo(X(x1 + 0.02), fellY); ctx.stroke();
    // the flywheel at the right, its spokes turning, a crank rod to the beater
    const fx = X(0.975), fy = Y(0.5), fr = R(0.11) * s.spread;
    ctx.strokeStyle = hsla(hue + 20, 30, lerp(45, 75, clamp(s.wheel.torque)), lit); ctx.lineWidth = Math.max(1, R(0.005) * s.weight);
    ctx.beginPath(); ctx.arc(fx, fy, fr, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(1, R(0.003) * s.weight); ctx.beginPath(); ctx.arc(fx, fy, fr * 0.8, 0, TAU); ctx.stroke();
    for (let k = 0; k < 8; k++) { const a = s.wheel.angle + (k / 8) * TAU; ctx.beginPath(); ctx.moveTo(fx + Math.cos(a) * fr * 0.15, fy + Math.sin(a) * fr * 0.15); ctx.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr); ctx.stroke(); }
    const cx = fx + Math.cos(s.wheel.angle) * fr * 0.6, cy = fy + Math.sin(s.wheel.angle) * fr * 0.6; // the crank pin
    ctx.lineWidth = Math.max(1, R(0.004) * s.weight); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(X(x1 + 0.03), by); ctx.stroke();
    ctx.fillStyle = hsla(hue + 20, 30, 80, lit); ctx.beginPath(); ctx.arc(cx, cy, R(0.008), 0, TAU); ctx.fill();
    ctx.fillStyle = hsla(...s.wood); ctx.beginPath(); ctx.arc(fx, fy, fr * 0.15, 0, TAU); ctx.fill();
    // the drive belt: from the flywheel up to a small pulley over the warp beam, its dashes running with the wheel, the pulley turning faster for its size
    const px = fx, py = Y(0.05), pr = fr * 0.3, run = s.belt * fr;
    ctx.strokeStyle = hsla(hue + 20, 25, 55, 0.9 * lit); ctx.lineWidth = Math.max(1, R(0.003));
    ctx.setLineDash([R(0.012), R(0.008)]);
    ctx.lineDashOffset = -run; ctx.beginPath(); ctx.moveTo(fx - fr, fy); ctx.lineTo(px - pr, py); ctx.stroke(); // the up side
    ctx.lineDashOffset = run; ctx.beginPath(); ctx.moveTo(px + pr, py); ctx.lineTo(fx + fr, fy); ctx.stroke(); // the down side
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1, R(0.003) * s.weight); ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.stroke();
    for (let k = 0; k < 4; k++) { const a = s.wheel.angle * (fr / pr) + (k / 4) * TAU; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * pr, py + Math.sin(a) * pr); ctx.stroke(); }
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
