import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');

test('pages build assembles a static site that works under /<repo>/', () => {
  const out = path.join(ROOT, 'test', '_t_dist');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pages.mjs'), out]);
    for (const f of ['index.html', 'examples.html', 'web/strudle.css', 'web/boot.mjs', 'web/mp3.mjs', '.nojekyll', 'lib/index.mjs', 'lib/packs.json', 'songs/demo.strudel', 'songs/demo.notes.json', 'node_modules/@strudel/web/dist/index.js', 'node_modules/@breezystack/lamejs/dist/lamejs.js', 'assets'])
      assert.ok(fs.existsSync(path.join(out, f)), f);
    assert.ok(JSON.parse(fs.readFileSync(path.join(out, 'songs/index.json'), 'utf8')).includes('demo.strudel'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'samples/user/strudel.json'), 'utf8'))._base, 'samples/user/');
    assert.ok(!fs.existsSync(path.join(out, 'samples/packs')), 'packs stream from the cdn');
    for (const f of ['index.html', 'examples.html', 'web/boot.mjs', 'web/mp3.mjs', 'web/compose.mjs', 'web/examples.mjs'])
      assert.ok(!/['`"]\//.test(fs.readFileSync(path.join(out, f), 'utf8')), `root-absolute url in ${f}`);
    // the page does not need the server for export: no fetch of a render/dump route without a server guard
    assert.ok(!/fetch\(`dump\//.test(fs.readFileSync(path.join(out, 'index.html'), 'utf8')), 'no server dump route');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
