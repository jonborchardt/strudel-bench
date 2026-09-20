// Video export: the world run offline, frame by frame, from the same score, stream and fixed step as the live stage,
// never a recording of the page. streamOf reads every hap of the evaluated song as the live tap would deliver it;
// renderFrames drives a performance at exactly `fps` (the song after a title lead, then a tail while the reverb
// rings) and hands each frame to an emitter; exportVideo is the WebCodecs pipeline (the page only): H.264 + AAC in
// an MP4 when the browser encodes them, else VP9 + Opus in a WebM, muxed in memory, with the audio from the
// existing offline render resampled to 48 kHz under the same lead. The frame loop and the stream run in Node
// (tests); the codecs do not.
import { eventOf, createPerformance } from './host.mjs';
import { layerBase } from '../../lib/song.mjs';

export const FPS = 30, WIDTH = 1920, HEIGHT = 1080;
export const LEAD = 1.5, TAIL = 3; // seconds of title before the song, seconds after it for the tail to ring
const RATE = 48000; // Opus wants it; AAC takes it

/** Every hap of every part of an evaluated song, tagged as the live tap tags it, at its audio time; a plain pattern or a wrapper around a song (textures outside it) is read whole by value, as live. `cycles` bounds a plain pattern. */
export function streamOf(pat, cycles = 8) {
  const ir = pat.strudel, out = [];
  if (ir && ir.pattern === pat) {
    for (const s of ir.sections) for (const [name, l] of Object.entries(s.layers)) {
      const scale = s.span / s.cycles; // the section's bars in song cycles (its own tempo)
      for (const h of l.pattern.queryArc(0, s.cycles)) {
        if (!h.hasOnset()) continue;
        const cycle = s.offset + h.whole.begin.valueOf() * scale;
        out.push({ ...eventOf(h, name, layerBase(name), cycle / ir.meta.cps), cycle, dur: h.duration.valueOf() * scale });
      }
    }
  } else {
    const cps = ir?.meta.cps ?? 0.5;
    for (const h of pat.queryArc(0, ir?.total || cycles)) if (h.hasOnset()) out.push(eventOf(h, null, null, h.whole.begin.valueOf() / cps));
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The title card's text: the song's name and its first comment line (a flag line such as `// @blog` skipped, a leading `name:` dropped). */
export function titleOf(name, source = '') {
  const base = name.replace(/\.strudel$/, '');
  let line = source.split('\n').map((l) => l.trim()).find((l) => l.startsWith('//') && !/^\/\/\s*@\w+\s*$/.test(l)) ?? '';
  line = line.replace(/^\/\/\s*/, '');
  if (line.startsWith(`${base}:`)) line = line.slice(base.length + 1).trim();
  return { name: base, line };
}

export const frameCount = (seconds, { fps = FPS, lead = LEAD, tail = TAIL } = {}) => Math.ceil((lead + seconds + tail) * fps);

/** The title over the first seconds: in over half a second, held through the lead and a little of the song, out over a second. */
export function drawTitle(ctx, w, h, title, t, lead = LEAD) {
  if (!title?.name) return;
  const a = t < 0.5 ? t / 0.5 : t < lead + 1.2 ? 1 : t < lead + 2.4 ? 1 - (t - lead - 1.2) / 1.2 : 0;
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0 0 0 / .5)'; ctx.fillRect(0, h * 0.37, w, h * 0.26);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0 0 0 / .6)'; ctx.shadowBlur = h * 0.01;
  ctx.font = `600 ${Math.round(h * 0.085)}px system-ui, sans-serif`; ctx.fillText(title.name, w / 2, h * (title.line ? 0.47 : 0.5));
  if (title.line) { ctx.font = `${Math.round(h * 0.032)}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255 255 255 / .85)'; ctx.fillText(title.line, w / 2, h * 0.565, w * 0.9); }
  ctx.restore();
}

/**
 * The world offline: frame k is the time k / fps; the song starts after `lead` seconds and its clock holds on its
 * last moment through the tail (never wrapping to a false boundary); the performance is advanced to the frame in
 * fixed steps with the events due, drawn, titled, and handed to `emit(k, time)`. `seconds` is the song's own length.
 * The same inputs give the same frames, live's world at live's step. Yields to the host every few frames so a badge
 * can paint. Resolves to { frames, perf }.
 */
export async function renderFrames({ world, score, stream, seconds, title, ctx, w, h, fps = FPS, lead = LEAD, tail = TAIL, emit = async () => {}, progress = () => {}, yieldEvery = 10 }) {
  const perf = createPerformance(world, score, { w: 16, h: 9 });
  for (const e of stream) perf.push({ ...e, t: e.t + lead });
  const n = frameCount(seconds, { fps, lead, tail }), cps = score.cps, last = Math.max(0, seconds - 1e-6);
  perf.advance(0, 0);
  for (let k = 0; k < n; k++) {
    const t = k / fps, song = Math.min(Math.max(0, t - lead), last);
    perf.advance(t, song * cps);
    perf.draw(ctx, w, h);
    drawTitle(ctx, w, h, title, t, lead);
    await emit(k, t);
    if (k % yieldEvery === 0) { progress(k, n); await new Promise((r) => setTimeout(r)); }
  }
  progress(n, n);
  return { frames: n, perf };
}

// ---------- the page only, from here: WebCodecs and the muxers ----------

/**
 * The codecs this browser encodes at this size: an MP4 with H.264 (high, main or constrained baseline, level 4.0
 * covers 1080p30) and AAC where the platform gives it, else Opus (every Chromium encodes H.264 and Opus, AAC only on
 * some platforms; an MP4 carries Opus and YouTube reads it); else a WebM with VP9 and Opus; throws when nothing.
 */
export async function pickCodecs(width = WIDTH, height = HEIGHT, fps = FPS) {
  const video = { width, height, framerate: fps, bitrate: 10_000_000 };
  const ok = async (kind, cfg) => { try { return (await globalThis[kind].isConfigSupported(cfg)).supported; } catch { return false; } };
  const audio = async (codec) => ok('AudioEncoder', { codec, sampleRate: RATE, numberOfChannels: 2, bitrate: 192_000 });
  const aac = await audio('mp4a.40.2'), opus = await audio('opus');
  if (aac || opus) for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028']) {
    if (await ok('VideoEncoder', { codec, ...video, avc: { format: 'avc' } })) return { ext: 'mp4', video: codec, audio: aac ? 'mp4a.40.2' : 'opus', avc: { format: 'avc' }, mux: { video: 'avc', audio: aac ? 'aac' : 'opus' } };
  }
  if (opus && await ok('VideoEncoder', { codec: 'vp09.00.40.08', ...video })) return { ext: 'webm', video: 'vp09.00.40.08', audio: 'opus', mux: { video: 'V_VP9', audio: 'A_OPUS' } };
  throw new Error('this browser cannot encode video (WebCodecs with H.264 or VP9, and AAC or Opus)');
}

/** The rendered song at 48 kHz stereo with `lead` seconds of silence before it, through an OfflineAudioContext. */
async function resample(buffer, lead) {
  const ctx = new OfflineAudioContext(2, Math.ceil((lead + buffer.duration) * RATE), RATE);
  const src = ctx.createBufferSource(); src.buffer = buffer; src.connect(ctx.destination); src.start(lead);
  return ctx.startRendering();
}

/**
 * The whole video: the frames from renderFrames through a VideoEncoder, the audio through an AudioEncoder, both into
 * one muxer in memory. `audio` is the offline render of the song (its tail included); `seconds` the song's own length.
 * Resolves to { blob, ext, frames, seconds }. ponytail: the file is built in memory (a 15-minute 1080p song is several
 * hundred MB); stream it to a FileSystemWritableFileStream target when that bites.
 */
export async function exportVideo({ pick, audio, world, score, stream, title, seconds, fps = FPS, width = WIDTH, height = HEIGHT, lead = LEAD, tail = TAIL, progress = () => {} }) {
  pick ??= await pickCodecs(width, height, fps);
  const { Muxer, ArrayBufferTarget } = await import(pick.ext === 'mp4' ? 'mp4-muxer' : 'webm-muxer');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: pick.mux.video, width, height, frameRate: fps }, audio: { codec: pick.mux.audio, sampleRate: RATE, numberOfChannels: 2 }, ...(pick.ext === 'mp4' ? { fastStart: 'in-memory' } : {}) });
  let failed = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e; } });
  venc.configure({ codec: pick.video, width, height, bitrate: 10_000_000, framerate: fps, ...(pick.avc ? { avc: pick.avc } : {}) });
  const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { failed = e; } });
  aenc.configure({ codec: pick.audio, sampleRate: RATE, numberOfChannels: 2, bitrate: 192_000 });
  // the audio first, in 100 ms pieces, planar float
  const pcm = await resample(audio, lead), L = pcm.getChannelData(0), R = pcm.getChannelData(1), piece = RATE / 10;
  for (let i = 0; i < pcm.length; i += piece) {
    const n = Math.min(piece, pcm.length - i), data = new Float32Array(2 * n);
    data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / RATE) * 1e6), data });
    aenc.encode(ad); ad.close();
  }
  const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d');
  const { frames } = await renderFrames({ world, score, stream, seconds, title, ctx, w: width, h: height, fps, lead, tail, progress,
    emit: async (k) => {
      if (failed) throw failed;
      while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4)); // let the encoder catch up before the queue balloons
      const frame = new VideoFrame(canvas, { timestamp: Math.round((k / fps) * 1e6), duration: Math.round(1e6 / fps) });
      venc.encode(frame, { keyFrame: k % (fps * 2) === 0 }); frame.close();
    } });
  await venc.flush(); await aenc.flush();
  if (failed) throw failed;
  muxer.finalize(); venc.close(); aenc.close();
  return { blob: new Blob([target.buffer], { type: pick.ext === 'mp4' ? 'video/mp4' : 'video/webm' }), ext: pick.ext, frames, seconds };
}
