import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer, userMap } from '../server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const USER = path.join(ROOT, 'samples', 'user');

async function withServer(fn) {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test('userMap turns folders into sounds and loose files into single sounds', () => {
  fs.mkdirSync(path.join(USER, '_t_kick'), { recursive: true });
  fs.writeFileSync(path.join(USER, '_t_kick', 'b.wav'), '');
  fs.writeFileSync(path.join(USER, '_t_kick', 'a.wav'), '');
  fs.writeFileSync(path.join(USER, '_t_kick', 'notes.txt'), '');
  fs.writeFileSync(path.join(USER, '_t_loose.mp3'), '');
  try {
    const m = userMap();
    assert.equal(m._base, '/samples/user/');
    assert.deepEqual(m._t_kick, ['_t_kick/a.wav', '_t_kick/b.wav']);
    assert.deepEqual(m._t_loose, ['_t_loose.mp3']);
  } finally {
    fs.rmSync(path.join(USER, '_t_kick'), { recursive: true });
    fs.rmSync(path.join(USER, '_t_loose.mp3'));
  }
});

test('song list, read, write, and name validation', async () => {
  await withServer(async (base) => {
    const list = await (await fetch(`${base}/songs`)).json();
    assert.ok(list.includes('demo.strudel'));

    const text = await (await fetch(`${base}/songs/demo.strudel`)).text();
    assert.match(text, /setcps/);

    const put = await fetch(`${base}/songs/_t_new.strudel`, { method: 'PUT', body: 'note("c")' });
    assert.equal(put.status, 204);
    assert.equal(fs.readFileSync(path.join(ROOT, 'songs', '_t_new.strudel'), 'utf8'), 'note("c")');
    fs.rmSync(path.join(ROOT, 'songs', '_t_new.strudel'));

    assert.equal((await fetch(`${base}/songs/nope.strudel`)).status, 404);
    assert.equal((await fetch(`${base}/songs/x.txt`, { method: 'PUT', body: '' })).status, 400);
    assert.equal((await fetch(`${base}/songs/..%2Fpackage.json`, { method: 'PUT', body: '' })).status, 400);
  });
});

test('static files and user sample map', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/`)).headers.get('content-type'), 'text/html');
    const js = await fetch(`${base}/node_modules/@strudel/web/dist/index.js`);
    assert.equal(js.status, 200);
    assert.equal((await fetch(`${base}/node_modules/../package.json`)).status, 404);
    const m = await (await fetch(`${base}/samples/user/strudel.json`)).json();
    assert.equal(m._base, '/samples/user/');
  });
});
