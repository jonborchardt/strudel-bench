import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
    for (const f of ['index.html', 'examples.html', 'about.html', 'legal.html', '404.html', 'sitemap.xml', 'robots.txt', 'web/icon.svg', 'web/og.png', 'web/strudel.css', 'web/boot.mjs', 'web/mp3.mjs', '.nojekyll', 'lib/index.mjs', 'lib/packs.json', 'lib/packs.mjs', 'songs/demo.strudel', 'songs/demo.notes.json', 'node_modules/@strudel/web/dist/index.js', 'node_modules/@breezystack/lamejs/dist/lamejs.js', 'node_modules/acorn/dist/acorn.mjs', 'node_modules/@codemirror/view/dist/index.js', 'node_modules/@codemirror/lang-javascript/dist/index.js', 'node_modules/@lezer/javascript/dist/index.js', 'node_modules/style-mod/src/style-mod.js', 'node_modules/@marijn/find-cluster-break/src/index.js', 'web/cm-editor.mjs', 'web/cm-controls.mjs', 'web/hll-schema.mjs', 'lib/resolve.mjs', 'lib/analyze.mjs', 'assets'])
      assert.ok(fs.existsSync(path.join(out, f)), f);
    assert.ok(!fs.existsSync(path.join(out, 'samples.html')), 'the workshop is not deployed');
    const list = JSON.parse(fs.readFileSync(path.join(out, 'songs/index.json'), 'utf8'));
    assert.ok(list.includes('demo.strudel'));
    assert.ok(list.includes('ping.strudel'), 'a song on a deployed pack ships');
    assert.ok(list.includes('chop.strudel'), 'the sliced-sample song ships on the deployed demo pack');
    assert.ok(list.includes('_t_subset.strudel'), 'a song inside the deployed subset ships');
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
    for (const f of ['index.html', 'examples.html', 'about.html', 'legal.html', 'web/boot.mjs', 'web/mp3.mjs', 'web/compose.mjs', 'web/examples.mjs', 'web/waveform.mjs', 'web/workshop.mjs', 'web/preview.mjs', 'lib/packs.mjs'])
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
