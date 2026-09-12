// Float PCM -> MP3 bytes, one encoder for the page (web/) and Node (scripts/mp3.mjs). The relative import keeps it
// runnable in both: the page loads it through /node_modules/ and the Pages build copies lamejs/dist next to strudel.
import { Mp3Encoder } from '../node_modules/@breezystack/lamejs/dist/lamejs.js';

/** `channels` are Float32Array(-1..1), at most two are used. Returns the MP3 as a Uint8Array. */
export function encodeMp3(channels, rate, { kbps = 192 } = {}) {
  const pcm = channels.slice(0, 2).map((f) => Int16Array.from(f, (s) => Math.round(Math.max(-1, Math.min(1, s)) * 32767)));
  const enc = new Mp3Encoder(pcm.length, rate, kbps);
  const out = [];
  for (let i = 0; i < pcm[0].length; i += 1152 * 32) { // ponytail: whole file in memory; fine for song-length renders
    const chunk = enc.encodeBuffer(...pcm.map((c) => c.subarray(i, i + 1152 * 32)));
    if (chunk.length) out.push(chunk);
  }
  out.push(enc.flush());
  const mp3 = new Uint8Array(out.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of out) { mp3.set(c, o); o += c.length; }
  return mp3;
}
