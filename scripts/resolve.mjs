// Resolve words into axis edits. usage: node scripts/resolve.mjs songs/x.strudel <section|*> <layer|*> "much heavier, a little darker" [--write]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planEdits, applyEdits, printReport } from '../lib/resolve.mjs';
import { ensureScope } from './check.mjs';
export { locate, planEdits, applyEdits, printReport, setAxis, moveSection, duplicateSection, addLayer, removeSection, removeLayer, setMaterial, renameSection } from '../lib/resolve.mjs';

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
