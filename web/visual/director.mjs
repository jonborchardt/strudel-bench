// The director: a world that runs other worlds and composes them into one frame, so a song can be more than one world
// at once (a base and a transparent overlay, a portal, a mosaic at the climax) without any world knowing. It has the
// world shape, { name, init, step, draw }, so createPerformance, the stage's loop, renderFrames and exportVideo drive it
// exactly as they drive a bare world; a single-world score never comes here (stage.mjs worldOf returns the bare world).
// State is plain data: the scenes, each layer's animated rect and opacity, the transition, and the children's states.
// Every child is stepped every step, visible or not, so a cumulative world hidden for a scene keeps the history; only
// draw is skipped. Each visible child draws into its own target canvas (created by `createCanvas`, kept in the closure
// like ink keeps `paint`: never state), whose aspect is fixed for the layer's life and whose pixels track its rect at
// rest, and the compositor cover-fits that target into the layer's animated rect with its opacity, blend and mask; so a
// world's canvas persists between draws (the host's contract) even while its rect moves. Scenes come from the score's
// composition (a preset over the sections' roles, lib/visual.json) or are handed in; the same seed gives the same
// mosaic, the same transitions, the same frames, live and in an export. Randomness only from the injected generator.
import { prng } from '../../lib/random.mjs';
import { clamp, lerp } from './kit.mjs';
import POLICY from '../../lib/visual.json' with { type: 'json' };

export const FULL = Object.freeze([0, 0, 1, 1]);
export const BLENDS = ['source-over', 'screen', 'multiply', 'lighter']; // the compositing modes a layer may use: the same in a 2d context live and in an OffscreenCanvas export
export const MASKS = ['circle', 'rounded', 'vignette']; // or { polygon: [[x, y], ...] } in fractions of the rect
export const TRANSITIONS = ['cut', 'crossfade', 'expand', 'collapse', 'iris', 'wipe', 'mosaic-in', 'mosaic-out'];
export const PRESETS = Object.keys(POLICY.compositions);
const FRAME = 16 / 9; // the stage's aspect; a circle or a gutter is written square in pixels for it
const GUTTER = 0.012; // between mosaic insets, a fraction of the height: the primary shows through
const STAGGER = 0.12; // of the transition per inset, for mosaic-in and mosaic-out
const LEAVING_ON_TOP = new Set(['crossfade', 'collapse', 'mosaic-out']); // the old picture goes away over the new; else the new arrives over the old
const KEYS = ['opacity', 'iris', 'wipe']; // the animated scalars, with the rect
const smooth = (t) => t * t * (3 - 2 * t);
const area = (r) => r[2] * r[3];
const centre = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2, 0, 0];
const r4 = (v) => +v.toFixed(4);

/** A rect shrunk by a gutter on every side, square in pixels. */
export const inset = (r, g = GUTTER) => [r[0] + g / FRAME, r[1] + g, r[2] - (2 * g) / FRAME, r[3] - 2 * g].map(r4);
/** A square-in-pixels rect of diameter `d` (of the height) centred at (cx, cy) in fractions of the frame. */
export const circleRect = (cx, cy, d) => [cx - d / FRAME / 2, cy - d / 2, d / FRAME, d].map(r4);

/**
 * A seeded guillotine layout: `n` rects tiling the frame (fractions of width and height), largest first. Each step
 * splits the largest tile that can be split, at a ratio in .38..62 along its longer side in pixels (the other side when
 * that fails); a split leaving a tile under `minArea` of the frame or outside the aspect band is refused. Fewer than `n`
 * come back when nothing more can be split. The same generator gives the same tiles.
 */
export function mosaic(n, rnd, { minArea = 0.12, aspect = [0.6, 2.4], frame = FRAME } = {}) {
  const tiles = [[0, 0, 1, 1]];
  const ok = (t) => area(t) >= minArea - 1e-9 && (t[2] * frame) / t[3] >= aspect[0] && (t[2] * frame) / t[3] <= aspect[1];
  const split = ([x, y, w, h], r, vertical) => (vertical ? [[x, y, w * r, h], [x + w * r, y, w * (1 - r), h]] : [[x, y, w, h * r], [x, y + h * r, w, h * (1 - r)]]);
  while (tiles.length < n) {
    tiles.sort((a, b) => area(b) - area(a));
    let done = false;
    for (let i = 0; i < tiles.length && !done; i++) {
      const t = tiles[i], longer = t[2] * frame > t[3];
      for (let k = 0; k < 6 && !done; k++) {
        const r = lerp(0.38, 0.62, rnd());
        for (const vertical of [longer, !longer]) { const [a, b] = split(t, r, vertical); if (ok(a) && ok(b)) { tiles.splice(i, 1, a, b); done = true; break; } }
      }
    }
    if (!done) break;
  }
  return tiles.sort((a, b) => area(b) - area(a)).map((t) => t.map(r4));
}

