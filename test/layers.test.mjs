import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';

const LAYERS = ['drums', 'bass', 'melody', 'pad'];
const meta = { cps: .5, key: 'C:minor', seed: 3, kit: 'RolandTR909' }, ctx = { ...meta, cycles: 4 };
const onsets = (p, cycles = 4) => p.queryArc(0, cycles).filter((h) => h.hasOnset());
const stripRandom = (h) => { const v = { ...h.value }; delete v.nudge; return v; };
const sig = (haps) => JSON.stringify(haps.map((h) => [h.whole.begin.valueOf(), h.whole.end.valueOf(), stripRandom(h)]));

test('every layer builds with no attrs', async () => {
  const g = await ready;
  for (const L of LAYERS) assert.ok(onsets(g[L]({}, ctx)).length > 0, L);
});

test('adapter at exactly 0.5 equals no adapter, for every cell', async () => {
  const g = await ready;
  for (const L of LAYERS) {
    const base = sig(onsets(g[L]({}, ctx)));
    for (const a of Object.keys(g.strudelLib.cells[L] ?? {})) {
      assert.equal(sig(onsets(g[L]({ [a]: .5 }, ctx))), base, `${L}.${a} at .5 must be a no-op`);
    }
  }
});

test('every cell moves something at 0 or at 1', async () => {
  const g = await ready;
  for (const L of LAYERS) for (const a of Object.keys(g.strudelLib.cells[L] ?? {})) {
    const mid = sig(onsets(g[L]({ [a]: .5 }, ctx)));
    const lo = sig(onsets(g[L]({ [a]: 0 }, ctx))), hi = sig(onsets(g[L]({ [a]: 1 }, ctx)));
    assert.ok(lo !== mid || hi !== mid, `${L}.${a} changes nothing at either end`);
  }
});

test('density is monotone non-decreasing in onset count', async () => {
  const g = await ready;
  for (const L of LAYERS) {
    const counts = [0, .25, .5, .75, 1].map((v) => onsets(g[L]({ density: v }, ctx)).length);
    for (let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i - 1], `${L} density ${counts}`);
    assert.ok(counts[4] > counts[0], `${L} density must change something`);
  }
});

test('drive never changes onset count', async () => {
  const g = await ready;
  for (const L of LAYERS) {
    if (!g.strudelLib.cells[L]?.drive) continue;
    const n = [0, .25, .5, .75, 1].map((v) => onsets(g[L]({ drive: v }, ctx)).length);
    assert.ok(n.every((x) => x === n[0]), `${L} drive counts ${n}`);
  }
});

test('groove never changes onset count', async () => {
  const g = await ready;
  for (const L of LAYERS) {
    if (!g.strudelLib.cells[L]?.groove) continue;
    const n = [0, .25, .5, .75, 1].map((v) => onsets(g[L]({ groove: v }, ctx)).length);
    assert.ok(n.every((x) => x === n[0]), `${L} groove counts ${n}`);
  }
});

// density 1 so every layer has material finer than a swing slice: quarter notes sit on slice starts and
// have nothing to swing, which is why the bass default (4/cycle) would not move here.
test('groove 1 displaces onsets relative to groove .5', async () => {
  const g = await ready;
  const at = (L, v) => onsets(g[L]({ density: 1, groove: v }, ctx)).map((h) => h.whole.begin.valueOf()).sort((a, b) => a - b);
  for (const L of LAYERS) {
    if (!g.strudelLib.cells[L]?.groove) continue;
    assert.notDeepEqual(at(L, 1), at(L, .5), `${L} groove 1 must move at least one onset`);
  }
});

test('higher articulation gives shorter sounding events', async () => {
  const g = await ready;
  const len = (p) => onsets(p).reduce((s, h) => s + h.duration.valueOf() * (h.value.clip ?? 1), 0);
  for (const L of LAYERS) {
    if (!g.strudelLib.cells[L]?.articulation) continue;
    const [lo, mid, hi] = [.1, .5, .9].map((v) => len(g[L]({ articulation: v }, ctx)));
    assert.ok(lo >= mid && mid > hi, `${L} articulation lengths ${[lo, mid, hi]}`);
  }
});

