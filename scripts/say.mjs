// Text -> a spoken clip in a local pack, ready for a song. The one crossing from this repo into `utter`: utter turns a
// line into a wav and its word timings and knows nothing about packs or bars; this script is where those exist.
// usage: node scripts/say.mjs "<text>" --pack <pack> --name <sound> (--cps c | --bars n) [--words]
//          [--voice v] [--rate r] [--pitch p] [--volume v] [--style s] [--style-degree d] [--role r] [--lang l]
//          [--pad-lead ms] [--pad-tail ms] [--replace] [--fresh] [--dry]
//        node scripts/say.mjs --voices [--locale en-GB] [--gender Female] [--style whispering]
//
// It writes samples/user/<pack>/<name>.wav, the definitions in pack.json (<name>, and <name>-words with --words), the
// record of how the clip was made in speech.json, and the clip's measurements in meta.json.
//
// Two identities are kept apart. What reaches Azure (text, voice, the SSML parameters) is the synthesis: changing it
// under an existing name needs --replace, and --fresh asks for it again. --cps, --bars, --words and the padding are
// musical configuration: changing them rewrites the definitions from the recorded word times, with no synthesis and
// no new wav. The committed wav is the asset; Azure does not promise the same bytes for the same text twice.
//
// Pitch. A sample part resamples its region to last exactly `bars` bars, so --cps writes the bars at which the voice
// plays as recorded at that tempo, and --bars forces a length and with it a pitch. Either way a sample part repeats
// every `bars` bars. A word or a phrase placed on the grid at its own pitch is a raw part with explicit begin/end, and
// the script prints that form.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { speak, ssmlOf, voices, estimateCost, DEFAULT_VOICE } from 'utter';
import { readWav } from '../lib/analyze.mjs';
import { measureWav } from './samplemeta.mjs';
import { userPacks } from '../server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const NAME = /^[a-z0-9][a-z0-9_-]*$/;
export const PAD = { lead: 10, tail: 20 }; // ms; found by the spike (docs/superpowers/specs, "Step 0 result"): enough to clear an edge, clamped below so it never reaches a neighbour
const LICENSE = 'Azure AI Speech synthetic voice output; Microsoft product terms';
const SOURCE = 'generated speech (utter, Azure AI Speech); text and settings per clip in speech.json';
const r6 = (x) => +x.toFixed(6);
const sha = (b) => createHash('sha256').update(b).digest('hex');

// ---------- the pure half ----------

/** The first reason these word times cannot be used against `seconds` of audio, or null. */
export function validWords(words, seconds) {
  if (!Array.isArray(words) || !words.length) return 'no words came back';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!(w.end > w.start)) return `word ${i} "${w.text}" has no duration (${w.start}..${w.end})`;
    if (w.start < 0 || w.end > seconds + 1e-6) return `word ${i} "${w.text}" (${w.start}..${w.end} s) lies outside the ${seconds} s of audio`;
    if (i && w.start <= words[i - 1].start) return `word ${i} "${w.text}" is out of order (starts ${w.start}, after one that starts ${words[i - 1].start})`;
  }
  return null;
}

/** Each word as a region of the file, [{ text, begin, end }] in fractions: its own offset and duration (never "up to
 *  the next word"), widened by `lead`/`tail` ms and clamped so the padding stops at the neighbouring word's own edge. */
export function regionsOf(words, seconds, { lead = PAD.lead, tail = PAD.tail } = {}) {
  return words.map((w, i) => {
    const lo = Math.max(i ? Math.min(words[i - 1].end, w.start) : 0, w.start - lead / 1000);
    const hi = Math.min(i + 1 < words.length ? Math.max(words[i + 1].start, w.end) : seconds, w.end + tail / 1000);
    return { text: w.text, begin: lo / seconds, end: hi / seconds };
  });
}