/** A section's role, the written one or one read off the arc: the first establishes, the peak is the climax, after it releases, the rest develops. */
export function rolesOf(score) {
  const peak = score.sections.findIndex((s) => s.name === score.peak);
  return score.sections.map((s, i) => s.role ?? (i === 0 ? 'establish' : i === peak ? 'climax' : peak >= 0 && i > peak ? 'release' : 'develop'));
}

const traits = (world, policy) => policy.worlds[world]?.traits ?? {};
/** The blend a world overlays with, by its trait: screen for a dark ground, multiply for a light one, ink's own rule when it says byLuminance; null when it cannot overlay. */
export function overlayBlend(world, score, policy = POLICY) {
  const o = traits(world, policy).overlay;
  return o === 'byLuminance' ? (score.palette.luminance >= 0.5 ? 'multiply' : 'screen') : o || null;
}
const full = (world) => ({ id: world, world, rect: FULL, opacity: 1, blend: 'source-over', mask: null });
const over = (world, opacity, blend) => ({ id: world, world, rect: FULL, opacity: r4(opacity), blend, mask: null });
const tile = (world, rect, mask = 'rounded') => ({ id: world, world, rect, opacity: 1, blend: 'source-over', mask });

/** Worlds into tiles, largest tile first, each the first unplaced world whose traits accept it (minTile: the tile's height; minAspect); a tile nobody fits stays open (the primary shows). */
export function placeInsets(tiles, worlds, policy = POLICY) {
  const left = worlds.slice(), out = [];
  for (const t of tiles) {
    const i = left.findIndex((w) => { const tr = traits(w, policy); return t[3] >= (tr.minTile ?? 0) && (t[2] * FRAME) / t[3] >= (tr.minAspect ?? 0); });
    if (i >= 0) { out.push({ world: left[i], rect: t }); left.splice(i, 1); }
  }
  return out;
}

/** The complexity rules over one scene's layers: past two high-motion worlds at full strength the rest are dimmed; an overlay above its world's cap is capped. */
export function budget(layers, policy = POLICY) {
  let strong = 0;
  return layers.map((l) => {
    const tr = traits(l.world, policy); let opacity = l.opacity;
    if (l.blend !== 'source-over' && tr.overlayMax !== undefined) opacity = Math.min(opacity, tr.overlayMax);
    if (tr.motion === 'high' && opacity > 0.7 && area(l.rect) > 0.15) { strong++; if (strong > 2) opacity = 0.6; }
    return opacity === l.opacity ? l : { ...l, opacity: r4(opacity) };
  });
}

/**
 * The scenes a preset makes of a score: one per section, `from` its index, the transition into it and its layers
 * (bottom first). `single` (or no composition, or one world): the score's world full, always. `overlay`: the primary
 * full, the second world a transparent overlay whose opacity follows the section's energy (an inset instead when it
 * cannot overlay), the third a circle portal that irises open at the first section that is not the establishing one.
 * `mosaic-climax`: the primary full throughout; develop adds the second world as an overlay or an expanding inset; a
 * climax adds the remaining worlds as insets of one seeded mosaic (the largest tile left open, so the primary bleeds
 * through the gutters), staggered in; a release collapses back to the primary, or crossfades to a listed world that
 * makes a final frame. A pattern with no sections gets one scene with everything.
 */
