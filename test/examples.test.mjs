// The examples page is data (web/examples.mjs): every entry has the fields the card renders, and every playable variant
// evaluates to a pattern with known sounds, so a broken example fails here instead of in the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GROUPS, PROGRESSIONS } from '../web/examples.mjs';
import { checkCode, ensureScope } from '../scripts/check.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

test('every example has the fields the card renders', () => {
  const ids = new Set();
  for (const g of GROUPS) {
    assert.ok(g.id && g.title && g.blurb && g.items.length, g.id);
    assert.ok(!ids.has(g.id), `duplicate group ${g.id}`); ids.add(g.id);
    for (const ex of g.items) {
      const at = `${g.id}/${ex.title}`;
      assert.ok(ex.title && ex.blurb && Array.isArray(ex.tags) && ex.tags.length, at);
      if (ex.svg) assert.match(ex.svg, /^<svg[\s\S]*<\/svg>\s*$/, `${at}: svg is an inline <svg>`);
      if (ex.stub) continue;
      assert.ok(ex.variants?.length, `${at}: variants`);
      for (const v of ex.variants) assert.ok(v.label && (typeof v.hll === 'string') !== (typeof v.src === 'string'), `${at}/${v.label}: hll or src`);
    }
  }
});

test('progression-syntax labels show the chord names check prints', async () => {
  await ensureScope();
  const { chordNames, parseProgression } = await import('../lib/harmony.mjs');
  assert.ok(PROGRESSIONS.length);
  for (const [key, p, names] of PROGRESSIONS) assert.equal(chordNames(key, parseProgression(p)), names, `${key} ${p}`);
});

test('every variant evaluates with known sounds, and an A/B actually differs', async () => {
  for (const g of GROUPS) for (const ex of g.items) if (!ex.stub) {
    const seen = []; // [label, event stream] per variant: a variant identical to an earlier one would be a silent A/A
    for (const v of ex.variants) {
      const code = v.hll ?? fs.readFileSync(path.join(ROOT, v.src), 'utf8');
      const at = `${g.id}/${ex.title}/${v.label}`;
      const { events, problems } = await checkCode(code, at);
      assert.deepEqual(problems, []);
      assert.ok(events.length, `${at}: no events`);
      const stream = events.join('\n');
      const same = seen.filter(([, s]) => s === stream).map(([l]) => l);
      if (v.alias) assert.ok(same.includes(seen.at(-1)[0]), `${at}: alias must equal the previous variant`); // a chain of aliases matches every earlier link too
      else assert.deepEqual(same, [], `${at}: identical to ${same.join(', ')}`);
      seen.push([v.label, stream]);
    }
  }
});
