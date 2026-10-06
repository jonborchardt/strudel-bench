// Every cast and every part pack, by name. Importing this module registers and tags every part, which is what lets a
// cast's `pools` ask for them by tag: the quarantine is a pool, not a separate registry, so a part tagged `only:undead`
// reaches a generator only when a pool names it.
//
// The order of the two maps is the registration order, and a name collision between two packs resolves by it, so these
// lists are not to be sorted.
import * as eighties from './parts/eighties.mjs';
import * as undeadPack from './parts/undead.mjs';
import * as dwarf from './parts/dwarf.mjs';
import * as elf from './parts/elf.mjs';
import * as fantasy from './parts/fantasy.mjs';
import * as orcPack from './parts/orc.mjs';
import * as halflingPack from './parts/halfling.mjs';
import * as gnomePack from './parts/gnome.mjs';
import * as tieflingPack from './parts/tiefling.mjs';
import * as dragonbornPack from './parts/dragonborn.mjs';
import * as editorialMod from './casts/editorial.mjs';
import * as undeadMod from './casts/undead.mjs';
import * as dwarvesMod from './casts/dwarves.mjs';
import * as elvesMod from './casts/elves.mjs';
import * as humansMod from './casts/humans.mjs';
import * as orcsMod from './casts/orcs.mjs';
import * as halflingsMod from './casts/halflings.mjs';
import * as gnomesMod from './casts/gnomes.mjs';
import * as tieflingsMod from './casts/tieflings.mjs';
import * as dragonbornMod from './casts/dragonborn.mjs';
import editorial from './casts/editorial.mjs';
import undead from './casts/undead.mjs';
import dwarves from './casts/dwarves.mjs';
import elves from './casts/elves.mjs';
import humans from './casts/humans.mjs';
import orcs from './casts/orcs.mjs';
import halflings from './casts/halflings.mjs';
import gnomes from './casts/gnomes.mjs';
import tieflings from './casts/tieflings.mjs';
import dragonborn from './casts/dragonborn.mjs';

export const PACKS = { eighties, undead: undeadPack, dwarf, elf, fantasy, orc: orcPack, halfling: halflingPack, gnome: gnomePack, tiefling: tieflingPack, dragonborn: dragonbornPack };
export const CASTS = { editorial, undead, dwarves, elves, humans, orcs, halflings, gnomes, tieflings, dragonborn };

/** The cast modules themselves, so a host can reach one cast's own constants -- the elves' ear range, a build, a costume
 * table -- the way it reaches a pack's through PACKS. CASTS carries the cast objects a theme binds; this carries
 * everything beside them. Both are published, because the sheets (casts.html, parts.html) show exactly this. */
export const CAST_MODULES = { editorial: editorialMod, undead: undeadMod, dwarves: dwarvesMod, elves: elvesMod, humans: humansMod, orcs: orcsMod, halflings: halflingsMod, gnomes: gnomesMod, tieflings: tieflingsMod, dragonborn: dragonbornMod };
