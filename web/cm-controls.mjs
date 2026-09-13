// Inline controls for a CodeMirror 6 editor over the song()/section() HLL. The document is the only state: every control
// is found again from the syntax tree after each change (lezer keeps parsing through half-typed code), a widget dispatches
// a transaction that replaces its literal, and alt-dragging a known number changes it in place (the codemirror-interact
// model, driven by the schema instead of a regex). What the schema does not describe stays plain code.
// The widgets themselves live in web/cm-widgets.mjs: this file finds, edits and decorates.
import { StateField, StateEffect, Facet } from '@codemirror/state';
import { EditorView, Decoration, WidgetType } from '@codemirror/view';
import { syntaxTree, ensureSyntaxTree, LanguageSupport } from '@codemirror/language';
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript';
import { widgetFor } from './cm-widgets.mjs';

/** The language for an editor: a whole file, or (with `root`) one expression, the object argument of that HLL call (a pane over the song header). */
export const languageFor = (root) => (root ? new LanguageSupport(javascriptLanguage.configure({ top: 'SingleExpression' })) : javascript());

const PUNCT = /^[(),]$/;
const calleeOf = (call, text) => (call?.name === 'CallExpression' && call.firstChild?.name === 'VariableName' ? text.slice(call.firstChild.from, call.firstChild.to) : null);
const methodOf = (call, text) => { const m = call.firstChild; if (m?.name !== 'MemberExpression' || m.lastChild?.name !== 'PropertyName') return null; return text.slice(m.lastChild.from, m.lastChild.to); };

// the literal a value node is, or null: numbers (with a leading minus), plain strings, booleans, bare identifiers
function literal(node, text) {
  if (!node) return null;
  if (node.name === 'Number') return { kind: 'number', value: Number(text.slice(node.from, node.to)) };
  if (node.name === 'UnaryExpression' && text[node.from] === '-' && node.lastChild?.name === 'Number') return { kind: 'number', value: -Number(text.slice(node.lastChild.from, node.lastChild.to)) };
  if (node.name === 'String') { const q = text[node.from]; if (q === '`') return null; return { kind: 'string', value: text.slice(node.from + 1, node.to - 1), quote: q }; }
  if (node.name === 'BooleanLiteral') return { kind: 'bool', value: text.slice(node.from, node.to) === 'true' };
  if (node.name === 'VariableName') return { kind: 'ident', value: text.slice(node.from, node.to) };
  return null;
}
const keyOf = (prop, text) => { const k = prop.getChild('PropertyDefinition'); return k ? text.slice(k.from, k.to) : null; };

// the keys from the HLL call's object down to this property, or null when it is not inside one: [key] on the spec itself,
// [layer, key] in a layer object, [layer, map, key] inside a map such as drums.sounds. With `root`, the document is itself
// the object argument of that call (a pane over the song header, parsed as one expression). A `const name = {...}` outside
// the calls counts as a layer object ([name, key]) when the file spreads it (`...name`) somewhere: `hll.spread` lists those names.
function hllKeys(prop, text, { hll: calls, root, spread }) {
  const keys = [keyOf(prop, text)];
  let obj = prop.parent;
  for (let depth = 0; obj?.name === 'ObjectExpression' && depth < 3; depth++) {
    const p = obj.parent;
    if (!p || p.name === 'SingleExpression') return root && calls.includes(root) ? keys : null;
    if (p.name === 'ArgList') return calls.includes(calleeOf(p.parent, text)) ? keys : null;
    if (p.name === 'VariableDeclaration') { const v = obj.prevSibling?.prevSibling, name = v?.name === 'VariableDefinition' && text.slice(v.from, v.to); return spread?.has(name) ? [name, ...keys] : null; } // `name = {…}`: this declarator's own name, not the statement's first
    if (p.name !== 'Property') return null;
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
// the HLL number property an expression is (part of) the value of: what 'inherit' arguments and signals take their bounds from
function enclosingNumber(node, text, schema) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.name === 'Property') { const keys = hllKeys(p, text, schema); const spec = keys && specFor(keys, schema.props ?? {}); return spec?.type === 'number' ? { spec, path: keys.join('.') } : null; }
    if (p.name === 'ArgList' && schema.hll.includes(calleeOf(p.parent, text))) return null; // the HLL call's own arguments: not a value
  }
  return null;
}

