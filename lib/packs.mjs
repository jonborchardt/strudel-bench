// Local sample packs (samples/user/<pack>/) as a song sees them. Shared by the checker, the Pages build and the page.

/**
 * Packs a song declares: `packs: ['a', 'b']` in its song() header, or the same text in a comment for plain
 * Strudel files (a comment line reading packs: ['a']). Packs the song does not declare are not available to it, even locally.
 */
export const packsOf = (src) => [...(src.match(/packs:\s*\[([^\]]*)\]/)?.[1].matchAll(/['"]([^'"]+)['"]/g) ?? [])].map((m) => m[1]);

/** What a pack is in this environment: 'deployed' ships with the site, 'local' stays on this machine, 'missing' is declared but not here. */
export const packKind = (pack) => (!pack ? 'missing' : pack.deploy ? 'deployed' : 'local');
