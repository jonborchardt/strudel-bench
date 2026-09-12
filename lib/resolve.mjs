// Resolve words into axis deltas and edit numeric axis literals inside section() layer objects.
// The resolver edits declarative state only: numeric literals that are direct values of axis keys.
// Shared by scripts/resolve.mjs (cli) and the Compose page (mix card: knobs and the phrase box); acorn resolves
// through node in scripts and through index.html's import map in the browser.
import * as acorn from 'acorn';
import { AXIS_NAMES, cells } from './axes.mjs';
import './layers.mjs';
import { layerBase } from './song.mjs';
import { parsePhrase, applyDeltas } from './vocab.mjs';
import { parseProgression, applyHarmonyWords, chordNames, DEFAULT_PROGRESSION } from './harmony.mjs';

const isNumLit = (n) => (n.type === 'Literal' && typeof n.value === 'number') || (n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'Literal');
const numOf = (n) => (n.type === 'Literal' ? n.value : -n.argument.value);
const keyName = (p) => (p.key.type === 'Identifier' ? p.key.name : p.key.value);
const isStrLit = (n) => n.type === 'Literal' && typeof n.value === 'string';
// a material's value when it is plain data: a string, a boolean, a number, or an object of those (drums' sounds); anything else is 'expr'
const litValue = (n) => {
  if (n.type === 'Literal' && ['string', 'boolean', 'number'].includes(typeof n.value)) return n.value;
  if (n.type === 'ObjectExpression' && n.properties.every((p) => p.type === 'Property' && p.value.type === 'Literal')) return Object.fromEntries(n.properties.map((p) => [keyName(p), p.value.value]));
  return 'expr';
};

export function locate(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  const sections = [];
  let songKey = 'C:minor';
  (function walk(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'song' && node.arguments[0]?.type === 'ObjectExpression') {
      const k = node.arguments[0].properties.find((p) => p.type === 'Property' && keyName(p) === 'key');
      if (k && isStrLit(k.value)) songKey = k.value.value;
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'section' && node.arguments[2]?.type === 'ObjectExpression') {
      const [nameNode, cyclesNode, spec] = node.arguments;
      const s = { name: nameNode.value, cycles: cyclesNode.value, node, spec, layers: {} };
      for (const prop of spec.properties) {
        if (prop.type !== 'Property') continue;
        const layer = keyName(prop);
        if (layer === 'role') { s.roleNode = prop; continue; }
        if (layer === 'key') { s.keyNode = prop.value; continue; }
        if (layer === 'progression') { s.progressionNode = prop.value; continue; }
        if (prop.value.type !== 'ObjectExpression') continue;
        const axes = {}, mats = {}; // mats: material keys (sound, template, sounds, ...) with their literal value, or 'expr'
        let spread = null; // a spread hides values we cannot see; planEdits refuses the whole layer
        for (const ap of prop.value.properties) {
          if (ap.type === 'SpreadElement') { spread ??= src.slice(ap.start, ap.end); continue; }
          if (ap.type !== 'Property') continue;
          const a = keyName(ap);
          if (AXIS_NAMES.includes(a)) axes[a] = { node: ap.value, value: isNumLit(ap.value) ? numOf(ap.value) : 'expr' };
          else mats[a] = { node: ap.value, prop: ap, value: litValue(ap.value) };
        }
        s.layers[layer] = { node: prop.value, prop, axes, mats, spread };
      }
      sections.push(s);
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
    }
  })(ast);
  if (!sections.length) throw new Error('not a song() file: no section() calls found');
  return { sections, songKey };
}

export const fmt = (x) => (x === 0 || x === 1 ? String(x) : String(+x.toFixed(2)).replace(/^0\./, '.'));

/**
 * `effective[section][layer]` (optional) is the evaluated song's resolved attrs: with it a layer built with spread is
 * edited from the values the spread produced (the page has them); without it such a layer is refused (the cli).
 */
