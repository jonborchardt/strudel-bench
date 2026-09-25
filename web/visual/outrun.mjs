// outrun: an arcade cabinet in 1995, the OutRun kind of racer: a red convertible seen from behind on a road that
// bends, climbs and rushes at the player in painted bands, palms and billboards scaling up past the shoulders,
// three lanes of traffic to weave through, a stage per section and a checkpoint gantry at every boundary. The music
// plays the game. The melody steers (a high note pulls the car right, a low one left, the counter nudges it); the
// bass bends the road (a low note a left-hander, a high one a right, harder with the gain), and the car drifts to
// the outside of every bend until the steering catches up, so what you watch is the driver fighting the road the
// song draws, and swerving round the car ahead. A kick is a gear kick (a burst of speed, the car bobs, the exhaust
// puffs), a snare or clap puts a slow car just ahead that gets passed at once, the hats plant the roadside (a palm, a
// sign, a tree per hit, so a busy hi-hat lines the road and a sparse one leaves it open), the pad is the sky (its
// level the cloud, its cutoff the light). Energy is the speed and the traffic; the role sets the pace. A riser is
// the long climb at speed before a crest; the boundary is the CHECKPOINT, EXTENDED TIME, the next stage's scenery
// (a coconut beach to establish; the gateway city, the canyon, the alps, the wheat fields, the cloudy pass and the
// desert in turn to develop; the autobahn or the desert flats for a climax; the seaside town or the lakeside to
// release) and the counter set to the seconds to the next one, so it always runs down to the flag. A dropout is the
// crash: the car leaves the road, tumbles and stops, and the song coming back is a restart from the shoulder. Off
// the road is grass: the view shakes and the car slows. The HUD is the cabinet's (score, time, stage, km/h, the lap
// clock) under scanlines and a curved-glass vignette. Deterministic: randomness only from the state's own generator
// (kit.mjs); units are the canvas height, world units are the road's half width.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const HOR = 0.42, CAM_H = 1, CAM_D = 0.85, SEG = 0.22, N = 80, Z0 = 1.3, CURVE = 0.0025, LANES = [-0.62, 0, 0.62], MAX_CARS = 9;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
const SCENE = { establish: { speed: 0.75, traffic: 0.6 }, develop: { speed: 1, traffic: 1 }, climax: { speed: 1.3, traffic: 1.5 }, release: { speed: 0.85, traffic: 0.7 }, none: { speed: 1, traffic: 1 } };
// a stage: its ground, what stands at the horizon, what lines the road and how far apart (world units), how much the road bends and rolls, and water beside it
const LAND = {
  beach: { ground: [95, 45, 42], bg: 'sea', side: ['palm', 'palm', 'palm', 'bush', 'sign', 'billboard'], gap: [0.8, 2.2], curve: 0.7, hill: 0.2, water: -1 },
  gateway: { ground: [100, 25, 34], bg: 'city', side: ['lamp', 'building', 'lamp', 'sign', 'billboard', 'tree', 'building'], gap: [0.6, 1.5], curve: 0.5, hill: 0.3 },
  canyon: { ground: [22, 45, 40], bg: 'mesas', side: ['cliff', 'rock', 'cactus', 'cliff', 'sign', 'rock'], gap: [0.5, 1.4], curve: 1.2, hill: 0.6 },
  alps: { ground: [110, 35, 38], bg: 'peaks', side: ['pine', 'pine', 'rock', 'pine', 'sign', 'house'], gap: [0.5, 1.6], curve: 1, hill: 1.2 },
  wheat: { ground: [48, 60, 50], bg: 'hills', side: ['tree', 'windmill', 'bush', 'sign', 'tree', 'barn'], gap: [1, 2.6], curve: 0.5, hill: 0.5 },
  cloudy: { ground: [100, 22, 36], bg: 'hills', side: ['pine', 'tree', 'rock', 'sign', 'pine'], gap: [0.7, 2], curve: 0.9, hill: 1 },
  desert: { ground: [36, 55, 56], bg: 'mesas', side: ['cactus', 'rock', 'billboard', 'cactus', 'sign'], gap: [1, 3], curve: 0.4, hill: 0.3 },
  autobahn: { ground: [100, 30, 36], bg: 'flat', side: ['lamp', 'pylon', 'sign', 'lamp', 'billboard'], gap: [0.5, 1.2], curve: 0.3, hill: 0.15 },
  seaside: { ground: [95, 40, 42], bg: 'sea', side: ['house', 'palm', 'lamp', 'house', 'lighthouse', 'sign'], gap: [0.7, 1.8], curve: 0.8, hill: 0.4, water: 1 },
  lakeside: { ground: [110, 35, 40], bg: 'peaks', side: ['pine', 'tree', 'bush', 'house', 'sign'], gap: [0.8, 2], curve: 0.8, hill: 0.5, water: -1 },
};
const SKY = { cool: { top: [212, 60, 55], low: [200, 50, 80], sun: [48, 90, 92], stars: 0 }, warm: { top: [255, 55, 34], low: [28, 85, 62], sun: [22, 95, 62], stars: 0 }, dim: { top: [250, 40, 8], low: [265, 35, 22], sun: [50, 20, 88], stars: 1 }, pale: { top: [200, 12, 62], low: [195, 10, 78], sun: [50, 10, 90], stars: 0 } };
const WORDS = ['GAS', 'MOTEL', 'DINER', 'RADIO', 'SURF', 'TIRES', 'CAFE', 'HOTEL', 'COLA', 'BEACH', 'OIL', 'PIZZA'];

