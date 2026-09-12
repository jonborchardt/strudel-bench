// Prints the plain Strudel a song reduces to. song()/section() build patterns by calling Strudel at runtime,
// so there is no source to show: we wrap every core function and Pattern method, record the call chain that
// produced each pattern, and print it per section and layer. Read-only; closures passed to fmap print as-is.
// usage: node scripts/dump.mjs songs/x.strudel
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
console.log = () => {}; // strudel prints load banners to stdout; only the dump belongs there
const { ensureScope } = await import('./check.mjs'); // runs esm-fix before the dynamic strudel imports below
const core = await import('@strudel/core');
const mini = await import('@strudel/mini');
const tonal = await import('@strudel/tonal');
const { transpiler } = await import('@strudel/transpiler');
const { isPattern } = await import('../lib/strudel.mjs');

const src = new WeakMap(); // pattern -> source string, or a thunk producing it (resolved and memoised on first read)
const srcOf = (p) => { let s = src.get(p); if (typeof s === 'function') { s = s(); src.set(p, s); } return s; };
const names = new Map(); // wrapped core function -> name
const num = (n) => String(Number(n.toPrecision(6)));
// a pattern strudel reified internally (no recorded source): show its value if it is a constant
const constant = (p) => { const h = p.queryArc(0, 1); return h.length === 1 && typeof h[0].value !== 'object' && h[0].whole?.begin.valueOf() === 0 && h[0].whole.end.valueOf() === 1 ? show(h[0].value) : '/*pattern*/'; };
const show = (a) => (Array.isArray(a) ? `[${a.map(show).join(', ')}]`
  : isPattern(a) ? (srcOf(a) ?? constant(a))
  : typeof a === 'function' ? (names.get(a) ?? a.toString().replace(/\bS\./g, '')) // lib closures reach strudel via S.; the repl has globals
  : typeof a === 'number' ? num(a)
  : typeof a === 'bigint' || (a && typeof a.valueOf === 'function' && typeof a.valueOf() === 'number') ? num(a.valueOf())
  : json(a));
const json = (a) => { try { return JSON.stringify(a) ?? String(a); } catch { return `/*${a?.constructor?.name ?? typeof a}*/`; } };
const rec = (r, s) => { if (isPattern(r)) src.set(r, s); return r; }; // lazy: dumpFile aliases the song pattern before anything reads it
// pat.add/sub/mul/... are non-configurable getters, so we only see the inner _opIn(other, (y) => (g) => op(y, g))
// call; probing the closure with two numbers tells the op apart.
const OPS = { add: 10, sub: 4, mul: 21, div: 7 / 3, mod: 1, pow: 343, set: 3, keep: 7 };
const opName = (fn) => { try { const r = fn(7)(3); return Object.keys(OPS).find((k) => OPS[k] === r); } catch { return undefined; } };
const opCall = (k, a) => {
  const op = k.startsWith('_op') && opName(a[1]);
  if (!op) return `${k}(${a.map(show).join(', ')})`;
  const how = k.slice(3).toLowerCase();
  return `${op}${how === 'in' ? '' : '.' + how}(${show(a[0])})`;
};

let installed;
function install() {
  if (installed) return; installed = true;
  for (const mod of [core, mini, tonal]) {
    for (const [k, v] of Object.entries(mod)) {
      if (isPattern(v)) src.set(v, k);
      else if (typeof v === 'function' && !/^[A-Z]/.test(k) && globalThis[k] === v) {
        const w = (...a) => rec(v(...a), () => (k === 'm' || k === 'mini' ? show(a[0]) : `${k}(${a.map(show).join(', ')})`));
        names.set(w, k);
        globalThis[k] = w;
      }
    }
  }
  const P = core.Pattern.prototype;
  for (const k of Object.getOwnPropertyNames(P)) {
    const d = Object.getOwnPropertyDescriptor(P, k);
    if (k === 'constructor' || !d.configurable) continue;
    const chain = (self, a, r) => rec(r, () => `${srcOf(self) ?? constant(self)}.${opCall(k, a)}`);
    if (typeof d.value === 'function') {
      Object.defineProperty(P, k, { ...d, value: function (...a) { return chain(this, a, d.value.apply(this, a)); } });
    } else if (d.get) { // add/sub/mul/... are getters returning a function with .in/.out/... variants
      Object.defineProperty(P, k, { ...d, get() {
        const f = d.get.call(this);
        if (typeof f !== 'function') return f;
        const self = this;
        return Object.assign((...a) => chain(self, a, f.apply(self, a)), f);
      } });
    }
  }
}

