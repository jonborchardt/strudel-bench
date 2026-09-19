// Resolve words into axis edits. usage: node scripts/resolve.mjs songs/x.strudel <section|*> <layer|*> "much heavier, a little darker" [--write]
//   or:  node scripts/resolve.mjs songs/x.strudel <section> --verb <breakdown|lift|strip|halftime> [--write]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planEdits, applyEdits, applyVerb, fmt } from '../lib/resolve.mjs';
import { ensureScope, effectiveOf } from './check.mjs';

// the evaluated song, so a spread layer resolves here as it does on the page; a song that does not evaluate leaves it undefined, and spread layers are refused as before
const evaluated = async (src) => { try { return await effectiveOf(src); } catch { return undefined; } };

function printAxisReport(report) {
  for (const r of report) {
    if (r.skipped) { console.log(`  ${r.section}.${r.layer}.${r.axis}: skipped (${r.skipped})`); continue; }
    if (r.motion) { console.log(`  ${r.section}.${r.layer}.${r.axis}: ${fmt(r.from)} -> ${r.motion}`); continue; }
    const sat = r.saturated ? `   applied ${r.appliedDelta >= 0 ? '+' : ''}${r.appliedDelta} of requested ${r.requestedDelta >= 0 ? '+' : ''}${r.requestedDelta.toFixed(2)}   saturated` : '';
    console.log(`  ${r.section}.${r.layer}.${r.axis} ${fmt(r.from)} → ${fmt(r.to)}${r.describe ? '   ' + r.describe : ''}${sat}`);
  }
}

function printReport({ report, refused, parsed, harmonyReport = [], harmonyNotice }) {
  for (const [axis, cs] of Object.entries(parsed.contributions)) {
    if (cs.length < 2) continue;
    const signs = new Set(cs.map((c) => Math.sign(c.delta)));
    console.log(`${axis}: ${cs.map((c) => `${c.word} ${c.delta >= 0 ? '+' : ''}${c.delta.toFixed(2)}`).join('   ')}   net ${parsed.deltas[axis] >= 0 ? '+' : ''}${parsed.deltas[axis].toFixed(2)}${signs.size > 1 ? '  (contradictory)' : ''}`);
  }
  printAxisReport(report);
  for (const h of harmonyReport) console.log(`  ${h.section}.${h.field} ${h.from} → ${h.to}${h.describe ? '   ' + h.describe : ''}`);
  if (harmonyNotice) console.log('  harmony applies per section; layer selector ignored for key/progression');
  for (const r of refused) console.log(`  ${r.section}.${r.layer}.${r.axis}: refused, ${r.reason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const verbAt = args.indexOf('--verb');
  const verb = verbAt === -1 ? null : args[verbAt + 1];
  await ensureScope(); // chordName() needs Strudel's scale() live, same as check.mjs.
  if (verb) {
    const [file, sectionSel] = args.filter((a, i) => a !== '--write' && i !== verbAt && i !== verbAt + 1);
    if (!file || !sectionSel) { console.error('usage: node scripts/resolve.mjs songs/x.strudel <section> --verb <breakdown|lift|strip|halftime> [--write]'); process.exit(2); }
    const src = fs.readFileSync(file, 'utf8');
    let result;
    try { result = applyVerb(src, sectionSel, verb, await evaluated(src)); } catch (e) { console.error(e.message); process.exit(2); }
    printAxisReport(result.report);
    if (result.removed.length) console.log(`  removed: ${result.removed.join(', ')}`);
    for (const r of result.refused) console.log(`  ${r.section}.${r.layer}.${r.axis}: refused, ${r.reason}`);
    if (result.src === src) console.log('nothing changed'); // material edits (setMaterial) and layer removal touch src without adding to report
    else if (write) { fs.writeFileSync(file, result.src); console.log(`wrote ${file}`); }
    process.exit(0);
  }
  const [file, sectionSel = '*', layerSel = '*', phrase] = args.filter((a) => a !== '--write');
  if (!file || !phrase) { console.error('usage: node scripts/resolve.mjs songs/x.strudel <section|*> <layer|*> "phrase" [--write]'); process.exit(2); }
  const src = fs.readFileSync(file, 'utf8');
  let plan;
  try { plan = planEdits(src, sectionSel, layerSel, phrase, await evaluated(src)); } catch (e) { console.error(e.message); process.exit(2); }
  if (plan.report.length === 0 && plan.refused.length === 0 && plan.harmonyReport.length === 0) {
    console.error(`no matching section/layer for ${sectionSel}/${layerSel}`);
    process.exit(2);
  }
  printReport(plan);
  if (write && plan.edits.length) { fs.writeFileSync(file, applyEdits(src, plan.edits)); console.log(`wrote ${file}`); }
  else if (write) console.log('nothing to write');
}
