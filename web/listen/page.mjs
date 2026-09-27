// The listen page: one song's mp3 with its visuals drawn live from the baked stream (web/listen/show.mjs), in one
// world or all of them at once. The <audio> element is the clock and the only thing that knows the time; this file
// is the only DOM here, and it never evaluates a song, so the page carries no Strudel and no sample packs.
//
// Every channel is mounted and stepped for as long as the song is open, on screen or not, and the view only decides
// where each is drawn. That is what makes it channel surfing: turning to another world shows it already running, in
// the same bar as the music, instead of building it and starting from bar one. The worlds run in workers and hand
// back finished pictures (web/listen/pool.mjs); this file blits them into one canvas and animates the rectangles,
// so going into a world and back out is a zoom of the live picture rather than a cut between two layouts.
import { nav, footer } from '../boot.mjs';
import { createStage } from './pool.mjs';
import { tileGrid, parseHash, formatHash, WORLD_NAMES } from './show.mjs';
import POLICY from '../../lib/visual.json' with { type: 'json' };

const $ = (id) => document.getElementById(id);
const mmss = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
/** Every channel there is: one per world. */
const CHANNELS = WORLD_NAMES;
const GAP = 8;           // css pixels between tiles
const ZOOM = 320;        // milliseconds for a zoom in or out
const MIN_TILE = 230;    // the narrowest a grid tile gets before the wall drops a column

let audio, songs = [], audioMap = { base: '', songs: {} };
let view = { song: null, mode: 'single', worlds: [] };
let data = null, stage = null, loading = 0;
let wall, wctx, from = new Map(), to = new Map(), started = 0, hover = null;

const say = (text, bad = false) => { const el = $('msg'); el.textContent = text; el.style.color = bad ? 'var(--err)' : ''; };
const aboutOf = (name) => POLICY.worlds[name]?.about ?? POLICY.compositions[name]?.about ?? '';
const dpr = () => Math.min(2, window.devicePixelRatio || 1);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** The channels this view puts on screen, in order. Anything unknown falls back to the song's own. */
function shown() {
  if (!data) return [];
  if (view.mode === 'grid') return CHANNELS;
  const pick = view.worlds[0];
  return [CHANNELS.includes(pick) ? pick : data.score.world];
}

/**
 * Where every channel sits on the wall, in css pixels, and how opaque. The ones on screen are laid out in a grid
 * that fills the width; the rest are parked on top of the first of them, invisible, so a zoom in collapses them into
 * the one being opened and a zoom out grows them back out of it.
 */
function layout() {
  const on = shown(), W = Math.max(120, wall.clientWidth);
  // one box filling the width when a world is open; as many columns as fit on the wall
  const g = tileGrid(on.length, W, { gap: GAP, min: MIN_TILE, cols: view.mode === 'grid' ? 0 : on.length });
  // The wall has a height to live in: the screen in fullscreen, and otherwise enough of the window that the
  // transport stays in sight, since that is what the surfing is done from. A grid too tall for it shrinks to fit
  // and sits in the middle, rather than running off the bottom.
  const full = !!document.fullscreenElement;
  const room = full ? $('cells').clientHeight : window.innerHeight * 0.74;
  const k = g.height > room ? room / g.height : 1;
  // fullscreen takes the whole screen whatever the tiles add up to, so the wall is centred in it rather than sitting
  // at the top with the rest black; 16:9 boxes rarely fill a screen exactly, and letterboxing is what a wall does
  const height = full || k < 1 ? room : g.height;
  const ox = (W - (g.cols * g.tw + (g.cols - 1) * GAP) * k) / 2, oy = (height - g.height * k) / 2;
  const rects = new Map();
  on.forEach((name, i) => {
    const r = g.at(i);
    rects.set(name, { x: ox + r.x * k, y: oy + r.y * k, w: r.w * k, h: r.h * k, a: 1 });
  });
  // A channel going off screen fades where it stands rather than flying to the one being opened: seventeen tiles
  // converging on one spot at half opacity is a smear, not a zoom. It leaves them in place to be grown back out of.
  const anchor = rects.get(on[0]) ?? { x: 0, y: 0, w: W, h: (W * 9) / 16 };
  for (const name of CHANNELS) if (!rects.has(name)) rects.set(name, { ...(to.get(name) ?? anchor), a: 0 });
  return { rects, height };
}

/** Move to a new arrangement, animating from wherever the tiles are now. */
function relayout(animate = true) {
  if (!data) return;
  const { rects, height } = layout();
  from = new Map([...(to.size ? to : rects)].map(([k, v]) => [k, { ...(at(k) ?? v) }]));
  to = rects;
  started = animate ? performance.now() : 0;
  wall.style.height = `${height}px`;
  sizeWall();
  // the render size is the settled one, so a zoom scales the last picture instead of re-rendering every frame
  const want = new Map();
  for (const name of shown()) { const r = rects.get(name); want.set(name, { w: r.w * dpr(), h: r.h * dpr() }); }
  stage?.layout(want);
  placeHits();
}

