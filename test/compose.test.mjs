import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { kitsIn, kitOf, setKit, sectionSource, buildRequest } from '../web/compose.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const demo = fs.readFileSync(path.join(ROOT, 'songs', 'demo.strudel'), 'utf8');

test('kitsIn lists only prefixes that have kick, snare and hats, in canonical case, aliases collapsed', () => {
  const toy = ['RolandTR909_bd', 'RolandTR909_sd', 'RolandTR909_hh', 'RolandTR909_cp', 'AJKPercusyn_bd', 'AJKPercusyn_sd', 'gm_piano', 'bd', 'casio', 'LinnDrum_hh', 'LinnDrum_sd', 'LinnDrum_bd'];
  assert.deepEqual(kitsIn(toy), ['LinnDrum', 'RolandTR909']);
  // the page sees strudel's sound map: lower-case keys, each alias registered as a key of its own, user kits verbatim
  const page = ['rolandtr909_bd', 'rolandtr909_sd', 'rolandtr909_hh', 'tr909_bd', 'tr909_sd', 'tr909_hh', 'mykit_bd', 'mykit_sd', 'mykit_hh'];
  assert.deepEqual(kitsIn(page, { names: ['RolandTR909_bd'], aliases: { RolandTR909: 'tr909', LinnDrum: 'linn' } }), ['RolandTR909', 'mykit']);
  const pack = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'packs', f), 'utf8'));
  const names = Object.keys(pack('tidal-drum-machines.json')), aliases = pack('tidal-drum-machines-alias.json');
  const lower = [...names, ...names.flatMap((n) => (aliases[n.split('_')[0]] ? [n.replace(/^[^_]+/, aliases[n.split('_')[0]])] : []))].map((k) => k.toLowerCase()); // what strudel registers
  const kits = kitsIn(lower, { names, aliases });
  for (const k of ['RolandTR909', 'RolandTR808', 'LinnDrum', 'AkaiMPC60']) assert.ok(kits.includes(k), k);
  assert.ok(!kits.includes('AJKPercusyn'), 'no hats');
  assert.ok(kits.every((k) => names.includes(`${k}_bd`)), 'every kit spelled as the pack spells it, no alias copies');
});

test('setKit rewrites or inserts the song-level kit and leaves section kits alone', () => {
  assert.equal(kitOf(demo), 'RolandTR909');
  const out = setKit(demo, 'LinnDrum');
  assert.equal(kitOf(out), 'LinnDrum');
  assert.equal(out.replace("kit: 'LinnDrum'", "kit: 'RolandTR909'"), demo, 'only the kit literal changed');
  const two = "song({ cps: .5, kit: \"RolandTR808\" }, [\n  section('a', 2, { kit: 'LinnLM2', drums: {} }),\n])\n";
  assert.match(setKit(two, 'KorgM1'), /song\(\{ cps: \.5, kit: 'KorgM1' \}, \[\n  section\('a', 2, \{ kit: 'LinnLM2'/);
  assert.equal(setKit("song({ cps: .5 }, [])", 'KorgM1'), "song({ kit: 'KorgM1', cps: .5 }, [])");
  assert.equal(setKit('song({}, [])', 'KorgM1'), "song({ kit: 'KorgM1',}, [])");
  assert.equal(setKit('s("bd sd")', 'KorgM1'), 's("bd sd")', 'plain strudel untouched');
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

test('lib/kits.json describes every kit the dropdown can list, labels short enough for one line', () => {
  const pack = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'packs', f), 'utf8'));
  const names = Object.keys(pack('tidal-drum-machines.json')), aliases = pack('tidal-drum-machines-alias.json');
  const info = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'kits.json'), 'utf8'));
  for (const k of kitsIn(names.map((n) => n.toLowerCase()), { names, aliases })) {
    assert.ok(info[k]?.label && info[k].about, `${k} described`);
    assert.ok(info[k].label.length <= 50, `${k} label fits one line`);
    assert.ok(fs.existsSync(path.join(ROOT, info[k].icon)), `${k} icon exists (node scripts/kiticons.mjs)`);
  }
});
