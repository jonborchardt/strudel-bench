// The one place web/ crosses into limner, and it crosses to the package's published entry.
//
// It reaches it by path rather than by the bare specifier `limner`, because this code runs in three places and only one
// of them can resolve a bare name. Node resolves it through the `file:./limner` dependency; a browser resolves it only
// through the document's import map; and a module Worker has its own realm and **cannot be given that map at all** --
// there is no API for it. web/listen/ loads every world inside a worker, so a bare specifier in a world is unresolvable
// there by construction, not by omission, and the failure is silent: the world's tile simply stays blank.
//
// A path import is not a hole in the interface. `exports` governs bare specifiers, and what it protects is the
// *surface*, not the spelling: this reaches index.mjs, the published barrel, exactly as `import 'limner'` does, and
// resolves to the same module instance, so the part registries stay single. Reaching past the barrel -- into
// portrait.mjs or people.mjs directly -- is what the registry guard in test/pages.test.mjs forbids.
export * from '../../limner/index.mjs';
