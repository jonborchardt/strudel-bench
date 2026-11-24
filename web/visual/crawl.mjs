// crawl: a 1993 demon shooter that nobody is playing. The song is the player: its form is the building (a sector
// per section, a door on every boundary, the wings getting worse as the song goes on, the warden in the loudest
// late section and the way out in the last), its drums are the trigger finger, and the level is finished when the
// song is. Chunky pixels on purpose: the whole picture is computed into a 200-line frame (crawl/render.mjs) from
// palette-indexed art painted in code (crawl/art.mjs, sprites.mjs, hud.mjs) and scaled up hard.
//
// The game is faked and the fake is a script (crawl/level.mjs): built once from the score and seed, it says where
// the walker is at every bar, when each creature wakes, is hit, attacks and dies, when each barrel goes up, when
// each pickup is reached, and so what the status bar reads. All of that is a function of the song's cycle, so a
// seek, a pin, a channel flipped to and an offline render agree on who is dead. The level is not state: the state
// holds the plan it was built from and builds it again when asked.
// The script supplies; the song decides. The script puts creatures, barrels and pickups in the walker's way and
// sets a last bar for each; what happens to them, and when, is the onsets (the rule is written out over step()):
// every kick is a shot and a dash, every snare destroys something, every hat is a step for everything alive, every
// melody note is something thrown at the walker, the bass is weight and the beat is the lamps. Each is large and
// happens every time, because a mapping that is small or only sometimes true cannot be seen. Between hits the
// walker and the creatures stand still (`br`, `bf`: the bars their feet have reached, behind the song's and caught
// up on a hit), so the corridor itself moves on the beat. With no kit, or the kit resting, struck sounds and the
// bass stand in for it, and with no drums at all the script's own beats fire. A seek keeps the script and loses
// what the onsets had taken early in the sector it lands in (`snap`, `hp`), which fall back to the scripted bar,
// never more than half a bar away; the flash, the dash and the things in the air are not rebuilt.
import { clamp, decay, seed, rand, paletteOf, DEFAULT_SLOT } from './kit.mjs';
import { prng } from '../../lib/random.mjs';
import { R, ix, paletteOf as paint, lightTable, glyph3 } from './crawl/art.mjs';
import { H, VH, makeFrame, renderView, renderSprites, rect, text, digits, blit, wash } from './crawl/render.mjs';
import { planOf, buildLevel, whereAt, viewAt, routeAt, foeAt, tallyAt, los, WEAPON_ORDER, FLY, HP } from './crawl/level.mjs';
import { FOES, PROPS } from './crawl/sprites.mjs';
import { WEAPONS, weaponFrame, faceOf, drawBar, REST, SHOT } from './crawl/hud.mjs';

// what is built from a state and never stored in it: the level and its light table, a frame buffer per width, the canvas the frame is put on
const LEVELS = new Map(), FRAMES = new Map();
let screen = null;
export function levelOf(st) {
  let lv = LEVELS.get(st.id);
  if (!lv) { lv = buildLevel(st.plan, st.seedN, prng); lv.lut = lightTable(paint(st.hueA, st.hueB)); if (LEVELS.size > 3) LEVELS.delete(LEVELS.keys().next().value); LEVELS.set(st.id, lv); }
  return lv;
}
export const MAX_BRASS = 12;
const GAP = { pistol: 0.14, shotgun: 0.26, rotary: 0.07, cannon: 0.4 }; // seconds between shots, at the fastest

