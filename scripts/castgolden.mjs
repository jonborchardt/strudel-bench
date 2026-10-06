// Writes test/fixtures/cast-golden.json: the editorial generator's output for fixed seeds. Run ONCE (it exists now);
// regenerate only on purpose, when a change to cast.mjs is meant to change the faces: `node scripts/castgolden.mjs --update`.
import { writeFileSync, existsSync } from 'node:fs';
import { characterOf, identityOf, ARCHETYPE_NAMES } from 'limner';
import { seed } from '../web/visual/kit.mjs';
import { prng } from '../lib/random.mjs';
const out = 'test/fixtures/cast-golden.json';
if (existsSync(out) && !process.argv.includes('--update')) { console.log(out + ' exists; pass --update to regenerate on purpose'); process.exit(1); }
const ROLES = ['establish', 'develop', 'climax', 'release'];
const crowd = [1, 2, 3, 7, 11, 42, 99, 1234].map((n) => { const s = {}; seed(s, prng(n)); return { seed: n, role: ROLES[n % 4], character: characterOf(s, ROLES[n % 4], (n % 4) / 3) }; });
const s = {}; seed(s, prng(7));
const cast = ARCHETYPE_NAMES.map((name, i) => identityOf(s, name, i));
writeFileSync(out, JSON.stringify({ crowd, cast }, null, 1));
console.log('wrote', out);
