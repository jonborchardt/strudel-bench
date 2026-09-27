// One worker's share of the channels on the listen page. Each holds its own show (web/listen/show.mjs, the same core
// the main thread used to run alone) over a few worlds, paints them into canvases of its own, and hands the finished
// pictures back as ImageBitmaps for the page to blit into the one canvas the visitor sees.
//
// Why this exists: drawing is almost all of a crowded frame, and it costs per shape rather than per pixel, so there
// is no sampling trick that makes eighteen worlds fit in one thread. The worlds are pure — seeded, DOM-free, plain
// data in and canvas calls out — and the event stream is baked json handed over once, so the only thing crossing per
// frame is a number out and a picture back.
//
// Two things had to be true for that to be worth anything, both measured rather than assumed:
//   - the canvases are the worker's own, not the page's. Eighteen canvases the page owns are eighteen layers for the
//     compositor, which caps the wall at about a hundred tile updates a second however the repaints are shared out.
//   - they rasterise on the cpu (`willReadFrequently`). Left to the gpu, every worker funnels into the one gpu
//     process and they serialise: eleven workers ran the page slower than one did. On the cpu they are really
//     parallel, and all eighteen tiles run at sixty frames.
import { createShow, channelWorld } from './show.mjs';

let show = null, score = null, at = 0;
const tiles = new Map(); // name -> { canvas, ctx }: where this worker paints that channel
const sizes = new Map(); // name -> the size the page last asked for, kept whether or not the world has loaded yet

const fit = (name) => {
  const t = tiles.get(name), s = sizes.get(name);
  if (t && s && (t.canvas.width !== s.w || t.canvas.height !== s.h)) { t.canvas.width = s.w; t.canvas.height = s.h; }
};

/**
 * Paint the channels the page asked for and hand the pictures back; every channel is stepped either way, so one that
 * is off screen is still running and is ready the moment the visitor turns to it. `transferToImageBitmap` empties the
 * canvas it takes from, which costs nothing here: a world repaints its whole frame from its state every time.
 */
const pictures = (names = []) => {
  const out = {};
  for (const name of names) {
    fit(name);
    const t = tiles.get(name);
    if (!t || t.canvas.width < 2) continue;
    show.draw(name, t.ctx, t.canvas.width, t.canvas.height);
    out[name] = t.canvas.transferToImageBitmap();
  }
  return out;
};

// The ack: the page hands a worker no frame it has not finished, so a slow world falls behind instead of queueing.
// It carries the musical moment too, so the readout costs nothing — the clock was computed in here anyway. It has to
// fire even on a bad frame, or that worker never gets another.
const step = (fn, names) => {
  let out = {};
  try { fn(); out = pictures(names); } catch (e) { self.postMessage({ error: String(e) }); }
  self.postMessage({ clock: show?.clock ?? null, tiles: out }, Object.values(out));
};

self.onmessage = async ({ data: m }) => {
  if (m.type === 'init') { // a new song: the score and the whole event stream, once
    score = m.score; at = 0;
    show = createShow({ score, stream: m.stream, worlds: {} });
    tiles.clear(); sizes.clear();
    return;
  }
  if (!show) return;
  if (m.type === 'add') {
    const world = await channelWorld(m.name);
    if (!world) return self.postMessage({ missing: m.name, clock: show.clock, tiles: {} });
    show.add(m.name, world);
    const s = sizes.get(m.name);
    const canvas = new OffscreenCanvas(s?.w ?? 2, s?.h ?? 2);
    tiles.set(m.name, { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) });
    show.seek(at); // the whole show, not just the newcomer: seek resets every world, so they all land together
    return;
  }
  if (m.type === 'size') { sizes.set(m.name, { w: m.w, h: m.h }); fit(m.name); return; }
  if (m.type === 'clock') { at = m.t; return step(() => show.at(m.t), m.paint); }
  if (m.type === 'seek') { at = m.t; return step(() => show.seek(m.t), m.paint); }
  if (m.type === 'drop') { show.drop(m.name); tiles.delete(m.name); sizes.delete(m.name); }
};