/** The stage of each section: by role, the develop ones in a seeded rotation, release alternating sea and lake. */
const landsOf = (roles, rng) => {
  const dev = ['gateway', 'canyon', 'alps', 'wheat', 'cloudy', 'desert'], off = Math.floor(rng() * dev.length), top = rng() < 0.5 ? 'autobahn' : 'desert';
  let d = 0, r = Math.floor(rng() * 2);
  return roles.map((role) => (role === 'establish' ? 'beach' : role === 'climax' ? top : role === 'release' ? ['seaside', 'lakeside'][r++ % 2] : dev[(off + d++) % dev.length]));
};
const gap = (s, land) => land.gap[0] + rand(s) * (land.gap[1] - land.gap[0]);
/** A thing at the roadside of segment `seg`: the stage's own pick unless `kind` says, on `side`, at a distance from the road that suits it. */
const plant = (s, seg, land, side, kind = null) => {
  if (seg.sprites.length >= 3) return;
  const k = kind ?? land.side[Math.floor(rand(s) * land.side.length)];
  const x = k === 'arch' ? 0 : side * (k === 'cliff' ? 1.9 : k === 'lamp' || k === 'sign' ? 1.25 : k === 'building' ? 1.7 + rand(s) * 0.6 : 1.4 + rand(s) * 1.6);
  seg.sprites.push({ kind: k, x, h: 0.8 + rand(s) * 0.5, v: rand(s), word: Math.floor(rand(s) * WORDS.length), dir: s.curveTo < 0 ? -1 : 1 });
};
/** Segment `i` of the road, generated on demand: the bend eases toward the bass's target (or wanders on its own), the slope toward the stage's roll, and the roadside fills by distance. */
const segAt = (s, i) => {
  while (s.seg0 + s.segs.length <= i) {
    const last = s.segs[s.segs.length - 1], land = LAND[s.landTo] ?? LAND.beach;
    s.curve += (s.curveTo - s.curve) * 0.08; s.slope += (s.slopeTo - s.slope) * 0.05;
    if (rand(s) < 0.03 && s.riser <= 0) s.slopeTo = (rand(s) - 0.5) * 0.08 * land.hill;
    if (rand(s) < 0.02 && s.bassHold < 0.05) s.curveTo = (rand(s) - 0.5) * 2 * CURVE * land.curve;
    const seg = { curve: s.curve, y: (last ? last.y : 0) + s.slope, sprites: [] };
    s.sideNext -= SEG; if (s.sideNext <= 0) { plant(s, seg, land, rand(s) < 0.5 ? -1 : 1); s.sideNext = gap(s, land); }
    s.segs.push(seg);
  }
  return s.segs[i - s.seg0];
};
const spawnCar = (s, z, frac, near = false) => {
  if (s.cars.length >= MAX_CARS || (near && s.cars.some((c) => c.z > s.pos && c.z < s.pos + 9))) return; // a car put right ahead needs the road ahead clear, or the traffic stacks up
  const r = rand(s), lanes = near ? LANES.filter((x) => Math.abs(x - s.x) > 0.4) : LANES, x = lanes.length ? lanes[Math.floor(rand(s) * lanes.length)] : 0;
  s.cars.push({ z, x, v: (7 + 11 * s.energy) * frac, hue: Math.floor(rand(s) * 360), kind: r < 0.18 ? 'truck' : r < 0.32 ? 'van' : 'car', lit: near ? 1 : 0, passed: 0, hit: 0 });
};
const secsOf = (s, i) => s.secs[i] ?? 60;

