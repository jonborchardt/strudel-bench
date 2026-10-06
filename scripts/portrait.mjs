#!/usr/bin/env node
// Draw a portrait from the editor's own hash, headless: the half of portrait.html that Node can do.
//
//   node scripts/portrait.mjs "<hash|url|{json}>"                      -> renders/portrait.svg
//   node scripts/portrait.mjs <hash> --out renders/me.png              -> a png (through playwright-core's chromium)
//   node scripts/portrait.mjs <hash> --photo photo.png                 -> the photo beside it, for judging a likeness
//   node scripts/portrait.mjs <hash> --crop "95 105 210 220"           -> the same, cropped to a viewBox (head, eyes, mouth)
//   node scripts/portrait.mjs <hash> --sweep "facialHair.density=0.2,0.5,0.9" [--sweep "eyes.squint=0,.5"]
//                                                                      -> a contact sheet of every combination, labelled
//
// A sweep prints the hash of every cell, so the one that looks right is a link back into the editor.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { renderPortrait } from 'limner';
import { params, decode, encode, setOv } from '../limner/schema.mjs';

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf('--' + name); return i < 0 ? dflt : argv[i + 1]; };
const flags = (name) => argv.flatMap((a, i) => (a === '--' + name ? [argv[i + 1]] : []));
const positional = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));

const stateOf = (s) => {
  if (!s) return decode('');
  if (s.trim().startsWith('{')) { const st = JSON.parse(s); return { seed: 1, family: 'any', ...st, ov: { ...(st.ov ?? {}) } }; }
  return decode(s.includes('#') ? s.slice(s.indexOf('#') + 1) : s);
};
const st = stateOf(positional[0]);
const out = flag('out', 'renders/portrait.svg');
const crop = flag('crop');
const cell = +flag('cell', 300);
const photo = flag('photo');

/** Every combination of the sweeps, as { label, state }; with no sweep, the state itself. */
function cells() {
  const specs = flags('sweep').map((s) => { const [path, list] = s.split('='); return { path, values: list.split(',').map((v) => (v === 'null' ? null : v === '' || isNaN(+v) ? v : +v)) }; });
  if (!specs.length) return [{ label: '', st }];
  let out = [{ label: '', ov: { ...st.ov }, seed: st.seed }];
  for (const { path, values } of specs) out = out.flatMap((c) => values.map((v) => ({ // `$seed` is the character the edits sit on, not an override: sweeping it is the randomize button, one cell per draw
    label: `${c.label} ${path.replace(/^\$/, '').split('.').pop()}=${JSON.stringify(v)}`.trim(),
    ...(path === '$seed' || path === '$family' ? { ov: c.ov, seed: c.seed, [path.slice(1)]: v } : { ov: setOv({ ...c.ov }, path, v), seed: c.seed }),
  })));
  return out.map(({ label, ov, ...over }) => ({ label, st: { ...st, ...over, ov } }));
}

const svgOf = (s) => { const one = renderPortrait(params(s)); return crop ? one.replace('viewBox="0 0 400 480"', `viewBox="${crop}"`) : one; };
const list = cells();

const page = () => {
  const img = photo ? `<figure><img src="data:image/png;base64,${readFileSync(photo).toString('base64')}"><figcaption>photo</figcaption></figure>` : '';
  const body = list.map((c) => `<figure>${svgOf(c.st)}<figcaption>${c.label || 'portrait'}</figcaption></figure>`).join('');
  return `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#151413;color:#cfcac1;font:12px system-ui;display:flex;flex-wrap:wrap;gap:6px;padding:6px}figure{margin:0;width:${cell}px}svg,img{width:${cell}px;display:block}figcaption{font-size:11px;text-align:center;padding-top:3px}</style>${img}${body}`;
};

mkdirSync(dirname(resolve(out)), { recursive: true });
if (out.endsWith('.png')) {
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: Math.min(1600, (cell + 8) * Math.min(5, list.length + (photo ? 1 : 0))), height: 900 } });
  await p.setContent(page());
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
} else if (out.endsWith('.html')) writeFileSync(out, page());
else writeFileSync(out, svgOf(list[0].st));
console.log(out);
for (const c of list) console.log(`  ${c.label || 'portrait'}\tportrait.html#${encode(c.st)}`);
