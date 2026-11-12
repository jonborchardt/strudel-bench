// The committed snapshot of Azure's voice list (name, locale, gender, styles, roles), so a voice or a style can be
// validated and listed without a network call. Refreshed on purpose: node scripts/voices.mjs --refresh.
import fs from 'node:fs';

export const VOICES = JSON.parse(fs.readFileSync(new URL('./voices.json', import.meta.url), 'utf8'));

/** The snapshot's voices matching every filter given: `locale` ('en-GB'), `gender` ('Female'), `style` ('whispering'). */
export const voices = ({ locale, gender, style } = {}) => VOICES.filter((v) =>
  (!locale || v.locale === locale) && (!gender || v.gender.toLowerCase() === gender.toLowerCase()) && (!style || v.styles.includes(style)));
