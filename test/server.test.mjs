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
  try { await fn(base); } finally { server.closeAllConnections(); server.close(); }
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
    const list = await (await fetch(`${base}/songs/index.json`)).json();
    assert.ok(list.includes('demo.strudel'));

    const text = await (await fetch(`${base}/songs/demo.strudel`)).text();
    assert.match(text, /song\(/);

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
    // the page's clock SharedWorker (sync mode) is requested as /assets/<file> relative to the page
    const [worker] = fs.readdirSync(path.join(ROOT, 'node_modules/@strudel/web/dist/assets')).filter((f) => f.startsWith('clockworker'));
    assert.equal((await fetch(`${base}/assets/${worker}`)).status, 200);
    const m = await (await fetch(`${base}/samples/user/strudel.json`)).json();
    assert.equal(m._base, '/samples/user/');
  });
});

test('render route: 409 without a page, PUT stores a wav and releases the waiter', async () => {
  await withServer(async (base) => {
    const r409 = await fetch(`${base}/render`, { method: 'POST', body: JSON.stringify({ song: 'demo.strudel' }) });
    assert.equal(r409.status, 409);
    // fake a page: open the SSE stream, then answer the render command with a PUT
    const es = await fetch(`${base}/events`);
    const reader = es.body.getReader();
    const pending = fetch(`${base}/render`, { method: 'POST', body: JSON.stringify({ song: 'demo.strudel', name: '_t_probe' }) });
    let text = '';
    while (!text.includes('"render"')) text += new TextDecoder().decode((await reader.read()).value);
    assert.match(text, /"name":"_t_probe"/);
    const put = await fetch(`${base}/renders/_t_probe.wav`, { method: 'PUT', body: new Uint8Array([82, 73, 70, 70]) });
    assert.equal(put.status, 200);
    const done = await pending;
    assert.equal(done.status, 200);
    assert.match((await done.json()).path, /renders[\\/]_t_probe\.wav$/);
    fs.rmSync(path.join(ROOT, 'renders', '_t_probe.wav'));
    reader.cancel();
  });
});

test('PUT /renders/x.wav?mp3 converts and returns the mp3 path; /render with mp3 reports it', async () => {
  const { writeWav, tone } = await import('../scripts/analyze.mjs');
  await withServer(async (base) => {
    const es = await fetch(`${base}/events`);
    const reader = es.body.getReader();
    const pending = fetch(`${base}/render`, { method: 'POST', body: JSON.stringify({ song: 'demo.strudel', name: '_t_mp3', mp3: true }) });
    let text = '';
    while (!text.includes('"render"')) text += new TextDecoder().decode((await reader.read()).value);
    assert.match(text, /"mp3":true/);
    const tmp = path.join(ROOT, 'test', '_t_mp3.wav');
    writeWav(tmp, 44100, [tone(44100, 440, 0.2)]);
    const put = await fetch(`${base}/renders/_t_mp3.wav?mp3`, { method: 'PUT', body: fs.readFileSync(tmp) });
    fs.rmSync(tmp);
    assert.equal(put.status, 200);
    assert.match(await put.text(), /renders[\\/]_t_mp3\.mp3$/);
    assert.match((await (await pending).json()).path, /renders[\\/]_t_mp3\.mp3$/);
    assert.ok(fs.statSync(path.join(ROOT, 'renders', '_t_mp3.mp3')).size > 0);
    fs.rmSync(path.join(ROOT, 'renders', '_t_mp3.wav')); fs.rmSync(path.join(ROOT, 'renders', '_t_mp3.mp3'));
    reader.cancel();
  });
});

test('render route: malformed body returns 400 and the server keeps serving', async () => {
  await withServer(async (base) => {
    const es = await fetch(`${base}/events`);
    const reader = es.body.getReader();
    assert.equal((await fetch(`${base}/render`, { method: 'POST', body: JSON.stringify({}) })).status, 400);
    assert.equal((await fetch(`${base}/render`, { method: 'POST', body: 'not json' })).status, 400);
    assert.equal((await fetch(`${base}/render-error`, { method: 'POST', body: 'not json' })).status, 400);
    assert.equal((await fetch(`${base}/render-error`, { method: 'POST', body: JSON.stringify({ message: 'no name here' }) })).status, 204);
    assert.equal((await fetch(`${base}/songs/index.json`)).status, 200);
    reader.cancel();
  });
});

test('render route: a second POST for a name already pending gets 409, the first still resolves', async () => {
  await withServer(async (base) => {
    const es = await fetch(`${base}/events`);
    const reader = es.body.getReader();
    const first = fetch(`${base}/render`, { method: 'POST', body: JSON.stringify({ song: 'demo.strudel', name: '_t_dup' }) });
    let text = '';
    while (!text.includes('"render"')) text += new TextDecoder().decode((await reader.read()).value);
    const second = await fetch(`${base}/render`, { method: 'POST', body: JSON.stringify({ song: 'demo.strudel', name: '_t_dup' }) });
    assert.equal(second.status, 409);
    const put = await fetch(`${base}/renders/_t_dup.wav`, { method: 'PUT', body: new Uint8Array([82, 73, 70, 70]) });
    assert.equal(put.status, 200);
    const done = await first;
    assert.equal(done.status, 200);
    fs.rmSync(path.join(ROOT, 'renders', '_t_dup.wav'));
    reader.cancel();
  });
});

test('POST /dump/<song> writes renders/<name>.dump.txt with the plain strudel', async () => {
  fs.copyFileSync(path.join(ROOT, 'songs', 'demo.strudel'), path.join(ROOT, 'songs', '_t_dump.strudel'));
  const out = path.join(ROOT, 'renders', '_t_dump.dump.txt');
  try {
    await withServer(async (base) => {
      assert.equal((await fetch(`${base}/dump/nope.strudel`, { method: 'POST' })).status, 404);
      const r = await fetch(`${base}/dump/_t_dump.strudel`, { method: 'POST' });
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.match(body.path, /renders[\\/]_t_dump\.dump\.txt$/);
      assert.equal(body.code, fs.readFileSync(out, 'utf8'));
      assert.match(body.code, /^const piece = [\s\S]*setcps\(0\.5\)[\s\S]*arrange\(/);
    });
  } finally { fs.rmSync(path.join(ROOT, 'songs', '_t_dump.strudel')); fs.rmSync(out, { force: true }); }
});
