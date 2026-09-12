// Inline controls for a CodeMirror 6 editor over the song()/section() HLL. The document is the only state: every control
// is found again from the syntax tree after each change (lezer keeps parsing through half-typed code), a slider or select
// dispatches a transaction that replaces its literal, and alt-dragging a known number changes it in place (the
// codemirror-interact model, driven by the schema instead of a regex). What the schema does not describe stays plain code.
import { StateField, StateEffect, Facet } from '@codemirror/state';
import { EditorView, Decoration, WidgetType } from '@codemirror/view';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';

const PUNCT = /^[(),]$/;
const calleeOf = (call, text) => (call?.name === 'CallExpression' && call.firstChild?.name === 'VariableName' ? text.slice(call.firstChild.from, call.firstChild.to) : null);

// the literal a value node is, or null: numbers (with a leading minus), plain strings
function literal(node, text) {
  if (!node) return null;
  if (node.name === 'Number') return { kind: 'number', value: Number(text.slice(node.from, node.to)) };
  if (node.name === 'UnaryExpression' && text[node.from] === '-' && node.lastChild?.name === 'Number') return { kind: 'number', value: -Number(text.slice(node.lastChild.from, node.lastChild.to)) };
  if (node.name === 'String') { const q = text[node.from]; if (q === '`') return null; return { kind: 'string', value: text.slice(node.from + 1, node.to - 1), quote: q }; }
  if (node.name === 'BooleanLiteral') return { kind: 'bool', value: text.slice(node.from, node.to) === 'true' };
  return null;
}
const keyOf = (prop, text) => { const k = prop.getChild('PropertyDefinition'); return k ? text.slice(k.from, k.to) : null; };

// the keys from the HLL call's object down to this property, or null when it is not inside one: [key] on the spec itself,
// [layer, key] in a layer object, [layer, map, key] inside a map such as drums.sounds
function hllKeys(prop, text, calls) {
  const keys = [keyOf(prop, text)];
  let obj = prop.parent;
  for (let depth = 0; obj?.name === 'ObjectExpression' && depth < 3; depth++) {
    const p = obj.parent;
    if (p?.name === 'ArgList') return calls.includes(calleeOf(p.parent, text)) ? keys : null;
    if (p?.name !== 'Property') return null;
    keys.unshift(keyOf(p, text));
    obj = p.parent;
  }
  return null;
}
// the spec for a property: its own key at the spec or layer level, or an entry of a map one level up
function specFor(keys, props) {
  const key = keys.at(-1);
  if (keys.length <= 2 && props[key] && props[key].type !== 'map') return props[key];
  const m = keys.length >= 2 ? props[keys.at(-2)] : null;
  if (m?.type === 'map' && (!m.keys || m.keys.includes(key))) return { type: 'enum', values: m.values, labels: m.labels, list: m.list, title: m.title };
  return null;
}

const matches = (spec, lit) => (spec.type === 'number' && lit.kind === 'number') || (spec.type === 'enum' && lit.kind === 'string') || (spec.type === 'bool' && lit.kind === 'bool');
/** A spec's legal values, resolving a host-supplied function. */
export const valuesOf = (spec) => (typeof spec.values === 'function' ? spec.values() : spec.values) ?? [];
const labelsOf = (spec) => (typeof spec.labels === 'function' ? spec.labels() : spec.labels) ?? {};

/** Every literal the schema knows, in document order: { from, to, kind: 'number' | 'enum', spec, value, path, quote? }. Pure. */
export function findControls(tree, text, schema, calls = ['song', 'section']) {
  const out = [];
  const add = (node, spec, path) => {
    const lit = literal(node, text);
    if (lit && matches(spec, lit)) out.push({ from: node.from, to: node.to, kind: spec.type, spec, value: lit.value, path, quote: lit.quote });
  };
  tree.iterate({
    enter(n) {
      if (n.name === 'Property') {
        const keys = hllKeys(n.node, text, calls);
        const spec = keys && specFor(keys, schema.props ?? {});
        if (spec) add(n.node.lastChild, spec, keys.join('.'));
      } else if (n.name === 'CallExpression') {
        const name = calleeOf(n.node, text), args = schema.calls?.[name]?.args;
        if (!args) return;
        let i = 0;
        for (let c = n.node.getChild('ArgList')?.firstChild; c; c = c.nextSibling) if (!PUNCT.test(c.name)) { if (args[i]) add(c, args[i], `${name}(${i})`); i++; }
      }
    },
  });
  return out.sort((a, b) => a.from - b.from);
}

