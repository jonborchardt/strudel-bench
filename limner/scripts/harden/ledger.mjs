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
  const bad = f.parts.find((p) => !/^(unknown(:\w+)?|\w+:\w+)$/.test(p)); if (bad !== undefined) return `parts are kind:name, or unknown[:word]: got "${bad}"`;
  if (!f.hash) return 'no hash: the cell is not on this sheet';
  return null;
};

/** Merge findings into todos (mutating). Returns which ids were opened, which seen again, which findings were refused and why, and which wontfix entries were seen. */
export function record(todos, findings, { sheet, today }) {
  const out = { opened: [], seen: [], refused: [], wontfix: [], accepted: [] };
  // all or nothing: one malformed finding and the file is recorded again whole, so nothing is counted twice
  for (const f of findings) { const why = problem(f); if (why) out.refused.push({ cell: f.cell, why }); }
  if (out.refused.length) return out;
  for (const f of findings) {
    const key = fingerprint(f), same = todos.filter((t) => fingerprint(t) === key || t.aliases?.includes(key));
    let open = same.find((t) => t.status === 'open');
    if (!open) { // a merged entry counts on its target, down the chain; several merged entries can share a fingerprint, so take the one whose chain ends open
      const end = (m) => { const seenIds = new Set(); while (m?.status === 'merged' && !seenIds.has(m.id)) { seenIds.add(m.id); m = todos.find((t) => t.id === m.mergedInto); } return m; };
      open = same.filter((t) => t.status === 'merged').map(end).find((m) => m?.status === 'open');
    }
    // an open entry of the same category that already names every part of this finding is this fault (T192 names six beards; a finding on one of them counts there)
    if (!open && !f.parts.some((p) => p.startsWith('unknown'))) open = todos.find((t) => t.status === 'open' && t.category === f.category && f.parts.every((p) => t.parts.includes(p)));
    if (open) {
      open.seen++; open.evidence.push(f.hash); if (!open.sheets.includes(sheet)) open.sheets.push(sheet);
      if (f.tuple && !open.tuples.includes(f.tuple)) open.tuples.push(f.tuple); if (f.note && !open.notes.includes(f.note)) open.notes.push(f.note);
      open.severity = Math.max(open.severity, f.severity); out.seen.push(open.id); out.accepted.push({ cell: f.cell, category: f.category, severity: f.severity, id: open.id }); continue;
    }
    const wf = same.find((t) => t.status === 'wontfix'); if (wf) { out.wontfix.push(wf.id); continue; }
    const id = nextId(todos);
    todos.push({ id, title: f.note ?? key, notes: f.note ? [f.note] : [], category: f.category, parts: [...f.parts].sort(), severity: f.severity, seen: 1, evidence: [f.hash], tuples: f.tuple ? [f.tuple] : [], sheets: [sheet], status: 'open', opened: today, closed: null, commit: null, lint: null, wontfix: null, attempts: 0, tried: [] });
    out.opened.push(id); out.accepted.push({ cell: f.cell, category: f.category, severity: f.severity, id });
  }
  return out;
}

export const MAX_ATTEMPTS = 3;
export const isParked = (t) => t.status === 'open' && (t.attempts ?? 0) >= MAX_ATTEMPTS;

/** Count one repair try on an entry; at MAX_ATTEMPTS it parks and leaves the ranking. */
export function attempt(todos, id, note, { today }) {
  const t = todos.find((x) => x.id === id); if (!t) throw new Error(`no todo ${id}`);
  t.attempts = (t.attempts ?? 0) + 1; (t.tried ??= []).push(`${today}: ${note}`);
  return t;
}

/** Defects per sheet by severity, and fresh defects per fresh cell over the first half of the sheets against the second: do unseen combinations produce fewer faults over time, or is the ledger only shrinking. */
export function statsOf(sheets) {
  const rows = sheets.map((s) => {
    const freshOf = new Map(s.cells.map((c) => [c.n, c.fresh === true])), by = (v) => s.findings.filter((f) => f.severity === v).length;
    return { sheet: s.sheet, cells: s.cells.filter((c) => c.tuple.cast !== 'calibration').length, freshCells: s.cells.filter((c) => c.fresh === true).length, s3: by(3), s2: by(2), s1: by(1), freshDefects: s.findings.filter((f) => freshOf.get(f.cell)).length };
  });
  const half = Math.floor(rows.length / 2), sum = (rs) => { const cells = rs.reduce((a, r) => a + r.freshCells, 0), defects = rs.reduce((a, r) => a + r.freshDefects, 0); return { cells, defects, rate: cells ? Math.round((defects / cells) * 100) / 100 : null }; };
  // every cell is a new seed, a face never drawn before, so defects per cell measures unseen faces too, and it does not run dry when every tuple has been covered
  const all = (rs) => { const cells = rs.reduce((a, r) => a + r.cells, 0), defects = rs.reduce((a, r) => a + r.s3 + r.s2 + r.s1, 0); return { cells, defects, rate: cells ? Math.round((defects / cells) * 100) / 100 : null }; };
  return { rows, fresh: { early: sum(rows.slice(0, half)), late: sum(rows.slice(half)) }, perCell: { early: all(rows.slice(0, half)), late: all(rows.slice(half)) } };
}

