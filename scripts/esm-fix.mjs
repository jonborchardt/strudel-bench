// @kabelsalat/web (pulled in by @strudel/core) ships no "exports" map, so Node picks its CommonJS
// build, which exposes no named exports and breaks `import { SalatRepl }`. Redirect to the ESM build.
// Import this before any (dynamic) import of @strudel/* in Node scripts.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === '@kabelsalat/web' ? '@kabelsalat/web/dist/index.mjs' : specifier, context);
  },
});
