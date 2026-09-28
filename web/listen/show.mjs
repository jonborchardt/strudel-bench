// The listen page's core, DOM-free: any number of worlds fed one baked event stream and driven by the <audio>
// element's own clock. Everything musical is host.mjs's; this file only decides which second of the song each
// performance is at, which world objects exist, and what the page's url hash means. It runs in Node, so the tests
// drive it exactly as the page does.
import { createPerformance, STEP } from '../visual/host.mjs';
import POLICY from '../../lib/visual.json' with { type: 'json' };

/** Every world there is, from the same table the check and the song header validate against. */
export const WORLD_NAMES = Object.keys(POLICY.worlds);

const CHUNK = 0.4; // seconds of song replayed per advance() while seeking: exactly 24 fixed steps, inside host.mjs's MAX_CATCHUP
const EPS = 1e-6;
/**
 * ponytail: the most steps a seek replays per world, ~15 seconds of song. Without a cap a scrub costs the whole song
 * up to that point, once per world on show, which on seventeen worlds and a four-minute song blocked the page for
 * half a minute (swarm and dish are the expensive ones). Past the cap a world starts cold that far back instead of
 * at the song's start, so an accumulating world (growth, sediment, ink, loom) shows its last fifteen seconds of
 * history rather than all of it — the "reset at the seek point" ceiling, softened. Raise it if a machine can afford
 * more; the alternative, a wall-clock budget, would give the same seek a different picture on different machines.
 */
const MAX_REPLAY = 900, MIN_REPLAY = 60;

/**
 * The worlds named, imported by name from web/visual/. There is no second registry to keep in step with stage.mjs:
 * the names are lib/visual.json's, and the single-song page loads the one or two files it shows instead of all of
 * web/visual/. An unknown name is skipped, so a stale link cannot break the page.
 */
export async function loadWorlds(names) {
  const out = {};
  for (const n of [...new Set(names)]) if (POLICY.worlds[n]) out[n] = (await import(`../visual/${n}.mjs`)).default;
  return out;
}

/** One channel's world, by name. Null when the name is not one, so a stale link cannot break the page. */
export const channelWorld = async (name) => (await loadWorlds([name]))[name] ?? null;

/**
 * One show: a performance per world, all fed the same stream and the same clock. `at(seconds)` takes the audio
 * element's currentTime; `seek(seconds)` is the discontinuity path (a scrub, a stalled tab, a fresh play).
 */
export function createShow({ score, stream, worlds, size = { w: 16, h: 9 } }) {
  const perfs = new Map();
  // the song's own end: the mp3 rings on past it, and clockOf wraps a cycle past `total` back to bar 1, which would
  // read as a section boundary while the reverb is still dying
  const last = score.total > 0 ? score.total / score.cps - EPS : Infinity;
  const cycleAt = (sec) => Math.min(Math.max(0, sec), last) * score.cps;
  // Each performance keeps a cursor into the (already sorted) stream and is handed an event just before it is due,
  // the way the live stage's scheduler hands over its lookahead. Pushing the whole song up front instead costs 29x
  // more per step: host.mjs's advance() re-sorts everything still queued on every frame, so a four-minute song made
  // every world sort three thousand events sixty times a second. Same events, same steps, same state — measured.
  const startAt = (from) => { let i = 0; while (i < stream.length && stream[i].t < from) i++; return i; };
  const feed = (e, sec) => { while (e.at < stream.length && stream[e.at].t <= sec) e.p.push({ ...stream[e.at++] }); }; // a copy each: seventeen worlds must not share one event object
  const advance = (sec) => { const c = cycleAt(sec); for (const e of perfs.values()) { feed(e, sec); e.p.advance(sec, c); } };
  const first = () => (perfs.size ? perfs.values().next().value : null);
  const show = {
    get names() { return [...perfs.keys()]; },
    get clock() { return first()?.p.clock ?? null; }, // the musical moment: the same for every world on show
    /** Events not yet delivered to the world: the ones still ahead in the stream plus the ones already handed over. */
    get pending() { const e = first(); return e ? stream.length - e.at + e.p.pending : 0; },
    get queued() { return first()?.p.pending ?? 0; }, // how deep the host's own queue is kept, which is what costs
    get state() { return first()?.p.state ?? null; }, // for the tests; the page never reads a world's state
    has: (name) => perfs.has(name),
    /** A world on show. Added mid-song it starts cold, so the caller seeks afterwards to catch it up. */
    add(name, world) { perfs.set(name, { p: createPerformance(world, score, size), at: 0 }); return show; },
    drop(name) { perfs.delete(name); return show; },
    at: advance,
    draw(name, ctx, w, h) { perfs.get(name)?.p.draw(ctx, w, h); },
    rebase() { for (const e of perfs.values()) e.p.rebase(); }, // after a pause, so it is not simulated as a stall
    /**
     * Every world starts again from the score's seed and the song is replayed up to `seconds` in chunks, so a scrub
     * lands where the music is with the history a play-through would have built (which matters: growth, sediment,
     * ink and loom keep the whole song in their state). No drawing, so a four-minute replay is ~14k cheap steps.
     * ponytail: the replay is chunked, so an event sitting exactly on a step boundary can land one 1/60 step either
     * side of where a 60 fps play-through put it, which diverges the seeded rng for the rest of the song. Invisible
     * (the section, bar and every event still land together); the exact path costs 24x the calls and a sort each.
     */
    seek(seconds) {
      const target = Math.max(0, seconds);
      // the budget is shared out among the worlds on show, so a scrub costs about the same whether one world is up or
      // seventeen: alone a world gets fifteen seconds of history, in the grid about a second each
      const steps = Math.max(MIN_REPLAY, Math.floor(MAX_REPLAY / Math.max(1, perfs.size)));
      const from = Math.max(0, target - steps * STEP); // 0 for anything inside the budget, so a short song replays whole
      const at = startAt(from); // the events before the replay's start are skipped, not dumped into its first step
      for (const e of perfs.values()) { e.p.reset(); e.at = at; }
      // The replay starts one step before its first second, so the first real step lands exactly on it. A fresh
      // performance's first advance only records the time it was handed; with no time elapsed it takes no step at
      // all, and a world that has taken no step has no clock — which would leave a seek reading null.
      advance(from - STEP);
      advance(from);
      for (let t = from; t < target;) { t = Math.min(target, t + CHUNK); advance(t); }
      return show;
    },
  };
  for (const [n, w] of Object.entries(worlds)) show.add(n, w);
  return show;
}

