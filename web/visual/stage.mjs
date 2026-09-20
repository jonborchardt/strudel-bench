// The stage on the Compose page: a canvas sized to its box, a frame loop that advances the performance from the
// page's clock and draws it, the tap the page puts on each playing part, a debug overlay (?vdebug) and fullscreen.
// Everything musical is in host.mjs and the world; this file is the only one that touches the DOM.
import { createPerformance, eventOf, fallbackScore } from './host.mjs';
import tunnel from './tunnel.mjs';
import ink from './ink.mjs';
import sediment from './sediment.mjs';
import signal from './signal.mjs';

export const WORLDS = { tunnel, ink, sediment, signal };
/** The world a score names, tunnel when it names one that is not built. */
export const worldOf = (score) => WORLDS[score.world] ?? tunnel;

/**
 * `clock()` is the page's: `{ now }` on the audio clock in seconds and `{ cycle }`, the song cycle sounding at that
 * instant (the scheduler's position minus its lookahead, in song cycles even when a section is pinned). Returns the
 * stage: `setScore` (composed at every play; the same identity keeps the world's state, a new one starts it over),
 * `tap(layer, kind)` (the per-part trigger callback), `start`/`pause`/`stop`, `reset` (a discontinuity: seek, pin),
 * `fullscreen`, and `debug`.
 */
export function mountStage(box, canvas, { clock, debug = false, solo = null }) { // solo: a layer kind (drums, bass, melody, pad, ...): only its events reach the world, for tuning one job at a time
  const ctx = canvas.getContext('2d');
  let perf = null, score = null, identity = '', running = false, fired = 0;
  const lastAt = {}; // part -> audio time of its last event, for the overlay's "active" list
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = box.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  };
  new ResizeObserver(size).observe(box);
  size();
  const idle = () => { size(); ctx.clearRect(0, 0, canvas.width, canvas.height); perf?.draw(ctx, canvas.width, canvas.height); };
  function setScore(next) {
    const id = JSON.stringify([next.world, next.seed, next.palette]);
    if (perf && id === identity) perf.setScore(next);
    else perf = createPerformance(worldOf(next), next, { w: 16, h: 9 });
    score = next; identity = id;
    if (!running) idle();
  }
  function overlay(c) {
    const cl = perf.clock, active = Object.entries(lastAt).filter(([, t]) => c.now - t < 0.4).map(([l]) => l);
    const lines = [`world: ${WORLDS[score.world] ? score.world : `tunnel (${score.world} not built)`} (${score.mood})${solo ? `  solo: ${solo}` : ''}`, `section: ${cl?.section ?? '-'}  bar ${cl ? cl.bar + 1 : '-'}`, `cycle: ${c.cycle.toFixed(2)}`, `events this frame: ${fired}`, `energy: ${cl ? cl.energy.toFixed(2) : '-'}${cl?.riser ? `  riser ${cl.riser.toFixed(1)}` : ''}${cl?.dropout ? '  dropout' : ''}`, `active: ${active.join(' ') || '-'}`];
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.font = `${Math.round(canvas.height / 40)}px ui-monospace, monospace`; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0 0 0 / .55)'; ctx.fillRect(0, 0, canvas.height * 0.42, lines.length * canvas.height / 32 + 8);
    ctx.fillStyle = '#9f9'; lines.forEach((l, i) => ctx.fillText(l, 6, 6 + i * canvas.height / 32));
    ctx.restore();
  }
  function frame() {
    if (!running) return;
    size();
    const c = clock();
    fired = perf.advance(c.now, c.cycle);
    perf.draw(ctx, canvas.width, canvas.height);
    if (stage.debug) overlay(c);
    requestAnimationFrame(frame);
  }
  const stage = {
    debug,
    get perf() { return perf; }, // for headless checks
    get score() { return score; },
    setScore,
    tap: (layer, kind) => (hap, now, cps, t) => { if (!perf) return; const e = eventOf(hap, layer, kind, t); if (solo && e.kind !== solo) return; perf.push(e); if (layer) lastAt[layer] = t; },
    start() { if (!perf) setScore(fallbackScore()); perf.rebase(); if (!running) { running = true; requestAnimationFrame(frame); } },
    pause() { running = false; perf?.flush(); },
    stop() { running = false; perf?.reset(); idle(); },
    reset() { perf?.reset(); if (!running) idle(); },
    fullscreen() { return document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen?.(); },
  };
  return stage;
}