const decimals = (step) => Math.max(0, Math.ceil(-Math.log10(step || 1)));
/** Clamp to the spec's bounds and its step; formatted the way the songs write numbers (no leading zero). */
export function quantize(v, spec) {
  const x = Math.min(spec.max, Math.max(spec.min, Math.round(v / spec.step) * spec.step));
  return +x.toFixed(decimals(spec.step));
}
export const fmtNum = (v, spec) => String(+v.toFixed(decimals(spec.step))).replace(/^(-?)0\./, '$1.');

/** The change that sets a control to `value`: a number is re-quantized to the spec, a string keeps its quote character. */
export function editFor(c, value) {
  if (c.kind === 'number') return { from: c.from, to: c.to, insert: fmtNum(quantize(value, c.spec), c.spec) };
  if (c.kind === 'bool') return { from: c.from, to: c.to, insert: String(!!value) };
  const q = c.quote ?? "'";
  return { from: c.from, to: c.to, insert: `${q}${String(value).replaceAll(q, `\\${q}`)}${q}` };
}

// slider position (0..1 for log specs, the value itself otherwise) <-> value
const toSlider = (v, s) => (s.scale === 'log' ? Math.log(v / s.min) / Math.log(s.max / s.min) : v);
const fromSlider = (t, s) => (s.scale === 'log' ? s.min * (s.max / s.min) ** t : Number(t));
const DRAG_PX = 200; // pixels of alt-drag across the whole range
const dragValue = (v0, dx, s) => (s.scale === 'log' ? v0 * (s.max / s.min) ** (dx / DRAG_PX) : v0 + (dx / DRAG_PX) * (s.max - s.min));

export const toggleControls = StateEffect.define();
export const controlsShown = StateField.define({ create: () => false, update: (v, tr) => tr.effects.reduce((a, e) => (e.is(toggleControls) ? e.value : a), v) });
const schemaFacet = Facet.define({ combine: (v) => v[0] });

// a widget dispatches against the control found at its current position, never a remembered one
function setFrom(view, dom, path, value) {
  const pos = view.posAtDOM(dom);
  const list = controlsOf(view.state);
  const c = list.find((x) => x.to === pos && x.path === path) ?? list.find((x) => x.path === path);
  if (c) view.dispatch({ changes: editFor(c, value), userEvent: 'hll.control' });
}
class NumWidget extends WidgetType {
  constructor(c) { super(); this.c = c; }
  eq(o) { return o.c.path === this.c.path && o.c.spec === this.c.spec && o.c.value === this.c.value; }
  toDOM(view) {
    const { c } = this, wrap = document.createElement('span'), i = document.createElement('input');
    wrap.className = 'cm-hll-ctl'; i.type = 'range'; i.title = c.path;
    if (c.spec.scale === 'log') { i.min = 0; i.max = 1; i.step = 0.001; } else { i.min = c.spec.min; i.max = c.spec.max; i.step = c.spec.step; }
    i.value = toSlider(c.value, c.spec);
    i.oninput = () => setFrom(view, wrap, c.path, fromSlider(i.value, c.spec));
    wrap.append(i);
    return wrap;
  }
  updateDOM(dom) { const i = dom.firstChild; if (i?.title !== this.c.path) return false; if (document.activeElement !== i) i.value = toSlider(this.c.value, this.c.spec); return true; } // the same slider through a drag: a rebuilt node would drop it
  ignoreEvent() { return true; }
}
const LONG = 64; // more values than a select reads well: a text box with a datalist, shared per `list` name under the editor
class EnumWidget extends WidgetType {
  constructor(c) { super(); this.c = c; }
  eq(o) { return o.c.path === this.c.path && o.c.spec === this.c.spec && o.c.value === this.c.value; }
  toDOM(view) {
    const { c } = this, wrap = document.createElement('span'), values = valuesOf(c.spec), labels = labelsOf(c.spec);
    wrap.className = 'cm-hll-ctl';
    if (values.length > LONG) {
      const id = `cm-hll-${c.spec.list ?? c.path.split('.').pop()}`;
      if (!view.dom.querySelector(`#${id}`)) { const dl = document.createElement('datalist'); dl.id = id; for (const v of values) dl.append(new Option(labels[v] ?? v, v)); view.dom.append(dl); }
      const i = document.createElement('input');
      i.title = c.path; i.setAttribute('list', id); i.value = c.value; i.size = Math.max(6, Math.min(24, c.value.length + 2)); i.autocomplete = 'off';
      i.onchange = () => { if (i.value !== c.value) setFrom(view, wrap, c.path, i.value); };
      i.onkeydown = (e) => { if (e.key === 'Enter') i.blur(); }; // commit; the editor's keymap must not see it
      wrap.append(i);
    } else {
      const s = document.createElement('select');
      s.title = c.path;
      for (const v of values.includes(c.value) ? values : [c.value, ...values]) s.append(new Option(labels[v] ?? v, v, false, v === c.value));
      s.onchange = () => setFrom(view, wrap, c.path, s.value);
      wrap.append(s);
    }
    return wrap;
  }
  ignoreEvent() { return true; }
}
class BoolWidget extends WidgetType {
  constructor(c) { super(); this.c = c; }
  eq(o) { return o.c.path === this.c.path && o.c.value === this.c.value; }
  toDOM(view) {
    const { c } = this, wrap = document.createElement('span'), i = document.createElement('input');
    wrap.className = 'cm-hll-ctl'; i.type = 'checkbox'; i.title = c.path; i.checked = c.value;
    i.onchange = () => setFrom(view, wrap, c.path, i.checked);
    wrap.append(i);
    return wrap;
  }
  ignoreEvent() { return true; }
}
const widgetFor = (c) => (c.kind === 'number' ? new NumWidget(c) : c.kind === 'bool' ? new BoolWidget(c) : new EnumWidget(c));

