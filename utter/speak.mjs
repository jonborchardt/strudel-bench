// speak(spec): one utterance -> { wav, words, ... }. This file owns the cache, the retry loop and the rule that an
// attempt has really stopped before another begins. It imports no SDK and reads no key: the synthesis itself is a
// `synth` function (azure.mjs by default, a fake in the tests).
//
// The stop contract a synth keeps: when its `signal` aborts, the promise it returned settles only once the underlying
// operation has actually ended. An aborted signal proves nothing; settlement is the proof. speak never starts an
// attempt until the previous attempt's promise has settled, and gives up rather than overlap if it will not.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ssmlOf, charsOf, DEFAULT_VOICE } from './ssml.mjs';

export const FORMAT = 'Riff48Khz16BitMonoPcm';
export const BACKOFF_MS = [2000, 5000, 10000, 20000, 60000, 120000];
export const TIMEOUT_MS = 120_000;
export const STOP_GRACE_MS = 5000;
// Azure sheds load with "No free synthesizer" (websocket 1013) and 429s; a dropped connection is "Unable to contact
// server" (1006). All are worth another try, and so is an attempt that timed out.
const TRANSIENT = /ResourceExhausted|No free synthesizer|1013|1006|Unable to contact server|429|Too Many Requests|timed out|timeout/i;

const sha = (x) => createHash('sha256').update(x).digest('hex');

/** Spoken words only (punctuation and sentence boundaries dropped), in seconds; `end` is Azure's own offset + duration. */
export const wordsOf = (boundaries) => boundaries.filter((b) => b.type === 'WordBoundary')
  .map((b) => ({ text: b.text, start: b.offset / 1e7, end: (b.offset + b.duration) / 1e7 }));

/** USD at Azure's neural list price, $15 per million characters. An estimate: the bill is Azure's to state. */
export const estimateCost = (chars) => Math.round(chars * 15e-6 * 1e4) / 1e4;

/** The cache identity of a synthesis: everything that can change the audio. */
export const cacheKey = ({ ssml, format = FORMAT, region = '', props = { wordBoundary: true } }) => sha(JSON.stringify({ ssml, format, region, props }));

/** { rate, seconds } from a RIFF wav's own header; throws when the buffer is not PCM wav audio. */
export function wavInfo(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') throw new Error('utter: the synthesis did not return a wav');
  let rate = 0, bytesPerSecond = 0, data = -1;
  for (let p = 12; p + 8 <= buf.length;) {
    const id = buf.toString('latin1', p, p + 4), size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') { rate = buf.readUInt32LE(p + 12); bytesPerSecond = buf.readUInt32LE(p + 16); }
    if (id === 'data') { data = Math.min(size || Infinity, buf.length - p - 8); break; } // a streamed wav may declare 0: take what is there
    p += 8 + size + (size & 1);
  }
  if (!rate || !bytesPerSecond || data <= 0) throw new Error('utter: the synthesis returned a wav with no audio in it');
  return { rate, seconds: data / bytesPerSecond };
}

// ---------- cache: <dir>/<key>.wav + <key>.json, valid only as a consistent pair ----------

function readEntry(dir, key) {
  try {
    const wav = fs.readFileSync(path.join(dir, key + '.wav')), meta = JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'));
    return meta.wavSha256 === sha(wav) && Array.isArray(meta.words) && meta.words.length ? { wav, meta } : null;
  } catch { return null; }
}

/** Both files written whole and read back before either replaces anything; an existing pair is moved aside first and
 *  put back if the swap fails. That survives an ordinary write error. It is not crash-atomic: a process killed between
 *  the renames can leave a mismatched pair, which readEntry's hash check then reads as a miss. */
function writeEntry(dir, key, wav, meta) {
  fs.mkdirSync(dir, { recursive: true });
  const at = (ext) => path.join(dir, key + ext), exts = ['.wav', '.json'], rm = (f) => fs.rmSync(f, { force: true });
  fs.writeFileSync(at('.wav.tmp'), wav);
  fs.writeFileSync(at('.json.tmp'), JSON.stringify(meta));
  if (sha(fs.readFileSync(at('.wav.tmp'))) !== meta.wavSha256) { exts.forEach((e) => rm(at(e + '.tmp'))); throw new Error('utter: the cache wav did not read back as written'); }
  const had = exts.filter((e) => fs.existsSync(at(e)));
  try {
    for (const e of had) fs.renameSync(at(e), at(e + '.old'));
    for (const e of exts) fs.renameSync(at(e + '.tmp'), at(e)); // the json last: an entry without it is a miss
  } catch (err) {
    for (const e of exts) rm(at(e + '.tmp'));
    for (const e of had) if (fs.existsSync(at(e + '.old'))) { rm(at(e)); fs.renameSync(at(e + '.old'), at(e)); }
    throw err;
  }
  for (const e of had) rm(at(e + '.old'));
}

