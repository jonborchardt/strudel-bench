// Azure AI Speech, one child process per synthesis. This file starts worker.mjs, hands it the SSML in a file, and
// keeps the stop contract speak.mjs relies on: on abort the child is killed, and the promise settles on the child's
// `close` event, that is, when the process and its sockets are really gone. The key is read only inside the worker;
// here only the region is looked up, because it is part of the cache identity.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const WORKER = fileURLToPath(new URL('./worker.mjs', import.meta.url));

/** The Azure region in use: the environment's, else the nearest .env's at or above `cwd`, else ''. */
export function regionOf({ env = process.env, cwd = process.cwd() } = {}) {
  if (env.AZURE_SPEECH_REGION) return env.AZURE_SPEECH_REGION;
  for (let d = path.resolve(cwd); ; d = path.dirname(d)) {
    const f = path.join(d, '.env');
    if (fs.existsSync(f)) return parseEnv(fs.readFileSync(f, 'utf8')).AZURE_SPEECH_REGION ?? '';
    if (d === path.dirname(d)) return '';
  }
}

/** A synth for speak(): (ssml, { signal }) -> { wav, boundaries }. The options exist for the tests (a fake worker, a clean environment). */
export function azureSynth({ worker = WORKER, env = process.env, cwd = process.cwd(), tmpDir = os.tmpdir() } = {}) {
  return (ssml, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('utter: synthesis stopped before it started'));
    const base = path.join(tmpDir, `utter-${randomBytes(8).toString('hex')}`), ssmlFile = base + '.ssml', outFile = base + '.wav';
    const tidy = () => { for (const f of [ssmlFile, outFile]) fs.rmSync(f, { force: true }); };
    fs.writeFileSync(ssmlFile, ssml);
    const child = spawn(process.execPath, [worker, ssmlFile, outFile], { env, cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '', spawnError = null;
    const stop = () => child.kill();
    signal.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { spawnError = e; if (child.pid === undefined) { signal.removeEventListener('abort', stop); tidy(); reject(e); } });
    child.on('close', (code) => { // the process has exited and its pipes are closed: only now is the attempt over
      signal.removeEventListener('abort', stop);
      try {
        if (signal.aborted) throw new Error('utter: synthesis stopped (worker killed)');
        if (code !== 0) throw new Error(stderr.trim() || spawnError?.message || `utter: the azure worker exited ${code}`);
        const wav = fs.readFileSync(outFile), { boundaries } = JSON.parse(stdout.trim().split('\n').at(-1) || '{}');
        if (!Array.isArray(boundaries)) throw new Error('utter: the azure worker printed no boundaries');
        resolve({ wav, boundaries });
      } catch (e) { reject(e); } finally { tidy(); }
    });
  });
}

export const synth = azureSynth();
