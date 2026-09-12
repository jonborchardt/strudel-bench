// Generates the skill's vocabulary reference from code so it cannot drift. usage: node scripts/vocab.mjs > .claude/skills/strudle/reference/vocab.md
import { AXES, PHASES, cells } from '../lib/axes.mjs';
import { DESCRIPTORS, OVERLAYS, MODIFIERS, HARMONY } from '../lib/vocab.mjs';
import '../lib/layers.mjs';

const out = [];
out.push('# strudle vocabulary (generated, do not edit)\n');
out.push('## Axes (0..1, 0.5 = layer baseline)\n');
out.push('| axis | kind | meaning | verification |', '|---|---|---|---|');
for (const a of AXES) out.push(`| ${a.name} | ${a.kind} | ${a.meaning} | ${a.verify.class}${a.verify.metric ? ': ' + a.verify.metric : ''} |`);
out.push('\n## Adapter cells (what each axis does per layer at 0.2 / 0.8)\n');
const layers = Object.keys(cells);
out.push(`| axis | ${layers.join(' | ')} |`, `|---|${layers.map(() => '---').join('|')}|`);
for (const a of AXES) out.push(`| ${a.name} | ${layers.map((L) => { const c = cells[L][a.name]; return c ? `${c.describe?.(0.5, 0.2) ?? 'yes'} / ${c.describe?.(0.5, 0.8) ?? 'yes'}` : '—'; }).join(' | ')} |`);
out.push(`\nPhases: ${PHASES.join(' → ')}\n`);
out.push('## Descriptors (deltas)\n');
for (const [k, v] of Object.entries(DESCRIPTORS)) out.push(`- **${k}**: ${Object.entries(v).map(([a, d]) => `${a} ${d >= 0 ? '+' : ''}${d}`).join(', ')}`);
out.push('\n## Overlays (emotion/genre, low confidence)\n');
for (const [k, v] of Object.entries(OVERLAYS)) out.push(`- **${k}**: ${Object.entries(v).map(([a, d]) => `${a} ${d >= 0 ? '+' : ''}${d}`).join(', ')}`);
out.push(`\n## Modifiers\n\n${Object.entries(MODIFIERS).map(([k, v]) => `${k} ×${v}`).join(', ')}; "less X" negates.`);
out.push('\n## Harmony words (states, not deltas; modifiers ignored)\n');
out.push('Write `key` and `progression` on the section. Numerals are diatonic to the section key; one chord per cycle; default `i VI`.\n');
for (const [k, v] of Object.entries(HARMONY.progressions)) out.push(`- **${k}**: ${v}`);
out.push(`- modes: ${HARMONY.modes.join(', ')} (keep the root, swap the mode)`);
out.push('- **relative**: relative major/minor of the current key; `relative major` = relative key then that mode');
out.push('- not modeled: accidentals, sevenths, borrowed chords, sub-cycle changes. Use a different section key (e.g. `C:harmonic minor`).');
console.log(out.join('\n'));
