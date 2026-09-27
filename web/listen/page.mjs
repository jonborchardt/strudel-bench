// The listen page: one song's mp3 with its visuals drawn live from the baked stream (web/listen/show.mjs), in one
// world, two side by side, or all of them. The <audio> element is the clock and the only thing that knows the time;
// this file is the only DOM here, and it never evaluates a song, so the page carries no Strudel and no sample packs.
import { nav, footer } from '../boot.mjs';
import { createShow, loadWorlds, viewOf, parseHash, formatHash, WORLD_NAMES } from './show.mjs';
import POLICY from '../../lib/visual.json' with { type: 'json' };

const $ = (id) => document.getElementById(id);
const mmss = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
const DRAWS = 4; // canvases repainted per frame: stepping every world is cheap, drawing all seventeen is not

let audio, songs = [], audioMap = { base: '', songs: {} };
let view = { song: null, mode: 'single', worlds: [] }, data = null, show = null, cells = [], turn = 0, loading = 0;

const say = (text, bad = false) => { const el = $('msg'); el.textContent = text; el.style.color = bad ? 'var(--err)' : ''; };
/** What a cell is showing, in words: a world's own line, or what the composition does. */
const aboutOf = (name) => POLICY.worlds[name]?.about ?? POLICY.compositions[name]?.about ?? '';

/**
 * The world objects this view wants, keyed by the label the page shows, and the score to run them on. `viewOf` picks
 * both (and rewrites the score for the director, which reads its cast from it); this only fetches the modules.
 */
async function viewWorlds(view, score) {
  const v = viewOf(score, view);
  const worlds = await loadWorlds(v.names);
  if (!v.director) return { score: v.score, worlds };
  const { createDirector } = await import('../visual/director.mjs');
  return { score: v.score, worlds: { overlay: createDirector(worlds) } };
}

/** One 16:9 box per world on show, with its name and what it is for under it. */
function makeCells(names) {
  const host = $('cells');
  host.className = `cells ${view.mode}`;
  host.replaceChildren(...names.map((name) => {
    const fig = document.createElement('figure');
    const box = document.createElement('div'); box.className = 'stagebox';
    const canvas = document.createElement('canvas'); box.append(canvas);
    const cap = document.createElement('figcaption');
    cap.innerHTML = '<b></b><span></span>';
    if (view.mode === 'ab') { // either half can be swapped for another world without leaving the comparison
      const sel = document.createElement('select');
      sel.replaceChildren(...WORLD_NAMES.map((w) => { const o = document.createElement('option'); o.value = w; o.textContent = w; return o; }));
      sel.value = name;
      sel.onchange = () => { const ws = [...show.names]; ws[names.indexOf(name)] = sel.value; go({ ...view, mode: 'ab', worlds: ws }); };
      cap.querySelector('b').replaceWith(sel);
    } else cap.querySelector('b').textContent = name;
    cap.querySelector('span').textContent = aboutOf(name);
    fig.append(box, cap);
    if (view.mode !== 'single') box.onclick = () => go({ ...view, mode: 'single', worlds: [name] });
    return fig;
  }));
  cells = [...host.querySelectorAll('figure')].map((fig, i) => {
    const box = fig.querySelector('.stagebox'), canvas = fig.querySelector('canvas');
    const cell = { name: names[i], box, canvas, ctx: canvas.getContext('2d'), on: true };
    // off the screen: still stepped (a world's state is the song's history), not drawn
    new IntersectionObserver(([e]) => { cell.on = e.isIntersecting; }).observe(box);
    return cell;
  });
  turn = 0;
}

// Drawing is most of a crowded frame, but it costs per shape, not per pixel: measured, four times the pixels cost
// seven per cent more, so a grid cell keeps the retina resolution rather than trading looks for nothing.
const sizeCell = (c) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = c.box.getBoundingClientRect();
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (c.canvas.width !== w || c.canvas.height !== h) { c.canvas.width = w; c.canvas.height = h; }
};

/** One frame: the audio's own position drives every world, and the lit cells take turns being repainted. */
function frame() {
  requestAnimationFrame(frame);
  if (!show || !data) return;
  const now = audio.currentTime;
  // Always advance, never replay. A replay from here would be self-feeding: it takes real time, the audio does not
  // wait, so the next frame sees a gap at least as big and replays again — seventeen worlds on a long song sat at
  // one full replay per frame. The real discontinuities announce themselves (onseeked, visibilitychange) and are
  // replayed there; anything else is a slow frame, which host.mjs's MAX_CATCHUP already limps through.
  show.at(now);
  const lit = cells.filter((c) => c.on);
  for (let i = 0; i < Math.min(DRAWS, lit.length); i++) {
    const c = lit[(turn + i) % lit.length];
    sizeCell(c);
    show.draw(c.name, c.ctx, c.canvas.width, c.canvas.height);
  }
  turn = lit.length ? (turn + DRAWS) % lit.length : 0;
  const len = audio.duration || data.seconds, cl = show.clock;
  $('pos').textContent = `${mmss(now)} / ${mmss(len)}${cl?.section ? ` · ${cl.section} bar ${cl.bar + 1}` : ''}`;
  if (!audio.paused && len) $('scrub').value = String(Math.round((now / len) * 1000));
  $('play').textContent = audio.paused ? (now > 0 ? 'Resume' : 'Play') : 'Pause';
}

/** The world pick: the song's own choice first, then every world, then the overlay of two. */
function fillWorldPick() {
  const sel = $('world'), own = data.score.composition?.worlds?.length > 1 ? 'overlay' : data.score.world;
  sel.replaceChildren(...[['', `auto (${own})`], ...WORLD_NAMES.map((w) => [w, w]), ['overlay', 'overlay']]
    .map(([v, label]) => { const o = document.createElement('option'); o.value = v; o.textContent = label; return o; }));
  sel.value = view.mode === 'single' && view.worlds[0] ? view.worlds[0] : '';
  sel.disabled = view.mode !== 'single';
}

