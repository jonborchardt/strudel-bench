// test/fixtures/thriller-state.json: the tableau's whole state after 8 s of the test song with theme thriller. Captured
// before the theme file was split (2026-10-05) so the split is proved pure, and re-captured the same day when the
// closing shot was fixed to style the people it actually holds (its two stylings and the stream after them moved, the
// cast and every other shot stayed); regenerate only on purpose with --update, and diff the state before you do.
import { writeFileSync, existsSync } from 'node:fs';
import tableau from '../web/visual/tableau.mjs';
import { ready } from '../test/_scope.mjs';
import { run } from '../test/_visual.mjs';
const out = 'test/fixtures/thriller-state.json';
if (existsSync(out) && !process.argv.includes('--update')) { console.log(out + ' exists; pass --update'); process.exit(1); }
const g = await ready;
const ir = g.song({ cps: .5, key: 'C:minor', seed: 3, visual: { world: 'tableau', theme: 'thriller' } }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' } }),
]).strudel;
writeFileSync(out, JSON.stringify(run(tableau, ir, 8).state));
console.log('wrote', out);
