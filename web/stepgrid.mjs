// The step grid: voices x steps over a drum template, the visual editor for a written template (lib/grid.mjs grammar).
// The model is the grid strings themselves; the page writes templateText() back into the source as the `template` literal.
import { parseGrid, TEMPLATES } from '../lib/grid.mjs';

const CYCLE = { '.': 'x', x: 'X', X: 'o', o: '.' };
const NAME = { '.': 'rest', x: 'hit', X: 'accent', o: 'ghost' };
export function gridRows(template, steps) {
  const t = template && typeof template === 'object' ? template : TEMPLATES[template ?? 'house'];
  if (!t) throw new Error(`unknown template "${template}"`);
  return Object.entries(t).map(([voice, g]) => { const { grid, bars } = parseGrid(g, steps); return { voice, grid, bars }; });
}
export const toggleStep = (rows, voice, step) => rows.map((r) => (r.voice !== voice ? r : { ...r, grid: r.grid.slice(0, step) + CYCLE[r.grid[step]] + r.grid.slice(step + 1) }));
export function addVoice(rows, voice, steps) {
  if (rows.some((r) => r.voice === voice)) throw new Error(`voice "${voice}" is already in the grid`);
  return [...rows, { voice, grid: '.'.repeat(steps), bars: 1 }];
}
const barsOf = (r) => (r.grid.match(new RegExp(`.{1,${r.grid.length / r.bars}}`, 'g')) ?? [r.grid]).join('|');
export function templateText(rows) {
  const items = rows.map((r) => `${r.voice}: '${barsOf(r)}'`);
  return rows.some((r) => r.bars > 1) ? `{\n      ${items.join(',\n      ')},\n    }` : `{ ${items.join(', ')} }`;
}
/** Mount the grid in `el`: a row per voice, a button per step (a beat mark every `pulse`), click toggles and reports the rows. */
export function mountStepGrid(el, { rows, pulse, onChange }) {
  const draw = () => {
    el.style.setProperty('--steps', Math.max(...rows.map((r) => r.grid.length)));
    el.innerHTML = rows.map((r) => `<div class="row"><b>${r.voice}</b>${[...r.grid].map((c, i) => `<button class="st ${NAME[c]}${i % pulse === 0 ? ' beat' : ''}" data-voice="${r.voice}" data-step="${i}" title="${r.voice} step ${i + 1}: ${NAME[c]} (click cycles rest, hit, accent, ghost)">${c === '.' ? '' : c}</button>`).join('')}</div>`).join('');
  };
  el.onclick = (e) => { const b = e.target.closest('button.st'); if (!b) return; rows = toggleStep(rows, b.dataset.voice, Number(b.dataset.step)); draw(); onChange(rows); };
  draw();
  return { set(next) { rows = next; draw(); } };
}
