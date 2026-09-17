// The sampler's waveform: drawing and gestures, shared by the Compose row and the workshop page. Pure state in, one
// onCommit out; the host turns a commit into a source edit or a definition change and calls set() again.
import { slicePoints } from '../lib/layers.mjs';
import { toggleBreak, snapTo, breaksIn, frac, fmtTime } from './sampler.mjs';

/**
 * createWaveform(canvas, { onCommit, onStatus, tolerance }) -> { set(state), state }.
 * state: { peaks, duration, begin, end, breaks, count, divisions } (breaks null = `count` equal slices, divisions 0 = no snap).
 * Commits: a break drag or a click add/remove -> { breaks } (the whole list, rounded); an edge drag -> { begin, end }.
 */
export function createWaveform(cv, { onCommit, onStatus = () => {}, tolerance = 4 }) {
  const g = cv.getContext('2d');
  const state = { peaks: null, duration: 0, begin: 0, end: 1, breaks: null, count: 1, divisions: 0 };
  let drag = null; // { kind: 'break' | 'begin' | 'end' | 'press', i, x0, moved, was }
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f6fed';
  const points = () => slicePoints(state.begin, state.end, state.breaks ?? state.count);
  const inner = () => points().slice(1, -1); // the break points alone: what a commit is about
  const px = (f) => Math.round(f * cv.width) + .5;
  const lit = (i, pts) => drag && ((drag.kind === 'break' && drag.i === i - 1) || (drag.kind === 'begin' && i === 0) || (drag.kind === 'end' && i === pts.length - 1));

  function draw() {
    const { peaks, begin, end, divisions } = state, mid = cv.height / 2;
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#2a2f3a'; g.fillRect(begin * cv.width, 0, (end - begin) * cv.width, cv.height);
    if (peaks) { g.fillStyle = '#9a9aa2'; for (let x = 0; x < cv.width; x++) { const h = Math.max(1, (peaks[x] ?? 0) * mid); g.fillRect(x, mid - h, 1, 2 * h); } }
    if (divisions > 1) { // the snap grid, faint, so a drag shows what it will land on
      g.strokeStyle = '#4a4f5a'; g.beginPath();
      for (let k = 1; k < divisions; k++) { const x = px(begin + ((end - begin) * k) / divisions); g.moveTo(x, mid - 7); g.lineTo(x, mid + 7); }
      g.stroke();
    }
    const pts = points(), a = accent();
    pts.forEach((p, i) => { g.strokeStyle = lit(i, pts) ? '#fff' : a; g.beginPath(); g.moveTo(px(p), 0); g.lineTo(px(p), cv.height); g.stroke(); });
  }

  const at = (ev) => { const r = cv.getBoundingClientRect(); return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); };
  const tol = () => tolerance / cv.getBoundingClientRect().width;
  const moved = (ev) => Math.abs(at(ev) - drag.x0) * cv.getBoundingClientRect().width >= 3;
  const where = (label, f) => onStatus(`${label} ${state.duration ? fmtTime(f * state.duration) : frac(f)}${state.divisions > 1 ? ' (snapped)' : ''}`);

  cv.onpointerdown = (ev) => {
    const x = at(ev), pts = points(), t = tol();
    let i = -1, best = Infinity;
    pts.forEach((p, k) => { const d = Math.abs(p - x); if (d <= t && d < best) { best = d; i = k; } });
    drag = i < 0 ? { kind: 'press', x0: x, moved: false }
      : i === 0 ? { kind: 'begin', x0: x, moved: false }
      : i === pts.length - 1 ? { kind: 'end', x0: x, moved: false }
      : { kind: 'break', i: i - 1, x0: x, moved: false, was: inner(), prev: state.breaks };
    if (drag.kind === 'break') state.breaks = [...drag.was]; // a count becomes its own break points, which is what gets written
    cv.setPointerCapture(ev.pointerId);
    draw();
  };

  cv.onpointermove = (ev) => {
    if (!drag) return;
    const x = at(ev);
    if (moved(ev)) drag.moved = true;
    if (drag.kind === 'break') {
      const b = state.breaks, lo = (b[drag.i - 1] ?? state.begin) + .001, hi = (b[drag.i + 1] ?? state.end) - .001;
      b[drag.i] = Math.min(hi, Math.max(lo, snapTo(x, state.begin, state.end, state.divisions)));
      where(`break ${drag.i}`, b[drag.i]);
    } else if (drag.kind === 'begin') { state.begin = Math.min(state.end - .001, x); onStatus(`start ${state.duration ? fmtTime(state.begin * state.duration) : frac(state.begin)}`); }
    else if (drag.kind === 'end') { state.end = Math.max(state.begin + .001, x); onStatus(`end ${state.duration ? fmtTime(state.end * state.duration) : frac(state.end)}`); }
    else return;
    draw();
  };

  cv.onpointerup = (ev) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (cv.hasPointerCapture(ev.pointerId)) cv.releasePointerCapture(ev.pointerId);
    const commit = (breaks) => onCommit({ breaks: breaksIn(breaks, state.begin, state.end) });
    if (d.kind === 'break') {
      if (d.moved) commit(state.breaks);
      else { state.breaks = d.prev; commit(toggleBreak(d.was, d.was[d.i], state.begin, state.end, tol())); } // a press on a line removes it (the drawing goes back until the host answers)
    } else if (d.kind === 'begin' || d.kind === 'end') {
      if (d.moved) onCommit({ begin: +state.begin.toFixed(4), end: +state.end.toFixed(4) });
    } else if (!d.moved) {
      const was = inner(), next = toggleBreak(was, snapTo(at(ev), state.begin, state.end, state.divisions), state.begin, state.end, tol());
      if (next !== was) commit(next); // the same array: a press outside the region
    }
    draw();
  };

  cv.onpointercancel = () => { drag = null; draw(); };

  return { state, set(s) { Object.assign(state, s); if (!drag) draw(); } };
}
