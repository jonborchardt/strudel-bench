// The worlds, spread across workers, composited into one canvas. The page hands each worker the score and the whole
// event stream once, then posts one number per frame; the workers step and paint in parallel and hand back finished
// pictures, which the page blits into the single canvas the visitor sees.
//
// One canvas, not one per channel: a canvas the page owns is a layer for the compositor, and eighteen live layers cap
// the whole wall at about a hundred tile updates a second however the repaints are shared out — measured, and the
// same whichever way the budget is sliced. Blitted into one canvas, the same eighteen run at sixty frames.
//
// This is the only file that knows the worlds are running off the main thread: `createStage` returns the same handle
// either way, and falls back to running them here when a browser has no module workers or no OffscreenCanvas.
import { createShow, channelWorld } from './show.mjs';

const SOLO = 2; // tiles at which a channel gets the gpu to itself rather than sharing the cpu with a wall of them

const canWork = () => typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';

/**
 * A stage over the named channels. `at`/`seek` take seconds on the audio clock; `layout` gives the rectangle each
 * channel occupies, and a channel left out of it keeps stepping but is not painted, so turning to it is instant.
 * `paint` blits whatever each worker sent most recently, so the page's frame rate and the worlds' are independent:
 * a slow world shows its last picture instead of holding up the others.
 */
export function createStage({ score, stream, names }) {
  return canWork() ? workerStage({ score, stream, names }) : localStage({ score, stream, names });
}

function workerStage({ score, stream, names }) {
  // one worker per core, minus the one this page is on, and never more than there are channels to run
  const n = Math.max(1, Math.min(names.length, (navigator.hardwareConcurrency || 4) - 1));
  const url = new URL('./worker.mjs', import.meta.url);
  let clock = null, rects = new Map();
  const tile = new Map(); // name -> the most recent picture of that channel
  const sent = new Map(); // name -> the render size it was last told, so a steady layout costs no messages
  const workers = Array.from({ length: n }, () => {
    const w = new Worker(url, { type: 'module' });
    const rec = { w, busy: false, names: [] };
    w.onmessage = (e) => {
      rec.busy = false; // the ack: a worker is never handed a frame it has not finished
      const d = e.data ?? {};
      if (d.clock) clock = d.clock; // the musical moment, already computed in there, so the readout costs nothing
      for (const [name, bmp] of Object.entries(d.tiles ?? {})) { tile.get(name)?.close(); tile.set(name, bmp); }
      if (d.error) console.warn('[listen] world:', d.error);
      if (d.missing) console.warn('[listen] no world named', d.missing);
    };
    w.postMessage({ type: 'init', score, stream });
    return rec;
  });
  const owner = new Map();
  names.forEach((name, i) => {
    const rec = workers[i % workers.length];
    owner.set(name, rec); rec.names.push(name);
    rec.w.postMessage({ type: 'add', name });
  });
  const mine = (r) => r.names.filter((x) => rects.has(x));
  return {
    workers: workers.length,
    get clock() { return clock; },
    // every channel on screen is repainted every frame; a worker that cannot keep up simply gets fewer frames,
    // and its tile is blitted from the last picture it sent, so a slow machine degrades instead of stuttering
    at(t) { for (const r of workers) if (!r.busy) { r.busy = true; r.w.postMessage({ type: 'clock', t, paint: mine(r) }); } },
    // a seek is a discontinuity, so it jumps the queue: every worker is told, busy or not
    seek(t) { for (const r of workers) { r.busy = false; r.w.postMessage({ type: 'seek', t, paint: mine(r) }); } },
    /**
     * Which channels are worth rendering and at what size. Called when the view settles, not while it moves: a zoom
     * scales the last picture, which is what makes it smooth and keeps the size messages off the hot path.
     */
    layout(next) {
      rects = next;
      // one or two tiles have the machine to themselves, so they rasterise on the gpu; a wall of them must not
      const gpu = next.size <= SOLO;
      for (const [name, s] of next) {
        const w = Math.max(2, Math.round(s.w)), h = Math.max(2, Math.round(s.h));
        const was = sent.get(name);
        if (!was || was.w !== w || was.h !== h || was.gpu !== gpu) { sent.set(name, { w, h, gpu }); owner.get(name)?.w.postMessage({ type: 'size', name, w, h, gpu }); }
      }
    },
    /** What drives each of one channel's hooks. Live: the world reads it every step, so this rebuilds nothing. */
    bind(name, b) { owner.get(name)?.w.postMessage({ type: 'bind', name, bind: b }); },
    /** Read one channel's parts differently: `cast` as lib/visual.mjs builds it, or null for the song's own. */
    recast(name, cast) { owner.get(name)?.w.postMessage({ type: 'cast', name, cast }); },
    paint(ctx, where) { blit(ctx, where, (name) => tile.get(name)); },
    destroy() { for (const r of workers) r.w.terminate(); for (const b of tile.values()) b.close(); tile.clear(); },
  };
}

/** The same stage on this thread, for a browser that cannot run the worlds anywhere else. */
function localStage({ score, stream, names }) {
  const show = createShow({ score, stream, worlds: {} });
  const own = new Map(); // name -> a canvas of its own, so the page still composites a single layer
  let rects = new Map(), turn = 0, seen = 0;
  const ready = Promise.all(names.map(async (name) => {
    const world = await channelWorld(name);
    if (world) { show.add(name, world); own.set(name, document.createElement('canvas')); }
  }));
  // one thread cannot repaint them all, so they take turns; every one of them is still blitted every frame
  const render = () => {
    const lit = [...rects.keys()].filter((nm) => own.has(nm));
    if (!lit.length) return;
    const many = Math.max(1, Math.min(4, lit.length));
    for (let i = 0; i < many; i++) {
      const nm = lit[(turn + i) % lit.length], s = rects.get(nm), c = own.get(nm);
      const w = Math.max(2, Math.round(s.w)), h = Math.max(2, Math.round(s.h));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      show.draw(nm, c.getContext('2d'), c.width, c.height);
    }
    turn = (turn + many) % lit.length;
  };
  return {
    workers: 0,
    ready,
    get clock() { return show.clock; },
    at(t) { seen = t; show.at(t); render(); },
    seek(t) { seen = t; show.seek(t); render(); },
    layout(next) { rects = next; turn = 0; },
    bind(name, b) { show.tune(name, b); },
    async recast(name, cast) {
      const world = await channelWorld(name);
      if (!world) return;
      show.drop(name);
      show.add(name, world, cast ? { ...score, cast } : undefined);
      show.seek(seen);
    },
    paint(ctx, where) { blit(ctx, where, (name) => (own.get(name)?.width > 2 ? own.get(name) : null)); },
    destroy() {},
  };
}

/** Every channel's latest picture into the one canvas, at the rectangle the view has it at this instant. */
function blit(ctx, where, pictureOf) {
  for (const [name, r] of where) {
    if (r.a <= 0.01 || r.w < 1 || r.h < 1) continue;
    const pic = pictureOf(name);
    if (!pic) continue;
    ctx.globalAlpha = r.a;
    ctx.drawImage(pic, r.x, r.y, r.w, r.h);
  }
  ctx.globalAlpha = 1;
}
