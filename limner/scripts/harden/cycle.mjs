// The bookkeeping a cycle used to leave to the reader: which sheets belong to it, what its commit says, and whether the
// suite passed. cycle.json ({ cycle, from, last, open, unreviewed }) is the cycle's start: its number, its first sheet,
// the highest todo id and the unparked open ids at that moment, and the fixes no review has looked at yet.
import { isParked, statsOf } from './ledger.mjs';

export const SHEETS_PER_CYCLE = 20, REVIEW_EVERY = 3;
export const pad = (n) => String(n).padStart(4, '0');
export const sheetsOf = (cyc) => Array.from({ length: SHEETS_PER_CYCLE }, (_, i) => pad(cyc.from + i));

/** The state a cycle starts from, taken from the ledger as it stands. */
export const startOf = (cycle, from, todos, unreviewed = []) => ({ cycle, from, last: todos.reduce((m, t) => Math.max(m, +t.id.slice(1)), 0), open: todos.filter((t) => t.status === 'open' && !isParked(t)).map((t) => t.id), unreviewed });

/** The cycle's commit message from its recorded sheets and the ledger now against the ledger at its start; `next` the cycle.json that follows. */
export function cycleCommit(cyc, sheets, todos, { recorded = sheets, note = null } = {}) {
  const ids = (ts) => ts.map((t) => t.id), list = (xs) => (xs.length ? xs.join(', ') : 'none');
  const ours = (t) => cyc.open.includes(t.id) || +t.id.slice(1) > cyc.last; // open at the start or opened since
  const fresh = todos.filter((t) => +t.id.slice(1) > cyc.last), touched = todos.filter(ours);
  const fixed = touched.filter((t) => t.status === 'fixed'), wontfix = touched.filter((t) => t.status === 'wontfix'), merged = touched.filter((t) => t.status === 'merged'), parked = touched.filter(isParked);
  const findings = sheets.flatMap((s) => s.findings), by = (v) => findings.filter((f) => f.severity === v).length;
  const cells = sheets.reduce((a, s) => a + s.cells.filter((c) => c.tuple.cast !== 'calibration').length, 0);
  const { fresh: fr, perCell } = statsOf(recorded), open = todos.filter((t) => t.status === 'open').length;
  const body = [
    `Sheets ${sheets[0].sheet}-${sheets.at(-1).sheet}: ${cells} cells judged, ${findings.length} findings (${by(3)} at severity 3, ${by(2)} at 2, ${by(1)} at 1).`,
    `New: ${list(fresh.map((t) => (t.status === 'merged' ? `${t.id} (merged into ${t.mergedInto})` : t.id)))}.`,
    `Fixed: ${list(fixed.map((t) => `${t.id} (${t.commit})`))}. Wontfix: ${list(ids(wontfix))}. Merged: ${list(merged.filter((t) => !fresh.includes(t)).map((t) => `${t.id} into ${t.mergedInto}`))}. Parked: ${list(ids(parked))}.`,
    `${open} open. Rates: fresh defects per fresh cell early ${fr.early.rate} late ${fr.late.rate}; defects per cell early ${perCell.early.rate} late ${perCell.late.rate}.`,
    ...(note ? [note] : []),
  ].join(' ');
  const unreviewed = [...cyc.unreviewed, ...ids(fixed)], review = cyc.cycle % REVIEW_EVERY === 0 ? unreviewed : [];
  return { subject: `limner: harden, cycle ${cyc.cycle}`, body, review, next: startOf(cyc.cycle + 1, cyc.from + SHEETS_PER_CYCLE, todos, review.length ? [] : unreviewed) };
}

/** node --test's spec summary: the counts, the failing tests' names and the failing block. Judged by the fail line, never the exit code alone (cycle 33 read an exit 0 through a pipe with a test failing). */
export function testSummary(out, status) {
  const num = (k) => { const m = out.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')); return m ? +m[1] : null; };
  const tests = num('tests'), fail = num('fail'), cancelled = num('cancelled');
  const at = out.indexOf('✖ failing tests:'), block = at < 0 ? '' : out.slice(at);
  const names = [...new Set([...block.matchAll(/^✖ (.+?) \(\d[\d.]*m?s\)$/gm)].map((m) => m[1]))];
  const ok = tests != null && fail === 0 && !cancelled && status === 0;
  const why = tests == null ? `no summary line (exit ${status}): the run died; read the output` : fail || cancelled ? `${fail} failed, ${cancelled} cancelled of ${tests}` : status !== 0 ? `exit ${status} with no failing test: read the output` : null;
  return { ok, tests, fail, cancelled, names, block, why };
}
