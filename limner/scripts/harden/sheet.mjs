// Cells to a labelled html page, and that page to a png through a headless Chromium, the way scripts/portrait.mjs
// does it. The html is the testable half; the screenshot needs a browser and returns where each figure landed, so a
// cell can be cut back out of the png later (verify's "then" side).
import { renderPortrait, renderFigure } from '../../index.mjs';
import { params } from '../../schema.mjs';

/** Named crops of the bust sheet: the head, and the eyes (tuned by looking: the head crop holds a dragonborn's horns and a leaned head, sheets 0001-0002). */
export const CROPS = { head: '50 40 320 330', eyes: '95 160 210 90' };
export const LAYOUT = { bust: { cols: 3, cell: 360 }, figure: { cols: 5, cell: 220 } };
const VIEWBOX = { bust: '0 0 400 480', figure: '-30 -200 460 1284' };

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
  const body = cells.map((c, i) => `<figure id="c${i + 1}" style="--w:${cell}px;width:${cell}px">${svgOf(c.state, view, crop)}<figcaption>${i + 1} ${label(c.tuple)}</figcaption></figure>`).join('');
  return page(body, cols * (cell + 8) + 8);
}

/** Verify's page: per pair, the old cell cut out of its sheet png on the left and the new drawing on the right. */
export function pairsHtml(pairs, width) {
  const body = pairs.map(({ label: l, before, after }) => `<figure style="--w:${width}px;width:${width * 2 + 4}px"><div class="pair"><div style="width:${before.rect.w}px;height:${before.rect.h}px"><img style="width:auto;margin:-${before.rect.y}px 0 0 -${before.rect.x}px" src="data:image/png;base64,${before.png}"></div><div style="width:${width}px">${after}</div></div><figcaption>${l}: then, now</figcaption></figure>`).join('');
  return page(body, width * 2 + 24);
}

/** The page as a png, full height. Returns each figure's box in page pixels, in order. */
export async function screenshot(html, out, width) {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch { throw new Error('playwright-core is not installed (npm install)'); }
  let b;
  try { b = await chromium.launch({ executablePath: process.env.CHROME }); } catch (e) { throw new Error(`no browser: set CHROME to a Chromium binary (${e.message.split('\n')[0]})`); }
  try {
    const p = await b.newPage({ viewport: { width, height: 900 } });
    await p.setContent(html);
    const rects = await p.$$eval('figure', (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; }));
    await p.screenshot({ path: out, fullPage: true });
    return rects;
  } finally { await b.close(); }
}