function init(score, rng) {
  const pal = paletteOf(score, rng), plan = planOf(score), seedN = Math.floor(rng() * 1e6);
  const st = {
    plan, seedN, id: '', hueA: Math.round(pal.hue), hueB: Math.round(pal.line), name: String(score.name ?? ''), bpm: Math.round((score.cps ?? 0.5) * 240), beatSec: 1 / ((score.cps ?? 0.5) * 4),
    kit: Object.values(plan.cast).some((s) => s === 'impulse'), // has it a drum kit for the trigger; without one any struck sound and the bass pull it
    c: 0, t: 0, sec: -1, b: 0, beat: 0, beats: 4,
    bf: 0, // the bar the creatures' feet have got to: they stand and step on the hats, so it runs behind the song's bar and catches up on each one
    ya: 0, beatT: -9, // the way the walker faces: it turns in snaps, on the kick or the beat, and holds between them
    nade: null, // a grenade thrown on a backbeat that had nothing to destroy: { x0, y0, x1, y1, t }; the next backbeat is its bang
    // what the music did a moment ago, each its own pulse; the layers of the scene read different ones
    kick: 0, snare: 0, bass: 0, flick: 0, mel: 0, pad: 0, hop: 0, flash: 0, pain: 0, joy: 0, dim: 0, charge: 0, pulse: 0, down: 0,
    kickT: -9, hatT: -9, hatN: 0, drumT: -9, beatN: 0, shotT: -9, shots: 0, look: 0,
    brass: [], // spent cases and sparks, frame pixels
    bursts: [], // what a shot or a blast did where it landed: { x, y, z, t, big }
    lobs: [], // what the creatures throw, one to a note: { k, x, y, z, t, lat, hi }
    hp: {}, // hits left in a creature, by index, once a backbeat has landed on it
    snap: {}, // scripted moments an onset took early, by key (d3: creature 3's death, b2: barrel 2): the bar it happened
    stagK: -1, stagT: -9, atkK: -1, atkT: -9, gaze: 0, ga: 0, gx: 0, gy: 0,
  };
  st.id = JSON.stringify([seedN, st.hueA, st.hueB, plan]);
  seed(st, rng);
  return st;
}

const SNAP = 0.5; // bars before its scripted death in which any backbeat kills a creature outright
export const MAX_LOBS = 8, MAX_BURSTS = 6;
const eff = (st, key, m) => st.snap[key] ?? m;
/** Where a thrown grenade is: an arc down the corridor over a third of a second, then lying where it landed. */
const nadeAt = (st) => { const g = st.nade, t = clamp((st.t - g.t) / 0.34, 0, 1); return { x: g.x0 + (g.x1 - g.x0) * t, y: g.y0 + (g.y1 - g.y0) * t, z: 0.32 * (1 - t) + Math.sin(t * Math.PI) * 0.3 + 0.06 }; };
const dieOf = (st, sec, k) => eff(st, `d${k}`, sec.foes[k].die);
/** The creature being fought at bar `b`: of those awake, the one the script kills first; -1 when there is none. */
const foeNow = (sec, b, st) => { let k = -1; sec.foes.forEach((f, i) => { if (b > f.wake + 0.1 && b < dieOf(st, sec, i) && (k < 0 || f.die < sec.foes[k].die)) k = i; }); return k; };
/** Where a shot down the walker's line of sight lands: the first wall, a hand's width short of it. */
function aimPoint(sec, v) {
  const dx = Math.cos(v.a), dy = Math.sin(v.a); let d = 0.6;
  for (; d < 7; d += 0.2) if (sec.wall[Math.floor(v.y + dy * d) * sec.w + Math.floor(v.x + dx * d)] !== 0) break;
  return { x: v.x + dx * (d - 0.25), y: v.y + dy * (d - 0.25) };
}

