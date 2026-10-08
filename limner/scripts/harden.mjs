#!/usr/bin/env node
// The hardening loop's hands. The reader (the limner-harden skill) runs these; it never picks a seed, writes a ledger
// entry or crops a png by hand.
//
//   node limner/scripts/harden.mjs next [--view bust|figure] [--cells 9] [--pool 200] [--html]
//   node limner/scripts/harden.mjs crop <sheet> <head|eyes|"x y w h">
//   node limner/scripts/harden.mjs lint "<hash|{json}>" [--stance <name>]
//   node limner/scripts/harden.mjs record <sheet> [findings.json]        findings on stdin when no file
//   node limner/scripts/harden.mjs todos [--all]
//   node limner/scripts/harden.mjs verify <id> [--html]
//   node limner/scripts/harden.mjs close <id> --commit <sha> [--lint <name>] | --wontfix "why"
//
// --dir names the folder holding todos.json, coverage.json and sheets/ (default: limner/scripts/harden).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode, decode } from '../schema.mjs';
import { lintState } from './harden/lint.mjs';
import { pickCells, bump, keyOf } from './harden/sampler.mjs';
import { sheetHtml, pairsHtml, screenshot, svgOf, LAYOUT } from './harden/sheet.mjs';
import { record, rank, close, load, save } from './harden/ledger.mjs';

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf('--' + name); return i < 0 ? dflt : argv[i + 1]; };
const has = (name) => argv.includes('--' + name);
const VALUED = new Set(['dir', 'view', 'cells', 'pool', 'stance', 'commit', 'lint', 'wontfix']); // html and all are booleans
const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1]?.startsWith('--') && VALUED.has(argv[i - 1].slice(2))));
const [cmd, ...args] = positional;
const dir = flag('dir', join(dirname(fileURLToPath(import.meta.url)), 'harden'));
const sheets = join(dir, 'sheets');
mkdirSync(sheets, { recursive: true });
const TODOS = join(dir, 'todos.json'), COVERAGE = join(dir, 'coverage.json');
const today = new Date().toISOString().slice(0, 10);
const readJson = (f, dflt) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : dflt);
const link = (st) => `limner.html#editor/${encode(st)}`;
const stateOf = (s) => (s.trim().startsWith('{') ? { seed: 1, family: 'any', theme: 'none', ...JSON.parse(s), ov: { ...(JSON.parse(s).ov ?? {}) } } : decode(s.includes('#') ? s.slice(s.indexOf('#') + 1) : s));
const sheetJson = (n) => { const f = join(sheets, `${n}.json`); if (!existsSync(f)) throw new Error(`no sheet ${n} in ${sheets}`); return JSON.parse(readFileSync(f, 'utf8')); };
const widthOf = (view) => LAYOUT[view].cols * (LAYOUT[view].cell + 8) + 8;
/** Write the page: a png with the figures' boxes through the browser, or the html alone with --html. */
async function emit(html, base, view) {
  if (has('html')) { writeFileSync(base + '.html', html); return { file: base + '.html', rects: null }; }
  const rects = await screenshot(html, base + '.png', widthOf(view)); return { file: base + '.png', rects };
}
const table = (cells) => cells.map((c) => `${String(c.n).padStart(2)}  ${c.key.padEnd(44)} ${c.flags.length ? '[' + c.flags.map((f) => f.name).join(',') + ']' : ''}\t${link(decode(c.hash))}`).join('\n');