export default {
  name: 'outrun',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const roles = score.sections.map((x) => x.role ?? 'none'), lands = landsOf(roles, rng), first = LAND[lands[0]] ?? LAND.beach;
    const shapes = () => Array.from({ length: 22 }, () => ({ x: rng() * 3, w: 0.06 + rng() * 0.2, h: 0.03 + rng() * 0.14, v: rng() }));
    const s = {
      pal, W: size.w / size.h, cps: score.cps, sky: SKY[p.temperature] ? p.temperature : 'cool', lum: p.luminance,
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      roles, lands, landTo: lands[0] ?? 'beach', ground: [...first.ground], secs: score.sections.map((x) => (x.until - x.at) / score.cps),
      t: 0, pos: 0, vel: 0, energy: 0.5, speed: 1, traffic: 1, riser: 0, wasRiser: 0, beat: 0, beatPhase: 0, light: 0.6, cloud: 0.4, cloudTo: 0.4,
      x: 0, xTo: 0, steer: 0, melX: 0, nudge: 0, avoid: 0, curve: 0, curveTo: 0, slope: 0, slopeTo: 0, bassHold: 0,
      seg0: 0, segs: [], sideNext: 0.5, bgX: 0, cars: [], carNext: 3, passed: 0, score: 0, hi: 1e6 + Math.floor(rng() * 9e6), time: 0, stage: 1, check: 0, flash: 0, lit: 0,
      crash: 0, crashDir: 1, tumble: 0, bump: 0, kick: 0, rev: 0, shake: 0, wheel: 0,
      bg: { peaks: shapes(), mesas: shapes(), city: shapes(), hills: shapes(), sea: shapes(), flat: shapes() },
      clouds: Array.from({ length: 6 }, () => ({ x: rng() * 3, y: 0.04 + rng() * 0.22, w: 0.1 + rng() * 0.2, a: 0.4 + rng() * 0.5 })),
      stars: Array.from({ length: 60 }, () => ({ x: rng() * 3, y: rng() * HOR * 0.9, w: 0.3 + rng() * 0.7 })),
    };
    seed(s, rng);
    s.time = secsOf(s, 0) + 4;
    segAt(s, N + 2);
    for (let i = 0; i < 3; i++) spawnCar(s, 5 + i * 5, 0.35 + rand(s) * 0.3);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = SCENE[role] ?? SCENE.none, land = LAND[s.landTo] ?? LAND.beach;
    s.energy = ease(s.energy, clock.energy, 2, dt); s.speed = ease(s.speed, want.speed, 1.5, dt); s.traffic = ease(s.traffic, want.traffic, 1.5, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.wasRiser = s.riser > 0 ? s.riser : decay(s.wasRiser, 2, dt);
    s.beat = clock.beat; s.beatPhase = clock.beatPhase;
    let base = Math.floor(s.pos / SEG);
    if (clock.boundary) { // the checkpoint: the gantry just ahead, the time extended by the stage's length, the next scenery
      s.check = 3; s.stage = clock.index + 1; s.time = secsOf(s, clock.index) + 4; s.flash = Math.max(s.flash, 0.35); s.landTo = s.lands[clock.index] ?? s.landTo;
      plant(s, segAt(s, base + 3), land, 1, 'arch');
      if (s.wasRiser > 0.3) s.slopeTo = -0.05; // over the crest
    }
    if (clock.dropout && !s.crash) { s.crash = 1; s.tumble = 0; s.crashDir = s.x < 0 ? -1 : 1; s.bump = 1; }
    if (!clock.dropout && s.crash) { s.crash = 0; s.x = s.xTo = 0; s.vel = 0; s.tumble = 0; s.flash = Math.max(s.flash, 0.4); }
    s.time = Math.max(0, s.time - dt); if (s.time <= 0 && clock.index < 0) { s.time = 60; s.check = 3; } // a plain pattern: the clock alone extends it
    // the speed: world units a second, by the scene and the energy, faster into a riser, none in a crash, half on the grass
    const off = Math.abs(s.x) > 1.05 ? 1 : 0;
    const vTo = s.crash ? 0 : (7 + 11 * s.energy) * s.speed * (1 + 0.5 * s.riser) * (off ? 0.5 : 1);
    s.vel = ease(s.vel, vTo, s.crash ? 4 : 0.8, dt);
    s.pos += s.vel * dt; base = Math.floor(s.pos / SEG);
    segAt(s, base + N + 1);
    if (base > s.seg0) { s.segs.splice(0, base - s.seg0); s.seg0 = base; }
    if (s.riser > 0) s.slopeTo = 0.07 * s.riser; // the long climb
    const here = segAt(s, base).curve;
    // the steering: the melody's target, the counter's nudge, a swerve round the car ahead in our lane; the bend drifts the car outward until the steering catches up
    let avoid = 0;
    for (const c of s.cars) { const d = c.z - s.pos; if (d > 0 && d < 6 && Math.abs(c.x - s.x) < 0.55) avoid += (c.x > 0.05 ? -1 : c.x < -0.05 ? 1 : s.x >= c.x ? 1 : -1) * 0.7 * (1 - d / 6); }
    s.avoid = ease(s.avoid, clamp(avoid, -0.9, 0.9), 6, dt);
    s.nudge = decay(s.nudge, 1.5, dt);
    s.xTo = s.crash ? s.crashDir * 1.7 : clamp(s.melX + s.nudge + s.avoid, -0.85, 0.85);
    const px = s.x;
    s.x = clamp(ease(s.x, s.xTo, s.crash ? 1.5 : 2.5, dt) - here * s.vel * 25 * dt, -1.9, 1.9);
    s.steer = ease(s.steer, (s.x - px) / dt, 8, dt);
    s.wheel = (s.wheel + s.vel * dt * 3) % 1;
    s.bgX += -here * s.vel * 14 * dt;
    for (const c of s.clouds) c.x = ((c.x - dt * 0.01 - here * s.vel * 5 * dt) % 3 + 3) % 3;
    s.kick = decay(s.kick, 6, dt); s.rev = decay(s.rev, 5, dt); s.bump = decay(s.bump, 5, dt); s.flash = decay(s.flash, 5, dt); s.lit = decay(s.lit, 4, dt); s.bassHold = decay(s.bassHold, 0.4, dt);
    s.check = Math.max(0, s.check - dt);
    s.shake = ease(s.shake, off || s.crash ? 1 : 0, 6, dt);
    if (s.crash) s.tumble += dt * 7;
    const gt = land.ground; for (let i = 0; i < 3; i++) s.ground[i] = ease(s.ground[i], gt[i], 0.6, dt);
    s.cloud = ease(s.cloud, s.cloudTo, 0.5, dt); s.cloudTo = ease(s.cloudTo, 0.35, 0.05, dt);
    // the traffic, by distance: a car every so often far ahead and slower than us, passed when it falls behind, bumped when it is where we are
    s.carNext -= s.vel * dt;
    if (s.carNext <= 0) { spawnCar(s, s.pos + N * SEG * 0.85, 0.3 + 0.4 * rand(s)); s.carNext = (4 + rand(s) * 8) / Math.max(0.2, s.traffic); }
    for (const c of s.cars) {
      c.z += c.v * dt; c.lit = decay(c.lit, 4, dt);
      if (!c.passed && c.z < s.pos) { c.passed = 1; s.passed++; s.score += 1000; }
      if (!c.hit && !s.crash && Math.abs(c.z - s.pos) < 0.7 && Math.abs(c.x - s.x) < 0.5) { c.hit = 1; s.bump = 1; s.vel *= 0.6; c.lit = 1; }
    }
    s.cars = s.cars.filter((c) => c.z > s.pos - 0.3 && c.z < s.pos + N * SEG + 2);
    s.score += s.vel * dt * 12;
    // the events, each by its part's job in the cast
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'transition') { if (e.dur >= 1) { s.flash = Math.max(s.flash, 0.7); s.bump = 1; plant(s, segAt(s, base + N - 2), land, rand(s) < 0.5 ? -1 : 1, 'billboard'); } } // the impact (a whole cycle long); a riser's slices are the clock's business
      else if (e.role === 'pulse') { s.kick = 1; s.rev = 1; if (!s.crash) s.vel += 0.8 * g; } // a kick, whatever slot its part took: a gear kick
      else if (e.role === 'impact') { if (rand(s) < 0.6) spawnCar(s, s.pos + 5 + rand(s) * 2, 0.25 + 0.15 * rand(s), true); s.lit = 1; } // a slow car right ahead, brake lights on, passed at once
      else if (slot === 'impulse') s.kick = Math.max(s.kick, 0.5 * g);
      else if (slot === 'ground') { if (e.note !== null) { s.curveTo = (clamp((e.note - 36) / 24) - 0.5) * 2 * CURVE * land.curve * clamp(g, 0.5, 1.2); s.bassHold = 1; } }
      else if (slot === 'line') { if (e.note !== null) s.melX = lerp(-0.75, 0.75, clamp((e.note - 60) / 24)); }
      else if (slot === 'counter') { if (e.note !== null) s.nudge = (clamp((e.note - 48) / 24) - 0.5) * 0.6; }
      else if (slot === 'field') { s.cloudTo = clamp(0.3 + 0.6 * g); if (e.cutoff !== null) s.light = clamp(Math.log(e.cutoff / 200) / Math.log(40)); }
      else if (e.role === 'grain' || slot === 'grain') { if (rand(s) < 0.4 * g) plant(s, segAt(s, base + N - 2), land, rand(s) < 0.5 ? -1 : 1); }
    }
  },

  draw(s, ctx, w, h) {
    const W = w / h, sky = SKY[s.sky], night = sky.stars, day = lerp(0.65, 1.15, s.lum) * lerp(0.75, 1.1, s.light), dim = night ? 0.45 : 1, land = LAND[s.landTo] ?? LAND.beach;
    const shk = s.shake * 0.006 + s.bump * 0.012, sx = shk * Math.sin(s.t * 47) * Math.cos(s.t * 13), sy = shk * Math.cos(s.t * 59) + s.kick * 0.004;
    const X = (x) => (x + sx) * h, Y = (y) => (y + sy) * h, hor = Y(HOR);
    ctx.globalCompositeOperation = 'source-over'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // the sky, the sun, the stars, the clouds, the horizon's skyline (scrolling against the bend), the far ground
    const grad = ctx.createLinearGradient(0, 0, 0, hor);
    grad.addColorStop(0, hsla(sky.top[0], sky.top[1], sky.top[2] * day)); grad.addColorStop(1, hsla(sky.low[0], sky.low[1], sky.low[2] * day));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    if (night) for (const st of s.stars) { const x = ((st.x + s.bgX * 0.2) % 3 + 3) % 3; if (x > W) continue; ctx.fillStyle = hsla(50, 20, 90, 0.7 * st.w); ctx.fillRect(X(x), Y(st.y), h * 0.004 * st.w, h * 0.004 * st.w); }
    const sunX = ((0.6 + s.bgX * 0.15) % 3 + 3) % 3;
    if (sunX < W + 0.1) { ctx.beginPath(); ctx.arc(X(sunX), Y(HOR - 0.16), h * (night ? 0.035 : 0.06), 0, TAU); ctx.fillStyle = hsla(sky.sun[0], sky.sun[1], sky.sun[2], 0.95); ctx.fill(); }
    for (const c of s.clouds) { const x = ((c.x + s.bgX * 0.3) % 3 + 3) % 3; if (x > W + 0.4) continue; ctx.fillStyle = hsla(sky.low[0], 20, night ? 28 : 94 * Math.min(1, day), 0.7 * c.a * s.cloud * 2); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(X(x + i * c.w * 0.4), Y(c.y + Math.abs(i) * 0.012), h * c.w * 0.5, h * c.w * (0.22 - Math.abs(i) * 0.06), 0, 0, TAU); ctx.fill(); } }
    skyline(s, ctx, h, W, land.bg, X, Y, night, day);
    const [gh, gs, gl] = s.ground;
    ctx.fillStyle = hsla(gh, gs, gl * 0.8 * day * dim); ctx.fillRect(0, hor, w, h - hor);
    // the road: every point projected near to far (the bend accumulates, the camera sits on the road at the car's offset), then the bands painted far to near with their roadside and traffic
    const base = Math.floor(s.pos / SEG), frac = (s.pos - base * SEG) / SEG, camX = s.x, camY = CAM_H + lerp(segAt(s, base).y, segAt(s, base + 1).y, frac);
    const P = []; let x = 0, dx = -segAt(s, base).curve * frac;
    for (let k = 0; k <= N; k++) { const seg = segAt(s, base + k), z = Z0 + (k - frac) * SEG, sc = CAM_D / z; P.push({ sx: W / 2 + sc * (x - camX), sy: HOR + sc * (camY - seg.y), w: sc, sc }); x += dx; dx += seg.curve; }
    const vis = []; let maxy = 2;
    for (let k = 0; k < N; k++) { const a = P[k], b = P[k + 1]; vis[k] = b.sy < a.sy && b.sy < maxy; if (vis[k]) maxy = a.sy; }
    const byK = []; for (const c of s.cars) { const k = Math.floor(c.z / SEG) - base; if (k >= 0 && k < N) (byK[k] ??= []).push(c); }
    const fogCol = hsla(sky.low[0], sky.low[1], sky.low[2] * day);
    for (let k = N - 1; k >= 0; k--) {
      if (!vis[k]) continue;
      const a = P[k], b = P[k + 1], seg = segAt(s, base + k), alt = Math.floor((base + k) / 3) % 2, lit = day * dim;
      const poly = (xa, wa, xb, wb, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(X(xa - wa), Y(a.sy)); ctx.lineTo(X(xa + wa), Y(a.sy)); ctx.lineTo(X(xb + wb), Y(b.sy)); ctx.lineTo(X(xb - wb), Y(b.sy)); ctx.closePath(); ctx.fill(); };
      ctx.fillStyle = hsla(gh, gs, (alt ? gl : gl - 6) * lit); ctx.fillRect(0, Y(b.sy) - 1, w, Y(a.sy) - Y(b.sy) + 2);
      if (land.water) { const side = land.water, ex = side < 0 ? 0 : W; ctx.fillStyle = hsla(205, 55, (alt ? 44 : 40) * lit); ctx.beginPath(); ctx.moveTo(X(ex), Y(a.sy)); ctx.lineTo(X(a.sx + side * a.w * 1.9), Y(a.sy)); ctx.lineTo(X(b.sx + side * b.w * 1.9), Y(b.sy)); ctx.lineTo(X(ex), Y(b.sy)); ctx.closePath(); ctx.fill(); }
      poly(a.sx, a.w * 1.16, b.sx, b.w * 1.16, alt ? hsla(0, 0, 92 * lit) : hsla(0, 80, 48 * lit));
      poly(a.sx, a.w, b.sx, b.w, hsla(0, 0, (alt ? 40 : 37) * lit));
      if (alt) for (const lx of [-1 / 3, 1 / 3]) poly(a.sx + lx * a.w, a.w * 0.018, b.sx + lx * b.w, b.w * 0.018, hsla(0, 0, 90 * lit));
      if (k > N * 0.45) { const f = (k - N * 0.45) / (N * 0.55); ctx.fillStyle = fogCol; ctx.globalAlpha = f * f * 0.85; ctx.fillRect(0, Y(b.sy) - 1, w, Y(a.sy) - Y(b.sy) + 2); ctx.globalAlpha = 1; }
      for (const o of seg.sprites) sprite(s, ctx, h, o, X(a.sx + a.sc * o.x), Y(a.sy), a.sc * h, night, day);
      for (const c of byK[k] ?? []) { const f = (c.z - (base + k) * SEG) / SEG, sc = lerp(a.sc, b.sc, f); car(ctx, X(lerp(a.sx, b.sx, f) + sc * c.x), Y(lerp(a.sy, b.sy, f)), sc * h, c, night, Math.abs(c.z - s.pos) < 3 ? 1 : 0); }
    }
    player(s, ctx, h, W, X, Y);
    hud(s, ctx, w, h);
    if (s.flash > 0.01) { ctx.fillStyle = hsla(50, 30, 96, 0.7 * s.flash); ctx.fillRect(0, 0, w, h); }
    // the cabinet's glass: scanlines and a curved vignette
    const sp = Math.max(2, h / 270); ctx.fillStyle = 'rgba(0 0 0 / .13)'; for (let y = 0; y < h; y += sp * 2) ctx.fillRect(0, y, w, sp * 0.6);
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 1.05); vig.addColorStop(0, 'rgba(0 0 0 / 0)'); vig.addColorStop(1, 'rgba(0 0 0 / .55)'); ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
  },
};

