// Assemble a static copy of the page for GitHub Pages: no server, so save/export are hidden, packs stream from the
// Strudel CDN (the page falls back to lib/packs.json when samples/packs/packs.json is absent), and of the local packs in
// samples/user only those whose pack.json says deploy (whole or a subset of sounds) ship with the site. A song that
// declares a pack that does not ship is left out of the deployed song list; a song whose declared packs ship is
// re-checked against exactly the deployed sounds, so a subset that drops a sound the song uses fails the build here.
// usage: node scripts/pages.mjs [outdir]   (default: dist/, wiped first)
import fs from 'node:fs';
import path from 'node:path';
import { userPacks, userMap, songList, listedSongs } from '../server.mjs';
import { packsOf, registerSamples, SAMPLE_PROBLEMS } from '../lib/packs.mjs';
import { checkFile } from './check.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));
if (ROOT.startsWith(OUT)) throw new Error(`refusing to wipe ${OUT}`);

// deployment policy: deploy: true ships the pack, deploy: [sounds] ships that subset, anything else stays local
const shipped = {};
for (const [name, p] of Object.entries(userPacks())) {
  if (!p.deploy) continue;
  if (!p.license) throw new Error(`samples/user/${name}/pack.json: deploying a pack needs a "license"`);
  const keep = p.deploy === true ? Object.keys(p.sounds) : p.deploy;
  const absent = keep.filter((s) => !p.sounds[s]);
  if (absent.length) throw new Error(`samples/user/${name}/pack.json: deploy lists sounds the pack does not have: ${absent.join(', ')}`);
  if (p.problems.length) throw new Error(`samples/user/${name}/pack.json: ${p.problems.join('; ')}`);
  // a sample definition ships with its pack, unless it plays a sound the deploy subset leaves out
  const samples = {};
  for (const [def, d] of Object.entries(p.samples)) if (keep.includes(d.sound ?? def)) samples[def] = d;
  const { problems, ...rest } = p; // the index the page reads carries what a song can use, not the reading of pack.json
  shipped[name] = { ...rest, samples, sounds: Object.fromEntries(keep.map((s) => [s, p.sounds[s]])) };
}
registerSamples(shipped); // one name may mean one thing on the deployed site: a collision among the shipped packs fails the build
if (SAMPLE_PROBLEMS.length) throw new Error(`sample definitions collide as shipped:\n  ${SAMPLE_PROBLEMS.join('\n  ')}`);
const songs = songList();
const declared = Object.fromEntries(songs.map((s) => [s, packsOf(fs.readFileSync(path.join(ROOT, 'songs', s), 'utf8'))]));
const hidden = songs.filter((s) => declared[s].some((p) => !shipped[p]));
for (const s of songs.filter((s) => !hidden.includes(s) && declared[s].length)) {
  const { problems } = await checkFile(path.join(ROOT, 'songs', s), 4, shipped);
  if (problems.length) throw new Error(`not deployable as shipped:\n  ${problems.join('\n  ')}`);
}

fs.rmSync(OUT, { recursive: true, force: true });
const copy = (rel, to = rel) => fs.cpSync(path.join(ROOT, rel), path.join(OUT, to), { recursive: true });
const PAGES = ['index.html', 'examples.html', 'about.html', 'legal.html']; // the sitemap; 404.html ships too but is not a destination
for (const p of [...PAGES, '404.html']) copy(p);
copy('web');
copy('lib');
copy('songs');
for (const s of hidden) for (const f of [s, s.replace(/\.strudel$/, '.notes.json')]) fs.rmSync(path.join(OUT, 'songs', f), { force: true });
for (const p of Object.values(shipped)) for (const f of Object.values(p.sounds).flat()) copy(`samples/user/${f}`);
copy('node_modules/@strudel/web/dist');
copy('node_modules/@breezystack/lamejs/dist'); // web/mp3.mjs: the mp3 export encodes in the browser
copy('node_modules/acorn/dist'); // lib/resolve.mjs: the mix card parses the song in the browser (index.html's import map)
copy('node_modules/mp4-muxer/build'); copy('node_modules/webm-muxer/build'); // web/visual/export.mjs: the video export muxes in the browser
// web/cm-editor.mjs: CodeMirror 6 for the mix card's section pane, every package of index.html's import map
for (const p of ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@codemirror/commands', '@codemirror/autocomplete', '@codemirror/lang-javascript', '@lezer/common', '@lezer/highlight', '@lezer/lr', '@lezer/javascript']) copy(`node_modules/${p}/dist`);
for (const f of ['style-mod/src/style-mod.js', 'w3c-keyname/index.js', 'crelt/index.js', '@marijn/find-cluster-break/src/index.js']) copy(`node_modules/${f}`);
copy('node_modules/@strudel/web/dist/assets', 'assets'); // strudel resolves its clock SharedWorker against the page url
const write = (rel, obj) => { fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true }); fs.writeFileSync(path.join(OUT, rel), JSON.stringify(obj)); };
write('songs/index.json', listedSongs().filter((s) => !hidden.includes(s)));
write('samples/user/strudel.json', { ...userMap(shipped), _base: 'samples/user/' }); // relative: a project page lives under /<repo>/
write('samples/user/packs.json', shipped);
fs.writeFileSync(path.join(OUT, '.nojekyll'), ''); // jekyll would drop node_modules/
// seo: the canonical url each page declares, a sitemap of the same, and robots pointing at it
const SITE = 'https://jonborchardt.github.io/strudel-bench/';
const urls = PAGES.map((p) => `  <url><loc>${SITE}${p === 'index.html' ? '' : p}</loc></url>`).join('\n');
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);console.log(`wrote ${OUT}: packs ${Object.keys(shipped).join(', ') || 'none'}${hidden.length ? `; local-only songs left out: ${hidden.join(', ')}` : ''}`);
