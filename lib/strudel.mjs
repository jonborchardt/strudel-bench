// One place to reach Strudel in both hosts: the browser bundle exposes everything on `window.strudel`,
// Node has it on globalThis after evalScope. Never import @strudel/* from lib/.
export const S = globalThis.strudel ?? globalThis;
export const isPattern = (x) => !!x && typeof x.queryArc === 'function';
export const val = (x) => (isPattern(x) ? x : S.pure(x));
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** Whether the host has sample/synth `name` loaded (`hh:2` asks for `hh`); undefined in Node, where check.mjs keeps its own list. */
export const hasSound = (name) => { const m = S.soundMap?.get?.(); if (!m) return undefined; const n = String(name).split(':')[0]; return Object.hasOwn(m, n) || Object.hasOwn(m, n.toLowerCase()); };
