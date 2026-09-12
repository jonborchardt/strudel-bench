// Record why a song was changed, in songs/<name>.notes.json (what the Compose page's "Why it sounds this way" card shows).
// usage: node scripts/note.mjs songs/x.strudel --prompt "one-line summary of the original request"
//        node scripts/note.mjs songs/x.strudel --ask "make the drop more urgent" \
//          --change "drop.melody.brightness .5>.7 raised because the user asked for a more urgent chorus" [--change ...]
// a --change is `section[.layer[.axis]] [from>to] why...`; `song` is the section for song-level settings (kit, cps).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Parse one --change argument. */
export function parseChange(text) {
  const [where, ...rest] = text.trim().split(/\s+/);
  const [section, layer, axis] = where.split('.');
  const change = { section };
  if (layer) change.layer = layer;
  if (axis) change.axis = axis;
  const m = rest[0]?.match(/^(-?[\d.]+)>(-?[\d.]+)$/);
  if (m) { change.from = Number(m[1]); change.to = Number(m[2]); rest.shift(); }
  change.why = rest.join(' ');
  return change;
}

/** Apply a note to `file` (songs/<name>.notes.json): sets the prompt and/or appends one request. Returns the metadata. */
export function addNote(file, { prompt, ask, changes = [], date = new Date().toISOString().slice(0, 10) }) {
  const meta = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (prompt) meta.prompt = prompt;
  if (ask || changes.length) (meta.requests ??= []).push({ date, ask, changes: changes.map(parseChange) });
  fs.writeFileSync(file, JSON.stringify(meta, null, 2) + '\n');
  return meta;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const song = args.find((a) => a.endsWith('.strudel'));
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const changes = args.flatMap((a, i) => (a === '--change' ? [args[i + 1]] : []));
  if (!song || !(opt('prompt') || opt('ask') || changes.length)) { console.error('usage: node scripts/note.mjs songs/x.strudel [--prompt "..."] [--ask "..."] [--change "section.layer.axis from>to why"]...'); process.exit(2); }
  const meta = addNote(song.replace(/\.strudel$/, '.notes.json'), { prompt: opt('prompt'), ask: opt('ask'), changes });
  console.log(`${song.replace(/\.strudel$/, '.notes.json')}: ${meta.requests?.length ?? 0} requests`);
}