const commands = {
  async next() {
    const n = readdirSync(sheets).filter((f) => /^\d{4}\.json$/.test(f)).length + 1, num = String(n).padStart(4, '0');
    const view = flag('view', n % 2 ? 'bust' : 'figure'), coverage = readJson(COVERAGE, {});
    const cells = pickCells({ coverage, n: +flag('cells', 9), view, sheet: n, pool: +flag('pool', 200) });
    const { file, rects } = await emit(sheetHtml(cells, { view }), join(sheets, num), view);
    const rows = cells.map((c, i) => ({ n: i + 1, tuple: c.tuple, key: c.tuple.cast === 'calibration' ? 'calibration' : keyOf(c.tuple), hash: encode(c.state), flags: c.flags, source: c.source, rect: rects?.[i] ?? null }));
    writeFileSync(join(sheets, `${num}.json`), JSON.stringify({ sheet: num, view, crop: null, png: file, cells: rows }, null, 1));
    writeFileSync(COVERAGE, JSON.stringify(bump(coverage, cells), null, 1) + '\n');
    console.log(`sheet ${num}   ${file}\n${table(rows)}`);
  },
  async crop([num, crop]) {
    const s = sheetJson(num), cells = s.cells.map((c) => ({ state: decode(c.hash), tuple: c.tuple }));
    const { file } = await emit(sheetHtml(cells, { view: s.view, crop }), join(sheets, `${num}-${crop.replace(/\W+/g, '_')}`), 'bust');
    console.log(file);
  },
  lint([s]) {
    const st = stateOf(s), flags = lintState(st, { cast: st.theme === 'none' ? 'editorial' : st.theme, stance: flag('stance', 'none'), expression: 'none', view: 'figure' });
    console.log(flags.length ? flags.map((f) => `${f.name}\t${f.parts.join(',')}\t${f.detail}`).join('\n') : 'clean');
  },
  record([num, file]) {
    const s = sheetJson(num), todos = load(TODOS);
    const findings = JSON.parse(file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8')).map((f) => { const c = s.cells.find((x) => x.n === f.cell); return { ...f, hash: c?.hash, tuple: c?.key }; });
    const r = record(todos, findings, { sheet: num, today }); save(TODOS, todos);
    for (const id of r.opened) console.log(`opened ${id}  ${todos.find((t) => t.id === id).title}`);
    for (const id of r.seen) console.log(`seen ${id}  now ${todos.find((t) => t.id === id).seen}x`);
    for (const id of r.wontfix) console.log(`wontfix ${id} seen again (not reopened)`);
    for (const x of r.refused) console.log(`refused cell ${x.cell}: ${x.why}`);
  },
  todos() {
    const todos = load(TODOS), list = has('all') ? todos : rank(todos);
    if (!list.length) return console.log(has('all') ? 'no todos' : 'no open todos');
    console.log(list.map((t) => `${t.id}  ${t.severity}x${t.seen}  ${t.category.padEnd(10)} ${t.parts.join(',').padEnd(36)} ${t.title}${t.status === 'open' ? '' : '  (' + t.status + (t.commit ? ' ' + t.commit : '') + ')'}`).join('\n'));
  },
  async verify([id]) {
    const todos = load(TODOS), t = todos.find((x) => x.id === id); if (!t) throw new Error(`no todo ${id}`);
    const pairs = [];
    for (const num of t.sheets) {
      const s = sheetJson(num);
      for (const c of s.cells) if (t.evidence.includes(c.hash) && c.rect && s.png.endsWith('.png')) pairs.push({ label: `${id} sheet ${num} cell ${c.n}`, before: { png: readFileSync(s.png).toString('base64'), rect: c.rect }, after: svgOf(decode(c.hash), s.view) });
    }
    if (!pairs.length) throw new Error(`${id}: no evidence cell with a png; re-render with next, or open the hashes in the editor`);
    const width = pairs[0].before.rect.w, html = pairsHtml(pairs, width), base = join(sheets, `${id}-verify`);
    let file;
    if (has('html')) { file = base + '.html'; writeFileSync(file, html); } else { file = base + '.png'; await screenshot(html, file, width * 2 + 24); }
    console.log(`${file}\n${t.evidence.map((h) => link(decode(h))).join('\n')}`);
  },
  close([id]) {
    const todos = load(TODOS);
    const t = close(todos, id, { commit: flag('commit', null), lint: flag('lint', null), wontfix: flag('wontfix', null), today }); save(TODOS, todos);
    console.log(`${t.id} ${t.status}${t.commit ? ' ' + t.commit : ''}${t.wontfix ? ': ' + t.wontfix : ''}`);
  },
};

if (!commands[cmd]) { console.error(`usage: harden next|crop|lint|record|todos|verify|close (see the header of ${fileURLToPath(import.meta.url)})`); process.exit(2); }
try { await commands[cmd](args); } catch (e) { console.error(e.message); process.exit(1); }
