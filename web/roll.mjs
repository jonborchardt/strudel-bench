// The note roll: degrees x slots over a bass or melody line, the visual editor for `notes`. It edits the subset the
// seeded lines use (scale degrees, ~ rests, @n holds); a line with any other mini-notation stays text-only. The model
// is the slots ([{ deg: number|null, len }]); the page writes lineText() back into the source as the `notes` literal.

/** The slots of `line`, or null when it uses notation the roll does not edit (brackets, alternations, chords, ...). */
export function parseLine(line) {
  const slots = [];
  for (const tok of String(line).trim().split(/\s+/).filter(Boolean)) {
    const m = /^(-?\d+|~)(?:@(\d+))?$/.exec(tok);
    if (!m) return null;
    slots.push({ deg: m[1] === '~' ? null : Number(m[1]), len: m[2] ? Number(m[2]) : 1 });
  }
  return slots.length ? slots : null;
}
export const lineText = (slots) => slots.map((s) => `${s.deg ?? '~'}${s.len > 1 ? `@${s.len}` : ''}`).join(' ');
const at = (slots, col) => { let start = 0; for (let i = 0; i < slots.length; i++) { if (col < start + slots[i].len) return { i, start }; start += slots[i].len; } return null; };
/** Click a cell: a slot's head takes the degree (the same degree again rests it); inside a hold, the hold splits there. */
export function setNote(slots, col, deg) {
  const p = at(slots, col); if (!p) return slots;
  const s = slots[p.i], out = slots.slice();
  if (col === p.start) out[p.i] = { ...s, deg: s.deg === deg ? null : deg };
  else out.splice(p.i, 1, { ...s, len: col - p.start }, { deg, len: s.len - (col - p.start) });
  return out;
}
/** Shift-click a slot's head: the note before it holds through this slot (the two merge). */
export function extendNote(slots, col) {
  const p = at(slots, col); if (!p || p.i === 0 || col !== p.start) return slots;
  const out = slots.slice(); out.splice(p.i - 1, 2, { ...slots[p.i - 1], len: slots[p.i - 1].len + slots[p.i].len }); return out;
}
/** Mount the roll in `el`: a row per degree (0..7 at least, high at the top), a button per slot (a beat mark every `beat`). */
export function mountRoll(el, { slots, beat = 2, onChange }) {
  const draw = () => {
    const degs = slots.map((s) => s.deg).filter((d) => d != null), hi = Math.max(7, ...degs), lo = Math.min(0, ...degs);
    el.style.setProperty('--steps', slots.reduce((n, s) => n + s.len, 0));
    const rows = [];
    for (let d = hi; d >= lo; d--) {
      let cells = '', col = 0;
      for (const s of slots) for (let k = 0; k < s.len; k++, col++) cells += `<button class="st${s.deg === d ? (k ? ' hold' : ' hit') : ''}${col % beat === 0 ? ' beat' : ''}" data-col="${col}" data-deg="${d}" title="degree ${d}, slot ${col + 1}: click sets the note (again rests it); shift-click holds the note before through this slot"></button>`;
      rows.push(`<div class="row"><b>${d}</b>${cells}</div>`);
    }
    el.innerHTML = rows.join('');
  };
  el.onclick = (e) => { const b = e.target.closest('button.st'); if (!b) return; const col = Number(b.dataset.col); slots = e.shiftKey ? extendNote(slots, col) : setNote(slots, col, Number(b.dataset.deg)); draw(); onChange(slots); };
  draw();
  return { set(next) { slots = next; draw(); } };
}