test('weight never raises register (mean note non-increasing)', async () => {
  const g = await ready;
  const meanNote = (p) => { const ns = onsets(p).map((h) => h.value.note).filter((n) => typeof n === 'number'); return ns.reduce((a, b) => a + b, 0) / ns.length; };
  for (const L of ['bass', 'pad']) {
    const m = [0, .5, 1].map((v) => meanNote(g[L]({ weight: v }, ctx)));
    assert.ok(m[0] >= m[1] && m[1] >= m[2], `${L} weight mean notes ${m}`);
  }
});

test('brightness and weight both act on the bass filter, neither overwrites the other', async () => {
  const g = await ready;
  const cutoff = (attrs) => onsets(g.bass(attrs, ctx))[0].value.cutoff;
  const both = cutoff({ brightness: .9, weight: .9 });
  assert.ok(both > cutoff({ brightness: .5, weight: .9 }), `brightness must still raise the cutoff under weight: ${both} vs ${cutoff({ brightness: .5, weight: .9 })}`);
  assert.ok(cutoff({ brightness: .9, weight: .5 }) > both, `weight must still lower the cutoff under brightness: ${cutoff({ brightness: .9, weight: .5 })} vs ${both}`);
});

test('drive below .5 moves onsets off the pulse without changing their number', async () => {
  const g = await ready;
  const at = (L, v) => onsets(g[L]({ drive: v }, ctx)).map((h) => h.whole.begin.valueOf()).sort((a, b) => a - b);
  for (const L of ['drums', 'bass']) {
    const base = at(L, .5), low = at(L, 0);
    assert.equal(low.length, base.length, `${L} drive 0 must keep the onset count`);
    assert.notDeepEqual(low, base, `${L} drive 0 must move onsets`);
  }
});

test('drums width keeps its baseline spread at .5 and widens from there', async () => {
  const g = await ready;
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const pans = (w) => Object.fromEntries(onsets(g.drums({ density: .75, width: w }, ctx)).map((h) => [h.value.s, h.value.pan]));
  const mid = pans(.5);
  assert.ok(near(mid.hh, .6), `hh pan at width .5 should be .6, got ${mid.hh}`);
  assert.ok(near(mid.oh, .4), `oh pan at width .5 should be .4, got ${mid.oh}`);
  for (const [s, p] of Object.entries(pans(0))) assert.ok(near(p, .5), `${s} pan at width 0 should be .5, got ${p}`);
  assert.ok(near(pans(1).hh, 1), `hh pan at width 1 should be 1, got ${pans(1).hh}`);
});

test('the articulation choke puts only the hats in a cut group', async () => {
  const g = await ready;
  const cuts = Object.fromEntries(onsets(g.drums({ density: .75, articulation: .9 }, ctx)).map((h) => [h.value.s, h.value.cut]));
  assert.equal(cuts.hh, 1, 'hh must choke');
  assert.equal(cuts.oh, 1, 'oh must choke');
  assert.equal(cuts.bd, undefined, 'bd must not be in a cut group');
  assert.equal(cuts.sd, undefined, 'sd must not be in a cut group');
});

test('drive 1 pulls the kick onto the pulse and leaves the snare on the backbeat', async () => {
  const g = await ready;
  const steps = (s) => [...new Set(onsets(g.drums({ drive: 1 }, ctx)).filter((h) => h.value.s === s)
    .map((h) => h.whole.begin.valueOf() % 1).sort((a, b) => a - b))];
  assert.deepEqual(steps('sd'), [.25, .75], 'snare must stay on the backbeat, not double the kick');
  assert.deepEqual(steps('bd'), [0, .25, .5, .75], 'kick must stay on the pulse');
});

test('structural axes reject signals', async () => {
  const g = await ready;
  assert.throws(() => onsets(g.drums({ density: g.saw }, ctx)), /structural/);
});

