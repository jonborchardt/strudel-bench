#!/usr/bin/env node
// The hardening loop's hands. The reader (the limner-harden skill) runs these; it never picks a seed, writes a ledger
// entry or crops a png by hand.
//
//   node limner/scripts/harden.mjs next [--view bust|figure] [--cells 9] [--pool 200] [--html]
//   node limner/scripts/harden.mjs crop <sheet> <head|eyes|"x y w h">
//   node limner/scripts/harden.mjs lint "<hash|{json}>" [--stance <name>]
//   node limner/scripts/harden.mjs record <sheet> [findings.json]        findings on stdin when no file
//   node limner/scripts/harden.mjs todos [--all]
//   node limner/scripts/harden.mjs verify <id> [--crop head|eyes|"x y w h"] [--html]   a crop enlarges that region of the then cell and draws the now side as the cropped bust
//   node limner/scripts/harden.mjs snap <id> before|after [--crop head|eyes|"x y w h"] [--html]   the evidence from the current code into sheets/fixes/; the before is taken once, before any edit, and verify then uses it as the then side
//   node limner/scripts/harden.mjs close <id> --commit <sha> [--lint <name>] | --wontfix "why"
//   node limner/scripts/harden.mjs merge <keep> <id> [<id> ...] [--parts "kind:a,kind:b"]   fold open entries that are one fault under different parts into <keep>; later findings of their fingerprints count on it
//   node limner/scripts/harden.mjs attempt <id> "<what was tried>"      three park the entry
//   node limner/scripts/harden.mjs related <id> [--cells 8] [--html]    other combinations drawing its parts: the regression check
//   node limner/scripts/harden.mjs stats                                defects per sheet, fresh cells told apart
//
// --dir names the folder holding todos.json, coverage.json and sheets/ (default: limner/scripts/harden).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode, decode, params } from '../schema.mjs';
import { feetY, FEET_Y } from '../index.mjs';
import { lintState } from './harden/lint.mjs';
import { pickCells, bump, keyOf, relatedCells, nowState, partsOf } from './harden/sampler.mjs';
import { sheetHtml, pairsHtml, screenshot, svgOf, LAYOUT, CROPS, VIEWBOX } from './harden/sheet.mjs';
import { record, merge, rank, close, load, save, attempt, isParked, statsOf, MAX_ATTEMPTS } from './harden/ledger.mjs';

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf('--' + name); return i < 0 ? dflt : argv[i + 1]; };
const has = (name) => argv.includes('--' + name);
const VALUED = new Set(['dir', 'view', 'cells', 'pool', 'stance', 'commit', 'lint', 'wontfix', 'crop', 'parts']); // html and all are booleans
const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1]?.startsWith('--') && VALUED.has(argv[i - 1].slice(2))));
const [cmd, ...args] = positional;
const dir = flag('dir', join(dirname(fileURLToPath(import.meta.url)), 'harden'));
const sheets = join(dir, 'sheets'), fixes = join(sheets, 'fixes'); // fixes/ is made by snap
mkdirSync(sheets, { recursive: true });
const TODOS = join(dir, 'todos.json'), COVERAGE = join(dir, 'coverage.json');
const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // local, not UTC
const readJson = (f, dflt) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : dflt);
const link = (st) => `limner.html#editor/${encode(st)}`;
const stateOf = (s) => (s.trim().startsWith('{') ? { seed: 1, family: 'any', theme: 'none', ...JSON.parse(s), ov: { ...(JSON.parse(s).ov ?? {}) } } : decode(s.includes('#') ? s.slice(s.indexOf('#') + 1) : s));
const sheetJson = (n) => { const f = join(sheets, `${n}.json`); if (!existsSync(f)) throw new Error(`no sheet ${n} in ${sheets}`); return JSON.parse(readFileSync(f, 'utf8')); };
/** The view a todo's own cells were judged in: a stance is only seen standing, and so is a fault every tuple saw on the figure (T006: a frame fault does not show on a bust). */
const viewOf = (t) => (t.parts.some((p) => p.startsWith('stance:')) || (t.tuples?.length && t.tuples.every((u) => u.endsWith('/figure'))) ? 'figure' : 'bust');
const widthOf = (view) => LAYOUT[view].cols * (LAYOUT[view].cell + 8) + 8;
/** Write the page: a png with the figures' boxes through the browser, or the html alone with --html. */
async function emit(html, base, view) {
  if (has('html')) { writeFileSync(base + '.html', html); return { file: base + '.html', rects: null }; }
  const rects = await screenshot(html, base + '.png', widthOf(view)); return { file: base + '.png', rects };
}
const table = (cells) => cells.map((c) => `${String(c.n).padStart(2)}  ${c.key.padEnd(44)} ${c.flags.length ? '[' + c.flags.map((f) => f.name).join(',') + ']' : ''}\t${link(decode(c.hash))}`).join('\n');

