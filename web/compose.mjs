// Pure helpers behind the Compose page's kit selector and "Ask Claude" card. No DOM, no strudel: index.html feeds
// them text and gets text back, and test/compose.test.mjs runs them in Node.

const VOICES = ['bd', 'sd', 'hh']; // the drums layer's baseline voices: a kit missing one would log "sound not found"

/**
 * Drum kits among the loaded sound names: every `<kit>_<voice>` prefix that has the baseline voices, sorted.
 * strudel keys its sound map in lower case and registers each bank alias as its own key, so the drum-machine
 * pack's own `names` (`RolandTR909_bd`, ...) restore the canonical spelling and its `aliases`
 * (`{ RolandTR909: 'tr909', ... }`) say which prefixes are copies to drop.
 */
export function kitsIn(soundNames, { names = [], aliases = {} } = {}) {
  const have = new Set(soundNames);
  const canon = new Map([...names, ...Object.keys(aliases)].map((k) => k.split('_')[0]).map((k) => [k.toLowerCase(), k]));
  const alias = new Set(Object.values(aliases).map((a) => a.toLowerCase()));
  const kits = new Set();
  for (const n of soundNames) {
    const i = n.indexOf('_'), p = n.slice(0, i);
    if (i > 0 && !alias.has(p) && VOICES.every((v) => have.has(`${p}_${v}`))) kits.add(canon.get(p) ?? p);
  }
  return [...kits].sort();
}

const KIT = /kit:\s*(['"])[^'"]+\1/;
/** The song-level kit in `src` (the song({ ... }) header), or `fallback` when it names none. */
export const kitOf = (src, fallback = 'RolandTR909') => src.match(/song\(\s*\{[^}]*?kit:\s*['"]([^'"]+)['"]/)?.[1] ?? fallback;
/** `src` with its song-level kit set to `kit`: rewrites the existing literal or inserts one into the song header. */
export function setKit(src, kit) {
  const m = src.match(/song\(\s*\{[^}]*?\}/);
  if (!m) return src; // plain strudel: nothing to set
  const head = KIT.test(m[0]) ? m[0].replace(KIT, `kit: '${kit}'`) : m[0].replace(/\{/, `{ kit: '${kit}',`);
  return src.slice(0, m.index) + head + src.slice(m.index + m[0].length);
}

/** Source of one section(...) call, or '' when `src` has none by that name. */
export const sectionSource = (src, name) => src.match(new RegExp(`section\\(\\s*['"]${name}['"][\\s\\S]*?\\n\\s*\\}\\),?`))?.[0].trim() ?? '';

/**
 * The paste-ready request. `notes` are `{ section, cycle, text }` pinned where the playhead was, in the order the
 * user added them; `sections` (from the last play, `{ name, offset, cycles }`) turn a cycle into "bar n of section".
 * A note in a section's first bar also quotes the section before it: the ear often reacts a moment late.
 */
export function buildRequest({ song, src, notes, sections = [] }) {
  const header = src.match(/song\(\s*\{[^}]*\}/)?.[0].replace(/\s+/g, ' ') ?? '';
  const at = (n) => sections.find((x) => x.name === n.section);
  const where = (n) => { const s = at(n); return `cycle ${n.cycle.toFixed(1)} (${n.section}${s ? `, bar ${Math.floor(n.cycle - s.offset) + 1} of ${s.cycles}` : ''})`; };
  const quoted = new Set();
  for (const n of notes) {
    const s = at(n), i = sections.indexOf(s);
    if (s && n.cycle - s.offset < 1 && i > 0) quoted.add(sections[i - 1].name);
    quoted.add(n.section);
  }
  return [
    `Song: songs/${song}`,
    sections.length ? `Sections: ${sections.map((s) => `${s.name} (${s.cycles} bars from cycle ${s.offset})`).join(', ')}` : '',
    '',
    'I listened and pinned each note at the cycle the playhead was on. A note is about what I heard there: that exact',
    'spot, the section it is in, or what led into it just before. Please make these changes and keep everything else as it is:',
    ...notes.map((n, i) => `${i + 1}. ${where(n)}: ${n.text}`),
    '',
    'Current source of the parts around those spots:',
    '```',
    [header, ...[...quoted].map((s) => sectionSource(src, s))].filter(Boolean).join('\n\n'),
    '```',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