test('sound, sounds and level are material: defaults equal omission, values reach the events', async () => {
  const g = await ready;
  assert.equal(sig(onsets(g.bass({ sound: 'sawtooth', level: 1 }, ctx))), sig(onsets(g.bass({}, ctx))));
  assert.ok(onsets(g.bass({ sound: 'triangle' }, ctx)).every((h) => h.value.s === 'triangle'));
  assert.ok(onsets(g.melody({ sound: 'square' }, ctx)).every((h) => h.value.s === 'square'));
  assert.ok(onsets(g.pad({ sound: 'triangle' }, ctx)).every((h) => h.value.s === 'triangle'));
  const d = onsets(g.drums({ sounds: { sd: 'rim' } }, ctx));
  assert.ok(d.some((h) => h.value.s === 'rim') && !d.some((h) => h.value.s === 'sd') && d.some((h) => h.value.s === 'bd'));
  const base = onsets(g.pad({}, ctx))[0].value.gain, half = onsets(g.pad({ level: .5 }, ctx))[0].value.gain;
  assert.ok(Math.abs(half - base / 2) < 1e-9, `${half} vs ${base}`);
  assert.throws(() => g.drums({ sounds: { tom: 'lt' } }, ctx), /sounds/);
  assert.throws(() => g.bass({ level: 'loud' }, ctx), /level/);
  assert.throws(() => g.bass({ level: NaN }, ctx), /level/, 'NaN is not a level');
  assert.throws(() => g.fx({ riser: NaN }, ctx), /riser/, 'NaN is not a riser length');
});

test('fill adds a snare roll only in the last cycle, by request or before a climax', async () => {
  const g = await ready;
  const inCycle = (hs, c) => hs.filter((h) => Math.floor(h.whole.begin.valueOf()) === c).length;
  const base = onsets(g.drums({}, ctx)), filled = onsets(g.drums({ fill: true }, ctx));
  for (const c of [0, 1, 2]) assert.equal(inCycle(filled, c), inCycle(base, c), `cycle ${c}`);
  assert.equal(inCycle(filled, 3), inCycle(base, 3) + 8);
  const m = g.song({}, [g.section('a', 2, { drums: {} }), g.section('b', 2, { role: 'climax', drums: {} }), g.section('c', 2, { drums: { fill: false } })]).strudel;
  const n = (i) => onsets(m.sections[i].layers.drums.pattern, 2).length;
  const plain = onsets(g.drums({}, { ...ctx, cycles: 2 }), 2).length;
  assert.equal(n(0), plain + 8, 'a fills into the climax');
  assert.equal(n(1), plain, 'b has no climax after it');
  assert.equal(n(2), plain, 'fill: false wins');
});

test('pad arp spreads the chord into 8 notes per cycle; omitted equals baseline', async () => {
  const g = await ready;
  assert.equal(sig(onsets(g.pad({ arp: undefined }, ctx))), sig(onsets(g.pad({}, ctx))));
  const up = onsets(g.pad({ arp: 'up' }, ctx), 1);
  assert.equal(up.length, 8);
  const notes = up.map((h) => h.value.note);
  assert.ok(notes[0] < notes[1] && notes[1] < notes[2] && notes[3] === notes[0], notes.join());
  const down = onsets(g.pad({ arp: 'down' }, ctx), 1).map((h) => h.value.note);
  assert.ok(down[0] > down[1] && down[1] > down[2]);
  assert.equal(onsets(g.pad({ arp: '0 2' }, ctx), 1).length, 2);
  const ud = onsets(g.pad({ arp: 'updown' }, ctx), 1).map((h) => h.value.note);
  assert.ok(ud[0] < ud[1] && ud[1] < ud[2] && ud[3] === ud[1], `updown on a triad: ${ud.join()}`);
  assert.throws(() => g.pad({ arp: 'Up' }, ctx), /arp/);
  // a seventh chord's real voice count (4) can exceed plan.tones (3, the default); the named order must
  // still reach every voice, not just the first plan.tones of them.
  const cyc1 = (pat) => onsets(pat, 2).filter((h) => h.whole.begin.valueOf() >= 1).map((h) => h.value.note);
  const up7 = cyc1(g.song(meta, [g.section('_', 2, { progression: 'i V7', pad: { arp: 'up' } })]).strudel.sections[0].layers.pad.pattern);
  assert.equal(new Set(up7).size, 4, `V7 arp up should sound 4 distinct voices, got ${up7.join(',')}`);
  const down7 = cyc1(g.song(meta, [g.section('_', 2, { progression: 'i V7', pad: { arp: 'down' } })]).strudel.sections[0].layers.pad.pattern);
  assert.equal(down7[0], Math.max(...up7), 'down starts on the highest note');
});

