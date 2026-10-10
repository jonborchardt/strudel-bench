// What a one-shot is made of, as numbers and as words, so a sound can be chosen by reading its row instead of by ear.
// Shared by scripts/samplemeta.mjs (every pack's meta carries them), scripts/hitfeatures.mjs (a folder of candidates) and
// the catalogue page. Node and the page both import it: no fs, no DOM.
import { analyze } from './analyze.mjs';

/** The drum voice a sound name points at; the first rule that matches wins, so the specific words come before the general ones. */
export const RULES = [
  [/open|\boh\b|ohh|ohat/, 'oh'], [/closed|\bch\b|chh|hihat|hi-?hat|\bhat|\bhh\b/, 'hh'],
  [/kick|bass ?drum|\bbd\b|\bkik/, 'bd'], [/snare|\bsnr?\b|\bsd\b/, 'sd'], [/clap|\bcp\b/, 'cp'],
  [/rim|stick|cross/, 'rim'], [/cowbell|bell|bling|\bcb\b/, 'cb'], [/ride|\brd\b/, 'rd'], [/crash|cymbal|splash|china|\bcr\b/, 'cr'],
  [/floor|low ?tom|\blt\b/, 'lt'], [/hi(gh)? ?tom|rack|\bht\b/, 'ht'], [/tom|\bmt\b/, 'mt'],
];
export const guessVoice = (name) => { const n = String(name).toLowerCase().replace(/[_-]+/g, ' '); for (const [re, v] of RULES) if (re.test(n)) return v; return 'other'; };

/** Where "tight / medium / long" (decay ms) and "deep / mid / bright" (centroid Hz) fall, per voice: a hat's bright is a kick's unthinkable. */
export const EDGES = {
  bd: { decay: [150, 350], tone: [75, 110] }, lt: { decay: [150, 400], tone: [90, 140] }, mt: { decay: [150, 400], tone: [110, 180] }, ht: { decay: [150, 400], tone: [140, 240] },
  sd: { decay: [120, 300], tone: [900, 1800] }, cp: { decay: [120, 300], tone: [900, 1800] }, rim: { decay: [60, 200], tone: [900, 2000] }, cb: { decay: [100, 300], tone: [600, 1200] },
  hh: { decay: [60, 200], tone: [3500, 6500] }, oh: { decay: [200, 600], tone: [3500, 6500] }, rd: { decay: [300, 900], tone: [2500, 5000] }, cr: { decay: [400, 1200], tone: [2500, 5000] },
  other: { decay: [150, 400], tone: [1000, 4000] },
};

/** attack ms (start to 90% of peak), decay ms (peak to -30 dB on a 5 ms envelope), centroid, the low (< 150 Hz) and high (> 5 kHz) shares, flatness. `w` is a readWav result. */
export function hitFeatures(w) {
  const x = w.frames[0], rate = w.rate;
  let peak = 0, at = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > peak) { peak = Math.abs(x[i]); at = i; }
  let a90 = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) >= .9 * peak) { a90 = i; break; }
  const blk = Math.max(1, Math.round(rate * .005)); let dec = x.length;
  for (let i = at; i + blk <= x.length; i += blk) { let m = 0; for (let j = i; j < i + blk; j++) m = Math.max(m, Math.abs(x[j])); if (m < peak * 10 ** (-30 / 20)) { dec = i; break; } }
  const a = analyze(w, { cps: .5 });
  return { attackMs: +((a90 / rate) * 1000).toFixed(1), decayMs: +(((dec - at) / rate) * 1000).toFixed(0), centroidHz: a.centroidHz, low: a.lowRatio, high: a.highRatio, flatness: a.flatness, crest: a.crest };
}

export function bucket(r, edges = EDGES.other) {
  const d = r.decayMs < edges.decay[0] ? 'tight' : r.decayMs < edges.decay[1] ? 'medium' : 'long';
  const t = r.centroidHz < edges.tone[0] ? 'deep' : r.centroidHz < edges.tone[1] ? 'mid' : 'bright';
  return `${d} · ${t}`;
}
/** Plain words for a hit: decay, tone, attack, weight, air, texture. `voice` picks the edges. */
export function words(r, voice = 'other') {
  const edges = EDGES[voice] ?? EDGES.other;
  const attack = r.attackMs < 3 ? 'click' : r.attackMs < 10 ? 'snap' : 'soft';
  const [d, t] = bucket(r, edges).split(' · ');
  const weight = r.low > .9 ? 'all low' : r.low > .6 ? 'heavy' : r.low > .25 ? 'some low' : 'no low';
  const air = r.high > .3 ? 'airy' : r.high > .08 ? 'some air' : 'dull';
  const texture = r.flatness > .35 ? 'noisy' : r.flatness > .12 ? 'mixed' : 'tonal';
  return `${d} ${t} ${attack}, ${weight}, ${air}, ${texture}`;
}
