// train: the view out a train window. The land scrolls past in layers, a far ridge slowest and the trackside fastest,
// at a speed the tempo sets and the energy scales. Each section is a landscape chosen by its role and the seed
// (establish: fields; develop: forest, mountains, desert and fields in turn; climax: the desert or the mountains;
// release: the sea, or the track carried over a long bridge with water below), and a change of landscape is what a
// new section looks like:
// new scenery comes in from the right while the old scrolls off. The events are what passes: a kick throws a
// telegraph pole past the glass and jolts the carriage, an impact is a sign or a level crossing with its lights
// blinking on the beat, hats are birds lifting off the fields, each line part is a bird that flies at its pitch's
// height (the melody high, the counter low), the bass is the hills (a low note lifts the ridge), the pad is the
// weather (its level the cloud, its cutoff the light in the sky). A riser is a cutting closing in and the light going;
// the boundary it runs into enters a tunnel, two bars of dark with lamps strobing past on the beat, and the daylight
// comes back in a flash; a dropout is a tunnel too; a plain boundary passes under a bridge; an fx impact flashes.
// The wind drifts on its own and rises into a riser: trees lean and sway, birds and clouds are carried, streaks
// cross the sky in a gale. The sun (or moon) casts every shadow away from itself. Some bars the track is rough and
// the whole view shakes until it smooths out. Sky by the palette: cool is day, warm is sunset, dim is night with
// stars, pale is overcast. And whimsy, katamari-style: every landscape now and then hands a spawn to the WHIMSY pool
// (robots, cars and a police car blinking on the beat, tourists, spacemen, aliens, dinosaurs, a campsite,
// windmills and a ferris wheel turning at the tempo, a lighthouse sweeping, whales and pirates at sea, pyramids and
// camels in the desert, snowmen and yeti in the mountains, and more), the sky has traffic (planes, UFOs with a beam
// pulsing on the beat, balloons, blimps, helicopters, rockets, dragons, meteors), and the
// weather turns at a boundary: rain leaning with the wind, a storm with lightning on the kicks, and snow. Most fx impacts, and now and then a bar on its own, set off a nuke in the distance: a white
// flash, a shudder, and a mushroom cloud rising beyond the far ridge for a minute, fire turning to dust. Deterministic:
// randomness only from the state's own generator (kit.mjs); units are the canvas height.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const HORIZON = 0.56, MID_Y = 0.63, NEAR_Y = 0.88; // where each layer stands, in heights
const FAR = 0.08, HILL = 0.16, MID = 0.36, NEAR = 1, BED = 1.25; // each layer's share of the train's speed (parallax)
const MAX_OBJ = 160, MAX_BIRD = 40, MAX_CLOUD = 24;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
const SCENE = { establish: { speed: 0.7, busy: 0.6 }, develop: { speed: 1, busy: 1 }, climax: { speed: 1.35, busy: 1.4 }, release: { speed: 0.8, busy: 0.7 }, none: { speed: 1, busy: 1 } };
// a landscape: the ridge and hill heights, what the ground is, what stands in the middle distance and at the trackside, and how far apart (screen widths at that layer)
const LAND = {
  fields: { far: 0.05, hill: 0.06, ground: 'grass', mid: ['tree', 'tree', 'barn', 'house', 'hedge', 'hedge', 'cows', 'cows', 'sheep', 'horse', 'tractor'], midGap: [0.4, 1.2], near: ['tree', 'fence', 'fence', 'tree', 'cow'], nearGap: [0.6, 1.4] },
  forest: { far: 0.1, hill: 0.11, ground: 'grass', mid: ['pine', 'pine', 'tree', 'pine', 'deer'], midGap: [0.07, 0.25], near: ['pine', 'tree', 'pine'], nearGap: [0.25, 0.6] },
  mountains: { far: 0.3, hill: 0.17, ground: 'rock', mid: ['pine', 'rock', 'pine'], midGap: [0.3, 0.9], near: ['pine', 'rock'], nearGap: [0.5, 1.3] },
  desert: { far: 0.12, hill: 0.02, ground: 'sand', mesa: true, mid: ['cactus', 'rock', 'cactus', 'rock', 'cactus', 'rock'], midGap: [0.3, 1], near: ['cactus', 'fence', 'rock', 'cactus', 'rock', 'fence', 'billboard'], nearGap: [0.5, 1.3] },
  ocean: { far: 0.02, hill: 0, ground: 'water', mid: ['boat', 'island', 'boat'], midGap: [1, 3], near: ['fence', 'fence'], nearGap: [0.8, 1.8] },
  bridge: { far: 0.14, hill: 0.05, ground: 'void', mid: ['island', 'boat'], midGap: [1.5, 3], near: ['truss'], nearGap: [0.28, 0.28] },
};
const GROUND = { grass: [95, 30, 30], rock: [30, 14, 34], sand: [36, 45, 58], water: [205, 42, 34], void: [210, 30, 22] };
const SKY = { cool: { top: [212, 55, 55], low: [200, 45, 80], sun: [48, 90, 92], stars: 0 }, warm: { top: [255, 55, 34], low: [28, 85, 62], sun: [22, 95, 62], stars: 0 }, dim: { top: [250, 40, 8], low: [265, 35, 22], sun: [50, 20, 88], stars: 1 }, pale: { top: [200, 12, 62], low: [195, 10, 78], sun: [50, 10, 90], stars: 0 } };

/** The landscape of each section: by role, the develop ones in a seeded rotation, release alternating sea and bridge. */
const landsOf = (roles, rng) => {
  const dev = ['forest', 'mountains', 'desert', 'fields'], off = Math.floor(rng() * dev.length), top = rng() < 0.5 ? 'desert' : 'mountains';
  let d = 0, r = Math.floor(rng() * 2);
  return roles.map((role) => (role === 'establish' ? (rng() < 0.3 ? 'ocean' : 'fields') : role === 'climax' ? top : role === 'release' ? ['ocean', 'bridge'][r++ % 2] : dev[(off + d++) % dev.length]));
};
// the whimsy pool: what any landscape may hand a spawn to (a share of them), by where it fits, and what flies
const WHIMSY = {
  any: ['robot', 'car', 'bus', 'police', 'tourist', 'spaceman', 'alien', 'dino', 'trex', 'tent', 'windmill', 'watertower', 'scarecrow', 'snail', 'gnome', 'mushrooms', 'phonebox', 'mailbox', 'donut', 'ferris', 'castle', 'bigfoot', 'stonehenge', 'moai'],
  ocean: ['lighthouse', 'whale', 'shark', 'pirate', 'periscope', 'duck', 'penguin'],
  bridge: ['whale', 'shark', 'pirate', 'periscope', 'duck'],
  desert: ['pyramid', 'sphinx', 'camel', 'camel'],
  mountains: ['snowman', 'yeti', 'cabin', 'snowman'],
  sky: ['plane', 'ufo', 'balloon', 'blimp', 'helicopter', 'rocket', 'dragon', 'meteor'],
};
const WHIMSY_ODDS = { mid: 0.2, near: 0.12 };
const MOVERS = { car: -0.45, bus: -0.4, police: -0.55, camel: -0.02, dino: -0.03, trex: -0.06, whale: 0.05, shark: -0.1, pirate: -0.05, periscope: -0.08, bigfoot: -0.04, yeti: -0.04 }; // a share of the train's speed a thing adds of its own (negative: it keeps up with us a while)
const ridge = (n, dx) => Array.from({ length: n }, (_, i) => ({ x: (i - 1) * dx, y: 0 }));
const spawn = (s, kind, layer, x) => { if (s.objs.length < MAX_OBJ) s.objs.push({ kind, layer, x, h: kind === 'pole' ? 0.95 + rand(s) * 0.2 : 0.6 + rand(s) * 0.8, v: rand(s), lit: 0, k: MOVERS[kind] ?? 0 }); };
/** The landscape's own pick, or one from the whimsy pool: the pool for this landscape and the common one. */
const pickOf = (s, land, name, list) => { const pool = [...WHIMSY.any, ...(WHIMSY[name] ?? [])]; return rand(s) < WHIMSY_ODDS[list] ? pool[Math.floor(rand(s) * pool.length)] : land[list][Math.floor(rand(s) * land[list].length)]; };

