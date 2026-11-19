// scripts/say.mjs: text -> a clip in a local pack. The pure half (regions, definitions, the speed ratio, the refusals)
// and the command itself against a fake synthesizer in a temp root: what it writes, what it refuses before spending
// anything, and that a failure at any stage leaves the pack exactly as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validWords, regionsOf, defsOf, speedOf, eligible, collision, specDiffers, rawSnippet, say } from '../scripts/say.mjs';
import { userPacks } from '../server.mjs';
import { tone } from '../lib/analyze.mjs';

const WORDS = [{ text: 'hold', start: .1, end: .26 }, { text: 'the', start: .275, end: .35 }, { text: 'line', start: .35, end: .66 }];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} vs ${b}`);

function wavOf(seconds, hz = 220) {
  const x = tone(48000, hz, seconds), n = x.length * 2, b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(48000, 24); b.writeUInt32LE(96000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(x[i] * 32767), 44 + i * 2);
  return b;
}
const bounds = (words) => words.map((w) => ({ text: w.text, offset: Math.round(w.start * 1e7), duration: Math.round((w.end - w.start) * 1e7), type: 'WordBoundary' }));

// ---------- the pure half ----------

test('validWords names the first problem', () => {
  assert.equal(validWords(WORDS, 1), null);
  assert.match(validWords([WORDS[1], WORDS[0]], 1), /order/);
  assert.match(validWords([{ text: 'x', start: .2, end: .2 }], 1), /duration/);
  assert.match(validWords([{ text: 'x', start: .2, end: 1.4 }], 1), /outside/);
  assert.match(validWords([], 1), /no words/);
});

test('regionsOf pads each word by its own offset and duration, never across a neighbour\'s edge', () => {
  const r = regionsOf([{ text: 'a', start: .5, end: .8 }, { text: 'b', start: .81, end: 1.2 }], 2, { lead: 30, tail: 30 });
  assert.ok(r[0].end <= .81 / 2 + 1e-12, 'the tail stops at the next word\'s start');
  assert.ok(r[1].begin >= .8 / 2 - 1e-12, 'the lead stops at the previous word\'s end');
  near(r[0].begin, .47 / 2); near(r[1].end, 1.23 / 2);
  assert.ok(r[0].begin < r[0].end && r[0].end <= r[1].begin + .01 && r[1].begin < r[1].end);
  const edge = regionsOf([{ text: 'a', start: .01, end: 1.99 }], 2, { lead: 30, tail: 30 });
  assert.equal(edge[0].begin, 0); assert.equal(edge[0].end, 1);
  const none = regionsOf(WORDS, 1, { lead: 0, tail: 0 });
  near(none[2].begin, .35); near(none[2].end, .66);
});

test('defsOf: a natural-pitch phrase definition, and the words as break points in a second one', () => {
  const d = defsOf('line', WORDS, 1, { cps: .5, withWords: true });
  near(d.line.begin, .1); near(d.line.end, .66); near(d.line.bars, .56 * .5);
  assert.equal(d.line.slices, undefined, 'the plain definition never carries slices');
  const w = d['line-words'];
  assert.equal(w.sound, 'line');
  assert.deepEqual(w.slices.map((x) => +x.toFixed(6)), [.275, .35]);
  assert.ok(w.slices.every((x, i) => x > w.begin && x < w.end && (i === 0 || x > w.slices[i - 1])), 'strictly increasing, strictly inside');
  assert.equal(defsOf('line', WORDS, 1, { bars: 2, withWords: false })['line-words'], undefined);
  near(defsOf('line', WORDS, 1, { bars: 2, cps: .5 }).line.bars, 2, 'bars given wins over cps');
});

test('defsOf: a one-word line has no words definition', () => {
  const d = defsOf('hey', [{ text: 'hey', start: .1, end: .4 }], 1, { cps: .5, withWords: true });
  assert.deepEqual(Object.keys(d), ['hey']);
});

test('speedOf says plainly whether the voice is as recorded', () => {
  const a = speedOf({ regionSeconds: 2.4, cps: .5, bars: 1.2 });
  near(a.ratio, 1); assert.match(a.text, /the voice as recorded$/);
  const b = speedOf({ regionSeconds: 2.4, cps: .5, bars: 1 });
  near(b.ratio, 1.2); near(b.semitones, 12 * Math.log2(1.2));
  assert.match(b.text, /^1\.200x, \+3\.2 semitones, repitched/);
  assert.match(speedOf({ regionSeconds: 2, cps: .5, bars: 2 }).text, /^0\.500x, -12\.0 semitones, repitched/);
  const c = speedOf({ regionSeconds: 2, bars: 2 });
  assert.equal(c.ratio, null); assert.match(c.text, /as recorded only at cps 1(\.0+)?\b/);
});

test('eligible: only a new pack or one say made', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '_t_say-'));
  assert.match(eligible(path.join(dir, 'voice'), 'voice'), /voice/);
  assert.equal(eligible(path.join(dir, 'new'), 'new'), null);
  fs.mkdirSync(path.join(dir, 'cuts')); fs.writeFileSync(path.join(dir, 'cuts', 'a.wav'), '');
  assert.match(eligible(path.join(dir, 'cuts'), 'cuts'), /speech\.json/);
  fs.writeFileSync(path.join(dir, 'cuts', 'speech.json'), '{}');
  assert.equal(eligible(path.join(dir, 'cuts'), 'cuts'), null);
  assert.match(eligible(path.join(dir, 'Bad Name'), 'Bad Name'), /name/);
});

test('collision: sound names are one namespace across packs', () => {
  const packs = userPacks();
  assert.match(collision('loop', packs, 'say-speech'), /demo-pack/);
  assert.match(collision('loop-kick', packs, 'say-speech'), /demo-pack/, 'a definition in another pack counts');
  assert.equal(collision('loop', packs, 'demo-pack'), null, 'its own pack is not a collision');
  assert.equal(collision('surely-nobody-has-this', packs, 'say-speech'), null);
  assert.match(collision('Bad Name', packs, 'say-speech'), /name/);
  assert.match(collision('x', { other: { sounds: {}, samples: { 'x-words': {} } } }, 'mine'), /x-words/);
});

test('specDiffers compares what reaches Azure, not the musical configuration', () => {
  const rec = { text: 'a', voice: 'v', params: { rate: '-10%' }, config: { cps: .5 } };
  assert.deepEqual(specDiffers(rec, { text: 'a', voice: 'v', params: { rate: '-10%' } }), []);
  assert.deepEqual(specDiffers(rec, { text: 'b', voice: 'v', params: { rate: '-10%' } }), ['text']);
  assert.deepEqual(specDiffers(rec, { text: 'a', voice: 'w', params: { pitch: '+1st' } }).sort(), ['pitch', 'rate', 'voice']);
});

test('rawSnippet is the natural-pitch form: explicit regions on a raw part', () => {
  const s = rawSnippet('line', regionsOf(WORDS, 1, { lead: 0, tail: 0 }), { begin: .1, end: .66 });
  assert.match(s, /s\('line'\)\.begin\(W\[i\]\[0\]\)\.end\(W\[i\]\[1\]\)/);
  assert.match(s, /\[0\.1, 0\.26\]/);
  assert.match(s, /s\('line'\)\.begin\(0\.1\)\.end\(0\.66\)/);
  assert.ok(!s.includes('"') && !s.includes('`'), 'single quotes only: it is pasted into a song file');
  assert.equal(s.match(/^raw: /gm).length, 1, 'pasted whole into one section, no key is written twice');
  assert.match(s, /^raw2: \{ pattern: seq/m);
});

