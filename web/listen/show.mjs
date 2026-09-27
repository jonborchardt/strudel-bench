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
const MAX_REPLAY = 900;

/** The best world that is not `not`, by the score's own odds: what the comparison and the overlay reach for. */
export const nextBest = (score, not) => Object.entries(score.odds ?? {}).sort((a, b) => b[1] - a[1]).map(([w]) => w)
  .find((w) => w !== not && POLICY.worlds[w]) ?? WORLD_NAMES.find((w) => w !== not);

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
  // a copy each: seventeen worlds must not share one event object. `from` is where a capped replay starts, and the
  // events before it are left out rather than dumped into the first step, which would land the whole history at once
  const fill = (p, from = 0) => { for (const e of stream) if (e.t >= from) p.push({ ...e }); return p; };
  const advance = (sec) => { const c = cycleAt(sec); for (const p of perfs.values()) p.advance(sec, c); };
  const first = () => (perfs.size ? perfs.values().next().value : null);
  const show = {
    get names() { return [...perfs.keys()]; },
    get clock() { return first()?.clock ?? null; }, // the musical moment: the same for every world on show
    get pending() { return first()?.pending ?? 0; },
    get state() { return first()?.state ?? null; }, // for the tests; the page never reads a world's state
    has: (name) => perfs.has(name),
    /** A world on show. Added mid-song it starts cold, so the caller seeks afterwards to catch it up. */
    add(name, world) { perfs.set(name, fill(createPerformance(world, score, size))); return show; },
    drop(name) { perfs.delete(name); return show; },
    at: advance,
    draw(name, ctx, w, h) { perfs.get(name)?.draw(ctx, w, h); },
    rebase() { for (const p of perfs.values()) p.rebase(); }, // after a pause, so it is not simulated as a stall
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
      const from = Math.max(0, target - MAX_REPLAY * STEP); // 0 for anything inside the cap, so a short song replays whole
      for (const p of perfs.values()) { p.reset(); fill(p, from); }
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
 * What a view asks the page to load: the world names, and the score to run them on. A named world is itself; the
 * `overlay`, and the default view of a song whose score already composes two worlds, is the director, which reads
 * its cast from the score's own `composition` — so the score is rewritten here, the way the Compose stage's
 * `withPick` rewrites it, or the director would build its base world and no second one and draw that world alone.
 * (`lib/visual.mjs`'s `compositionOf` does this for the stage, but importing it would pull `lib/song.mjs` and the
 * rest of the song builder into a page whose whole point is not carrying them, so the cast is built from the policy
 * json here.) `director` says whether the one name is the director over `names` or a world to show as itself.
 */
export function viewOf(score, { mode = 'single', worlds = [] } = {}) {
  if (mode === 'grid') return { score, names: WORLD_NAMES, director: false };
  if (mode === 'ab') {
    const a = POLICY.worlds[worlds[0]] ? worlds[0] : score.world;
    const b = POLICY.worlds[worlds[1]] && worlds[1] !== a ? worlds[1] : nextBest(score, a);
    return { score, names: [a, b], director: false };
  }
  const pick = worlds[0], own = score.composition;
  if (pick && POLICY.worlds[pick]) return { score, names: [pick], director: false };
  const composed = pick === 'overlay' || (!pick && own && own.preset !== 'single' && own.worlds?.length > 1);
  if (!composed) return { score, names: [score.world], director: false };
  // the song's own pair when it wrote one, else its world and the next best; its visit rate survives the override
  const cast = own?.worlds?.length > 1 ? own.worlds.slice(0, 2) : [score.world, nextBest(score, score.world)];
  const composition = { preset: 'overlay', worlds: cast, ...(own?.every ? { every: own.every } : {}) };
  // tunnel too: the director falls back to it for a name its map lacks
  return { score: { ...score, composition }, names: [...cast, 'tunnel'], director: true };
}

/**
 * What the page is showing, from its hash: `#<song>` alone, `&w=<world|overlay>` for one named view, `&ab=<a>,<b>`
 * for two side by side, `&grid` for all of them. Unknown keys are ignored, so the hash stays the whole state and a
 * link from a future version degrades instead of breaking.
 */
export function parseHash(hash = '') {
  const parts = String(hash).replace(/^#/, '').split('&').filter(Boolean);
  const song = parts[0] && !parts[0].includes('=') ? decodeURIComponent(parts[0]) : null;
  const flags = new Map(parts.slice(song ? 1 : 0).map((s) => {
    const i = s.indexOf('=');
    return i < 0 ? [s, ''] : [s.slice(0, i), decodeURIComponent(s.slice(i + 1))];
  }));
  if (flags.has('grid')) return { song, mode: 'grid', worlds: [] };
  const ab = flags.get('ab');
  if (ab) return { song, mode: 'ab', worlds: ab.split(',').filter(Boolean).slice(0, 2) };
  const w = flags.get('w');
  return { song, mode: 'single', worlds: w ? [w] : [] };
}

/** The same, back to a hash: what the page pushes into the url bar and what a visitor copies. */
export function formatHash({ song, mode = 'single', worlds = [] }) {
  const tail = mode === 'grid' ? '&grid' : mode === 'ab' ? `&ab=${worlds.slice(0, 2).join(',')}` : worlds[0] ? `&w=${worlds[0]}` : '';
  return `#${encodeURIComponent(song ?? '')}${tail}`;
}
