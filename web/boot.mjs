// Shared page bootstrap: initStrudel with the local packs (or the Strudel CDN on GitHub Pages), lib/ loaded into
// the scope, and strudel's own error log routed to the caller. Both index.html and examples.html start here.
import { dump } from '../lib/dump.mjs';
import { packKind, registerSamples } from '../lib/packs.mjs';

/** The local packs this environment has (samples/user/packs.json): `{ name: { sounds, deploy, license } }`; on GitHub Pages only the deployed ones. */
export const localPacks = {};

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
        fetch('samples/user/packs.json').then((r) => (r.ok ? r.json() : {})).then((idx) => Object.assign(localPacks, idx)),
      ]);
      registerSamples(localPacks); // the packs' named sample definitions, so a part naming one resolves here as it does in the checker
      if (packs.includes('tidal-drum-machines')) strudel.aliasBank(local ? 'samples/packs/tidal-drum-machines-alias.json' : cdn.alias);
      await import('../lib/index.mjs');
      const user = Object.entries(localPacks).map(([n, p]) => `${n} (${packKind(p)})`);
      onStatus(`packs: ${packs.join(', ')}${local ? '' : ' (cdn)'}${user.length ? ` · local packs: ${user.join(', ')}` : ''}`);
    },
  });
  // surface strudel's own error log lines (e.g. "sound not found")
  document.addEventListener('strudel.log', (e) => { if (e.detail.type === 'error') onError(e.detail.message); });
  // superdough makes an orbit on its first hap, so a ducking hit (lib/song.mjs `duck`: duckorbit names the ducked part's
  // orbit) whose target has not sounded yet finds none ("duck target orbit n does not exist") and nothing ducks: make the
  // target on demand. On the controller's prototype, so the live scheduler, auditions, the Examples page and the controller
  // Compose rebuilds on its offline render context are all covered. [0, 1] is superdough's default channel pair.
  ready.then((r) => {
    // Hits are scheduled this far ahead of the clock. Strudel's 0.1 s is the gap a main-thread stall has to fit in before
    // the hits due in it are dropped, and querying a 13-part section costs the main thread bursts of 200-400 ms (Fraction
    // math in the pattern engine), so dense sections went silent under load. 0.3 s buys that slack at the price of an edit,
    // a knob or a section jump reaching the ears 0.3 s later.
    r.scheduler.latency = 0.3;
    const P = Object.getPrototypeOf(strudel.getSuperdoughAudioController()), duck = P.duck;
    if (!P.ducksOnDemand) { P.ducksOnDemand = true; P.duck = function (targets, ...rest) { for (const t of [targets].flat()) this.getOrbit(t, [0, 1]); return duck.call(this, targets, ...rest); }; }
  });
  return ready;
}

/** Evaluate and start playing `code`; song() files carry their tempo in metadata, bare layer patterns get the default. */
export async function playCode(ready, code) {
  await ready;
  const pat = await strudel.evaluate(code);
  setcps(pat?.strudel?.meta.cps ?? 0.5);
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

/** Nav bar shared by every page; `page` marks the current one. */
export function nav(page) {
  const link = (href, name, extra = '') => `<a href="${href}" class="${page === name ? 'on' : ''}"${extra}>${name}</a>`;
  // the sample workshop is local-only (it writes samples/user/), so it stays hidden until a page knows it has the server
  return `<a class="brand" href="./">strudel-bench</a>${link('./', 'Compose')}${link('examples.html', 'Examples')}${link('samples.html', 'Samples', ' hidden')}${link('about.html', 'About')}<span class="status" id="status"></span><span class="narrow" role="alert">Made for a desktop browser: this window is too narrow for the mix card and panes.</span>`;
}

/** Site footer shared by every page: author line, links, copyright. */
export function footer() {
  const links = [['GitHub', 'https://github.com/jonborchardt'], ['LinkedIn', 'https://www.linkedin.com/in/borchardt/'], ['YouTube', 'https://www.youtube.com/@JonathanBorchardt'], ['Blog', 'https://jonborchardt.github.io/blog/'], ['RSS', 'https://jonborchardt.github.io/blog/rss.xml']];
  return `<p><strong>Jonathan Borchardt</strong> · Always shippable, always improving</p>
<nav aria-label="links">${links.map(([n, h]) => `<a href="${h}" rel="me noopener">${n}</a>`).join('')}</nav>
<p class="muted">© ${new Date().getFullYear()} Jonathan Borchardt · Always Shippable · Views are my own and do not represent my employer. · <a href="legal.html">Legal &amp; Privacy</a></p>`;
}