const KIND = { number: 'number', enum: 'string', tokens: 'string', bool: 'bool', ident: 'ident' }; // spec type -> the literal kind it takes
/** Every literal the schema knows, in document order: { from, to, kind, spec, value, path, quote? }. Pure. */
export function findControls(tree, text, schema, root = null) {
  const spread = new Set(); // every `...name` in the file: the consts whose objects are layer material
  tree.iterate({ enter(n) { if (n.name === 'Spread') { const v = n.node.nextSibling; if (v?.name === 'VariableName') spread.add(text.slice(v.from, v.to)); } } });
  const out = [], hll = { ...schema, root, spread };
  const add = (node, spec, path) => {
    const lit = literal(node, text);
    if (lit && KIND[spec.type] === lit.kind) out.push({ from: node.from, to: node.to, kind: spec.type, spec, value: lit.value, path, quote: lit.quote });
  };
  const args = (call, specs, name) => { // positional arguments; 'inherit' takes the enclosing HLL number's spec
    const inh = specs.includes('inherit') ? enclosingNumber(call, text, hll) : null;
    let i = 0;
    for (let c = call.getChild('ArgList')?.firstChild; c; c = c.nextSibling) {
      if (PUNCT.test(c.name)) continue;
      const s = specs[i] === 'inherit' ? inh?.spec : specs[i];
      if (s) add(c, s, `${inh ? `${inh.path}.` : ''}${name}(${i})`);
      i++;
    }
  };
  const signal = schema.signals?.length ? { type: 'ident', values: schema.signals, title: 'a signal in place of the number' } : null;
  tree.iterate({
    enter(n) {
      if (n.name === 'Property') {
        const keys = hllKeys(n.node, text, hll);
        const spec = keys && specFor(keys, schema.props ?? {});
        if (spec) add(n.node.lastChild, spec, keys.join('.'));
      } else if (n.name === 'CallExpression') {
        const fn = calleeOf(n.node, text), m = methodOf(n.node, text);
        if (fn && schema.calls?.[fn]) args(n.node, schema.calls[fn].args, fn);
        else if (m && schema.methods?.[m]) args(n.node, schema.methods[m].args, m);
      } else if (n.name === 'VariableName' && signal && schema.signals.includes(text.slice(n.from, n.to))) {
        const inh = enclosingNumber(n.node, text, hll);
        if (inh) add(n.node, signal, `${inh.path}.signal`);
      }
    },
  });
  return out.sort((a, b) => a.from - b.from);
}

const frac = (x) => (String(x).split('.')[1] ?? '').length; // digits after the point
const decimals = (spec) => Math.min(6, Math.max(frac(spec.step), frac(spec.min ?? 0))); // enough for the step, and for a floor finer than it (slow's .125 with step 1)
/** Clamp to the spec's bounds and its step; formatted the way the songs write numbers (no leading zero). */
export function quantize(v, spec) {
  const x = Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, Math.round(v / spec.step) * spec.step));
  return +x.toFixed(decimals(spec));
}
export const fmtNum = (v, spec) => String(+v.toFixed(decimals(spec))).replace(/^(-?)0\./, '$1.');

/** The change that sets a control to `value`: a number is re-quantized to the spec, a string keeps its quote character. */
export function editFor(c, value) {
  if (c.kind === 'number') return { from: c.from, to: c.to, insert: fmtNum(quantize(value, c.spec), c.spec) };
  if (c.kind === 'bool') return { from: c.from, to: c.to, insert: String(!!value) };
  if (c.kind === 'ident') return { from: c.from, to: c.to, insert: String(value) };
  const q = c.quote ?? "'";
  return { from: c.from, to: c.to, insert: `${q}${String(value).replaceAll(q, `\\${q}`)}${q}` };
}