export function scenesOf(score, rnd, policy = POLICY) {
  const comp = score.composition, worlds = comp?.worlds ?? [];
  const one = [{ from: 0, transition: { type: 'cut', bars: 0 }, layers: [full(worlds[0] ?? score.world)] }];
  if (!comp || comp.preset === 'single' || worlds.length < 2 || !policy.compositions[comp.preset]) return one;
  const [P, ...rest] = worlds, roles = rolesOf(score), n = score.sections.length;
  const A = rest[0], aBlend = overlayBlend(A, score, policy);
  const trans = (i, type, bars = 1) => ({ type: i === 0 ? 'cut' : type, bars: i === 0 ? 0 : bars });
  if (comp.preset === 'overlay') {
    const B = rest[1], dev = Math.max(0, roles.findIndex((r) => r !== 'establish')), side = mosaic(2, rnd)[1];
    const at = (i, energy) => {
      const layers = [full(P)];
      layers.push(aBlend ? over(A, lerp(0.25, 0.65, energy), aBlend) : tile(A, inset(side)));
      if (B && i >= dev) layers.push(tile(B, circleRect(0.8, 0.68, 0.36), 'circle'));
      return { from: i, transition: trans(i, i === dev ? 'iris' : 'crossfade'), layers: budget(layers, policy) };
    };
    return n ? score.sections.map((s, i) => at(i, s.energy)) : [at(0, 0.5)];
  }
  // mosaic-climax
  const finalW = rest.find((w) => traits(w, policy).finalFrame) ?? null;
  const tiles = mosaic(1 + (aBlend ? rest.length - 1 : rest.length), rnd); // one mosaic for the song: its largest tile is the primary's, left open
  const insets = placeInsets(tiles.slice(1), aBlend ? rest.slice(1) : rest, policy);
  const second = () => (aBlend ? over(A, 0.5, aBlend) : tile(A, inset(tiles[1])));
  let prev = null;
  const at = (i, role) => {
    let layers = [full(P)];
    if (role === 'develop' || role === 'none') layers.push(second());
    else if (role === 'climax') { if (aBlend) layers.push(over(A, 0.55, aBlend)); for (const { world, rect } of insets) layers.push(tile(world, inset(rect))); }
    else if (role === 'release' && finalW) layers = [full(finalW)];
    layers = budget(layers, policy);
    const was = prev?.layers.length ?? 1, now = layers.length;
    const type = now > was ? (now - was > 1 ? 'mosaic-in' : aBlend ? 'crossfade' : 'expand') : now < was ? 'mosaic-out' : 'crossfade';
    const scene = { from: i, transition: trans(i, type, type === 'mosaic-out' ? 2 : 1), layers };
    prev = scene; return scene;
  };
  return n ? roles.map((r, i) => at(i, r)) : [at(0, 'climax')];
}

/** The scene playing at section `index` (the last whose `from` is not past it; before the start, the first). */
export const sceneAt = (scenes, index) => Math.max(0, scenes.findLastIndex((s) => s.from <= Math.max(0, index)));

/**
 * The director for `WORLDS` (name -> world). `createCanvas(w, h)` makes a target (OffscreenCanvas in the page; a stub in
 * tests); `scenes` (an array, or (score, rnd) => array) replaces the score's composition. The result is a world.
 */
