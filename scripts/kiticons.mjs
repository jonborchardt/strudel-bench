// One 36px SVG per drum kit in web/kits/, drawn from the words in its description (lib/kits.json label + about).
// Four slots, each set by the first matching word group, so the same word always draws the same thing:
//   texture (line style) · weight (amplitude, stroke) · brightness (colour) · accent (every matching overlay)
// Writes the resolved `tags` and `icon` path back into lib/kits.json and a legend icon per slot value into
// web/kits/legend/. Re-run after editing a description: node scripts/kiticons.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const KITS = path.join(ROOT, 'lib', 'kits.json');
const OUT = path.join(ROOT, 'web', 'kits');

// slot -> [value, words (regex fragments)] in priority order, matched against label + kind + about; a word matches as a prefix ("crunch" also hits "crunchy"),
// not when negated ("no grit", "without vintage grit"). The first value with a hit wins; none -> the default (marked *).
const SLOTS = {
  texture: [
    ['jagged', ['crunch', 'grit', 'grainy', 'aliased', '8-bit', '12-bit', 'harsh', 'dusty', 'raw', 'fizzy', 'primitive']],
    ['smooth', ['analog', 'warm', 'round', 'soft', 'woody', 'synth-patched', 'synthetic', 'monosynth', 'modular', 'fat', 'organ-box', 'preset', 'bouncy']],
    ['clean*', ['clean', 'polished', 'realistic', 'hi-fi', 'neutral', '16-bit', 'rom', 'articulate', 'lush', 'generic', 'plain', 'modern', 'digital', 'pcm']],
  ],
  weight: [
    ['heavy', ['punch', 'big', 'boom', 'deep', 'fat', 'hard', 'huge', 'enormous', 'pumping', 'cracking', 'chunky', 'full']],
    ['light', ['thin', 'tiny', 'papery', 'small', 'light', 'cheap', 'toy', 'beepy', 'faint', 'four tiny']],
    ['medium*', []],
  ],
  brightness: [
    ['dark', ['dusty', 'dark', 'warm', 'woody', 'muffled', 'boom-bap', 'sub', 'deep', 'booming']],
    ['bright', ['bright', 'crisp', 'glassy', 'sizzl', 'sharp', 'brittle', 'metallic', 'clicky', 'ticky', 'hi-fi']],
    ['neutral*', []],
  ],
  accent: [
    ['pixels', ['toy', 'calculator', 'beepy', 'chiptune']],
    ['sweep', ['zappy', 'swept', 'laser', 'patched', 'modular', 'pew', 'thwack', 'bleep']],
    ['ticks', ['preset', 'organ-box', 'tick-tock', 'bossa', 'lounge', 'exotica']],
    ['layers', ['huge', 'hundreds', 'everything', 'enormous', 'library', 'variant', 'layered']],
    ['sub', ['sub', 'boom']],
    ['noise', ['hiss', 'nois', 'fuzzy', 'sizzl', 'white-noise']],
    ['none*', []],
  ],
};
const NEG = String.raw`(?<!\b(?:no|not|without|isn't)\s+(?:\w+\s+){0,2})`;
const hit = (text, w) => new RegExp(`${NEG}(?<![\\w-])${w}`, 'i').test(text); // words are regex fragments
export function tagsOf(text) {
  const tags = {};
  for (const [slot, values] of Object.entries(SLOTS)) {
    const found = values.filter(([, words]) => words.some((w) => hit(text, w))).map(([v]) => v.replace('*', ''));
    if (!found.length) found.push(values.find(([v]) => v.endsWith('*'))[0].replace('*', ''));
    tags[slot] = slot === 'accent' ? found.join('+') : found[0]; // one line, one weight, one colour; accents sit in different corners and all draw
  }
  return tags;
}

