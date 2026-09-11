import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';

test('song() builds an arranged pattern with section metadata', async () => {
  const g = await ready;
  g.strudleLib.registerLayer('blip', (attrs, ctx) => g.s('hh*4'));
  const pat = g.song({ cps: .5, key: 'C:minor' }, [
    g.section('a', 2, { role: 'establish', blip: { density: .5 } }),
    g.section('b', 4, { blip: {} }),
  ]);
  assert.equal(typeof pat.queryArc, 'function');
  const m = pat.strudle;
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
  g.strudleLib.registerLayer('probe', (attrs, ctx) => { seen.push({ key: ctx.key, chords: ctx.chords }); return g.s('hh'); });
  const pat = g.song({ key: 'C:minor' }, [
    g.section('a', 1, { probe: {} }),
    g.section('b', 1, { key: 'Eb:major', progression: 'I V vi IV', probe: {} }),
  ]);
  assert.deepEqual(seen, [{ key: 'C:minor', chords: '<0 5>' }, { key: 'Eb:major', chords: '<0 4 5 3>' }]);
  assert.deepEqual(pat.strudle.sections.map((s) => [s.key, s.progression]), [['C:minor', 'i VI'], ['Eb:major', 'I V vi IV']]);
  assert.deepEqual(Object.keys(pat.strudle.sections[1].layers), ['probe'], 'key/progression are not layers');
});

test('a bad numeral names the section', async () => {
  const g = await ready;
  assert.throws(() => g.song({}, [g.section('drop', 1, { progression: 'i ix' })]), /section "drop".*numeral "ix"/);
});

test('section kit overrides the song kit', async () => {
  const g = await ready;
  const m = g.song({ kit: 'RolandTR909' }, [g.section('a', 1, { drums: {} }), g.section('b', 1, { kit: 'LinnLM2', drums: {} })]).strudle;
  const bank = (i) => m.sections[i].layers.drums.pattern.queryArc(0, 1)[0].value.bank;
  assert.equal(bank(0), 'RolandTR909');
  assert.equal(bank(1), 'LinnLM2');
});

test('ramp(a, b) resolves to a section-length saw; structural axes still refuse it', async () => {
  const g = await ready;
  g.strudleLib.registerLayer('probe', (attrs) => attrs.brightness);
  const p = g.song({}, [g.section('a', 4, { probe: { brightness: g.ramp(.2, .8) } })]).strudle.sections[0].layers.probe.pattern;
  const at = (t) => p.queryArc(t, t + 1e-3)[0].value;
  assert.ok(Math.abs(at(0) - .2) < .01 && Math.abs(at(3.99) - .8) < .02, `${at(0)} ${at(3.99)}`);
  assert.equal(String(g.ramp(.2, .8)), 'ramp(0.2, 0.8)');
  assert.throws(() => g.song({}, [g.section('a', 4, { drums: { density: g.ramp(0, 1) } })]), /structural/);
});

test('meter and bpm: grid follows the meter, cps follows bpm', async () => {
  const g = await ready;
  const m = g.song({ meter: '3/4', bpm: 120 }, [g.section('a', 1, { drums: {}, bass: {} })]).strudle;
  assert.ok(Math.abs(m.meta.cps - 120 / 60 / 3) < 1e-9);
  const kicks = m.sections[0].layers.drums.pattern.queryArc(0, 1).filter((h) => h.hasOnset() && h.value.s === 'bd').map((h) => h.whole.begin.valueOf());
  assert.deepEqual(kicks, [0, 1 / 3, 2 / 3]);
  assert.equal(m.sections[0].layers.bass.pattern.queryArc(0, 1).filter((h) => h.hasOnset()).length, 3);
  assert.throws(() => g.song({ bpm: 120, cps: .5 }, []), /bpm/);
  assert.throws(() => g.song({ meter: '5/3' }, []), /meter/);
  const s = g.song({}, [g.section('a', 1, { meter: '7/8', drums: {} })]).strudle.sections[0];
  assert.equal(s.grid.steps, 14);
});

test('a section with its own tempo plays its bars faster inside a shorter span', async () => {
  const g = await ready;
  g.strudleLib.registerLayer('tick', () => g.s('hh*4'));
  const pat = g.song({ cps: .5 }, [g.section('a', 2, { cps: 1, tick: {} }), g.section('b', 2, { tick: {} })]);
  const m = pat.strudle;
  assert.deepEqual(m.sections.map((s) => [s.cycles, s.span, s.offset]), [[2, 1, 0], [2, 2, 1]]);
  assert.equal(m.total, 3);
  const count = (a, b) => pat.queryArc(a, b).filter((h) => h.hasOnset()).length;
  assert.equal(count(0, 1), 8, 'two bars of a in one song cycle');
  assert.equal(count(1, 3), 8, 'two bars of b in two song cycles');
  const bpm = g.song({ bpm: 120 }, [g.section('a', 4, { bpm: 240, tick: {} })]).strudle.sections[0];
  assert.equal(bpm.span, 2);
  assert.throws(() => g.song({}, [g.section('a', 1, { bpm: 120, cps: .5, tick: {} })]), /bpm/);
  assert.throws(() => g.song({ cps: 0 }, [g.section('a', 1, { tick: {} })]), /tempo must be positive/);
  assert.throws(() => g.song({}, [g.section('a', 1, { cps: -1, tick: {} })]), /section "a".*tempo must be positive/);
});
