// A theme binds a cast, its part packs and a dance for a world (lib/visual.json `themes`). The tableau reads the
// bound object: the dance's templates, poses and shots with the cast's people and expression pools, the dance's
// styling rules closed over the cast, and `identity`, the cast's own generator. Adding a kind of person is a pack,
// a cast, maybe a dance, and a row in the json; the dance `editorial` is the tableau's own templates, poses, phases
// and rules (a null here: every dance field stays undefined and the tableau's fallbacks take over). PACKS, CASTS and
// DANCES are the names a row may use; `bindTheme` refuses an unknown one at import, naming it, so a misspelt row
// never draws a blank stage. The sheets (parts.html, casts.html, poses.html) list packs, casts and themes from here.
import VISUAL from '../../lib/visual.json' with { type: 'json' };
import { identityFrom } from './cast.mjs';
import * as eighties from './parts/eighties.mjs';
import * as undeadPack from './parts/undead.mjs';
import * as dwarf from './parts/dwarf.mjs';
import * as elf from './parts/elf.mjs';
import editorial from './casts/editorial.mjs';
import undead from './casts/undead.mjs';
import dwarves from './casts/dwarves.mjs';
import elves from './casts/elves.mjs';
import thriller from './dances/thriller.mjs';
export const PACKS = { eighties, undead: undeadPack, dwarf, elf }; // importing a pack registers and tags its parts; a cast imports the packs it wears, and a row names them
export const CASTS = { editorial, undead, dwarves, elves };
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
  return { name, cast: cast.archetypeNames, identity: (s, n, i) => identityFrom(cast, s, n, i), templates: d.templates, phases: d.phases, special: d.special, fallback: d.fallback, open: d.open, close: d.close, poses: d.poses, still: d.still, motion: d.motion, expressions: cast.expressions, emotes: cast.emotes,
    styling: dance ? (s, idn, P, tpl, i) => dance.styling(cast, s, idn, P, tpl, i) : undefined, alts: dance ? (s, base, P, idn) => dance.alts(cast, s, base, P, idn) : undefined, odd: dance ? (s, st) => dance.odd(cast, s, st) : undefined };
}