// The rule of this world: every onset does one large thing, every time.
//   kick   the walker fires and dashes (it stands between kicks: the corridor itself moves on the beat)
//   snare  something is destroyed: the creature in front takes the hit and bursts, or a barrel goes up, or the wall does
//   hat    everything alive takes a step, together
//   note   a creature throws something at you, its height the note's
//   bass   weight: the weapon and every creature sink
//   beat   the lamps: one in four lit, the light running down the corridor a lamp a beat, the whole sector on the downbeat
function step(st, dt, events, clock) {
  const lv = levelOf(st), at = whereAt(st.plan, clock.cycle), sec = lv.sectors[at.i], b = at.b, W = sec.weapon, beat = st.beatSec;
  if (at.i !== st.sec || b < st.b - 0.5) { st.snap = {}; st.hp = {}; st.lobs = []; st.bursts = []; st.stagK = st.atkK = -1; st.gaze = 0; st.bf = b; st.nade = null; st.ya = viewAt(sec, b).a; } // another sector, or the song come round
  const from = at.i === st.sec && b >= st.b && b - st.b < 0.5 ? st.b : b; // a jump (a seek, the loop, a new sector) fires nothing it skipped
  if (clock.beat !== st.beat || at.i !== st.sec) { st.pulse = 1; st.beatT = st.t; st.beatN = Math.floor(b * clock.beats + 1e-6); if (clock.beat === 0) st.down = 1; } // the grid itself: the lamps keep it
  st.c = clock.cycle; st.t += dt; st.beat = clock.beat; st.beats = clock.beats;
  for (const k of ['flash', 'kick', 'snare', 'hop']) st[k] = decay(st[k], k === 'flash' ? 16 : 9, dt);
  st.bass = decay(st.bass, 4, dt); st.mel = decay(st.mel, 6, dt); st.flick = decay(st.flick, 12, dt); st.pain = decay(st.pain, 3.2, dt); st.joy = decay(st.joy, 1.6, dt); st.pad = decay(st.pad, 1.5, dt); st.gaze = decay(st.gaze, 1.1, dt);
  st.pulse = decay(st.pulse, 5, dt); st.down = decay(st.down, 3, dt);
  st.charge += ((clock.riser > 0 ? 1 : 0) - st.charge) * Math.min(1, dt * 3);
  for (const c of st.brass) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 520 * dt; c.life -= dt; }
  st.brass = st.brass.filter((c) => c.life > 0); st.bursts = st.bursts.filter((u) => st.t - u.t < 0.36); st.lobs = st.lobs.filter((u) => st.t - u.t < FLY * 4 * beat);
  st.dim += ((clock.dropout ? 5 : 0) - st.dim) * Math.min(1, dt * 4);
  const view = () => ({ ...viewAt(sec, b), a: st.ya });
  const burst = (x, y, z, big) => { if (st.bursts.length >= MAX_BURSTS) st.bursts.shift(); st.bursts.push({ x, y, z, t: st.t, big }); if (big) st.flash = Math.max(st.flash, 7); };
  const fire = (v, pan = 0.5, force = false) => {
    if (!force && st.t - st.shotT < GAP[W]) return false;
    st.shotT = st.t; st.shots++; st.flash = Math.max(st.flash, (W === 'pistol' ? 5 : W === 'rotary' ? 5 : 8) * (0.7 + 0.3 * v));
    if (W !== 'cannon' && st.brass.length < MAX_BRASS) { const side = pan < 0.4 ? -1 : 1; st.brass.push({ x: side * (10 + rand(st) * 6), y: -46 - rand(st) * 8, vx: side * (50 + rand(st) * 50), vy: -110 - rand(st) * 60, life: 0.6, big: W === 'shotgun' ? 1 : 0 }); }
    return true;
  };
  /** A shot lands: on the creature being fought, which flinches, or on whatever is behind where it would have stood. */
  const land = (big) => {
    const k = foeNow(sec, b, st);
    if (k >= 0) { const q = foeAt(sec.foes[k], b, dieOf(st, sec, k), undefined, st.bf); st.stagK = k; st.stagT = st.t; burst(q.x, q.y, FOES[sec.foes[k].kind].z + 0.5, big); return k; }
    if (!big) { const a = aimPoint(sec, view()); burst(a.x, a.y, 0.5, false); } return -1;
  };
  // the script, where no onset has taken its moment: with no drums at all the fight still happens, on the script's own beats
  const crossed = (x) => x > from && x <= b, silent = st.t - st.drumT > 2.5 * beat * 4;
  sec.foes.forEach((f, k) => {
    if (st.snap[`d${k}`] === undefined && crossed(f.die)) { fire(1, 0.5, true); burst(f.x1, f.y1, 0.5, true); st.joy = Math.max(st.joy, f.boss ? 1 : 0.5); }
    if (silent && f.hits.some((h) => crossed(h) && h < dieOf(st, sec, k))) { fire(1); land(false); }
  });
  sec.drums.forEach((d, j) => { if (st.snap[`b${j}`] === undefined && crossed(d.boom)) { if (d.shot) fire(1); st.flash = Math.max(st.flash, 8); } });
  for (const h of sec.hurts) if (crossed(h.b)) st.pain = 1;
  for (const e of events) {
    const slot = st.plan.cast?.[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', v = clamp(e.gain * e.velocity, 0.3, 1.2);
    const struck = (!st.kit || silent) && e.role !== 'grain' && slot !== 'impulse' && (e.kind === 'hit' || slot === 'ground' || ((e.kind === 'raw' || e.kind === 'pitched' || e.kind === 'sample') && v > 0.7)); // no kit, or the kit resting: what is struck, the bass and any accented note stand in for it
    const hat = !struck && (e.role === 'grain' || slot === 'grain'), drum = struck || (slot === 'impulse' && !hat), snare = drum && (e.role === 'impact' || (struck && v > 0.8)), kick = drum && !snare;
    if (kick) { // the walker fires and dashes; the cannon banks the kick instead and lets go on the backbeat
      if (!struck) st.drumT = st.t; st.kick = Math.max(st.kick, v); st.kickT = st.t;
      if (W === 'cannon' && st.t - st.shotT < 1.2) st.charge = Math.min(1, st.charge + 0.4); else if (fire(v, e.pan)) land(false);
    } else if (snare) { // something is destroyed, every time
      if (!struck) st.drumT = st.t; st.snare = Math.max(st.snare, v);
      fire(v, e.pan, true);
      const k = foeNow(sec, b, st), f = sec.foes[k], v0 = view();
      if (st.nade) { const g = nadeAt(st); burst(g.x, g.y, g.z, true); st.nade = null; } // the one in the air, wherever it has got to
      if (f) {
        land(true); st.hp[k] = (st.hp[k] ?? HP[f.kind]) - 1;
        if (!f.boss ? st.hp[k] <= 0 || b >= f.die - SNAP : b >= f.die - SNAP) { st.snap[`d${k}`] = b; st.joy = Math.max(st.joy, f.boss ? 1 : 0.5); } // its last hit, or its script nearly run: it goes down on this backbeat
      } else {
        // no creature: the nearest thing in sight that can be broken is, a barrel before a fitting; with nothing in sight
        // the walker throws a grenade down the corridor, and that is the next backbeat's bang. Nothing explodes that was not there to see.
        let pick = null, best = 9;
        const see = (x, y) => { const dd = Math.hypot(x - v0.x, y - v0.y); let da = Math.atan2(y - v0.y, x - v0.x) - v0.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; return dd > 0.9 && Math.abs(da) < 0.95 && los(sec, v0.x, v0.y, x, y) ? dd : 99; };
        sec.drums.forEach((d, i) => { if (b >= eff(st, `b${i}`, d.boom)) return; const dd = see(d.x, d.y); if (dd < best) { best = dd; pick = `b${i}`; } });
        if (!pick) sec.props.forEach((q, i) => { if (st.snap[`p${i}`] !== undefined || q.kind === 'gore' || q.kind === 'chain') return; const dd = see(q.x, q.y); if (dd < best) { best = dd; pick = `p${i}`; } });
        if (pick && best > 2.2) { st.snap[pick] = b; st.flash = Math.max(st.flash, 9); if (pick[0] === 'p') { const q = sec.props[+pick.slice(1)]; burst(q.x, q.y, 0.45, true); } }
        else if (!st.nade && !pick) { const a = aimPoint(sec, v0), d = Math.min(4, Math.hypot(a.x - v0.x, a.y - v0.y)); st.nade = { x0: v0.x, y0: v0.y, x1: v0.x + Math.cos(v0.a) * d, y1: v0.y + Math.sin(v0.a) * d, t: st.t }; }
      }
    } else if (hat) { // everything alive takes a step, together
      st.hatT = st.t; st.hatN++; st.hop = 1; st.flick = Math.max(st.flick, 0.6 * v);
      if (W === 'rotary' && fire(v, e.pan)) land(false);
      if (st.brass.length < MAX_BRASS && rand(st) < 0.3) st.brass.push({ x: (rand(st) - 0.5) * 260, y: -VH + 4 + rand(st) * 30, vx: (rand(st) - 0.5) * 30, vy: 10, life: 0.5, spark: 1 }); // a lamp spits
    }
    if (slot === 'ground') st.bass = Math.max(st.bass, v);
    if (slot === 'field') st.pad = Math.max(st.pad, v);
    if (slot === 'line' || slot === 'counter') st.look = e.pan < 0.45 ? -1 : e.pan > 0.55 ? 1 : (e.note ?? 60) % 3 - 1;
    if (slot === 'line') { // a note of the lead: the creature being fought throws one, lit as it throws, and how high it flies is the note
      st.mel = Math.max(st.mel, v);
      const k = foeNow(sec, b, st);
      if (k >= 0) {
        const f = sec.foes[k], q = foeAt(f, b, dieOf(st, sec, k), undefined, st.bf), hi = clamp(((e.note ?? 60) - 48) / 30, 0, 1);
        if (st.lobs.length >= MAX_LOBS) st.lobs.shift(); st.lobs.push({ k, x: q.x, y: q.y, z: FOES[f.kind].z + 0.5 * FOES[f.kind].s, t: st.t, lat: (hi - 0.5) * 2 * (st.lobs.length & 1 ? 1 : -1), hi });
        st.atkK = k; st.atkT = st.t;
      } else if (st.gaze < 0.5) { // nothing to fight: the note sends the eye to something worth looking at ahead
        const pr = routeAt(sec, b), near = sec.poi.filter((q) => { const d = Math.hypot(q.x - pr.x, q.y - pr.y); return d > 1.2 && d < 9 && Math.abs(Math.atan2(q.y - pr.y, q.x - pr.x) - pr.a) < 1.1; });
        if (near.length) { const q = near[Math.abs(Math.round(e.note ?? rand(st) * 12)) % near.length]; st.gx = q.x; st.gy = q.y; st.gaze = 1; }
      }
    }
  }
  // The creatures stand and step: they hold between hats and cover the ground they owe on each one (with no hats lately
  // they step on the kick, and with neither they just walk). The walker walks, but turns in snaps: it holds the way it
  // faces and swings to where it should be looking on each kick, or each beat when there is no kick.
  const chase = (cur, lastHit, window) => {
    const since = st.t - lastHit, rate = since < window ? 30 : since > 2.2 * beat ? 7 : 0.15, door = b < sec.tIn || b > sec.tOut - 0.3;
    return clamp(cur + (b - cur) * (1 - Math.exp(-(door ? Math.max(rate, 12) : rate) * dt)), b - 0.55, b);
  };
  if (st.nade) { const g = nadeAt(st), w = routeAt(sec, b); if (Math.hypot(g.x - w.x, g.y - w.y) < 1.8) st.nade = null; } // walked up to before a backbeat came: it was a dud
  st.bf = chase(st.bf, Math.max(st.hatT, st.t - st.hatT > 2 * beat ? st.kickT : -9), 0.3 * beat);
  for (const p of sec.picks) if (crossed(p.b)) st.joy = 1;
  const pr = routeAt(sec, b), target = foeNow(sec, b, st) >= 0;
  let want = 0; if (!target && st.gaze > 0.05) { let da = Math.atan2(st.gy - pr.y, st.gx - pr.x) - pr.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; want = clamp(da, -0.8, 0.8) * Math.min(1, st.gaze * 2) * 0.75; }
  st.ga += (want - st.ga) * Math.min(1, dt * 4);
  { // the snap: for a third of a beat after the kick (or the beat) the view swings hard to its target, then holds, drifting only enough not to be left behind
    const v = viewAt(sec, b), since = st.t - Math.max(st.kickT, st.beatT), door = b < sec.tIn || b > sec.tOut - 0.3;
    let da = v.a + (v.target ? 0 : st.ga) - st.ya; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    st.ya += da * (1 - Math.exp(-(door ? 14 : since < 0.32 * beat ? 30 : 0.8) * dt));
    if (Math.abs(da) > 0.75) st.ya += da - Math.sign(da) * 0.75; // never more than a glance behind the route
  }
  st.sec = at.i; st.b = b;
}

