// Resolve words into axis edits. usage: node scripts/resolve.mjs songs/x.strudel <section|*> <layer|*> "much heavier, a little darker" [--write]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planEdits, applyEdits, fmt } from '../lib/resolve.mjs';
import { ensureScope } from './check.mjs';

function printReport({ report, refused, parsed, harmonyReport = [], harmonyNotice }) {
  for (const [axis, cs] of Object.entries(parsed.contributions)) {
    if (cs.length < 2) continue;
    const signs = new Set(cs.map((c) => Math.sign(c.delta)));
    console.log(`${axis}: ${cs.map((c) => `${c.word} ${c.delta >= 0 ? '+' : ''}${c.delta.toFixed(2)}`).join('   ')}   net ${parsed.deltas[axis] >= 0 ? '+' : ''}${parsed.deltas[axis].toFixed(2)}${signs.size > 1 ? '  (contradictory)' : ''}`);
  }
  for (const r of report) {
    if (r.skipped) { console.log(`  ${r.section}.${r.layer}.${r.axis}: skipped (${r.skipped})`); continue; }
    const sat = r.saturated ? `   applied ${r.appliedDelta >= 0 ? '+' : ''}${r.appliedDelta} of requested ${r.requestedDelta >= 0 ? '+' : ''}${r.requestedDelta.toFixed(2)}   saturated` : '';
    console.log(`  ${r.section}.${r.layer}.${r.axis} ${fmt(r.from)} → ${fmt(r.to)}${r.describe ? '   ' + r.describe : ''}${sat}`);
  }
  for (const h of harmonyReport) console.log(`  ${h.section}.${h.field} ${h.from} → ${h.to}${h.describe ? '   ' + h.describe : ''}`);
  if (harmonyNotice) console.log('  harmony applies per section; layer selector ignored for key/progression');
  for (const r of refused) console.log(`  ${r.section}.${r.layer}.${r.axis}: refused, ${r.reason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const [file, sectionSel = '*', layerSel = '*', phrase] = args.filter((a) => a !== '--write');
  if (!file || !phrase) { console.error('usage: node scripts/resolve.mjs songs/x.strudel <section|*> <layer|*> "phrase" [--write]'); process.exit(2); }
  await ensureScope(); // chordName() needs Strudel's scale() live, same as check.mjs.
  const src = fs.readFileSync(file, 'utf8');
  let plan;
  try { plan = planEdits(src, sectionSel, layerSel, phrase); } catch (e) { console.error(e.message); process.exit(2); }
  if (plan.report.length === 0 && plan.refused.length === 0 && plan.harmonyReport.length === 0) {
    console.error(`no matching section/layer for ${sectionSel}/${layerSel}`);
    process.exit(2);
  }
  printReport(plan);
  if (write && plan.edits.length) { fs.writeFileSync(file, applyEdits(src, plan.edits)); console.log(`wrote ${file}`); }
  else if (write) console.log('nothing to write');
}
