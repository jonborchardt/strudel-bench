import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';

test('song() builds an arranged pattern with section metadata', async () => {
  const g = await ready;
  g.strudelLib.registerLayer('blip', (attrs, ctx) => g.s('hh*4'));
  const pat = g.song({ cps: .5, key: 'C:minor' }, [
    g.section('a', 2, { role: 'establish', blip: { density: .5 } }),
    g.section('b', 4, { blip: {} }),
  ]);
  assert.equal(typeof pat.queryArc, 'function');
  const m = pat.strudel;
  assert.equal(m.total, 6);
  assert.deepEqual(m.sections.map((s) => [s.name, s.cycles, s.offset, s.role]), [['a', 2, 0, 'establish'], ['b', 4, 2, undefined]]);
  assert.deepEqual(m.sections[0].layers.blip.attrs, { density: .5 });
  assert.equal(pat.queryArc(0, 6).filter((h) => h.hasOnset()).length, 24);
  assert.equal(pat.queryArc(6, 12).filter((h) => h.hasOnset()).length, 24, 'song loops');
});

test('unknown layer name throws with a useful message', async () => {
  const g = await ready;
  assert.throws(() => g.song({}, [g.section('a', 1, { nope: {} })]), /unknown layer "nope"/);
});

test('an unknown key on a layer throws, naming the layer and the section', async () => {
  const g = await ready;
  assert.throws(() => g.song({}, [g.section('a', 1, { pad: { arpp: 'up' } })]), /unknown key "arpp" on pad in section "a".*material: .*arp/s);
  assert.doesNotThrow(() => g.song({}, [g.section('a', 1, { pad: { arp: 'up', sound: 'sawtooth', level: .8, density: .6 } })]));
  // a layer registered without a materials list (tests, experiments) still accepts axis names
  assert.throws(() => g.song({}, [g.section('a', 1, { blip: { nope: 1 } })]), /unknown key "nope" on blip/);
});

test('section key and progression override the song key and reach the layer ctx', async () => {
  const g = await ready;
  const seen = [];
  g.strudelLib.registerLayer('probe', (attrs, ctx) => { seen.push({ key: ctx.key, chords: ctx.chords }); return g.s('hh'); });
  const pat = g.song({ key: 'C:minor' }, [
    g.section('a', 1, { probe: {} }),
    g.section('b', 1, { key: 'Eb:major', progression: 'I V vi IV', probe: {} }),
  ]);
  assert.deepEqual(seen, [{ key: 'C:minor', chords: '<0 5>' }, { key: 'Eb:major', chords: '<0 4 5 3>' }]);
  assert.deepEqual(pat.strudel.sections.map((s) => [s.key, s.progression]), [['C:minor', 'i VI'], ['Eb:major', 'I V vi IV']]);
  assert.deepEqual(Object.keys(pat.strudel.sections[1].layers), ['probe'], 'key/progression are not layers');
});

test('a bad numeral names the section', async () => {
  const g = await ready;
  assert.throws(() => g.song({}, [g.section('drop', 1, { progression: 'i ix' })]), /section "drop".*numeral "ix"/);
});

test('section kit overrides the song kit', async () => {
  const g = await ready;
  const m = g.song({ kit: 'RolandTR909' }, [g.section('a', 1, { drums: {} }), g.section('b', 1, { kit: 'LinnLM2', drums: {} })]).strudel;
  const bank = (i) => m.sections[i].layers.drums.pattern.queryArc(0, 1)[0].value.bank;
  assert.equal(bank(0), 'RolandTR909');
  assert.equal(bank(1), 'LinnLM2');
});

test('ramp(a, b) resolves to a section-length saw; structural axes still refuse it', async () => {
  const g = await ready;
  g.strudelLib.registerLayer('probe', (attrs) => attrs.brightness);
  const p = g.song({}, [g.section('a', 4, { probe: { brightness: g.ramp(.2, .8) } })]).strudel.sections[0].layers.probe.pattern;
  // probe returns the raw signal, not an instrument's control object, so .orbit() (applied to every layer's
  // pattern now) wraps it under `value` instead of merging into an existing object
  const at = (t) => p.queryArc(t, t + 1e-3)[0].value.value;
  assert.ok(Math.abs(at(0) - .2) < .01 && Math.abs(at(3.99) - .8) < .02, `${at(0)} ${at(3.99)}`);
  assert.equal(String(g.ramp(.2, .8)), 'ramp(0.2, 0.8)');
  assert.throws(() => g.song({}, [g.section('a', 4, { drums: { density: g.ramp(0, 1) } })]), /structural/);
});

