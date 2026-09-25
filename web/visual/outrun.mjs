// outrun: an arcade cabinet in 1995, the OutRun kind of racer: a red convertible seen from behind on a road that
// bends, climbs and rushes at the player in painted bands, palms and billboards scaling up past the shoulders,
// three lanes of traffic to thread, a stage per section and a checkpoint gantry at every boundary. The music plays
// the game, and plays it like someone who never touches traffic. The road is three lanes and the car is a lane
// picker: the melody's motion picks the lane (a note above the last one a lane to the right, below it a lane to the
// left, so a rocking line rocks between lanes and a run walks across the road; two bars without a melody and the
// bass does it), the change lands on the kick (direction from the melody, moment from the drums, as the arcade's frame-stepped steering did), and a lane
// with a car ahead in it is refused for the nearest clear one; a car ahead in our own lane is left at once. Traffic
// arrives out of the fog at the far end, all at one speed under ours, never spawned where it would close the third
// lane, so a way through always exists and the road never slows for it. The bass bends the road (a low note a
// left-hander, a high one a right, harder with the gain), and within its lane the car drifts to the outside of
// every bend and sways with the counter. A kick is a gear kick (a burst of speed, the car bobs, the exhaust puffs);
// a snare or clap flashes the lights of the car ahead; the hats plant the roadside (a palm, a sign, a tree per hit, so a busy
// hi-hat lines the road and a sparse one leaves it open), every planted thing standing clear of the shoulder; the
// pad is the sky (its level the cloud, its cutoff the light). Energy is the speed and the traffic; the role sets the pace. A riser is
// the long climb at speed before a crest; the boundary is the CHECKPOINT, EXTENDED TIME, the next stage's scenery
// (a coconut beach to establish; the gateway city, the canyon, the alps, the wheat fields, the cloudy pass and the
// desert in turn to develop; the autobahn or the desert flats for a climax; the seaside town or the lakeside to
// release) and the counter set to the seconds to the next one, so it always runs down to the flag. The only crash
// is the dropout, the song's own silence: the car leaves the road, tumbles and stops, and the song coming back is
// a restart from the shoulder. Off the road is grass: the view shakes and the car slows. The HUD is the cabinet's (score, time, stage, km/h, the lap
// clock) under scanlines and a curved-glass vignette. The sun sits on the horizon and scrolls with it. The distance
// is the train world's: sky traffic crossing (a plane, a UFO whose beam pulses on the beat, a balloon, a blimp, a
// helicopter, a rocket, a dragon, a meteor) and bombs beyond the horizon, most fx impacts and now and then a bar on
// its own, a flash and a shudder and a mushroom cloud rising for a minute. Deterministic: randomness only from the state's own generator
// (kit.mjs); units are the canvas height, world units are the road's half width.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const HOR = 0.42, CAM_H = 1, CAM_D = 0.85, SEG = 0.22, N = 80, Z0 = 1.3, CURVE = 0.0025, LANES = [-0.66, 0, 0.66], MAX_CARS = 9;
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
const EDGE = 1.22; // where the shoulder ends (the rumble strip is 1.16 wide): nothing planted reaches inside it
const HALF = { palm: 1.1, tree: 0.9, pine: 1, bush: 0.7, cactus: 0.55, rock: 0.6, cliff: 1.35, sign: 0.4, billboard: 1.05, lamp: 0.7, building: 0.65, house: 0.75, barn: 0.85, windmill: 0.95, lighthouse: 0.35, pylon: 0.85 }; // each kind's half width at h = 1, the road side

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
  const k = kind ?? land.side[Math.floor(rand(s) * land.side.length)], h = 0.8 + rand(s) * 0.5;
  const out = k === 'lamp' || k === 'sign' || k === 'cliff' ? 0 : k === 'building' ? 0.3 : rand(s) * 1.2; // how far beyond the shoulder, past its own half width
  const x = k === 'arch' ? 0 : side * (EDGE + (HALF[k] ?? 0.6) * h + out);
  seg.sprites.push({ kind: k, x, h, v: rand(s), word: Math.floor(rand(s) * WORDS.length), dir: s.curveTo < 0 ? -1 : 1 });
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
const TRAFFIC = 0.45; // every car's share of the nominal speed: one speed, so the traffic never bunches and the spawn's promise holds forever
const CLEAR = 16; // world units: within this of any car, the middle lane never shares the road with an edge lane (cars come alone, or two abreast at the edges), so from an edge the middle is always the way out and from the middle both edges are
/** True when `lane` holds a car within `from`..`to` of our position (the window we could not clear in time). */
const blocked = (s, lane, from, to) => s.cars.some((c) => c.lane === lane && c.z - s.pos > from && c.z - s.pos < to);
/** A car into the traffic at the far end of the road, out of the fog, so nothing ever pops in; refused in a lane that would break CLEAR's promise. */
const spawnCar = (s, at = s.pos + N * SEG * 0.98) => {
  if (s.cars.length >= MAX_CARS) return;
  const r0 = rand(s), lane = r0 < 0.45 ? 1 : r0 < 0.725 ? 0 : 2, taken = new Set(s.cars.filter((c) => Math.abs(c.z - at) < CLEAR).map((c) => c.lane)); // the middle first: it keeps the edges open for the melody's picks
  taken.delete(lane); if (taken.size && (lane === 1 || taken.has(1))) return;
  const r = rand(s);
  s.cars.push({ z: at, lane, x: LANES[lane], hue: Math.floor(rand(s) * 360), kind: r < 0.18 ? 'truck' : r < 0.32 ? 'van' : 'car', lit: 0, passed: 0 });
};
/** The nearest car ahead of us. */
const ahead = (s, from = 0) => s.cars.filter((c) => c.z > s.pos + from).sort((a, b) => a.z - b.z)[0];
/** The lane to be in: `want` when it is clear (and, two lanes over, the middle too), else the other edge when an edge was wanted, else the middle, else where we are. `reach` is how far ahead a car counts. */
const pickLane = (s, want, reach) => {
  const clear = (l) => !blocked(s, l, -0.5, reach);
  const order = want === 1 ? [1, s.lane === 1 ? 0 : s.lane, s.lane === 1 ? 2 : 2 - s.lane] : [want, 2 - want, 1];
  for (const l of order) if (clear(l) && (Math.abs(l - s.lane) < 2 || clear(1))) return l;
  return s.lane;
};
const secsOf = (s, i) => s.secs[i] ?? 60;
const SKY_KINDS = ['plane', 'ufo', 'balloon', 'blimp', 'helicopter', 'rocket', 'dragon', 'meteor'];
/** A bomb beyond the horizon: a flash and a shudder now, a mushroom cloud rising for a minute, fire turning to dust. */
const nuke = (s) => { s.nukes.push({ x: 0.15 + rand(s) * (s.W - 0.3), age: 0, h: 0.8 + rand(s) * 0.5 }); s.flash = Math.max(s.flash, 1.2); s.bump = 1; };
/** The lane the line wants after `note`: one to the right when it rose from the last note, one to the left when it fell, unchanged on a repeat (the first note only sets the reference). */
const stepLane = (s, note, prev) => { if (s[prev] !== null) s.want = clamp(s.want + Math.sign(note - s[prev]), 0, 2); s[prev] = note; };

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
      x: 0, lane: 1, want: 1, melPrev: null, bassPrev: null, melAge: 1e6, sway: 0, steer: 0, sinceKick: 0, curve: 0, curveTo: 0, slope: 0, slopeTo: 0, bassHold: 0,
      seg0: 0, segs: [], sideNext: 0.5, bgX: 0, fliers: [], skyNext: 4, nukes: [], blink: 0, bar: -1, cars: [], carNext: 3, passed: 0, score: 0, hi: 1e6 + Math.floor(rng() * 9e6), time: 0, stage: 1, check: 0, flash: 0, lit: 0,
      crash: 0, crashDir: 1, tumble: 0, bump: 0, kick: 0, rev: 0, shake: 0, wheel: 0,
      bg: { peaks: shapes(), mesas: shapes(), city: shapes(), hills: shapes(), sea: shapes(), flat: shapes() },
      clouds: Array.from({ length: 6 }, () => ({ x: rng() * 3, y: 0.04 + rng() * 0.22, w: 0.1 + rng() * 0.2, a: 0.4 + rng() * 0.5 })),
      stars: Array.from({ length: 60 }, () => ({ x: rng() * 3, y: rng() * HOR * 0.9, w: 0.3 + rng() * 0.7 })),
    };
    seed(s, rng);
    s.time = secsOf(s, 0) + 4;
    segAt(s, N + 2);
    for (let i = 0; i < 3; i++) spawnCar(s, 6 + i * 6); // the road is not empty on the first frame
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = SCENE[role] ?? SCENE.none, land = LAND[s.landTo] ?? LAND.beach;
    s.energy = ease(s.energy, clock.energy, 2, dt); s.speed = ease(s.speed, want.speed, 1.5, dt); s.traffic = ease(s.traffic, want.traffic, 1.5, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.wasRiser = s.riser > 0 ? s.riser : decay(s.wasRiser, 2, dt);
    s.beat = clock.beat; s.beatPhase = clock.beatPhase; s.blink = clock.beat % 2;
    let base = Math.floor(s.pos / SEG);
    const bar = clock.index >= 0 ? clock.index * 1e4 + clock.bar : Math.floor(clock.cycle);
    if (bar !== s.bar) { s.bar = bar; if (rand(s) < 0.03) nuke(s); } // now and then a bar sets off a bomb beyond the horizon
    if (clock.boundary) { // the checkpoint: the gantry just ahead, the time extended by the stage's length, the next scenery
      s.check = 3; s.stage = clock.index + 1; s.time = secsOf(s, clock.index) + 4; s.flash = Math.max(s.flash, 0.35); s.landTo = s.lands[clock.index] ?? s.landTo;
      plant(s, segAt(s, base + 3), land, 1, 'arch');
      if (s.wasRiser > 0.3) s.slopeTo = -0.05; // over the crest
    }
    if (clock.dropout && !s.crash) { s.crash = 1; s.tumble = 0; s.crashDir = s.x < 0 ? -1 : 1; s.bump = 1; }
    if (!clock.dropout && s.crash) { s.crash = 0; s.x = 0; s.lane = s.want = 1; s.vel = 0; s.tumble = 0; s.flash = Math.max(s.flash, 0.4); }
    s.time = Math.max(0, s.time - dt); if (s.time <= 0 && clock.index < 0) { s.time = 60; s.check = 3; } // a plain pattern: the clock alone extends it
    // the speed: world units a second, by the scene and the energy, faster into a riser, none in a crash, half on the grass
    const off = Math.abs(s.x) > 1.05 ? 1 : 0;
    const vTo = s.crash ? 0 : (7 + 11 * s.energy) * s.speed * (1 + 0.5 * s.riser) * (off ? 0.5 : 1);
    s.vel = ease(s.vel, vTo, s.crash ? 4 : 0.8, dt);
    // the events, each by its part's job in the cast
    const reach = Math.min(CLEAR - 2, 6 + 0.35 * s.vel); // how far ahead a car in a lane counts as in the way: a lane change takes a quarter second; under CLEAR so the promise holds
    let change = false;
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'transition') { if (e.dur >= 1) { s.flash = Math.max(s.flash, 0.7); s.bump = 1; plant(s, segAt(s, base + N - 2), land, rand(s) < 0.5 ? -1 : 1, 'billboard'); if (rand(s) < 0.8) nuke(s); } } // the impact (a whole cycle long): a billboard, and most times a bomb in the distance; a riser's slices are the clock's business
      else if (e.role === 'pulse') { s.kick = 1; s.rev = 1; change = true; if (!s.crash) s.vel += 0.8 * g; } // a kick, whatever slot its part took: a gear kick, and the moment a lane change lands
      else if (e.role === 'impact') { const c = ahead(s, 1); if (c) c.lit = 1; s.lit = 1; } // the car ahead flashes its lights
      else if (slot === 'impulse') s.kick = Math.max(s.kick, 0.5 * g);
      else if (slot === 'ground') { if (e.note !== null) { s.curveTo = (clamp((e.note - 36) / 24) - 0.5) * 2 * CURVE * land.curve * clamp(g, 0.5, 1.2); s.bassHold = 1; if (s.melAge > 2 / Math.max(0.05, s.cps)) stepLane(s, e.note, 'bassPrev'); } } // no melody for two bars: the bass picks the lane
      else if (slot === 'line') { if (e.note !== null) { stepLane(s, e.note, 'melPrev'); s.melAge = 0; } } // the melody's motion picks the lane: up a lane right, down a lane left
      else if (slot === 'counter') { if (e.note !== null) s.sway = (clamp((e.note - 48) / 24) - 0.5) * 0.1; } // the counter leans the car within its lane
      else if (slot === 'field') { s.cloudTo = clamp(0.3 + 0.6 * g); if (e.cutoff !== null) s.light = clamp(Math.log(e.cutoff / 200) / Math.log(40)); }
      else if (e.role === 'grain' || slot === 'grain') { if (rand(s) < 0.4 * g) plant(s, segAt(s, base + N - 2), land, rand(s) < 0.5 ? -1 : 1); }
    }
    // the lane: the melody's pick lands on the kick (or after a beat and a half with no kick), refused when that lane is taken ahead; a car ahead in our own lane is left at once, for the nearest clear lane
    s.sinceKick = change ? 0 : s.sinceKick + dt; s.melAge += dt;
    if (!s.crash) {
      if (blocked(s, s.lane, -0.5, reach)) s.lane = pickLane(s, s.want, reach);
      else if ((change || s.sinceKick > 1.5 / Math.max(0.2, s.cps * 4)) && s.want !== s.lane) { s.lane = pickLane(s, s.want, reach); s.sinceKick = 0; }
    }
    s.pos += s.vel * dt; base = Math.floor(s.pos / SEG);
    segAt(s, base + N + 1);
    if (base > s.seg0) { s.segs.splice(0, base - s.seg0); s.seg0 = base; }
    if (s.riser > 0) s.slopeTo = 0.07 * s.riser; // the long climb
    const here = segAt(s, base).curve;
    // the car crosses to its lane in a quarter second and leans into it; within the lane the bend drifts it outward and the counter sways it
    s.sway = decay(s.sway, 1.5, dt);
    const px = s.x, xTo = s.crash ? s.crashDir * 1.7 : LANES[s.lane] + s.sway + clamp(-here * s.vel * 60, -0.08, 0.08); // the lean stays inside the lane: the next lane's car is 0.66 away and half a car wide
    s.x = clamp(ease(s.x, xTo, s.crash ? 1.5 : 8, dt), -1.9, 1.9);
    s.steer = ease(s.steer, (s.x - px) / dt, 8, dt);
    s.wheel = (s.wheel + s.vel * dt * 3) % 1;
    const bg = -here * s.vel * 14 * dt; s.bgX += bg;
    for (const c of s.clouds) c.x = ((c.x - dt * 0.01 - here * s.vel * 5 * dt) % 3 + 3) % 3;
    // the sky's traffic, by time: a thing every so often crossing the horizon at its own pace, carried a little with the bend; the bombs age out over a minute
    s.skyNext -= dt;
    if (s.skyNext <= 0) { const kind = SKY_KINDS[Math.floor(rand(s) * SKY_KINDS.length)]; if (s.fliers.length < 6) s.fliers.push({ kind, x: kind === 'meteor' ? s.W * 0.7 + rand(s) * 0.5 : s.W + 0.3, y: 0.06 + rand(s) * 0.22, h: 0.6 + rand(s) * 0.5, v: rand(s), k: kind === 'plane' ? 0.35 : kind === 'meteor' ? 1.4 : kind === 'rocket' ? -0.1 : 0.06 + rand(s) * 0.1, vy: kind === 'rocket' ? -0.12 : kind === 'meteor' ? 0.5 : 0 }); s.skyNext = 6 + rand(s) * 10; }
    for (const o of s.fliers) { o.x -= o.k * dt - bg * 0.3; o.y += o.vy * dt; }
    s.fliers = s.fliers.filter((o) => o.x > -0.4 && o.x < s.W + 0.6 && o.y > -0.2 && o.y < HOR);
    for (const n of s.nukes) { n.age += dt; n.x += bg * 0.5; } s.nukes = s.nukes.filter((n) => n.age < 80);
    s.kick = decay(s.kick, 6, dt); s.rev = decay(s.rev, 5, dt); s.bump = decay(s.bump, 5, dt); s.flash = decay(s.flash, 5, dt); s.lit = decay(s.lit, 4, dt); s.bassHold = decay(s.bassHold, 0.4, dt);
    s.check = Math.max(0, s.check - dt);
    s.shake = ease(s.shake, off || s.crash ? 1 : 0, 6, dt);
    if (s.crash) s.tumble += dt * 7;
    const gt = land.ground; for (let i = 0; i < 3; i++) s.ground[i] = ease(s.ground[i], gt[i], 0.6, dt);
    s.cloud = ease(s.cloud, s.cloudTo, 0.5, dt); s.cloudTo = ease(s.cloudTo, 0.35, 0.05, dt);
    // the traffic, by distance: a car every so often out of the fog, all at one speed under ours, passed when it falls behind
    s.carNext -= s.vel * dt;
    if (s.carNext <= 0) { spawnCar(s); s.carNext = (7 + rand(s) * 9) / Math.max(0.2, s.traffic); }
    const cv = (7 + 11 * s.energy) * TRAFFIC * dt;
    for (const c of s.cars) {
      c.z += cv; c.lit = decay(c.lit, 4, dt);
      if (!c.passed && c.z < s.pos) { c.passed = 1; s.passed++; s.score += 1000; }
    }
    s.cars = s.cars.filter((c) => c.z > s.pos - 0.3 && c.z < s.pos + N * SEG + 2);
    s.score += s.vel * dt * 12;
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
    const sunX = ((0.9 + s.bgX) % 3 + 3) % 3; // the sun sits on the horizon and scrolls with it, part of the distance, never a spot hung before the car
    if (sunX < W + 0.15) { ctx.beginPath(); ctx.arc(X(sunX), Y(HOR - 0.01), h * (night ? 0.05 : 0.1), 0, TAU); ctx.fillStyle = hsla(sky.sun[0], sky.sun[1], sky.sun[2], 0.95); ctx.fill(); if (!night) { ctx.fillStyle = hsla(sky.low[0], sky.low[1], sky.low[2] * day, 0.35); for (let i = 0; i < 4; i++) ctx.fillRect(X(sunX - 0.11), Y(HOR - 0.07 + i * 0.018), h * 0.22, h * (0.004 + i * 0.002)); } } // the arcade sun's bands
    for (const o of s.fliers) skyThing(s, ctx, h, o, X, Y, night);
    for (const n of s.nukes) bomb(ctx, h, n, X, hor, night);
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

