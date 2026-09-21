// The live audio thread's load while a section plays: the ground truth behind scratches, cracks and dropped hits, which
// the check's `voices` only models. Opens the page headless (playwright-core, CHROME env for the binary as headless.mjs),
// pins the section, plays it, traces Chromium's webaudio category and reads the render callbacks: the mean over 2.67 ms
// (one 128-frame quantum at 48 kHz) is the thread's busy share, a callback over the quantum is a late one, and a
// FireRenderCallback over 10 ms is a dropout you hear. Runs vary 5-10 points with the machine's other load: compare
// variants as interleaved pairs, never single runs. Also counts the page's trigger errors (a hit that failed to sound).
// usage: node scripts/trace.mjs songs/x.strudel <section> [--seconds n]   (PORT env, default 3041; starts its own server)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from '../server.mjs';

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { seconds: { type: 'string' } } });
const file = positionals.find((a) => a.endsWith('.strudel')), section = positionals.find((a) => a !== file);
if (!file || !section) { console.error('usage: node scripts/trace.mjs songs/x.strudel <section> [--seconds n]'); process.exit(2); }
const secs = Number(o.seconds ?? 15), port = Number(process.env.PORT || 3041), song = path.basename(file);
let pw;
try { pw = await import('playwright-core'); } catch { console.error('playwright-core is not installed: npm i -D playwright-core'); process.exit(2); }

await new Promise((r) => createServer().listen(port, '127.0.0.1', r));
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const t0 = Date.now(), trig = {};
page.on('console', (m) => { if (/getTrigger|AudioWorkletGlobalScope/.test(m.text())) { const s = Math.floor((Date.now() - t0) / 1000); trig[s] = (trig[s] ?? 0) + 1; } });
await page.goto(`http://localhost:${port}/?section=${section}#${song}`); // ?section pins it
await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('packs'), null, { timeout: 120000 });
await page.click('#play');
await page.waitForTimeout(3000); // the first bar, and the worklets' load
const out = path.join(os.tmpdir(), `strudel-trace-${song}-${section}.json`);
await browser.startTracing(page, { path: out, categories: ['webaudio', 'audio'] });
await page.waitForTimeout(secs * 1000);
await browser.stopTracing();
const err = await page.evaluate(() => document.getElementById('err')?.textContent ?? '');
await browser.close();

const ev = JSON.parse(fs.readFileSync(out, 'utf8')).traceEvents;
const render = ev.filter((e) => e.name === 'RealtimeAudioDestinationHandler::Render' && e.dur !== undefined);
const fire = ev.filter((e) => /FireRenderCallback/.test(e.name) && e.dur !== undefined);
const durs = render.map((e) => e.dur / 1000).sort((a, b) => a - b);
if (!durs.length) { console.error('no render callbacks in the trace: did the section play?'); process.exit(1); }
const mean = durs.reduce((a, b) => a + b, 0) / durs.length, p95 = durs[Math.floor(durs.length * .95)], max = durs[durs.length - 1];
const late = durs.filter((d) => d > 2.67).length, drop = fire.filter((e) => e.dur > 10000).length;
const first = Math.min(...render.map((e) => e.ts)), perSec = {};
for (const e of render) { const s = Math.floor((e.ts - first) / 1e6); perSec[s] = (perSec[s] ?? 0) + e.dur / 1000; }
console.log(`${song} ${section}: ${render.length} render callbacks over ${secs} s; mean ${mean.toFixed(2)} ms = ${(100 * mean / 2.67).toFixed(0)}% busy; p95 ${p95.toFixed(2)} ms; max ${max.toFixed(1)} ms; ${late} late quanta (${(100 * late / durs.length).toFixed(1)}%); ${drop} dropouts (callbacks over 10 ms)`);
console.log('busy per second:', Object.values(perSec).slice(0, secs).map((ms) => `${(100 * ms / 1000).toFixed(0)}%`).join(' '));
console.log(`trigger errors per second since the page opened: ${Object.keys(trig).length ? JSON.stringify(trig) : 'none'}${err ? `; #err: ${err.slice(0, 160)}` : ''}`);
process.exit(0);
