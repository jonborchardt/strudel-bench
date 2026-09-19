// Measure one section as a mix: render the section and every part alone through the open page, run the analyzer over
// all of them, and print one row per part (its level under the mix, how far back it reads and why, where it sits) plus
// the pairs that mask each other. Writes renders/<song>.<section>.measure.json for `lint --measure`. Nothing is edited.
// usage: node scripts/measure.mjs songs/x.strudel <section> [--cycles n] [--json]   (PORT env overrides 3000)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { analyze, readWav, masking, depthOf, BANDS } from '../lib/analyze.mjs';
import { checkFile } from './check.mjs';
import { renderVia } from './render.mjs';
import { levelRows } from '../web/compose.mjs';

/** The rows and pairs of a measured section from the analyzer results: [mix, ...parts] as { name, metrics }. The dB column is the page's measure button's (levelRows). */
export function measureRows(stems) {
  const levels = levelRows(stems.map((s) => ({ name: s.name, ...s.metrics })));
  const parts = stems.map(({ name, metrics: m, ducked }, i) => {
    const relativeDb = levels[i].db;
    const row = { name, relativeDb, warn: levels[i].warn, ducked: !!ducked, width: m.width, highRatio: m.highRatio, tail: m.tail, centroidHz: m.centroidHz, lowRatio: m.lowRatio, crest: m.crest, meanPan: m.meanPan, panStd: m.panStd, peak: m.peak, clipped: m.clipped, onsetsPerSec: m.onsetsPerSec };
    row.depth = i === 0 || !Number.isFinite(relativeDb) ? null : depthOf(row);
    return row;
  });
  const pairs = [];
  for (let i = 1; i < stems.length; i++) for (let j = i + 1; j < stems.length; j++) {
    if (!stems[i].metrics.bands || !stems[j].metrics.bands) continue;
    pairs.push({ a: stems[i].name, b: stems[j].name, ...masking(stems[i].metrics, stems[j].metrics) });
  }
  pairs.sort((x, y) => Math.max(y.low, y.mid, y.high) - Math.max(x.low, x.mid, x.high));
  return { parts, pairs };
}

export function printMeasure({ section, parts, pairs }) {
  const f = (x, d = 2) => (x === null || x === undefined ? '-' : Number.isFinite(x) ? x.toFixed(d) : String(x));
  const lines = [`== ${section}: ${parts.length - 1} parts (dB: the mix in dBFS, each part under the mix; depth 0 close .. 1 far, read with its three inputs)`];
  lines.push(['part', 'dB', 'depth', 'highRatio', 'tail', 'centroid', 'lowRatio', 'crest', 'pan', 'panStd', 'peak', 'clip%'].map((h, i) => (i ? h.padStart(10) : h.padEnd(10))).join(''));
  for (const p of parts) lines.push([(p.ducked ? p.name + '*' : p.name).padEnd(10), f(p.relativeDb, 1), f(p.depth), f(p.highRatio, 3), f(p.tail), String(p.centroidHz), f(p.lowRatio), f(p.crest, 1), f(p.meanPan), f(p.panStd), f(p.peak, 3), f(p.clipped * 100, 3)].map((c, i) => (i ? c.padStart(10) : c)).join(''));
  if (parts.some((p) => p.ducked)) lines.push('* a ducked part, measured alone and so un-ducked: in the mix it sits lower than its row says');
  if (pairs.length) {
    lines.push(`masking (shared band energy x time together; ${Object.entries(BANDS).map(([k, [a, b]]) => `${k} ${a}-${b === Infinity ? '' : b} Hz`).join(', ')}):`);
    for (const p of pairs) lines.push(`  ${`${p.a} / ${p.b}`.padEnd(22)} low ${f(p.low)}  mid ${f(p.mid)}  high ${f(p.high)}`);
  }
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { cycles: { type: 'string' }, json: { type: 'boolean' } } });
  const file = positionals.find((a) => a.endsWith('.strudel')), section = positionals.find((a) => a !== file);
  if (!file || !section) { console.error('usage: node scripts/measure.mjs songs/x.strudel <section> [--cycles n] [--json]'); process.exit(2); }
  const checked = await checkFile(file);
  const sec = checked.sections?.find((s) => s.name === section);
  if (!sec) { console.error(`no section "${section}" in ${file}${checked.sections ? ` (sections: ${checked.sections.map((s) => s.name).join(', ')})` : ': not a song() file'}`); process.exit(2); }
  const base = path.basename(file, '.strudel');
  const stems = [];
  for (const layer of [undefined, ...Object.keys(sec.layers)]) { // one at a time: the page shares one offline context
    let wav;
    // four bars by default, as the page's measure button renders: the metrics read the same off four bars and a 16-bar section is nine long offline renders against the server's 60 s waiter
    try { wav = await renderVia({ song: path.basename(file), section, layer, cycles: o.cycles ? Number(o.cycles) : Math.min(sec.cycles, 4), name: `${base}.${section}.${layer ?? 'mix'}` }); }
    catch (e) { console.error(`render ${layer ?? 'mix'}: ${e.message}`); process.exit(1); }
    stems.push({ name: layer ?? 'mix', ducked: layer !== undefined && sec.layers[layer].attrs.duck !== undefined, metrics: analyze(readWav(fs.readFileSync(wav)), { cps: sec.cps, steps: sec.grid?.steps ?? 16, bands: true }) });
  }
  const out = { song: base, section, cps: sec.cps, ...measureRows(stems) };
  const jsonPath = path.join('renders', `${base}.${section}.measure.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 1));
  console.log(o.json ? JSON.stringify(out, null, 1) : printMeasure(out) + `\n${jsonPath} written; lint it: node scripts/lint.mjs --measure ${jsonPath}`);
}