const big = (fb, lut, x, y, str, ramp, k = 3) => { for (const ch of String(str).toUpperCase()) { const g = glyph3(ch); for (let i = 0; i < 15; i++) if (g[i] === '1') { const gx = x + (i % 3) * k, gy = y + ((i / 3) | 0) * k; rect(fb, lut, gx + 1, gy + 1, k, k, ix(ramp, 0)); } for (let i = 0; i < 15; i++) if (g[i] === '1') { const gx = x + (i % 3) * k, gy = y + ((i / 3) | 0) * k; rect(fb, lut, gx, gy, k, k, ix(ramp, 5)); rect(fb, lut, gx, gy, k, 1, ix(ramp, 7)); } x += 4 * k; } return x; };
const bigW = (str, k = 3) => String(str).length * 4 * k - k;

/** Everything standing in the sector, as billboards: the script says who is where, and the last few onsets say what they are doing about it. */
function scene(sec, b, cam, st) {
  const out = [], tick = Math.floor(st.t * 8);
  sec.props.forEach((p, j) => { if (st.snap[`p${j}`] !== undefined) { out.push({ x: p.x, y: p.y, bmp: PROPS.wreck }); return; } const bmp = p.kind === 'torch' ? PROPS.torch[(st.hatN + (p.x | 0)) & 1] : PROPS[p.kind]; out.push({ x: p.x, y: p.y, bmp, tint: p.kind === 'torch' || p.kind === 'lamp' ? 5 - st.flick * 3 : p.kind === 'terminal' ? st.flick * 4 : 0 }); }); // flames and screens move with the hats
  if (st.nade) { const g = nadeAt(st); out.push({ x: g.x, y: g.y, z: g.z, bmp: PROPS.nade, tint: 4 }); }
  for (const p of sec.picks) if (b < p.b) out.push({ x: p.x, y: p.y, bmp: PROPS[p.kind], tint: 3 + st.pulse * 3, z: st.pulse * 0.08 }); // it jumps on the beat
  sec.drums.forEach((d, j) => {
    const boom = eff(st, `b${j}`, d.boom);
    if (b < boom) out.push({ x: d.x, y: d.y, bmp: d.shot && b > d.boom - 0.5 ? PROPS.drumHurt : PROPS.drum, z: st.hop * 0.02 });
    else { out.push({ x: d.x, y: d.y, bmp: PROPS.drumGone }); const k = Math.floor((b - boom) / 0.07); if (k < 4) out.push({ x: d.x + (cam.x - d.x) * 0.02, y: d.y + (cam.y - d.y) * 0.02, bmp: PROPS.boom[k], glow: true, s: 1.7 }); }
  });
  sec.foes.forEach((f, k) => {
    const die = dieOf(st, sec, k), stag = k === st.stagK && st.t - st.stagT < 0.13, thr = k === st.atkK && st.t - st.atkT < 0.14;
    const q = foeAt(f, b, die, undefined, st.bf, st.hatN), F = FOES[f.kind];
    if (q.alive && stag) q.pose = 'hit'; else if (q.alive && thr) q.pose = 'attack';
    if (q.alive && thr) out.push({ x: q.x + (cam.x - q.x) * 0.08, y: q.y + (cam.y - q.y) * 0.08, bmp: PROPS[F.shot === 'bolt' ? 'bolt' : 'fire'][tick & 1], z: F.z + 0.62 * F.s, glow: true, s: 1.5 }); // the note, in its hands, before it leaves them
    // every creature hops on the hat and sinks with the bass; each kind has one more thing of its own: the gnasher swells on the kick, the husk jolts on the snare, the drifter flares with the tune, the warden stamps on the kick
    let lift = q.alive ? F.z + (F.z ? Math.sin(b * Math.PI) * 0.05 : 0) + st.hop * 0.07 - st.bass * 0.05 : q.pose === 'dead' ? 0 : F.z * 0.4, s = F.s, tint = thr ? 6 : q.pose === 'attack' ? 3 : 0;
    if (q.alive) {
      if (f.kind === 'gnasher') s *= 1 + st.kick * 0.14; else if (f.kind === 'husk') lift += st.snare * 0.08;
      else if (f.kind === 'drifter') { s *= 1 + st.mel * 0.16; tint += st.mel * 4; } else { lift -= st.kick * 0.07; s *= 1 + st.bass * 0.05; tint += st.bass * 3; }
    }
    out.push({ x: q.x, y: q.y, bmp: F[q.pose], z: lift, s, tint, min: q.alive ? 7 : 4 });
    if (F.shot !== 'bullet') for (const a of f.attacks) if (b >= a && b < a + FLY && a < die) { const t = (b - a) / FLY; out.push({ x: q.x + (cam.x - q.x) * t, y: q.y + (cam.y - q.y) * t, bmp: PROPS[F.shot][tick & 1], z: F.z + 0.5 * F.s + (0.42 - F.z - 0.5 * F.s) * t, glow: true, s: f.boss ? 1.6 : 1 }); }
  });
  const fly = FLY * 4 * st.beatSec, rx = -Math.sin(cam.a), ry = Math.cos(cam.a);
  for (const u of st.lobs) { // thrown on a note: it comes past the walker's head, to one side, at the note's height
    const t = (st.t - u.t) / fly, tx = cam.x + rx * u.lat * 0.7, ty = cam.y + ry * u.lat * 0.7, kind = FOES[sec.foes[u.k]?.kind]?.shot === 'bolt' ? 'bolt' : 'fire';
    out.push({ x: u.x + (tx - u.x) * t, y: u.y + (ty - u.y) * t, bmp: PROPS[kind][tick & 1], z: u.z + (0.2 + u.hi * 0.55 - u.z) * t, glow: true, s: 1.3 });
  }
  for (const u of st.bursts) { const k = Math.floor((st.t - u.t) / (u.big ? 0.09 : 0.045)); if (u.big ? k < 4 : k < 3) out.push({ x: u.x + (cam.x - u.x) * 0.05, y: u.y + (cam.y - u.y) * 0.05, bmp: u.big ? PROPS.boom[k] : PROPS.puff[k], z: u.z - (u.big ? 0.22 : 0), glow: true, s: u.big ? 0.75 : 1.3 }); }
  return out;
}

