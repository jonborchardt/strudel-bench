// web/visual/crawl.mjs: the shooter the song plays, on the same interface as the other worlds. What it must honour:
// injected randomness, deterministic plain state, and its own rule: where the walker is and who is dead are functions
// of the song's cycle (crawl/level.mjs is a script, not a simulation), so a seek lands in the same picture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import crawl, { frame, levelOf } from '../web/visual/crawl.mjs';
import { planOf, buildLevel, routeAt, viewAt, foeAt, tallyAt, whereAt, AIR, STAND } from '../web/visual/crawl/level.mjs';
import { T } from '../web/visual/crawl/art.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { prng } from '../lib/random.mjs';
import { streamOf, ctxStub, run, forbid, base, KICK } from './_visual.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'crawl' }, [
  g.section('intro', 4, { role: 'establish', pad: { space: .8 }, drums: { density: .3 } }),
  g.section('verse', 8, { role: 'develop', drums: { density: .6 }, bass: { density: .6 } }),
  g.section('drop', 8, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' } }),
  g.section('outro', 4, { role: 'release', pad: { space: .7 }, drums: { density: .3 } }),
]).strudel;
// a score by hand: [bars, energy, role] per section
const scoreOf = (rows, seed = 5) => { let at = 0; const sections = rows.map(([bars, energy, role = null, extra = {}], i) => { const s = { name: `s${i}`, bars, energy, role, at, until: at + bars, riser: 0, dropout: 0, impact: null, parts: { drums: { onsets: energy > 0.2 ? 8 : 0 }, [`p${i % 3}`]: { onsets: 2 } }, ...extra }; at += bars; return s; }); return { ...fallbackScore(0.5), seed, total: at, sections }; };
const levelFor = (score, seed = 5) => { const plan = planOf(score); return { plan, lv: buildLevel(plan, seed, prng) }; };
const isOpen = (sec, x, y) => sec.wall[Math.floor(y) * sec.w + Math.floor(x)] === 0;

test('crawl draws on a stub context with no randomness or clock of its own, and the frame is really painted', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ir = song(g), ctx = ctxStub(), p = run(crawl, ir, 20);
    assert.equal(composeVisual(ir).world, 'crawl');
    p.draw(ctx, 640, 360);
    assert.ok(ctx.calls.fillRect >= 1);
    const fb = frame(p.state, 356), seen = new Set(fb.px);
    assert.equal(fb.px.length, 356 * 200);
    assert.ok(seen.size > 60, `a textured frame, not a flat one (${seen.size} colours)`);
    assert.ok(fb.px.every((v) => v >>> 24 === 255), 'every pixel is opaque: the frame is whole');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state and the same pixels; another seed gives another level; the state is plain data', async () => {
  const g = await ready;
  const a = run(crawl, song(g), 12), b = run(crawl, song(g), 12), c = run(crawl, song(g, 4), 12);
  assert.equal(JSON.stringify(a.state), JSON.stringify(b.state));
  assert.notEqual(JSON.stringify(a.state), JSON.stringify(c.state));
  assert.deepEqual(JSON.parse(JSON.stringify(a.state)), a.state);
  const pa = frame(a.state, 356).px.slice(), pb = frame(JSON.parse(JSON.stringify(b.state)), 356).px;
  assert.deepEqual(pa, pb, 'a state that went through JSON draws the same frame: the level is rebuilt from the plan');
});

test('the route: a door on every boundary, reached before the bar line and stood at; the walker is never inside a wall', () => {
  const { lv } = levelFor(scoreOf([[8, .2, 'establish'], [16, .5, 'develop'], [4, .7], [16, 1, 'climax'], [8, .3, 'release']]));
  lv.sectors.forEach((sec, i) => {
    const start = routeAt(sec, 0);
    assert.ok(Math.abs(start.x - (AIR + 1 - STAND)) < 1e-9, 'every sector opens in the same place before its entry door');
    if (!sec.last) {
      const end = routeAt(sec, sec.bars), wait = routeAt(sec, sec.tOut);
      assert.ok(Math.abs(end.x - (sec.exit.x - STAND)) < 1e-9 && Math.abs(end.y - (sec.exit.y + 0.5)) < 1e-9, `sector ${i} ends at its exit door`);
      assert.deepEqual([wait.x, wait.y], [end.x, end.y], 'and is already standing there when the wait begins');
      assert.ok(Math.abs(end.a) < 1e-6, 'facing it squarely, as the next sector opens facing its own');
      assert.notEqual(sec.wall[sec.exit.y * sec.w + sec.exit.x], 0);
    }
    for (let b = 0; b <= sec.bars; b += 0.05) {
      const p = viewAt(sec, b), cell = Math.floor(p.y) * sec.w + Math.floor(p.x);
      assert.ok(isOpen(sec, p.x, p.y) || cell === sec.door, `sector ${i} (${sec.mods.map((m) => m.kind)}) bar ${b.toFixed(2)}: the walker is in open floor`);
    }
  });
});

