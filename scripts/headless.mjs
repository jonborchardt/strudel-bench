// Opens the Compose page in a headless Chromium so render and verify jobs have a page to run in, with no window.
// usage: node scripts/headless.mjs [songs/x.strudel]   (PORT env, default 3000; starts the server when none answers)
// Needs playwright-core (npm i -D playwright-core, then npx playwright-core install chromium) or CHROME=<path to a chrome
// binary> for a browser you already have. Web Audio, the clock worker and the offline renderer all run headless.
import path from 'node:path';
import { createServer } from '../server.mjs';

const port = process.env.PORT || 3000;
const song = path.basename(process.argv.find((a) => a.endsWith('.strudel')) ?? 'demo.strudel');
let pw;
try { pw = await import('playwright-core'); }
catch { console.error('playwright-core is not installed: npm i -D playwright-core && npx playwright-core install chromium'); process.exit(2); }

const up = await fetch(`http://localhost:${port}/songs/index.json`).then((r) => r.ok).catch(() => false);
if (!up) await new Promise((r) => createServer().listen(port, '127.0.0.1', () => { console.log(`server on http://localhost:${port}`); r(); }));

const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.error('[console]', m.text()); });
await page.goto(`http://localhost:${port}/#${song}`);
await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('packs'), null, { timeout: 120000 });
console.log(`page open on ${song}: npm run render / verify jobs run here. ctrl+c to close.`);
const stop = async () => { await browser.close().catch(() => {}); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30); // stay alive
