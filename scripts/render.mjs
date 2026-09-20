// Ask the open page to render a song (or a section / layer) offline and save renders/<name>.wav
// usage: node scripts/render.mjs songs/x.strudel [--section s] [--layer l] [--cycles n] [--name out] [--mp3]   (PORT env overrides 3000)
// --cycles n: song cycles for a whole-song render, bars of the section when --section is given
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

/** POST /render on the server at `port` and return the path of the file it wrote; throws with the server's text when it cannot. */
export async function renderVia(body, port = process.env.PORT || 3000) {
  // http.request, not fetch: fetch gives up when no headers arrive within 300 s, and a whole-song render answers only
  // when the page has rendered every cycle (the server itself waits 15 minutes)
  const res = await new Promise((resolve) => {
    const req = http.request({ host: 'localhost', port, path: '/render', method: 'POST' }, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c)).on('end', () => resolve({ status: r.statusCode, text: Buffer.concat(chunks).toString() }));
    });
    req.on('error', () => resolve(null));
    req.end(JSON.stringify(body));
  });
  if (!res) throw new Error(`server not running on :${port}. run: npm start`);
  if (res.status !== 200) throw new Error(`${res.status}: ${res.text}`);
  return JSON.parse(res.text).path;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { section: { type: 'string' }, layer: { type: 'string' }, cycles: { type: 'string' }, name: { type: 'string' }, mp3: { type: 'boolean' } } });
  const file = positionals.find((a) => a.endsWith('.strudel'));
  if (!file) { console.error('usage: node scripts/render.mjs songs/x.strudel [--section s] [--layer l] [--cycles n] [--name out]'); process.exit(2); }
  try { console.log(await renderVia({ song: path.basename(file), section: o.section, layer: o.layer, cycles: o.cycles ? Number(o.cycles) : undefined, name: o.name, mp3: !!o.mp3 })); }
  catch (e) { console.error(e.message); process.exit(1); }
}