test('the script: every creature wakes, is hit and dies in order inside its sector, where it can be seen; the dead stay dead', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { lv } = levelFor(scoreOf([[8, .3], [16, .6], [8, .8], [16, 1, 'climax'], [8, .3]], seed), seed);
    let foes = 0;
    for (const sec of lv.sectors) {
      for (const f of sec.foes) {
        foes++;
        assert.ok(f.wake < f.die && f.die <= sec.bars && f.wake >= 0, `${f.kind}: wake ${f.wake} die ${f.die}`);
        assert.ok(f.hits.every((h) => h > f.wake && h < f.die) && f.attacks.every((a) => a > f.wake && a < f.die));
        assert.ok(isOpen(sec, f.x0, f.y0) && isOpen(sec, f.x1, f.y1), `${f.kind} stands on open floor`);
        assert.equal(foeAt(f, f.die - 0.01).alive, true); assert.equal(foeAt(f, f.die + 0.01).alive, false);
        assert.equal(foeAt(f, sec.bars).pose, 'dead', 'a corpse stays where it fell');
        const p = routeAt(sec, f.die); assert.ok(Math.hypot(p.x - f.x1, p.y - f.y1) > 1.2, 'nothing dies under the walker\'s feet');
      }
      for (const d of sec.drums) assert.ok(d.boom > 0 && d.boom <= sec.bars && isOpen(sec, d.x, d.y));
      for (const p of sec.picks) { const at = routeAt(sec, p.b); assert.ok(Math.hypot(at.x - p.x, at.y - p.y) < 0.01, 'a pickup lies where the walker will be at its bar'); }
      let kills = 0; for (let b = 0; b <= sec.bars; b += 0.25) { const t = tallyAt(sec, b); assert.ok(t.kills >= kills && t.health > 0 && t.health <= 100 && t.ammo > 0); kills = t.kills; }
    }
    assert.ok(foes >= 4, `seed ${seed}: a level has a fight in it (${foes})`);
    assert.equal(tallyAt(lv.sectors.at(-1), 999).kills, lv.stats.foes, 'everything is dead by the end');
  }
});

test('a seek lands in the same picture: two states at the same cycle, their short-lived values set alike, draw the same frame', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir), played = run(crawl, ir, 30);
  const dropped = createPerformance(crawl, score); dropped.advance(30, 30 * score.cps); dropped.advance(30.05, 30.05 * score.cps);
  for (let t = 30 + 1 / 30; t <= 30.06; t += 1 / 30) played.advance(t, t * score.cps);
  const a = played.state, b = dropped.state;
  assert.equal(a.sec, b.sec);
  const rest = createPerformance(crawl, score).state; // every short-lived value as a fresh state has it; the walker standing where the script says
  const quiet = (st) => ({ ...rest, plan: st.plan, id: st.id, sec: a.sec, c: a.c, b: a.b, bf: a.b, ya: 0.2, t: 5 });
  assert.deepEqual(frame(quiet(a), 356).px.slice(), frame(quiet(b), 356).px.slice());
});