/** The pack definitions for a clip: `<name>` is the phrase (first word's start to last word's end) standing for `bars`
 *  bars, or for the bars at which it plays as recorded at `cps`; `<name>-words` adds a break point at each later
 *  word's start, so slice i is word i. A one-word line has no second definition. */
export function defsOf(name, words, seconds, { bars, cps, withWords = false } = {}) {
  const begin = r6(words[0].start / seconds), end = r6(words.at(-1).end / seconds);
  const length = r6(bars ?? (words.at(-1).end - words[0].start) * cps);
  const defs = { [name]: { begin, end, bars: length } };
  if (withWords && words.length > 1) defs[name + '-words'] = { sound: name, begin, end, bars: length, slices: words.slice(1).map((w) => r6(w.start / seconds)) };
  return defs;
}

/** The playback speed a sample part gives this region (the layer's own formula: cps x region / bars), said plainly. */
export function speedOf({ regionSeconds, bars, cps }) {
  if (cps === undefined || cps === null) return { ratio: null, semitones: null, text: `as recorded only at cps ${(bars / regionSeconds).toFixed(3)}; at another tempo the speed is that section's cps / ${(bars / regionSeconds).toFixed(3)}` };
  const ratio = (cps * regionSeconds) / bars, semitones = 12 * Math.log2(ratio);
  if (Math.abs(ratio - 1) < .005) return { ratio, semitones, text: '1.000, the voice as recorded' };
  return { ratio, semitones, text: `${ratio.toFixed(3)}x, ${semitones >= 0 ? '+' : ''}${semitones.toFixed(1)} semitones, repitched` };
}

/** The natural-pitch form, ready to paste into a song: explicit regions on a raw part, which play at the recorded
 *  speed wherever the hit lands (single quotes only: a song file reads double quotes as mini-notation). */
export function rawSnippet(name, regions, phrase) {
  const f = (x) => String(+x.toFixed(5));
  return [
    `// ${regions.map((r, i) => `${i} ${r.text}`).join(', ')}`,
    `const W = [${regions.map((r) => `[${f(r.begin)}, ${f(r.end)}]`).join(', ')}];`,
    `const w = (i) => s('${name}').begin(W[i][0]).end(W[i][1]);`,
    `raw: { pattern: s('${name}').begin(${f(phrase.begin)}).end(${f(phrase.end)}).slow(2) },   // the phrase, once every 2 bars`,
    `raw: { pattern: seq(w(0), silence, silence, silence, ${regions.length > 1 ? 'w(1)' : 'w(0)'}, silence, silence, silence) },   // words on steps: one entry per step of the bar`,
  ].join('\n');
}

/** Why this pack cannot take generated speech, or null: only a new pack, or one this script made (it has speech.json). */
export function eligible(packDir, pack) {
  if (!NAME.test(pack)) return `pack name "${pack}" must be lowercase letters, digits, - and _`;
  if (pack === 'voice') return 'the pack name "voice" is taken: samples/user/voice is a licensed pack that stays off the repo';
  if (fs.existsSync(packDir) && !fs.existsSync(path.join(packDir, 'speech.json'))) return `samples/user/${pack} exists and has no speech.json: it was not made by this script, and generated speech does not go into another pack's licence`;
  return null;
}

/** Why this sound name cannot be used, or null: sound and definition names are one namespace across every pack. */
export function collision(name, packs, pack) {
  if (!NAME.test(name)) return `sound name "${name}" must be lowercase letters, digits, - and _`;
  for (const [other, p] of Object.entries(packs)) {
    if (other === pack) continue;
    for (const n of [name, name + '-words']) if (p.sounds?.[n] || p.samples?.[n]) return `"${n}" is already a sound or a definition in the pack ${other}`;
  }
  return null;
}

/** Which parts of the synthesis differ between a recorded clip and a request: text, voice, any SSML parameter. */
export function specDiffers(recorded, requested) {
  const a = recorded.params ?? {}, b = requested.params ?? {};
  return [...['text', 'voice'].filter((k) => recorded[k] !== requested[k]), ...[...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k])];
}