/** One chain per line: break at top-level `.` and, inside a top-level stack(), at its commas. */
function fmt(s) {
  const inStack = /^stack\(/.test(s);
  let out = '', depth = 0, q = false, open = inStack; // open: still inside the outer stack(...)
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { out += c; if (c === '\\') out += s[++i]; else if (c === '"') q = false; continue; }
    if (c === '"') q = true;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') { depth--; if (open && depth === 0) { open = false; out += '\n)'; continue; } }
    else if (c === '.' && s[i - 1] === ')' && (depth === 0 || (open && depth === 1))) { out += '\n' + '  '.repeat(depth + 1) + c; continue; }
    else if (c === ',' && open && depth === 1) { out += ',\n  '; if (s[i + 1] === ' ') i++; continue; }
    out += c;
  }
  return inStack ? out.replace(/^stack\(/, 'stack(\n  ') : out;
}

export async function dumpFile(file) {
  await ensureScope();
  install();
  let { pattern } = await core.evaluate(fs.readFileSync(file, 'utf8'), transpiler);
  pattern = await pattern;
  const m = pattern?.strudle;
  if (!m) return fmt(srcOf(pattern) ?? '/*pattern*/');
  const id = (s, l) => `${s.replace(/\W/g, '_')}_${l}`;
  const lines = [`setcps(${m.meta.cps})`, ''];
  for (const s of m.sections) {
    lines.push(`// ${s.name} [${s.offset}-${s.offset + s.span})${s.role ? ' ' + s.role : ''}`);
    for (const [layer, l] of Object.entries(s.layers)) {
      lines.push(`// ${layer} ${JSON.stringify(l.attrs, (k, v) => (isPattern(v) ? srcOf(v) ?? 'signal' : v))}`);
      lines.push(`const ${id(s.name, layer)} = ${fmt(srcOf(l.pattern) ?? '/*pattern*/')}`, '');
    }
  }
  // a file may wrap the song, e.g. stack(song, textures) with the metadata copied over: name the song and print the wrapper
  const wrapped = pattern !== m.pattern;
  const timed = m.sections.some((s) => s.span !== s.cycles);
  lines.push(`${wrapped ? 'const layers = ' : ''}${timed ? 'stepcat' : 'arrange'}(`);
  for (const s of m.sections) {
    const stack = `stack(${Object.keys(s.layers).map((l) => id(s.name, l)).join(', ')})`;
    lines.push(timed ? `  [${s.span}, ${stack}.fast(${s.cycles})],` : `  [${s.cycles}, ${stack}],`);
  }
  lines.push(timed ? `).slow(${m.total})` : ')');
  if (wrapped) { src.set(m.pattern, 'layers'); lines.push('', fmt(srcOf(pattern) ?? '/*pattern*/')); }
  const out = lines.join('\n');
  // lib closures the dump prints reference library helpers by name (piece from a signal axis, arpIndices from
  // an arped pad); define the ones used so the dump pastes into the strudel repl as-is.
  const L = globalThis.strudleLib;
  const helpers = [];
  if (out.includes('piece(')) helpers.push(`const piece = ${L.piece.toString().replace(/^.*f\.toString.*\r?\n/m, '').replace(/\r\n/g, '\n')}`);
  if (out.includes('arpIndices(')) helpers.push(
    `const ARP_ORDERS = { ${Object.entries(L.ARP_ORDERS).map(([k, f]) => `${k}: ${f}`).join(', ')} }`,
    `const arpIndices = ${L.arpIndices}`);
  return helpers.length ? `${helpers.join('\n\n')}\n\n${out}` : out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts/dump.mjs songs/x.strudel'); process.exit(2); }
  process.stdout.write((await dumpFile(file)) + '\n');
}