// ---------- one attempt ----------

const TIMED_OUT = Symbol('timed out'), STUCK = Symbol('stuck');
const after = (ms, value) => { let t; const p = new Promise((res) => { t = setTimeout(() => res(value), ms); }); p.cancel = () => clearTimeout(t); return p; };

/** Runs one synthesis with its own abort signal. On timeout it aborts, then waits for the synth's promise to settle
 *  (the operation has stopped) before throwing; if that does not happen within `graceMs` the error is fatal. Whatever
 *  an abandoned attempt resolves with afterwards is dropped here: only this function reads its promise. */
async function attempt(synth, ssml, timeoutMs, graceMs) {
  const ac = new AbortController();
  const run = Promise.resolve().then(() => synth(ssml, { signal: ac.signal })).then((value) => ({ value }), (error) => ({ error }));
  const limit = after(timeoutMs, TIMED_OUT), first = await Promise.race([run, limit]);
  limit.cancel();
  if (first !== TIMED_OUT) { if (first.error) throw first.error; return first.value; }
  ac.abort();
  const grace = after(graceMs, STUCK), stopped = await Promise.race([run, grace]);
  grace.cancel();
  if (stopped === STUCK) throw Object.assign(new Error(`utter: could not stop a synthesis that ran past ${timeoutMs / 1000} s; not retrying over it`), { fatal: true });
  throw new Error(`utter: azure speech timed out after ${timeoutMs / 1000} s`);
}

/**
 * Synthesize one utterance. `spec` is ssmlOf's (see PARAMS). Options: `synth` (the synthesis function; azure.mjs when
 * omitted), `cacheDir` (no cache without it), `fresh` (synthesize even when cached; the old entry is replaced only by
 * a complete new one), `backoff`, `timeoutMs`, `stopGraceMs`, `region` (part of the cache identity), `sleep`.
 * Returns { wav, words: [{ text, start, end }], seconds, rate, chars, cost, spent, cached, voice, ssml, key }: `cost`
 * is the estimate for these characters, `spent` is that estimate when a request was sent and 0 on a cache hit.
 */
export async function speak(spec, { synth, cacheDir, fresh = false, backoff = BACKOFF_MS, timeoutMs = TIMEOUT_MS, stopGraceMs = STOP_GRACE_MS, region, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const ssml = ssmlOf(spec), chars = charsOf(spec), cost = estimateCost(chars), voice = spec.ssml !== undefined ? null : spec.voice ?? DEFAULT_VOICE;
  if (!synth) { const azure = await import('./azure.mjs'); synth = azure.synth; region ??= azure.regionOf(); }
  const key = cacheKey({ ssml, region: region ?? '' }), out = (wav, m, cached) => ({ wav, words: m.words, seconds: m.seconds, rate: m.rate, chars, cost, spent: cached ? 0 : cost, cached, voice, ssml, key });

  if (cacheDir && !fresh) { const hit = readEntry(cacheDir, key); if (hit) return out(hit.wav, hit.meta, true); }

  let got;
  for (let n = 0; ; n++) {
    try { got = await attempt(synth, ssml, timeoutMs, stopGraceMs); break; } catch (e) {
      if (e?.fatal || n >= backoff.length || !TRANSIENT.test(String(e?.message ?? e))) throw e;
      await sleep(backoff[n]);
    }
  }
  const { rate, seconds } = wavInfo(got.wav), words = wordsOf(got.boundaries ?? []);
  if (!words.length) throw new Error(`utter: azure returned no word boundaries for "${ssml.replace(/<[^>]*>/g, '').slice(0, 40)}"`);
  const meta = { words, seconds, rate, chars, voice, ssml, format: FORMAT, region: region ?? '', wavSha256: sha(got.wav), made: new Date().toISOString() };
  if (cacheDir) writeEntry(cacheDir, key, got.wav, meta);
  return out(got.wav, meta, false);
}
