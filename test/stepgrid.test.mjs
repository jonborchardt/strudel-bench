import test from 'node:test';
import assert from 'node:assert/strict';
import { gridRows, toggleStep, addVoice, templateText } from '../web/stepgrid.mjs';

test('gridRows reads a named or written template; toggleStep cycles a cell; templateText writes the literal back', () => {
  const rows = gridRows('house', 16);
  assert.deepEqual(rows.map((r) => r.voice), ['bd', 'sd', 'hh', 'oh', 'cp']);
  assert.equal(rows[0].grid, 'x...x...x...x...');
  // a named template is 16 steps for 4/4; a section in 6/8 (12 steps) must fit it first, not hand parseGrid a length it rejects
  const sixEight = gridRows('house', 12);
  assert.deepEqual(sixEight.map((r) => r.voice), ['bd', 'sd', 'hh', 'oh', 'cp']);
  assert.equal(sixEight[0].grid, 'x...x...x...');
  const w = gridRows({ bd: '2/4', rd: 'x.x.|X.x.' }, 4);
  assert.deepEqual(w, [{ voice: 'bd', grid: 'x.x.', bars: 1 }, { voice: 'rd', grid: 'x.x.X.x.', bars: 2 }]);
  let r = toggleStep(rows, 'bd', 1); assert.equal(r[0].grid, 'xx..x...x...x...');
  r = toggleStep(r, 'bd', 1); assert.equal(r[0].grid, 'xX..x...x...x...');
  r = toggleStep(r, 'bd', 1); assert.equal(r[0].grid, 'xo..x...x...x...');
  r = toggleStep(r, 'bd', 1); assert.equal(r[0].grid, 'x...x...x...x...');
  assert.equal(templateText(gridRows({ bd: 'x...', sd: '..x.' }, 4)), `{ bd: 'x...', sd: '..x.' }`);
  assert.equal(templateText(w), `{\n      bd: 'x.x.',\n      rd: 'x.x.|X.x.',\n    }`, 'multi-bar: one voice per line, bars separated');
  assert.deepEqual(addVoice(w, 'cb', 4).at(-1), { voice: 'cb', grid: '....', bars: 1 });
  assert.throws(() => addVoice(w, 'bd', 4), /already/);
});
