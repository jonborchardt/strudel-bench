// Musical lint over the check's section table: the rules live in lib/lint.mjs (the Compose page runs them too); this is the CLI.
// usage: node scripts/lint.mjs [songs/x.strudel ...]   (default: every song in songs/); exit 1 when a song has errors
//        node scripts/lint.mjs --measure renders/x.s.measure.json   (the mix lint over a measure)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFile, missingPackOnly } from './check.mjs';
import { lint, lintMeasure } from '../lib/lint.mjs';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(import.meta.dirname, '..');
  const mi = process.argv.indexOf('--measure');
  if (mi > 0) {
    const m = JSON.parse(fs.readFileSync(process.argv[mi + 1], 'utf8'));
    const findings = lintMeasure(m);
    console.log(`== ${m.song} ${m.section}: ${findings.length ? `${findings.length} warnings` : 'clean'}`);
    for (const x of findings) console.log(`  ! ${x.text}`);
    process.exit(0);
  }
  const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.strudel')).map((f) => path.join(ROOT, 'songs', f));
  let bad = 0;
  for (const f of files) {
    const r = await checkFile(f);
    if (files.length > 1 && missingPackOnly(r)) { // as in check.mjs: scanning them all, a song whose pack is not here is skipped
      console.log(`== ${path.relative(ROOT, f)} skipped: ${r.problems[0].replace(/^[^:]+: /, '')}`);
      continue;
    }
    const findings = lint(r);
    console.log(`== ${path.relative(ROOT, f)}: ${findings.length ? `${findings.filter((x) => x.level === 'error').length} errors, ${findings.filter((x) => x.level === 'warn').length} warnings` : 'clean'}`);
    for (const x of findings) console.log(`  ${x.level === 'error' ? '✖' : '!'} ${x.section ? x.section + ': ' : ''}${x.text}`);
    if (findings.some((x) => x.level === 'error')) bad++;
  }
  process.exit(bad ? 1 : 0);
}