test('the trigger: a kick is a shot every time, into the wall when nothing stands there and into the creature when one does; the script fires by itself', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(crawl, score).state, lv = levelOf(st);
  const i = lv.sectors.findIndex((s) => s.foes.length), sec = lv.sectors[i], f = sec.foes[0], at0 = st.plan.sections[i].at, span = (st.plan.sections[i].until - at0) / sec.bars;
  const cyc = (b) => at0 + b * span;
  const calm = cyc(Math.max(0.05, f.wake - 0.4));
  crawl.step(st, STEP, [], clockOf(score, calm)); crawl.step(st, STEP, [KICK], clockOf(score, calm + 1e-4));
  assert.ok(st.shots === 1 && st.bursts.length === 1 && st.stagK === -1, 'nothing there: the wall takes it');
  const mid = cyc((f.wake + 0.2 + f.die) / 2), st1 = createPerformance(crawl, score).state;
  crawl.step(st1, STEP, [], clockOf(score, mid)); crawl.step(st1, STEP, [KICK], clockOf(score, mid + 1e-4));
  assert.ok(st1.shots === 1 && st1.flash > 0 && st1.stagK === 0, 'a creature there: it takes it and flinches');
  const SNARE = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }, empty = createPerformance(crawl, score).state;
  crawl.step(empty, STEP, [], clockOf(score, calm)); crawl.step(empty, STEP, [SNARE], clockOf(score, calm + 1e-4));
  assert.ok(empty.bursts.every((u) => !u.big) || Object.keys(empty.snap).length > 0 || empty.nade, 'a backbeat with no creature breaks something that was there to see, or throws a grenade: nothing explodes out of nothing');
  const fresh = createPerformance(crawl, score).state; let prev = null;
  for (let c = cyc(f.die - 0.2); c < cyc(f.die + 0.1); c += STEP * score.cps) { const k = clockOf(score, c, prev); crawl.step(fresh, STEP, [], k); prev = k; }
  assert.ok(fresh.shots >= 1, 'with no drums at all the killing shot is still fired');
});

test('any song is a whole run: one section, thirty, a silent one, a short one; the last sector ends at the switch with the card up, and the loop starts over', () => {
  const cases = { one: [[16, .6]], long: Array.from({ length: 30 }, (_, i) => [8 + (i % 3) * 4, (i % 5) / 4, i === 22 ? 'climax' : null]), quiet: [[8, 0], [8, 0], [8, 0.05]], short: [[1, .5], [2, .9], [1, .2]], dense: [[4, 1], [4, 1], [4, 1], [4, 1]] };
  for (const [name, rows] of Object.entries(cases)) {
    const score = scoreOf(rows), { plan, lv } = levelFor(score), last = lv.sectors.at(-1);
    assert.equal(lv.sectors.length, rows.length);
    assert.ok(last.last && last.card > 0 && last.mods.at(-1).kind === 'exit', `${name}: the way out is in the last sector`);
    const end = routeAt(last, last.bars), sw = last.wall.indexOf(T.sw);
    assert.ok(sw >= 0 && Math.abs(end.y - (Math.floor(sw / last.w) + 0.5)) < 1e-9 && (sw % last.w) - end.x < 2.5, `${name}: the run ends in front of the switch`);
    for (const sec of lv.sectors) for (let b = 0; b <= sec.bars; b += 0.1) { const p = viewAt(sec, b); assert.ok(isOpen(sec, p.x, p.y) || Math.floor(p.y) * sec.w + Math.floor(p.x) === sec.door, `${name}: in open floor`); }
    if (rows.length > 1 && name !== 'quiet') assert.ok(lv.sectors.some((s) => s.foes.some((f) => f.boss)), `${name}: a warden somewhere`);
    assert.ok(lv.sectors.reduce((n, s) => n + s.w * s.h, 0) < 400000, `${name}: the maps stay small`);
    const st = crawl.init(score, prng(1)); let prev = null;
    for (const c of [score.total - 0.01, 0.01]) { const k = clockOf(score, c, prev); crawl.step(st, STEP, [], k); prev = k; frame(st, 320); }
    assert.equal(st.sec, 0, `${name}: the song comes round and the run starts again`);
    assert.deepEqual(whereAt(plan, score.total + 0.5).i, whereAt(plan, 0.5).i);
  }
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(crawl, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.note('c4').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  p.draw(ctxStub(), 320, 180);
  assert.ok(frame(p.state, 320).px.some((v) => v !== 0xff000000));
});

test('a frame is cheap: the whole picture well inside a sixtieth of a second', async () => {
  const g = await ready;
  const p = run(crawl, song(g), 18); frame(p.state, 356);
  const t0 = process.hrtime.bigint(); for (let k = 0; k < 60; k++) frame(p.state, 356);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 60;
  assert.ok(ms < 12, `${ms.toFixed(2)} ms a frame`);
});

test('the drums do the killing: a backbeat in the last beats of a creature\'s script fells it there; without one the script does, and so does a seek', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(crawl, score).state, lv = levelOf(st);
  const i = lv.sectors.findIndex((s) => s.foes.length), sec = lv.sectors[i], f = sec.foes[0], at0 = st.plan.sections[i].at, span = (st.plan.sections[i].until - at0) / sec.bars;
  const b = f.die - 0.1, SNARE = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' };
  crawl.step(st, STEP, [], clockOf(score, at0 + (b - 0.01) * span)); crawl.step(st, STEP, [SNARE], clockOf(score, at0 + b * span));
  assert.ok(Math.abs(st.snap.d0 - b) < 1e-6 && st.stagK === 0, 'the snare is the kill');
  assert.equal(foeAt(f, b + 0.02, st.snap.d0).alive, false); assert.equal(foeAt(f, b + 0.02).alive, true, 'the script alone would have had it standing a moment longer');
  const dropped = createPerformance(crawl, score).state; crawl.step(dropped, STEP, [], clockOf(score, at0 + (f.die + 0.5) * span));
  assert.deepEqual(dropped.snap, {}, 'a state dropped past it knows only the script, and the script says dead');
  assert.equal(foeAt(f, f.die + 0.5).pose, 'dead');
});

