// The thriller theme, as it was one file. Its three halves now live on either side of the package boundary: the zombie
// parts and the undead cast are limner's (reached through its PACKS and CAST_MODULES registries, so nothing here
// reaches past the published surface), the dance is this repo's, and themes.mjs binds them. Importing this module
// registers and tags the zombie parts, which is the side effect web/visual/undead.mjs wants.
import { PACKS, CAST_MODULES, CASTS } from './limner.mjs';
import { THEMES } from './themes.mjs';

const { undead: parts, eighties } = PACKS;
const cast = CAST_MODULES.undead;

export const { DEAD_EYES, EXTRA_MARKS, UNDEAD, ZOMBIE_MAKEUP, ZOMBIE_MARKS, ZOMBIE_PROPS, ZOMBIE_SKINS, claw } = parts;
export const { EIGHTIES, NEON } = eighties;
export const { ZOMBIES, ZOMBIE_COSTUMES, ZOMBIE_COSTUME_NAMES, ZOMBIE_EXPRESSIONS, ZOMBIE_NAMES } = cast;
export const UNDEAD_CAST = CASTS.undead;
export * from './dances/thriller.mjs';
export { THEMES };
export default THEMES.thriller;
