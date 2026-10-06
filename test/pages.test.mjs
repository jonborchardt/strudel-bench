import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GROUPS } from '../web/examples.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const USER = path.join(ROOT, 'samples', 'user');
const SONGS = path.join(ROOT, 'songs');
const build = (out) => execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pages.mjs'), out], { stdio: 'pipe' }).toString();

// a local-only pack with a song on it, and a pack that deploys only one of its two sounds, used by two songs: one inside the subset, one outside
function fixtures() {
  fs.mkdirSync(path.join(USER, '_t_private'), { recursive: true });
  fs.writeFileSync(path.join(USER, '_t_private', 'secret.wav'), '');
  fs.writeFileSync(path.join(SONGS, '_t_private.strudel'), `// packs: ['_t_private']\ns("secret")`);
  fs.writeFileSync(path.join(SONGS, '_t_private.notes.json'), '{}');
  fs.mkdirSync(path.join(USER, '_t_subset'), { recursive: true });
  fs.writeFileSync(path.join(USER, '_t_subset', 'pub.wav'), '');
  fs.writeFileSync(path.join(USER, '_t_subset', 'big.wav'), '');
  fs.writeFileSync(path.join(USER, '_t_subset', 'pack.json'), JSON.stringify({ deploy: ['pub'], license: 'CC0-1.0', samples: { 'pub-hit': { sound: 'pub', end: .5 }, 'big-hit': { sound: 'big' } } }));
  fs.writeFileSync(path.join(SONGS, '_t_subset.strudel'), `// packs: ['_t_subset']\ns("pub")`);
  return () => {
    for (const d of ['_t_private', '_t_subset']) fs.rmSync(path.join(USER, d), { recursive: true, force: true });
    for (const f of ['_t_private.strudel', '_t_private.notes.json', '_t_subset.strudel', '_t_big.strudel']) fs.rmSync(path.join(SONGS, f), { force: true });
  };
}

