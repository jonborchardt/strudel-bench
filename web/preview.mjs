// Shared by the Compose row and the workshop page: the caches behind a waveform (decoded audio, drawn peaks, detected
// tempo) and the one-button preview (press to hear, the same button again to stop, another button to replace), with the
// preview level as a page setting. Dependencies come in as arguments so Node can test the logic with fakes.
import { peaks, detectTempo, soundUrl } from './sampler.mjs';
import { sampleDef } from '../lib/packs.mjs';

/** The pack sound behind a name: a definition resolves to its sound, keeping a :variant suffix; anything else is itself. */
export function soundBehind(name) {
  const [base, variant] = String(name).split(':'), def = sampleDef(base);
  return def ? (variant ? `${def.sound}:${variant}` : def.sound) : name;
}

/**
 * The three caches a waveform needs: decoding a long file (and scanning it for peaks, and autocorrelating it for a tempo)
 * must not run again on every redraw. Buffers are keyed by the sound behind the name (one file, one decode); peaks and
 * tempo by the name asked for, which is the name `forget` is given after an import.
 * `soundMap()`: the live sound map; `decode(arrayBuffer)`: a promise of an AudioBuffer; `fetchUrl(url)`: its bytes.
 */
export function createSampleCache({ soundMap, decode, fetchUrl = async (url) => (await fetch(url)).arrayBuffer() }) {
  const bufs = new Map();      // sound name -> promise of its AudioBuffer
  const peakCache = new Map(); // `sound|width` -> the drawn columns
  const tempos = new Map();    // `sound|begin|end` -> its detection
  const once = (map, key, make) => { if (!map.has(key)) map.set(key, make()); return map.get(key); };
  return {
    /** The AudioBuffer behind a sound (a definition resolves to its pack sound); rejects when there is no file, and forgets the failure so a later call retries. */
    bufferOf(sound) {
      const name = soundBehind(sound);
      if (!bufs.has(name)) bufs.set(name, (async () => {
        const url = soundUrl(soundMap(), name);
        if (!url) throw new Error(`no file behind "${name}" (a synth, a pitched instrument, or not loaded)`);
        return decode(await fetchUrl(url));
      })().catch((e) => { bufs.delete(name); throw e; }));
      return bufs.get(name);
    },
    peaksOf: (buf, sound, width) => once(peakCache, `${sound}|${width}`, () => peaks(buf.getChannelData(0), width)),
    tempoOf: (buf, sound, begin, end) => once(tempos, `${sound}|${begin}|${end}`, () => detectTempo(buf.getChannelData(0), buf.sampleRate, begin, end)),
    /** After an import: the file behind the name changed, so its buffer, its peaks at any width and its detection at any region all go. */
    forget(sound) {
      bufs.delete(sound);
      for (const m of [peakCache, tempos]) for (const k of m.keys()) if (k.startsWith(`${sound}|`)) m.delete(k);
    },
  };
}

/**
 * The one-button preview: `preview(btn, build)` plays what `build()` returns (`{ pattern, cps, what, cycles = 2 }`) for
 * `cycles` cycles, the same button again stops it, another button replaces it. `before()` is awaited first (Compose
 * pauses the song), `status(text)` says what is heard, `gain(pattern, level)` applies the page's preview level.
 */
export function createPreviewer({ ready, status, before = async () => {}, hush, resume, gain, storage = globalThis.localStorage ?? null }) {
  let timer, btn = null, last = null;
  let level = Number(storage?.getItem('strudel:pvlvl')) || 1; // a page setting rather than part of the song
  const ins = []; // every copy of the level slider (the materials panel's and the menu's): all show the same level
  // the sliders run -1..1.7 and the gain is 10^x (x0.1 .. x50), so the first half of the travel is the fine x0.1..x1 range and the far end still reaches a whisper-quiet sample
  const show = () => { for (const i of ins) { i.value = Math.log10(level); i.nextElementSibling.value = `x${level < 10 ? level.toFixed(1) : Math.round(level)}`; } };
  function stop() {
    if (!btn) return; // nothing is previewing: the song, if it plays, keeps playing
    clearTimeout(timer);
    btn?.classList.remove('on');
    btn = null;
    hush();
  }
  async function run(b, build) {
    await before();
    hush();
    const r = await ready;
    await resume(); // this ▶ may be the page's first click: the context starts suspended until a gesture resumes it
    let p; try { p = await build(); } catch (e) { status(e.message); btn = null; return; }
    b.classList.add('on');
    status(`hearing ${p.what}${level === 1 ? '' : ` at x${level}`}`);
    r.setCps(p.cps); r.setPattern(gain(p.pattern, level), true); // the repl's own setCps: the `setcps` global only exists once a song has been evaluated
    timer = setTimeout(() => { hush(); b.classList.remove('on'); btn = null; }, ((p.cycles ?? 2) * 1000) / p.cps + 200);
  }
  const restart = () => { if (btn && last) { clearTimeout(timer); run(...last); } }; // the running preview again, at whatever the level is now
  const setLevel = (x) => { level = x; storage?.setItem('strudel:pvlvl', level); show(); };
  return {
    async preview(b, build) {
      clearTimeout(timer); btn?.classList.remove('on');
      if (btn === b) return stop();
      btn = b; last = [b, build];
      await run(b, build);
    },
    restart,
    stop,
    setLevel,
    get button() { return btn; },
    get level() { return level; },
    /** A log-scale `input.pvin` with its <output> sibling; a change while a preview runs restarts it at the new level. */
    bindLevel(input) {
      ins.push(input);
      input.oninput = (e) => setLevel(+(10 ** Number(e.target.value)).toFixed(2));
      input.onchange = restart;
      show();
    },
  };
}