/** The horizon's skyline, one band per stage kind, repeating every three heights and scrolling against the bend. */
function skyline(s, ctx, h, W, kind, X, Y, night, day) {
  const shapes = s.bg[kind] ?? s.bg.hills, hue = s.pal.hue, l = (night ? 0.4 : 1) * day;
  if (kind === 'sea') { ctx.fillStyle = hsla(205, 60, 46 * l); ctx.fillRect(0, Y(HOR - 0.035), W * h, h * 0.035); ctx.fillStyle = hsla(205, 40, 70 * l, 0.5); ctx.fillRect(0, Y(HOR - 0.035), W * h, h * 0.004); }
  for (const q of shapes) {
    const x = ((q.x + s.bgX) % 3 + 3) % 3 - 0.3; if (x > W + 0.3) continue;
    const bx = X(x), by = Y(HOR), ww = q.w * h, hh = q.h * h;
    if (kind === 'peaks') { ctx.fillStyle = hsla(hue, 25, 42 * l); ctx.beginPath(); ctx.moveTo(bx - ww, by); ctx.lineTo(bx, by - hh * 1.6); ctx.lineTo(bx + ww, by); ctx.closePath(); ctx.fill(); ctx.fillStyle = hsla(hue, 10, 92 * l); ctx.beginPath(); ctx.moveTo(bx - ww * 0.3, by - hh * 1.6 * 0.7); ctx.lineTo(bx, by - hh * 1.6); ctx.lineTo(bx + ww * 0.3, by - hh * 1.6 * 0.7); ctx.closePath(); ctx.fill(); }
    else if (kind === 'mesas') { ctx.fillStyle = hsla(18, 45, 40 * l); ctx.beginPath(); ctx.moveTo(bx - ww, by); ctx.lineTo(bx - ww * 0.7, by - hh); ctx.lineTo(bx + ww * 0.7, by - hh); ctx.lineTo(bx + ww, by); ctx.closePath(); ctx.fill(); }
    else if (kind === 'city') { ctx.fillStyle = hsla(hue, 15, (night ? 14 : 55) * (night ? 1 : day)); ctx.fillRect(bx - ww * 0.5, by - hh * 1.8, ww, hh * 1.8); ctx.fillStyle = night ? hsla(48, 90, 70, 0.9) : hsla(hue, 10, 75 * day, 0.6); for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if ((q.v * 97 + r * 3 + c) % 1.7 < 1) ctx.fillRect(bx - ww * 0.35 + c * ww * 0.3, by - hh * 1.7 + r * hh * 0.32, ww * 0.12, hh * 0.12); }
    else if (kind === 'sea') { if (q.v < 0.25) { ctx.fillStyle = hsla(0, 0, 96 * l); ctx.beginPath(); ctx.moveTo(bx, by - h * 0.035); ctx.lineTo(bx, by - h * 0.07); ctx.lineTo(bx + h * 0.014, by - h * 0.035); ctx.closePath(); ctx.fill(); } }
    else if (kind === 'flat') { if (q.v < 0.3) { ctx.strokeStyle = hsla(0, 0, 40 * l); ctx.lineWidth = h * 0.003; ctx.beginPath(); ctx.moveTo(bx - ww * 0.15, by); ctx.lineTo(bx, by - hh * 1.4); ctx.lineTo(bx + ww * 0.15, by); ctx.moveTo(bx - ww * 0.25, by - hh); ctx.lineTo(bx + ww * 0.25, by - hh); ctx.stroke(); } }
    else { ctx.fillStyle = hsla(hue - 60, 30, 36 * l); ctx.beginPath(); ctx.ellipse(bx, by, ww * 1.6, hh * 0.7, 0, Math.PI, TAU); ctx.fill(); }
  }
}