// ---------- the command ----------

const tmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), '_t_say-'));
const packDir = (root, pack = 'p-speech') => path.join(root, 'samples', 'user', pack);
const snapshot = (dir) => (fs.existsSync(dir) ? Object.fromEntries(fs.readdirSync(dir).sort().map((f) => [f, fs.readFileSync(path.join(dir, f)).toString('base64')])) : null);
/** A fake synth that counts its calls; `wav` and `words` may be swapped between calls. */
const fake = (wav = wavOf(1), words = WORDS) => { const f = async () => { f.calls++; return { wav: f.wav, boundaries: bounds(f.words) }; }; f.calls = 0; f.wav = wav; f.words = words; return f; };
const run = (root, synth, args, deps = {}) => say(args, { root, synth, packs: {}, log: () => {}, ...deps });
const BASE = ['hold the line', '--pack', 'p-speech', '--name', 'line', '--cps', '.5', '--words'];
const read = (root, f) => JSON.parse(fs.readFileSync(path.join(packDir(root), f), 'utf8'));

test('say: a new pack gets the wav, both definitions, the record, the meta and the licence note', async () => {
  const root = tmpRoot(), synth = fake();
  const r = await run(root, synth, BASE);
  assert.equal(synth.calls, 1);
  assert.deepEqual(fs.readdirSync(packDir(root)).sort(), ['LICENSE-ASSETS.md', 'line.wav', 'meta.json', 'pack.json', 'speech.json']);
  assert.deepEqual(r.wrote.sort(), ['LICENSE-ASSETS.md', 'line.wav', 'meta.json', 'pack.json', 'speech.json']);
  const pack = read(root, 'pack.json');
  assert.equal(pack.deploy, true); assert.ok(pack.license && pack.source);
  assert.deepEqual(Object.keys(pack.samples), ['line', 'line-words']);
  near(pack.samples.line.bars, .56 * .5);
  const rec = read(root, 'speech.json').line;
  assert.equal(rec.text, 'hold the line'); assert.equal(rec.voice, 'en-US-AndrewMultilingualNeural');
  assert.deepEqual(rec.words, WORDS, 'the unpadded times are what is kept');
  assert.deepEqual(rec.config, { cps: .5, bars: null, words: true, pad: { lead: 10, tail: 20 } });
  assert.equal(read(root, 'meta.json')['p-speech/line.wav'].seconds, 1);
});

