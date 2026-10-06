// A theme binds a cast, its part packs and a dance for a world (lib/visual.json `themes`). The tableau reads the
// bound object: the dance's templates, poses and shots with the cast's people and expression pools, the dance's
// styling rules closed over the cast, and `identity`, the cast's own generator. Adding a kind of person is a pack,
// a cast, maybe a dance, and a row in the json; the dance `editorial` is the tableau's own templates, poses, phases
// and rules (a null here: every dance field stays undefined and the tableau's fallbacks take over). PACKS and CASTS are
// limner's registries and DANCES is this file's; between them they are the names a row may use; `bindTheme` refuses an unknown one at import, naming it, so a misspelt row
// never draws a blank stage. The sheets (parts.html, casts.html, poses.html) list packs, casts and themes from here.
import VISUAL from '../../lib/visual.json' with { type: 'json' };
import { identityFrom, CASTS, PACKS } from 'limner'; // the casts and the part packs are limner's; the dances and the binding are this repo's
import thriller from './dances/thriller.mjs';
export { CASTS, PACKS }; // re-exported so a consumer of the themes still finds all three names in one place
export const DANCES = { thriller, editorial: null };
/** One row bound, or an error naming what the row got wrong. */
export function bindTheme(name, t) {
  const cast = CASTS[t.cast];
  if (!cast) throw new Error(`theme ${name}: unknown cast "${t.cast}" (casts: ${Object.keys(CASTS).join(', ')})`);
  if (!(t.dance in DANCES)) throw new Error(`theme ${name}: unknown dance "${t.dance}" (dances: ${Object.keys(DANCES).join(', ')})`);
  for (const p of t.packs ?? []) if (!PACKS[p]) throw new Error(`theme ${name}: unknown pack "${p}" (packs: ${Object.keys(PACKS).join(', ')})`);
  return bind(name, cast, DANCES[t.dance]);
}
export const THEMES = Object.fromEntries(Object.entries(VISUAL.themes).map(([name, t]) => [name, bindTheme(name, t)]));
export const themeNames = () => Object.keys(THEMES);
function bind(name, cast, dance) {
  const d = dance ?? {};
  // `stances` names a limner pack of single-body stances; `poses` is the dance's own blocking, where several of them stand
  return { name, cast: cast.archetypeNames, identity: (s, n, i) => identityFrom(cast, s, n, i), templates: d.templates, phases: d.phases, special: d.special, fallback: d.fallback, open: d.open, close: d.close, poses: d.poses, still: d.still, stances: d.stances, motion: d.motion, expressions: cast.expressions, emotes: cast.emotes,
    styling: dance ? (s, idn, P, tpl, i) => dance.styling(cast, s, idn, P, tpl, i) : undefined, alts: dance ? (s, base, P, idn) => dance.alts(cast, s, base, P, idn) : undefined, odd: dance ? (s, st) => dance.odd(cast, s, st) : undefined };
}
