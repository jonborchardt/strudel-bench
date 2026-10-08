// todos.json: what is wrong, how often it has been seen, what fixed it. The one memory of the loop. A finding merges
// into an open entry with the same fingerprint (category plus the parts it names) or opens a new one; a wontfix
// fingerprint is reported when seen again and never reopened by the script.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const CATEGORIES = ['stack', 'anatomy', 'expression', 'pose', 'costume', 'style', 'render'];
export const fingerprint = (f) => `${f.category}:${[...f.parts].sort().join('+')}`;
export const nextId = (todos) => 'T' + String(todos.reduce((m, t) => Math.max(m, +t.id.slice(1)), 0) + 1).padStart(3, '0');

const problem = (f) => {
  if (!CATEGORIES.includes(f.category)) return `category must be one of ${CATEGORIES.join(', ')}`;
  if (!Array.isArray(f.parts) || !f.parts.length) return 'a finding names the parts (kind:name) or it is not a finding';
  if (!Number.isInteger(f.severity) || f.severity < 1 || f.severity > 3) return 'severity is 1, 2 or 3';
  if (!f.hash) return 'no hash: the cell is not on this sheet';
  return null;
};

/** Merge findings into todos (mutating). Returns which ids were opened, which seen again, which findings were refused and why, and which wontfix entries were seen. */
export function record(todos, findings, { sheet, today }) {
  const out = { opened: [], seen: [], refused: [], wontfix: [] };
  for (const f of findings) {
    const why = problem(f); if (why) { out.refused.push({ cell: f.cell, why }); continue; }
    const key = fingerprint(f), same = todos.filter((t) => fingerprint(t) === key);
    const open = same.find((t) => t.status === 'open');
    if (open) {
      open.seen++; open.evidence.push(f.hash); if (!open.sheets.includes(sheet)) open.sheets.push(sheet);
      if (f.tuple && !open.tuples.includes(f.tuple)) open.tuples.push(f.tuple); if (f.note && !open.notes.includes(f.note)) open.notes.push(f.note);
      open.severity = Math.max(open.severity, f.severity); out.seen.push(open.id); continue;
    }
    const wf = same.find((t) => t.status === 'wontfix'); if (wf) { out.wontfix.push(wf.id); continue; }
    const id = nextId(todos);
    todos.push({ id, title: f.note ?? key, notes: f.note ? [f.note] : [], category: f.category, parts: [...f.parts].sort(), severity: f.severity, seen: 1, evidence: [f.hash], tuples: f.tuple ? [f.tuple] : [], sheets: [sheet], status: 'open', opened: today, closed: null, commit: null, lint: null, wontfix: null });
    out.opened.push(id);
  }
  return out;
}

/** The open entries, the one to fix first at the top: severity x seen, then the older. */
export const rank = (todos) => todos.filter((t) => t.status === 'open').sort((a, b) => b.severity * b.seen - a.severity * a.seen || a.opened.localeCompare(b.opened) || a.id.localeCompare(b.id));

/** Close one entry: fixed by a commit (and a lint that now catches it), or wontfix with the reason. */
export function close(todos, id, { commit = null, lint = null, wontfix = null, today }) {
  const t = todos.find((x) => x.id === id); if (!t) throw new Error(`no todo ${id}`);
  Object.assign(t, { status: wontfix ? 'wontfix' : 'fixed', closed: today, commit, lint, wontfix });
  return t;
}

export const load = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []);
export const save = (file, todos) => writeFileSync(file, JSON.stringify(todos, null, 1) + '\n');