// ---------- the command ----------

const OPTIONS = {
  pack: { type: 'string' }, name: { type: 'string' }, cps: { type: 'string' }, bars: { type: 'string' }, words: { type: 'boolean' },
  voice: { type: 'string' }, rate: { type: 'string' }, pitch: { type: 'string' }, volume: { type: 'string' }, style: { type: 'string' }, 'style-degree': { type: 'string' }, role: { type: 'string' }, lang: { type: 'string' },
  'pad-lead': { type: 'string' }, 'pad-tail': { type: 'string' }, replace: { type: 'boolean' }, fresh: { type: 'boolean' }, dry: { type: 'boolean' },
  voices: { type: 'boolean' }, locale: { type: 'string' }, gender: { type: 'string' },
};
const number = (o, k, { min = 0, open = false } = {}) => {
  if (o[k] === undefined) return undefined;
  const v = Number(o[k]);
  if (!Number.isFinite(v) || (open ? v <= min : v < min)) throw new Error(`--${k} must be a number ${open ? 'above' : 'of at least'} ${min}, got ${o[k]}`);
  return v;
};
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const json = (o) => JSON.stringify(o, null, 1) + '\n';

/**
 * The command. `args` are the CLI's; the second argument is for the tests (a fake `synth`, a temp `root`, the pack
 * index, a failing `measure` or `io`). Returns { cached, wrote }: `wrote` lists the files of the pack that changed.
 */
