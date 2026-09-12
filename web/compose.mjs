// Pure helpers behind the Compose page's kit selector and "Ask Claude" card. No DOM, no strudel: index.html feeds
// them text and gets text back, and test/compose.test.mjs runs them in Node.

const VOICES = ['bd', 'sd', 'hh']; // the drums layer's baseline voices: a kit missing one would log "sound not found"

/** The kits of `kitNames` (lib/kits.json keys) whose baseline voices are among the loaded `soundNames` (strudel keys its sound map in lower case), sorted. */
export const kitsIn = (kitNames, soundNames) => { const have = new Set(soundNames); return kitNames.filter((k) => VOICES.every((v) => have.has(`${k.toLowerCase()}_${v}`))).sort(); };

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

/** Every line comment (double slash) in `src`, keyed by the section it sits in (before the first section: `song`), in source order. */
export function sourceComments(src) {
  const out = {}; let at = 'song';
  for (const line of src.split('\n')) {
    at = line.match(/section\(\s*['"]([^'"]+)['"]/)?.[1] ?? at;
    const c = line.match(/(?:^|\s)\/\/\s?(.*)$/)?.[1].trim(); // whitespace before // keeps https:// out
    if (c) (out[at] ??= []).push(c);
  }
  return out;
}

/** The metadata file next to `song`: `demo.strudel` -> `demo.notes.json`. */
export const notesFile = (song) => song.replace(/\.strudel$/, '.notes.json');

/**
 * The "Why it sounds this way" card: source comments merged with the song's metadata file (`songs/<name>.notes.json`,
 * `{ prompt, requests: [{ date, ask, changes: [{ section, layer, axis, from, to, why }] }] }`), grouped by section in
 * source order. The file may hold more than the card shows: each change keeps its request's date and ask as `detail`.
 */
export function notesView(src, meta = {}) {
  const groups = new Map([['song', []], ...[...src.matchAll(/section\(\s*['"]([^'"]+)['"]/g)].map((m) => [m[1], []])]);
  for (const [sec, ls] of Object.entries(sourceComments(src))) groups.get(sec).push(...ls.map((text) => ({ text })));
  const requests = meta.requests ?? [];
  for (const r of requests) for (const c of r.changes ?? []) {
    const sec = c.section ?? 'song';
    if (!groups.has(sec)) groups.set(sec, []);
    groups.get(sec).push({
      text: c.why ?? r.ask ?? '',
      where: [c.layer, c.axis].filter(Boolean).join('.'),
      change: c.from != null && c.to != null ? `${c.from} → ${c.to}` : '',
      detail: [r.date, r.ask].filter(Boolean).join(': '),
    });
  }
  const changes = requests.reduce((n, r) => n + (r.changes?.length ?? 0), 0);
  return { prompt: meta.prompt ?? '', requests: requests.length, changes, last: requests.at(-1)?.date ?? '', sections: [...groups].filter(([, items]) => items.length).map(([name, items]) => ({ name, items })) };
}
