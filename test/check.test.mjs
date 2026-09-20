import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkFile, checkCode, missingPackOnly, formLetters } from '../scripts/check.mjs';
import { isUnlisted } from '../server.mjs';

const tmp = (name, code) => {
  const f = path.join(import.meta.dirname, name);
  fs.writeFileSync(f, code);
  return f;
};

test('demo song checks clean', async () => {
  const r = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.deepEqual(r.problems, []);
  assert.ok(r.events.length > 8);
  assert.ok(r.events.some((l) => l.includes('"s":"bd"')));
});

test('the check names the file behind each sound:index, so a bark is not mistaken for a drone', async () => {
  const f = tmp('_t_variants.strudel', 'stack(s("didgeridoo:8"), s("didgeridoo"), note("c3").s("steinway"))');
  const { sounds } = await checkFile(f);
  fs.unlinkSync(f);
  const by = Object.fromEntries(sounds.map((u) => [`${u.name}:${u.n}`, u.file]));
  assert.match(by['didgeridoo:8'], /Sus2.*12 variants/);
  assert.match(by['didgeridoo:0'], /Bark1/);
  assert.match(by['steinway:0'], /^pitched, 42 samples/);
});

test('syntax error is reported', async () => {
  const f = tmp('_t_bad.strudel', 'note("c3"');
  try { const r = await checkFile(f); assert.equal(r.ok, false); assert.ok(r.problems.length); }
  finally { fs.rmSync(f); }
});

test('unknown sound is reported', async () => {
  const f = tmp('_t_unknown.strudel', 's("definitely_not_a_sound")');
  try { const r = await checkFile(f); assert.equal(r.ok, false); assert.match(r.problems[0], /unknown sound/); }
  finally { fs.rmSync(f); }
});

test('local pack sounds: declared plays, undeclared and missing packs are problems, unknown stays unknown', async () => {
  const packs = { mine: { sounds: { thud: ['mine/thud.wav'] }, deploy: false } };
  const f = tmp('_t_packs.strudel', `song({ packs: ['mine'] }, [ section('a', 1, { melody: { sound: 'thud' } }) ])`);
  try {
    assert.deepEqual((await checkFile(f, 4, packs)).problems, []);
    fs.writeFileSync(f, `s("thud")`);
    assert.match((await checkFile(f, 4, packs)).problems[0], /sound "thud" is in local pack "mine".*packs: \['mine'\]/);
    fs.writeFileSync(f, `// packs: ['mine', 'gone']\ns("thud")`);
    assert.deepEqual((await checkFile(f, 4, packs)).problems, ['_t_packs.strudel: missing pack "gone" (declared, not in samples/user/)']);
    fs.writeFileSync(f, `// packs: ['mine']\ns("nope")`);
    assert.match((await checkFile(f, 4, packs)).problems[0], /unknown sound "nope"/);
    fs.writeFileSync(f, `song({ packs: 'mine' }, [])`);
    assert.match((await checkFile(f, 4, packs)).problems[0], /packs must list/);
  } finally { fs.rmSync(f); }
});

test('the shipped demo pack checks clean from disk', async () => {
  const r = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'ping.strudel'));
  assert.deepEqual(r.problems, []);
  assert.ok(r.events.some((l) => l.includes('"s":"ping"')));
});

test('raw (non-song) files are queried over the default 4 cycles', async () => {
  const f = tmp('_t_raw.strudel', 's("bd*4")');
  try { const r = await checkFile(f); assert.equal(r.cycles, 4); assert.equal(r.cps, undefined); }
  finally { fs.rmSync(f); }
});

test('checkFile reports the song cps and each section grid (verify/analyze read them from here)', async () => {
  const f = tmp('_t_bpm.strudel', `song({ bpm: 120, meter: '3/4' }, [ section('a', 1, { drums: {} }) ])`);
  try {
    const r = await checkFile(f);
    assert.deepEqual(r.problems, []);
    assert.ok(Math.abs(r.cps - 120 / 60 / 3) < 1e-9, String(r.cps));
    assert.equal(r.sections[0].grid.steps, 12);
  } finally { fs.rmSync(f); }
});

