// The inline widgets of web/cm-controls.mjs, one factory per kind: { dom(control, ctx) -> element, update?(element, control)
// -> true to keep the element when the value changed (a slider mid-drag, a spinner being typed in) }.
// ctx: set(value) writes the literal; ui = the host's hooks, all optional: pick(btn, { names, labels, cur, ph, icon,
// onPick, preview }) opens its menu, audition(path, value, btn) plays a value, canAudition(path) says which can be heard,
// icon(path, value) returns html for an image before a value; root = the editor's element (for shared datalists).
// widgetFor chooses by control kind and what the host offers; delete an entry here and its line there to drop a kind.

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** A spec's legal values and labels, resolving host-supplied functions. */
export const valuesOf = (spec) => (typeof spec.values === 'function' ? spec.values() : spec.values) ?? [];
export const labelsOf = (spec) => (typeof spec.labels === 'function' ? spec.labels() : spec.labels) ?? {};

// slider position (0..1 for log specs, the value itself otherwise) <-> value
const toSlider = (v, s) => (s.scale === 'log' ? Math.log(v / s.min) / Math.log(s.max / s.min) : v);
const fromSlider = (t, s) => (s.scale === 'log' ? s.min * (s.max / s.min) ** t : Number(t));

/** number with bounds */
export const slider = {
  dom(c, { set }) {
    const i = el('input', { type: 'range', title: c.path });
    if (c.spec.scale === 'log') { i.min = 0; i.max = 1; i.step = 0.001; } else { i.min = c.spec.min; i.max = c.spec.max; i.step = c.spec.step; }
    const fill = () => i.style.setProperty('--v', (i.value - i.min) / (i.max - i.min)); // the mixer's track fill (.rack input[type=range])
    i.value = toSlider(c.value, c.spec); fill();
    i.oninput = () => { fill(); set(fromSlider(i.value, c.spec)); };
    return i;
  },
  update(i, c) { if (document.activeElement !== i) { i.value = toSlider(c.value, c.spec); i.style.setProperty('--v', (i.value - i.min) / (i.max - i.min)); } return true; },
};
/** number with a floor but no ceiling: seeds, bar counts, slow/fast factors */
export const spinner = {
  dom(c, { set }) {
    const i = el('input', { type: 'number', title: c.path, value: c.value });
    if (c.spec.min != null) i.min = c.spec.min;
    if (c.spec.max != null) i.max = c.spec.max;
    i.step = c.spec.step;
    i.oninput = () => { const v = Number(i.value); if (i.value !== '' && Number.isFinite(v)) set(v); };
    i.onkeydown = (e) => { if (e.key === 'Enter') i.blur(); };
    return i;
  },
  update(i, c) { if (document.activeElement !== i) i.value = c.value; return true; },
};
/** true / false */
export const check = {
  dom(c, { set }) { const i = el('input', { type: 'checkbox', title: c.path, checked: c.value }); i.onchange = () => set(i.checked); return i; },
  update(i, c) { i.checked = c.value; return true; },
};
/** enum without a host menu: a native select */
export const select = {
  dom(c, { set }) {
    const values = valuesOf(c.spec), labels = labelsOf(c.spec);
    const s = el('select', { title: c.path });
    for (const v of values.includes(c.value) ? values : [c.value, ...values]) s.append(new Option(labels[v] ?? v, v, false, v === c.value));
    s.onchange = () => set(s.value);
    return s;
  },
};
/** enum through the host's menu (the mixer's, a play button per row), behind a button showing the value, with its own play button when the value can be heard */
export const pick = {
  dom(c, { set, ui }) {
    const wrap = el('span', { className: 'pickw' }), btn = el('button', { className: 'pick', title: c.path });
    const hear = ui.audition && ui.canAudition?.(c.path);
    btn.innerHTML = `${ui.icon?.(c.path, c.value) ?? ''}${c.value ? esc(labelsOf(c.spec)[c.value] ?? c.value) : '<i>none</i>'}`;
    btn.onclick = () => ui.pick(btn, { names: valuesOf(c.spec), labels: labelsOf(c.spec), cur: c.value, icon: ui.icon && ((v) => ui.icon(c.path, v)), onPick: set, preview: hear ? (v, b) => ui.audition(c.path, v, b) : undefined });
    wrap.append(btn);
    if (hear) { const pv = el('button', { className: 'pv', title: 'hear it (pauses the song)', innerHTML: '&#9654;' }); pv.onclick = () => ui.audition(c.path, c.value, pv); wrap.append(pv); }
    return wrap;
  },
};
/** a string of tokens, each a pick button, plus one to append; brackets stay as text so `[i VI]` groups survive */
export const tokens = {
  dom(c, { set, ui }) {
    const parts = c.value.replace(/\[/g, ' [ ').replace(/\]/g, ' ] ').trim().split(/\s+/).filter(Boolean), values = valuesOf(c.spec);
    const row = el('span', { className: 'tokens' });
    const write = (list) => set(list.join(c.spec.sep ?? ' ').replace(/\[ /g, '[').replace(/ \]/g, ']'));
    const menu = (btn, i) => ui.pick(btn, { names: values, cur: parts[i] ?? '', ph: i < parts.length ? 'remove' : undefined, onPick: (v) => { const next = [...parts]; if (i < parts.length) { if (v) next[i] = v; else next.splice(i, 1); } else if (v) next.push(v); write(next); } });
    parts.forEach((t, i) => {
      if (t === '[' || t === ']') return row.append(el('span', { textContent: t }));
      const b = el('button', { className: 'pick', textContent: t, title: `${c.path}, chord ${i + 1}` });
      b.onclick = () => menu(b, i);
      row.append(b);
    });
    const add = el('button', { className: 'pick add', textContent: '+', title: `add a chord to ${c.path}` });
    add.onclick = () => menu(add, parts.length);
    row.append(add);
    return row;
  },
};

/** The factory for a control, or null when nothing fits: numbers by whether they have a ceiling, strings by whether the host has a menu. */
export function widgetFor(c, ui = {}) {
  if (c.kind === 'number') return c.spec.max == null ? spinner : slider;
  if (c.kind === 'bool') return check;
  if (c.kind === 'tokens') return ui.pick ? tokens : null;
  return ui.pick ? pick : select; // enum, ident
}
