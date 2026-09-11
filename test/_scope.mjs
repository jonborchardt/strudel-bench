// Shared: build the Node strudel scope once and load lib/ into it.
import '../scripts/esm-fix.mjs';
export const ready = (async () => {
  const { evalScope } = await import('@strudel/core');
  const { miniAllStrings } = await import('@strudel/mini');
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'),
    { setcps: () => {}, setcpm: () => {}, setCps: () => {}, setCpm: () => {}, samples: async () => {}, hush: () => {} });
  miniAllStrings();
  await import('../lib/index.mjs');
  return globalThis;
})();
