// Shared page bootstrap: initStrudel with the local packs (or the Strudel CDN on GitHub Pages), lib/ loaded into
// the scope, and strudel's own error log routed to the caller. Both index.html and examples.html start here.
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
      if (packs.includes('tidal-drum-machines')) strudel.aliasBank(local ? 'samples/packs/tidal-drum-machines-alias.json' : cdn.alias);
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

/** Nav bar shared by both pages; `page` marks the current one. */
export function nav(page) {
  const link = (href, name) => `<a href="${href}" class="${page === name ? 'on' : ''}">${name}</a>`;
  return `<a class="brand" href="./">strudle</a>${link('./', 'Compose')}${link('examples.html', 'Examples')}<span class="status" id="status"></span>`;
}
