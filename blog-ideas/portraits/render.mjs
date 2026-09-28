// Renders the same five people through two revisions of web/visual/portrait.mjs, so the only thing that changes
// between the rows is the drawing code. The old revision is pulled out with `git show` into a temp directory and
// thrown away: no old code ever lands in the repo.
//
//   node blog-ideas/portraits/render.mjs 'd11afc8=Sep 25' 'b458cef=Sep 26' '.=Sep 28'   # out/sheet.html + out/<who>.html; `.` is the working tree
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FAMILY } from './family.mjs';

// An argument is `<rev>` or `<rev>=<row label>`: rows are labelled by the day the drawing was written, not the hash,
// and a commit landing at 00:32 belongs to the evening before it.
const ARGS = (process.argv.slice(2).length ? process.argv.slice(2) : ['d11afc8=Sep 25', 'b458cef=Sep 26', '.=Sep 28']).map((a) => a.split('='));
const REVS = ARGS.map(([rev]) => rev);
const LABEL = Object.fromEntries(ARGS.map(([rev, label]) => [rev, label ?? (rev === '.' ? 'working tree'
  : execFileSync('git', ['show', '-s', '--format=%ad', '--date=format:%b %d', rev]).toString().trim())]));
const dir = mkdtempSync(join(tmpdir(), 'portraits-')), OUT = 'out';
mkdirSync(OUT, { recursive: true });
const slug = (rev) => rev.replace(/\W/g, '') || 'now';

const cols = [];
for (const rev of REVS) {
  let file = 'web/visual/portrait.mjs';
  if (rev !== '.') writeFileSync(file = join(dir, `${rev}.mjs`), execFileSync('git', ['show', `${rev}:web/visual/portrait.mjs`], { maxBuffer: 1 << 24 }));
  const { renderPortrait, ACCESSORY_STYLES } = await import(pathToFileURL(file).href);
  // toSvg numbers clip paths from a module-level counter, and each revision is its own module, so every one of
  // them starts again at c1. Two c1s in one document resolve to the first, and the later portrait silently draws
  // through the earlier one's clips: irises and beards disappear. Namespace them per portrait.
  const uniq = (svg, k) => svg.replace(/(id="|url\(#)c(\d+)/g, `$1${k}c$2`);
  cols.push([rev, FAMILY.map((p) => {
    const spec = { ...p, background: '#d9d4cc', accessories: (p.accessories ?? []).filter((a) => ACCESSORY_STYLES.includes(a)) };
    delete spec.who; delete spec.label;
    const svg = uniq(renderPortrait(spec), `${slug(rev)}${p.who}`);
    writeFileSync(`${OUT}/${p.who}-${slug(rev)}.svg`, svg);
    return svg;
  })]);
}

const page = (body, w) => `<!doctype html><meta charset=utf-8><style>
body{margin:0;background:#e7e4df;font:13px system-ui;color:#4a463f}table{border-collapse:collapse;margin:16px}
td,th{padding:5px;text-align:center}figure{margin:0}figcaption{padding-top:8px;text-align:left}
svg{width:${w};height:auto;box-shadow:0 5px 16px rgba(0,0,0,.12);display:block}</style>${body}`;

writeFileSync(`${OUT}/sheet.html`, page(`<table><tr><th></th>${FAMILY.map((p) => `<th>${p.label}</th>`).join('')}</tr>
${cols.map(([rev, svgs]) => `<tr><th>${LABEL[rev]}</th>${svgs.map((s) => `<td>${s}</td>`).join('')}</tr>`).join('\n')}</table>`, '170px'));

// one page per person, the revisions side by side: the figures the post uses to talk about a single face
for (const [i, p] of FAMILY.entries())
  writeFileSync(`${OUT}/${p.who}.html`, page(`<table><tr>${cols.map(([rev, svgs]) =>
    `<td><figure>${svgs[i]}<figcaption>${p.label} &middot; ${LABEL[rev]}</figcaption></figure></td>`).join('')}</tr></table>`, '360px'));

console.log(`wrote ${OUT}/sheet.html and ${FAMILY.length} per-person pages for ${REVS.join(', ')}`);