export function planEdits(src, sectionSel, layerSel, phrase, effective) {
  const { sections, songKey } = locate(src);
  const parsed = parsePhrase(phrase);
  if (parsed.unknown.length) console.error(`unknown words ignored: ${parsed.unknown.join(', ')}`);
  const edits = [], refused = [], report = [], harmonyReport = [];
  for (const s of sections) {
    if (sectionSel !== '*' && s.name !== sectionSel) continue;
    if (parsed.harmony.length) {
      const bad = ['key', 'progression'].find((f) => s[`${f}Node`] && !isStrLit(s[`${f}Node`]));
      if (bad) refused.push({ section: s.name, layer: '-', axis: bad, reason: `${bad} is an expression here; change it by hand` });
      else {
        const from = { key: s.keyNode?.value ?? songKey, progression: s.progressionNode?.value ?? DEFAULT_PROGRESSION };
        let to;
        try { to = applyHarmonyWords(from, parsed.harmony); } catch (e) { refused.push({ section: s.name, layer: '-', axis: 'key', reason: e.message }); to = from; }
        const inserts = [];
        for (const field of ['key', 'progression']) {
          if (to[field] === from[field]) continue;
          const line = { section: s.name, field, from: from[field], to: to[field] };
          if (field === 'progression') line.describe = chordNames(to.key, parseProgression(to.progression));
          harmonyReport.push(line);
          const node = s[`${field}Node`];
          if (node) edits.push({ start: node.start, end: node.end, text: `'${to[field]}'` });
          else inserts.push(`${field}: '${to[field]}'`);
        }
        if (inserts.length) {
          const at = s.roleNode ? s.roleNode.end : s.spec.start + 1;
          edits.push({ start: at, end: at, text: s.roleNode ? `, ${inserts.join(', ')}` : ` ${inserts.join(', ')},` });
        }
      }
    }
    for (const [layer, L] of Object.entries(s.layers)) {
      if (layerSel !== '*' && layer !== layerSel) continue;
      const eff = effective?.[s.name]?.[layer];
      if (L.spread && !eff) {
        refused.push({ section: s.name, layer, axis: '-', reason: `uses spread (${L.spread}); resolve edits literal values only — set the axis by hand` });
        continue;
      }
      const current = Object.fromEntries([
        ...Object.entries(eff ?? {}).filter(([k, v]) => AXIS_NAMES.includes(k) && typeof v === 'number'),
        ...Object.entries(L.axes).filter(([, a]) => a.value !== 'expr').map(([k, a]) => [k, a.value]), // a literal beside the spread wins, as in JS
      ]);
      const applied = applyDeltas(current, parsed.deltas);
      const inserts = [];
      for (const [axis, r] of Object.entries(applied)) {
        if (!cells[layerBase(layer)]?.[axis]) { report.push({ section: s.name, layer, axis, skipped: 'no adapter on this layer' }); continue; }
        const existing = L.axes[axis];
        if (existing?.value === 'expr' || (!existing && eff && typeof eff[axis] === 'object')) { refused.push({ section: s.name, layer, axis, reason: `${axis} is a signal here; change its range by hand` }); continue; }
        const line = { section: s.name, layer, axis, ...r, contributions: parsed.contributions[axis], describe: cells[layerBase(layer)][axis].describe?.(r.from, r.to) ?? null };
        report.push(line);
        if (r.appliedDelta === 0) continue;
        if (existing) edits.push({ start: existing.node.start, end: existing.node.end, text: fmt(r.to) });
        else inserts.push(`${axis}: ${fmt(r.to)}`);
      }
      if (inserts.length) edits.push(appendProp(L.node, inserts.join(', ')));
    }
  }
  const harmonyNotice = parsed.harmony.length > 0 && layerSel !== '*' && harmonyReport.length > 0;
  return { edits, refused, report, harmonyReport, parsed, harmonyNotice };
}

/** the edit that appends `text` as the last property of object node `obj` (inside the braces when it is empty) */
const appendProp = (obj, text) => { const last = obj.properties.at(-1); return last ? { start: last.end, end: last.end, text: `, ${text}` } : { start: obj.start + 1, end: obj.start + 1, text: ` ${text} ` }; };
const sectionOf = (src, name) => { const { sections } = locate(src); const s = sections.find((x) => x.name === name); if (!s) throw new Error(`no section "${name}"`); return { sections, s }; };
const layerOf = (src, name, layer) => { const L = sectionOf(src, name).s.layers[layer]; if (!L) throw new Error(`no ${layer} layer in section "${name}"`); return L; };

