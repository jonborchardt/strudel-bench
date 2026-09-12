// Shared: build the Node strudel scope once and load lib/ into it.
import { ensureScope } from '../scripts/check.mjs';
export const ready = ensureScope().then(() => globalThis);
