// Resolve words into axis deltas and edit numeric axis literals inside section() layer objects.
// The resolver edits declarative state only: numeric literals that are direct values of axis keys.
// Shared by scripts/resolve.mjs (cli) and the Compose page (mix card: knobs and the phrase box); acorn resolves
// through node in scripts and through index.html's import map in the browser.
import * as acorn from 'acorn';
import { AXIS_NAMES, cells, axis as axisOf } from './axes.mjs';
import './layers.mjs';
import { layerBase } from './song.mjs';
import { parsePhrase, applyDeltas } from './vocab.mjs';
import { clamp01 } from './strudel.mjs';
import { parseProgression, applyHarmonyWords, chordNames, DEFAULT_PROGRESSION } from './harmony.mjs';

const isNumLit = (n) => (n.type === 'Literal' && typeof n.value === 'number') || (n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'Literal');
const numOf = (n) => (n.type === 'Literal' ? n.value : -n.argument.value);
const keyName = (p) => (p.key.type === 'Identifier' ? p.key.name : p.key.value);
const isStrLit = (n) => n.type === 'Literal' && typeof n.value === 'string';
// a material's value when it is plain data: a string, a boolean, a number, or an object of those (drums' sounds); anything else is 'expr'
const litValue = (n) => {
  if (n.type === 'Literal' && ['string', 'boolean', 'number'].includes(typeof n.value)) return n.value;
  if (n.type === 'ObjectExpression' && n.properties.every((p) => p.type === 'Property' && p.value.type === 'Literal')) return Object.fromEntries(n.properties.map((p) => [keyName(p), p.value.value]));
  if (n.type === 'ArrayExpression' && n.elements.every((e) => e && (isNumLit(e) || isStrLit(e)))) return n.elements.map((e) => (isStrLit(e) ? e.value : numOf(e)));
  return 'expr';
};

