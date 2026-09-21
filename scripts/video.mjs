// Ask the open page to export a song as a video: the audio from the offline render, the stage's world run frame by
// frame from the same score (web/visual/export.mjs), saved as renders/<name>.mp4 (H.264 + AAC) or .webm (VP9 + Opus)
// by what the page's browser encodes. The page must be open: npm run headless, or the Compose page in a browser.
// usage: node scripts/video.mjs songs/x.strudel [--name out]   (PORT env overrides 3000; RENDER_TIMEOUT ms for a long song)
import path from 'node:path';
import { parseArgs } from 'node:util';
import { renderVia } from './render.mjs';

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { name: { type: 'string' } } });
const file = positionals.find((a) => a.endsWith('.strudel'));
if (!file) { console.error('usage: node scripts/video.mjs songs/x.strudel [--name out]'); process.exit(2); }
try { console.log(await renderVia({ song: path.basename(file), name: o.name, video: true })); }
catch (e) { console.error(e.message); process.exit(1); }