const commands = {
  async next() {
    // past the sheets on disk and past every sheet the committed ledger names: sheets/ is gitignored, a fresh checkout has none
    const onDisk = readdirSync(sheets).filter((f) => /^\d{4}\.json$/.test(f)).map((f) => +f.slice(0, 4));
    const named = load(TODOS).flatMap((t) => t.sheets ?? []).filter((s) => /^\d+$/.test(s)).map(Number);
    const n = Math.max(0, ...onDisk, ...named) + 1, num = String(n).padStart(4, '0');
    const view = flag('view', n % 2 ? 'bust' : 'figure'), coverage = readJson(COVERAGE, {});
    const cells = pickCells({ coverage, n: +flag('cells', 9), view, sheet: n, pool: +flag('pool', 200) });
    const { file, rects } = await emit(sheetHtml(cells, { view }), join(sheets, num), view);
    const rows = cells.map((c, i) => ({ n: i + 1, tuple: c.tuple, key: c.tuple.cast === 'calibration' ? 'calibration' : keyOf(c.tuple), hash: encode(c.state), parts: partsOf(c.state), flags: c.flags, source: c.source, rect: rects?.[i] ?? null, fresh: c.tuple.cast !== 'calibration' && !(coverage[keyOf(c.tuple)] > 0) })); // before bump
    writeFileSync(join(sheets, `${num}.json`), JSON.stringify({ sheet: num, view, viewBox: VIEWBOX[view], crop: null, png: file, cells: rows }, null, 1));
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
    if (Array.isArray(s.findings)) { console.log(`sheet ${num} is already recorded; nothing changed`); process.exit(1); } // a second record would count its findings twice
    const findings = JSON.parse(file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8')).map((f) => { const c = s.cells.find((x) => x.n === f.cell); return { ...f, hash: c?.hash, tuple: c?.key }; });
    const r = record(todos, findings, { sheet: num, today });
    if (r.refused.length) { for (const x of r.refused) console.log(`refused cell ${x.cell}: ${x.why}`); return console.log('nothing recorded: fix the findings and record again'); }
    save(TODOS, todos);
    for (const id of r.opened) console.log(`opened ${id}  ${todos.find((t) => t.id === id).title}`);
    for (const id of r.seen) console.log(`seen ${id}  now ${todos.find((t) => t.id === id).seen}x`);
    for (const id of r.wontfix) console.log(`wontfix ${id} seen again (not reopened)`);
    // the sheet remembers what was found on it: a clean sheet is findings: [], which is what makes it count in stats
    s.findings = r.accepted;
    writeFileSync(join(sheets, `${num}.json`), JSON.stringify(s, null, 1));
    console.log(`recorded ${s.findings.length} findings on sheet ${num}`);
  },
  todos() {
    const todos = load(TODOS), list = has('all') ? todos : rank(todos), parked = todos.filter(isParked);
    if (!list.length) console.log(has('all') ? 'no todos' : 'no open todos');
    else console.log(list.map((t) => `${t.id}  ${t.severity}x${t.seen}  ${t.category.padEnd(10)} ${t.parts.join(',').padEnd(36)} ${t.title}${t.status === 'open' && !isParked(t) ? '' : '  (' + (isParked(t) ? `parked ${t.attempts}/${MAX_ATTEMPTS}` : t.status === 'merged' ? 'merged into ' + t.mergedInto : t.status + (t.commit ? ' ' + t.commit : '')) + ')'}`).join('\n'));
    if (parked.length) console.log(`parked: ${parked.map((t) => t.id).join(', ')} (${MAX_ATTEMPTS} attempts; see --all)`);
  },
  merge([keep, ...ids]) {
    const todos = load(TODOS), parts = flag('parts', null), k = merge(todos, keep, ids, { parts: parts && parts.split(',').map((p) => p.trim()).filter(Boolean), today }); save(TODOS, todos);
    console.log(`${k.id} now ${k.seen}x, merged ${ids.join(', ')}`);
  },
  attempt([id, note]) {
    const todos = load(TODOS), t = attempt(todos, id, note ?? '', { today }); save(TODOS, todos);
    console.log(`${id} attempt ${t.attempts}/${MAX_ATTEMPTS}${isParked(t) ? '  parked: record what was tried in the ledger, move on' : ''}`);
  },
  async related([id]) {
    const t = load(TODOS).find((x) => x.id === id); if (!t) throw new Error(`no todo ${id}`);
    const cells = relatedCells(t, { n: +flag('cells', 8) });
    if (!cells.length) return console.log(`${id}: no other combination draws ${t.parts.join(', ')}`);
    const view = viewOf(t), num = `${id}-related`;
    const { file, rects } = await emit(sheetHtml(cells, { view }), join(sheets, num), view);
    const rows = cells.map((c, i) => ({ n: i + 1, tuple: c.tuple, key: keyOf(c.tuple), hash: encode(c.state), flags: c.flags, source: c.source, rect: rects?.[i] ?? null, fresh: false }));
    writeFileSync(join(sheets, `${num}.json`), JSON.stringify({ sheet: num, view, viewBox: VIEWBOX[view], crop: null, png: file, cells: rows }, null, 1));
    console.log(`sheet ${num}   ${file}\n${table(rows)}`);
  },
  async snap([id, when]) {
    const t = load(TODOS).find((x) => x.id === id); if (!t) throw new Error(`no todo ${id}`);
    if (when !== 'before' && when !== 'after') throw new Error('usage: snap <id> before|after [--crop head|eyes|"x y w h"] [--html]');
    const crop = flag('crop', null), view = viewOf(t), name = `${id}-${when}${crop ? '-' + (CROPS[crop] ? crop : crop.replace(/\s+/g, '_')) : ''}`, base = join(fixes, name);
    if (when === 'before' && existsSync(base + '.json')) throw new Error(`fixes/${name}.png exists; the before is taken once, before any edit`);
    mkdirSync(fixes, { recursive: true });
    const known = t.sheets.filter((n) => existsSync(join(sheets, `${n}.json`))).flatMap((n) => sheetJson(n).cells); // the tuple a hash was judged under
    const rows = t.evidence.map((hash, i) => ({ n: i + 1, key: known.find((c) => c.hash === hash)?.key ?? hash.slice(0, 8), hash }));
    const cells = rows.map((r) => ({ state: nowState(r.hash, known.find((c) => c.hash === r.hash)?.key), label: `${id} ${r.n} ${r.key}` }));
    const { file, rects } = await emit(sheetHtml(cells, { view, crop }), base, crop ? 'bust' : view);
    writeFileSync(base + '.json', JSON.stringify({ sheet: name, view, crop, png: file, cells: rows.map((r, i) => ({ ...r, rect: rects?.[i] ?? null })) }, null, 1));
    console.log(file);
  },
  stats() {
    const recorded = readdirSync(sheets).filter((f) => /^\d{4}\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(sheets, f), 'utf8'))).filter((s) => Array.isArray(s.findings));
    if (!recorded.length) return console.log('no recorded sheets');
    const { rows, fresh, perCell } = statsOf(recorded), rate = (x) => `${x.rate ?? 'n/a'} (${x.defects}/${x.cells})`;
    for (const r of rows) console.log(`${r.sheet}  cells ${r.cells}  fresh ${r.freshCells}  defects 3:${r.s3} 2:${r.s2} 1:${r.s1}  on fresh ${r.freshDefects}`);
    console.log(`fresh defects per fresh cell: early ${rate(fresh.early)}  late ${rate(fresh.late)}`);
    console.log(`defects per cell (every cell a new face): early ${rate(perCell.early)}  late ${rate(perCell.late)}`);
  },
  async verify([id]) {
    const todos = load(TODOS), t = todos.find((x) => x.id === id); if (!t) throw new Error(`no todo ${id}`);
    const keyFor = (h) => t.sheets.filter((n) => existsSync(join(sheets, `${n}.json`))).flatMap((n) => sheetJson(n).cells).find((c) => c.hash === h)?.key ?? null;
    const pairs = [], crop = flag('crop', null), box = crop && (([x, y, w, h]) => ({ x, y, w, h }))((CROPS[crop] ?? crop).split(/\s+/).map(Number));
    const snapName = `${id}-before${crop ? '-' + (CROPS[crop] ? crop : crop.replace(/\s+/g, '_')) : ''}`, snapFile = join(fixes, snapName + '.json'), snap = existsSync(snapFile) ? JSON.parse(readFileSync(snapFile, 'utf8')) : null;
    if (snap && snap.cells.every((c) => c.rect)) { // the before snapshot is the then side, whole: its cells are already in the view and crop
      console.log(`then: fixes/${snapName}.png`);
      for (const c of snap.cells) pairs.push({ label: `${id} ${c.key}`, before: { png: readFileSync(join(fixes, basename(snap.png))).toString('base64'), rect: c.rect }, after: svgOf(nowState(c.hash, c.key), snap.view, crop) });
    } else if (snap) console.log(`then: fixes/${snapName}.json (png needed to show it)`);
    else console.log('then: sheets');
    for (const num of pairs.length ? [] : t.sheets) {
      if (!existsSync(join(sheets, `${num}.json`))) continue; // sheets/ is gitignored: a fresh checkout has none
      const s = sheetJson(num);
      for (const c of s.cells) if (t.evidence.includes(c.hash) && c.rect && s.png.endsWith('.png')) pairs.push({ label: `${id} sheet ${num} cell ${c.n}`, before: { png: readFileSync(join(sheets, basename(s.png))).toString('base64') /* by name in this checkout's sheets: a sheet copied from another checkout carries that checkout's absolute path */, rect: c.rect, ...(crop ? { crop: box, frame: s.view === 'figure' ? (([x, y, w]) => ({ x, y: y - (FEET_Y - feetY(params(decode(c.hash)))), w }))((s.viewBox ?? '-30 -200 460 1284' /* a sheet drawn before T006 widened the frame records none */).split(' ').map(Number)) : undefined } : {}) }, after: svgOf(nowState(c.hash, c.key), s.view, crop) });
    }
    if (!pairs.length) {
      if (!t.evidence.length) throw new Error(`${id}: no evidence cell with a png; re-render with next, or open the hashes in the editor`);
      const view = viewOf(t); // the then side is gone: the now side alone
      t.evidence.forEach((h, i) => pairs.push({ label: `${id} evidence ${i + 1}`, before: null, after: svgOf(nowState(h, keyFor(h)), view, crop) }));
    }
    const width = Math.max(...pairs.map((q) => q.before?.rect.w ?? LAYOUT.bust.cell)), html = pairsHtml(pairs, width), base = join(sheets, `${id}-verify`);
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

if (!commands[cmd]) { console.error(`usage: harden next|crop|lint|record|todos|verify|close|merge|attempt|related|snap|stats (see the header of ${fileURLToPath(import.meta.url)})`); process.exit(2); }
try { await commands[cmd](args); } catch (e) { console.error(e.message); process.exit(1); }