export function createDirector(WORLDS, { createCanvas = defaultCanvas, scenes: given = null, policy = POLICY } = {}) {
  const targets = new Map(); // layer id -> { canvas, ctx, w, h }: draw's own, never state
  let scratch = null; // one canvas for soft masks
  const target = (id, w, h) => {
    let t = targets.get(id);
    if (!t) { const canvas = createCanvas(w, h); t = { canvas, ctx: canvas.getContext('2d'), w, h }; targets.set(id, t); }
    if (t.w !== w || t.h !== h) { t.canvas.width = w; t.canvas.height = h; t.w = w; t.h = h; } // a resize clears it: the world paints the whole frame again (its contract)
    return t;
  };
  const worldOf = (name) => WORLDS[name] ?? WORLDS.tunnel;
  return {
    name: 'director',

    init(score, rng, size) {
      const own = prng((score.seed ?? 1) ^ 0x5eed); // the director's own draws: the mosaic and the picks
      const scenes = typeof given === 'function' ? given(score, own) : given ?? scenesOf(score, own, policy);
      const ids = [...new Set(scenes.flatMap((sc) => sc.layers.map((l) => l.id ?? l.world)))];
      const spec = {}, children = {};
      ids.forEach((id, k) => {
        const first = scenes.flatMap((sc) => sc.layers).find((l) => (l.id ?? l.world) === id);
        const home = scenes.flatMap((sc) => sc.layers).filter((l) => (l.id ?? l.world) === id).map((l) => l.rect ?? FULL).reduce((a, b) => (area(b) > area(a) ? b : a)); // its largest rect: the target's aspect
        spec[id] = { world: first.world, parts: first.parts ?? null, home };
        children[id] = worldOf(first.world).init(score, k === 0 ? rng : prng((score.seed ?? 1) * 1000 + k), { w: size.w * home[2], h: size.h * home[3] }); // layer 0 gets the score's own generator: alone, it is the bare world
      });
      targets.clear();
      const s = { scenes, spec, children, scene: -1, layers: {}, order: [], trans: null, cps: score.cps, sections: score.sections.map((x) => x.cps ?? score.cps) };
      enter(s, 0, true);
      return s;
    },

    step(s, dt, events, clock) {
      const idx = sceneAt(s.scenes, clock.index);
      if (idx !== s.scene) enter(s, idx, false, s.sections[Math.max(0, clock.index)] ?? s.cps);
      if (s.trans) {
        s.trans.t += dt;
        const p = s.trans.dur > 0 ? clamp(s.trans.t / s.trans.dur) : 1;
        for (const id of s.order) {
          const L = s.layers[id], q = smooth(clamp((p - L.delay) / (1 - L.delay)));
          L.cur.rect = L.from.rect.map((v, i) => lerp(v, L.to.rect[i], q));
          for (const k of KEYS) L.cur[k] = lerp(L.from[k], L.to[k], q);
        }
        if (p >= 1) { s.trans = null; s.order = s.order.filter((id) => !s.layers[id].leaving); for (const id of Object.keys(s.layers)) if (s.layers[id].leaving) delete s.layers[id]; }
      }
      for (const id of Object.keys(s.children)) { // every child, shown or not: a hidden cumulative world keeps the history
        const { world, parts } = s.spec[id];
        worldOf(world).step(s.children[id], dt, parts ? events.filter((e) => parts.includes(e.layer) || parts.includes(e.kind)) : events, clock);
      }
    },

    draw(s, ctx, w, h) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      for (const id of s.order) {
        const L = s.layers[id], c = L.cur;
        if (c.opacity < 0.003 || c.rect[2] < 0.003 || c.rect[3] < 0.003 || c.iris < 0.003 || c.wipe < 0.003) continue;
        // the target: the layer's aspect (its largest rect, in this frame's pixels), sized to cover its rect at rest
        const rest = L.rest, aspect = (L.home[2] * w) / (L.home[3] * h);
        const ph = Math.max(2, Math.round(Math.max(rest[3] * h, (rest[2] * w) / aspect))), pw = Math.max(2, Math.round(ph * aspect));
        const t = target(id, pw, ph);
        worldOf(L.world).draw(s.children[id], t.ctx, t.w, t.h);
        const dx = c.rect[0] * w, dy = c.rect[1] * h, dw = c.rect[2] * w, dh = c.rect[3] * h;
        ctx.save();
        clipTo(ctx, L.mask, c, dx, dy, dw, dh);
        ctx.globalAlpha = c.opacity; ctx.globalCompositeOperation = L.blend;
        if (L.mask === 'vignette') {
          const sw = Math.max(2, Math.round(dw)), sh = Math.max(2, Math.round(dh));
          if (!scratch) { const canvas = createCanvas(sw, sh); scratch = { canvas, ctx: canvas.getContext('2d') }; }
          if (scratch.canvas.width !== sw || scratch.canvas.height !== sh) { scratch.canvas.width = sw; scratch.canvas.height = sh; }
          const sc = scratch.ctx; sc.save(); sc.globalCompositeOperation = 'source-over'; sc.globalAlpha = 1; sc.clearRect(0, 0, sw, sh);
          cover(sc, t, 0, 0, sw, sh);
          const g = sc.createRadialGradient(sw / 2, sh / 2, 0, sw / 2, sh / 2, Math.hypot(sw, sh) / 2); g.addColorStop(0.35, 'rgba(0 0 0 / 1)'); g.addColorStop(1, 'rgba(0 0 0 / 0)');
          sc.globalCompositeOperation = 'destination-in'; sc.fillStyle = g; sc.fillRect(0, 0, sw, sh); sc.restore();
          ctx.drawImage(scratch.canvas, dx, dy, dw, dh);
        } else cover(ctx, t, dx, dy, dw, dh);
        ctx.restore();
      }
      ctx.restore();
    },
  };
}

