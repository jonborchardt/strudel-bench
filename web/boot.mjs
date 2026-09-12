// Shared page bootstrap: initStrudel with the local packs (or the Strudel CDN on GitHub Pages), lib/ loaded into
// the scope, and strudel's own error log routed to the caller. Both index.html and examples.html start here.
import { dump } from '../lib/dump.mjs';

/** The drum-machine pack once loaded: its sound `names` (canonical spelling) and alias bank (`{ RolandTR909: 'tr909', ... }`), for the kit selector. */
export const drumMachines = { names: [], aliases: {} };

export function boot({ onError = () => {}, onStatus = () => {} } = {}) {
  const ready = initStrudel({
    sync: true, // worker clock: the only scheduler with setCycle (section jump)
    onEvalError: (e) => onError(e.message),
    prebake: async () => {
      // local packs (npm run samples) when present; otherwise stream from the Strudel CDN like strudel.cc does (github pages)
      const local = await fetch('samples/packs/packs.json').then((r) => (r.ok ? r.json() : null));
      const cdn = local ? null : await fetch('lib/packs.json').then((r) => r.json());
      const packs = local ?? Object.keys(cdn.packs);
      await Promise.all([
        ...packs.map((p) => (local ? strudel.samples(`samples/packs/${p}.json`) : strudel.samples(cdn.packs[p].json, cdn.packs[p].base))),
        strudel.samples('samples/user/strudel.json'),
      ]);
      if (packs.includes('tidal-drum-machines')) {
        const alias = local ? 'samples/packs/tidal-drum-machines-alias.json' : cdn.alias;
        strudel.aliasBank(alias);
        const json = (u) => fetch(u).then((r) => r.json());
        [drumMachines.aliases, drumMachines.names] = await Promise.all([json(alias), json(local ? 'samples/packs/tidal-drum-machines.json' : cdn.packs['tidal-drum-machines'].json).then(Object.keys)]);
      }
      await import('../lib/index.mjs');
      onStatus(`packs: ${packs.join(', ')}${local ? '' : ' (cdn)'}`);
    },
  });
  // surface strudel's own error log lines (e.g. "sound not found")
  document.addEventListener('strudel.log', (e) => { if (e.detail.type === 'error') onError(e.detail.message); });
  return ready;
}

/** Evaluate and start playing `code`; song() files carry their tempo in metadata, bare layer patterns get the default. */
export async function playCode(ready, code) {
  await ready;
  const pat = await strudel.evaluate(code);
  setcps(pat?.strudle?.meta.cps ?? 0.5);
  return pat;
}

// build the pattern the way strudel's repl does minus starting it: the transpiler makes the last expression the return value
const evalOnly = (code) => ({ pattern: new Function(`"use strict";return (async () => {${strudel.transpiler(code).output}})()`)() });
/** The pattern `code` evaluates to, without touching the scheduler: sections and total for the transport before play. */
export async function evalCode(ready, code) {
  await ready;
  return evalOnly(code).pattern;
}
/** The plain Strudel `code` reduces to, expanded in the browser (lib/dump.mjs). */
export async function expandCode(ready, code) {
  await ready;
  return dump(code, { modules: [strudel], Pattern: strudel.Pattern, evaluate: evalOnly });
}

/** Nav bar shared by both pages; `page` marks the current one. */
export function nav(page) {
  const link = (href, name) => `<a href="${href}" class="${page === name ? 'on' : ''}">${name}</a>`;
  return `<a class="brand" href="./">strudle</a>${link('./', 'Compose')}${link('examples.html', 'Examples')}<span class="status" id="status"></span>`;
}
