import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { lint } from '../scripts/lint.mjs';
import { checkFile } from '../scripts/check.mjs';

const sec = (name, role, layers, energy) => ({ name, role, energy, layers: Object.fromEntries(Object.entries(layers).map(([l, attrs]) => [l, { attrs, onsetsPerCycle: 1 }])) });

test('lint: the rules the skill states, as findings', () => {
  const out = lint({ sections: [
    sec('a', 'establish', { drums: { density: .3 } }, 2),
    sec('b', 'establish', { drums: { density: .3 } }, 2),
    sec('c', 'develop', { bass: { weight: .7 }, pad: { space: .6 }, melody: { density: 1.2, level: 3 } }, 9),
  ] });
  const texts = out.map((x) => `${x.level} ${x.section ?? ''} ${x.text}`);
  assert.ok(texts.some((t) => /no section has role climax/.test(t)), texts);
  assert.ok(texts.some((t) => /warn b identical to a/.test(t)), texts);
  assert.ok(texts.some((t) => /bass, pad, melody: raw saws/.test(t)), texts);
  assert.ok(texts.some((t) => /melody plays the seeded line/.test(t)) && texts.some((t) => /bass plays the seeded line/.test(t)), texts);
  assert.ok(texts.some((t) => /error c melody.density is 1.2/.test(t)), texts);
  assert.ok(texts.some((t) => /melody.level is 3/.test(t)), texts);
  const peak = lint({ sections: [sec('a', 'climax', { drums: { density: .3 } }, 2), sec('b', 'release', { drums: { density: .9 } }, 9)] });
  assert.ok(peak.some((x) => /most energetic section is b/.test(x.text)), JSON.stringify(peak));
  assert.deepEqual(lint({ sections: undefined, problems: [] }), [], 'plain strudel: nothing to say');
});

test('lint runs over a real song and only warns', async () => {
  const out = lint(await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel')));
  assert.ok(out.every((x) => x.level === 'warn'), JSON.stringify(out));
});