test('pages build assembles a static site that works under /<repo>/ and applies the pack deploy policy', () => {
  const out = path.join(ROOT, 'test', '_t_dist');
  const clean = fixtures();
  try {
    build(out);
    for (const f of ['index.html', 'examples.html', 'about.html', 'legal.html', '404.html', 'sitemap.xml', 'robots.txt', 'web/icon.svg', 'web/og.png', 'web/strudel.css', 'web/boot.mjs', 'web/mp3.mjs', '.nojekyll', 'lib/index.mjs', 'lib/packs.json', 'lib/packs.mjs', 'songs/demo.strudel', 'songs/demo.notes.json', 'node_modules/@strudel/web/dist/index.js', 'node_modules/@breezystack/lamejs/dist/lamejs.js', 'node_modules/acorn/dist/acorn.mjs', 'node_modules/@codemirror/view/dist/index.js', 'node_modules/@codemirror/lang-javascript/dist/index.js', 'node_modules/@lezer/javascript/dist/index.js', 'node_modules/style-mod/src/style-mod.js', 'node_modules/@marijn/find-cluster-break/src/index.js', 'web/cm-editor.mjs', 'web/cm-controls.mjs', 'web/hll-schema.mjs', 'lib/resolve.mjs', 'lib/analyze.mjs', 'assets', 'listen.html', 'web/listen/page.mjs', 'web/listen/show.mjs', 'web/listen/pool.mjs', 'web/listen/worker.mjs', 'listen/demo.strudel.json', 'listen/audio.json', 'portrait.html', 'limner/schema.mjs'])
      assert.ok(fs.existsSync(path.join(out, f)), f);
    assert.ok(!fs.existsSync(path.join(out, 'samples.html')), 'the workshop is not deployed');
    const list = JSON.parse(fs.readFileSync(path.join(out, 'songs/index.json'), 'utf8')).map((s) => s.name);
    assert.ok(list.includes('demo.strudel'));
    assert.ok(list.includes('ping.strudel'), 'a song on a deployed pack ships');
    assert.ok(list.includes('chop.strudel'), 'the sliced-sample song ships on the deployed demo pack');
    assert.ok(list.includes('_t_subset.strudel'), 'a song inside the deployed subset ships');
    for (const g of GROUPS) for (const ex of g.items) for (const v of ex.variants ?? [])
      if (v.src) assert.ok(list.includes(v.src.replace(/^songs\//, '')), `${g.id}/${ex.title}/${v.label}: src ${v.src} does not ship (a card must not point at a local-only song)`);
    assert.ok(!list.includes('_t_private.strudel'), 'a song on a local-only pack is left out of the list');
    assert.ok(!fs.existsSync(path.join(out, 'songs/_t_private.strudel')) && !fs.existsSync(path.join(out, 'songs/_t_private.notes.json')), 'and its files do not ship');
    const map = JSON.parse(fs.readFileSync(path.join(out, 'samples/user/strudel.json'), 'utf8'));
    assert.equal(map._base, 'samples/user/');
    assert.deepEqual(map.ping, ['demo-pack/ping.wav']);
    assert.deepEqual(map.pub, ['_t_subset/pub.wav']);
    assert.equal(map.big, undefined, 'outside the subset: not in the map');
    assert.equal(map.secret, undefined, 'local-only: not in the map');
    assert.ok(fs.existsSync(path.join(out, 'samples/user/demo-pack/ping.wav')));
    assert.ok(fs.existsSync(path.join(out, 'samples/user/demo-pack/loop.wav')), 'the loop ships with the pack');
    assert.ok(fs.existsSync(path.join(out, 'samples/user/_t_subset/pub.wav')));
    assert.ok(!fs.existsSync(path.join(out, 'samples/user/_t_subset/big.wav')), 'outside the subset: not copied');
    assert.ok(!fs.existsSync(path.join(out, 'samples/user/_t_private')), 'local-only: not copied');
    assert.ok(!fs.existsSync(path.join(out, 'samples/user/demo-pack/pack.json')), 'pack metadata is served from packs.json, not copied');
    const idx = JSON.parse(fs.readFileSync(path.join(out, 'samples/user/packs.json'), 'utf8'));
    for (const p of ['_t_subset', 'demo-pack']) assert.ok(idx[p], `${p} ships`); // other deploy packs may exist; the policy is what is pinned
    assert.ok(!idx._t_private, 'local-only: not in the index');
    assert.deepEqual(idx._t_subset.samples, { 'pub-hit': { sound: 'pub', end: .5 } }, 'a definition on a sound outside the deploy subset is dropped');
    assert.deepEqual(Object.keys(idx['demo-pack'].samples).sort(), ['loop', 'loop-kick', 'loop-snare'], 'the demo definitions ship');
    assert.ok(!fs.existsSync(path.join(out, 'samples/packs')), 'packs stream from the cdn');
    const listen = JSON.parse(fs.readFileSync(path.join(out, 'listen/demo.strudel.json'), 'utf8'));
    assert.ok(listen.score.world && listen.stream.length > 10, 'the listen page gets a score and a stream per song');
    const am = JSON.parse(fs.readFileSync(path.join(out, 'listen/audio.json'), 'utf8'));
    assert.ok(am.base.startsWith('https://'), 'the deployed audio comes from the release, not from renders/');
    assert.ok(!fs.existsSync(path.join(out, 'listen/_t_private.strudel.json')), 'a song that does not ship gets no data either');
    assert.ok(fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8').includes('listen.html'));
    for (const f of ['index.html', 'examples.html', 'about.html', 'legal.html', 'listen.html', 'portrait.html', 'limner/schema.mjs', 'web/boot.mjs', 'web/mp3.mjs', 'web/compose.mjs', 'web/examples.mjs', 'web/waveform.mjs', 'web/workshop.mjs', 'web/preview.mjs', 'web/listen/page.mjs', 'web/listen/show.mjs', 'web/listen/pool.mjs', 'web/listen/worker.mjs', 'lib/packs.mjs'])
      assert.ok(!/['`"]\/[\w.]/.test(fs.readFileSync(path.join(out, f), 'utf8')), `root-absolute url in ${f}`); // a quote, a slash, then a path character; a bare '/' is a separator
    // the page does not need the server for export: no fetch of a render/dump route without a server guard
    assert.ok(!/fetch\(`dump\//.test(fs.readFileSync(path.join(out, 'index.html'), 'utf8')), 'no server dump route');

    // one name means one thing on the deployed site: a definition named after another shipped pack's sound fails the build
    const packJson = path.join(USER, '_t_subset', 'pack.json');
    const kept = fs.readFileSync(packJson, 'utf8');
    try {
      fs.writeFileSync(packJson, JSON.stringify({ deploy: ['pub'], license: 'CC0-1.0', samples: { 'pub-hit': { sound: 'pub', end: .5 }, ping: { sound: 'pub' } } }));
      assert.throws(() => build(out), /collide as shipped[\s\S]*samples\.ping: collides with sound "ping" in pack "demo-pack"/);
    } finally { fs.writeFileSync(packJson, kept); }

    // a song on a deployed pack that uses a sound outside the deployed subset would play silence on pages: the build refuses
    fs.writeFileSync(path.join(SONGS, '_t_big.strudel'), `// packs: ['_t_subset']\ns("big")`);
    assert.throws(() => build(out), /not deployable as shipped[\s\S]*sound "big"/);
    fs.rmSync(path.join(SONGS, '_t_big.strudel'));
    // deploying without a license is refused
    fs.writeFileSync(path.join(USER, '_t_subset', 'pack.json'), JSON.stringify({ deploy: true }));
    assert.throws(() => build(out), /needs a "license"/);
  } finally { clean(); fs.rmSync(out, { recursive: true, force: true }); }
});

// limner's part registries (TOPS, HATS, MAKEUP, ...) are module-level objects filled by import side effects, so two
// instances of a module means `parts()` returns half the parts and a costume quietly loses its hat -- no error, just a
// missing thing. Today each module exists at exactly one path and Node resolves the node_modules symlink to it, so a
// second instance cannot be made; the day limner is installed from npm rather than linked, it can again. Either way the
// rule is the same and is the point of having a published surface: from outside, limner is reachable only at its
// entries, never past them.
const ENTRIES = ['index.mjs', 'primitives.mjs', 'schema.mjs']; // schema is internal by the spec but portrait.html reaches it; see the ledger
test('nothing outside limner reaches past its entries: two instances would split the part registries', () => {
  const walk = (dir) => fs.readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (['node_modules', 'dist', '.git', 'limner', '.superpowers', 'renders', 'out'].includes(f) || f.startsWith('_t_')) return [];
    return fs.statSync(p).isDirectory() ? walk(p) : /\.(mjs|html)$/.test(f) ? [p] : [];
  });
  // every spelling: `from`, bare side-effect `import`, and dynamic `import(`; single and double quotes. A path into
  // limner is legal only when what it names is an entry -- limner/portrait.mjs, limner/parts/orc.mjs and
  // limner/registry.mjs are all the same mistake, and so is the bare specifier `limner/portrait.mjs`.
  const deep = [];
  for (const file of walk(ROOT)) {
    if (file === import.meta.filename) continue; // this file carries the guard's own fixture strings, which look exactly like the thing it forbids
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]*limner\/[^'"]+)['"]/g)) {
      const after = m[1].slice(m[1].indexOf('limner/') + 'limner/'.length);
      if (!ENTRIES.includes(after)) deep.push(`${path.relative(ROOT, file).split(path.sep).join('/')}: ${m[1]}`);
    }
  }
  assert.deepEqual([...new Set(deep)].sort(), [], 'these reach past limner\'s published entries');
});

test('the guard above would catch every spelling of a deep import', () => {
  // the regex is the whole test, so it gets its own fixtures rather than being trusted
  const re = /(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]*limner\/[^'"]+)['"]/g;
  const deep = (src) => [...stripComments(src).matchAll(re)].map((m) => m[1]).filter((spec) => !ENTRIES.includes(spec.slice(spec.indexOf('limner/') + 7)));
  for (const bad of [
    "import { parts } from '../limner/portrait.mjs';",
    'import { parts } from "../limner/portrait.mjs";',
    "import '../limner/parts/eighties.mjs';",
    "const m = await import('../limner/portrait.mjs');",
    "import { CASTS } from '../limner/registry.mjs';",
    "import { STANCES } from '../../limner/stances.mjs';",
    "import { rand } from '../limner/rng.mjs';",
    "import { dress } from '../limner/people.mjs';",
  ]) assert.equal(deep(bad).length, 1, `missed: ${bad}`);
  for (const ok of [
    "export * from '../../limner/index.mjs';",
    "import { renderPortrait } from './limner/index.mjs';",
    "import { groupsFor } from './limner/schema.mjs';",
    "import { tracePath } from './limner/primitives.mjs';",
    "import { portraitOps } from 'limner';",
    "// import { parts } from '../limner/portrait.mjs' -- a comment, not an import",
  ]) assert.deepEqual(deep(ok), [], `false positive: ${ok}`);
});

// limner ships because portrait.html imports it, but only the library: not its suite (the ops golden alone is 163 KB of
// fixture), not its CLIs, and not its sheets, which were never deployed before it had a folder of its own.
test('the build ships limner the library, and none of its workshop', () => {
  const out = path.join(ROOT, 'test', '_t_dist_limner');
  try {
    build(out);
    for (const f of ['limner/index.mjs', 'limner/portrait.mjs', 'limner/people.mjs', 'limner/schema.mjs', 'limner/stances.mjs', 'limner/registry.mjs', 'limner/rng.mjs', 'limner/primitives.mjs', 'limner/package.json', 'limner/casts/undead.mjs', 'limner/parts/undead.mjs', 'portrait.html'])
      assert.ok(fs.existsSync(path.join(out, f)), `${f} ships`);
    for (const f of ['limner/test', 'limner/scripts', 'limner/faces.html', 'limner/parts.html', 'limner/casts.html', 'limner/stances.html'])
      assert.ok(!fs.existsSync(path.join(out, f)), `${f} must not ship`);
    // the page reaches limner by a relative path, not through an import map: relative because a project page lives under
    // /<repo>/, and by path because an import map is a document's and cannot be given to the workers that load the worlds
    const shipped = fs.readFileSync(path.join(out, 'portrait.html'), 'utf8');
    assert.ok(!/<script type="importmap">/.test(shipped), 'no import map to go stale');
    for (const m of shipped.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]*limner[^'"]*)['"]/g))
      assert.ok(m[1].startsWith('./limner/'), `${m[1]} must be a relative path into limner`);
    assert.match(shipped, /from '\.\/limner\/index\.mjs'/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

// npm test names both suites, rather than letting node --test glob for them. node_modules/limner is a symlink to
// ./limner (the file: dependency), so bare discovery can reach limner's tests twice, or -- once someone moves a file --
// not at all, and a suite that silently stops running looks exactly like a suite that passes.
test('npm test names both suites explicitly: glob discovery would walk the node_modules/limner symlink', () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(scripts.test, /"test\/\*\.test\.mjs"/, 'the host suite is named');
  assert.match(scripts.test, /"limner\/test\/\*\.test\.mjs"/, "and limner's, so a beard change cannot stop being tested by accident");
  assert.match(scripts.test, /--test-concurrency=1/, 'serially, because the host suite writes _t_ fixtures into shared directories');
  assert.ok(fs.existsSync(path.join(ROOT, 'limner', 'test', 'ops-golden.test.mjs')), 'and the suite it names exists');
});

// --- module resolution, which the rest of the suite cannot see ---
//
// A bare specifier resolves in three places on different terms. Node resolves it through package.json. A browser
// resolves it only through the document's import map. A module Worker has its own realm and **cannot be handed that
// map at all** -- there is no API for it -- so inside a worker a bare specifier is unresolvable by construction, and
// the failure is silent: web/listen/show.mjs imports a world dynamically with no catch, so the tile just stays blank.
// web/listen/ runs every world in a worker, which makes this a rule about the worlds and everything they pull in.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const specifiers = (src) => [...stripComments(src).matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
const isBare = (spec) => !spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('node:');

/** Every module reachable from `entry` by relative import, as repo-relative posix paths. */
function graphFrom(entry) {
  const seen = new Set();
  const walk = (file) => {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (seen.has(rel) || !fs.existsSync(file)) return;
    seen.add(rel);
    for (const spec of specifiers(fs.readFileSync(file, 'utf8'))) {
      if (!isBare(spec) && !spec.endsWith('.json')) walk(path.resolve(path.dirname(file), spec));
    }
  };
  walk(entry);
  return seen;
}

test('nothing a worker loads uses a bare specifier: a worker cannot be handed an import map', () => {
  // web/listen/show.mjs loads a world by a computed specifier -- `import(`../visual/${n}.mjs`)` over every world in
  // lib/visual.json -- which no static walk can follow, so the worlds are added as roots by name.
  const worlds = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'visual.json'), 'utf8')).worlds);
  assert.ok(worlds.length > 10, `expected the world list, got ${worlds.length}`);
  const graph = graphFrom(path.join(ROOT, 'web', 'listen', 'worker.mjs'));
  for (const w of worlds) for (const g of graphFrom(path.join(ROOT, 'web', 'visual', `${w}.mjs`))) graph.add(g);
  assert.ok(graph.size > 20, `expected the worker to pull in the worlds, got ${graph.size} modules`);
  assert.ok(graph.has('web/visual/tableau.mjs') && graph.has('web/visual/faces.mjs'), 'and the worlds that draw people');
  const bare = [];
  for (const rel of graph) for (const spec of specifiers(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) {
    if (isBare(spec)) bare.push(`${rel}: ${spec}`);
  }
  assert.deepEqual(bare.sort(), [], 'these resolve in Node and nowhere else; import the file by path');
});

// One file under web/ crosses into limner, and it crosses to the published entry, so there is exactly one line to
// change if limner moves or is installed from npm -- and one place to look to see that the surface is respected.
test('web/visual/limner.mjs is the only crossing, and it reaches the barrel rather than an internal', () => {
  const shim = path.join(ROOT, 'web', 'visual', 'limner.mjs');
  assert.ok(fs.existsSync(shim), 'the shim exists');
  assert.match(stripComments(fs.readFileSync(shim, 'utf8')), /from '\.\.\/\.\.\/limner\/index\.mjs'/, 'and reaches index.mjs, the published barrel');
  const walk = (dir) => fs.readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return fs.statSync(p).isDirectory() ? walk(p) : f.endsWith('.mjs') ? [p] : [];
  });
  const others = walk(path.join(ROOT, 'web')).filter((p) => p !== shim && specifiers(fs.readFileSync(p, 'utf8')).some((s) => /(^|\/)limner(\/|$)/.test(s)));
  assert.deepEqual(others.map((p) => path.relative(ROOT, p).split(path.sep).join('/')), [], 'nothing else under web/ names limner');
});

// index.html is one module script: an unresolvable specifier anywhere in its graph takes the whole page, editor and all.
// It is also the one page whose graph legitimately holds bare specifiers, because its import map provides them -- so the
// rule here is that the map covers every one of them, which is exactly what was missed when limner became a package.
test('every bare specifier in a page\'s module graph is in that page\'s import map', () => {
  for (const page of ['index.html', 'examples.html', 'portrait.html', 'poses.html', 'listen.html', 'samples.html']) {
    const file = path.join(ROOT, page);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    const mapped = new Set(m ? Object.keys(JSON.parse(m[1]).imports) : []);
    const entries = [...html.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)].map((x) => x[1]);
    const graph = new Set();
    for (const e of entries) for (const g of graphFrom(path.resolve(ROOT, e))) graph.add(g);
    const unresolvable = [];
    for (const rel of graph) for (const spec of specifiers(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) {
      if (isBare(spec) && !mapped.has(spec) && ![...mapped].some((k) => k.endsWith('/') && spec.startsWith(k))) unresolvable.push(`${rel}: ${spec}`);
    }
    assert.deepEqual([...new Set(unresolvable)].sort(), [], `${page}: these would throw "Failed to resolve module specifier" and take the page with them`);
  }
});
