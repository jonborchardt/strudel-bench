// The listen page's data for one song: the visual score (lib/visual.mjs) and every onset of every part
// (web/visual/export.mjs streamOf), as JSON. Baking these is what lets the viewer draw the visuals live without
// Strudel, the sample packs or lib/ in the browser; the visuals themselves are never baked, which is the whole point.
// usage: node scripts/listen.mjs songs/x.strudel [--cycles n] > out.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import './esm-fix.mjs'; // must run before anything resolves @strudel/*, hence the dynamic imports below
import { userPacks } from '../server.mjs';
import { registerSamples } from '../lib/packs.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { fallbackScore } from '../web/visual/host.mjs';
import { streamOf } from '../web/visual/export.mjs';
import { titleOf } from '../lib/title.mjs';
// Strudel prints load banners to stdout, and `> out.json` has to stay valid json. As scripts/dump.mjs does, silence
// console.log across the imports that pull it in — but only as the CLI, since the server imports showData and logs.
const CLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const say = console.log;
if (CLI) console.log = () => {};
const { ensureScope } = await import('./check.mjs');
const { evaluate } = await import('@strudel/core');
const { transpiler } = await import('@strudel/transpiler');
if (CLI) console.log = say;

// ponytail: a file with no song() loops forever, so its stream is cut here (~2 minutes at cps .5). Raise it, or pass
// --cycles, if a plain song outlasts that; a song() file uses its own length and never sees this.
export const PLAIN_CYCLES = 64;

const r4 = (x) => (typeof x === 'number' ? Math.round(x * 1e4) / 1e4 : x);
// rounding alone takes most of the bulk out of the json; no key is dropped, because a world reading `undefined`
// where it expects a number (gain, pan) would quietly produce NaN
const round = (e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, r4(v)]));

/**
 * Everything the listen page needs for one song. Throws whatever evaluation throws, so the caller decides whether a
 * broken song is a 422 (the server) or a warning (the pages build).
 */
export async function showData(file, { cycles = PLAIN_CYCLES } = {}) {
  await ensureScope();
  registerSamples(userPacks()); // a sample part resolves its pack's named definitions here as it does in the checker
  const src = fs.readFileSync(file, 'utf8'), name = path.basename(file);
  // A plain file carries its tempo in setcps(), which the Node scope stubs away (scripts/check.mjs ensureScope).
  // Catch the number while it evaluates: without it a plain song's visuals drift against its mp3 for the whole song.
  let plainCps = null;
  const was = { setcps: globalThis.setcps, setcpm: globalThis.setcpm };
  globalThis.setcps = (x) => { plainCps = Number(x) || null; };
  globalThis.setcpm = (x) => { plainCps = (Number(x) || 0) / 60 || null; };
  let pat;
  try { pat = await (await evaluate(src, transpiler)).pattern; }
  finally { Object.assign(globalThis, was); }
  const ir = pat?.strudel;
  const score = ir ? composeVisual(ir) : { ...fallbackScore(plainCps ?? 0.5), total: cycles };
  // streamOf times a plain pattern at its own 0.5 default (it has no song to read a tempo from): scale it onto the
  // tempo the file actually plays at, so event 100 lands where the mp3 has it
  const k = ir ? 1 : 0.5 / score.cps;
  const stream = streamOf(pat, cycles).map((e) => round({ ...e, t: e.t * k }));
  return { song: name, title: titleOf(name, src), score, stream, seconds: +(score.total / score.cps).toFixed(3) };
}

if (CLI) {
  const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { cycles: { type: 'string' } } });
  const file = positionals.find((a) => a.endsWith('.strudel'));
  if (!file) { console.error('usage: node scripts/listen.mjs songs/x.strudel [--cycles n]'); process.exit(2); }
  const data = await showData(file, o.cycles ? { cycles: Number(o.cycles) } : {});
  console.log(JSON.stringify(data));
  console.error(`${data.song}: ${data.stream.length} events, ${data.seconds}s, world ${data.score.world}`); // stderr, so > out.json stays clean
}