/** The bar's numbers at bar `b`, moved for what an onset took early: a creature already down counts. */
function tallyNow(sec, b, st) {
  const t = { ...tallyAt(sec, b) };
  sec.foes.forEach((f, k) => { const d = st.snap[`d${k}`]; if (d !== undefined && b >= d && b < f.die) t.kills++; });
  return t;
}

const BOOST = new Float32Array(256); // light added to each lamp's pool this frame; 0 is the cells no lamp reaches
/** The frame for a state at `W` pixels wide: the frame buffer, painted. The page scales it up; a test reads it. */
export function frame(st, W = 356) {
  let fb = FRAMES.get(W); if (!fb) FRAMES.set(W, fb = makeFrame(W));
  const lv = levelOf(st), at = whereAt(st.plan, st.c), sec = lv.sectors[at.i], b = at.b, lut = lv.lut, tally = tallyNow(sec, b, st);
  const p = viewAt(sec, b), k = clamp(st.beatSec / 0.5, 0.6, 1.5), walk = clamp(p.v / 4, 0, 1);
  const dash = Math.exp(-(st.t - st.kickT) * 9), roll = Math.sin(Math.PI * 4 * b) * walk; // a foot to the beat as it walks, and a dip on the kick
  const age = st.t - st.shotT, W0 = WEAPONS[sec.weapon];
  let wf = weaponFrame(sec.weapon, age, st.shots, k);
  if (sec.weapon === 'cannon' && age > 0.5 && st.charge > 0.3) wf.frame = st.charge > 0.75 ? 2 : 1; // a riser, or kicks banked: the coils come up
  let boom = 0; sec.drums.forEach((d, j) => { const t0 = eff(st, `b${j}`, d.boom); if (b >= t0 && b < t0 + 0.2) boom = Math.max(boom, 9 * (1 - (b - t0) / 0.2)); });
  const side = roll * 0.03;
  const cam = { x: p.x - Math.sin(p.route) * side, y: p.y + Math.cos(p.route) * side, a: at.i === st.sec ? st.ya : p.a, eye: 0.5 + (Math.abs(roll) - 0.5) * 0.02 - dash * 0.02 - st.bass * 0.008, pitch: -Math.min(6, Math.exp(-age * 11) * W0.kick * 0.4) - st.kick * 1.5 + st.pain * 3 };
  // the lamps keep time: one pool in four is lit and the lit one runs down the corridor a lamp a beat; every pool lifts on the downbeat and dips between
  BOOST[0] = st.down * 1.5; for (let j = 1; j <= sec.lamps; j++) BOOST[j] = (((j - st.beatN) % 4) + 4) % 4 === 0 ? 1 + st.pulse * 4 : -2 + st.down * 2.5;
  const blast = sec.blast && b < 0.2 ? 7 * (1 - b / 0.2) : 0; // an impact on the bar line: the door does not slide, it is blown
  const dyn = { lut, boost: BOOST, flash: Math.max(st.flash, boom, blast), dim: st.dim - st.pad * 1.5, doors: new Map([[sec.door, clamp(b / (sec.blast ? 0.06 : 0.2), 0, 1)]]), t: st.t };
  renderView(fb, sec, cam, dyn);
  renderSprites(fb, sec, cam, dyn, scene(sec, b, cam, st));
  if (st.pain > 0.62) wash(fb, lut, ix(R.red, 2), 0.25); else if (st.joy > 0.93) wash(fb, lut, ix(R.yellow, 2), 0.25); // one pixel in four, for a tenth of a second: a sting, not a strobe
  // the weapon: lowered over the first beat of a sector whose weapon is new and raised over the second, thrown by the shot, leaned by the dash, sunk by the bass
  const prev = at.i > 0 ? lv.sectors[at.i - 1].weapon : null, swap = prev !== sec.weapon && b < 0.5 ? (b < 0.25 ? b / 0.25 : 1 - (b - 0.25) / 0.25) : 0;
  const shown = prev && prev !== sec.weapon && b < 0.25 ? prev : sec.weapon, G = WEAPONS[shown], bmp = shown === sec.weapon ? G.frames[wf.frame] : G.frames[0];
  const end = sec.last && b > sec.bars - sec.card ? clamp((b - (sec.bars - sec.card)) / 0.4, 0, 1) : 0;
  // Held with its tip three tenths of the view up; a shot throws it up to nearly half, which is when a little of the
  // wrist and forearm under it comes into the picture. It is painted from behind (hud.mjs), so nothing is scaled.
  const up = shown === sec.weapon ? Math.exp(-age * 7) * (SHOT - REST) * VH : 0;
  const wx = Math.round(W / 2 - bmp.ax + roll * 5), wy = Math.round(VH - REST * VH - G.top - up + (wf.frame >= 2 && sec.weapon === 'shotgun' ? -4 : 0) + st.bass * 4 + (swap + end) * 110);
  if (shown === sec.weapon && wf.flash >= 0) { const fl = W0.flash[wf.flash]; blit(fb, lut, fl, wx + W0.muzzle[0] - fl.ax, wy + W0.muzzle[1] - fl.ay, 15, VH); }
  blit(fb, lut, bmp, wx, wy, clamp(Math.round(7 + (sec.light[(p.y | 0) * sec.w + (p.x | 0)] ?? 8) * 0.45 + st.flash - st.dim), 3, 15), VH);
  for (const c of st.brass) { const x = Math.round(W / 2 + c.x), y = Math.round(VH + c.y); if (y < VH - 1 && y > 0) { if (c.spark) rect(fb, lut, x, y, 1, 2, ix(R.fire, c.life > 0.25 ? 7 : 4)); else { rect(fb, lut, x, y, c.big ? 3 : 2, c.big ? 2 : 1, ix(c.big ? R.red : R.yellow, 5)); rect(fb, lut, x, y, 1, c.big ? 2 : 1, ix(R.yellow, 7)); } } }
  if (end > 0) card(fb, lut, lv, st, sec, b);
  const mood = st.pain > 0.3 ? 'pain' : st.joy > 0.35 ? 'grin' : age < 0.5 && p.target ? 'angry' : p.target ? 'alert' : 'neutral';
  drawBar(fb, lut, { health: tally.health, armor: tally.armor, ammo: Math.max(1, tally.ammo - (st.shots % 7)), ammoName: W0.ammo, kills: tally.kills, keys: tally.keys, arms: tally.own, cur: WEAPON_ORDER.indexOf(sec.weapon) + 1, sector: at.i + 1, name: sec.name, beat: st.beat, beats: st.beats, bpm: st.bpm, face: faceOf(mood, mood === 'neutral' ? (Math.floor(st.t / 1.7) % 3 === 0 ? st.look : 0) : 0, tally.health) });
  return fb;
}

