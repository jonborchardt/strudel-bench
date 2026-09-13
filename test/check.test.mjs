import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkFile } from '../scripts/check.mjs';

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

test('every song in songs/ checks clean', async () => {
  const dir = path.resolve(import.meta.dirname, '..', 'songs');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.strudel') && !f.startsWith('_t_'))) {
    const r = await checkFile(path.join(dir, f));
    assert.deepEqual(r.problems, [], f);
    assert.ok(r.events.length > 0, `${f}: silent`);
  }
});
