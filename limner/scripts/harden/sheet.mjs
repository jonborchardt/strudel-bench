// Cells to a labelled html page, and that page to a png through a headless Chromium, the way scripts/portrait.mjs
// does it. The html is the testable half; the screenshot needs a browser and returns where each figure landed, so a
// cell can be cut back out of the png later (verify's "then" side).
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderPortrait, renderFigure } from '../../index.mjs';
import { params } from '../../schema.mjs';

/** The Chromium every render here launches: `CHROME` when set, else the newest playwright headless shell installed on this machine (`ms-playwright/chromium_headless_shell-<build>`), else undefined so playwright picks its own. Nobody sets an env var to render a sheet. */
export function chromePath(home = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(process.env.LOCALAPPDATA ?? join(process.env.HOME ?? '.', '.cache'), 'ms-playwright')) {
  if (process.env.CHROME) return process.env.CHROME;
  const builds = existsSync(home) ? readdirSync(home).filter((d) => /^chromium_headless_shell-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]) : [];
  for (const b of builds) for (const exe of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-linux64/chrome-headless-shell']) if (existsSync(join(home, b, exe))) return join(home, b, exe);
  return undefined;
}

/** Named crops of the bust sheet: the head, and the eyes (tuned by looking: the head crop holds a dragonborn's horns and a leaned head, sheets 0001-0002). */
export const CROPS = { head: '50 40 320 330', eyes: '95 160 210 90' };
export const LAYOUT = { bust: { cols: 3, cell: 360 }, figure: { cols: 5, cell: 280 } }; // a figure cell 280 wide draws the 580-wide frame at the scale 220 drew the old 460
export const VIEWBOX = { bust: '0 0 400 480', figure: '-90 -200 580 1284' }; // renderPortrait's and renderFigure's own

/** One cell's svg: the bust or the standing figure; with a crop (a CROPS name or a viewBox) the bust cut to it. */
export function svgOf(st, view = 'bust', crop = null) {
  const p = params(st), svg = crop ? renderPortrait(p) : view === 'figure' ? renderFigure(p) : renderPortrait(p);
  return crop ? svg.replace(`viewBox="${VIEWBOX.bust}"`, `viewBox="${CROPS[crop] ?? crop}"`) : svg;
}

const label = (t) => (t.cast === 'calibration' ? 'calibration' : `${t.cast}/${t.stance}/${t.expression}`);
const page = (body, width) => `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#151413;color:#cfcac1;font:12px system-ui;display:flex;flex-wrap:wrap;gap:8px;padding:8px;width:${width}px}figure{margin:0;width:var(--w)}svg,img{width:var(--w);display:block}figcaption{font-size:11px;text-align:center;padding-top:3px;white-space:nowrap;overflow:hidden}.pair{display:flex;gap:4px}.pair>div{overflow:hidden}</style>${body}`;

/** The sheet: every cell as a figure numbered from 1, in the view's layout. A crop draws every cell as a cropped bust. */
export function sheetHtml(cells, { view = 'bust', crop = null } = {}) {
  const { cols, cell } = LAYOUT[crop ? 'bust' : view];
  const body = cells.map((c, i) => `<figure id="c${i + 1}" style="--w:${cell}px;width:${cell}px">${svgOf(c.state, view, crop)}<figcaption>${c.label ?? `${i + 1} ${label(c.tuple)}`}</figcaption></figure>`).join('');
  return page(body, cols * (cell + 8) + 8);
}

/** The old cell, or with `before.crop` ({ x, y, w, h } in ops units, the bust's 400x480) that region of it enlarged to `width`. `frame` is where the cell's svg starts in ops units and how wide it is: the bust's { x: 0, y: 0, w: 400 }, a figure's { x, y: y - dy, w } from the viewBox the sheet was drawn in (its json's `viewBox`) with dy renderFigure's floor shift; the svg is rect.w wide from the cell's top. */
function thenOf({ png, rect, crop, frame = { x: 0, y: 0, w: 400 } }, width) {
  const src = typeof png === 'number' ? `data-png="${png}"` : `src="data:image/png;base64,${png}"`; // a number: one of the page's shared pngs (pairsHtml)
  if (!crop) return `<div style="width:${rect.w}px;height:${rect.h}px"><img style="width:auto;margin:-${rect.y}px 0 0 -${rect.x}px" ${src}></div>`;
  const u = rect.w / frame.w, sx = rect.x + (crop.x - frame.x) * u, sy = rect.y + (crop.y - frame.y) * u, sw = crop.w * u, sh = crop.h * u, k = width / sw;
  return `<div style="width:${width}px;height:${width * sh / sw}px"><img style="width:auto;transform:scale(${k});transform-origin:0 0;margin:-${sy * k}px 0 0 -${sx * k}px" ${src}></div>`;
}

/** Verify's page: per pair, the old cell cut out of its sheet png on the left (enlarged when cropped) and the new drawing on the right. */
export function pairsHtml(pairs, width) {
  const pngs = [], shared = (png) => (pngs.includes(png) ? pngs.indexOf(png) : pngs.push(png) - 1); // every pair cut from one snapshot carries the same png: written once, not once per pair (sixty-seven copies of a tall snapshot closed the browser, T022)
  const body = pairs.map(({ label: l, before, after }) => `<figure style="--w:${width}px;width:${width * 2 + 4}px"><div class="pair">${before ? thenOf({ ...before, png: shared(before.png) }, width) : `<div style="width:${width}px">then: not on disk</div>`}<div style="width:${width}px">${after}</div></div><figcaption>${l}: ${!before ? 'now only' : before.crop ? 'then (enlarged), now' : 'then, now'}</figcaption></figure>`).join('');
  return page(body + (pngs.length ? `<script>const P = ${JSON.stringify(pngs.map((b) => `data:image/png;base64,${b}`))}; for (const i of document.querySelectorAll('img[data-png]')) i.src = P[i.dataset.png];</script>` : ''), width * 2 + 24);
}

/** The page as a png, full height. Returns each figure's box in page pixels, in order. */
export async function screenshot(html, out, width) {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch { throw new Error('playwright-core is not installed (npm install)'); }
  let b;
  try { b = await chromium.launch({ executablePath: chromePath() }); } catch (e) { throw new Error(`no browser: none under ms-playwright, set CHROME to a Chromium binary (${e.message.split('\n')[0]})`); }
  try {
    const p = await b.newPage({ viewport: { width, height: 900 } });
    await p.setContent(html);
    const rects = await p.$$eval('figure', (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; }));
    await p.screenshot({ path: out, fullPage: true });
    return rects;
  } finally { await b.close(); }
}
