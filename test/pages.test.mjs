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
    for (const f of ['index.html', '.nojekyll', 'lib/index.mjs', 'lib/packs.json', 'songs/demo.strudel', 'node_modules/@strudel/web/dist/index.js', 'assets'])
      assert.ok(fs.existsSync(path.join(out, f)), f);
    assert.ok(JSON.parse(fs.readFileSync(path.join(out, 'songs/index.json'), 'utf8')).includes('demo.strudel'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'samples/user/strudel.json'), 'utf8'))._base, 'samples/user/');
    assert.ok(!fs.existsSync(path.join(out, 'samples/packs')), 'packs stream from the cdn');
    assert.ok(!/['`"]\//.test(fs.readFileSync(path.join(out, 'index.html'), 'utf8')), 'root-absolute url in index.html');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