/** Enter scene `k`: every layer of the old or the new scene gets from/to keys by the transition's type, the new scene's layers over or under the leaving ones by it; `cut` (and the first scene) lands at once. */
function enter(s, k, first, cps = s.cps) {
  const scene = s.scenes[k], type = first ? 'cut' : scene.transition?.type ?? 'cut', bars = first ? 0 : scene.transition?.bars ?? 1;
  const next = Object.fromEntries(scene.layers.map((l) => [l.id ?? l.world, l]));
  const keep = {}, leaving = [];
  const rest = (l) => ({ rect: (l.rect ?? FULL).slice(), opacity: l.opacity ?? 1, iris: 1, wipe: 1 });
  const point = (r) => centre(r);
  let k2 = 0;
  for (const [id, l] of Object.entries(next)) { // arriving or staying
    const was = s.layers[id], to = rest(l), from = was ? { ...was.cur, rect: was.cur.rect.slice() } : { ...to };
    if (!was) {
      if (type === 'crossfade' || type === 'collapse' || type === 'mosaic-out') from.opacity = 0;
      else if (type === 'expand' || type === 'mosaic-in') from.rect = point(to.rect);
      else if (type === 'iris') from.iris = 0;
      else if (type === 'wipe') from.wipe = 0;
    }
    const delay = type === 'mosaic-in' && !was && area(to.rect) < 0.99 ? Math.min(0.5, STAGGER * k2++) : 0;
    keep[id] = { world: l.world, blend: l.blend ?? 'source-over', mask: l.mask ?? null, home: s.spec[id].home, from, to, rest: to.rect.slice(), cur: { ...from, rect: from.rect.slice() }, delay, leaving: false };
  }
  for (const id of s.order) { // leaving
    if (next[id]) continue;
    const was = s.layers[id], from = { ...was.cur, rect: was.cur.rect.slice() }, to = { ...from, rect: from.rect.slice() };
    if (type === 'crossfade' || type === 'expand' || type === 'mosaic-in' || type === 'cut') to.opacity = 0;
    else if (type === 'collapse' || type === 'mosaic-out') to.rect = point(from.rect);
    else if (type === 'iris') to.iris = 0;
    const delay = type === 'mosaic-out' && area(was.rest) < 0.99 ? Math.min(0.5, STAGGER * leaving.length) : 0;
    leaving.push(id);
    keep[id] = { ...was, from, to, rest: was.rest, cur: { ...from, rect: from.rect.slice() }, delay, leaving: true }; // rest stays the rect it left: its target keeps its pixels while it goes
  }
  const arriving = Object.keys(next);
  s.layers = keep;
  s.order = LEAVING_ON_TOP.has(type) ? [...arriving, ...leaving] : [...leaving, ...arriving];
  s.scene = k;
  s.trans = { t: 0, dur: type === 'cut' ? 0 : bars / cps, type };
  if (s.trans.dur <= 0) { // land at once
    for (const id of s.order) { const L = s.layers[id]; L.cur = { ...L.to, rect: L.to.rect.slice() }; }
    s.order = s.order.filter((id) => !s.layers[id].leaving); for (const id of leaving) delete s.layers[id];
    s.trans = null;
  }
}

/** The target cover-fitted into a rect: scaled to fill it, the excess cropped evenly. */
function cover(ctx, t, dx, dy, dw, dh) {
  const scale = Math.max(dw / t.w, dh / t.h), sw = dw / scale, sh = dh / scale;
  ctx.drawImage(t.canvas, (t.w - sw) / 2, (t.h - sh) / 2, sw, sh, dx, dy, dw, dh);
}

/** The clip for a layer's mask and its iris/wipe: a circle (iris scales its radius), a rounded rect, a polygon in fractions of the rect, or none; an iris on an unmasked layer is a circle from the rect's centre that covers it at 1; a wipe reveals from the left. */
function clipTo(ctx, mask, c, dx, dy, dw, dh) {
  const cx = dx + dw / 2, cy = dy + dh / 2;
  if (c.wipe < 1) { ctx.beginPath(); ctx.rect(dx, dy, dw * c.wipe, dh); ctx.clip(); }
  if (mask === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, (Math.min(dw, dh) / 2) * c.iris, 0, Math.PI * 2); ctx.clip(); return; }
  if (c.iris < 1) { ctx.beginPath(); ctx.arc(cx, cy, (Math.hypot(dw, dh) / 2) * c.iris, 0, Math.PI * 2); ctx.clip(); }
  if (mask === 'rounded') { const r = Math.min(dw, dh) * 0.06; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(dx, dy, dw, dh, r); else ctx.rect(dx, dy, dw, dh); ctx.clip(); }
  else if (mask && mask.polygon) { ctx.beginPath(); mask.polygon.forEach(([x, y], i) => (i ? ctx.lineTo(dx + x * dw, dy + y * dh) : ctx.moveTo(dx + x * dw, dy + y * dh))); ctx.closePath(); ctx.clip(); }
  else if (mask !== 'vignette') { ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip(); } // a plain rect: a layer never paints outside its own
}

function defaultCanvas(w, h) {
  if (typeof OffscreenCanvas === 'undefined') throw new Error('createDirector needs createCanvas outside a browser');
  return new OffscreenCanvas(w, h);
}