export async function say(args, { synth, root = ROOT, log = console.log, packs, measure = measureWav, io = fs } = {}) {
  const { values: o, positionals } = parseArgs({ args, options: OPTIONS, allowPositionals: true });
  if (o.voices) {
    const rows = voices({ locale: o.locale, gender: o.gender, style: o.style });
    for (const v of rows) log(`${v.name.padEnd(44)} ${v.locale.padEnd(7)} ${v.gender.padEnd(7)} ${v.styles.join(' ')}`);
    log(`${rows.length} voices`);
    return { cached: false, wrote: [] };
  }

  // 1. everything that can be wrong with the request, before a request is made
  const text = positionals.join(' ').trim(), pack = o.pack, name = o.name;
  if (!text) throw new Error('say: no text. usage: npm run say -- "<text>" --pack <pack> --name <sound> (--cps c | --bars n) [--words]');
  if (!pack || !name) throw new Error('say: --pack and --name are both needed');
  const cps = number(o, 'cps', { open: true }), bars = number(o, 'bars', { open: true });
  if (cps === undefined && bars === undefined) throw new Error('say: give --cps c (the tempo at which the clip plays as recorded) or --bars n (a length to fit, repitched)');
  const pad = { lead: number(o, 'pad-lead') ?? PAD.lead, tail: number(o, 'pad-tail') ?? PAD.tail };
  const params = Object.fromEntries(Object.entries({ rate: o.rate, pitch: o.pitch, volume: o.volume, style: o.style, styleDegree: number(o, 'style-degree'), role: o.role, lang: o.lang }).filter(([, v]) => v !== undefined));
  const voice = o.voice ?? DEFAULT_VOICE, spec = { text, voice, ...params }, ssml = ssmlOf(spec);
  const dir = path.join(root, 'samples', 'user', pack), at = (f) => path.join(dir, f), wavName = `${name}.wav`, metaKey = `${pack}/${wavName}`;
  const refuse = eligible(dir, pack) ?? collision(name, packs ?? userPacks(), pack);
  if (refuse) throw new Error(`say: ${refuse}`);

  // 2. what is there already, and what this run would do to it
  const existed = fs.existsSync(dir);
  const left = existed ? fs.readdirSync(dir).filter((f) => /\.(say-old|tmp)$/.test(f)) : [];
  if (left.length) throw new Error(`say: samples/user/${pack} holds ${left.join(', ')} from a run that did not finish. A .say-old file is the previous version of the file it is named after: put it back or delete it, then run again`);
  const speech = readJson(at('speech.json')) ?? {}, record = speech[name], onDisk = fs.existsSync(at(wavName)) ? fs.readFileSync(at(wavName)) : null;
  const differs = record ? specDiffers(record, { text, voice, params }) : [];
  if (differs.length && !o.replace) throw new Error(`say: ${pack}/${name} already holds a different clip (${differs.join(', ')} differ${differs.includes('text') ? `; it says "${record.text}"` : ''}). Pass --replace to overwrite it, or pick another --name`);
  const reuse = !!record && !differs.length && !o.fresh && !!onDisk && sha(onDisk) === record.wavSha256;

  if (o.dry) {
    log(ssml);
    log(`${text.length} characters, estimated cost $${estimateCost(text.length)} (an estimate: Azure neural list price)${reuse ? '; the committed clip would be reused, nothing would be sent' : ''}`);
    return { cached: false, wrote: [] };
  }

  // 3. the audio: the committed clip when the synthesis is unchanged, else utter (its cache, or Azure)
  let wav, words, live = false, cached = false;
  if (reuse) ({ wav, words } = { wav: onDisk, words: record.words });
  else {
    const r = await speak(spec, { synth, cacheDir: path.join(root, 'out', 'speech'), fresh: !!o.fresh });
    ({ wav, words, cached } = r);
    live = !cached;
  }

  // 4. is it usable
  const pcm = readWav(wav), seconds = pcm.frames[0].length / pcm.rate;
  if (!(seconds > 0)) throw new Error('say: the synthesis returned no audio');
  const bad = validWords(words, seconds);
  if (bad) throw new Error(`say: the word boundaries are not usable: ${bad}`);

  // 5. every artifact prepared in memory; nothing on disk is touched yet
  const wavSha = sha(wav), wavChanged = !onDisk || !onDisk.equals(wav), config = { cps: cps ?? null, bars: bars ?? null, words: !!o.words, pad };
  const defs = defsOf(name, words, seconds, { bars, cps, withWords: !!o.words }), own = [name, name + '-words'];
  const oldPack = readJson(at('pack.json')) ?? { deploy: true, license: LICENSE, source: SOURCE, samples: {} }, samples = {};
  for (const [k, v] of Object.entries(oldPack.samples ?? {})) { if (!own.includes(k)) samples[k] = v; else if (defs[k]) samples[k] = defs[k]; } // in place: another clip's definitions keep their position
  for (const k of own) if (defs[k] && !(k in samples)) samples[k] = defs[k];
  const entry = { text, voice, params, ssml, words, seconds, chars: text.length, wavSha256: wavSha, made: record && record.wavSha256 === wavSha ? record.made : new Date().toISOString(), config };
  const oldMeta = readJson(at('meta.json')) ?? {};
  // 6. the measurement is part of preparing: a clip that cannot be measured is not installed
  const meta = { ...oldMeta, [metaKey]: wavChanged || !oldMeta[metaKey] ? measure(wav, metaKey) : oldMeta[metaKey] };
  const prepared = [
    [wavName, wavChanged ? wav : null],
    ['pack.json', json({ ...oldPack, samples })],
    ['speech.json', json({ ...speech, [name]: entry })],
    ['meta.json', JSON.stringify(meta)],
    ['LICENSE-ASSETS.md', fs.existsSync(at('LICENSE-ASSETS.md')) ? null : licenceNote(pack)],
  ].filter(([f, body]) => body !== null && !(fs.existsSync(at(f)) && Buffer.from(body).equals(fs.readFileSync(at(f)))));
  for (const [f, body] of prepared) if (f.endsWith('.json')) JSON.parse(body);
  for (const d of Object.values(defs)) if (d.slices?.some((x, i) => x <= d.begin || x >= d.end || (i && x <= d.slices[i - 1]))) throw new Error('say: the word break points do not fall in order inside the phrase');

  // 7. replace, with the previous files kept until every new one is in place
  if (prepared.length) install(dir, prepared, existed, io);
  const wrote = prepared.map(([f]) => f);

  report({ log, name, pack, words, seconds, pad, defs, cps, text, live, cached, reuse, wrote, hasWords: !!defs[name + '-words'] });
  return { cached: cached || reuse, wrote };
}