/** Where a channel is at this instant, part way through a zoom. */
function at(name) {
  const a = from.get(name), b = to.get(name);
  if (!b) return null;
  if (!a || !started) return b;
  const t = Math.min(1, (performance.now() - started) / ZOOM);
  if (t >= 1) return b;
  const k = ease(t);
  // opacity moves in the first half: what is leaving is gone before the tile opening over it is big enough to
  // matter, so the two never sit on top of each other at half strength
  const ka = ease(Math.min(1, t * 2));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k, a: a.a + (b.a - a.a) * ka };
}

const sizeWall = () => {
  const w = Math.max(2, Math.round(wall.clientWidth * dpr())), h = Math.max(2, Math.round(wall.clientHeight * dpr()));
  if (wall.width !== w || wall.height !== h) { wall.width = w; wall.height = h; }
};

/** A transparent button over each tile: the click target, and what a keyboard and a screen reader can reach. */
function placeHits() {
  const host = $('hits'), on = new Set(shown());
  for (const b of host.children) {
    const r = to.get(b.dataset.name);
    const live = on.has(b.dataset.name);
    b.hidden = !live;
    if (live && r) Object.assign(b.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  }
}

/** One frame: the audio's own position drives every channel, and the wall is repainted from their latest pictures. */
function frame() {
  requestAnimationFrame(frame);
  if (!stage || !data) return;
  const now = audio.currentTime;
  stage.at(now);
  sizeWall();
  // the ones on their way out first, so the tile being opened paints over them rather than under
  const k = dpr(), where = new Map(), on = new Set(shown());
  for (const name of [...CHANNELS.filter((n) => !on.has(n)), ...CHANNELS.filter((n) => on.has(n))]) {
    const r = at(name);
    if (r) where.set(name, { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k, a: r.a });
  }
  wctx.clearRect(0, 0, wall.width, wall.height);
  stage.paint(wctx, where);
  labels(where, k);
  const len = audio.duration || data.seconds, cl = stage.clock;
  $('pos').textContent = `${mmss(now)} / ${mmss(len)}${cl?.section ? ` · ${cl.section} bar ${cl.bar + 1}` : ''}`;
  if (!audio.paused && len) $('scrub').value = String(Math.round((now / len) * 1000));
  $('play').innerHTML = audio.paused ? (now > 0 ? '&#9654; Resume' : '&#9654; Play') : '&#10073;&#10073; Pause';
  $('stop').disabled = !audio.src || (audio.paused && now === 0);
}

/** The channel's name over its own tile, so a wall of eighteen can be read; the line about it goes under the wall. */
function labels(where, k) {
  if (view.mode === 'single') return;
  wctx.save();
  wctx.font = `600 ${Math.round(12 * k)}px system-ui, sans-serif`;
  wctx.textBaseline = 'bottom';
  for (const [name, r] of where) {
    if (r.a <= 0.4 || r.w < 60) continue;
    wctx.globalAlpha = r.a;
    wctx.fillStyle = 'rgba(0,0,0,.55)';
    const pad = 4 * k, tw = wctx.measureText(name).width;
    wctx.fillRect(r.x, r.y + r.h - 18 * k, tw + pad * 2, 18 * k);
    wctx.fillStyle = name === hover ? '#fff' : 'rgba(255,255,255,.85)';
    wctx.fillText(name, r.x + pad, r.y + r.h - 4 * k);
  }
  wctx.restore();
}

/** Turn to one channel, or back out to the wall when it is the one already filling the frame. */
const tune = (name) => go(view.mode === 'single' && shown()[0] === name
  ? { ...view, mode: 'grid', worlds: [] }
  : { ...view, mode: 'single', worlds: [name] });

/** Lay the view out. No loading and no rebuilding: every channel is already running, this only moves the tiles. */
function applyView() {
  if (!data) return;
  const one = view.mode === 'single' ? shown()[0] : hover;
  $('chan').textContent = one
    ? `${one} — ${aboutOf(one)}${view.mode === 'single' ? ' · click it again, or Escape, for the wall' : ''}`
    : `${CHANNELS.length} worlds, one song; click one to open it, [ and ] to surf`;
  relayout();
}

/**
 * Load a song: its data, its mp3, and a fresh set of channels. Two loads can be in flight (a slow song picked, then
 * a cached one), so each takes a number and a stale one gives up at every await rather than overwriting the newer
 * song's title, stage and audio behind the newer song's url.
 */
async function load() {
  const mine = ++loading, { song } = view;
  const stale = () => mine !== loading;
  say('loading…');
  let got;
  try {
    got = await fetch(`listen/${encodeURIComponent(song)}.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${song}: ${r.status} ${r.statusText}`))));
  } catch (e) { if (stale()) return; data = null; stage?.destroy(); stage = null; $('play').disabled = true; return say(e.message, true); }
  if (stale()) return;
  data = got;
  $('ttl').textContent = data.title.name;
  $('line').textContent = data.title.line;
  $('song').value = song;
  stage?.destroy();
  from = new Map(); to = new Map();
  stage = createStage({ score: data.score, stream: data.stream, names: CHANNELS });
  const file = audioMap.songs[song];
  const src = file ? new URL(audioMap.base + file, location.href).href : '';
  // no mp3: drop the attribute rather than setting it empty, which resolves to the page itself and fires onerror, so
  // "no mp3 published yet" would be overwritten a moment later by "the mp3 did not load"
  if (audio.src !== src) { if (src) audio.src = src; else { audio.removeAttribute('src'); audio.load(); } }
  $('play').disabled = !file;
  say(file ? '' : `no mp3 published for ${song} yet, so there is nothing to play it against`, !file);
  // the wall's payoff has to be in the first two seconds, so it opens at the song's peak section. The length is the
  // score's when the element has none: on a first load the mp3's metadata has not arrived yet, and waiting for it
  // would mean it always opened on the intro. Setting currentTime this early is the default start position.
  if (view.mode === 'grid' && data.score.peak) {
    const s = data.score.sections.find((x) => x.name === data.score.peak), len = audio.duration || data.seconds;
    if (s && len) audio.currentTime = Math.min(s.at / data.score.cps, len - 1);
  }
  applyView();
  relayout(false); // the first arrangement does not zoom in from nowhere
  stage.seek(audio.currentTime || 0);
}

