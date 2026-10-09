// Render every song into renders/<tag>/ (a wav, optionally an mp3, and an analysis json each) through the open page,
// and compare two tags. usage: node scripts/renderall.mjs <tag> [song.strudel ...] [--mp3]   (PORT env; a page must be
// open: PORT=3001 npm run headless)   |   node scripts/renderall.mjs --compare <tagA> <tagB>
// Resumable: a song whose wav exists under the tag is skipped. A render of silence means the page died (memory:
// silent renders), so it is retried once and then reported, never recorded.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderVia } from './render.mjs';
import { songList } from '../server.mjs';
import { readWav, analyze } from '../lib/analyze.mjs';

const ROOT = path.resolve(import.meta.dirname, '..'), RENDERS = path.join(ROOT, 'renders');
export const KEYS = ['rms', 'peak', 'crest', 'centroidHz', 'highRatio', 'lowRatio', 'width', 'tail'];
const db = (x) => 20 * Math.log10(x || 1e-9);

/** true when every sample of the wav in `buf` is zero: the page rendered nothing. */
export const silent = (buf) => readWav(buf).frames.every((ch) => ch.every((x) => x === 0));

/** Per-song deltas b - a of KEYS (dB for rms and peak), for the songs both tags have. */
export function compareTable(a, b) {
  return Object.keys(a).filter((s) => b[s]).map((s) => ({
    song: s,
    rmsDb: +(db(b[s].rms) - db(a[s].rms)).toFixed(1),
    peakDb: +(db(b[s].peak) - db(a[s].peak)).toFixed(1),
    ...Object.fromEntries(KEYS.slice(2).map((k) => [k, +(b[s][k] - a[s][k]).toFixed(3)])),
  }));
}
