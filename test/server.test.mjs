import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer, userMap, userPacks } from '../server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const USER = path.join(ROOT, 'samples', 'user');

async function withServer(fn) {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try { await fn(base); } finally { server.closeAllConnections(); server.close(); }
}

test('userPacks: a folder per pack, inside it folders are sounds with variants and loose files single sounds; pack.json sets the policy', () => {
  const pack = path.join(USER, '_t_pack');
  fs.mkdirSync(path.join(pack, 'kick'), { recursive: true });
  fs.writeFileSync(path.join(pack, 'kick', 'b.wav'), '');
  fs.writeFileSync(path.join(pack, 'kick', 'a.wav'), '');
  fs.writeFileSync(path.join(pack, 'kick', 'notes.txt'), '');
  fs.writeFileSync(path.join(pack, 'loose.mp3'), '');
  fs.writeFileSync(path.join(pack, 'pack.json'), JSON.stringify({ deploy: ['kick'], license: 'CC0-1.0' }));
  fs.mkdirSync(path.join(USER, '_t_bare'));
  fs.writeFileSync(path.join(USER, '_t_bare', 'x.wav'), '');
  try {
    const packs = userPacks();
    assert.deepEqual(packs._t_pack, { sounds: { kick: ['_t_pack/kick/a.wav', '_t_pack/kick/b.wav'], loose: ['_t_pack/loose.mp3'] }, deploy: ['kick'], license: 'CC0-1.0', source: undefined });
    assert.equal(packs._t_bare.deploy, false, 'no pack.json: local-only');
    const m = userMap();
    assert.equal(m._base, '/samples/user/');
    assert.deepEqual(m.kick, ['_t_pack/kick/a.wav', '_t_pack/kick/b.wav']);
    assert.deepEqual(m.x, ['_t_bare/x.wav']);
    assert.deepEqual(Object.keys(userMap({ a: packs._t_bare })), ['_base', 'x'], 'userMap over a given pack set');
  } finally {
    fs.rmSync(pack, { recursive: true });
    fs.rmSync(path.join(USER, '_t_bare'), { recursive: true });
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
    for (const p of ['examples.html', 'about.html', 'legal.html', '404.html']) assert.equal((await fetch(`${base}/${p}`)).headers.get('content-type'), 'text/html', p);
    assert.equal((await fetch(`${base}/nope.html`)).status, 404);
    const lost = await fetch(`${base}/no/such/page`, { headers: { accept: 'text/html' } }); // a browser navigation gets the 404 page
    assert.equal(lost.status, 404);
    assert.match(await lost.text(), /A bar of rests/);
    assert.equal((await fetch(`${base}/web/strudel.css`)).headers.get('content-type'), 'text/css');
    assert.equal((await fetch(`${base}/web/boot.mjs`)).status, 200);
    const js = await fetch(`${base}/node_modules/@strudel/web/dist/index.js`);
    assert.equal(js.status, 200);
    assert.equal((await fetch(`${base}/node_modules/../package.json`)).status, 404);
    // the page's clock SharedWorker (sync mode) is requested as /assets/<file> relative to the page
    const [worker] = fs.readdirSync(path.join(ROOT, 'node_modules/@strudel/web/dist/assets')).filter((f) => f.startsWith('clockworker'));
    assert.equal((await fetch(`${base}/assets/${worker}`)).status, 200);
    const m = await (await fetch(`${base}/samples/user/strudel.json`)).json();
    assert.equal(m._base, '/samples/user/');
    assert.deepEqual(m.ping, ['demo-pack/ping.wav']);
    const idx = await (await fetch(`${base}/samples/user/packs.json`)).json();
    assert.equal(idx['demo-pack'].deploy, true);
    assert.equal((await fetch(`${base}/samples/user/demo-pack/ping.wav`)).headers.get('content-type'), 'audio/wav');
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
  const { writeWav } = await import('../scripts/analyze.mjs');
  const { tone } = await import('../lib/analyze.mjs');
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

test('a // @hidden song is left out of songs/index.json but still served', async () => {
  const file = path.join(ROOT, 'songs', '_t_hidden.strudel');
  fs.writeFileSync(file, '// @hidden\ns("bd")\n');
  try {
    await withServer(async (base) => {
      assert.ok(!(await (await fetch(`${base}/songs/index.json`)).json()).includes('_t_hidden.strudel'));
      assert.equal((await fetch(`${base}/songs/_t_hidden.strudel`)).status, 200);
    });
  } finally { fs.rmSync(file); }
});

test('notes file lives next to its song: GET/PUT songs/<name>.notes.json, absent is 404, not listed as a song', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/songs/_t_x.notes.json`)).status, 404);
    const put = await fetch(`${base}/songs/_t_x.notes.json`, { method: 'PUT', body: '{"prompt":"p"}' });
    assert.equal(put.status, 204);
    try {
      const r = await fetch(`${base}/songs/_t_x.notes.json`);
      assert.equal(r.headers.get('content-type'), 'application/json');
      assert.deepEqual(await r.json(), { prompt: 'p' });
      assert.ok(!(await (await fetch(`${base}/songs/index.json`)).json()).includes('_t_x.notes.json'));
      const demo = await (await fetch(`${base}/songs/demo.notes.json`)).json();
      assert.ok(demo.prompt && demo.requests.length, 'demo ships with provenance');
    } finally { fs.rmSync(path.join(ROOT, 'songs', '_t_x.notes.json')); }
    assert.equal((await fetch(`${base}/songs/_t_x.other.json`, { method: 'PUT', body: '' })).status, 400);
  });
});

test('PUT /renders/<name>.mp3 and .txt store what the page exported, as-is', async () => {
  await withServer(async (base) => {
    for (const [ext, body] of [['mp3', new Uint8Array([0xff, 0xfb, 0, 0])], ['txt', 's("bd sd")']]) {
      const r = await fetch(`${base}/renders/_t_exp.${ext}`, { method: 'PUT', body });
      assert.equal(r.status, 200);
      assert.match(await r.text(), new RegExp(`renders[\\\\/]_t_exp\\.${ext}$`));
      assert.equal(fs.statSync(path.join(ROOT, 'renders', `_t_exp.${ext}`)).size, body.length);
      fs.rmSync(path.join(ROOT, 'renders', `_t_exp.${ext}`));
    }
    assert.equal((await fetch(`${base}/renders/_t_exp.exe`, { method: 'PUT', body: '' })).status, 400);
    assert.equal((await fetch(`${base}/dump/demo.strudel`, { method: 'POST' })).status, 404, 'dump route is gone: the page expands in the browser');
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

