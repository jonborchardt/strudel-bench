// Full chain: render before -> resolve --write -> check -> render after -> analyze -> report.
// usage: node scripts/verify.mjs songs/x.strudel <section> <layer> "punchier"
import fs from 'node:fs';
import path from 'node:path';
import { renderVia } from './render.mjs';
import { AXES } from '../lib/axes.mjs';
import { planEdits, applyEdits } from '../lib/resolve.mjs';
import { checkFile, ensureScope } from './check.mjs';
import { analyze, readWav } from '../lib/analyze.mjs';

const [file, sectionSel, layerSel, phrase] = process.argv.slice(2);
if (!phrase) { console.error('usage: node scripts/verify.mjs songs/x.strudel <section> <layer> "phrase"'); process.exit(2); }
if (sectionSel === '*' || layerSel === '*') { console.error('verify needs a concrete <section> and <layer> (not "*"): render targets a single song build'); process.exit(2); }
const render = (name) => renderVia({ song: path.basename(file), section: sectionSel, layer: layerSel, name });
const combineOutput = (e) => e.message;
const port = process.env.PORT || 3000;

const before = fs.readFileSync(file, 'utf8');
await ensureScope(); // chordName() needs Strudel's scale() live, same as check.mjs/resolve.mjs.
const plan = planEdits(before, sectionSel, layerSel, phrase);
if (plan.report.length === 0 && plan.refused.length === 0 && plan.harmonyReport.length === 0) {
  console.error(`no matching section/layer for ${sectionSel}/${layerSel}`);
  process.exit(2);
}

let wavA;
try { wavA = await render('verify.before'); }
catch (e) { console.error(`render failed: ${combineOutput(e)}. Is the page open at http://localhost:${port} and stopped?`); process.exit(1); }

// code-class axes (drive, register) have no audio metric, so their evidence comes from check: the same
// onsetsPerCycle for the selected section/layer, read off the file before and after the edit.
const onsetsPerCycle = (r) => r.sections?.find((s) => s.name === sectionSel)?.layers?.[layerSel]?.onsetsPerCycle;
const onsetsA = onsetsPerCycle(await checkFile(file)); // file still holds `before`

// nothing has been written to the song yet, so a failure up to here needs no restore.
fs.writeFileSync(file, applyEdits(before, plan.edits));
const checked = await checkFile(file);
if (!checked.ok) { fs.writeFileSync(file, before); console.error('check failed after edit; file restored\n' + checked.problems.join('\n')); process.exit(1); }
const onsetsB = onsetsPerCycle(checked);

// from here on the file holds the edit: any failure (render, or reading/analyzing either wav) must restore it.
let wavB, A, B;
try {
  wavB = await render('verify.after');
  // the render is one layer of one section, so measure on that section's tempo and grid (a section may carry its own
  // bpm). song() files carry the tempo in metadata; plain strudel files still need the regex.
  const sec = checked.sections?.find((s) => s.name === sectionSel);
  const cps = sec?.cps ?? checked.cps ?? Number(/cps:\s*([\d.]+)/.exec(before)?.[1] ?? 0.5);
  const steps = sec?.grid?.steps ?? 16;
  A = analyze(readWav(fs.readFileSync(wavA)), { cps, steps });
  B = analyze(readWav(fs.readFileSync(wavB)), { cps, steps });
} catch (e) {
  fs.writeFileSync(file, before);
  console.error('render/analyze failed after edit; file restored\n' + combineOutput(e));
  process.exit(1);
}

const sign = (x) => (x >= 0 ? '+' : '') + x.toFixed(2);
console.log('Requested:  ' + Object.entries(plan.parsed.deltas).map(([a, d]) => `${a} ${sign(d)}`).join(', '));
console.log('Source:     ' + plan.report.filter((r) => !r.skipped).map((r) => `${r.layer}.${r.axis} ${r.from} → ${r.to}${r.describe ? '   ' + r.describe : ''}${r.saturated ? '   (saturated)' : ''}`).join('\n            '));
if (plan.refused.length) console.log('Refused:    ' + plan.refused.map((r) => `${r.layer}.${r.axis}: ${r.reason}`).join('; '));
console.log('Render:     ' + ['crest', 'lowRatio', 'centroidHz', 'tail', 'width', 'onsetsPerSec'].map((k) => `${k} ${A[k]} → ${B[k]}`).join('   '));
const verdicts = Object.keys(plan.parsed.deltas).map((a) => {
  const ax = AXES.find((x) => x.name === a), d = plan.parsed.deltas[a];
  // an axis can be present in the requested deltas but never actually touch the source: no adapter on
  // this layer (skipped), or a signal that refused rewriting. Either way there is nothing to measure.
  const skippedEntry = plan.report.find((r) => r.axis === a && r.skipped);
  if (skippedEntry) return `${a} not applicable to ${layerSel} (${skippedEntry.skipped})`;
  const refusedEntry = plan.refused.find((r) => r.axis === a || r.axis === '-'); // '-': the whole layer was refused (spread)
  if (refusedEntry) return `${a} refused (${refusedEntry.reason})`;
  const applied = plan.report.find((r) => r.axis === a && !r.skipped);
  if (!applied) return `${a} unchanged (already at the bound)`;
  if (applied.requestedDelta === 0) return `${a} unchanged (net delta 0)`;
  if (applied.appliedDelta === 0) return `${a} unchanged (already at the bound)`;
  if (a === 'drive') {
    if (onsetsA === undefined || onsetsB === undefined) return 'drive not code-checked: no onset count for this section/layer';
    return onsetsA === onsetsB
      ? `drive code-checked: onset count unchanged (${onsetsA}/cyc), positions not measured`
      : `drive NOT verified: onset count changed ${onsetsA} -> ${onsetsB}`;
  }
  if (a === 'register') return 'register code-checked: applied (pitch not measured in v1)';
  if (!ax.verify.metric) return `${a} not measured in v1`;
  const m = ax.verify.metric, moved = (B[m] - A[m]) * Math.sign(d) * ax.verify.sign;
  const rel = Math.abs(B[m] - A[m]) / (Math.abs(A[m]) || 1);
  return `${a} ${moved > 0 && rel > 0.02 ? 'verified' : 'NOT verified'} (${m} ${A[m]} → ${B[m]})`;
});
console.log('Result:     ' + verdicts.join(', '));