/** The end card: the level is done, and the numbers are the run's own, told off one to a beat. */
function card(fb, lut, lv, st, sec, b) {
  const W = fb.W, t0 = sec.bars - sec.card, since = b - t0, tally = tallyAt(sec, b), secs = st.plan.total / st.plan.cps;
  for (let y = 0; y < VH; y++) for (let x = 0; x < W; x++) if (((x + y) & 1) || since > 0.25) fb.px[y * W + x] = lut[(since > 0.25 ? 4 : 3) * 256 + ix(R.red, 1 + (((x >> 2) + (y >> 2)) & 1))];
  if (since < 0.25) return;
  big(fb, lut, Math.round((W - bigW('LEVEL COMPLETE', 4)) / 2), 14, 'LEVEL COMPLETE', R.red, 4);
  if (st.name) text(fb, lut, Math.round((W - st.name.length * 4) / 2), 40, st.name, ix(R.bone, 5));
  const rows = [['KILLS', `${tally.kills}/${lv.stats.foes}`], ['ITEMS', `${tally.items}/${lv.stats.things}`], ['SECTORS', `${lv.stats.sectors}`], ['TIME', `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`]];
  const per = Math.max(0.25, (sec.card - 0.75) / rows.length);
  rows.forEach(([k, v], i) => { if (since < 0.5 + i * per) return; const y = 56 + i * 24; big(fb, lut, Math.round(W / 2 - 100), y + 2, k, R.bone, 2); digits(fb, lut, Math.round(W / 2 + 100 - String(v).length * 12), y, v); });
}

function draw(st, ctx, w, h) {
  const W = clamp(Math.round((H * w) / h / 2) * 2, 320, 480), fb = frame(st, W);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (typeof OffscreenCanvas === 'undefined') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); return; } // Node: the frame is computed, there is nothing to put it on
  if (!screen || screen.W !== W) { const canvas = new OffscreenCanvas(W, H); screen = { W, canvas, ctx: canvas.getContext('2d') }; }
  screen.ctx.putImageData(new ImageData(fb.bytes, W, H), 0, 0);
  const smooth = ctx.imageSmoothingEnabled; // the stage's canvas is shared with whatever world plays next
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(screen.canvas, 0, 0, w, h);
  ctx.imageSmoothingEnabled = smooth;
}

export default { name: 'crawl', init, step, draw };
