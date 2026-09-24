import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ready } from './_scope.mjs';

const SRC = `song({ cps: .5 }, [
  section('verse', 8, { role: 'develop',
    drums: { density: .6, groove: .6 },
    melody: { density: .5, brightness: saw.range(.3, .7).slow(8) },
  }),
  section('drop', 8, {
    drums:  { density: .9 },
  }),
])`;

test('locate finds sections, layers and numeric axes', async () => {
  await ready;
  const { locate } = await import('../lib/resolve.mjs');
  const m = locate(SRC);
  assert.deepEqual(m.sections.map((s) => s.name), ['verse', 'drop']);
  assert.equal(m.sections[0].layers.drums.axes.density.value, .6);
  assert.equal(m.sections[0].layers.melody.axes.brightness.value, 'expr');
});

test('planEdits rewrites numbers, inserts missing axes, refuses expressions, preserves formatting', async () => {
  await ready;
  const { planEdits, applyEdits } = await import('../lib/resolve.mjs');
  const { edits, refused, report } = planEdits(SRC, 'verse', '*', 'much darker');
  const out = applyEdits(SRC, edits);
  // dark = brightness -0.30, register -0.10; "much" x2 -> brightness -0.60, register -0.20.
  // drums: brightness inserted at 0.5 - .6 = -.1 -> clamped to 0 (saturated); register skipped (no adapter on drums).
  assert.match(out, /drums: \{ density: \.6, groove: \.6, brightness: 0 \}/);
  // melody: brightness refused (signal); register inserted at 0.5 - .2 = .3.
  assert.match(out, /melody: \{ density: \.5, brightness: saw\.range\(\.3, \.7\)\.slow\(8\), register: \.3 \}/);
  assert.ok(refused.some((r) => r.layer === 'melody' && r.axis === 'brightness'));
  assert.ok(out.includes("section('drop', 8, {\n    drums:  { density: .9 },"), 'other section untouched');
  assert.ok(report.some((r) => r.saturated), 'reports saturation');
});

test('a layer built with spread is refused, not silently baselined', async () => {
  await ready;
  const { planEdits } = await import('../lib/resolve.mjs');
  const src = `const base = { density: .8, weight: .7 };
song({ cps: .5 }, [
  section('verse', 8, { drums: { ...base, brightness: .25 } }),
])`;
  const plan = planEdits(src, 'verse', 'drums', 'punchier');
  assert.ok(plan.refused.some((r) => r.layer === 'drums' && /uses spread \(\.\.\.base\)/.test(r.reason) && /by hand/.test(r.reason)), JSON.stringify(plan.refused));
  assert.deepEqual(plan.edits, []);
  assert.deepEqual(plan.report, []);
});