/** The open entries that are not parked, the one to fix first at the top: severity x seen, then the older. */
export const rank = (todos) => todos.filter((t) => t.status === 'open' && !isParked(t)).sort((a, b) => b.severity * b.seen - a.severity * a.seen || a.opened.localeCompare(b.opened) || a.id.localeCompare(b.id));

/** Close one entry: fixed by a commit (and a lint that now catches it), or wontfix with the reason. */
export function close(todos, id, { commit = null, lint = null, wontfix = null, today }) {
  const t = todos.find((x) => x.id === id); if (!t) throw new Error(`no todo ${id}`);
  if (t.status !== 'open') throw new Error(`${id} is already ${t.status}`);
  if (!(typeof commit === 'string' && commit) && !(typeof wontfix === 'string' && wontfix)) throw new Error('close needs --commit <sha> or --wontfix "<why>"');
  Object.assign(t, { status: wontfix ? 'wontfix' : 'fixed', closed: today, commit, lint, wontfix });
  return t;
}

/** A fixed entry the review found does not hold: open again, the fix counted as an attempt, the reason in `tried`. */
export function reopen(todos, id, why, { today }) {
  const t = todos.find((x) => x.id === id); if (!t) throw new Error(`no todo ${id}`);
  if (t.status !== 'fixed') throw new Error(`${id} is ${t.status}, not fixed`);
  if (!why) throw new Error('reopen needs the reason the fix does not hold');
  (t.tried ??= []).push(`${today}: reopened by review, the fix ${t.commit} does not hold: ${why}`);
  t.attempts = (t.attempts ?? 0) + 1;
  Object.assign(t, { status: 'open', closed: null, commit: null, lint: null });
  return t;
}

/** Fold open entries that are one fault under different parts into `keep`; they leave the ranking as `merged`. All or nothing. */
export function merge(todos, keep, ids, { parts, today }) {
  const k = todos.find((x) => x.id === keep); if (!k) throw new Error(`no todo ${keep}`);
  if (k.status !== 'open') throw new Error(`${keep} is ${k.status}, not open`);
  if (!ids.length) throw new Error('merge needs <keep> and at least one id to fold in');
  const from = ids.map((id) => {
    if (id === keep) throw new Error(`${id} is the entry to keep`);
    const t = todos.find((x) => x.id === id); if (!t) throw new Error(`no todo ${id}`);
    if (t.status !== 'open') throw new Error(`${id} is ${t.status}, not open`);
    return t;
  });
  if (parts) {
    const bad = parts.find((p) => !/^(unknown(:\w+)?|\w+:\w+)$/.test(p)); if (bad !== undefined || !parts.length) throw new Error(`parts are kind:name, or unknown[:word]: got "${bad ?? ''}"`);
  }
  const union = (a, b) => [...new Set([...(a ?? []), ...(b ?? [])])];
  // the kept entry carries every member's parts plus any named here: replacing them with one name left `related` checking that part alone (T192 kept shortBeard out of four beard styles)
  const before = fingerprint(k), merged = [...from.reduce((acc, t) => union(acc, t.parts), union(k.parts, parts))].sort();
  if (merged.join() !== [...k.parts].sort().join()) { k.aliases = union(k.aliases, [before]); k.parts = merged; } // the old fingerprint still finds it
  for (const t of from) {
    k.seen += t.seen; k.evidence = union(k.evidence, t.evidence); k.tuples = union(k.tuples, t.tuples); k.sheets = union(k.sheets, t.sheets); k.notes = union(k.notes, t.notes);
    k.severity = Math.max(k.severity, t.severity); if (t.opened < k.opened) k.opened = t.opened;
    k.attempts = Math.max(k.attempts ?? 0, t.attempts ?? 0); k.tried = [...(k.tried ?? []), ...(t.tried ?? [])];
    Object.assign(t, { status: 'merged', mergedInto: keep, closed: today });
  }
  return k;
}

export const load =(file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []);
export const save = (file, todos) => writeFileSync(file, JSON.stringify(todos, null, 1) + '\n');
