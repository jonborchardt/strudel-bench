// The voices snapshot. With no flag it lists what voices.json holds; --refresh rewrites it from Azure's live list.
// usage: node scripts/voices.mjs [--locale en-GB] [--gender Female] [--style whispering] [--refresh]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { voices } from '../voices.mjs';

const { values: o } = parseArgs({ options: { refresh: { type: 'boolean' }, locale: { type: 'string' }, gender: { type: 'string' }, style: { type: 'string' } } });

if (o.refresh) {
  // the one place outside the worker that needs the key: a script run by hand, never imported by the package
  const env = { ...process.env };
  for (let d = process.cwd(); !env.AZURE_SPEECH_REGION || !env['AZURE_SPEECH_' + 'KEY']; d = path.dirname(d)) {
    const f = path.join(d, '.env');
    if (fs.existsSync(f)) { Object.assign(env, parseEnv(fs.readFileSync(f, 'utf8')), process.env); break; }
    if (d === path.dirname(d)) break;
  }
  const key = env['AZURE_SPEECH_' + 'KEY'], region = env.AZURE_SPEECH_REGION;
  if (!key || !region) { console.error('utter needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (.env or the environment)'); process.exit(1); }
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, { headers: { 'Ocp-Apim-Subscription-Key': key } });
  if (!res.ok) { console.error(`voices list failed: ${res.status} ${res.statusText}`); process.exit(1); }
  const all = await res.json();
  // English locales and every multilingual voice: what a song in this repo would reach for, and a file small enough to commit
  const kept = all.filter((v) => /^en-/.test(v.Locale) || /Multilingual/.test(v.ShortName))
    .map((v) => ({ name: v.ShortName, locale: v.Locale, gender: v.Gender, styles: v.StyleList ?? [], roles: v.RolePlayList ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const out = new URL('../voices.json', import.meta.url);
  fs.writeFileSync(out, '[\n' + kept.map((v) => ' ' + JSON.stringify(v)).join(',\n') + '\n]\n');
  console.log(`voices.json: ${kept.length} of ${all.length} voices (en-* and multilingual)`);
} else {
  const rows = voices(o);
  for (const v of rows) console.log(`${v.name.padEnd(44)} ${v.locale.padEnd(7)} ${v.gender.padEnd(7)} ${v.styles.join(' ')}${v.roles.length ? '  roles: ' + v.roles.join(' ') : ''}`);
  console.log(`${rows.length} voices`);
}
