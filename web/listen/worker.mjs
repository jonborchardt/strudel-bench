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
//   - the rasteriser depends on how many tiles are up, and the page says which to use. A wall of them has to be on
//     the cpu (`willReadFrequently`): left to the gpu every worker funnels into the one gpu process and they
//     serialise, and eleven workers ran the page slower than one did. One tile alone is the opposite — nothing to
//     contend with, a canvas five times wider, and the gpu is about twice the cpu's rate.
import { createShow, channelWorld } from './show.mjs';

let show = null, score = null, at = 0;
const tiles = new Map();  // name -> { canvas, ctx, gpu }: where this worker paints that channel
const worlds = new Map(); // name -> its world, kept so a recast can build the channel again without re-importing
const sizes = new Map(); // name -> { w, h, gpu } the page last asked for, kept whether or not the world has loaded yet

const make = (s) => {
  const canvas = new OffscreenCanvas(Math.max(2, s?.w ?? 2), Math.max(2, s?.h ?? 2));
  // `willReadFrequently` is the rasteriser, and which one is right depends on how many tiles are up. See the note
  // at the top: on the wall the gpu serialises every worker, and alone the cpu is half the speed of the gpu.
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: !s?.gpu }), gpu: !!s?.gpu };
};

const fit = (name) => {
  const t = tiles.get(name), s = sizes.get(name);
  if (!t || !s) return;
  if (t.gpu !== !!s.gpu) return void tiles.set(name, make(s)); // the attribute is fixed at getContext, so it takes a new canvas
  if (t.canvas.width !== s.w || t.canvas.height !== s.h) { t.canvas.width = s.w; t.canvas.height = s.h; }
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
    tiles.clear(); sizes.clear(); worlds.clear();
    return;
  }
  if (!show) return;
  if (m.type === 'add') {
    const world = await channelWorld(m.name);
    if (!world) return self.postMessage({ missing: m.name, clock: show.clock, tiles: {} });
    worlds.set(m.name, world);
    show.add(m.name, world);
    tiles.set(m.name, make(sizes.get(m.name)));
    show.seek(at); // the whole show, not just the newcomer: seek resets every world, so they all land together
    return;
  }
  // A different reading of the same music: which part does which job in this one channel. A world builds its state
  // from the cast when it starts, so there is no way to change it in place — the channel is built again and caught
  // back up, which reads as a cut on that tile. `cast: null` puts it back to the one the song wrote.
  if (m.type === 'cast') {
    const world = worlds.get(m.name);
    if (!world) return;
    show.drop(m.name);
    show.add(m.name, world, m.cast ? { ...score, cast: m.cast } : undefined);
    show.seek(at);
    return;
  }
  if (m.type === 'size') { sizes.set(m.name, { w: m.w, h: m.h, gpu: m.gpu }); fit(m.name); return; }
  if (m.type === 'clock') { at = m.t; return step(() => show.at(m.t), m.paint); }
  if (m.type === 'seek') { at = m.t; return step(() => show.seek(m.t), m.paint); }
  if (m.type === 'drop') { show.drop(m.name); tiles.delete(m.name); sizes.delete(m.name); worlds.delete(m.name); }
};
