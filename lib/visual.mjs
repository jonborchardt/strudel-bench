// The visual score of a song: what a renderer composes from, derived from the built song (pat.strudel) and its onset
// counts and nothing else, so the check, the tests and the page see one composition. Every aesthetic choice (which
// world a mood gets, what a key's mode looks like, which drum voice is a pulse) is a table in lib/visual.json, not code.
// Imports nothing that registers layers: this module only reads what song() built.
import { S } from './strudel.mjs';
import POLICY from './visual.json' with { type: 'json' };
import KITS from './kits.json' with { type: 'json' };
export { POLICY };

const NONE = Object.freeze({ kind: 'none', voice: null, role: null, note: null });
/**
 * What one hap is, from its value alone: the fallback for patterns with no song() behind them (plain files, textures
 * stacked around a song, auditions), and the voice/note reading the tagged path uses too, so both share one table.
 * A kit voice arrives bare (bd, with a bank), indexed (sd:2) or written in full (RolandTR909_hh: superdough's
 * <kit>_<voice>, read only under a kit lib/kits.json knows, so a sample whose last word happens to be a voice name
 * stays a sample).
 */
export function classifyHap(v, policy = POLICY) {
  if (!v || typeof v !== 'object') return NONE;
  const s = v.s === undefined ? null : String(v.s).split(':')[0].split(',')[0].trim();
  const cut = s ? s.lastIndexOf('_') : -1;
  const cand = !s ? null : cut < 0 ? s : KITS[s.slice(0, cut)] ? s.slice(cut + 1) : null;
  if (cand && policy.voices[cand]) return { kind: 'drums', voice: cand, role: policy.voices[cand], note: null };
  let note = typeof v.note === 'number' ? v.note : null;
  if (typeof v.note === 'string') { try { note = S.noteToMidi?.(v.note) ?? null; } catch { note = null; } }
  if (note !== null) return { kind: 'pitched', voice: null, role: null, note };
  if (s) return { kind: 'hit', voice: null, role: 'hit', note: null };
  return NONE;
}