test('say: refuses, before any synthesis, a pack it did not make', async () => {
  const root = tmpRoot(), synth = fake(), dir = packDir(root);
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'pack.json'), '{"license":"CC-BY-NC-SA-3.0"}'); fs.writeFileSync(path.join(dir, 'a.wav'), wavOf(.1));
  const before = snapshot(dir);
  await assert.rejects(run(root, synth, BASE), /speech\.json/);
  assert.equal(synth.calls, 0);
  assert.deepEqual(snapshot(dir), before);
});

test('say: refuses a name another pack already uses, and a missing tempo, before any synthesis', async () => {
  const root = tmpRoot(), synth = fake();
  await assert.rejects(run(root, synth, BASE, { packs: { other: { sounds: { line: ['other/line.wav'] }, samples: {} } } }), /other/);
  await assert.rejects(run(root, synth, ['hold the line', '--pack', 'p-speech', '--name', 'line']), /--cps|--bars/);
  await assert.rejects(run(root, synth, ['--pack', 'p-speech', '--name', 'line', '--cps', '.5']), /text/);
  assert.equal(synth.calls, 0);
  assert.equal(fs.existsSync(packDir(root)), false);
});

test('say: a failure at any stage leaves a valid pack byte-identical', async () => {
  const root = tmpRoot();
  await run(root, fake(), BASE);
  const before = snapshot(packDir(root)), other = ['say it again', '--pack', 'p-speech', '--name', 'again', '--cps', '.5', '--words'];
  await assert.rejects(run(root, fake(), [...other, '--rate', 'quick-ish']), /rate/);
  await assert.rejects(run(root, async () => { throw new Error('Invalid voice name'); }, other), /Invalid voice/);
  await assert.rejects(run(root, fake(wavOf(1), [{ text: 'a', start: .2, end: .5 }, { text: 'b', start: .4, end: 3 }]), other), /outside/);
  await assert.rejects(run(root, fake(wavOf(1), [{ text: 'b', start: .5, end: .7 }, { text: 'a', start: .2, end: .4 }]), [...other, '--fresh']), /order/);
  await assert.rejects(run(root, fake(), other, { measure: () => { throw new Error('cannot measure'); } }), /cannot measure/);
  assert.deepEqual(snapshot(packDir(root)), before);
});

test('say: a write that fails half way is rolled back', async () => {
  const root = tmpRoot();
  await run(root, fake(), BASE);
  const before = snapshot(packDir(root));
  let moves = 0;
  const io = { ...fs, renameSync: (a, b) => { if (!String(b).endsWith('.say-old') && ++moves === 3) throw new Error('disk says no'); return fs.renameSync(a, b); } };
  await assert.rejects(run(root, fake(), ['say it again', '--pack', 'p-speech', '--name', 'again', '--cps', '.5', '--words'], { io }), /disk says no/);
  assert.deepEqual(snapshot(packDir(root)), before, 'every file as it was, and no .tmp or .say-old left');
});

