// A theme binds a cast, its part packs and a dance for a world (lib/visual.json `themes`). The tableau reads the
// bound object: the dance's templates, poses and shots with the cast's people and expression pools, the dance's
// styling rules closed over the cast. Adding a kind of person is a pack, a cast, maybe a dance, and a row in the json.
import VISUAL from '../../lib/visual.json' with { type: 'json' };
import undead from './casts/undead.mjs';
import thriller from './dances/thriller.mjs';
export const CASTS = { undead };
export const DANCES = { thriller };
export const THEMES = Object.fromEntries(Object.entries(VISUAL.themes).map(([name, t]) => { const cast = CASTS[t.cast], dance = DANCES[t.dance]; if (!cast || !dance) throw new Error(`theme ${name}: unknown cast "${t.cast}" or dance "${t.dance}"`); return [name, bind(name, cast, dance)]; }));
export const themeNames = () => Object.keys(THEMES);
function bind(name, cast, dance) {
  return { name, cast: cast.archetypeNames, templates: dance.templates, phases: dance.phases, special: dance.special, fallback: dance.fallback, open: dance.open, close: dance.close, poses: dance.poses, still: dance.still, motion: dance.motion, expressions: cast.expressions, emotes: cast.emotes,
    styling: (s, idn, P, tpl, i) => dance.styling(cast, s, idn, P, tpl, i), alts: (s, base, P, idn) => dance.alts(cast, s, base, P, idn), odd: (s, st) => dance.odd(cast, s, st) };
}