// --- drawing: a drum hit on a 36x36 box; attack at x=4, decaying oscillation to x=33 around the baseline y=18 ---
const BASE = 18, X0 = 4, X1 = 33;
const COLOUR = { bright: '#1e9bd7', dark: '#9a5b1f', neutral: '#5b6b8a' };
const AMP = { heavy: 14, medium: 9, light: 5 }, STROKE = { heavy: 3.2, medium: 2.2, light: 1.4 };
const wave = (x, A) => (x < X0 + 4 ? BASE - (A * (x - X0)) / 4 : BASE - A * Math.exp(-(x - X0 - 4) / 11) * Math.cos((2 * Math.PI * (x - X0 - 4)) / 10)); // attack ramp, then decaying cosine
const pts = (A, step) => { const p = []; for (let x = X0; x <= X1 + 1e-9; x += step) p.push([x, wave(x, A)]); return p; };
const f = (n) => Math.round(n * 10) / 10;
const line = (p) => `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`;
const stairs = (p) => p.map(([x, y], i) => (i ? `H${f(x)}V${f(y)}` : `M${f(x)} ${f(y)}`)).join('');
const TEXTURE = {
  smooth: (A) => ({ d: line(pts(A, 1)), join: 'round' }),
  jagged: (A) => ({ d: stairs(pts(A, 2.5)), join: 'miter' }),
  clean: (A) => ({ d: line(pts(A, 5).map(([x, y], i) => (i < 1 ? [x, y] : [x, wave(x, A)]))), join: 'miter' }), // only the extrema: straight runs between peaks
};
const ACCENT = {
  none: () => '',
  sub: (c) => `<path d="M10 ${BASE + 3}Q21.5 38 ${X1} ${BASE + 3}Z" fill="${c}" opacity=".5"/>`,
  noise: (c) => [[15, 7], [19, 10], [22, 5], [25, 9], [28, 6], [31, 10], [17, 12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="${c}"/>`).join(''),
  ticks: (c) => [6, 12, 18, 24, 30].map((x) => `<path d="M${x} 28v4" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`).join(''),
  sweep: (c) => `<path d="M8 6Q26 6 33 32" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="2 2"/>`,
  layers: (c, body) => body.replace('<path', `<path transform="translate(3 4)" opacity=".35"`),
  pixels: (c, body, A) => pts(A, 3).map(([x, y]) => `<rect x="${f(x - 1.5)}" y="${f(y - 1.5)}" width="3" height="3" fill="${c}"/>`).join(''),
};
export function draw({ texture, weight, brightness, accent }) {
  const c = COLOUR[brightness], A = AMP[weight];
  const { d, join } = TEXTURE[texture](A);
  const body = `<path d="${d}" fill="none" stroke="${c}" stroke-width="${STROKE[weight]}" stroke-linejoin="${join}" stroke-linecap="round"/>`;
  const accents = accent.split('+');
  const extra = (name) => (accents.includes(name) ? ACCENT[name](c, body, A) : '');
  // layers go behind, pixels replace the line, the rest sit in their own corner of the box, so every matched accent draws
  const inner = extra('layers') + (accents.includes('pixels') ? extra('pixels') : body) + ['sweep', 'ticks', 'sub', 'noise'].map(extra).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">${inner}</svg>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  fs.mkdirSync(path.join(OUT, 'legend'), { recursive: true });
  const kits = JSON.parse(fs.readFileSync(KITS, 'utf8'));
  for (const [name, kit] of Object.entries(kits)) {
    kit.tags = tagsOf(`${kit.label} ${kit.kind} ${kit.about}`);
    kit.icon = `web/kits/${name}.svg`;
    fs.writeFileSync(path.join(OUT, `${name}.svg`), draw(kit.tags));
  }
  fs.writeFileSync(KITS, JSON.stringify(kits, null, 2) + '\n');
  // legend: only what the slot changes. texture keeps the line shape; weight is a bar of that thickness; brightness a
  // colour dot; an accent is its mark alone on the neutral colour
  const base = tagsOf(''), n = COLOUR.neutral;
  const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">${inner}</svg>\n`;
  const LEGEND = {
    texture: (v) => draw({ ...base, texture: v }),
    weight: (v) => wrap(`<rect x="5" y="${18 - STROKE[v]}" width="26" height="${STROKE[v] * 2}" rx="${STROKE[v]}" fill="${n}"/>`),
    brightness: (v) => wrap(`<circle cx="18" cy="18" r="9" fill="${COLOUR[v]}"/>`),
    accent: (v) => (v === 'layers' ? draw({ ...base, accent: v }) : wrap(ACCENT[v](n, '', AMP.medium).replace('opacity=".5"', '').replace('stroke-width="1.5"', 'stroke-width="2.4"'))), // layers only reads as a ghost of a line; the rest at full strength so they read at key size
  };
  for (const [slot, values] of Object.entries(SLOTS)) for (const [v] of values) fs.writeFileSync(path.join(OUT, 'legend', `${slot}-${v.replace('*', '')}.svg`), LEGEND[slot](v.replace('*', '')));
  const count = {};
  for (const { tags } of Object.values(kits)) for (const [s, v] of Object.entries(tags)) count[`${s}:${v}`] = (count[`${s}:${v}`] ?? 0) + 1;
  console.log(`wrote ${Object.keys(kits).length} icons to web/kits/`, count);
}