test('song() files report per-section, per-layer state', async () => {
  const r = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.deepEqual(r.problems, []);
  assert.equal(r.cycles, 20);
  assert.ok(r.sections.length >= 3);
  const drop = r.sections.find((s) => s.name === 'drop');
  assert.ok(drop.layers.drums.onsetsPerCycle > r.sections.find((s) => s.name === 'intro').layers.drums.onsetsPerCycle);
  assert.equal(typeof drop.layers.drums.attrs.density, 'number');
});

test('harmony line per section, default visible', async () => {
  const f = tmp('_t_harm.strudel', `song({ key: 'C:minor' }, [
  section('a', 1, { pad: {} }),
  section('b', 1, { key: 'Eb:major', progression: 'I V vi IV', pad: {} }),
])`);
  try {
    const r = await checkFile(f);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.sections.map((s) => s.harmony), ['C:minor  i VI → Cm Ab', 'Eb:major  I V vi IV → Eb Bb Cm Ab']);
  } finally { fs.rmSync(f); }
});

test('bad numeral is a problem, not a crash', async () => {
  const f = tmp('_t_harm_bad.strudel', `song({}, [ section('drop', 1, { progression: 'i ix', pad: {} }) ])`);
  try { const r = await checkFile(f); assert.equal(r.ok, false); assert.match(r.problems[0], /section "drop".*numeral "ix"/); }
  finally { fs.rmSync(f); }
});

test('song() files report each section energy (form) and each layer as words', async () => {
  const r = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  const by = Object.fromEntries(r.sections.map((s) => [s.name, s]));
  assert.ok(by.drop.energy > by.intro.energy, `drop ${by.drop.energy} > intro ${by.intro.energy}`);
  assert.ok(by.drop.layers.drums.words.includes('very busy'), JSON.stringify(by.drop.layers.drums.words));
});

test('voices: a worklet effect per hit counts as a voice more, and a stack() around the song is counted outside the parts', async () => {
  const drums = (extra) => checkCode(`song({ cps: .5, key: 'C:minor', seed: 1, kit: 'RolandTR909' }, [section('a', 4, { drums: { density: .8${extra} } })])`, 'v.strudel');
  const [plain, hot] = await Promise.all([drums(''), drums(', aggression: .9, weight: .9')]);
  assert.ok(plain.sections[0].voices > 0 && plain.sections[0].outside === 0, JSON.stringify(plain.sections[0]));
  assert.ok(hot.sections[0].layers.drums.voices > plain.sections[0].layers.drums.voices * 2, `distort+shape ${hot.sections[0].layers.drums.voices} vs plain ${plain.sections[0].layers.drums.voices}`);
  const m = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'machine.strudel'));
  const c3 = m.sections.find((s) => s.name === 'chorus3');
  assert.ok(c3.outside > 0, 'the textures stacked around the song count');
  assert.equal(c3.voices, +(Object.values(c3.layers).reduce((n, l) => n + l.voices, 0) + c3.outside).toFixed(0));
});

