// One place to reach Strudel in both hosts: the browser bundle exposes everything on `window.strudel`,
// Node has it on globalThis after evalScope. Never import @strudel/* from lib/.
export const S = globalThis.strudel ?? globalThis;
export const isPattern = (x) => !!x && typeof x.queryArc === 'function';
export const val = (x) => (isPattern(x) ? x : S.pure(x));
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