test('bass and pad follow altered roots, sevenths and sub-cycle chords', async () => {
  const g = await ready;
  const build = (progression, layer, attrs = {}) => onsets(g.song(meta, [g.section('_', 2, { progression, [layer]: attrs })]).strudel.sections[0].layers[layer].pattern, 2);
  const bassPlain = build('i VI', 'bass'), bassFlat = build('i bVI', 'bass');
  const c1 = (hs) => hs.filter((h) => h.whole.begin.valueOf() >= 1).map((h) => h.value.note);
  assert.deepEqual(c1(bassFlat), c1(bassPlain).map((n) => n - 1));
  const roots = build('i [VI VII]', 'bass').filter((h) => h.whole.begin.valueOf() >= 1).map((h) => h.value.note);
  assert.ok(new Set(roots).size >= 2, 'two chords in cycle 1');
  assert.equal(c1(build('i V7', 'pad')).length, 4, 'V7 voices four tones at the default density');
  assert.equal(sig(build('i VI', 'pad')), sig(onsets(g.song(meta, [g.section('_', 2, { pad: {} })]).strudel.sections[0].layers.pad.pattern, 2)), 'explicit default equals default');
});

test('fx layer: silent by default; riser fills the last k cycles; impact hits the first downbeat', async () => {
  const g = await ready;
  const c = { ...ctx, cycles: 8 };
  assert.equal(onsets(g.fx({}, c), 8).length, 0);
  const r = onsets(g.fx({ riser: 2 }, c), 8);
  assert.equal(r.length, 16);
  assert.ok(r.every((h) => h.whole.begin.valueOf() >= 6 && h.value.s === 'white'));
  const lp = r.map((h) => h.value.cutoff); // .lpf() writes the hap's `cutoff` field, per Strudel's own control naming (see the bass brightness/weight test above)
  assert.ok(lp[0] < 800 && lp[15] > 6000 && lp[0] < lp[8], lp.join());
  assert.ok(r[0].value.gain < r[15].value.gain);
  const i = onsets(g.fx({ impact: true }, c), 8);
  assert.equal(i.length, 1);
  assert.equal(i[0].whole.begin.valueOf(), 0);
  assert.equal(i[0].value.s, 'bd');
  assert.equal(onsets(g.fx({ riser: true }, { ...ctx, cycles: 2 }), 2).length, 16, 'riser capped at the section length');
  const bright = onsets(g.fx({ riser: 2, brightness: 1 }, c), 8).map((h) => h.value.cutoff);
  assert.ok(bright[15] > lp[15]);
  for (const a of ['density', 'drive', 'variation', 'register']) assert.equal(g.strudelLib.cells.fx[a], undefined, `${a} has no fx cell`);
});

test('fx cells: 0.5 is a no-op and the ends move something, over a riser', async () => {
  const g = await ready;
  const c = { ...ctx, cycles: 8 };
  const base = sig(onsets(g.fx({ riser: 2 }, c), 8));
  for (const a of Object.keys(g.strudelLib.cells.fx)) {
    assert.equal(sig(onsets(g.fx({ riser: 2, [a]: .5 }, c), 8)), base, `fx.${a} at .5`);
    assert.ok(sig(onsets(g.fx({ riser: 2, [a]: 1 }, c), 8)) !== base || sig(onsets(g.fx({ riser: 2, [a]: 0 }, c), 8)) !== base, `fx.${a} moves`);
  }
});

test('melody follow transposes by the chord root; phrase lengthens the line', async () => {
  const g = await ready;
  const c1 = (p) => onsets(p, 2).filter((h) => h.whole.begin.valueOf() >= 1).map((h) => h.value.note);
  const c0 = (p) => onsets(p, 1).map((h) => h.value.note);
  const plain = g.melody({}, ctx), follow = g.melody({ follow: true }, ctx);
  assert.deepEqual(c0(follow), c0(plain), 'cycle 0 is degree i either way');
  // default progression is i VI: cycle 1 is a sixth up in scale steps
  assert.deepEqual(c1(follow).map((n, i) => n - c1(plain)[i]).every((d) => d === 8 || d === 9), true);
  const two = g.melody({ phrase: 2 }, ctx);
  assert.equal(onsets(two, 1).length, onsets(plain, 1).length);
  assert.notEqual(JSON.stringify(c1(two)), JSON.stringify(c0(two)), 'a 2-cycle phrase does not repeat after one cycle (pick another ctx.seed if this seed happens to)');
});