export function locate(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  const sections = [];
  let songKey = 'C:minor', song = null; // song: the header object node of song(...), for a pane over it
  (function walk(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'song' && node.arguments[0]?.type === 'ObjectExpression') {
      song ??= node.arguments[0];
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
        if (layer === 'dropout') { s.dropoutNode = prop.value; continue; }
        if (layer === 'sweep') { s.sweepNode = prop.value; continue; }
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
  return { sections, songKey, song };
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
      // axis -> { edit: {start,end,text} } | { insert: 'axis: text' }; a motion below overwrites a delta's own entry for the same axis
      // so the two never both emit an edit on the same literal (planEdits used to splice both, producing unparseable source).
      const byAxis = new Map();
      for (const [axis, r] of Object.entries(applied)) {
        if (!cells[layerBase(layer)]?.[axis]) { report.push({ section: s.name, layer, axis, skipped: 'no adapter on this layer' }); continue; }
        const existing = L.axes[axis];
        if (existing?.value === 'expr' || (!existing && eff && typeof eff[axis] === 'object')) { refused.push({ section: s.name, layer, axis, reason: `${axis} is a signal here; change its range by hand` }); continue; }
        const line = { section: s.name, layer, axis, ...r, contributions: parsed.contributions[axis], describe: cells[layerBase(layer)][axis].describe?.(r.from, r.to) ?? null };
        report.push(line);
        if (r.appliedDelta === 0) continue;
        byAxis.set(axis, existing ? { edit: { start: existing.node.start, end: existing.node.end, text: fmt(r.to) } } : { insert: `${axis}: ${fmt(r.to)}` });
      }
      const motionAxes = new Set(); // axes already given a movement by this phrase, on this layer
      for (const m of parsed.motion) {
        if (!cells[layerBase(layer)]?.[m.axis]) { report.push({ section: s.name, layer, axis: m.axis, skipped: 'no adapter on this layer' }); continue; }
        if (axisOf(m.axis).kind === 'structural') { refused.push({ section: s.name, layer, axis: m.axis, reason: `${m.axis} is structural: it takes a number, not a movement` }); continue; }
        const existing = L.axes[m.axis];
        if (existing?.value === 'expr' || (!existing && eff && typeof eff[m.axis] === 'object')) { refused.push({ section: s.name, layer, axis: m.axis, reason: `${m.axis} is a signal here; change its range by hand` }); continue; }
        if (motionAxes.has(m.axis)) { refused.push({ section: s.name, layer, axis: m.axis, reason: `${m.axis} already has a movement in this phrase; one per axis` }); continue; }
        motionAxes.add(m.axis);
        const v = applied[m.axis]?.to ?? current[m.axis] ?? 0.5, c = (x) => fmt(clamp01(x));
        const text = m.fn === 'rise' ? `ramp(${c(v)}, ${c(v + .3)})` : m.fn === 'fall' ? `ramp(${c(v)}, ${c(v - .3)})` : `${m.fn}(${c(v - .2)}, ${c(v + .2)})`;
        report.push({ section: s.name, layer, axis: m.axis, from: v, motion: text });
        byAxis.set(m.axis, existing ? { edit: { start: existing.node.start, end: existing.node.end, text } } : { insert: `${m.axis}: ${text}` });
      }
      const inserts = [];
      for (const entry of byAxis.values()) { if (entry.edit) edits.push(entry.edit); else inserts.push(entry.insert); }
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

/** `src` with `section.layer.axis` set to the source text `text`, whatever it was (a number, a signal, a movement); the knob's setAxis refuses expressions, this is the pick that replaces them. */
export function setAxisText(src, sectionName, layer, axisName, text) {
  const L = layerOf(src, sectionName, layer), a = L.axes[axisName];
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
  const lineStart = src.lastIndexOf('\n', node.start - 1) + 1;
  const prev = /,[ \t]*$/.exec(src.slice(lineStart, node.start)); // something before it on the same line: cut the separator before it (`role: 'x', key: 'y',\n` keeps its line break)
  if (prev) return applyEdits(src, [{ start: lineStart + prev.index, end: node.end, text: '' }]);
  const m = /^,([ \t]*)(\n?)/.exec(src.slice(node.end)); // first on its line: cut the line, separator included
  const oneLine = m && !m[2]; // `{ drums: {}, pad: {} }`: the next property takes this one's place, the space after `{` stays
  return applyEdits(src, [{ start: node.start - (oneLine ? 0 : indent.length), end: node.end + (m?.[0].length ?? 0), text: '' }]);
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

/** `src` with section `name`'s `key`/`progression` (a quoted string) or `dropout`/`sweep` (a number) set to the source text `text`, or removed when null. */
export function setSectionField(src, name, field, text) {
  if (!['key', 'progression', 'dropout', 'sweep'].includes(field)) throw new Error(`not a section field: ${field}`);
  const s = locate(src).sections.find((x) => x.name === name);
  if (!s) throw new Error(`no section "${name}"`);
  const node = s[`${field}Node`];
  const isLit = field === 'dropout' || field === 'sweep' ? isNumLit : isStrLit;
  if (node && !isLit(node)) throw new Error(`${field} is an expression here: change it by hand`);
  if (text == null) return node ? cutNode(src, s.spec.properties.find((p) => p.value === node)) : src;
  if (node) return applyEdits(src, [{ start: node.start, end: node.end, text }]);
  const at = s.roleNode ? s.roleNode.end : s.spec.start + 1;
  return applyEdits(src, [{ start: at, end: at, text: s.roleNode ? `, ${field}: ${text}` : s.spec.properties.length ? ` ${field}: ${text},` : ` ${field}: ${text} ` }]);
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

/**
 * `src` with header key `key` of `song({ ... })` set to the source text `text` (a literal), or removed when `text` is null.
 * `bpm` and `cps` are exclusive (song() throws on both), so setting one drops the other.
 */
export function setSongField(src, key, text, by = key) {
  const other = { bpm: 'cps', cps: 'bpm' }[key];
  // `by` is the key the caller asked for: when the exclusive sibling is what cannot be cut, the message says which set it stopped
  if (text != null && other) src = setSongField(src, other, null, key);
  const { song } = locate(src);
  if (!song) throw new Error('no song({ ... }) header to set the key in');
  const p = song.properties.find((x) => x.type === 'Property' && keyName(x) === key);
  if (p && p.value.type !== 'Literal') throw new Error(by === key ? `${key} is an expression here: change it by hand` : `${by} cannot replace ${key} here: ${key} is an expression, change it by hand`);
  if (text == null) return p ? cutNode(src, p) : src;
  return applyEdits(src, [p ? { start: p.value.start, end: p.value.end, text } : appendProp(song, `${key}: ${text}`)]);
}

/** `src` with `pack` declared in the song header's `packs` list: inserted when there is none, appended when there is, unchanged when it is already listed. */
export function addPack(src, pack) {
  const { song } = locate(src);
  if (!song) throw new Error('no song({ ... }) header to declare the pack in');
  const p = song.properties.find((x) => x.type === 'Property' && keyName(x) === 'packs');
  if (!p) return applyEdits(src, [appendProp(song, `packs: ['${pack}']`)]);
  if (p.value.type !== 'ArrayExpression') throw new Error('packs is an expression here: declare the pack by hand');
  if (p.value.elements.some((e) => e?.type === 'Literal' && e.value === pack)) return src;
  const last = p.value.elements.at(-1);
  const at = last ? last.end : p.value.start + 1;
  return applyEdits(src, [{ start: at, end: at, text: last ? `, '${pack}'` : `'${pack}'` }]);
}
