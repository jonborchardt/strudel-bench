// Words → axis deltas. Data lives in descriptors.json (control vocabulary) and overlays.json (emotions/genres).
// Loaded synchronously in Node and lazily in the browser via loadVocab(); both hosts end up with the same tables.
import { AXIS_NAMES } from './axes.mjs';
import { clamp01 } from './strudel.mjs';

// Filled in place (never reassigned) so every holder of these objects, strudelLib included, sees the loaded tables.
export const DESCRIPTORS = {};
export const OVERLAYS = {};
export const HARMONY = { progressions: {}, modes: [] };
export const MODIFIERS = { slightly: 0.5, 'a little': 0.5, 'a bit': 0.5, somewhat: 0.75, more: 1, much: 2, way: 2, 'a lot': 2, extremely: 3, very: 1.5 };

const replace = (table, data) => { for (const k of Object.keys(table)) delete table[k]; Object.assign(table, data); };
export async function loadVocab(fetchJson) {
  replace(DESCRIPTORS, await fetchJson('descriptors.json'));
  replace(OVERLAYS, await fetchJson('overlays.json'));
  replace(HARMONY, await fetchJson('harmony.json'));
}
// Node: load eagerly from disk. Browser: index.mjs calls loadVocab with fetch.
if (typeof process !== 'undefined' && process.versions?.node) {
  const { readFileSync } = await import('node:fs');
  await loadVocab((f) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8')));
}

export const COMPARATIVE = [[/ier$/, 'y'], [/er$/, ''], [/r$/, '']]; // heavier→heavy, darker→dark, sparser→sparse
function lookup(word) {
  const w = word.toLowerCase();
  const tables = { ...OVERLAYS, ...DESCRIPTORS };
  if (tables[w]) return { key: w, vec: tables[w], overlay: !DESCRIPTORS[w] };
  for (const [re, rep] of COMPARATIVE) {
    const base = w.replace(re, rep);
    if (base !== w && tables[base]) return { key: base, vec: tables[base], overlay: !DESCRIPTORS[base] };
  }
  return null;
}

/** "much heavier, a little darker" → per-axis deltas plus every contribution, for collision reporting. */
export function parsePhrase(text) {
  const tokens = text.toLowerCase().replace(/[.,;]/g, ' , ').split(/\s+/).filter(Boolean);
  const contributions = {};
  const unknown = [];
  const harmony = [];
  let scale = 1, negate = false, pendingRelative = false;
  const flush = () => { scale = 1; negate = false; };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const two = `${t} ${tokens[i + 1] ?? ''}`.trim();
    if (t === ',' || t === 'and' || t === 'but' || t === 'also' || t === 'make' || t === 'it' || t === 'the') { if (t === ',' || t === 'and' || t === 'but') flush(); continue; }
    if (MODIFIERS[two] !== undefined) { scale *= MODIFIERS[two]; i++; continue; }
    if (MODIFIERS[t] !== undefined) { scale *= MODIFIERS[t]; continue; }
    if (t === 'less') { negate = true; continue; }
    // Harmony words are states: no modifiers, no negation, no comparatives.
    if (t === 'relative') { pendingRelative = true; flush(); continue; }
    if (HARMONY.modes.includes(t)) { harmony.push({ word: t, kind: 'mode', value: t, relative: pendingRelative }); pendingRelative = false; flush(); continue; }
    if (HARMONY.progressions[t]) { harmony.push({ word: t, kind: 'progression', value: HARMONY.progressions[t] }); flush(); continue; }
    const hit = lookup(t);
    if (!hit) { unknown.push(t); continue; }
    const modifier = (negate ? -1 : 1) * scale;
    for (const [axis, d] of Object.entries(hit.vec)) {
      if (!AXIS_NAMES.includes(axis)) continue;
      (contributions[axis] ??= []).push({ word: t, key: hit.key, overlay: hit.overlay, modifier, delta: d * modifier });
    }
    flush();
  }
  if (pendingRelative) harmony.push({ word: 'relative', kind: 'relative' });
  const deltas = Object.fromEntries(Object.entries(contributions).map(([a, cs]) => [a, cs.reduce((s, c) => s + c.delta, 0)]));
  return { deltas, contributions, unknown, harmony };
}

/** Apply deltas to a current state (missing axes = 0.5), clamping and reporting saturation. */
export function applyDeltas(current, deltas) {
  const out = {};
  for (const [axis, requestedDelta] of Object.entries(deltas)) {
    const from = current[axis] ?? 0.5;
    const to = +clamp01(from + requestedDelta).toFixed(4);
    const appliedDelta = +(to - from).toFixed(4);
    out[axis] = { from, requestedDelta, appliedDelta, to, saturated: Math.abs(appliedDelta - requestedDelta) > 1e-6 };
  }
  return out;
}

/**
 * Axis values read back as words: for each axis at least `min` away from the .5 baseline, the descriptor whose main
 * axis it is, in that direction (brightness .2 -> "dark"). The reverse of parsePhrase, at word resolution: what a
 * section "sounds like" in the vocabulary requests arrive in. Signals and strings are skipped.
 */
export function describeAxes(attrs, min = 0.15) {
  const words = [];
  for (const [axis, v] of Object.entries(attrs)) {
    if (!AXIS_NAMES.includes(axis) || typeof v !== 'number' || Math.abs(v - 0.5) < min) continue;
    const dir = Math.sign(v - 0.5);
    let best = null, weight = 0;
    for (const [word, vec] of Object.entries(DESCRIPTORS)) {
      const d = vec[axis] ?? 0;
      if (Math.sign(d) !== dir) continue;
      const main = Object.entries(vec).every(([a, x]) => Math.abs(x) <= Math.abs(d)); // this axis is the word's strongest
      if (main && Math.abs(d) > weight) { best = word; weight = Math.abs(d); }
    }
    if (best) words.push(Math.abs(v - 0.5) >= 0.35 ? `very ${best}` : best);
  }
  return words;
}