test('follow + phrase: the chord root still advances once per cycle', async () => {
  const g = await ready;
  const build = (melody) => g.song(meta, [g.section('_', 4, { progression: 'i VI III VII', melody })]).strudel.sections[0].layers.melody.pattern;
  const inCycle = (p, c) => onsets(p, 4).filter((h) => h.whole.begin.valueOf() >= c && h.whole.begin.valueOf() < c + 1).map((h) => h.value.note);
  const plain = build({ phrase: 2 }), follow = build({ follow: true, phrase: 2 });
  for (const [c, want] of [[1, [8, 9]], [2, [3, 4]]]) {
    const base = inCycle(plain, c);
    const diff = inCycle(follow, c).map((n, i) => n - base[i]);
    assert.ok(diff.length > 0 && diff.every((d) => want.includes(d)), `cycle ${c}: ${diff.join()}`);
  }
});

test('fractional section lengths: fill rolls into the real end, riser sounds, impact fires once', async () => {
  const g = await ready;
  const c = { ...ctx, cycles: 2.5 };
  const plain = onsets(g.drums({ fill: false }, c), 2.5).length;
  const roll = onsets(g.drums({ fill: true }, c), 2.5).filter((h) => h.whole.begin.valueOf() >= 2 && h.value.s === 'sd');
  assert.equal(onsets(g.drums({ fill: true }, c), 2.5).length - plain, 8, 'the roll adds 8 hits');
  assert.ok(roll.length >= 8, 'and they sit in the last half bar of a 2.5-bar section');
  const fx = onsets(g.fx({ riser: 1, impact: true }, c), 2.5);
  assert.ok(fx.filter((h) => h.value.s === 'white').every((h) => h.whole.begin.valueOf() >= 1.5) && fx.some((h) => h.value.s === 'white'), 'riser over the last bar');
  assert.equal(fx.filter((h) => h.value.s === 'bd').length, 1, 'one impact');
});

test('drive below .5 leaves the pulse in 6/8; arp follows the meter grid; drums.sound is refused', async () => {
  const g = await ready;
  const kicks = onsets(g.drums({ drive: 0 }, { ...ctx, meter: '6/8', cycles: 1 }), 1).filter((h) => h.value.s === 'bd');
  assert.ok(kicks.length > 0 && kicks.every((h) => (h.whole.begin.valueOf() * 12) % 2 !== 0), 'kicks off the beat');
  const arp = onsets(g.pad({ arp: 'up' }, { ...ctx, meter: '3/4', cycles: 1 }), 1).map((h) => h.whole.begin.valueOf() * 12);
  assert.ok(arp.length === 6 && arp.every(Number.isInteger), `arp on the 12-step grid: ${arp}`);
  assert.throws(() => g.drums({ sound: 'rim' }, ctx), /unknown key "sound"/);
  assert.throws(() => g.song({ bmp: 120 }, []), /unknown song key "bmp"/);
});

test('density does not invent a voice the template leaves out: heartbeat keeps its empty hat line at any density', async () => {
  const g = await ready;
  // density >= .8 fills hats to 16ths, which is right for a kit template and wrong for one whose hh line is empty
  // on purpose. a lub-dub is a body, not a kit: raising density must not hand it a hi-hat.
  for (const density of [.25, .5, .85, 1]) {
    const hits = onsets(g.drums({ template: 'heartbeat', density }, ctx)).map((h) => h.value.s);
    assert.deepEqual([...new Set(hits)], ['bd'], `heartbeat at density ${density}`);
  }
  // the guard is conditional, not a blanket removal: a template that does have hats still gets its 16ths
  const house = onsets(g.drums({ template: 'house', density: .85 }, ctx)).filter((h) => h.value.s === 'hh');
  assert.equal(house.length, 4 * 16, 'house at density .85 still fills 16th hats');
});