/** One thing at the roadside, drawn in world units around its foot at (px, py) with `u` pixels a unit. */
function sprite(s, ctx, h, o, px, py, u, night, day) {
  if (u < h * 0.004) return;
  const l = (x) => x * (night ? 0.5 : 1) * Math.min(1.1, day), v = o.v, H = o.h;
  const R = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(px + x * u, py - y * u, ww * u, -hh * u); };
  const P = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(px + x * u, py - y * u) : ctx.moveTo(px + x * u, py - y * u))); ctx.closePath(); ctx.fill(); };
  const C = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px + x * u, py - y * u, r * u, 0, TAU); ctx.fill(); };
  ctx.fillStyle = hsla(0, 0, 0, 0.25); ctx.beginPath(); ctx.ellipse(px, py, u * 0.5 * H, u * 0.08, 0, 0, TAU); ctx.fill();
  switch (o.kind) {
    case 'palm': { const top = [0.35 * (v - 0.5), 2.2 * H]; ctx.strokeStyle = hsla(30, 35, l(32)); ctx.lineWidth = u * 0.11; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + top[0] * 0.2 * u, py - top[1] * 0.6 * u, px + top[0] * u, py - top[1] * u); ctx.stroke(); ctx.strokeStyle = hsla(110, 45, l(34)); ctx.lineWidth = u * 0.12; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + v, cx = Math.cos(a) * 0.95, cy = Math.sin(a) * 0.35 - 0.4; ctx.beginPath(); ctx.moveTo(px + top[0] * u, py - top[1] * u); ctx.quadraticCurveTo(px + (top[0] + cx * 0.6) * u, py - (top[1] + 0.35) * u, px + (top[0] + cx) * u, py - (top[1] + cy) * u); ctx.stroke(); } break; }
    case 'tree': R(-0.08, 0, 0.16, 0.9 * H, hsla(28, 30, l(26))); C(0, 1.3 * H, 0.6 * H, hsla(105 + v * 30, 40, l(30))); C(-0.2 * H, 1.5 * H, 0.4 * H, hsla(105 + v * 30, 45, l(38))); break;
    case 'pine': R(-0.06, 0, 0.12, 0.5, hsla(28, 30, l(24))); for (let i = 0; i < 3; i++) { const y = 0.4 + i * 0.55 * H, ww = (0.9 - i * 0.22) * H; P([[-ww, y], [ww, y], [0, y + 0.8 * H]], hsla(140 + v * 20, 35, l(24 + i * 4))); } break;
    case 'bush': C(-0.3, 0.25, 0.32, hsla(100, 35, l(30))); C(0.3, 0.25, 0.3, hsla(100, 35, l(30))); C(0, 0.4, 0.36, hsla(100, 40, l(36))); break;
    case 'cactus': R(-0.12, 0, 0.24, 1.5 * H, hsla(100, 40, l(34))); R(-0.5, 0.5, 0.14, 0.55, hsla(100, 40, l(34))); R(-0.5, 0.95, 0.4, 0.14, hsla(100, 40, l(34))); R(0.36, 0.7, 0.14, 0.5, hsla(100, 40, l(34))); R(0.1, 1.1, 0.4, 0.14, hsla(100, 40, l(34))); break;
    case 'rock': P([[-0.5, 0], [-0.35, 0.4 * H], [0.05, 0.6 * H], [0.45, 0.35 * H], [0.55, 0]], hsla(30, 12, l(40))); P([[-0.35, 0.4 * H], [0.05, 0.6 * H], [0.1, 0.3 * H]], hsla(30, 12, l(52))); break;
    case 'cliff': P([[-1.3, 0], [-1.2, 3.2 * H], [0.9, 3.5 * H], [1.3, 0]], hsla(18, 50, l(42))); for (let i = 1; i < 4; i++) R(-1.2, i * 0.8 * H, 2.3, 0.06, hsla(18, 45, l(32))); break;
    case 'sign': R(-0.03, 0, 0.06, 1.1, hsla(0, 0, l(55))); R(-0.36, 1.1, 0.72, 0.46, hsla(50, 95, l(58))); ctx.strokeStyle = hsla(0, 0, 8); ctx.lineWidth = u * 0.08; ctx.beginPath(); ctx.moveTo(px + o.dir * 0.12 * u, py - 1.2 * u); ctx.lineTo(px - o.dir * 0.12 * u, py - 1.33 * u); ctx.lineTo(px + o.dir * 0.12 * u, py - 1.46 * u); ctx.stroke(); break;
    case 'billboard': R(-0.8, 0, 0.08, 1.2, hsla(0, 0, l(40))); R(0.72, 0, 0.08, 1.2, hsla(0, 0, l(40))); R(-1, 1.2, 2, 0.95, hsla(0, 0, l(95))); R(-1, 1.85, 2, 0.3, hsla(v * 360, 80, l(50))); ctx.fillStyle = hsla(v * 360 + 180, 70, l(30)); ctx.font = `bold ${u * 0.42}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(WORDS[o.word], px, py - 1.5 * u); break;
    case 'lamp': { const d = o.x < 0 ? 1 : -1; R(-0.03, 0, 0.06, 2.4, hsla(0, 0, l(60))); R(d < 0 ? -0.6 : 0, 2.34, 0.6, 0.05, hsla(0, 0, l(60))); C(d * 0.6, 2.3, 0.1, night ? hsla(48, 90, 80) : hsla(0, 0, l(75))); if (night) { ctx.fillStyle = hsla(48, 90, 70, 0.14); ctx.beginPath(); ctx.arc(px + d * 0.6 * u, py - 2.3 * u, 0.3 * u, 0, TAU); ctx.fill(); } break; }
    case 'building': { const bw = 1.2, bh = 2 + 2.2 * v; R(-bw / 2, 0, bw, bh, hsla(s.pal.hue, 15, night ? 16 : l(58))); ctx.fillStyle = night ? hsla(48, 90, 70, 0.9) : hsla(s.pal.hue, 15, l(40), 0.7); for (let r = 0; r < Math.floor(bh / 0.4); r++) for (let c = 0; c < 3; c++) if ((v * 91 + r * 5 + c * 3) % 2.2 < 1.4) ctx.fillRect(px + (-0.45 + c * 0.38) * u, py - (0.3 + r * 0.4) * u, 0.2 * u, -0.2 * u); break; }
    case 'house': R(-0.6, 0, 1.2, 0.8, hsla(v * 360, 35, l(70))); P([[-0.7, 0.8], [0, 1.35], [0.7, 0.8]], hsla(12, 50, l(38))); R(-0.12, 0, 0.24, 0.45, hsla(20, 40, l(25))); R(0.25, 0.35, 0.22, 0.22, hsla(200, 50, l(80))); break;
    case 'barn': R(-0.7, 0, 1.4, 0.9, hsla(8, 60, l(40))); P([[-0.8, 0.9], [0, 1.5], [0.8, 0.9]], hsla(0, 0, l(30))); R(-0.2, 0, 0.4, 0.55, hsla(0, 0, l(15))); break;
    case 'windmill': { P([[-0.3, 0], [-0.15, 2], [0.15, 2], [0.3, 0]], hsla(0, 0, l(85))); const a = s.t * s.cps * Math.PI; ctx.strokeStyle = hsla(0, 0, l(30)); ctx.lineWidth = u * 0.06; for (let i = 0; i < 4; i++) { const b = a + (i * TAU) / 4; ctx.beginPath(); ctx.moveTo(px, py - 2 * u); ctx.lineTo(px + Math.cos(b) * 0.9 * u, py - 2 * u - Math.sin(b) * 0.9 * u); ctx.stroke(); } break; }
    case 'lighthouse': P([[-0.3, 0], [-0.18, 2.6], [0.18, 2.6], [0.3, 0]], hsla(0, 0, l(92))); R(-0.26, 0.9, 0.52, 0.35, hsla(0, 80, l(48))); R(-0.22, 1.8, 0.44, 0.3, hsla(0, 80, l(48))); R(-0.22, 2.6, 0.44, 0.3, hsla(0, 0, l(20))); C(0, 2.75, 0.14, hsla(48, 100, 80)); break;
    case 'pylon': ctx.strokeStyle = hsla(0, 0, l(45)); ctx.lineWidth = u * 0.05; ctx.beginPath(); ctx.moveTo(px - 0.5 * u, py); ctx.lineTo(px - 0.12 * u, py - 3 * u); ctx.lineTo(px + 0.12 * u, py - 3 * u); ctx.lineTo(px + 0.5 * u, py); for (const y of [1, 1.9, 2.6]) { ctx.moveTo(px - 0.8 * u, py - y * u); ctx.lineTo(px + 0.8 * u, py - y * u); } ctx.stroke(); break;
    case 'arch': R(-1.4, 0, 0.12, 1.5, hsla(0, 0, l(85))); R(1.28, 0, 0.12, 1.5, hsla(0, 0, l(85))); R(-1.5, 1.2, 3, 0.55, hsla(0, 85, l(50))); ctx.fillStyle = hsla(0, 0, 98); ctx.font = `bold ${u * 0.36}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CHECK POINT', px, py - 1.48 * u); break;
    default: C(0, 0.3, 0.3, hsla(100, 35, l(30)));
  }
}