test('movements: wobble, drift, pulse and swell resolve against the section like ramp, and print by name', async () => {
  const g = await ready;
  g.strudelLib.registerLayer('probe', (attrs) => attrs.brightness);
  const at = (p, t) => { const v = p.queryArc(t, t + 1e-3)[0].value; return typeof v === 'object' ? v.value : v; };
  const P = (v, cycles = 4) => g.song({}, [g.section('a', cycles, { probe: { brightness: v } })]).strudel.sections[0].layers.probe.pattern;
  const w = P(g.wobble(.2, .8, 2));
  assert.ok(Math.abs(at(w, 0) - .5) < .02 && Math.abs(at(w, .5) - .8) < .02 && Math.abs(at(w, 2) - .5) < .02, 'a sine over two bars');
  const s = P(g.swell(.2, .8));
  assert.ok(Math.abs(at(s, 0) - .2) < .02 && Math.abs(at(s, 2) - .8) < .02 && Math.abs(at(s, 3.99) - .2) < .03, 'starts low, peaks mid-section, returns');
  const p = P(g.pulse(.2, .8));
  assert.ok(Math.abs(at(p, 0.01) - .8) < 1e-9 && Math.abs(at(p, 0.13) - .2) < 1e-9, 'four dips a bar, from the high value');
  assert.ok(at(P(g.drift(.2, .8)), 1) >= .2 && at(P(g.drift(.2, .8)), 1) <= .8);
  assert.equal(String(g.wobble(.2, .8, 2)), 'wobble(0.2, 0.8, 2)'); assert.equal(String(g.swell(.2, .8)), 'swell(0.2, 0.8)');
  assert.throws(() => g.song({}, [g.section('a', 4, { drums: { density: g.wobble(0, 1) } })]), /structural/);
});

test('meter and bpm: grid follows the meter, cps follows bpm', async () => {
  const g = await ready;
  const m = g.song({ meter: '3/4', bpm: 120 }, [g.section('a', 1, { drums: {}, bass: {} })]).strudel;
  assert.ok(Math.abs(m.meta.cps - 120 / 60 / 3) < 1e-9);
  const kicks = m.sections[0].layers.drums.pattern.queryArc(0, 1).filter((h) => h.hasOnset() && h.value.s === 'bd').map((h) => h.whole.begin.valueOf());
  assert.deepEqual(kicks, [0, 1 / 3, 2 / 3]);
  assert.equal(m.sections[0].layers.bass.pattern.queryArc(0, 1).filter((h) => h.hasOnset()).length, 3);
  assert.throws(() => g.song({ bpm: 120, cps: .5 }, []), /bpm/);
  assert.throws(() => g.song({ meter: '5/3' }, []), /meter/);
  const s = g.song({}, [g.section('a', 1, { meter: '7/8', drums: {} })]).strudel.sections[0];
  assert.equal(s.grid.steps, 14);
});

test('a section with its own tempo plays its bars faster inside a shorter span', async () => {
  const g = await ready;
  g.strudelLib.registerLayer('tick', () => g.s('hh*4'));
  const pat = g.song({ cps: .5 }, [g.section('a', 2, { cps: 1, tick: {} }), g.section('b', 2, { tick: {} })]);
  const m = pat.strudel;
  assert.deepEqual(m.sections.map((s) => [s.cycles, s.span, s.offset]), [[2, 1, 0], [2, 2, 1]]);
  assert.equal(m.total, 3);
  const count = (a, b) => pat.queryArc(a, b).filter((h) => h.hasOnset()).length;
  assert.equal(count(0, 1), 8, 'two bars of a in one song cycle');
  assert.equal(count(1, 3), 8, 'two bars of b in two song cycles');
  const bpm = g.song({ bpm: 120 }, [g.section('a', 4, { bpm: 240, tick: {} })]).strudel.sections[0];
  assert.equal(bpm.span, 2);
  assert.throws(() => g.song({}, [g.section('a', 1, { bpm: 120, cps: .5, tick: {} })]), /bpm/);
  assert.throws(() => g.song({ cps: 0 }, [g.section('a', 1, { tick: {} })]), /tempo must be positive/);
  assert.throws(() => g.song({}, [g.section('a', 1, { cps: -1, tick: {} })]), /section "a".*tempo must be positive/);
});

test('drums2 is a second drums layer', async () => {
  await ready;
  const pat = song({ cps: .5 }, [section('a', 1, { drums: { density: .3 }, drums2: { density: .9, level: .5 } })]);
  const layers = pat.strudel.sections[0].layers;
  assert.deepEqual(Object.keys(layers), ['drums', 'drums2']);
  assert.ok(layers.drums2.pattern.queryArc(0, 1).length > layers.drums.pattern.queryArc(0, 1).length, 'each built with its own axes');
  assert.throws(() => song({}, [section('a', 1, { drumz: {} })]), /unknown layer "drumz"/);
});