export const toggleControls = StateEffect.define();
export const controlsShown = StateField.define({ create: () => false, update: (v, tr) => tr.effects.reduce((a, e) => (e.is(toggleControls) ? e.value : a), v) });
const config = Facet.define({ combine: (v) => v[0] }); // { schema, ui }: ui = host hooks the widgets may use (web/cm-widgets.mjs says which)

// a widget dispatches against the control found at its current position, never a remembered one
function setFrom(view, dom, path, value) {
  if (!dom.isConnected) return; // the document was swapped under an open menu (a pane re-shown on another section): no guessing which literal was meant
  const pos = view.posAtDOM(dom);
  const c = controlsOf(view.state).find((x) => x.to === pos && x.path === path);
  if (c) view.dispatch({ changes: editFor(c, value), userEvent: 'hll.control' });
}
// one WidgetType for every kind: the factory from cm-widgets builds and updates the element
class CtlWidget extends WidgetType {
  constructor(c, make) { super(); this.c = c; this.make = make; }
  eq(o) { return o.make === this.make && o.c.path === this.c.path && o.c.spec === this.c.spec && o.c.value === this.c.value; }
  toDOM(view) {
    const wrap = document.createElement('span'), { c } = this;
    wrap.className = 'cm-hll-ctl'; wrap.dataset.path = c.path;
    const at = () => (wrap.isConnected ? view.posAtDOM(wrap) : null); // where the widget sits now (lines above it may have moved since toDOM)
    wrap.append(this.make.dom(c, { ui: view.state.facet(config).ui, root: view.dom, set: (v) => setFrom(view, wrap, c.path, v), at }));
    return wrap;
  }
  updateDOM(dom) { return dom.dataset.path === this.c.path && !!this.make.update && this.make.update(dom.firstChild, this.c) === true; } // keep the element through a drag or a typed value
  ignoreEvent() { return true; }
}

function build(state) {
  const { schema, ui, root } = state.facet(config), text = state.doc.toString();
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state);
  const controls = findControls(tree, text, schema, root);
  const shown = state.field(controlsShown), ranges = [];
  for (const c of controls) {
    ranges.push(Decoration.mark({ class: 'cm-hll-lit', attributes: { title: `${c.path}${c.spec.title ? `: ${c.spec.title}` : ''}${c.kind === 'number' ? ' (alt-drag to change)' : ''}` } }).range(c.from, c.to));
    const make = shown ? widgetFor(c, ui) : null;
    if (make) ranges.push(Decoration.widget({ widget: new CtlWidget(c, make), side: 1 }).range(c.to));
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

// alt-drag on a known number: the codemirror-interact gesture. Bounded specs cross their range in DRAG_PX; open ones step every 8px.
const DRAG_PX = 200;
const dragValue = (v0, dx, s) => (s.max == null ? v0 + Math.trunc(dx / 8) * s.step : s.scale === 'log' ? v0 * (s.max / s.min) ** (dx / DRAG_PX) : v0 + (dx / DRAG_PX) * (s.max - s.min));
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
  '.cm-hll-ctl select, .cm-hll-ctl input:not([type]), .cm-hll-ctl input[type=number]': { font: 'inherit', fontSize: '.85em', verticalAlign: 'middle' },
  '.cm-hll-ctl input[type=number]': { width: '3.6em' },
  '.cm-hll-ctl input[type=checkbox]': { margin: '0', verticalAlign: 'middle' },
  '.cm-hll-ctl .tokens': { display: 'inline-flex', gap: '.2em', alignItems: 'center', flexWrap: 'wrap' },
});

/** The extension: the schema (web/hll-schema.mjs shape) and optional host hooks for the widgets. Toggle the widgets with `toggleControls.of(bool)`. */
export const hllControls = (schema, { ui = {}, root = null } = {}) => [config.of({ schema, ui, root }), controlsShown, field, drag, theme];