/** A car in the traffic, rear view, at (px, py) with `u` pixels a world unit. */
function car(ctx, px, py, u, c, night, near) {
  if (u < 1) return;
  const tall = c.kind === 'truck' ? 0.8 : c.kind === 'van' ? 0.62 : 0.4, wide = c.kind === 'car' ? 0.56 : 0.66, l = night ? 0.6 : 1;
  const R = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(px + x * u, py - y * u, ww * u, -hh * u); };
  ctx.fillStyle = hsla(0, 0, 0, 0.3); ctx.beginPath(); ctx.ellipse(px, py, wide * 0.6 * u, 0.06 * u, 0, 0, TAU); ctx.fill();
  R(-wide / 2 - 0.02, 0, 0.14, 0.16, hsla(0, 0, 8)); R(wide / 2 - 0.12, 0, 0.14, 0.16, hsla(0, 0, 8));
  R(-wide / 2, 0.06, wide, tall, hsla(c.hue, 55, 48 * l));
  if (c.kind === 'car') R(-wide / 2 + 0.08, tall * 0.75, wide - 0.16, 0.2, hsla(200, 30, 22 * l)); else R(-wide / 2 + 0.05, 0.06 + tall * 0.55, wide - 0.1, tall * 0.4, hsla(c.hue, 35, 36 * l));
  R(-wide / 2, 0.06, wide, 0.05, hsla(0, 0, 12));
  const on = c.lit > 0.3 || near || night;
  R(-wide / 2 + 0.03, 0.12, 0.12, 0.07, on ? hsla(0, 100, 55) : hsla(0, 60, 30)); R(wide / 2 - 0.15, 0.12, 0.12, 0.07, on ? hsla(0, 100, 55) : hsla(0, 60, 30));
  if (on && c.lit > 0.3) { ctx.fillStyle = hsla(0, 100, 60, 0.3 * c.lit); ctx.fillRect(px - wide / 2 * u, py - 0.25 * u, wide * u, 0.2 * u); }
}