test('say: a rolled-back first write leaves no pack folder behind', async () => {
  const root = tmpRoot();
  const io = { ...fs, renameSync: () => { throw new Error('disk says no'); } };
  await assert.rejects(run(root, fake(), BASE, { io }), /disk says no/);
  assert.equal(fs.existsSync(packDir(root)), false);
});

test('say: leftovers from a crashed run are named, not written over', async () => {
  const root = tmpRoot(), synth = fake();
  await run(root, synth, BASE);
  fs.writeFileSync(path.join(packDir(root), 'pack.json.say-old'), '{}');
  await assert.rejects(run(root, synth, BASE), /pack\.json\.say-old/);
  assert.equal(synth.calls, 1);
});

test('say: different text under an existing name needs --replace', async () => {
  const root = tmpRoot(), synth = fake();
  await run(root, synth, BASE);
  const before = snapshot(packDir(root)), changed = ['hold that line', ...BASE.slice(1)];
  await assert.rejects(run(root, synth, changed), /text.*--replace/s);
  assert.equal(synth.calls, 1);
  assert.deepEqual(snapshot(packDir(root)), before);
  synth.wav = wavOf(1.2);
  const r = await run(root, synth, [...changed, '--replace']);
  assert.equal(synth.calls, 2);
  assert.equal(read(root, 'speech.json').line.text, 'hold that line');
  assert.ok(r.wrote.includes('line.wav'));
  assert.equal(read(root, 'meta.json')['p-speech/line.wav'].seconds, 1.2, 'the meta follows the new wav');
});

test('say: a name that is another clip\'s words definition, or whose words name is another clip, is refused', async () => {
  const root = tmpRoot(), synth = fake();
  await run(root, synth, BASE);
  const words = read(root, 'pack.json').samples['line-words'];
  await assert.rejects(run(root, synth, ['four five', '--pack', 'p-speech', '--name', 'line-words', '--cps', '.5']), /line-words/);
  await run(root, synth, ['four five', '--pack', 'p-speech', '--name', 'x-words', '--cps', '.5']);
  await assert.rejects(run(root, synth, ['one two', '--pack', 'p-speech', '--name', 'x', '--cps', '.5', '--words']), /x-words/);
  assert.equal(synth.calls, 2);
  assert.deepEqual(read(root, 'pack.json').samples['line-words'], words);
});

test('say: a committed wav that no longer matches its record is not silently resynthesized', async () => {
  const root = tmpRoot(), synth = fake(), wavFile = path.join(packDir(root), 'line.wav'), other = [...BASE.slice(0, 5), '--cps', '.6'];
  await run(root, synth, BASE);
  fs.rmSync(path.join(root, 'out'), { recursive: true, force: true });
  fs.writeFileSync(wavFile, wavOf(1, 330)); // edited by hand
  const edited = fs.readFileSync(wavFile);
  await assert.rejects(run(root, synth, other), /does not match.*--fresh/s);
  assert.ok(fs.readFileSync(wavFile).equals(edited));
  fs.rmSync(wavFile);
  await assert.rejects(run(root, synth, other), /missing.*--fresh/s);
  assert.equal(synth.calls, 1);
  await run(root, synth, [...other, '--fresh']);
  assert.equal(synth.calls, 2);
});

test('say: the same request again changes nothing and spends nothing', async () => {
  const root = tmpRoot(), synth = fake();
  await run(root, synth, BASE);
  fs.rmSync(path.join(root, 'out'), { recursive: true, force: true }); // even with the cache gone: the committed wav is the asset
  const before = snapshot(packDir(root));
  const r = await run(root, synth, BASE);
  assert.deepEqual(r.wrote, []);
  assert.equal(synth.calls, 1);
  assert.deepEqual(snapshot(packDir(root)), before);
});

