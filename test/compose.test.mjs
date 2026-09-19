import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { kitsIn, sectionSource, buildRequest, sourceComments, notesView, notesFile, verifyRows, shareEncode, shareDecode, levelRows } from '../web/compose.mjs';
import { parseChange, addNote } from '../scripts/note.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const demo = fs.readFileSync(path.join(ROOT, 'songs', 'demo.strudel'), 'utf8');

test('kitsIn lists the described kits whose kick, snare and hats are loaded (strudel lower-cases sound names)', () => {
  const page = ['rolandtr909_bd', 'rolandtr909_sd', 'rolandtr909_hh', 'ajkpercusyn_bd', 'ajkpercusyn_sd', 'linndrum_hh', 'linndrum_sd', 'linndrum_bd'];
  assert.deepEqual(kitsIn(['RolandTR909', 'AJKPercusyn', 'LinnDrum', 'KorgM1'], page), ['LinnDrum', 'RolandTR909']);
});

test('buildRequest places each note at its cycle and quotes the sections around the spots', () => {
  const sections = [{ name: 'intro', offset: 0, cycles: 4 }, { name: 'verse', offset: 4, cycles: 8 }, { name: 'drop', offset: 12, cycles: 8 }];
  const notes = [{ section: 'drop', cycle: 15, text: 'less hats' }, { section: 'verse', cycle: 6.2, text: 'darker pad' }];
  const req = buildRequest({ song: 'demo.strudel', src: demo, notes, sections });
  assert.match(req, /^Song: songs\/demo\.strudel\n/);
  assert.match(req, /1\. cycle 15\.0 \(drop, bar 4 of 8\): less hats\n2\. cycle 6\.2 \(verse, bar 3 of 8\): darker pad/);
  assert.match(req, /that exact\nspot, the section it is in, or what led into it just before/);
  assert.ok(req.includes("song({ cps: .5, key: 'C:minor', seed: 3, kit: 'RolandTR909' }"), 'song header for key/kit/tempo');
  assert.ok(req.includes(sectionSource(demo, 'verse')) && req.includes(sectionSource(demo, 'drop')));
  assert.ok(!req.includes("section('intro'"), 'section nobody pinned is left out');
  assert.equal(sectionSource(demo, 'nope'), '');
  // first bar of a section: the section before it is quoted too, and its source appears once
  const early = buildRequest({ song: 'demo.strudel', src: demo, notes: [{ section: 'drop', cycle: 12.4, text: 'too sudden' }], sections });
  assert.ok(early.includes(sectionSource(demo, 'verse')) && early.includes(sectionSource(demo, 'drop')));
  assert.equal(early.split("section('drop'").length, 2);
  assert.ok(!early.includes("section('intro'"));
});

test('notesView merges source comments with the metadata file, per section in source order', () => {
  const src = "// the song\nsong({ cps: .5 }, [ // header note https://x.y/not-a-comment\n  section('a', 4, { drums: { density: .3 } }), // sparse\n  section('b', 4, { drums: {} }),\n])\n";
  assert.deepEqual(sourceComments(src), { song: ['the song', 'header note https://x.y/not-a-comment'], a: ['sparse'] });
  assert.equal(notesFile('demo.strudel'), 'demo.notes.json');
  const bare = notesView(src);
  assert.deepEqual(bare.sections.map((s) => s.name), ['song', 'a']);
  assert.equal(bare.requests, 0);
  assert.equal(bare.prompt, '');
  const meta = { prompt: 'two sparse sections', requests: [
    { date: '2026-09-10', ask: 'make b busier', changes: [{ section: 'b', layer: 'drums', axis: 'density', from: 0.5, to: 0.8, why: 'raised so b lifts off a' }] },
    { date: '2026-09-11', ask: 'brighter kit', changes: [{ section: 'song', why: 'LinnDrum: crisper hats than the 909' }, { section: 'gone', why: 'a section that no longer exists' }] },
  ] };
  const v = notesView(src, meta);
  assert.equal(v.prompt, 'two sparse sections');
  assert.deepEqual([v.requests, v.changes, v.last], [2, 3, '2026-09-11']);
  assert.deepEqual(v.sections.map((s) => s.name), ['song', 'a', 'b', 'gone'], 'source order, then sections only the metadata knows');
  const b = v.sections.find((s) => s.name === 'b').items[0];
  assert.deepEqual(b, { text: 'raised so b lifts off a', where: 'drums.density', change: '0.5 → 0.8', detail: '2026-09-10: make b busier' });
  assert.deepEqual(v.sections[0].items.at(-1), { text: 'LinnDrum: crisper hats than the 909', where: '', change: '', detail: '2026-09-11: brighter kit' });
  assert.deepEqual(v.sections[0].items[0], { text: 'the song' });
  // every shipped notes file has the shape the card reads
  for (const f of fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.notes.json') && !f.startsWith('_t_'))) { // _t_: another test file's fixture, written and removed while this one runs
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'songs', f), 'utf8'));
    const song = fs.readFileSync(path.join(ROOT, 'songs', f.replace(/\.notes\.json$/, '.strudel')), 'utf8');
    const view = notesView(song, m);
    assert.ok(view.prompt && view.requests, `${f} has a prompt and at least one request`);
    for (const r of m.requests) for (const c of r.changes) assert.ok(c.why && c.section, `${f}: every change says where and why`);
  }
});