test('height: a level has two-storey rooms and sunk floors, and they change the picture', () => {
  const { lv } = levelFor(scoreOf([[8, .3], [16, .6], [8, .8], [16, 1, 'climax'], [8, .3]], 2), 2);
  assert.ok(lv.sectors.some((s) => s.tall.some((v, k) => v === 2 && s.wall[k] === 0 && s.ceil[k] !== 0)), 'a roofed room two units high');
  assert.ok(lv.sectors.some((s) => s.tall.some((v, k) => v === 2 && s.wall[k] === 0 && s.ceil[k] === 0)), 'a room open to the sky');
  assert.ok(lv.sectors.some((s) => s.floor.some((v, k) => (v === T.toxic || v === T.lava) && s.wall[k] === 0)), 'a pit');
});

test('the song plays it: a melody note makes a creature throw, pickups lie on bar lines, the walker reaches a door as the bar turns, and with no kit a struck sound pulls the trigger', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(crawl, score).state, lv = levelOf(st);
  const i = lv.sectors.findIndex((s) => s.foes.some((f) => f.attacks.length)), sec = lv.sectors[i], k = sec.foes.findIndex((f) => f.attacks.length), f = sec.foes[k], a = f.attacks[0];
  const at0 = st.plan.sections[i].at, span = (st.plan.sections[i].until - at0) / sec.bars, NOTE = { ...base, layer: 'melody', kind: 'melody', note: 67 };
  crawl.step(st, STEP, [], clockOf(score, at0 + (a - 0.2) * span)); crawl.step(st, STEP, [NOTE], clockOf(score, at0 + (a - 0.15) * span));
  assert.ok(st.lobs.length === 1 && st.atkK >= 0, 'the note is a throw: one thing in the air, and the creature that threw it');
  for (const s of lv.sectors) {
    for (const p of s.picks) assert.ok(Number.isInteger(p.b), 'a pickup is taken on a downbeat');
    if (!s.last && !st.plan.sections[lv.sectors.indexOf(s)].dropout) assert.ok(s.bars - s.tOut <= 0.125 + 1e-9, 'no standing at a door: an eighth of a bar at most');
  }
  // a song with no drums: a struck sound fires when there is a target
  const bare = { ...score, cast: { keys: { kind: 'raw', slot: 'grain' } } }, st2 = createPerformance(crawl, bare).state, sec2 = levelOf(st2).sectors[i], f2 = sec2.foes[0];
  const mid = at0 + ((f2.wake + 0.3 + f2.die) / 2) * span, HIT = { ...base, layer: 'keys', kind: 'hit' };
  crawl.step(st2, STEP, [], clockOf(score, mid)); crawl.step(st2, STEP, [HIT], clockOf(score, mid + 1e-4));
  assert.equal(st2.shots, 1);
});
