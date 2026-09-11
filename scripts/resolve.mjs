// Resolve words into axis deltas and edit numeric axis literals inside section() layer objects.
// usage: node scripts/resolve.mjs songs/x.strudel <section|*> <layer|*> "much heavier, a little darker" [--write]
// The resolver edits declarative state only: numeric literals that are direct values of axis keys.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import '../scripts/esm-fix.mjs';
import { AXIS_NAMES, cells, describeCell } from '../lib/axes.mjs';
import '../lib/layers.mjs';
import { parsePhrase, applyDeltas } from '../lib/vocab.mjs';

const isNumLit = (n) => (n.type === 'Literal' && typeof n.value === 'number') || (n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'Literal');
const numOf = (n) => (n.type === 'Literal' ? n.value : -n.argument.value);
const keyName = (p) => (p.key.type === 'Identifier' ? p.key.name : p.key.value);

export function locate(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  const sections = [];
  (function walk(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'section' && node.arguments[2]?.type === 'ObjectExpression') {
      const [nameNode, cyclesNode, spec] = node.arguments;
      const s = { name: nameNode.value, cycles: cyclesNode.value, node, layers: {} };
      for (const prop of spec.properties) {
        if (prop.type !== 'Property') continue;
        const layer = keyName(prop);
        if (layer === 'role' || prop.value.type !== 'ObjectExpression') continue;
        const axes = {};
        for (const ap of prop.value.properties) {
          if (ap.type !== 'Property') continue;
          const a = keyName(ap);
          if (!AXIS_NAMES.includes(a)) continue;
          axes[a] = { node: ap.value, value: isNumLit(ap.value) ? numOf(ap.value) : 'expr' };
        }
        s.layers[layer] = { node: prop.value, axes };
      }
      sections.push(s);
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
    }
  })(ast);
  if (!sections.length) throw new Error('not a song() file: no section() calls found');
  return { sections };
}

const fmt = (x) => (x === 0 || x === 1 ? String(x) : String(+x.toFixed(2)).replace(/^0\./, '.'));

export function planEdits(src, sectionSel, layerSel, phrase) {
  const { sections } = locate(src);
  const parsed = parsePhrase(phrase);
  if (parsed.unknown.length) console.error(`unknown words ignored: ${parsed.unknown.join(', ')}`);
  const edits = [], refused = [], report = [];
  for (const s of sections) {
    if (sectionSel !== '*' && s.name !== sectionSel) continue;
    for (const [layer, L] of Object.entries(s.layers)) {
      if (layerSel !== '*' && layer !== layerSel) continue;
      const current = Object.fromEntries(Object.entries(L.axes).filter(([, a]) => a.value !== 'expr').map(([k, a]) => [k, a.value]));
      const applied = applyDeltas(current, parsed.deltas);
      const inserts = [];
      for (const [axis, r] of Object.entries(applied)) {
        if (!cells[layer]?.[axis]) { report.push({ section: s.name, layer, axis, skipped: 'no adapter on this layer' }); continue; }
        const existing = L.axes[axis];
        if (existing?.value === 'expr') { refused.push({ section: s.name, layer, axis, reason: `${axis} is a signal here; change its range by hand` }); continue; }
        const line = { section: s.name, layer, axis, ...r, contributions: parsed.contributions[axis], describe: describeCell(layer, axis, r.from, r.to) };
        report.push(line);
        if (r.appliedDelta === 0) continue;
        if (existing) edits.push({ start: existing.node.start, end: existing.node.end, text: fmt(r.to) });
        else inserts.push(`${axis}: ${fmt(r.to)}`);
      }
      if (inserts.length) {
        const obj = L.node;
        const last = obj.properties.at(-1);
        if (last) edits.push({ start: last.end, end: last.end, text: `, ${inserts.join(', ')}` });
        else edits.push({ start: obj.start + 1, end: obj.start + 1, text: ` ${inserts.join(', ')} ` });
      }
    }
  }
  return { edits, refused, report, parsed };
}

export function applyEdits(src, edits) {
  let out = src;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

export function printReport({ report, refused, parsed }) {
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
  for (const r of refused) console.log(`  ${r.section}.${r.layer}.${r.axis}: refused, ${r.reason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const [file, sectionSel = '*', layerSel = '*', phrase] = args.filter((a) => a !== '--write');
  if (!file || !phrase) { console.error('usage: node scripts/resolve.mjs songs/x.strudel <section|*> <layer|*> "phrase" [--write]'); process.exit(2); }
  const src = fs.readFileSync(file, 'utf8');
  let plan;
  try { plan = planEdits(src, sectionSel, layerSel, phrase); } catch (e) { console.error(e.message); process.exit(2); }
  if (plan.report.length === 0 && plan.refused.length === 0) {
    console.error(`no matching section/layer for ${sectionSel}/${layerSel}`);
    process.exit(2);
  }
  printReport(plan);
  if (write && plan.edits.length) { fs.writeFileSync(file, applyEdits(src, plan.edits)); console.log(`wrote ${file}`); }
  else if (write) console.log('nothing to write');
}
