// azure.mjs runs each synthesis in a child process and settles only when that child is gone. No network here: the
// child is a fake, except for the missing-key case, where the real worker stops before it would connect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { azureSynth, regionOf } from '../azure.mjs';

const FAKE = path.join(import.meta.dirname, 'fixtures', 'fake-worker.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'utter-az-'));
const clean = (extra = {}) => { const e = { ...process.env, ...extra }; delete e.AZURE_SPEECH_KEY; delete e.AZURE_SPEECH_REGION; return e; };
const gone = (pid) => { try { process.kill(pid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } };
const live = () => new AbortController().signal;

test('the worker result comes back as a wav and boundaries, and the hand-off files are removed', async () => {
  const tmpDir = tmp(), synth = azureSynth({ worker: FAKE, env: clean({ FAKE_MODE: 'ok' }), tmpDir });
  const r = await synth('<speak>hold on</speak>', { signal: live() });
  assert.equal(r.wav.toString('latin1', 0, 4), 'RIFF');
  assert.deepEqual(r.boundaries.map((b) => b.text), ['hold', 'on']);
  assert.deepEqual(fs.readdirSync(tmpDir), []);
});

test('a failing worker surfaces its message, so the retry rules can read it', async () => {
  const tmpDir = tmp(), synth = azureSynth({ worker: FAKE, env: clean({ FAKE_MODE: 'fail' }), tmpDir });
  await assert.rejects(synth('<speak>x</speak>', { signal: live() }), /No free synthesizer/);
  assert.deepEqual(fs.readdirSync(tmpDir), []);
});

test('abort kills the worker, and the promise settles only once it is gone', async () => {
  const tmpDir = tmp(), pidFile = path.join(tmp(), 'pid'), ac = new AbortController();
  const synth = azureSynth({ worker: FAKE, env: clean({ FAKE_MODE: 'sleep', FAKE_PIDFILE: pidFile }), tmpDir });
  const p = synth('<speak>x</speak>', { signal: ac.signal });
  while (!fs.existsSync(pidFile) || !fs.readFileSync(pidFile, 'utf8')) await new Promise((r) => setTimeout(r, 20));
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.equal(gone(pid), false, 'the worker is running');
  ac.abort();
  await assert.rejects(p, /stopped/);
  assert.equal(gone(pid), true, 'settlement means the process no longer exists');
  assert.deepEqual(fs.readdirSync(tmpDir), []);
});

test('an already-aborted signal starts nothing', async () => {
  const tmpDir = tmp(), pidFile = path.join(tmp(), 'pid'), ac = new AbortController();
  ac.abort();
  await assert.rejects(azureSynth({ worker: FAKE, env: clean({ FAKE_MODE: 'ok', FAKE_PIDFILE: pidFile }), tmpDir })('<speak>x</speak>', { signal: ac.signal }), /stopped/);
  assert.equal(fs.existsSync(pidFile), false);
});

test('without a key the real worker says which variables it needs, before any connection', async () => {
  const cwd = tmp(); // no .env here or above it in the temp tree
  await assert.rejects(azureSynth({ env: clean(), cwd, tmpDir: tmp() })('<speak>x</speak>', { signal: live() }), /AZURE_SPEECH_KEY and AZURE_SPEECH_REGION/);
});

test('regionOf reads the region from the environment or the nearest .env, never the key', () => {
  assert.equal(regionOf({ env: { AZURE_SPEECH_REGION: 'westeurope' }, cwd: tmp() }), 'westeurope');
  const root = tmp(), deep = path.join(root, 'a', 'b');
  fs.mkdirSync(deep, { recursive: true });
  fs.writeFileSync(path.join(root, '.env'), 'AZURE_SPEECH_KEY=secret\nAZURE_SPEECH_REGION=eastus\n');
  assert.equal(regionOf({ env: {}, cwd: deep }), 'eastus');
  assert.equal(regionOf({ env: {}, cwd: tmp() }), '');
});