export default {
  name: 'train',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const roles = score.sections.map((x) => x.role ?? 'none');
    const s = {
      pal, size: { ...size }, W: size.w / size.h, cps: score.cps, sky: SKY[p.temperature] ? p.temperature : 'cool', lum: p.luminance,
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      roles, lands: landsOf(roles, rng), land: 'fields',
      sunDir: rng() < 0.5 ? 1 : -1, day: 0, sunUp: 0, sunX: 0.1, sunY: 0.36, total: score.total ?? 0, stars: Array.from({ length: 70 }, () => ({ x: rng() * 3, y: rng() * HORIZON * 0.9, w: 0.3 + rng() * 0.7 })),
      t: 0, dist: 0, energy: 0.5, speed: 1, busy: 1, riser: 0, wasRiser: 0, dark: 0, tunnel: 0, inTunnel: 0, flash: 0, jolt: 0, vy: 0, sway: rng() * TAU, beatPhase: 0, section: null, lit: 0,
      far: ridge(26, 0.25), hill: ridge(14, 0.42), farAmp: 0.05, farTo: 0.05, hillAmp: 0.06, hillTo: 0.06, hillBass: 1,
      ground: [...GROUND.grass], groundTo: 'grass', groundMix: 1, bedOff: 0, waveOff: 0,
      objs: [], birds: [], clouds: [], lamps: [], midNext: 0.3, nearNext: 0.5, cloudNext: 0.5, lampNext: 0, poleAt: -1, cloud: 0.4, cloudTo: 0.4, light: 0.6,
      blink: 0, wind: 0, windTo: 0.2, rough: 0, roughLeft: 0, bar: -1, mesa: 0, skyNext: 6, weather: 'clear', rain: 0, snow: 0, storm: 0, bolt: 0, boltPts: [], landName: 'fields', nukes: [],
    };
    seed(s, rng);
    const first = LAND[s.lands[0]] ?? LAND.fields; s.farAmp = s.farTo = first.far; s.hillAmp = s.hillTo = first.hill; s.mesa = first.mesa ? 1 : 0; s.ground = [...GROUND[first.ground]]; s.groundTo = first.ground;
    for (const [pts, amp, far] of [[s.far, s.farAmp, true], [s.hill, s.hillAmp, false]]) { let y = 0; for (const q of pts) { y = clamp(y * 0.5 + (rand(s) - 0.35) * amp * 1.6, 0, amp * 1.8); q.y = far && s.mesa ? (y > amp * 0.6 ? amp * 1.2 : 0) : y; } } // the first frame already has its horizon
    for (let i = 0; i < 6; i++) spawn(s, first.mid[Math.floor(rand(s) * first.mid.length)], MID, rand(s) * s.W * 1.2); // the window is never empty on the first frame
    for (let i = 0; i < 5; i++) s.clouds.push({ x: rand(s) * s.W * 1.3, y: 0.06 + rand(s) * 0.3, w: 0.12 + rand(s) * 0.2, a: 0.4 + rand(s) * 0.5 });
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    // the day is the song: the sun rises at one edge on the first cycle and sets at the other on the last (a plain pattern gets a four-minute day)
    s.day = s.total > 0 ? clamp(clock.cycle / s.total) : (s.t / 240) % 1;
    s.sunUp = Math.sin(Math.PI * s.day); s.sunX = s.sunDir > 0 ? lerp(0.1, 0.9, s.day) : lerp(0.9, 0.1, s.day); s.sunY = 0.36 - 0.3 * s.sunUp;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = SCENE[role] ?? SCENE.none;
    const land = LAND[clock.index >= 0 ? s.lands[clock.index] : 'fields'] ?? LAND.fields;
    s.energy = ease(s.energy, clock.energy, 2, dt); s.speed = ease(s.speed, want.speed, 1.5, dt); s.busy = ease(s.busy, want.busy, 1.5, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.wasRiser = s.riser > 0 ? s.riser : decay(s.wasRiser, 2, dt);
    if (clock.boundary) { // a new section: a new landscape comes in; after a riser the train enters a tunnel, otherwise it passes under a bridge
      s.section = clock.section; s.land = s.lands[clock.index] ?? 'fields';
      const w = rand(s); s.weather = s.land === 'desert' ? (w < 0.08 ? 'rain' : 'clear') : w < 0.22 ? 'rain' : w < 0.3 && (s.land === 'mountains' || s.land === 'forest') ? 'snow' : 'clear'; // the weather turns with the landscape
      if (s.wasRiser > 0.3) { s.inTunnel = 2 / Math.max(0.05, s.cps); s.flash = 0.3; spawn(s, 'portal', NEAR, s.W + 0.05); } else spawn(s, 'overpass', NEAR, s.W + 0.5);
    }
    s.inTunnel = Math.max(0, s.inTunnel - dt);
    s.rain = ease(s.rain, s.weather === 'rain' ? 1 : 0, 0.5, dt); s.snow = ease(s.snow, s.weather === 'snow' ? 1 : 0, 0.5, dt); s.storm = ease(s.storm, s.weather === 'rain' && s.energy > 0.55 ? 1 : 0, 0.5, dt);
    s.bolt = decay(s.bolt, 8, dt);
    for (const n of s.nukes) n.age += dt; s.nukes = s.nukes.filter((n) => n.age < 80); // a distant nuke: the cloud rises for a minute and thins out
    const wasDark = s.tunnel > 0.5;
    s.tunnel = ease(s.tunnel, s.inTunnel > 0 || clock.dropout ? 1 : 0, 6, dt);
    if (wasDark && s.tunnel <= 0.5) { s.flash = Math.max(s.flash, 0.8); spawn(s, 'portal', NEAR, s.W * 0.4); } // out into the daylight, the mouth just behind
    s.dark = ease(s.dark, 0.7 * s.riser, 3, dt);
    s.beatPhase = clock.beatPhase; s.blink = clock.beat % 2;
    const bar = clock.index >= 0 ? clock.index * 1e4 + clock.bar : Math.floor(clock.cycle);
    if (bar !== s.bar) { // once a bar: the wind may turn, and some bars the track is rough for a couple of them
      s.bar = bar;
      if (rand(s) < 0.2) s.windTo = (rand(s) - 0.5) * 1.6;
      if (s.roughLeft <= 0 && rand(s) < 0.1) s.roughLeft = (1 + rand(s) * 2) / Math.max(0.05, s.cps);
      if (s.storm > 0.5 && rand(s) < 0.35) lightning(s);
      if (rand(s) < 0.03 && s.tunnel < 0.5) nuke(s);
    }
    s.roughLeft = Math.max(0, s.roughLeft - dt); s.rough = ease(s.rough, s.roughLeft > 0 ? 1 : 0, 3, dt);
    s.wind = ease(s.wind, clamp(s.windTo + 0.8 * s.riser, -1, 1), 0.4, dt);
    s.mesa = ease(s.mesa, land.mesa ? 1 : 0, 0.5, dt);
    s.farTo = land.far; s.hillTo = land.hill * s.hillBass;
    s.farAmp = ease(s.farAmp, s.farTo, 0.5, dt); s.hillAmp = ease(s.hillAmp, s.hillTo, 0.8, dt);
    if (s.groundTo !== land.ground) { s.groundTo = land.ground; s.groundMix = 0; }
    s.groundMix = clamp(s.groundMix + dt * 0.4); const gt = GROUND[s.groundTo]; for (let i = 0; i < 3; i++) s.ground[i] = ease(s.ground[i], gt[i], 0.6, dt);
    // the train: screen widths per second, a width and a half per bar, by the scene and the energy, faster into a riser, slow in the tunnel; the carriage rocks
    const v = s.W * 1.5 * s.cps * s.speed * lerp(0.7, 1.3, s.energy) * (1 + 0.8 * s.riser) * (1 - 0.35 * s.tunnel);
    s.dist += v * dt; s.bedOff = (s.bedOff + v * BED * dt) % 0.25; s.waveOff = (s.waveOff + v * 0.2 * dt) % 0.3;
    s.vy += (-s.jolt * 60 - s.vy * 8) * dt; s.jolt += s.vy * dt; s.sway += dt * 1.7;
    // the ridges scroll and grow new heights at the right
    for (const [pts, dx, k, amp] of [[s.far, 0.5, FAR, s.farAmp], [s.hill, 0.42, HILL, s.hillAmp]]) {
      for (const q of pts) q.x -= v * k * dt;
      if (k === FAR) for (const n of s.nukes) n.x -= v * k * dt;
      while (pts[1] && pts[1].x < -dx) { pts.shift(); const last = pts[pts.length - 1]; const y = clamp(last.y * 0.5 + (rand(s) - 0.35) * amp * 1.6, 0, amp * 1.8); pts.push({ x: last.x + dx, y: k === FAR && s.mesa > 0.5 ? (y > amp * 0.6 ? amp * 1.2 : 0) : y }); } // the desert's far ridge is mesas: flat tops or nothing
      for (const q of pts) q.y = Math.min(q.y, amp * 1.8 + 0.001); // a landscape flattening drops its old peaks with it
    }
    // scenery by distance travelled at each layer: the landscape says what and how often, the scene how busy
    s.midNext -= v * MID * dt / s.W; s.nearNext -= v * NEAR * dt / s.W; s.cloudNext -= v * FAR * dt / s.W; s.lampNext -= v * NEAR * dt / s.W;
    const gap = ([a, b]) => (a + rand(s) * (b - a)) / s.busy;
    const landName = clock.index >= 0 ? s.lands[clock.index] : 'fields';
    if (s.midNext <= 0) { spawn(s, pickOf(s, land, landName, 'mid'), MID, s.W + 0.3); s.midNext = gap(land.midGap); }
    if (s.nearNext <= 0) { spawn(s, pickOf(s, land, landName, 'near'), NEAR, s.W + 0.6); s.nearNext = gap(land.nearGap); }
    s.skyNext -= dt; // the sky's traffic, by time rather than distance: a thing every so often, flying at its own pace
    if (s.skyNext <= 0) { if (s.objs.length < MAX_OBJ && s.tunnel < 0.5) { const kind = WHIMSY.sky[Math.floor(rand(s) * WHIMSY.sky.length)]; s.objs.push({ kind, layer: 0.1, x: kind === 'meteor' ? s.W * 0.7 + rand(s) * 0.5 : s.W + 0.3, y: 0.05 + rand(s) * 0.3, h: 0.7 + rand(s) * 0.6, v: rand(s), lit: 0, k: kind === 'plane' ? 0.35 : kind === 'meteor' ? 1.4 : kind === 'rocket' ? -0.1 : 0.06 + rand(s) * 0.1, sky: true, vy: kind === 'rocket' ? -0.12 : kind === 'meteor' ? 0.5 : 0 }); } s.skyNext = 7 + rand(s) * 12; }
    if (s.cloudNext <= 0) { if (s.clouds.length < MAX_CLOUD && rand(s) < s.cloud) s.clouds.push({ x: s.W + 0.4, y: 0.04 + rand(s) * 0.32, w: 0.1 + rand(s) * 0.22, a: 0.3 + rand(s) * 0.6 }); s.cloudNext = 0.25 + rand(s) * 0.4; }
    if (s.tunnel > 0.3 && s.lampNext <= 0) { s.lamps.push({ x: s.W + 0.1 }); s.lampNext = 0.28; }
    for (const o of s.objs) { o.x -= (v * o.layer + (o.sky ? o.k : v * o.k)) * dt; if (o.sky) o.y += o.vy * dt; o.lit = decay(o.lit, 3, dt); }
    s.objs = s.objs.filter((o) => o.x > (o.kind === 'overpass' ? -2.8 : -1.6) && o.x < s.W + 3 && !(o.sky && (o.y < -0.2 || o.y > HORIZON)) && !(o.kind === 'portal' && s.tunnel > 0.9 && s.inTunnel > 0.3 && o.x < -0.5)); // the entry portal is gone once inside; a rocket leaves at the top, a meteor at the horizon // the overpass is drawn 2.2 heights to the right of its anchor, so it is gone only once that end has left
    for (const c of s.clouds) c.x -= (v * FAR * 0.7 - s.wind * 0.05) * dt; s.clouds = s.clouds.filter((c) => c.x > -0.6 && c.x < s.W + 1);
    for (const l of s.lamps) l.x -= v * NEAR * dt; s.lamps = s.lamps.filter((l) => l.x > -0.2);
    for (const b of s.birds) { b.x -= (v * b.k - s.wind * 0.12) * dt; b.y += Math.sin(s.t * 3 + b.ph) * 0.02 * dt + (b.up ? -0.03 * dt : 0) + Math.abs(s.wind) * 0.01 * Math.sin(s.t * 5 + b.ph) * dt; b.life -= dt; }
    s.birds = s.birds.filter((b) => b.life > 0 && b.x > -0.2 && b.x < s.W + 0.5);
    s.cloud = ease(s.cloud, s.cloudTo, 0.5, dt); s.cloudTo = ease(s.cloudTo, 0.35, 0.05, dt);
    s.flash = decay(s.flash, 6, dt); s.lit = decay(s.lit, 3, dt);
    // the events, each by its part's job in the cast
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'transition') { if (e.dur >= 1) { s.flash = Math.max(s.flash, 0.7); s.vy -= 0.4; s.roughLeft = Math.max(s.roughLeft, 1.5); s.windTo = (rand(s) - 0.5) * 2; if (s.tunnel < 0.5 && rand(s) < 0.8) nuke(s); } } // the impact (a whole cycle long); a riser's slices are the clock's business
      else if (e.role === 'pulse') { if (s.dist - s.poleAt > 0.45 * s.W) { spawn(s, 'pole', NEAR, s.W + 0.05); s.poleAt = s.dist; } s.vy -= 0.25 * g; if (s.storm > 0.5 && rand(s) < 0.06) lightning(s); } // a kick, whatever slot its part took: a pole on the grid, never a picket line
      else if (e.role === 'impact') { const r = rand(s); spawn(s, r < 0.25 ? 'crossing' : r < 0.5 ? 'billboard' : 'tourist', NEAR, s.W + 0.05); s.lit = Math.max(s.lit, 0.5 * g); } // a crossing, a billboard or a tourist whose camera flashes
      else if (slot === 'impulse') {
        if (e.role === 'grain') bird(s, null, 0.3 * g);
        else s.vy -= 0.1 * g;
      } else if (slot === 'ground') {
        if (e.note !== null) s.hillBass = lerp(1.7, 0.5, clamp((e.note - 24) / 36));
        for (const o of s.objs) if (o.layer === MID) o.lit = Math.max(o.lit, 0.4 * g);
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note !== null) bird(s, clamp((72 - e.note) / 36) * HORIZON * (slot === 'line' ? 0.6 : 0.9) + 0.03, g, slot === 'counter');
      } else if (slot === 'field') {
        s.cloudTo = clamp(0.3 + 0.6 * g);
        if (e.cutoff !== null) s.light = clamp(Math.log(e.cutoff / 200) / Math.log(40));
      } else if (e.role === 'grain' || slot === 'grain') bird(s, null, 0.25 * g);
    }
  },

  draw(s, ctx, w, h) {
    const W = w / h, sky = SKY[s.sky], night = sky.stars, dusk = night ? 0 : clamp(1 - s.sunUp / 0.35), day = lerp(0.6, 1.15, s.lum) * lerp(0.75, 1.1, s.light) * lerp(1, 0.72, dusk), lit = 1 - 0.7 * s.dark;
    const low = sky.low;
    const shake = s.rough * 0.006, sx = shake * Math.sin(s.t * 41) * Math.sin(s.t * 7.3), sy = s.jolt * 0.01 + Math.sin(s.sway) * 0.002 + shake * Math.sin(s.t * 53) * Math.cos(s.t * 11); // rough track: the whole view jitters
    const X = (x) => (x + sx) * h, Y = (y) => (y + sy) * h;
    const hor = Y(HORIZON);
    ctx.globalCompositeOperation = 'source-over'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // the sky, the sun or moon, the stars, the clouds
    const grad = ctx.createLinearGradient(0, 0, 0, hor);
    grad.addColorStop(0, hsla(sky.top[0], sky.top[1], sky.top[2] * day * lit)); grad.addColorStop(1, hsla(low[0], low[1], low[2] * day * lit));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    if (dusk > 0.01) { const warm = ctx.createLinearGradient(0, Y(HORIZON * 0.4), 0, hor); warm.addColorStop(0, hsla(24, 85, 58, 0)); warm.addColorStop(1, hsla(24, 85, 58, 0.75 * dusk)); ctx.fillStyle = warm; ctx.fillRect(0, 0, w, hor); } // dawn and dusk: an orange band on the horizon, painted over the sky rather than mixed into its hue (a hue blend passes through green)
    if (night) for (const st of s.stars) { if (st.x > W) continue; ctx.fillStyle = hsla(50, 20, 90, 0.6 * st.w * lit); ctx.fillRect(X(st.x), Y(st.y), h * 0.003 * st.w, h * 0.003 * st.w); }
    ctx.beginPath(); ctx.arc(X(s.sunX * W), Y(s.sunY), h * (night ? 0.04 : 0.055), 0, TAU); ctx.fillStyle = hsla(lerp(sky.sun[0], 18, dusk), sky.sun[1], lerp(sky.sun[2], 62, dusk), 0.9 * lit); ctx.fill();
    for (const c of s.clouds) { ctx.fillStyle = hsla(sky.low[0], 20, night ? 30 : 92 * day, 0.6 * c.a * lit); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(X(c.x + i * c.w * 0.4), Y(c.y + Math.abs(i) * 0.012), h * c.w * 0.5, h * c.w * (0.22 - Math.abs(i) * 0.06), 0, 0, TAU); ctx.fill(); } }
    if (Math.abs(s.wind) > 0.45) { const a = (Math.abs(s.wind) - 0.45) * 0.5; ctx.strokeStyle = hsla(sky.low[0], 20, night ? 60 : 96, a * lit); ctx.lineWidth = h * 0.002; for (let i = 0; i < 9; i++) { const y = 0.05 + ((i * 0.37 + 0.11) % 1) * HORIZON * 0.8, x = ((s.t * (0.5 + 0.3 * i) * Math.sign(-s.wind) + i * 0.7) % (W + 0.6) + W + 0.6) % (W + 0.6) - 0.3; ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x + 0.25 + 0.1 * (i % 3)), Y(y + 0.004)); ctx.stroke(); } } // a gale: streaks across the sky
    for (const o of s.objs) if (o.sky) skyThing(s, ctx, h, o, X, Y, night, lit);
    if (s.bolt > 0.01 && s.boltPts.length) { ctx.strokeStyle = hsla(55, 90, 92, s.bolt); ctx.lineWidth = h * 0.006; ctx.beginPath(); s.boltPts.forEach((q, i) => (i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); ctx.stroke(); ctx.lineWidth = h * 0.02; ctx.strokeStyle = hsla(55, 90, 92, 0.25 * s.bolt); ctx.stroke(); } // the bolt, drawn twice: a core and a glow
    // the birds: a flapping v, the line parts' bigger and warmer
    for (const b of s.birds) {
      const f = Math.sin(s.t * 11 + b.ph) * 0.5, r = h * b.size, x = X(b.x), y = Y(b.y);
      ctx.beginPath(); ctx.moveTo(x - r, y - f * r); ctx.quadraticCurveTo(x - r * 0.5, y + f * r * 0.3, x, y); ctx.quadraticCurveTo(x + r * 0.5, y + f * r * 0.3, x + r, y - f * r);
      ctx.lineWidth = h * 0.003; ctx.strokeStyle = hsla(s.pal.line, 40, night ? 70 : 20, clamp(b.life / 2) * lit); ctx.stroke();
    }
    // the ridges, far then hills, the ground, the sea
    const ridgeDraw = (pts, col) => { ctx.beginPath(); ctx.moveTo(X(pts[0].x), hor + 2); for (const q of pts) ctx.lineTo(X(q.x), Y(HORIZON - q.y)); ctx.lineTo(X(pts[pts.length - 1].x), hor + 2); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    for (const n of s.nukes) { // beyond the far ridge: the column and the cap grow with age, fire to dust, thinning out at the end
      const g = 1 - Math.exp(-n.age / 12), fire = Math.exp(-n.age / 6), a = clamp((80 - n.age) / 25) * lit, cx = X(n.x), base = hor + 2, capH = h * 0.5 * g * n.h, stemW = h * 0.06 * (0.4 + 0.6 * g) * n.h, capW = h * 0.26 * g * n.h, capY = base - capH;
      const hue = lerp(20, 30, 1 - fire), sat = lerp(12, 90, fire), light = lerp(38, 62, fire);
      const grad = ctx.createLinearGradient(0, capY, 0, base); grad.addColorStop(0, hsla(hue, sat, light, a)); grad.addColorStop(1, hsla(hue, sat * 0.6, light * 0.6, a));
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(cx - stemW, base); ctx.quadraticCurveTo(cx - stemW * 0.6, capY + capH * 0.5, cx - stemW * 1.2, capY + capH * 0.3); ctx.lineTo(cx + stemW * 1.2, capY + capH * 0.3); ctx.quadraticCurveTo(cx + stemW * 0.6, capY + capH * 0.5, cx + stemW, base); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hsla(hue, sat, light, a); ctx.beginPath(); ctx.ellipse(cx, capY + capH * 0.22, capW, capH * 0.26, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = hsla(hue, sat, light + 12, a * 0.8); ctx.beginPath(); ctx.ellipse(cx - capW * 0.3, capY + capH * 0.12, capW * 0.5, capH * 0.18, 0, 0, TAU); ctx.ellipse(cx + capW * 0.35, capY + capH * 0.2, capW * 0.45, capH * 0.16, 0, 0, TAU); ctx.fill();
      if (fire > 0.05) { ctx.fillStyle = hsla(45, 100, 90, fire * a); ctx.beginPath(); ctx.ellipse(cx, capY + capH * 0.25, capW * 0.5, capH * 0.15, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = hsla(hue, sat * 0.5, 30, a * 0.6 * g); ctx.beginPath(); ctx.ellipse(cx, base, stemW * 4 * g, h * 0.02, 0, Math.PI, TAU); ctx.fill(); // the dust ring at the foot
      if (fire > 0.02) { const r = h * 0.26 * n.h * (1 - Math.exp(-n.age / 1.2)); const fb = ctx.createRadialGradient(cx, base, 0, cx, base, r * 2); fb.addColorStop(0, hsla(50, 100, 98, fire * a)); fb.addColorStop(0.3, hsla(45, 100, 85, fire * a)); fb.addColorStop(0.5, hsla(30, 100, 62, 0.8 * fire * a)); fb.addColorStop(1, hsla(20, 100, 55, 0)); ctx.fillStyle = fb; ctx.beginPath(); ctx.ellipse(cx, base, r * 2, r * 1.4, 0, Math.PI, TAU); ctx.fill(); } // the fireball: a dome on the horizon in the first seconds, tall enough to clear the ridge, gone as the cloud takes over
    }
    ridgeDraw(s.far, hsla(s.pal.hue, 25, lerp(30, 62, s.lum) * lit * (night ? 0.4 : 1), 0.9));
    const [gh, gs, gl] = s.ground;
    ctx.fillStyle = hsla(gh, gs, gl * lit * (night ? 0.55 : 1)); ctx.fillRect(0, hor, w, h - hor);
    if (s.hillAmp > 0.005) ridgeDraw(s.hill, hsla(gh - 8, gs + 8, (gl - 6) * lit * (night ? 0.55 : 1)));
    const water = s.groundTo === 'water' || s.groundTo === 'void';
    if (water) { // waves, then the shore the track runs along; over the bridge the water is all there is below
      ctx.strokeStyle = hsla(gh, 30, 80, 0.25 * lit); ctx.lineWidth = h * 0.002;
      for (let row = 0; row < 5; row++) { const y = HORIZON + 0.03 + row * row * 0.012, dx = 0.14 + row * 0.04; for (let x = -((s.waveOff * (1 + row)) % dx); x < W; x += dx) { ctx.beginPath(); ctx.arc(X(x), Y(y), h * 0.003 * (1 + row), Math.PI, TAU); ctx.stroke(); } }
      if (s.groundTo === 'water') { ctx.fillStyle = hsla(40, 30, 58 * lit * (night ? 0.55 : 1)); ctx.fillRect(0, Y(0.8), w, h); }
    } else { // the field rows and the track bed rushing by underneath
      ctx.strokeStyle = hsla(gh, gs, gl - 8, 0.5 * lit); ctx.lineWidth = h * 0.004;
      for (let x = -s.bedOff * 4; x < W + 0.3; x += 0.25) { ctx.beginPath(); ctx.moveTo(X(x), Y(NEAR_Y - 0.02)); ctx.lineTo(X(x - 0.3), Y(1)); ctx.stroke(); }
    }
    // the scenery, deep to near
    const objs = s.objs.filter((o) => !o.sky).sort((a, b) => a.layer - b.layer || a.x - b.x);
    for (const o of objs) if (o.kind !== 'overpass' && o.kind !== 'truss' && o.kind !== 'portal' && (!water || (o.layer === NEAR && s.groundTo === 'water'))) shadow(s, ctx, h, o, night, lit, sx, sy); // nothing shadows the sea; the shore takes the trackside's
    for (const o of objs) object(s, ctx, h, o, night, lit, sx, sy);
    const poles = objs.filter((o) => o.kind === 'pole'); // the wires: pole to pole with a sag, and on out of the frame at both ends
    if (poles.length) {
      const top = (o) => (footOf(o) + sy) * h - o.h * 0.5 * h * 1.15, ends = [{ x: -0.4, y: top(poles[0]) - h * 0.02 }, ...poles.map((o) => ({ x: o.x + sx, y: top(o) })), { x: W + 0.4, y: top(poles[poles.length - 1]) - h * 0.02 }];
      ctx.lineWidth = h * 0.002; ctx.strokeStyle = hsla(0, 0, night ? 8 : 15, 0.6 * lit);
      for (const dy of [0, 0.025]) { ctx.beginPath(); ctx.moveTo(ends[0].x * h, ends[0].y + dy * h); for (let i = 1; i < ends.length; i++) { const a = ends[i - 1], b = ends[i], span = Math.abs(b.x - a.x); ctx.quadraticCurveTo(((a.x + b.x) / 2) * h, Math.max(a.y, b.y) + dy * h + h * Math.min(0.12, 0.08 * span), b.x * h, b.y + dy * h); } ctx.stroke(); }
    }
    // the trackside bed: gravel and sleepers under the window
    if (s.groundTo !== 'void') { ctx.fillStyle = hsla(gh, 10, 26 * lit); ctx.fillRect(0, Y(0.94), w, h); ctx.fillStyle = hsla(30, 15, 34 * lit); for (let x = -s.bedOff; x < W; x += 0.25) ctx.fillRect(X(x), Y(0.95), h * 0.05, h * 0.02); }
    // the tunnel: black with lamps flashing past, brightest on the beat; a riser's cutting darkens the edges
    if (s.tunnel > 0.01) {
      ctx.fillStyle = hsla(20, 12, 9, s.tunnel * 0.985); ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = hsla(20, 10, 22, 0.55 * s.tunnel); ctx.lineWidth = h * 0.003; // the courses of the bore, closer together toward the top and bottom where the wall curves away
      for (let i = 0; i < 12; i++) { const u = i / 11, y = 0.5 + (u - 0.5) * 0.92 * (0.7 + 0.3 * Math.abs(u - 0.5) * 2); ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(w, Y(y)); ctx.stroke(); }
      for (let x = -(s.bedOff * 2) % 0.5; x < W; x += 0.5) for (let i = 0; i < 11; i++) { const u = (i + 0.5) / 11, y = 0.5 + (u - 0.5) * 0.92 * (0.7 + 0.3 * Math.abs(u - 0.5) * 2), xx = x + (i % 2) * 0.25; ctx.beginPath(); ctx.moveTo(X(xx), Y(y - 0.03)); ctx.lineTo(X(xx), Y(y + 0.03)); ctx.stroke(); }
      const vig = ctx.createLinearGradient(0, 0, 0, h); vig.addColorStop(0, `rgba(0 0 0 / ${0.7 * s.tunnel})`); vig.addColorStop(0.35, 'rgba(0 0 0 / 0)'); vig.addColorStop(0.65, 'rgba(0 0 0 / 0)'); vig.addColorStop(1, `rgba(0 0 0 / ${0.8 * s.tunnel})`); ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
      const on = 1 - 0.6 * s.beatPhase;
      ctx.strokeStyle = hsla(0, 0, 30, 0.8 * s.tunnel); ctx.lineWidth = h * 0.004; ctx.beginPath(); // the cable, sagging lamp to lamp
      const lx = s.lamps.map((l) => l.x).sort((a, b) => a - b), cab = [-0.3, ...lx, W + 0.3]; ctx.moveTo(X(cab[0]), Y(0.24));
      for (let i = 1; i < cab.length; i++) ctx.quadraticCurveTo(X((cab[i - 1] + cab[i]) / 2), Y(0.24 + 0.05 * Math.min(1, cab[i] - cab[i - 1])), X(cab[i]), Y(0.24));
      ctx.stroke();
      for (const l of s.lamps) { const x = X(l.x), y = Y(0.18); const g2 = ctx.createRadialGradient(x, y, 0, x, y, h * 0.25); g2.addColorStop(0, hsla(42, 90, 70, 0.9 * on * s.tunnel)); g2.addColorStop(1, hsla(42, 90, 50, 0)); ctx.fillStyle = g2; ctx.fillRect(x - h * 0.25, y - h * 0.25, h * 0.5, h * 0.5); ctx.fillStyle = hsla(42, 90, 88, s.tunnel); ctx.fillRect(x - h * 0.008, y - h * 0.02, h * 0.016, h * 0.04); }
    }
    if (s.dark > 0.01) { const v = ctx.createLinearGradient(0, 0, w, 0); v.addColorStop(0, `rgba(0 0 0 / ${0.2 * s.dark})`); v.addColorStop(0.5, 'rgba(0 0 0 / 0)'); v.addColorStop(1, `rgba(0 0 0 / ${0.9 * s.dark})`); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }
    // the weather over everything: rain leaning with the wind, snow drifting
    if (s.rain > 0.02) { ctx.strokeStyle = hsla(210, 40, 80, 0.35 * s.rain * lit); ctx.lineWidth = h * 0.002; const lean = 0.08 + 0.18 * s.wind; for (let i = 0; i < 90; i++) { const fx = ((i * 0.7548776662) % 1) * (W + 0.4) - 0.2, fy = ((i * 0.5698402909 + s.t * (1.6 + (i % 3) * 0.3)) % 1) * 1.1 - 0.05; /* the two axes from an R2 sequence, so the drops do not line up in bands */ ctx.beginPath(); ctx.moveTo(X(fx), Y(fy)); ctx.lineTo(X(fx + lean * 0.06), Y(fy + 0.06)); ctx.stroke(); } ctx.fillStyle = hsla(210, 20, 40, 0.18 * s.rain); ctx.fillRect(0, 0, w, h); }
    if (s.snow > 0.02) { ctx.fillStyle = hsla(0, 0, 100, 0.8 * s.snow * lit); for (let i = 0; i < 120; i++) { const fx = ((i * 0.7548776662 + Math.sin(s.t * 0.7 + i) * 0.03 + s.wind * 0.02 * s.t) % 1 + 1) % 1 * (W + 0.2) - 0.1, fy = ((i * 0.5698402909 + s.t * (0.08 + (i % 4) * 0.03)) % 1) * 1.05; ctx.beginPath(); ctx.arc(X(fx), Y(fy), h * (0.003 + 0.003 * (i % 3)), 0, TAU); ctx.fill(); } }
    // the window: a soft frame with rounded corners and a faint reflection, then the flash
    const m = h * 0.025;
    ctx.fillStyle = hsla(s.pal.hue, 10, 8); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.roundRect(m, m, w - 2 * m, h - 2 * m, h * 0.06); ctx.fill('evenodd');
    ctx.strokeStyle = hsla(s.pal.hue, 15, 25); ctx.lineWidth = h * 0.006; ctx.beginPath(); ctx.roundRect(m, m, w - 2 * m, h - 2 * m, h * 0.06); ctx.stroke();
    const refl = ctx.createLinearGradient(0, 0, w * 0.4, h); refl.addColorStop(0, 'rgba(255 255 255 / .07)'); refl.addColorStop(0.3, 'rgba(255 255 255 / 0)'); ctx.fillStyle = refl; ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
    if (s.flash > 0.01) { ctx.fillStyle = hsla(sky.sun[0], 30, 95, 0.6 * s.flash); ctx.fillRect(0, 0, w, h); }
  },
};

/** A bird into the sky: at `y` (heights from the top) for a line part, else lifting off the fields with a chance by `g`. */
function bird(s, y, g, big = false) {
  if (s.birds.length >= MAX_BIRD || (y === null && rand(s) > g)) return;
  s.birds.push({ x: s.W + 0.05, y: y ?? HORIZON - 0.02 - rand(s) * 0.04, k: 0.18 + rand(s) * 0.12, ph: rand(s) * TAU, size: big ? 0.03 : 0.018 + 0.008 * g, up: y === null, life: 12 });
}

const footOf = (o) => (o.layer === NEAR ? NEAR_Y : MID_Y - o.v * 0.02);
/** The shadow a thing throws on the ground: one direction for the whole scene, set by the time of day alone (away from the side the sun is on, sweeping through straight-down at noon), long when the sun is low, short and dark under a high one, faint by night. */
function shadow(s, ctx, h, o, night, lit, sx, sy) {
  const near = o.layer === NEAR, H = o.h * (near ? 0.5 : 0.16) * h, x = (o.x + sx) * h, y = (footOf(o) + sy) * h;
  const away = (0.5 - s.sunX) * 2; // -1 with the sun at the right edge, +1 at the left, 0 overhead: a shadow never flips as its object scrolls past the sun
  const len = H * (o.kind === 'pole' || o.kind === 'crossing' ? 1.2 : o.kind === 'hedge' || o.kind === 'fence' ? 0.25 : 0.7) * lerp(2.6, 0.45, s.sunUp) * away, wide = o.kind === 'hedge' ? H * 1.2 : o.kind === 'fence' ? H * 0.75 : H * 0.3;
  ctx.fillStyle = hsla(0, 0, 0, (night ? 0.12 : lerp(0.16, 0.3, s.sunUp)) * lit);
  ctx.beginPath(); ctx.moveTo(x - wide, y); ctx.lineTo(x + wide, y); ctx.lineTo(x + wide * 0.5 + len, y + H * 0.04); ctx.lineTo(x - wide * 0.5 + len, y + H * 0.04); ctx.closePath(); ctx.fill();
}
/** One piece of scenery at its layer: mid things stand near the horizon and small, near things at the trackside and tall; the wind leans the trees. */
function object(s, ctx, h, o, night, lit, sx = 0, sy = 0) {
  const near = o.layer === NEAR, sc = near ? 0.5 : 0.16, x = (o.x + sx) * h, y = (footOf(o) + sy) * h, H = o.h * sc * h;
  const lean = s.wind * (0.12 + 0.05 * Math.sin(s.t * 2.2 + o.v * 9)) * H; // the wind in the branches
    const shade = (l) => l * lit * (night ? 0.45 : 1) + 30 * o.lit;
    const [gh, gs] = s.ground;
    ctx.fillStyle = hsla(120, 25, shade(22));
    switch (o.kind) {
      case 'tree': ctx.fillStyle = hsla(28, 30, shade(24)); ctx.fillRect(x - H * 0.04, y - H * 0.5, H * 0.08, H * 0.5); ctx.fillStyle = hsla(105 + o.v * 30, 35, shade(28)); ctx.beginPath(); ctx.ellipse(x + lean, y - H * 0.7, H * 0.32, H * 0.36, lean / H * 0.5, 0, TAU); ctx.fill(); break;
      case 'pine': ctx.fillStyle = hsla(28, 30, shade(22)); ctx.fillRect(x - H * 0.03, y - H * 0.3, H * 0.06, H * 0.3); ctx.fillStyle = hsla(140 + o.v * 20, 30, shade(24)); for (let i = 0; i < 3; i++) { const t = y - H * (0.25 + i * 0.28), r = H * (0.26 - i * 0.06), l = lean * (0.4 + 0.4 * i); ctx.beginPath(); ctx.moveTo(x - r + l * 0.5, t); ctx.lineTo(x + l, t - H * 0.32); ctx.lineTo(x + r + l * 0.5, t); ctx.closePath(); ctx.fill(); } break;
      case 'hedge': ctx.fillStyle = hsla(100, 30, shade(24)); ctx.beginPath(); ctx.roundRect(x - H * 1.2, y - H * 0.16, H * 2.4, H * 0.18, H * 0.08); ctx.fill(); break;
      case 'barn': case 'house': { const bw = H * (o.kind === 'barn' ? 0.9 : 0.6), bh = H * 0.4; ctx.fillStyle = hsla(o.kind === 'barn' ? 8 : 35, 40, shade(40)); ctx.fillRect(x - bw / 2, y - bh, bw, bh); ctx.fillStyle = hsla(10, 25, shade(28)); ctx.beginPath(); ctx.moveTo(x - bw * 0.55, y - bh); ctx.lineTo(x, y - bh - H * 0.25); ctx.lineTo(x + bw * 0.55, y - bh); ctx.closePath(); ctx.fill(); if (night) { ctx.fillStyle = hsla(45, 90, 75); ctx.fillRect(x - bw * 0.2, y - bh * 0.7, bw * 0.15, bh * 0.25); } break; }
      case 'rock': ctx.fillStyle = hsla(30, 10, shade(38)); ctx.beginPath(); ctx.moveTo(x - H * 0.35, y); ctx.lineTo(x - H * 0.15, y - H * 0.3); ctx.lineTo(x + H * 0.1, y - H * 0.22); ctx.lineTo(x + H * 0.35, y); ctx.closePath(); ctx.fill(); break;
      case 'boat': ctx.fillStyle = hsla(0, 0, shade(85)); ctx.beginPath(); ctx.moveTo(x - H * 0.3, y - H * 0.1); ctx.lineTo(x + H * 0.3, y - H * 0.1); ctx.lineTo(x + H * 0.2, y); ctx.lineTo(x - H * 0.2, y); ctx.closePath(); ctx.fill(); ctx.fillRect(x - H * 0.02, y - H * 0.5, H * 0.04, H * 0.4); break; // the hull sits on the water
      case 'island': ctx.fillStyle = hsla(gh - 80, gs, shade(30)); ctx.beginPath(); ctx.ellipse(x, y, H * 1.4, H * 0.22, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = hsla(40, 30, shade(70)); ctx.beginPath(); ctx.ellipse(x, y, H * 1.45, H * 0.04, 0, Math.PI, TAU); ctx.fill(); break; // the island rises from the water line, a sliver of beach at its foot
      case 'pole': ctx.strokeStyle = hsla(30, 20, shade(18)); ctx.lineWidth = h * 0.012; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - H * 1.25); ctx.moveTo(x - H * 0.14, y - H * 1.15); ctx.lineTo(x + H * 0.14, y - H * 1.15); ctx.stroke(); break;
      case 'fence': ctx.strokeStyle = hsla(30, 25, shade(30)); ctx.lineWidth = h * 0.006; ctx.beginPath(); for (let i = 0; i < 6; i++) { ctx.moveTo(x + i * H * 0.3, y); ctx.lineTo(x + i * H * 0.3, y - H * 0.3); } ctx.moveTo(x, y - H * 0.22); ctx.lineTo(x + H * 1.5, y - H * 0.22); ctx.stroke(); break;
      case 'post': ctx.fillStyle = hsla(30, 20, shade(30)); ctx.fillRect(x - H * 0.03, y - H * 0.5, H * 0.06, H * 0.5); break;
      case 'truss': { const g = 0.28 * s.W * h, top = h * 0.06, bot = y - h * 0.02; ctx.strokeStyle = hsla(200, 8, shade(40)); ctx.lineWidth = h * 0.012; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.moveTo(x, top); ctx.lineTo(x + g, bot); ctx.moveTo(x + g, top); ctx.lineTo(x, bot); ctx.moveTo(x, top); ctx.lineTo(x + g, top); ctx.moveTo(x, bot); ctx.lineTo(x + g, bot); ctx.moveTo(x, bot + h * 0.06); ctx.lineTo(x + g, bot + h * 0.06); ctx.stroke(); break; }
      case 'billboard': { const bw = H * 0.5, bh = H * 0.24, top = y - H * 0.85; ctx.fillStyle = hsla(30, 25, shade(28)); ctx.fillRect(x - bw * 0.3, top + bh * 0.5, H * 0.03, y - top - bh * 0.5); ctx.fillRect(x + bw * 0.3, top + bh * 0.5, H * 0.03, y - top - bh * 0.5); ctx.fillStyle = hsla(30, 25, shade(22)); ctx.fillRect(x - bw / 2 - H * 0.02, top - H * 0.02, bw + H * 0.04, bh + H * 0.04); ctx.fillStyle = hsla(40, 20, shade(80)); ctx.fillRect(x - bw / 2, top, bw, bh); ctx.fillStyle = hsla(0, 0, shade(35)); for (let i = 0; i < 3; i++) ctx.fillRect(x - bw * 0.4, top + bh * (0.22 + i * 0.25), bw * (0.3 + ((o.v * 7 + i * 3) % 5) * 0.1), bh * 0.1); break; }
      case 'cows': case 'cow': case 'sheep': case 'horse': case 'deer': { // a small herd (one cow at the trackside): a body, a head down grazing or up, legs; the deer has antlers
        const n = o.kind === 'cows' || o.kind === 'sheep' ? 2 + Math.floor(o.v * 3) : 1, B = H * 0.28;
        for (let i = 0; i < n; i++) {
          const ax = x + (i - (n - 1) / 2) * B * 1.6, up = ((o.v * 13 + i) % 3) < 1, dark = o.kind === 'sheep' ? shade(88) : o.kind === 'horse' ? shade(28) : o.kind === 'deer' ? shade(42) : (o.v * 5 + i) % 2 < 1 ? shade(90) : shade(18);
          const col = o.kind === 'sheep' ? hsla(40, 10, dark) : o.kind === 'horse' ? hsla(25, 45, dark) : o.kind === 'deer' ? hsla(28, 45, dark) : hsla(30, 15, dark);
          ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(ax, y - B * 0.55, B * 0.55, B * 0.3, 0, 0, TAU); ctx.fill(); // the body
          ctx.fillRect(ax - B * 0.45, y - B * 0.4, B * 0.1, B * 0.4); ctx.fillRect(ax + B * 0.35, y - B * 0.4, B * 0.1, B * 0.4); // the legs
          const hx = ax + B * 0.6, hy = up ? y - B * 0.9 : y - B * 0.35; ctx.beginPath(); ctx.ellipse(hx, hy, B * 0.18, B * 0.14, up ? -0.3 : 0.5, 0, TAU); ctx.fill(); // the head
          if (o.kind === 'deer' && up) { ctx.strokeStyle = col; ctx.lineWidth = h * 0.003; ctx.beginPath(); ctx.moveTo(hx, hy - B * 0.1); ctx.lineTo(hx - B * 0.12, hy - B * 0.4); ctx.moveTo(hx, hy - B * 0.1); ctx.lineTo(hx + B * 0.14, hy - B * 0.42); ctx.moveTo(hx - B * 0.06, hy - B * 0.26); ctx.lineTo(hx - B * 0.2, hy - B * 0.3); ctx.stroke(); }
          if (o.kind === 'cows' || o.kind === 'cow') { ctx.fillStyle = dark > 50 ? hsla(30, 15, shade(20)) : hsla(30, 15, shade(88)); ctx.beginPath(); ctx.ellipse(ax - B * 0.15, y - B * 0.6, B * 0.18, B * 0.14, 0.4, 0, TAU); ctx.fill(); } // the patch
        }
        break;
      }
      case 'tractor': { const B = H * 0.55; ctx.fillStyle = hsla(0, 0, shade(12)); ctx.beginPath(); ctx.arc(x - B * 0.35, y - B * 0.32, B * 0.32, 0, TAU); ctx.arc(x + B * 0.45, y - B * 0.18, B * 0.18, 0, TAU); ctx.fill(); ctx.fillStyle = hsla(120, 50, shade(32)); ctx.fillRect(x - B * 0.1, y - B * 0.55, B * 0.7, B * 0.3); ctx.fillRect(x - B * 0.5, y - B * 1.05, B * 0.45, B * 0.5); ctx.fillStyle = hsla(200, 40, shade(70), 0.7); ctx.fillRect(x - B * 0.42, y - B * 0.98, B * 0.3, B * 0.28); ctx.fillStyle = hsla(0, 0, shade(20)); ctx.fillRect(x + B * 0.45, y - B * 0.95, B * 0.06, B * 0.4); break; }
      case 'cactus': ctx.fillStyle = hsla(95, 35, shade(30)); ctx.beginPath(); ctx.roundRect(x - H * 0.06, y - H * 0.8, H * 0.12, H * 0.8, H * 0.06); ctx.fill(); ctx.beginPath(); ctx.roundRect(x - H * 0.28, y - H * 0.55, H * 0.24, H * 0.08, H * 0.04); ctx.roundRect(x - H * 0.28, y - H * 0.7, H * 0.08, H * 0.2, H * 0.04); ctx.roundRect(x + H * 0.04, y - H * 0.45, H * 0.24, H * 0.08, H * 0.04); ctx.roundRect(x + H * 0.2, y - H * 0.62, H * 0.08, H * 0.22, H * 0.04); ctx.fill(); break;
      case 'crossing': { ctx.fillStyle = hsla(0, 0, shade(60)); ctx.fillRect(x - H * 0.02, y - H * 1.1, H * 0.04, H * 1.1); ctx.strokeStyle = hsla(0, 0, shade(85)); ctx.lineWidth = h * 0.014; ctx.beginPath(); ctx.moveTo(x - H * 0.2, y - H * 1.25); ctx.lineTo(x + H * 0.2, y - H * 0.95); ctx.moveTo(x + H * 0.2, y - H * 1.25); ctx.lineTo(x - H * 0.2, y - H * 0.95); ctx.stroke(); for (const side of [-1, 1]) { const on = (side > 0) === (s.blink === 1); ctx.beginPath(); ctx.arc(x + side * H * 0.12, y - H * 0.8, H * 0.05, 0, TAU); ctx.fillStyle = hsla(0, 90, on ? 60 : 25, on ? 1 : 0.7); ctx.fill(); } break; }
      case 'portal': { const pw = h * 0.5; ctx.fillStyle = hsla(30, 8, shade(34)); ctx.fillRect(x, 0, pw, h); ctx.strokeStyle = hsla(30, 8, shade(20)); ctx.lineWidth = h * 0.004; for (let j = 0; j < 12; j++) { const yy = j * h / 11; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + pw, yy); ctx.moveTo(x + pw * ((j % 2) ? 0.5 : 0.25), yy); ctx.lineTo(x + pw * ((j % 2) ? 0.5 : 0.25), yy + h / 11); ctx.stroke(); } break; } // the tunnel mouth: a face of stone blocks the height of the window
      case 'overpass': { const top = (0.02 + s.jolt * 0.01) * h, depth = h * 0.36, span = h * 2.2; ctx.fillStyle = hsla(gh, 6, shade(18)); ctx.fillRect(x, top, span, depth); ctx.fillRect(x + span * 0.08, top, h * 0.1, h); ctx.fillRect(x + span * 0.86, top, h * 0.1, h); break; }
      default: whimsy(s, ctx, h, o, x, y, H, shade, night, lit, near);
    }
}

/** A nuke in the distance: the whole window flashes white, the carriage shudders, and a cloud starts rising beyond the far ridge. */
function nuke(s) {
  s.nukes.push({ x: 0.15 + rand(s) * (s.W - 0.3), age: 0, h: 0.8 + rand(s) * 0.5 });
  s.flash = 1.4; s.roughLeft = Math.max(s.roughLeft, 2.5); s.vy -= 0.5;
}

/** A bolt from the cloud base to the horizon, jagged by the state's generator; the flash comes with it. */
function lightning(s) {
  const x0 = 0.2 + rand(s) * (s.W - 0.4), pts = [[x0, 0.02]];
  let x = x0, y = 0.02; while (y < HORIZON) { y += 0.04 + rand(s) * 0.05; x += (rand(s) - 0.5) * 0.09; pts.push([x, y]); }
  s.boltPts = pts; s.bolt = 1; s.flash = Math.max(s.flash, 0.45); s.vy -= 0.15;
}

/** The whimsy pool, drawn: each thing in the same flat style as the scenery, a few of them moving with the beat or the clock. */
function whimsy(s, ctx, h, o, x, y, H, shade, night, lit, near) {
  const F = (c) => { ctx.fillStyle = c; }, R = (dx, dy, w, hh) => ctx.fillRect(x + dx * H, y - dy * H, w * H, hh * H), C = (dx, dy, r) => { ctx.beginPath(); ctx.arc(x + dx * H, y - dy * H, r * H, 0, TAU); ctx.fill(); };
  const E = (dx, dy, rx, ry) => { ctx.beginPath(); ctx.ellipse(x + dx * H, y - dy * H, rx * H, ry * H, 0, 0, TAU); ctx.fill(); }, T = (pts) => { ctx.beginPath(); pts.forEach(([dx, dy], i) => (i ? ctx.lineTo(x + dx * H, y - dy * H) : ctx.moveTo(x + dx * H, y - dy * H))); ctx.closePath(); ctx.fill(); };
  const L = (pts, wdt = 0.03) => { ctx.lineWidth = wdt * H; ctx.beginPath(); pts.forEach(([dx, dy], i) => (i ? ctx.lineTo(x + dx * H, y - dy * H) : ctx.moveTo(x + dx * H, y - dy * H))); ctx.stroke(); };
  const spin = s.t * s.cps * TAU * 0.5, dark = hsla(0, 0, shade(14)), skin = hsla(30, 50, shade(75)), wave = Math.sin(s.t * 5 + o.v * 7); // the wave: an arm up, swinging
  const arm = (from, to, wdt) => { ctx.strokeStyle = ctx.fillStyle; L([from, [to[0] + 0.12 * wave, to[1]]], wdt); };
  switch (o.kind) {
    case 'robot': F(hsla(200, 10, shade(60))); R(-0.16, 0.6, 0.32, 0.45); R(-0.12, 0.9, 0.24, 0.26); R(-0.14, 0.15, 0.1, 0.15); R(0.04, 0.15, 0.1, 0.15); R(-0.28, 0.55, 0.1, 0.3); arm([0.2, 0.55], [0.34, 0.95], 0.1); L([[0, 0.9], [0, 1.02]], 0.02); F(hsla(0, 90, 55)); C(0, 1.04, 0.03); F(hsla(180, 90, s.blink ? 70 : 40)); C(-0.05, 0.78, 0.03); C(0.05, 0.78, 0.03); break;
    case 'car': case 'police': F(o.kind === 'police' ? hsla(0, 0, shade(92)) : hsla(o.v * 360, 60, shade(50))); R(-0.45, 0.3, 0.9, 0.22); R(-0.25, 0.5, 0.5, 0.22); F(hsla(200, 40, shade(80), 0.8)); R(-0.2, 0.48, 0.18, 0.16); R(0.02, 0.48, 0.18, 0.16); F(dark); C(-0.28, 0.08, 0.1); C(0.28, 0.08, 0.1); if (o.kind === 'police') { F(hsla(s.blink ? 0 : 220, 90, 55)); R(-0.12, 0.56, 0.1, 0.06); F(hsla(s.blink ? 220 : 0, 90, 55)); R(0.02, 0.56, 0.1, 0.06); } break;
    case 'bus': F(hsla(45, 80, shade(55))); R(-0.7, 0.55, 1.4, 0.5); F(hsla(200, 40, shade(80), 0.8)); for (let i = 0; i < 5; i++) R(-0.62 + i * 0.26, 0.5, 0.2, 0.2); F(dark); C(-0.45, 0.06, 0.08); C(0.45, 0.06, 0.08); break;
    case 'tourist': F(hsla(o.v * 360, 70, shade(55))); R(-0.08, 0.45, 0.16, 0.3); if (o.v > 0.5) arm([-0.08, 0.42], [-0.2, 0.75], 0.05); F(skin); C(0, 0.55, 0.08); F(hsla(40, 60, shade(70))); R(-0.13, 0.62, 0.26, 0.04); R(-0.06, 0.66, 0.12, 0.06); F(dark); R(-0.06, 0.13, 0.05, 0.13); R(0.01, 0.13, 0.05, 0.13); R(0.06, 0.42, 0.1, 0.07); if (o.lit > 0.3 || (s.lit > 0.3 && o.v < 0.4)) { F(hsla(60, 100, 95, 0.9)); C(0.14, 0.46, 0.06); } break; // the camera flashes on a hit
    case 'spaceman': F(hsla(0, 0, shade(92))); R(-0.1, 0.5, 0.2, 0.35); C(0, 0.6, 0.11); R(-0.16, 0.45, 0.06, 0.2); arm([0.12, 0.48], [0.24, 0.85], 0.06); R(-0.08, 0.12, 0.07, 0.14); R(0.01, 0.12, 0.07, 0.14); F(hsla(40, 90, shade(60))); E(0, 0.6, 0.07, 0.05); F(hsla(0, 0, shade(70))); R(-0.14, 0.55, 0.06, 0.3); break;
    case 'alien': F(hsla(110, 70, shade(55))); R(-0.05, 0.4, 0.1, 0.25); E(0, 0.52, 0.12, 0.15); R(-0.04, 0.1, 0.03, 0.15); R(0.01, 0.1, 0.03, 0.15); R(-0.14, 0.32, 0.06, 0.03); arm([0.06, 0.34], [0.18, 0.62], 0.03); F(dark); E(-0.05, 0.54, 0.04, 0.06); E(0.05, 0.54, 0.04, 0.06); break;
    case 'dino': F(hsla(100, 45, shade(40))); E(0, 0.32, 0.45, 0.2); R(-0.35, 0.15, 0.1, 0.16); R(0.25, 0.15, 0.1, 0.16); ctx.strokeStyle = ctx.fillStyle; L([[0.35, 0.4], [0.6, 0.9], [0.7, 1.05]], 0.12); E(0.72, 1.06, 0.1, 0.06); L([[-0.4, 0.3], [-0.75, 0.15]], 0.08); break;
    case 'trex': F(hsla(30, 55, shade(40))); E(0, 0.45, 0.35, 0.2); E(0.35, 0.75, 0.2, 0.13); R(-0.15, 0.25, 0.12, 0.27); R(0.05, 0.25, 0.12, 0.27); R(0.3, 0.55, 0.08, 0.05); ctx.strokeStyle = ctx.fillStyle; L([[-0.3, 0.45], [-0.75, 0.6]], 0.1); F(hsla(0, 0, shade(95))); T([[0.4, 0.68], [0.46, 0.58], [0.5, 0.68]]); F(dark); C(0.42, 0.8, 0.02); break;
    case 'tent': F(hsla(o.v * 360, 60, shade(50))); T([[-0.45, 0], [0, 0.5], [0.45, 0]]); F(dark); T([[-0.1, 0], [0, 0.2], [0.1, 0]]); F(hsla(30, 30, shade(30))); R(0.55, 0.08, 0.2, 0.06); F(hsla(30, 100, 55, 0.9)); T([[0.58, 0.08], [0.65, 0.3 + 0.08 * Math.sin(s.t * 9 + o.v)], [0.72, 0.08]]); F(hsla(50, 100, 70, 0.9)); T([[0.61, 0.08], [0.65, 0.2 + 0.05 * Math.sin(s.t * 13)], [0.69, 0.08]]); break;
    case 'windmill': F(hsla(30, 20, shade(70))); T([[-0.18, 0], [-0.1, 0.9], [0.1, 0.9], [0.18, 0]]); ctx.strokeStyle = hsla(30, 20, shade(30)); for (let i = 0; i < 4; i++) { const a = spin * 0.6 + i * Math.PI / 2; L([[0, 0.9], [Math.cos(a) * 0.45, 0.9 + Math.sin(a) * 0.45]], 0.05); } break; // turning at the tempo
    case 'watertower': F(hsla(30, 20, shade(45))); ctx.strokeStyle = ctx.fillStyle; L([[-0.25, 0], [-0.15, 0.7]], 0.04); L([[0.25, 0], [0.15, 0.7]], 0.04); L([[-0.2, 0.3], [0.2, 0.3]], 0.03); F(hsla(200, 10, shade(65))); R(-0.3, 1.05, 0.6, 0.4); T([[-0.34, 1.05], [0, 1.25], [0.34, 1.05]]); break;
    case 'scarecrow': ctx.strokeStyle = hsla(30, 30, shade(35)); L([[0, 0], [0, 0.8]], 0.05); L([[-0.3, 0.6], [0.3, 0.6]], 0.05); F(hsla(45, 70, shade(65))); C(0, 0.85, 0.1); F(hsla(30, 40, shade(30))); R(-0.15, 0.94, 0.3, 0.03); R(-0.08, 1.02, 0.16, 0.08); F(hsla(o.v * 360, 50, shade(45))); R(-0.12, 0.7, 0.24, 0.28); break;
    case 'snail': F(hsla(45, 60, shade(55))); E(-0.1, 0.12, 0.3, 0.1); F(hsla(30, 60, shade(45))); C(0.05, 0.3, 0.25); F(hsla(30, 60, shade(30))); C(0.05, 0.3, 0.14); F(hsla(45, 60, shade(55))); C(0.05, 0.3, 0.06); ctx.strokeStyle = ctx.fillStyle; L([[0.3, 0.2], [0.42, 0.45]], 0.02); L([[0.36, 0.2], [0.5, 0.42]], 0.02); break;
    case 'gnome': F(hsla(220, 60, shade(45))); R(-0.12, 0.25, 0.24, 0.25); arm([0.12, 0.42], [0.24, 0.68], 0.05); F(skin); C(0, 0.55, 0.11); F(hsla(0, 0, shade(95))); T([[-0.1, 0.5], [0, 0.22], [0.1, 0.5]]); F(hsla(0, 80, shade(50))); T([[-0.14, 0.6], [0, 1.05], [0.14, 0.6]]); break;
    case 'mushrooms': for (const [dx, sc] of [[-0.25, 0.8], [0.1, 1.1], [0.38, 0.6]]) { F(hsla(40, 20, shade(88))); R(dx - 0.06 * sc, 0, 0.12 * sc, 0.3 * sc); F(hsla(0, 80, shade(50))); E(dx, 0.32 * sc, 0.25 * sc, 0.14 * sc); F(hsla(0, 0, shade(95))); C(dx - 0.1 * sc, 0.36 * sc, 0.035 * sc); C(dx + 0.08 * sc, 0.33 * sc, 0.03 * sc); } break;
    case 'phonebox': F(hsla(0, 80, shade(45))); R(-0.15, 0.85, 0.3, 0.85); R(-0.18, 0.92, 0.36, 0.07); F(hsla(200, 40, shade(80), 0.8)); R(-0.1, 0.75, 0.2, 0.4); break;
    case 'mailbox': F(hsla(30, 20, shade(35))); R(-0.03, 0.4, 0.06, 0.4); F(hsla(220, 70, shade(45))); R(-0.2, 0.7, 0.4, 0.3); E(0, 0.7, 0.2, 0.1); F(hsla(0, 80, 55)); R(0.16, 0.9, 0.03, 0.2); break;
    case 'donut': F(hsla(30, 20, shade(40))); R(-0.03, 0.8, 0.06, 0.8); ctx.strokeStyle = hsla(330, 80, shade(65)); ctx.lineWidth = H * 0.18; ctx.beginPath(); ctx.arc(x, y - H * 1.05, H * 0.3, 0, TAU); ctx.stroke(); ctx.strokeStyle = hsla(30, 60, shade(55)); ctx.lineWidth = H * 0.06; ctx.beginPath(); ctx.arc(x, y - H * 1.05, H * 0.36, 0, TAU); ctx.stroke(); break;
    case 'ferris': ctx.strokeStyle = hsla(0, 0, shade(55)); L([[0, 0], [-0.3, 1.5]], 0.05); L([[0, 0], [0.3, 1.5]], 0.05); ctx.strokeStyle = hsla(200, 60, shade(60)); ctx.lineWidth = H * 0.04; ctx.beginPath(); ctx.arc(x, y - H * 1.5, H * 0.75, 0, TAU); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = spin * 0.3 + i * Math.PI / 4, cx = Math.cos(a) * 0.75, cy = 1.5 + Math.sin(a) * 0.75; L([[0, 1.5], [cx, cy]], 0.025); F(hsla(i * 45, 80, shade(60))); R(cx - 0.08, cy - 0.06, 0.16, 0.12); } break; // turning at the tempo
    case 'castle': F(hsla(30, 10, shade(60))); R(-0.6, 0.6, 1.2, 0.6); R(-0.65, 1, 0.25, 1); R(0.4, 1, 0.25, 1); for (let i = 0; i < 6; i++) R(-0.58 + i * 0.2, 0.68, 0.1, 0.08); for (const dx of [-0.65, 0.4]) for (let i = 0; i < 3; i++) R(dx + i * 0.09, 1.07, 0.05, 0.07); F(dark); T([[-0.12, 0], [-0.12, 0.35], [0, 0.45], [0.12, 0.35], [0.12, 0]]); F(hsla(0, 80, 55)); T([[-0.52, 1], [-0.52, 1.2], [-0.35, 1.1]]); break;
    case 'bigfoot': case 'yeti': F(o.kind === 'yeti' ? hsla(0, 0, shade(90)) : hsla(25, 40, shade(28))); E(0, 0.5, 0.25, 0.35); C(0, 0.9, 0.14); R(-0.3, 0.7, 0.1, 0.4); arm([0.25, 0.7], [0.42, 1.05], 0.1); R(-0.15, 0.22, 0.12, 0.22); R(0.03, 0.22, 0.12, 0.22); F(o.kind === 'yeti' ? hsla(200, 20, shade(60)) : skin); E(0, 0.88, 0.07, 0.06); F(dark); C(-0.04, 0.92, 0.015); C(0.04, 0.92, 0.015); break;
    case 'stonehenge': F(hsla(30, 8, shade(50))); for (const dx of [-0.6, -0.2, 0.25]) { R(dx, 0.7, 0.13, 0.7); R(dx + 0.2, 0.7, 0.13, 0.7); R(dx - 0.02, 0.82, 0.37, 0.14); } break;
    case 'moai': F(hsla(30, 8, shade(45))); T([[-0.18, 0], [-0.2, 0.9], [-0.1, 1.05], [0.15, 1.05], [0.22, 0.9], [0.2, 0]]); F(hsla(30, 8, shade(35))); R(-0.1, 0.7, 0.05, 0.05); R(0.08, 0.7, 0.05, 0.05); R(-0.02, 0.35, 0.05, 0.35); R(-0.12, 0.28, 0.25, 0.04); break;
    case 'lighthouse': { F(hsla(0, 0, shade(92))); T([[-0.22, 0], [-0.14, 1.1], [0.14, 1.1], [0.22, 0]]); F(hsla(0, 80, shade(50))); R(-0.2, 0.35, 0.4, 0.14); R(-0.17, 0.75, 0.34, 0.12); F(hsla(0, 0, shade(20))); R(-0.16, 1.28, 0.32, 0.18); F(hsla(50, 100, 85)); R(-0.12, 1.26, 0.24, 0.14); const a = spin * 0.25; F(hsla(50, 100, 85, 0.35 * lit)); T([[0, 1.2], [Math.cos(a) * 2.5, 1.2 + Math.sin(a) * 0.6 + 0.15], [Math.cos(a) * 2.5, 1.2 + Math.sin(a) * 0.6 - 0.15]]); break; } // the beam sweeps
    case 'whale': F(hsla(210, 30, shade(30))); E(0, 0.15, 0.7, 0.22); T([[0.6, 0.2], [0.95, 0.5], [1, 0.1]]); F(hsla(200, 60, 90, 0.7)); { const sp = 0.5 + 0.5 * Math.sin(s.t * 2 + o.v * 5); T([[-0.3, 0.35], [-0.45, 0.35 + 0.5 * sp], [-0.3, 0.35 + 0.6 * sp], [-0.15, 0.35 + 0.5 * sp]]); } break;
    case 'shark': F(hsla(210, 15, shade(40))); T([[-0.25, 0], [0.05, 0.45], [0.25, 0]]); break;
    case 'pirate': F(hsla(30, 50, shade(28))); T([[-0.7, 0.3], [-0.6, 0], [0.6, 0], [0.75, 0.35]]); R(-0.03, 1.3, 0.06, 1); R(-0.4, 1, 0.06, 0.7); F(hsla(40, 20, shade(88))); T([[0, 1.25], [0.5, 0.9], [0, 0.4]]); T([[-0.37, 0.95], [-0.02, 0.7], [-0.37, 0.4]]); F(dark); R(-0.03, 1.3, 0.25, 0.12); F(hsla(0, 0, 95)); C(0.08, 1.24, 0.03); break;
    case 'periscope': F(hsla(0, 0, shade(35))); R(-0.03, 0.05, 0.06, 0.45); R(-0.03, 0.5, 0.15, 0.06); F(hsla(200, 60, 80)); C(0.12, 0.53, 0.025); break;
    case 'duck': F(hsla(50, 100, shade(60))); E(0, 0.3, 0.5, 0.3); C(0.3, 0.7, 0.24); F(hsla(30, 100, 55)); T([[0.5, 0.7], [0.75, 0.66], [0.5, 0.6]]); F(dark); C(0.38, 0.78, 0.03); break;
    case 'penguin': F(dark); E(0, 0.35, 0.16, 0.3); C(0, 0.65, 0.11); F(hsla(0, 0, shade(95))); E(0, 0.3, 0.1, 0.22); F(hsla(30, 100, 55)); T([[0.06, 0.65], [0.2, 0.62], [0.06, 0.6]]); R(-0.12, 0, 0.09, 0.03); R(0.03, 0, 0.09, 0.03); break;
    case 'pyramid': F(hsla(40, 45, shade(60))); T([[-1, 0], [0, 0.9], [1, 0]]); F(hsla(40, 45, shade(45))); T([[0, 0.9], [1, 0], [0.2, 0]]); break;
    case 'sphinx': { const B = 1.1; F(hsla(30, 40, shade(36))); E(-0.1 * B, 0.22 * B, 0.75 * B, 0.22 * B); R(0.3 * B, 0.75 * B, 0.32 * B, 0.55 * B); R(-0.85 * B, 0.15 * B, 0.4 * B, 0.15 * B); R(-0.85 * B, 0.28 * B, 0.12 * B, 0.13 * B); F(hsla(225, 45, shade(32))); T([[0.22 * B, 0.75 * B], [0.46 * B, 1.1 * B], [0.7 * B, 0.75 * B]]); R(0.2 * B, 0.8 * B, 0.52 * B, 0.06 * B); F(hsla(48, 80, shade(58))); R(0.2 * B, 0.76 * B, 0.52 * B, 0.03 * B); R(0.24 * B, 0.98 * B, 0.44 * B, 0.03 * B); F(hsla(30, 40, shade(48))); E(0.46 * B, 0.7 * B, 0.16 * B, 0.2 * B); F(dark); C(0.4 * B, 0.74 * B, 0.025 * B); C(0.52 * B, 0.74 * B, 0.025 * B); R(0.42 * B, 0.62 * B, 0.08 * B, 0.03 * B); break; } // darker stone than the sand it lies on, a blue and gold headdress, half again as big
    case 'camel': F(hsla(35, 50, shade(55))); E(0, 0.5, 0.38, 0.15); C(-0.14, 0.68, 0.12); C(0.12, 0.68, 0.12); R(-0.32, 0.4, 0.07, 0.4); R(-0.16, 0.4, 0.07, 0.4); R(0.08, 0.4, 0.07, 0.4); R(0.24, 0.4, 0.07, 0.4); ctx.strokeStyle = ctx.fillStyle; L([[0.34, 0.55], [0.55, 0.98]], 0.09); E(0.62, 1.02, 0.12, 0.07); F(dark); C(0.68, 1.05, 0.015); break;
    case 'snowman': F(hsla(0, 0, shade(95))); C(0, 0.25, 0.28); C(0, 0.65, 0.2); C(0, 0.95, 0.14); F(dark); R(-0.12, 1.08, 0.24, 0.03); R(-0.08, 1.22, 0.16, 0.14); C(-0.05, 0.98, 0.022); C(0.05, 0.98, 0.022); for (let i = -1; i <= 1; i++) C(i * 0.04, 0.89 + Math.abs(i) * 0.015, 0.012); C(0, 0.68, 0.02); C(0, 0.58, 0.02); F(hsla(0, 80, 50)); R(-0.13, 0.82, 0.26, 0.05); F(hsla(30, 100, 55)); T([[0, 0.955], [0.18, 0.935], [0, 0.915]]); break; // the hat's crown above the brim, coal eyes and a smile, a red scarf, the carrot between
    case 'cabin': F(hsla(30, 45, shade(35))); R(-0.45, 0.5, 0.9, 0.5); F(hsla(30, 45, shade(25))); T([[-0.5, 0.5], [0, 0.85], [0.5, 0.5]]); for (let i = 1; i < 5; i++) R(-0.45, 0.5 - i * 0.1, 0.9, 0.015); R(0.2, 0.85, 0.1, 0.25); F(hsla(45, 90, night ? 75 : shade(80))); R(-0.3, 0.4, 0.15, 0.15); F(hsla(0, 0, 60, 0.35)); for (let i = 0; i < 3; i++) C(0.25 + 0.05 * Math.sin(s.t + i), 1.15 + i * 0.12, 0.05 + i * 0.02); break;
    default: break;
  }
}

/** The sky's traffic, drawn in units of the height at (o.x, o.y), each thing at its own pace and with its own motion. */
function skyThing(s, ctx, h, o, X, Y, night, lit) {
  const x = X(o.x), y = Y(o.y), S = h * 0.05 * o.h, F = (c) => { ctx.fillStyle = c; }, R = (dx, dy, w, hh) => ctx.fillRect(x + dx * S, y - dy * S, w * S, hh * S);
  const C = (dx, dy, r) => { ctx.beginPath(); ctx.arc(x + dx * S, y - dy * S, r * S, 0, TAU); ctx.fill(); }, E = (dx, dy, rx, ry) => { ctx.beginPath(); ctx.ellipse(x + dx * S, y - dy * S, rx * S, ry * S, 0, 0, TAU); ctx.fill(); };
  const T = (pts) => { ctx.beginPath(); pts.forEach(([dx, dy], i) => (i ? ctx.lineTo(x + dx * S, y - dy * S) : ctx.moveTo(x + dx * S, y - dy * S))); ctx.closePath(); ctx.fill(); }, flap = Math.sin(s.t * 6 + o.v * 9), dark = hsla(0, 0, night ? 30 : 15);
  const mirror = ['dragon', 'helicopter', 'blimp'].includes(o.kind); // drawn facing right; everything in the sky flies left
  if (mirror) { ctx.save(); ctx.translate(2 * x, 0); ctx.scale(-1, 1); }
  switch (o.kind) {
    case 'plane': F(hsla(0, 0, night ? 40 : 92)); E(0, 0, 1.2, 0.3); T([[0.4, 0], [-0.4, 0], [-0.9, -0.9]]); T([[1.2, 0], [0.7, 0], [1.1, 0.7]]); break; // nose to the left, the way it flies
    case 'ufo': { const on = 1 - 0.7 * s.beatPhase; F(hsla(120, 80, 60, 0.18 * on * lit)); T([[-0.6, -0.3], [0.6, -0.3], [2.2, -(0.55 - o.y) * 20], [-2.2, -(0.55 - o.y) * 20]]); F(hsla(0, 0, night ? 45 : 70)); E(0, 0, 1.4, 0.4); F(hsla(180, 60, 80, 0.8)); E(0, 0.35, 0.6, 0.45); for (let i = -1; i <= 1; i++) { F(hsla((s.blink + i + 3) % 2 ? 0 : 60, 90, 60)); C(i * 0.8, -0.1, 0.12); } break; } // the beam pulses on the beat
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