function build(state) {
  const schema = state.facet(schemaFacet), text = state.doc.toString();
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state);
  const controls = findControls(tree, text, schema, schema.hll);
  const shown = state.field(controlsShown), ranges = [];
  for (const c of controls) {
    ranges.push(Decoration.mark({ class: 'cm-hll-lit', attributes: { title: `${c.path}${c.spec.title ? `: ${c.spec.title}` : ''}${c.kind === 'number' ? ' (alt-drag to change)' : ''}` } }).range(c.from, c.to));
    if (shown) ranges.push(Decoration.widget({ widget: widgetFor(c), side: 1 }).range(c.to));
  }
  return { controls, deco: Decoration.set(ranges, true) };
}
const field = StateField.define({
  create: build,
  update: (v, tr) => (tr.docChanged || tr.effects.some((e) => e.is(toggleControls)) || syntaxTree(tr.state) !== syntaxTree(tr.startState) ? build(tr.state) : v),
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});
/** The controls the editor currently shows, with positions in the current document. */
export const controlsOf = (state) => state.field(field).controls;
export const decorationsOf = (state) => state.field(field).deco;

// alt-drag on a known number: the codemirror-interact gesture, bounded by the spec
const drag = EditorView.domEventHandlers({
  mousedown(e, view) {
    if (!e.altKey || e.button !== 0) return false;
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
    const c0 = pos == null ? null : controlsOf(view.state).find((c) => c.kind === 'number' && c.from <= pos && pos <= c.to);
    if (!c0) return false;
    e.preventDefault();
    const { from, spec, value: v0 } = c0, x0 = e.clientX;
    const move = (ev) => {
      const c = controlsOf(view.state).find((x) => x.kind === 'number' && x.from === from);
      if (!c) return up();
      const v = quantize(dragValue(v0, ev.clientX - x0, spec), spec);
      if (v !== c.value) view.dispatch({ changes: editFor(c, v), userEvent: 'hll.drag' });
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return true;
  },
});

const theme = EditorView.baseTheme({
  '.cm-hll-lit': { borderBottom: '1px dotted currentColor' },
  '.cm-hll-ctl': { display: 'inline-block', verticalAlign: 'middle', margin: '0 .4em 0 .3em' },
  '.cm-hll-ctl input[type=range]': { width: '6em', height: '.9em', margin: '0', verticalAlign: 'middle' },
  '.cm-hll-ctl select, .cm-hll-ctl input:not([type])': { font: 'inherit', fontSize: '.85em', verticalAlign: 'middle' },
  '.cm-hll-ctl input[type=checkbox]': { margin: '0', verticalAlign: 'middle' },
});

/** The extension: pass the schema (web/hll-schema.mjs shape). Toggle the widgets with `toggleControls.of(bool)`. */
export const hllControls = (schema) => [schemaFacet.of(schema), controlsShown, field, drag, theme];