/**
 * A new view. The url first, since it is the share link; then either a song load or, when only the channel changed,
 * a relayout — which is the whole point, because the channel being turned to has been running all along.
 */
function go(next) {
  const song = songs.some((s) => s.name === next.song) ? next.song : songs[0]?.name ?? next.song;
  const same = data && song === view.song;
  view = { ...next, song };
  const hash = formatHash(view);
  if (location.hash !== hash) history.replaceState(null, '', hash);
  if (!same) return load();
  applyView();
  return Promise.resolve();
}

async function pick() { // the song list, and which of them have an mp3
  songs = await fetch('songs/index.json').then((r) => (r.ok ? r.json() : []));
  audioMap = await fetch('listen/audio.json').then((r) => (r.ok ? r.json() : { base: '', songs: {} })).catch(() => ({ base: '', songs: {} }));
  $('song').replaceChildren(...songs.map((s) => {
    const o = document.createElement('option');
    o.value = s.name; o.textContent = `${s.name.replace(/\.strudel$/, '')}${audioMap.songs[s.name] ? '' : ' (no mp3)'}`;
    return o;
  }));
}

export async function start() {
  $('nav').innerHTML = nav('Listen');
  $('foot').innerHTML = footer();
  audio = $('au');
  wall = $('wall'); wctx = wall.getContext('2d');
  $('hits').replaceChildren(...CHANNELS.map((name) => {
    const b = document.createElement('button');
    b.dataset.name = name; b.type = 'button'; b.hidden = true;
    b.setAttribute('aria-label', `${name}: ${aboutOf(name)}`);
    b.onclick = () => tune(name);
    b.onmouseenter = () => { hover = name; if (view.mode !== 'single') $('chan').textContent = `${name} — ${aboutOf(name)}`; };
    return b;
  }));
  await pick();
  const want = parseHash(location.hash);
  if (!songs.length) return say('no songs to play', true);
  $('play').onclick = () => (audio.paused ? audio.play() : audio.pause());
  $('stop').onclick = () => { audio.pause(); audio.currentTime = 0; }; // onseeked rebuilds the picture at the top
  $('scrub').oninput = () => { const len = audio.duration || data.seconds; if (len) audio.currentTime = (Number($('scrub').value) / 1000) * len; };
  audio.onseeked = () => stage?.seek(audio.currentTime); // a scrub: one of the two real discontinuities
  // the other: a hidden tab stops getting frames, so the worlds come back as far behind as the tab was away
  document.addEventListener('visibilitychange', () => { if (!document.hidden) stage?.seek(audio.currentTime); });
  audio.onerror = () => say(`the mp3 for ${view.song} did not load`, true);
  $('full').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : $('cells').requestFullscreen?.());
  // the wall is measured, not styled, so entering and leaving fullscreen has to re-measure it; the tiles and their
  // click targets are inside the fullscreen element, so clicking to zoom in and out keeps working there
  document.addEventListener('fullscreenchange', () => relayout(false));
  window.onhashchange = () => { const h = parseHash(location.hash); if (h.song) go(h); };
  window.addEventListener('resize', () => relayout(false));
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); $('play').click(); }
    if (e.key === 'Escape' && view.mode !== 'grid') go({ ...view, mode: 'grid', worlds: [] });
    if ((e.key === '[' || e.key === ']') && data) { // surf: the next channel is already running, so it appears at once
      const here = CHANNELS.indexOf(shown()[0]);
      go({ ...view, mode: 'single', worlds: [CHANNELS[(here + (e.key === ']' ? 1 : CHANNELS.length - 1)) % CHANNELS.length]] });
    }
  });
  $('song').onchange = () => go({ ...view, song: $('song').value });
  requestAnimationFrame(frame);
  await go(want);
}
