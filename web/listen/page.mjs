// The listen page: one song's mp3 with its visuals drawn live from the baked stream (web/listen/show.mjs), in one
// world, two side by side, or all of them. The <audio> element is the clock and the only thing that knows the time;
// this file is the only DOM here, and it never evaluates a song, so the page carries no Strudel and no sample packs.
import { nav, footer } from '../boot.mjs';
import { createShow, loadWorlds, parseHash, formatHash, WORLD_NAMES } from './show.mjs';
import POLICY from '../../lib/visual.json' with { type: 'json' };

const $ = (id) => document.getElementById(id);
const mmss = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
const DRAWS = 4; // canvases repainted per frame: stepping every world is cheap, drawing all seventeen is not
const JUMP = 0.5; // seconds of clock the page may miss before it replays instead of limping on (host.mjs's MAX_CATCHUP)

let audio, songs = [], audioMap = { base: '', songs: {} };
let view = { song: null, mode: 'single', worlds: [] }, data = null, show = null, cells = [], turn = 0, seen = 0;

const say = (text, bad = false) => { const el = $('msg'); el.textContent = text; el.style.color = bad ? 'var(--err)' : ''; };
/** What a cell is showing, in words: a world's own line, or what the composition does. */
const aboutOf = (name) => POLICY.worlds[name]?.about ?? POLICY.compositions[name]?.about ?? '';

/** The best world that is not `not`, by the score's own odds: what Compare and the overlay reach for. */
const nextBest = (score, not) => Object.entries(score.odds ?? {}).sort((a, b) => b[1] - a[1]).map(([w]) => w)
  .find((w) => w !== not && POLICY.worlds[w]) ?? WORLD_NAMES.find((w) => w !== not);

/**
 * The world objects this view wants, keyed by the label the page shows. A named world is itself; `overlay`, and the
 * default view of a song whose score composes two worlds, is the director over them, so the page shows what the
 * Compose stage shows. Anything unknown falls back to the score's own world.
 */
async function viewWorlds({ mode, worlds }, score) {
  if (mode === 'grid') return loadWorlds(WORLD_NAMES);
  if (mode === 'ab') {
    const a = POLICY.worlds[worlds[0]] ? worlds[0] : score.world;
    const b = POLICY.worlds[worlds[1]] && worlds[1] !== a ? worlds[1] : nextBest(score, a);
    return loadWorlds([a, b]);
  }
  const pick = worlds[0];
  if (pick && POLICY.worlds[pick]) return loadWorlds([pick]);
  const c = score.composition;
  const composed = pick === 'overlay' || (!pick && c && c.preset !== 'single' && c.worlds?.length > 1);
  if (composed) {
    const names = c?.worlds?.length > 1 ? c.worlds : [score.world, nextBest(score, score.world)];
    const { createDirector } = await import('../visual/director.mjs');
    // tunnel too: the director falls back to it for a name its map lacks
    return { overlay: createDirector(await loadWorlds([...names, 'tunnel'])) };
  }
  return loadWorlds([score.world]);
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
    cap.querySelector('b').textContent = name;
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

const sizeCell = (c) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = c.box.getBoundingClientRect();
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (c.canvas.width !== w || c.canvas.height !== h) { c.canvas.width = w; c.canvas.height = h; }
};

/** One frame: the audio's own position drives every world, and a jump in it (a scrub, a stalled or hidden tab) is replayed. */
function frame() {
  requestAnimationFrame(frame);
  if (!show || !data) return;
  const now = audio.currentTime;
  if (Math.abs(now - seen) > JUMP) show.seek(now); else show.at(now);
  seen = now;
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

/** Load what the view asks for: the song's data, its mp3, and the worlds. Nothing here touches the transport. */
async function load() {
  const { song } = view;
  say('loading…');
  try {
    data = await fetch(`listen/${encodeURIComponent(song)}.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${song}: ${r.status} ${r.statusText}`))));
  } catch (e) { data = null; show = null; $('play').disabled = true; return say(e.message, true); }
  $('ttl').textContent = data.title.name;
  $('line').textContent = data.title.line;
  $('song').value = song;
  show = createShow({ score: data.score, stream: data.stream, worlds: await viewWorlds(view, data.score) });
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
  seen = audio.currentTime || 0;
  show.seek(seen);
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
  audio.onseeked = () => { if (show) { show.seek(audio.currentTime); seen = audio.currentTime; } };
  audio.onerror = () => say(`the mp3 for ${view.song} did not load`, true);
  $('world').onchange = () => go({ ...view, mode: 'single', worlds: $('world').value ? [$('world').value] : [] });
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
