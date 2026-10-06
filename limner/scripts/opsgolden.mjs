// Writes test/fixtures/portrait-ops-golden.json: portraitOps for four portraits as it drew them on 2026-10-05, before
// `build` existed. A build of all 1 must draw these byte-for-byte; regenerate only on purpose: `node scripts/opsgolden.mjs --update`.
import { writeFileSync, existsSync } from 'node:fs';
import { portraitOps } from '../portrait.mjs';
const out = 'test/fixtures/portrait-ops-golden.json';
if (existsSync(out) && !process.argv.includes('--update')) { console.log(out + ' exists; pass --update to regenerate on purpose'); process.exit(1); }
export const CASES = { plain: {}, up: { props: ['handsUp'] }, skirt: { pants: { style: 'skirt' }, top: { style: 'tunic' }, jacket: { style: 'blazer' } }, tall: { face: { height: 230 }, neck: { height: 90 } } };
writeFileSync(out, JSON.stringify(Object.fromEntries(Object.entries(CASES).map(([k, o]) => [k, portraitOps(o)]))));
console.log('wrote', out);