export function applyEdits(src, edits) {
  let out = src;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/**
 * `src` with one axis set: the knob edit. Rewrites the numeric literal at `section.layer.axis`, inserts the key when the
 * layer lacks it (after a spread, so it overrides what the spread brought in), and throws (never guesses) when the
 * value is a signal/expression.
 */
export function setAxis(src, sectionName, layer, axisName, value) {
  const L = layerOf(src, sectionName, layer);
  const a = L.axes[axisName];
  if (a?.value === 'expr') throw new Error(`${axisName} is an expression here: change it by hand`);
  const text = fmt(Math.min(1, Math.max(0, value)));
  return applyEdits(src, [a ? { start: a.node.start, end: a.node.end, text } : appendProp(L.node, `${axisName}: ${text}`)]);
}

const indentBefore = (src, at) => /[ \t]*$/.exec(src.slice(0, at))[0]; // the whitespace opening the line `at` sits on

/** `src` with section `name` swapped with its neighbour (`dir` -1 = earlier, +1 = later); unchanged at the edge. */
export function moveSection(src, name, dir) {
  const { sections, s } = sectionOf(src, name);
  const i = sections.indexOf(s), j = i + dir;
  if (j < 0 || j >= sections.length) return src;
  const a = sections[i].node, b = sections[j].node;
  return applyEdits(src, [{ start: a.start, end: a.end, text: src.slice(b.start, b.end) }, { start: b.start, end: b.end, text: src.slice(a.start, a.end) }]);
}

/** `src` with a copy of section `name` inserted after it under the next free name (verse -> verse2 -> verse3). */
export function duplicateSection(src, name) {
  const { sections, s } = sectionOf(src, name);
  const names = new Set(sections.map((x) => x.name)), base = name.replace(/\d+$/, '');
  let n = 2; while (names.has(`${base}${n}`)) n++;
  const nameNode = s.node.arguments[0];
  const copy = src.slice(s.node.start, nameNode.start) + `'${base}${n}'` + src.slice(nameNode.end, s.node.end);
  return { src: applyEdits(src, [{ start: s.node.end, end: s.node.end, text: `,\n${indentBefore(src, s.node.start)}${copy}` }]), name: `${base}${n}` };
}

/** `src` without `node` and the line it sits on: the indentation before it and the separator after it (`,` and one line break). */
const cutNode = (src, node) => {
  const indent = indentBefore(src, node.start);
  const m = /^,([ \t]*)(\n?)/.exec(src.slice(node.end));
  const end = node.end + (m?.[0].length ?? 0);
  return applyEdits(src, [{ start: node.start - indent.length, end, text: m && !m[2] && indent ? ' ' : '' }]); // on one line, keep one space between the neighbours
};
/**
 * `src` with material `key` of `section.layer` set to the source text `text` (`'square'`, `true`, `{ sd: 'cp' }`), or removed
 * when `text` is null. Materials are strings and flags, so there is no baseline to reason about: set, replace, or drop.
 */
export function setMaterial(src, sectionName, layer, key, text) {
  const L = layerOf(src, sectionName, layer);
  const m = L.mats[key];
  if (text == null) return m ? cutNode(src, m.prop) : src;
  return applyEdits(src, [m ? { start: m.node.start, end: m.node.end, text } : appendProp(L.node, `${key}: ${text}`)]);
}

/** `src` with section `name` called `to`: the name literal only; every other reference to a section is by position. */
export function renameSection(src, name, to) {
  const { sections, s } = sectionOf(src, name);
  if (!to || /['"\\\n]/.test(to)) throw new Error('a section name cannot be empty or contain quotes');
  if (sections.some((x) => x.name === to)) throw new Error(`there is already a section "${to}"`);
  const n = s.node.arguments[0];
  return applyEdits(src, [{ start: n.start, end: n.end, text: `'${to}'` }]);
}

/** `src` without section `name`. */
export const removeSection = (src, name) => cutNode(src, sectionOf(src, name).s.node);
/** `src` without `layer` in section `name`. */
export const removeLayer = (src, name, layer) => cutNode(src, layerOf(src, name, layer).prop);

/** `src` with an empty `layer: {}` added to section `name` (a second drums becomes drums2); returns the key used. */
export function addLayer(src, name, layer) {
  const { s } = sectionOf(src, name);
  let key = layer, n = 2; while (s.layers[key]) key = `${layer}${n++}`;
  const last = s.spec.properties.at(-1);
  const multiline = last && /\n/.test(src.slice(last.end, s.spec.end)); // one part per line: keep it so
  const edit = multiline ? { start: last.end, end: last.end, text: `,\n${indentBefore(src, last.start)}${key}: {}` } : appendProp(s.spec, `${key}: {}`);
  return { src: applyEdits(src, [edit]), key };
}