/** A bomb beyond the horizon, from the train world: the fireball on the line in the first seconds, then the column and the cap growing with age, fire to dust, thinning out at the end. */
function bomb(ctx, h, n, X, hor, night) {
  const g = 1 - Math.exp(-n.age / 12), fire = Math.exp(-n.age / 6), a = clamp((80 - n.age) / 25) * (night ? 0.8 : 1), cx = X(n.x), base = hor + 2, capH = h * 0.5 * g * n.h, stemW = h * 0.06 * (0.4 + 0.6 * g) * n.h, capW = h * 0.26 * g * n.h, capY = base - capH;
  const hue = lerp(20, 30, 1 - fire), sat = lerp(12, 90, fire), light = lerp(38, 62, fire);
  const grad = ctx.createLinearGradient(0, capY, 0, base); grad.addColorStop(0, hsla(hue, sat, light, a)); grad.addColorStop(1, hsla(hue, sat * 0.6, light * 0.6, a));
  ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(cx - stemW, base); ctx.quadraticCurveTo(cx - stemW * 0.6, capY + capH * 0.5, cx - stemW * 1.2, capY + capH * 0.3); ctx.lineTo(cx + stemW * 1.2, capY + capH * 0.3); ctx.quadraticCurveTo(cx + stemW * 0.6, capY + capH * 0.5, cx + stemW, base); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hsla(hue, sat, light, a); ctx.beginPath(); ctx.ellipse(cx, capY + capH * 0.22, capW, capH * 0.26, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = hsla(hue, sat, light + 12, a * 0.8); ctx.beginPath(); ctx.ellipse(cx - capW * 0.3, capY + capH * 0.12, capW * 0.5, capH * 0.18, 0, 0, TAU); ctx.ellipse(cx + capW * 0.35, capY + capH * 0.2, capW * 0.45, capH * 0.16, 0, 0, TAU); ctx.fill();
  if (fire > 0.05) { ctx.fillStyle = hsla(45, 100, 90, fire * a); ctx.beginPath(); ctx.ellipse(cx, capY + capH * 0.25, capW * 0.5, capH * 0.15, 0, 0, TAU); ctx.fill(); }
  if (fire > 0.02) { const r = h * 0.26 * n.h * (1 - Math.exp(-n.age / 1.2)); const fb = ctx.createRadialGradient(cx, base, 0, cx, base, r * 2); fb.addColorStop(0, hsla(50, 100, 98, fire * a)); fb.addColorStop(0.3, hsla(45, 100, 85, fire * a)); fb.addColorStop(0.5, hsla(30, 100, 62, 0.8 * fire * a)); fb.addColorStop(1, hsla(20, 100, 55, 0)); ctx.fillStyle = fb; ctx.beginPath(); ctx.ellipse(cx, base, r * 2, r * 1.4, 0, Math.PI, TAU); ctx.fill(); }
}

/** The sky's traffic, from the train world: everything flies left, a plane, a UFO whose beam pulses on the beat, a balloon, a blimp, a helicopter, a rocket climbing, a dragon, a meteor falling. */
function skyThing(s, ctx, h, o, X, Y, night) {
  const x = X(o.x), y = Y(o.y), S = h * 0.05 * o.h, F = (c) => { ctx.fillStyle = c; }, R = (dx, dy, w, hh) => ctx.fillRect(x + dx * S, y - dy * S, w * S, hh * S);
  const C = (dx, dy, r) => { ctx.beginPath(); ctx.arc(x + dx * S, y - dy * S, r * S, 0, TAU); ctx.fill(); }, E = (dx, dy, rx, ry) => { ctx.beginPath(); ctx.ellipse(x + dx * S, y - dy * S, rx * S, ry * S, 0, 0, TAU); ctx.fill(); };
  const T = (pts) => { ctx.beginPath(); pts.forEach(([dx, dy], i) => (i ? ctx.lineTo(x + dx * S, y - dy * S) : ctx.moveTo(x + dx * S, y - dy * S))); ctx.closePath(); ctx.fill(); }, flap = Math.sin(s.t * 6 + o.v * 9), dark = hsla(0, 0, night ? 30 : 15);
  const mirror = ['dragon', 'helicopter', 'blimp'].includes(o.kind);
  if (mirror) { ctx.save(); ctx.translate(2 * x, 0); ctx.scale(-1, 1); }
  switch (o.kind) {
    case 'plane': F(hsla(0, 0, night ? 40 : 92)); E(0, 0, 1.2, 0.3); T([[0.4, 0], [-0.4, 0], [-0.9, -0.9]]); T([[1.2, 0], [0.7, 0], [1.1, 0.7]]); break;
    case 'ufo': { const on = 1 - 0.7 * s.beatPhase; F(hsla(120, 80, 60, 0.18 * on)); T([[-0.6, -0.3], [0.6, -0.3], [2.2, -(HOR - o.y) * 20], [-2.2, -(HOR - o.y) * 20]]); F(hsla(0, 0, night ? 45 : 70)); E(0, 0, 1.4, 0.4); F(hsla(180, 60, 80, 0.8)); E(0, 0.35, 0.6, 0.45); for (let i = -1; i <= 1; i++) { F(hsla((s.blink + i + 3) % 2 ? 0 : 60, 90, 60)); C(i * 0.8, -0.1, 0.12); } break; }
    case 'balloon': F(hsla(o.v * 360, 75, 55)); E(0, 1.2, 1, 1.2); F(hsla(o.v * 360 + 180, 75, 65)); T([[-0.3, 2.3], [0.3, 2.3], [0.15, 0.1], [-0.15, 0.1]]); ctx.strokeStyle = dark; ctx.lineWidth = S * 0.05; ctx.beginPath(); ctx.moveTo(x - 0.5 * S, y - 0.4 * S); ctx.lineTo(x - 0.3 * S, y + 0.6 * S); ctx.moveTo(x + 0.5 * S, y - 0.4 * S); ctx.lineTo(x + 0.3 * S, y + 0.6 * S); ctx.stroke(); F(hsla(30, 50, 40)); R(-0.35, -0.6, 0.7, 0.45); break;
    case 'blimp': F(hsla(0, 0, night ? 45 : 85)); E(0, 0, 2.2, 0.7); T([[-2, 0.2], [-2.8, 0.7], [-2.6, 0]]); T([[-2, -0.2], [-2.8, -0.7], [-2.6, 0]]); F(dark); R(-0.4, -0.7, 0.8, 0.3); break;
    case 'helicopter': F(hsla(0, 70, 50)); E(0, 0, 1, 0.55); R(-2.4, 0.2, 2, 0.25); T([[-2.5, 0.1], [-2.5, 0.9], [-2, 0.3]]); F(hsla(200, 40, 80, 0.8)); E(0.4, 0.05, 0.4, 0.3); F(dark); R(-0.5, -0.8, 1, 0.1); { const sp = Math.abs(Math.cos(s.t * 25)); R(-2 * sp, 0.85, 4 * sp, 0.1); } break;
    case 'rocket': F(hsla(0, 0, 90)); R(-0.3, 1.8, 0.6, 1.8); T([[-0.3, 1.8], [0, 2.6], [0.3, 1.8]]); F(hsla(0, 80, 55)); T([[-0.3, 0], [-0.7, -0.5], [-0.3, 0.7]]); T([[0.3, 0], [0.7, -0.5], [0.3, 0.7]]); F(hsla(30, 100, 60, 0.9)); T([[-0.25, 0], [0, -1.2 - 0.4 * Math.abs(flap)], [0.25, 0]]); F(hsla(55, 100, 80)); T([[-0.12, 0], [0, -0.6], [0.12, 0]]); break;
    case 'dragon': F(hsla(120, 50, 35)); E(0, 0, 1.4, 0.4); E(1.5, 0.4, 0.5, 0.3); T([[-1.2, 0], [-2.6, 0.5 * flap], [-1.3, -0.2]]); T([[-0.6, 0.2], [0.2, 0.2], [-0.4, 1.6 * flap]]); F(hsla(50, 90, 60)); C(1.75, 0.5, 0.08); break;
    case 'meteor': F(hsla(30, 100, 80, 0.9)); T([[0, 0], [3, 1.8], [0.4, 0.4], [-0.4, 0]]); F(hsla(50, 100, 95)); C(0, 0, 0.35); break;
    default: break;
  }
  if (mirror) ctx.restore();
}

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
  const tall = c.kind === 'truck' ? 0.8 : c.kind === 'van' ? 0.62 : 0.4, wide = c.kind === 'car' ? 0.48 : 0.56, l = night ? 0.6 : 1;
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