test('a layer that is not an object literal still reaches the mix card, and an edit wraps it in one', async () => {
  await ready;
  const { locate, setAxis, setMaterial, removeLayer } = await import('../lib/resolve.mjs');
  const src = `const pad = { density: .4 }, bed = { level: 1 };
const pick = (lvl) => ({ level: lvl });
song({ cps: .5 }, [
  section('verse', 8, {
    drums: { density: .6 },
    pad,
    raw:  bed,
    raw2: pick(.7),
  }),
])`;
  const layers = locate(src).sections[0].layers;
  // the bug: these three were skipped outright, so the part vanished from the knobs
  assert.deepEqual(Object.keys(layers), ['drums', 'pad', 'raw', 'raw2']);
  assert.equal(layers.drums.wrap, null);
  for (const [l, text] of [['pad', 'pad'], ['raw', 'bed'], ['raw2', 'pick(.7)']]) {
    assert.ok(layers[l].wrap, `${l} should carry a wrap`);
    assert.equal(layers[l].spread, text);   // its values live in the evaluated song, as a spread's do
    assert.deepEqual(layers[l].axes, {});
  }

  // an axis edit wraps the whole value; shorthand keeps its key
  const one = setAxis(src, 'verse', 'pad', 'brightness', .7);
  assert.match(one, /pad: \{ \.\.\.pad, brightness: \.7 \}/);
  assert.equal(locate(one).sections[0].layers.pad.axes.brightness.value, .7);
  assert.match(setAxis(src, 'verse', 'raw', 'space', .3), /raw:  \{ \.\.\.bed, space: \.3 \}/);
  assert.match(setAxis(src, 'verse', 'raw2', 'width', .4), /raw2: \{ \.\.\.pick\(\.7\), width: \.4 \}/);

  // a second edit lands inside the object the first one made, not in another wrapper
  const twice = setAxis(one, 'verse', 'pad', 'space', .2);
  assert.match(twice, /pad: \{ \.\.\.pad, brightness: \.7, space: \.2 \}/);
  assert.ok(!/\.\.\.\{/.test(twice), twice);

  // materials go the same way, and removing one of these layers still cuts the whole property
  assert.match(setMaterial(src, 'verse', 'raw', 'sound', "'sawtooth'"), /raw:  \{ \.\.\.bed, sound: 'sawtooth' \}/);
  assert.deepEqual(Object.keys(locate(removeLayer(src, 'verse', 'pad')).sections[0].layers), ['drums', 'raw', 'raw2']);
});

test('locate refuses a non-song file', async () => {
  await ready;
  const { locate } = await import('../lib/resolve.mjs');
  assert.throws(() => locate('note("c3")'), /not a song\(\) file/);
});

test('harmony words write key and progression on the section, once', async () => {
  await ready;
  const { planEdits, applyEdits } = await import('../lib/resolve.mjs');
  const src = `song({ cps: .5, key: 'C:minor' }, [
  section('drop', 8, { role: 'climax',
    drums: { density: .9 },
  }),
])`;
  const plan = planEdits(src, 'drop', 'drums', 'happy, relative major, pop');
  const out = applyEdits(src, plan.edits);
  assert.ok(out.includes("section('drop', 8, { role: 'climax', key: 'Eb:major', progression: 'I V vi IV',\n    drums:"), out);
  assert.ok(/drums: \{ density: \.9, brightness: \.7/.test(out), 'axis edit still applied');
  assert.deepEqual(plan.harmonyReport.map((r) => [r.field, r.from, r.to]), [['key', 'C:minor', 'Eb:major'], ['progression', 'i VI', 'I V vi IV']]);
  assert.match(plan.harmonyReport[1].describe, /Eb Bb Cm Ab/);
  assert.equal(plan.harmonyNotice, true);
  // idempotent: second run finds nothing to change
  const again = planEdits(out, 'drop', '*', 'relative major, pop');
  assert.deepEqual(again.harmonyReport, []);
  assert.equal(again.edits.length, 0);
});

test('harmony refuses a non-literal key', async () => {
  await ready;
  const { planEdits } = await import('../lib/resolve.mjs');
  const src = `song({}, [ section('a', 1, { key: KEY, drums: {} }) ])`;
  const plan = planEdits(src, 'a', '*', 'major');
  assert.ok(plan.refused.some((r) => r.section === 'a' && /key/.test(r.reason)));
});

test('the cli prints the plan for a song and exits 2 for a non-song file', () => {
  const run = (...args) => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/resolve.mjs', import.meta.url)), ...args], { encoding: 'utf8' });
  const ok = run(fileURLToPath(new URL('../songs/arc.strudel', import.meta.url)), '*', 'drums', 'darker');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /drums\.brightness .+ → /);
  assert.equal(run(fileURLToPath(import.meta.url), '*', '*', 'darker').status, 2);
});

test('setAxis rewrites a literal, inserts a missing axis, refuses expressions and spread', async () => {
  await ready;
  const { setAxis } = await import('../lib/resolve.mjs');
  assert.match(setAxis(SRC, 'verse', 'drums', 'density', .8), /drums: \{ density: \.8, groove: \.6 \}/);
  assert.match(setAxis(SRC, 'verse', 'drums', 'weight', 1.2), /drums: \{ density: \.6, groove: \.6, weight: 1 \}/, 'inserted at the end, clamped');
  assert.throws(() => setAxis(SRC, 'verse', 'melody', 'brightness', .2), /expression/);
  assert.throws(() => setAxis(SRC, 'drop', 'pad', 'space', .2), /no pad layer/);
  assert.equal(setAxis(`song({}, [section('a', 4, { drums: { ...x } })])`, 'a', 'drums', 'density', .2), `song({}, [section('a', 4, { drums: { ...x, density: .2 } })])`, 'after the spread: an override');
});

test('planEdits edits a spread layer when given the evaluated attrs, refusing signals the spread brought in', async () => {
  await ready;
  const { planEdits, applyEdits } = await import('../lib/resolve.mjs');
  const src = `const base = { density: .8, brightness: saw.range(0, 1) };
song({ cps: .5 }, [
  section('verse', 8, { drums: { ...base, weight: .3 } }),
])`;
  const effective = { verse: { drums: { density: .8, brightness: { queryArc() {} }, weight: .3 } } };
  const plan = planEdits(src, 'verse', 'drums', 'a little sparser, darker, heavier', effective);
  // sparser a little: density .8 -> .63 (override appended); heavier: weight .3 -> .65 (literal rewritten), aggression .5 -> .65 (appended)
  assert.match(applyEdits(src, plan.edits), /drums: \{ \.\.\.base, weight: \.65, density: \.63, aggression: \.65 \}/, 'literal rewritten, overrides appended after the spread');
  assert.ok(plan.refused.some((r) => r.axis === 'brightness' && /signal/.test(r.reason)), JSON.stringify(plan.refused));
});

test('moveSection swaps neighbours and stays put at the edges; duplicateSection copies under a free name; addLayer inserts an empty layer', async () => {
  await ready;
  const { moveSection, duplicateSection, addLayer, locate } = await import('../lib/resolve.mjs');
  const moved = moveSection(SRC, 'drop', -1);
  assert.deepEqual(locate(moved).sections.map((s) => s.name), ['drop', 'verse']);
  assert.match(moved, /\[\n  section\('drop', 8, \{\n    drums:  \{ density: \.9 \},\n  \}\),\n  section\('verse'/, 'separators and indentation kept');
  assert.equal(moveSection(SRC, 'verse', -1), SRC, 'first cannot move earlier');
  assert.equal(moveSection(SRC, 'drop', 1), SRC, 'last cannot move later');
  const dup = duplicateSection(SRC, 'verse');
  assert.equal(dup.name, 'verse2');
  assert.deepEqual(locate(dup.src).sections.map((s) => s.name), ['verse', 'verse2', 'drop']);
  assert.equal(duplicateSection(dup.src, 'verse').name, 'verse3');
  assert.match(dup.src, /\}\),\n  section\('verse2', 8, \{ role: 'develop',\n    drums: \{ density: \.6/, 'inserted after the original, same indentation');
  const a = addLayer(SRC, 'drop', 'bass');
  assert.equal(a.key, 'bass');
  assert.match(a.src, /drums:  \{ density: \.9 \},\n    bass: \{\}/, 'multi-line spec: new line, same indentation');
  const b = addLayer(a.src, 'drop', 'drums');
  assert.equal(b.key, 'drums2', 'a second drums layer');
  const c = addLayer(`song({}, [section('a', 4, { drums: { density: .4 } })])`, 'a', 'pad');
  assert.equal(c.src, `song({}, [section('a', 4, { drums: { density: .4 }, pad: {} })])`, 'single-line spec stays on one line');
  const d = addLayer(`song({}, [section('a', 4, {})])`, 'a', 'pad');
  assert.equal(d.src, `song({}, [section('a', 4, { pad: {} })])`);
});

test('removeSection and removeLayer cut the call or property with its line and separator', async () => {
  await ready;
  const { removeSection, removeLayer, locate } = await import('../lib/resolve.mjs');
  const a = removeSection(SRC, 'verse');
  assert.equal(a, `song({ cps: .5 }, [\n  section('drop', 8, {\n    drums:  { density: .9 },\n  }),\n])`);
  const b = removeSection(SRC, 'drop');
  assert.deepEqual(locate(b).sections.map((s) => s.name), ['verse']);
  assert.ok(b.endsWith("  }),\n])"), b);
  assert.equal(removeSection(`song({}, [section('a', 1, {}), section('b', 1, {})])`, 'a'), `song({}, [section('b', 1, {})])`, 'single line');
  const c = removeLayer(SRC, 'verse', 'drums');
  assert.equal(c.split('\n')[1] + '\n' + c.split('\n')[2], "  section('verse', 8, { role: 'develop',\n    melody: { density: .5, brightness: saw.range(.3, .7).slow(8) },");
  assert.equal(removeLayer(`song({}, [section('a', 1, { drums: { density: .4 }, pad: {} })])`, 'a', 'pad'), `song({}, [section('a', 1, { drums: { density: .4 } })])`, 'last on the line: the separator before it goes');
  assert.throws(() => removeLayer(SRC, 'verse', 'pad'), /no pad/);
});

test('locate reads materials; setMaterial sets, replaces and drops them', async () => {
  await ready;
  const { locate, setMaterial } = await import('../lib/resolve.mjs');
  const src = `song({}, [section('a', 4, { drums: { template: 'breaks', sounds: { sd: 'cp' }, density: .4 }, melody: { sound: 'triangle', follow: true, notes: N } })])`;
  const L = locate(src).sections[0].layers;
  assert.deepEqual(L.drums.mats.template.value, 'breaks');
  assert.deepEqual(L.drums.mats.sounds.value, { sd: 'cp' });
  assert.equal(L.melody.mats.follow.value, true);
  assert.equal(L.melody.mats.notes.value, 'expr');
  assert.equal(L.drums.axes.density.value, .4, 'axes still read');
  assert.match(setMaterial(src, 'a', 'drums', 'template', "'minimal'"), /drums: \{ template: 'minimal', sounds/);
  assert.match(setMaterial(src, 'a', 'drums', 'sounds', "{ sd: 'cp', hh: 'oh' }"), /sounds: \{ sd: 'cp', hh: 'oh' \}, density/);
  assert.match(setMaterial(src, 'a', 'drums', 'fill', 'true'), /density: \.4, fill: true \}/, 'appended');
  assert.match(setMaterial(src, 'a', 'melody', 'follow', null), /melody: \{ sound: 'triangle', notes: N \}/, 'dropped with its separator');
  assert.equal(setMaterial(src, 'a', 'melody', 'arp', null), src, 'dropping an absent key is a no-op');
});

test('renameSection rewrites the name literal and refuses empty, quoted or taken names', async () => {
  await ready;
  const { renameSection, locate } = await import('../lib/resolve.mjs');
  const out = renameSection(SRC, 'verse', 'chorus');
  assert.deepEqual(locate(out).sections.map((s) => s.name), ['chorus', 'drop']);
  assert.ok(out.startsWith("song({ cps: .5 }, [\n  section('chorus', 8, { role: 'develop',"), out);
  assert.throws(() => renameSection(SRC, 'verse', 'drop'), /already/);
  assert.throws(() => renameSection(SRC, 'verse', ''), /empty/);
  assert.throws(() => renameSection(SRC, 'verse', "it's"), /quotes/);
  assert.throws(() => renameSection(SRC, 'nope', 'x'), /no section/);
});

test('setSectionField sets, replaces and drops a section key or progression', async () => {
  await ready;
  const { setSectionField } = await import('../lib/resolve.mjs');
  const a = setSectionField(SRC, 'verse', 'progression', "'i VI III VII'");
  assert.match(a, /section\('verse', 8, \{ role: 'develop', progression: 'i VI III VII',\n/, 'after role');
  assert.match(setSectionField(a, 'verse', 'progression', "'i'"), /role: 'develop', progression: 'i',\n/, 'replaced');
  assert.equal(setSectionField(a, 'verse', 'progression', null), SRC, 'dropped with its separator');
  assert.match(setSectionField(SRC, 'drop', 'key', "'E:minor'"), /section\('drop', 8, \{ key: 'E:minor',\n/, 'no role: first in the spec');
  assert.throws(() => setSectionField(`song({}, [section('a', 1, { key: K })])`, 'a', 'key', "'C:minor'"), /expression/);
});

test('setSectionField sets a section dropout, and locate exposes dropoutNode', async () => {
  await ready;
  const { setSectionField, locate } = await import('../lib/resolve.mjs');
  const a = setSectionField(SRC, 'verse', 'dropout', '1');
  assert.match(a, /section\('verse', 8, \{ role: 'develop', dropout: 1,\n/, 'after role');
  assert.equal(locate(a).sections[0].dropoutNode.value, 1);
});

test('addPack declares a pack in the song header: inserts, appends, or leaves an existing one alone', async () => {
  await ready;
  const { addPack } = await import('../lib/resolve.mjs');
  const bare = `song({ cps: .5, key: 'C:minor' }, [section('a', 4, { drums: {} })])`;
  assert.match(addPack(bare, 'mine'), /song\(\{ cps: \.5, key: 'C:minor', packs: \['mine'\] \}/);
  const one = `song({ cps: .5, packs: ['demo-pack'] }, [section('a', 4, {})])`;
  assert.match(addPack(one, 'mine'), /packs: \['demo-pack', 'mine'\]/);
  assert.equal(addPack(one, 'demo-pack'), one, 'already declared: unchanged');
  assert.match(addPack(`song({ packs: [] }, [section('a', 4, {})])`, 'x'), /packs: \['x'\]/, 'an empty list');
  assert.throws(() => addPack(`song({ packs: P }, [section('a', 4, {})])`, 'x'), /expression/);
  assert.throws(() => addPack(`s("bd")`, 'x'), /not a song/);
});

test('setSongField sets, replaces and drops a song header key; bpm and cps are exclusive', async () => {
  await ready;
  const { setSongField } = await import('../lib/resolve.mjs');
  const bare = `song({ cps: .5, key: 'C:minor' }, [section('a', 4, { drums: {} })])`;
  assert.match(setSongField(bare, 'bpm', '94'), /song\(\{ key: 'C:minor', bpm: 94 \}/, 'bpm inserted, cps dropped');
  assert.match(setSongField(`song({ bpm: 120 }, [section('a', 4, {})])`, 'bpm', '94'), /song\(\{ bpm: 94 \}/, 'replaced');
  assert.match(setSongField(`song({ bpm: 120, key: 'C:minor' }, [section('a', 4, {})])`, 'cps', '.5'), /song\(\{ key: 'C:minor', cps: \.5 \}/, 'cps drops bpm');
  assert.match(setSongField(bare, 'key', "'E:minor'"), /song\(\{ cps: \.5, key: 'E:minor' \}/, 'another key is replaced in place');
  assert.match(setSongField(bare, 'bpm', null), /song\(\{ cps: \.5, key: 'C:minor' \}/, 'removing what is not there leaves the header alone');
  assert.match(setSongField(bare, 'cps', null), /song\(\{ key: 'C:minor' \}/, 'removed with its separator');
  assert.match(setSongField(`song({}, [section('a', 4, {})])`, 'bpm', '94'), /song\(\{ bpm: 94 \}/, 'an empty header');
  assert.throws(() => setSongField(`song({ bpm: B }, [section('a', 4, {})])`, 'bpm', '94'), /expression/);
  assert.throws(() => setSongField(`song({ cps: sine }, [section('a', 4, {})])`, 'bpm', '94'), /bpm cannot replace cps here: cps is an expression, change it by hand/, 'the exclusive sibling names both keys');
  assert.throws(() => setSongField(`s("bd")`, 'bpm', '94'), /not a song/);
});

test('locate reads an array of numbers as a material value; setMaterial rewrites it', async () => {
  await ready;
  const { locate, setMaterial } = await import('../lib/resolve.mjs');
  const src = `song({}, [section('a', 4, { sample: { sound: 'loop', slices: [.06, .5], pattern: '0 1 2' } })])`;
  assert.deepEqual(locate(src).sections[0].layers.sample.mats.slices.value, [.06, .5]);
  assert.match(setMaterial(src, 'a', 'sample', 'slices', '[.1, .2, .3]'), /slices: \[\.1, \.2, \.3\], pattern/);
  assert.equal(locate(`song({}, [section('a', 4, { sample: { slices: [.1, x] } })])`).sections[0].layers.sample.mats.slices.value, 'expr', 'a non-literal element is an expression');
});

test('a motion word writes a movement call around the current value; structural axes and expressions refuse', async () => {
  await ready;
  const { planEdits, applyEdits } = await import('../lib/resolve.mjs');
  const src = `song({}, [section('a', 4, { pad: { brightness: .6, space: sine }, drums: { density: .7 } })])`;
  const r = planEdits(src, 'a', 'pad', 'wobbling brightness');
  assert.deepEqual(r.report.filter((x) => x.motion).map((x) => [x.axis, x.motion]), [['brightness', 'wobble(.4, .8)']]);
  assert.match(applyEdits(src, r.edits), /brightness: wobble\(\.4, \.8\)/);
  assert.match(applyEdits(src, planEdits(src, 'a', 'pad', 'rising width').edits), /width: ramp\(\.5, \.8\)/, 'an axis not in the source starts at .5 and is inserted');
  assert.deepEqual(planEdits(src, 'a', 'pad', 'pulsing space').refused.map((x) => x.reason), ['space is a signal here; change its range by hand']);
  assert.deepEqual(planEdits(src, 'a', 'drums', 'wobbling density').refused.map((x) => x.reason), ['density is structural: it takes a number, not a movement']);
});

test('a motion centres on the value after the phrase\'s own delta on that axis, and replaces the delta\'s edit rather than doubling it', async () => {
  await ready;
  const { planEdits, applyEdits, locate } = await import('../lib/resolve.mjs');
  const src = `song({}, [section('a', 4, { pad: { brightness: .6 } })])`;
  const plan = planEdits(src, 'a', 'pad', 'brightness rising, much darker');
  const out = applyEdits(src, plan.edits);
  assert.doesNotThrow(() => locate(out), out);
  assert.match(out, /brightness: ramp\(0, \.3\)/, out);
});

test('a second motion on an axis already holding one in this phrase is refused, the first still writes', async () => {
  await ready;
  const { planEdits, applyEdits, locate } = await import('../lib/resolve.mjs');
  const src = `song({}, [section('a', 4, { pad: { brightness: .6 } })])`;
  const plan = planEdits(src, 'a', 'pad', 'wobbling brightness, brightness pulsing'); // each motion word labels one axis name, so the axis is named twice
  assert.equal(plan.edits.length, 1);
  assert.deepEqual(plan.refused.map((x) => x.reason), ['brightness already has a movement in this phrase; one per axis']);
  const out = applyEdits(src, plan.edits);
  assert.doesNotThrow(() => locate(out), out);
});

test('locate reads a list of sound names as a list, not expr', async () => {
  const { locate } = await import('../lib/resolve.mjs');
  const L = locate(`song({}, [section('a', 4, { melody: { sound: ['piano', 'kalimba'] }, pad: { sound: { piano: 2, harp: 1 } } })])`).sections[0].layers;
  assert.deepEqual(L.melody.mats.sound.value, ['piano', 'kalimba']);
  assert.deepEqual(L.pad.mats.sound.value, { piano: 2, harp: 1 });
  const D = locate(`song({}, [section('a', 4, { drums: { sounds: { sd: ['sd', 'rim'], hh: 'hh' } } })])`).sections[0].layers.drums;
  assert.deepEqual(D.mats.sounds.value, { sd: ['sd', 'rim'], hh: 'hh' }, 'a voice list inside sounds is data too, so the voice picks stay live');
  const M = locate(`song({}, [section('a', 4, { drums: { sounds: { sd: "<sd rim>", hh: 'hh' } }, melody: { sound: ["a", 'b'] } })])`).sections[0].layers;
  assert.equal(M.drums.mats.sounds.value, 'expr', 'a double-quoted voice is a mini pattern: the map is not rebuilt around it with single quotes');
  assert.equal(M.melody.mats.sound.value, 'expr', 'the same inside a list');
});

test('setAxisText replaces any value, expression included, or inserts the key', async () => {
  const { setAxisText } = await import('../lib/resolve.mjs');
  const src = `song({}, [section('a', 4, { pad: { brightness: sine.range(.2, .8), space: .3 } })])`;
  assert.match(setAxisText(src, 'a', 'pad', 'brightness', 'wobble(.3, .7)'), /brightness: wobble\(\.3, \.7\), space/);
  assert.match(setAxisText(src, 'a', 'pad', 'width', '.7'), /space: \.3, width: \.7/);
});

test('verbs: breakdown, lift, strip and halftime are resolver edits on a whole section', async () => {
  const { applyVerb, locate } = await import('../lib/resolve.mjs');
  const src = `song({}, [section('a', 4, { drums: { density: .8 }, bass: { weight: .6 }, melody: { follow: true }, pad: { space: .5 }, fx: { riser: 2 } })])`;
  const b = applyVerb(src, 'a', 'breakdown');
  assert.match(b.src, /drums: \{ density: \.45/, 'sparser: -.35'); assert.match(b.src, /space: \.85/); assert.match(b.src, /brightness: \.2/); assert.doesNotMatch(b.src, /fx:/); assert.deepEqual(b.removed, ['fx']);
  const s = applyVerb(src, 'a', 'strip');
  assert.deepEqual(Object.keys(locate(s.src).sections[0].layers), ['drums', 'bass']);
  const h = locate(applyVerb(src, 'a', 'halftime').src).sections[0].layers.drums;
  assert.equal(h.mats.template.value, 'halftime'); assert.equal(h.axes.density.value, .63, 'slightly sparser: -.175 from .8');
  assert.throws(() => applyVerb(src, 'a', 'nope'), /unknown verb/);
});

test('applyVerb surfaces refusals instead of silently doing nothing on an all-spread section', async () => {
  const { applyVerb } = await import('../lib/resolve.mjs');
  const src = `const M = { density: .5 };\nsong({}, [section('a', 4, { drums: { ...M } } )])`;
  const r = applyVerb(src, 'a', 'lift');
  assert.ok(r.refused.length > 0, 'a fully-spread layer is refused, not silently skipped');
  assert.equal(r.src, src, 'nothing to edit: the source comes back unchanged');
  // halftime sets material (template) directly, ahead of its phrase: that edit lands even when the phrase's own axis
  // edits are refused for being spread, so src differs from the input although report stays empty
  const h = applyVerb(src, 'a', 'halftime');
  assert.notEqual(h.src, src, 'the material edit (template) still lands');
  assert.match(h.src, /template: 'halftime'/);
  assert.ok(h.refused.length > 0, 'the phrase half is still refused: density comes from the spread');
});
