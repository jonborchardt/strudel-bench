// What a world can be driven by, and what is driving it. A world publishes a `hooks` table — the things it does, in
// its own words, each with a label — and a binding says which part of the music feeds each one. Nothing here knows
// about any particular world: a hook is a name, a label, the control it reads off an event, and who it listens to.
//
// Why a world does this at all: without it the only dial from outside is which of seven abstract jobs a part has,
// which is the engine's vocabulary rather than the music's, and it cannot reach anything finer than the job. With a
// hooks table you can say "the melody moves the eyes" or "the brows lift when the kick is loud", in the world's own
// language, and the page can build its controls from the table instead of being told about each world.
//
// A world that publishes no hooks keeps working exactly as it did; this is additive.

/** A part with no cast entry (a plain pattern has none) still has a job, by the kind of part it is. */
export const DEFAULT_SLOT = {
  drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line',
  pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition',
};

const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);

/**
 * What a hook can read off one event, each normalised to 0..1 so a threshold and a depth mean the same thing
 * whichever control is behind them. `null` where the event does not carry it, which a hook treats as "no reading".
 */
export const READS = {
  gain: (e) => clamp((e.gain ?? 1) * (e.velocity ?? 1), 0, 1.5) / 1.5,
  note: (e) => (e.note == null ? null : clamp((e.note - 24) / 60)),
  pan: (e) => clamp(e.pan ?? 0.5),
  cutoff: (e) => (e.cutoff == null ? null : clamp(Math.log(e.cutoff / 200) / Math.log(40))),
  dur: (e) => clamp(e.dur ?? 0),
};
export const READ_NAMES = Object.keys(READS);

/** The job a part has, from the cast the world was built with, or from the kind of part when it has no entry. */
export const slotOf = (e, slots) => slots?.[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain';

/**
 * Does this event feed this source? A source is one of:
 *   `@impulse`         any part whose job is impulse
 *   `@impulse:impact`  ...and whose role is impact, which is how a snare is told from a kick
 *   `melody`           that part by name
 *   `drums:hh`         that part's hi-hat
 *   `*`                anything that sounds
 * `except` drops roles another hook has claimed, so "the kick" can be written as impulse without the snare and hats.
 */
export function feeds(src, e, slots, except) {
  if (except && except.includes(e.role)) return false;
  if (!src || src === '*') return true;
  if (src[0] === '@') {
    const [slot, role] = src.slice(1).split(':');
    if (slotOf(e, slots) !== slot) return false;
    return !role || e.role === role;
  }
  const [part, voice] = src.split(':');
  if (e.layer !== part) return false;
  return !voice || e.voice === voice;
}

/**
 * How hard this event drives this hook, 0 when it does not. `over` is a threshold on the hook's own reading, so
 * "the brows lift when the kick is loud" is a source and a number; `depth` scales what comes out.
 */
export function drive(hook, bind, e, slots) {
  const b = bind ?? hook;
  if (!feeds(b.src ?? hook.src, e, slots, b.except ?? hook.except)) return 0;
  const read = READS[b.reads ?? hook.reads ?? 'gain'];
  const v = read ? read(e) : 1;
  if (v === null) return 0;
  const over = b.over ?? 0;
  if (v < over) return 0;
  return clamp(v * (b.depth ?? 1), 0, 2);
}

/** The reading itself, un-thresholded, for a hook that maps a control onto a value rather than firing on it. */
export function reading(hook, bind, e, name) {
  const read = READS[name ?? (bind ?? hook).reads ?? hook.reads ?? 'gain'];
  return read ? read(e) : null;
}

/** Every hook at its default, which is what the world does when nobody has touched it. */
export const defaults = (hooks) => Object.fromEntries(Object.entries(hooks)
  .map(([k, h]) => [k, { src: h.src, reads: h.reads, over: h.over ?? 0, depth: 1, ...(h.except ? { except: h.except } : {}) }]));

/** A binding with only what differs from the world's own, so "as written" is an empty object rather than a copy. */
export const changed = (hooks, bind) => Object.fromEntries(Object.entries(bind ?? {}).filter(([k, b]) => {
  const h = hooks[k];
  return h && (b.src !== h.src || (b.depth ?? 1) !== 1 || (b.over ?? 0) !== (h.over ?? 0) || (b.reads ?? h.reads) !== h.reads);
}));