/** The player's car at the bottom centre: the road moves, the car leans into the steering, bobs on a kick, and in a crash tumbles off to the side. */
function player(s, ctx, h, W, X, Y) {
  const cu = h * 0.16, drift = clamp(s.steer * 0.25, -1, 1), tilt = s.crash ? s.tumble : clamp(-s.steer * 0.05, -0.14, 0.14);
  const slide = s.crash ? s.crashDir * Math.min(1, s.tumble / 4) * 0.55 : 0, up = s.crash ? Math.abs(Math.sin(s.tumble)) * 0.12 + Math.min(1, s.tumble / 4) * 0.1 : 0;
  ctx.save(); ctx.translate(X(W / 2 + slide), Y(0.93 - up - s.kick * 0.006)); ctx.rotate(tilt); ctx.scale(cu, cu);
  const R = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };
  const P = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
  ctx.fillStyle = 'rgba(0 0 0 / .35)'; ctx.beginPath(); ctx.ellipse(0, 0.05, 1.45, 0.14, 0, 0, TAU); ctx.fill();
  for (const wx of [-1.05, 1.05]) { ctx.save(); ctx.translate(wx, 0); ctx.transform(1, 0, drift * 0.15, 1, 0, 0); R(-0.22, -0.6, 0.44, 0.65, hsla(0, 0, 8)); R(-0.22, -0.6 + s.wheel * 0.55, 0.44, 0.07, hsla(0, 0, 28)); ctx.restore(); } // the tread turns
  if (s.rev > 0.02) for (const ex of [-0.75, 0.75]) { ctx.fillStyle = hsla(0, 0, 70, 0.3 * s.rev); ctx.beginPath(); ctx.arc(ex, 0.08 + (1 - s.rev) * 0.2, 0.12 + (1 - s.rev) * 0.25, 0, TAU); ctx.fill(); }
  ctx.translate(drift * 0.08, 0);
  P([[-1.15, -0.05], [1.15, -0.05], [1.12, -0.55], [0.95, -0.82], [0.6, -0.95], [-0.6, -0.95], [-0.95, -0.82], [-1.12, -0.55]], hsla(0, 85, 48));
  R(-1.12, -0.5, 2.24, 0.45, hsla(0, 0, 10)); for (let i = 0; i < 4; i++) R(-1.05, -0.44 + i * 0.1, 2.1, 0.03, hsla(0, 60, 25));
  const brake = s.crash || s.bump > 0.3 ? 1 : 0.55; R(-1.05, -0.62, 0.55, 0.11, hsla(8, 100, 45 + 15 * brake)); R(0.5, -0.62, 0.55, 0.11, hsla(8, 100, 45 + 15 * brake));
  R(-0.35, -0.76, 0.7, 0.16, hsla(0, 0, 25)); ctx.fillStyle = hsla(0, 0, 85); ctx.font = 'bold 0.13px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OUT RUN', 0, -0.68);
  P([[-0.85, -0.95], [0.85, -0.95], [0.7, -1.3], [-0.7, -1.3]], hsla(0, 0, 18)); // the cockpit, open: a convertible
  for (const [hx, hair, blond] of [[-0.32, 25, 0], [0.32, 48, 1]]) { ctx.fillStyle = hsla(hair, blond ? 85 : 35, blond ? 70 : 22); ctx.beginPath(); ctx.arc(hx, -1.22, 0.17, 0, TAU); ctx.fill(); ctx.fillStyle = hsla(25, 45, 55); ctx.beginPath(); ctx.arc(hx, -1.16, 0.12, 0, Math.PI); ctx.fill(); if (blond) { ctx.strokeStyle = hsla(48, 85, 70); ctx.lineWidth = 0.045; const side = drift > 0 ? -1 : 1, len = 0.25 + Math.min(1, s.vel / 18) * 0.3; for (let i = 0; i < 4; i++) { const wave = Math.sin(s.t * 11 + i * 1.7) * 0.06; ctx.beginPath(); ctx.moveTo(hx + side * 0.12, -1.3 + i * 0.05); ctx.quadraticCurveTo(hx + side * (0.12 + len * 0.5), -1.32 + i * 0.05 + wave, hx + side * (0.12 + len), -1.2 + i * 0.07 + wave * 2); ctx.stroke(); } } } // the hair streams out behind, to the outside of the turn
  ctx.strokeStyle = hsla(200, 60, 85, 0.8); ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-0.72, -1.3); ctx.lineTo(-0.62, -1.48); ctx.lineTo(0.62, -1.48); ctx.lineTo(0.72, -1.3); ctx.stroke(); // the windscreen frame
  R(-1.32, -0.9, 0.16, 0.1, hsla(0, 85, 42)); R(1.16, -0.9, 0.16, 0.1, hsla(0, 85, 42)); // the mirrors
  ctx.restore();
}

