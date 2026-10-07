// Two packs registering the same name in the same registry do not fail: the later import silently replaces the earlier
// part, for every cast that wears it. Found twice when the future casts landed (a wasteland war paint over the fantasy
// one the orcs wear, steampunk goggles over the gnomes'). Each pack exports one table of its own names by kind, named
// for the pack (`PUNK` in parts/punk.mjs), which is what this reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACKS } from '../registry.mjs';

test('no two packs register the same part name in the same kind', () => {
  const owner = {}, clashes = [];
  for (const [pack, mod] of Object.entries(PACKS)) {
    const table = mod[pack.toUpperCase()];
    assert.ok(table, `${pack} exports a table of its own names by kind`);
    for (const [kind, names] of Object.entries(table)) for (const n of names) {
      const k = `${kind}:${n}`;
      if (owner[k] && owner[k] !== pack) clashes.push(`${k} (${owner[k]} and ${pack})`);
      owner[k] = pack;
    }
  }
  assert.deepEqual(clashes, [], 'a later pack would replace the earlier one\'s part for everyone');
});