test('a part can carry its own seed', async () => {
  await ready;
  const line = (spec) => JSON.stringify(song({ cps: .5, seed: 1 }, [section('a', 8, { melody: spec })]).strudel.sections[0].layers.melody.pattern.queryArc(0, 8).map((h) => [h.whole.begin.valueOf(), h.value.note ?? h.value.n]));
  assert.equal(line({ density: .8 }), line({ density: .8, seed: 1 }), 'the song seed is the default');
  assert.notEqual(line({ density: .8 }), line({ density: .8, seed: 7 }), 'another seed, another line');
});

test('every part plays on its own orbit, numbered by its place in the section, so effects do not share one bus', async () => {
  await ready;
  const m = song({ cps: .5 }, [section('a', 1, { drums: {}, pad: { space: .9 }, pad2: { space: .2 } })]).strudel;
  assert.deepEqual(Object.entries(m.sections[0].layers).map(([k, l]) => [k, l.orbit]), [['drums', 1], ['pad', 2], ['pad2', 3]]);
  for (const [k, l] of Object.entries(m.sections[0].layers)) assert.ok(l.pattern.queryArc(0, 1).every((h) => h.value.orbit === l.orbit), `${k} haps carry orbit ${l.orbit}`);
});

test('duck: the named part carries duckorbit for every part that names it; the pad stops faking its duck', async () => {
  await ready;
  const m = song({ cps: .5 }, [section('a', 1, { drums: {}, pad: { duck: 'drums', duckDepth: .8, drive: .9 }, bass: { duck: 'drums' } })]).strudel.sections[0].layers;
  const d = m.drums.pattern.queryArc(0, 1)[0].value;
  assert.deepEqual(d.duckorbit, [m.pad.orbit, m.bass.orbit]); assert.deepEqual(d.duckdepth, [.8, .5], 'a depth per target, in step with duckorbit (bass wrote none: the default)');
  assert.ok(m.pad.pattern.queryArc(0, 1).every((h) => h.value.gain === undefined || h.value.gain >= .45), 'no square-wave dip under a real duck');
  assert.throws(() => song({}, [section('a', 1, { pad: { duck: 'drums' } })]), /duck: no part "drums" in section "a"/);
  assert.throws(() => song({}, [section('a', 1, { pad: { duck: 'pad' } })]), /cannot duck itself/);
  assert.throws(() => song({}, [section('a', 1, { drums: {}, pad: { duck: 'drums', duckDepth: 2 } })]), /duckDepth/);
});

test('dropout silences every part but fx for the last n bars; sweep low-passes them over the last n bars', async () => {
  await ready;
  const m = song({ cps: .5 }, [section('a', 4, { dropout: 1, drums: { density: .7 }, pad: {}, fx: { riser: 2 } })]).strudel.sections[0];
  const last = (l) => m.layers[l].pattern.queryArc(3, 4).filter((h) => h.hasOnset()).length;
  assert.equal(last('drums'), 0); assert.equal(last('pad'), 0); assert.ok(last('fx') > 0, 'the riser keeps going');
  assert.ok(m.layers.drums.pattern.queryArc(0, 3).filter((h) => h.hasOnset()).length > 0);
  const s = song({ cps: .5 }, [section('a', 4, { sweep: 2, drums: { density: .7 } })]).strudel.sections[0].layers.drums.pattern;
  const cut = (t) => s.queryArc(t, t + .01)[0].value.cutoff;
  assert.equal(cut(0), undefined, 'no filter in the head'); assert.ok(cut(2.01) > 7000 && cut(3.9) < 1000, 'sweeping down through the tail (8000 -> 150 over two bars)');
  const dark = song({ cps: .5 }, [section('a', 4, { sweep: 2, drums: { density: .7, brightness: .1 } })]).strudel.sections[0].layers.drums.pattern;
  const own = dark.queryArc(0, .01)[0].value.cutoff;
  assert.ok(own < 2000 && dark.queryArc(2.01, 2.02)[0].value.cutoff === own, 'a part already darker than the sweep keeps its own cutoff at the sweep start'); assert.ok(dark.queryArc(3.9, 3.91)[0].value.cutoff < own, 'and closes further as the sweep passes it');
  assert.throws(() => song({}, [section('a', 4, { dropout: 5, drums: {} })]), /dropout/);
});