test('scripts/note.mjs parses a change line and appends requests to the notes file', () => {
  assert.deepEqual(parseChange('drop.melody.brightness .5>.7 raised for a more urgent chorus'), { section: 'drop', layer: 'melody', axis: 'brightness', from: 0.5, to: 0.7, why: 'raised for a more urgent chorus' });
  assert.deepEqual(parseChange('song LinnDrum for crisper hats'), { section: 'song', why: 'LinnDrum for crisper hats' });
  assert.deepEqual(parseChange('verse.fx a riser announces the drop'), { section: 'verse', layer: 'fx', why: 'a riser announces the drop' });
  const file = path.join(ROOT, 'songs', '_t_note.notes.json');
  try {
    addNote(file, { prompt: 'a test song', date: '2026-09-11' });
    addNote(file, { ask: 'busier', changes: ['b.drums.density .5>.8 lifts off a'], date: '2026-09-11' });
    const m = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(m.prompt, 'a test song');
    assert.deepEqual(m.requests, [{ date: '2026-09-11', ask: 'busier', changes: [{ section: 'b', layer: 'drums', axis: 'density', from: 0.5, to: 0.8, why: 'lifts off a' }] }]);
  } finally { fs.rmSync(file, { force: true }); }
});

test('lib/kits.json describes every kit the dropdown can list, labels short enough for one line', () => {
  const names = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'packs', 'tidal-drum-machines.json'), 'utf8'))).map((n) => n.toLowerCase());
  const info = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'kits.json'), 'utf8'));
  const kits = kitsIn(Object.keys(info), names);
  for (const k of ['RolandTR909', 'RolandTR808', 'LinnDrum', 'AkaiMPC60']) assert.ok(kits.includes(k), k);
  for (const k of kits) {
    assert.ok(info[k].label && info[k].about, `${k} described`);
    assert.ok(info[k].label.length <= 50, `${k} label fits one line`);
    assert.ok(fs.existsSync(path.join(ROOT, 'web', 'kits', `${k}.svg`)), `${k} icon exists (node scripts/kiticons.mjs)`);
  }
});

test('verifyRows pairs each requested axis with its metric and judges the direction', () => {
  const rows = verifyRows({ brightness: .3, weight: -.2, drive: .1 }, { centroidHz: 1000, lowRatio: .4 }, { centroidHz: 1400, lowRatio: .45 });
  assert.deepEqual(rows[0], { axis: 'brightness', requested: .3, metric: 'centroidHz', before: 1000, after: 1400, ok: true });
  assert.equal(rows[1].ok, false, 'weight asked down, lowRatio went up');
  assert.deepEqual(rows[2], { axis: 'drive', requested: .1, metric: null });
});

test('a share link round-trips the name and source, url-safe and smaller than the source', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'songs', 'demo.strudel'), 'utf8');
  const link = await shareEncode('demo.strudel', src);
  assert.match(link, /^[\w-]+$/, 'base64url: no + / = to escape in a hash');
  assert.ok(link.length < src.length, `${link.length} < ${src.length}`);
  assert.deepEqual(await shareDecode(link), { name: 'demo.strudel', src });
});

test('levelRows: the mix in dBFS, each part relative to the mix, warnings for clipping and silence', () => {
  const rows = levelRows([{ name: 'mix', rms: .1, peak: .99 }, { name: 'drums', rms: .05, peak: .5 }, { name: 'pad', rms: 0, peak: 0 }]);
  assert.deepEqual(rows, [{ name: 'mix', db: -20, warn: 'no headroom' }, { name: 'drums', db: -6, warn: null }, { name: 'pad', db: -Infinity, warn: 'silent' }]);
});