/** The cabinet's HUD: score and hi-score, the time to the next checkpoint, the stage, the lap clock, the speed; the checkpoint call when it comes. */
function hud(s, ctx, w, h) {
  const px = Math.round(h * 0.045), txt = (str, x, y, size, col, align = 'left') => { ctx.font = `bold ${size}px ui-monospace, monospace`; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(0 0 0 / .8)'; ctx.fillText(str, x + size * 0.08, y + size * 0.08); ctx.fillStyle = col; ctx.fillText(str, x, y); };
  const yel = hsla(50, 100, 60), wht = hsla(0, 0, 97), m = h * 0.03;
  const pad = (n, d) => String(Math.floor(n)).padStart(d, '0');
  txt('SCORE', m, m, px * 0.75, yel); txt(pad(s.score, 8), m, m + px * 0.8, px, wht);
  txt('HI ' + pad(s.hi, 8), m, m + px * 2, px * 0.6, hsla(50, 80, 75));
  txt('TIME', w / 2, m, px * 0.75, yel, 'center'); const low = s.time < 10 && s.beat % 2; txt(pad(s.time, 2), w / 2, m + px * 0.8, px * 1.7, low ? hsla(0, 100, 60) : wht, 'center');
  txt('STAGE ' + s.stage, w - m, m, px * 0.75, yel, 'right');
  const lap = s.t % 3600, mm = Math.floor(lap / 60), ss = Math.floor(lap % 60), cc = Math.floor((lap % 1) * 100);
  txt('LAP ' + mm + "'" + pad(ss, 2) + '"' + pad(cc, 2), w - m, m + px * 0.8, px * 0.75, wht, 'right');
  const kmh = Math.min(320, Math.round(s.vel * 12));
  txt(kmh + ' km/h', m, h - m - px * 1.2, px * 1.1, wht); ctx.fillStyle = hsla(0, 85, 50); ctx.fillRect(m, h - m - px * 0.15, w * 0.22 * Math.min(1, kmh / 300), px * 0.15); ctx.fillStyle = hsla(0, 0, 100, 0.25); ctx.fillRect(m, h - m - px * 0.15, w * 0.22, px * 0.15);
  if (s.passed) txt('PASSED ' + s.passed, w - m, h - m - px, px * 0.75, yel, 'right');
  if (s.check > 0 && Math.floor(s.check * 4) % 2 === 0) txt(s.check > 1.5 ? 'CHECKPOINT' : 'EXTENDED TIME', w / 2, h * 0.3, px * 1.6, s.check > 1.5 ? wht : yel, 'center');
}