/**
 * Load what the view asks for: the song's data, its mp3, and the worlds. Nothing here touches the transport. Two
 * loads can be in flight (a slow song picked, then a cached one), so each takes a number and a stale one gives up at
 * every await rather than overwriting the newer song's title, show and audio behind the newer song's url.
 */
async function load() {
  const mine = ++loading, { song } = view;
  const stale = () => mine !== loading;
  say('loading…');
  let got;
  try {
    got = await fetch(`listen/${encodeURIComponent(song)}.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${song}: ${r.status} ${r.statusText}`))));
  } catch (e) { if (stale()) return; data = null; show = null; $('play').disabled = true; return say(e.message, true); }
  if (stale()) return;
  data = got;
  $('ttl').textContent = data.title.name;
  $('line').textContent = data.title.line;
  $('song').value = song;
  const v = await viewWorlds(view, data.score); // an await: the director's module may still be downloading
  if (stale()) return;
  show = createShow({ score: v.score, stream: data.stream, worlds: v.worlds });
  makeCells(show.names);
  fillWorldPick();
  const file = audioMap.songs[song];
  const src = file ? new URL(audioMap.base + file, location.href).href : '';
  // no mp3: drop the attribute rather than setting it empty, which resolves to the page itself and fires onerror, so
  // "no mp3 published yet" would be overwritten a moment later by "the mp3 did not load"
  if (audio.src !== src) { if (src) audio.src = src; else { audio.removeAttribute('src'); audio.load(); } }
  $('play').disabled = !file;
  say(file ? '' : `no mp3 published for ${song} yet, so there is nothing to play it against`, !file);
  // follow the audio, which is 0 for a new song (the element resets on a new src) and the playhead when only the
  // worlds changed: picking a world mid-song must not send the picture back to bar 1
  show.seek(audio.currentTime || 0);
  // the grid's payoff has to be in the first two seconds, so it opens at the song's peak section. The length is the
  // score's when the element has none: on a first load the mp3's metadata has not arrived yet, and waiting for it
  // would mean the grid always opens on the intro. Setting currentTime this early is the default start position.
  if (view.mode === 'grid' && data.score.peak) {
    const s = data.score.sections.find((x) => x.name === data.score.peak), len = audio.duration || data.seconds;
    if (s && len) { audio.currentTime = Math.min(s.at / data.score.cps, len - 1); show.seek(audio.currentTime); }
  }
  $('grid').classList.toggle('on', view.mode === 'grid');
  $('grid').textContent = view.mode === 'grid' ? 'One' : 'Grid';
  $('ab').classList.toggle('on', view.mode === 'ab');
  $('ab').textContent = view.mode === 'ab' ? 'One' : 'Compare';
}

/**
 * A new view: the url first (it is the share link), then the load. A song the list does not have (a stale link, a
 * typo in the hash bar, a song since renamed) falls back to the first one — here rather than at startup, because a
 * hashchange on an open page arrives the same way and would otherwise ask the server for a song that is not there.
 */
function go(next) {
  const song = songs.some((s) => s.name === next.song) ? next.song : songs[0]?.name ?? next.song;
  view = { ...next, song };
  const hash = formatHash(view);
  if (location.hash !== hash) history.replaceState(null, '', hash);
  return load();
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
  await pick();
  const want = parseHash(location.hash);
  if (!songs.length) return say('no songs to play', true);
  $('play').onclick = () => (audio.paused ? (show?.rebase(), audio.play()) : audio.pause()); // rebase: the pause is not a stall to be replayed
  $('scrub').oninput = () => { const len = audio.duration || data.seconds; if (len) audio.currentTime = (Number($('scrub').value) / 1000) * len; };
  audio.onseeked = () => show?.seek(audio.currentTime); // a scrub: one of the two real discontinuities
  // the other: a hidden tab stops getting frames, so the worlds come back as far behind as the tab was away
  document.addEventListener('visibilitychange', () => { if (!document.hidden) show?.seek(audio.currentTime); });
  audio.onerror = () => say(`the mp3 for ${view.song} did not load`, true);
  $('world').onchange = () => go({ ...view, mode: 'single', worlds: $('world').value ? [$('world').value] : [] });
  $('grid').onclick = () => go(view.mode === 'grid' ? { ...view, mode: 'single', worlds: [] } : { ...view, mode: 'grid', worlds: [] });
  $('ab').onclick = () => go(view.mode === 'ab'
    ? { ...view, mode: 'single', worlds: [show?.names[0] ?? ''].filter(Boolean) }
    : { ...view, mode: 'ab', worlds: [] }); // viewWorlds fills in the score's world and the next best
  $('full').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : cells[0]?.box.requestFullscreen?.());
  window.onhashchange = () => { const h = parseHash(location.hash); if (h.song) go(h); };
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); $('play').click(); }
    if (e.key === '[' || e.key === ']') { // step through the worlds, as on the Compose stage
      const now = view.worlds[0] && WORLD_NAMES.includes(view.worlds[0]) ? WORLD_NAMES.indexOf(view.worlds[0]) : WORLD_NAMES.indexOf(data.score.world);
      const next = (now + (e.key === ']' ? 1 : WORLD_NAMES.length - 1) + WORLD_NAMES.length) % WORLD_NAMES.length;
      go({ ...view, mode: 'single', worlds: [WORLD_NAMES[next]] });
    }
  });
  $('song').onchange = () => go({ ...view, song: $('song').value });
  requestAnimationFrame(frame);
  await go(want);
}
