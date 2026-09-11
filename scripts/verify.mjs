// Full chain: render before -> resolve --write -> check -> render after -> analyze -> report.
// usage: node scripts/verify.mjs songs/x.strudel <section> <layer> "punchier"
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import '../scripts/esm-fix.mjs';
import { AXES } from '../lib/axes.mjs';
import { planEdits, applyEdits } from './resolve.mjs';
import { analyze, readWav } from './analyze.mjs';

const [file, sectionSel, layerSel, phrase] = process.argv.slice(2);
if (!phrase) { console.error('usage: node scripts/verify.mjs songs/x.strudel <section> <layer> "phrase"'); process.exit(2); }
if (sectionSel === '*' || layerSel === '*') { console.error('verify needs a concrete <section> and <layer> (not "*"): render targets a single song build'); process.exit(2); }
const run = (args) => execFileSync(process.execPath, args, { encoding: 'utf8' }).trim();
const render = (name) => run(['scripts/render.mjs', file, '--section', sectionSel, '--layer', layerSel, '--name', name]);
const restore = (f, text) => fs.writeFileSync(f, text);
// execFileSync errors carry stdout/stderr as separate strings (we pass encoding: 'utf8'); join what's present.
const combineOutput = (e) => [e.stdout, e.stderr].map((s) => s?.trim()).filter(Boolean).join('\n') || e.message;
const port = process.env.PORT || 3000;

const before = fs.readFileSync(file, 'utf8');
const plan = planEdits(before, sectionSel, layerSel, phrase);
if (plan.report.length === 0 && plan.refused.length === 0) {
  console.error(`no matching section/layer for ${sectionSel}/${layerSel}`);
  process.exit(2);
}

let wavA;
try { wavA = render('verify.before'); }
catch (e) { console.error(`render failed: ${combineOutput(e)}. Is the page open at http://localhost:${port} and stopped?`); process.exit(1); }

// nothing has been written to the song yet, so a failure up to here needs no restore.
fs.writeFileSync(file, applyEdits(before, plan.edits));
try { run(['scripts/check.mjs', file]); }
catch (e) { restore(file, before); console.error('check failed after edit; file restored\n' + combineOutput(e)); process.exit(1); }

// from here on the file holds the edit: any failure (render, or reading/analyzing either wav) must restore it.
let wavB, A, B;
try {
  wavB = render('verify.after');
  const cps = Number(/cps:\s*([\d.]+)/.exec(before)?.[1] ?? 0.5);
  A = analyze(readWav(fs.readFileSync(wavA)), { cps });
  B = analyze(readWav(fs.readFileSync(wavB)), { cps });
} catch (e) {
  restore(file, before);
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
  const refusedEntry = plan.refused.find((r) => r.axis === a);
  if (refusedEntry) return `${a} refused (${refusedEntry.reason})`;
  const applied = plan.report.find((r) => r.axis === a && !r.skipped);
  if (!applied) return `${a} unchanged (already at the bound)`;
  if (applied.requestedDelta === 0) return `${a} unchanged (net delta 0)`;
  if (applied.appliedDelta === 0) return `${a} unchanged (already at the bound)`;
  if (!ax.verify.metric) return `${a} ${ax.verify.class === 'code' ? 'verified (code)' : 'not measured in v1'}`;
  const m = ax.verify.metric, moved = (B[m] - A[m]) * Math.sign(d) * ax.verify.sign;
  const rel = Math.abs(B[m] - A[m]) / (Math.abs(A[m]) || 1);
  return `${a} ${moved > 0 && rel > 0.02 ? 'verified' : 'NOT verified'} (${m} ${A[m]} → ${B[m]})`;
});
console.log('Result:     ' + verdicts.join(', '));