/** Every new file is written beside its target first; then each target is moved aside (`.say-old`) and the new file
 *  moved in; any error puts every moved file back and removes what was added. That covers an ordinary write failure.
 *  It is not crash-atomic: a process killed between the renames leaves `.say-old` files, which the next run refuses
 *  over and names. */
function install(dir, prepared, existed, io) {
  const at = (f) => path.join(dir, f), placed = [];
  try {
    io.mkdirSync(dir, { recursive: true });
    for (const [f, body] of prepared) io.writeFileSync(at(f + '.tmp'), body);
    for (const [f] of prepared) {
      if (fs.existsSync(at(f))) io.renameSync(at(f), at(f + '.say-old'));
      io.renameSync(at(f + '.tmp'), at(f));
      placed.push(f);
    }
  } catch (e) {
    for (const [f] of prepared) { // undo with the real fs: the rollback must not depend on what just failed
      fs.rmSync(at(f + '.tmp'), { force: true });
      if (placed.includes(f)) fs.rmSync(at(f), { force: true });
      if (fs.existsSync(at(f + '.say-old'))) fs.renameSync(at(f + '.say-old'), at(f));
    }
    if (!existed && fs.existsSync(dir) && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
    throw e;
  }
  for (const [f] of prepared) fs.rmSync(at(f + '.say-old'), { force: true });
}

const licenceNote = (pack) => `# Asset license

This file covers the audio clips in this folder (samples/user/${pack}).

- What: synthetic speech, generated with Azure AI Speech (Microsoft) by scripts/say.mjs through the utter package
- Voices, text and settings: per clip, in speech.json beside this file
- Terms: Microsoft's product terms for Azure AI Speech output. The project this capability was copied from reads them
  as allowing the generated audio in published media; that reading has not been checked again here.

Nobody's recorded voice is in these files.
`;

function report({ log, name, pack, words, seconds, pad, defs, cps, text, live, cached, reuse, wrote, hasWords }) {
  const regions = regionsOf(words, seconds, pad), def = defs[name], regionSeconds = words.at(-1).end - words[0].start;
  log(`${pack}/${name}: ${seconds.toFixed(3)} s, ${words.length} words`);
  regions.forEach((r, i) => log(`  ${String(i).padStart(2)} ${words[i].text.padEnd(12)} ${words[i].start.toFixed(3)}-${words[i].end.toFixed(3)} s   region ${r.begin.toFixed(5)}..${r.end.toFixed(5)} (lead ${pad.lead} ms, tail ${pad.tail} ms, clamped to the neighbours)`));
  const cost = `${text.length} characters, estimated cost $${estimateCost(text.length)} (an estimate)`;
  log(live ? `live synthesis: ${cost}, spent` : cached ? `cache hit, nothing spent (${cost} if it had been sent)` : reuse ? `the committed clip reused, nothing sent (${cost} if it had been)` : cost);
  log(wrote.length ? `wrote ${wrote.join(', ')}` : 'unchanged: nothing to write');
  const speed = speedOf({ regionSeconds, bars: def.bars, cps });
  log(`sample: { sound: '${name}' } stands for ${def.bars} bars: ${speed.text}${cps !== undefined ? ` at cps ${cps} (a section at another tempo changes it)` : ''}`);
  log(`  a sample part repeats every ${def.bars} bars${hasWords ? `; '${name}-words' cuts it at the words (slice i is word i), and stretch: true fits each word to its step, repitched` : ''}`);
  log('natural pitch on the grid, phrase or word, is a raw part with explicit regions:');
  log(rawSnippet(name, regions, { begin: def.begin, end: def.end }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  say(process.argv.slice(2)).then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
}