test('say: changing only the musical configuration costs no synthesis and leaves the wav alone', async () => {
  const root = tmpRoot(), synth = fake(), wavFile = path.join(packDir(root), 'line.wav');
  await run(root, synth, BASE);
  fs.rmSync(path.join(root, 'out'), { recursive: true, force: true });
  const wav = fs.readFileSync(wavFile), mtime = fs.statSync(wavFile).mtimeMs, head = BASE.slice(0, 5);
  for (const [args, look] of [
    [[...head, '--cps', '.6', '--words'], (p) => near(p.samples.line.bars, .56 * .6)],
    [[...head, '--bars', '2', '--words'], (p) => assert.equal(p.samples.line.bars, 2)],
    [[...head, '--bars', '2'], (p) => assert.equal(p.samples['line-words'], undefined, 'dropping --words removes the words definition')],
    [[...head, '--bars', '2', '--pad-lead', '40'], () => assert.equal(read(root, 'speech.json').line.config.pad.lead, 40)],
  ]) {
    const r = await run(root, synth, args);
    look(read(root, 'pack.json'));
    assert.ok(r.wrote.length && r.wrote.every((f) => f.endsWith('.json')), `only json rewritten: ${r.wrote}`);
  }
  assert.equal(synth.calls, 1);
  assert.ok(fs.readFileSync(wavFile).equals(wav));
  assert.equal(fs.statSync(wavFile).mtimeMs, mtime);
});

test('say: --fresh always synthesizes, and rewrites the wav only when its bytes change', async () => {
  const root = tmpRoot(), synth = fake(), wavFile = path.join(packDir(root), 'line.wav');
  await run(root, synth, BASE);
  const mtime = fs.statSync(wavFile).mtimeMs;
  const same = await run(root, synth, [...BASE, '--fresh']);
  assert.equal(synth.calls, 2);
  assert.ok(!same.wrote.includes('line.wav'));
  assert.equal(fs.statSync(wavFile).mtimeMs, mtime);
  synth.wav = wavOf(1, 330);
  const diff = await run(root, synth, [...BASE, '--fresh']);
  assert.equal(synth.calls, 3);
  assert.ok(diff.wrote.includes('line.wav'));
});

test('say: a second clip in the pack leaves the first untouched', async () => {
  const root = tmpRoot();
  await run(root, fake(), BASE);
  const wav = fs.readFileSync(path.join(packDir(root), 'line.wav')), rec = read(root, 'speech.json').line, def = read(root, 'pack.json').samples.line;
  await run(root, fake(wavOf(.8), [{ text: 'again', start: .1, end: .5 }]), ['again', '--pack', 'p-speech', '--name', 'again', '--cps', '.5', '--words']);
  assert.ok(fs.readFileSync(path.join(packDir(root), 'line.wav')).equals(wav));
  assert.deepEqual(read(root, 'speech.json').line, rec);
  const pack = read(root, 'pack.json');
  assert.deepEqual(pack.samples.line, def);
  assert.deepEqual(Object.keys(pack.samples).sort(), ['again', 'line', 'line-words'], 'a one-word clip has no words definition');
  assert.equal(Object.keys(read(root, 'meta.json')).length, 2);
});

test('say: --dry prints the document and the estimate, calls nothing, writes nothing', async () => {
  const root = tmpRoot(), synth = fake(), lines = [];
  const r = await run(root, synth, [...BASE, '--dry'], { log: (s) => lines.push(s) });
  assert.equal(synth.calls, 0);
  assert.deepEqual(r.wrote, []);
  assert.equal(fs.existsSync(packDir(root)), false);
  assert.ok(lines.some((l) => l.includes('<speak')) && lines.some((l) => /estimate/.test(l)));
});

test('say: the report separates a live synthesis from a cache hit and states the speed', async () => {
  const root = tmpRoot(), synth = fake(), lines = [];
  await run(root, synth, BASE, { log: (s) => lines.push(s) });
  const out = lines.join('\n');
  assert.match(out, /live synthesis/); assert.match(out, /estimate/); assert.match(out, /the voice as recorded/);
  assert.match(out, /raw:/, 'the natural-pitch form is printed');
  lines.length = 0;
  fs.rmSync(packDir(root), { recursive: true });
  await run(root, synth, BASE, { log: (s) => lines.push(s) });
  assert.equal(synth.calls, 1);
  assert.match(lines.join('\n'), /cache hit, nothing spent/);
});
