// A canvas that counts the calls made on it, so a test can assert the drawing happened without a canvas to draw on.
// Copied from the host's test/_visual.mjs rather than shared: a library does not reach into its consumer's helpers.
export const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