/**
 * How to tile `count` boxes across `width`: 16:9 columns, the last row short where the count does not divide.
 * With a `height` to live in, the column count is whichever makes the boxes biggest inside that box — so a wide
 * screen gets more columns and a narrow one fewer, and either way the wall fills the space it has rather than
 * running off the bottom. Without one it falls back to as many columns as fit without going under `min`.
 * It is here because it is arithmetic with no DOM in it, and the awkward cases are worth pinning.
 */
export function tileGrid(count, width, { gap = 8, min = 230, cols: fixed = 0, height: room = 0 } = {}) {
  const n = Math.max(1, count), w = Math.max(1, width);
  // the box width `c` columns leaves, limited by the width and, when there is one, by the height
  const fit = (c) => Math.min((w - gap * (c - 1)) / c,
    room > 0 ? (((room - gap * (Math.ceil(n / c) - 1)) / Math.ceil(n / c)) * 16) / 9 : Infinity);
  let cols = fixed ? Math.min(n, fixed) : 0;
  if (!cols) {
    if (room > 0) for (let c = 1, best = -1; c <= n; c++) { if (fit(c) > best) { best = fit(c); cols = c; } }
    else cols = Math.min(n, Math.floor((w + gap) / (min + gap)) || 1);
  }
  cols = Math.max(1, cols);
  const rows = Math.ceil(n / cols);
  const tw = Math.max(1, fit(cols)), th = (tw * 9) / 16;
  return {
    cols, rows, tw, th,
    height: rows * th + (rows - 1) * gap,
    at: (i) => ({ x: (i % cols) * (tw + gap), y: Math.floor(i / cols) * (th + gap), w: tw, h: th }),
  };
}

/**
 * What the page is showing, from its hash: `#<song>&w=<world>` for one world opened, and the wall of every world
 * for anything else, which is the landing. Unknown keys are ignored, so the hash stays the whole state and a link
 * from another version of this page degrades to the wall rather than breaking.
 */
export function parseHash(hash = '') {
  const parts = String(hash).replace(/^#/, '').split('&').filter(Boolean);
  const song = parts[0] && !parts[0].includes('=') ? decodeURIComponent(parts[0]) : null;
  const flags = new Map(parts.slice(song ? 1 : 0).map((s) => {
    const i = s.indexOf('=');
    return i < 0 ? [s, ''] : [s.slice(0, i), decodeURIComponent(s.slice(i + 1))];
  }));
  const w = flags.get('w');
  return w ? { song, mode: 'single', worlds: [w] } : { song, mode: 'grid', worlds: [] };
}

/** The same, back to a hash: what the page pushes into the url bar and what a visitor copies. */
export function formatHash({ song, mode = 'single', worlds = [] }) {
  const tail = mode === 'grid' ? '&grid' : worlds[0] ? `&w=${worlds[0]}` : '';
  return `#${encodeURIComponent(song ?? '')}${tail}`;
}