test('form letters: the same sounding parts share a letter, a prime marks a lift or a breakdown of it', async () => {
  const L = (parts) => Object.fromEntries(parts.map((p) => [p, { onsetsPerCycle: 4 }]));
  const secs = [{ energy: 4, layers: L(['drums', 'bass']) }, { energy: 9, layers: L(['drums', 'bass', 'melody']) }, { energy: 4.5, layers: L(['bass', 'drums']) },
    { energy: 9, layers: L(['drums', 'bass', 'melody']) }, { energy: 6, layers: { ...L(['drums', 'bass', 'melody']), fx: { onsetsPerCycle: 0 } } }, { energy: 2, layers: L(['drums', 'bass']) }];
  assert.deepEqual(formLetters(secs), ['A', 'B', 'A', 'B', "B'", "A'"], 'order and part names ignored; a silent part does not count; energy far off the first: prime');
  const r = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.ok(r.sections.every((s) => /^[A-Z]'?$/.test(s.form)), JSON.stringify(r.sections.map((s) => s.form)));
  assert.equal(r.sections[0].form, 'A');
});

test('every song in songs/ checks clean, except one whose local-only pack is not on this machine', async () => {
  const dir = path.resolve(import.meta.dirname, '..', 'songs');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.strudel') && !f.startsWith('_t_'))) {
    const r = await checkFile(path.join(dir, f));
    // a song on a gitignored pack (a licence that forbids redistributing the audio) cannot be checked on a clone that
    // does not have it. That one skip is allowed; every other problem, in that song or any other, still fails.
    if (missingPackOnly(r)) continue;
    assert.deepEqual(r.problems, [], f);
    assert.ok(r.events.length > 0, `${f}: silent`);
    // a listed song must play in real time: no section past the lint's voice bound, counted with sample lengths (a hidden
    // twin such as a premix may sit over it; it is kept as the before of a mixing pass, not played)
    if (!isUnlisted(fs.readFileSync(path.join(dir, f), 'utf8'))) for (const s of r.sections ?? []) assert.ok(s.voices <= 40, `${f} ${s.name}: ~${s.voices} voices at once; the audio thread cannot render that in real time (strata's whole traced at 110% busy at ~50)`);
  }
});

test('a song can name a pack definition: the events carry the pack sound, and the pack rule still applies', async () => {
  const packs = { mine: { sounds: { thud: ['mine/thud.wav'] }, samples: { 'thud-half': { sound: 'thud', end: .5, bars: 1 } } } };
  const f = tmp('_t_defs.strudel', `song({ packs: ['mine'] }, [ section('a', 1, { sample: { sound: 'thud-half' } }) ])`);
  try {
    const r = await checkFile(f, 4, packs);
    assert.deepEqual(r.problems, []);
    assert.ok(r.events.some((l) => l.includes('"s":"thud"') && l.includes('"end":0.5')));
    fs.writeFileSync(f, `song({}, [ section('a', 1, { sample: { sound: 'thud-half' } }) ])`);
    assert.match((await checkFile(f, 4, packs)).problems[0], /sound "thud" is in local pack "mine"/);
  } finally { fs.rmSync(f); }
});

test('sample meta: the sounds block carries seconds/rms/peak, and an unclipped sample hit is counted for its file length', async () => {
  const song = (extra) => checkCode(`song({ cps: .5, key: 'C:minor', seed: 1, kit: 'RolandTR909' }, [section('a', 4, { raw: { pattern: s('timpani:5').struct('x ~ ~ ~')${extra} } })])`, 'm.strudel');
  const [full, cut] = await Promise.all([song(''), song('.clip(1)')]);
  const t = full.sounds.find((u) => u.name === 'timpani' && u.n === 5);
  assert.ok(t.seconds > 10 && t.rms < -20 && t.peak < -5, JSON.stringify(t)); // an 11 s take, quiet
  assert.equal(full.sections[0].layers.raw.sounds[0].seconds, t.seconds);
  // one hit a bar of an 11 s file at 2 s a bar sounds for ~5.5 bars: the file, not the quarter-bar hap, is the load
  assert.ok(full.sections[0].layers.raw.voices > 4 && cut.sections[0].layers.raw.voices < 1, `full ${full.sections[0].layers.raw.voices} vs clipped ${cut.sections[0].layers.raw.voices}`);
  const piano = await checkCode(`song({ cps: .5, key: 'C:minor', seed: 1, kit: 'RolandTR909' }, [section('a', 1, { melody: { sound: 'kalimba', notes: '0' } })])`, 'p.strudel');
  const k = piano.sections[0].layers.melody;
  assert.ok(k.sounds[0].rms < -25 && k.sounds[0].seconds > 2, JSON.stringify(k.sounds)); // a pitched instrument: the median of its files
  assert.equal(k.minNote, 60);
});