test('a sound list picks one name per hit, the same pick every time, and reaches every name over enough hits', async () => {
  const g = await ready;
  const { soundPat, soundNames } = await import('../lib/layers.mjs');
  assert.deepEqual(soundNames(['a', 'b']), ['a', 'b']); assert.deepEqual(soundNames({ a: 2, b: 1 }), ['a', 'b']); assert.deepEqual(soundNames('a'), ['a']);
  assert.equal(soundPat('piano'), 'piano', 'a string is untouched');
  assert.throws(() => soundPat([]), /list must hold sound names/);
  assert.throws(() => soundPat({ a: 0 }), /weights must be positive/);
  const names = (attrs, cycles = 8) => onsets(g.melody({ notes: '0 1 2 3 4 5 6 7', ...attrs }, { ...ctx, cycles }), cycles).map((h) => h.value.s);
  const a = names({ sound: ['piano', 'kalimba', 'marimba'] });
  assert.ok(a.every((s) => ['piano', 'kalimba', 'marimba'].includes(s)), `only listed names: ${a}`);
  assert.deepEqual(a, names({ sound: ['piano', 'kalimba', 'marimba'] }), 'deterministic');
  assert.ok(new Set(a).size === 3, `every name is reached over 64 hits: ${[...new Set(a)]}`);
  const w = names({ sound: { piano: 9, kalimba: 1 } });
  assert.ok(w.filter((s) => s === 'piano').length > w.filter((s) => s === 'kalimba').length, 'weights lean the pick');
  const m = names({ sound: g.mini('<piano kalimba>') }, 2);
  assert.deepEqual([...new Set(m.slice(0, 8))], ['piano']); assert.deepEqual([...new Set(m.slice(8))], ['kalimba'], 'a mini pattern alternates per bar');
  assert.ok(onsets(g.melody({ sound: ['sawtooth', 'square'] }, ctx)).every((h) => h.value.vib === 4), 'a list of synths still gets the synth vibrato');
  assert.ok(onsets(g.melody({ sound: ['sawtooth', 'piano'] }, ctx)).every((h) => h.value.vib === undefined), 'a list with a sample does not');
});

test('a drum voice can be a list; the kit applies only when every name is a kit voice', async () => {
  const g = await ready;
  const sd = (sounds) => onsets(g.drums({ density: .4, sounds }, { ...ctx, cycles: 8 }), 8).filter((h) => ['sd', 'rim', 'cp'].includes(h.value.s));
  const a = sd({ sd: ['sd', 'rim'] });
  assert.ok(a.length > 0 && a.every((h) => h.value.bank === 'RolandTR909'), 'both are kit voices in Node (hasSound is undefined there): banked');
  assert.ok(new Set(a.map((h) => h.value.s)).size === 2, 'both names play');
});

test('a written drum template: any voice, accents, euclid, two bars; the five stay density-gated, others always play', async () => {
  const g = await ready;
  const t = { bd: 'x...x...x...x...', sd: '3/8', rd: 'x.x.x.x.x.x.x.x.|X.x.x.x.X.x.x.x.', cb: 'o.......' };
  const hs = onsets(g.drums({ template: t, density: .3 }, { ...ctx, cycles: 2 }), 2);
  const of = (s) => hs.filter((h) => h.value.s === s);
  assert.equal(of('bd').length, 8); assert.equal(of('sd').length, 6, 'euclid 3/8 twice');
  assert.equal(of('rd').length, 16, 'two bars of ride, not gated by density'); assert.equal(of('cb').length, 4, 'cb is written, so it plays at density .3');
  assert.equal(of('hh').length, 0, 'no hh line written');
  const rdGain = (i) => of('rd')[i].value.gain ?? 1;
  assert.ok(Math.abs(rdGain(8) / rdGain(0) - 1.25) < 1e-6, 'the X in bar two is an accent');
  assert.ok(Math.abs((of('cb')[0].value.gain ?? 1) / rdGain(0) - 0.4) < 1e-6, 'o is a ghost');
  assert.ok(of('rd').every((h) => h.value.bank === 'RolandTR909'), 'written voices play through the kit in Node');
  assert.throws(() => g.drums({ template: { bd: 'x..q' } }, ctx), /unknown character/);
  assert.throws(() => g.drums({ template: 'nope' }, ctx), /unknown template/);
  assert.equal(onsets(g.drums({ template: t, density: .3, drive: .9 }, { ...ctx, cycles: 2 }), 2).length, hs.length, 'drive keeps the count on a written template');
});

test('fill: n rolls the last half bar of every nth bar; true still means the section end', async () => {
  const g = await ready;
  const rolls = (attrs, cycles) => onsets(g.drums({ density: .12, ...attrs }, { ...ctx, cycles }), cycles).filter((h) => h.value.s === 'sd').map((h) => Math.floor(h.whole.begin.valueOf()));
  assert.deepEqual([...new Set(rolls({ fill: 4 }, 8))], [3, 7], 'bars 4 and 8 (density .12 leaves no snare of its own)');
  assert.deepEqual([...new Set(rolls({ fill: true }, 8))], [7]);
  assert.throws(() => g.drums({ fill: 1 }, ctx), /fill must be/);
});
