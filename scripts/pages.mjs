// Assemble a static copy of the page for GitHub Pages: no server, so save/export are hidden, packs stream from the
// Strudel CDN (the page falls back to lib/packs.json when samples/packs/packs.json is absent) and samples/user ships with the site.
// usage: node scripts/pages.mjs [outdir]   (default: dist/, wiped first)
import fs from 'node:fs';
import path from 'node:path';
import { userMap, songList } from '../server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));
if (ROOT.startsWith(OUT)) throw new Error(`refusing to wipe ${OUT}`);

fs.rmSync(OUT, { recursive: true, force: true });
const copy = (rel, to = rel) => fs.cpSync(path.join(ROOT, rel), path.join(OUT, to), { recursive: true });
copy('index.html');
copy('examples.html');
copy('web');
copy('lib');
copy('songs');
copy('samples/user');
copy('node_modules/@strudel/web/dist');
copy('node_modules/@breezystack/lamejs/dist'); // web/mp3.mjs: the mp3 export encodes in the browser
copy('node_modules/@strudel/web/dist/assets', 'assets'); // strudel resolves its clock SharedWorker against the page url
const write = (rel, obj) => fs.writeFileSync(path.join(OUT, rel), JSON.stringify(obj));
write('songs/index.json', songList());
write('samples/user/strudel.json', { ...userMap(), _base: 'samples/user/' }); // relative: a project page lives under /<repo>/
fs.writeFileSync(path.join(OUT, '.nojekyll'), ''); // jekyll would drop node_modules/
console.log(`wrote ${OUT}`);
