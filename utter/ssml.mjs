// A spec object -> an SSML document for Azure AI Speech. Pure: no I/O beyond the voice snapshot voices.mjs loads.
// Text is escaped and every attribute is a value checked against PARAMS first, so nothing a caller passes can become
// markup or break out of an attribute.
import { VOICES } from './voices.mjs';

export const DEFAULT_VOICE = 'en-US-AndrewMultilingualNeural';

const RATE = /^([+-]\d{1,3}%|x-slow|slow|medium|fast|x-fast)$/;
const PITCH = /^([+-]\d+(\.\d+)?(st|%|Hz)|\d+(\.\d+)?Hz|x-low|low|medium|high|x-high)$/;
const VOLUME = /^([+-]\d+(\.\d+)?(dB|%)|silent|x-soft|soft|medium|loud|x-loud)$/;
const NAME = /^[A-Za-z0-9:._-]+$/; // voice names carry colons and dots (en-US-Ava:DragonHDLatestNeural, :MAI-Voice-2.1), styles underscores

/** Every parameter `ssmlOf` (and so `speak`) understands: its type, what a value must look like, where it lands in the SSML. */
export const PARAMS = {
  text: { type: 'string', ssml: 'body', about: 'What to say. Escaped, so & < > are spoken text. [400ms] or [1.5s] inside it is a pause.' },
  voice: { type: 'string', pattern: NAME, default: DEFAULT_VOICE, ssml: '<voice name>', about: 'An Azure voice name. Must be in the voices snapshot unless anyVoice is set.' },
  lang: { type: 'string', pattern: NAME, ssml: 'xml:lang', about: 'The document language, such as en-GB. Defaults to the voice\'s own locale.' },
  rate: { type: 'string', pattern: RATE, ssml: '<prosody rate>', about: 'Speaking rate: a signed percentage (-50% to +100% is the useful range) or x-slow, slow, medium, fast, x-fast.' },
  pitch: { type: 'string', pattern: PITCH, ssml: '<prosody pitch>', about: 'Baseline pitch: relative (+2st, -10%, +20Hz), absolute (220Hz) or x-low, low, medium, high, x-high. A nudge to the voice, not a musical note.' },
  volume: { type: 'string', pattern: VOLUME, ssml: '<prosody volume>', about: 'Level: relative (+6dB, -20%) or silent, x-soft, soft, medium, loud, x-loud.' },
  contour: { type: 'list', ssml: '<prosody contour>', about: 'Pitch over the utterance: [[position 0..100, pitch], ...], for example [[0, \'+0st\'], [100, \'+4st\']].' },
  style: { type: 'string', pattern: NAME, ssml: '<mstts:express-as style>', about: 'A speaking style (whispering, shouting, sad, ...). Only the styles the voices snapshot lists for the voice.' },
  styleDegree: { type: 'number', min: 0.01, max: 2, ssml: '<mstts:express-as styledegree>', about: 'How strongly the style is applied, 0.01 to 2. Needs style.' },
  role: { type: 'string', pattern: NAME, ssml: '<mstts:express-as role>', about: 'A role the voice can play (Girl, OlderAdultMale, ...). Only the roles the snapshot lists for the voice.' },
  segments: { type: 'list', ssml: '<prosody> spans', about: 'In place of text: [{ text, rate?, pitch?, volume? }, ...], spans of one utterance each with its own prosody.' },
  ssml: { type: 'string', ssml: 'the whole document', about: 'The escape hatch: a complete <speak> document, sent as written. Every other parameter is then ignored.' },
  anyVoice: { type: 'boolean', ssml: '(none)', about: 'Accept a voice name the snapshot does not list (a new voice, a custom one). Its styles are then not checked.' },
};

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const breaks = (s) => s.replace(/\[(\d+(?:\.\d+)?(?:ms|s))\]/g, '<break time="$1"/>');
const say = (text) => breaks(escape(text));

function checked(name, v) {
  const p = PARAMS[name];
  if (typeof v !== 'string' || !p.pattern.test(v)) throw new Error(`utter: ${name} ${JSON.stringify(v)} is not a valid value (${p.about})`);
  return v;
}

function contourOf(c) {
  if (!Array.isArray(c) || !c.length) throw new Error('utter: contour must be a list of [position, pitch] pairs');
  return c.map((pt) => {
    const [pos, pitch] = Array.isArray(pt) ? pt : [];
    if (!(typeof pos === 'number' && pos >= 0 && pos <= 100) || typeof pitch !== 'string' || !/^([+-]\d+(\.\d+)?(st|%|Hz)|\d+(\.\d+)?Hz)$/.test(pitch))
      throw new Error(`utter: contour point ${JSON.stringify(pt)} must be [position 0..100, pitch such as '+2st' or '220Hz']`);
    return `(${pos}%,${pitch})`;
  }).join(' ');
}

/** The prosody attributes of a spec or a segment, as ` rate="…" pitch="…"`, or '' when it sets none. */
function prosody(o) {
  let a = '';
  for (const k of ['rate', 'pitch', 'volume']) if (o[k] !== undefined) a += ` ${k}="${checked(k, o[k])}"`;
  if (o.contour !== undefined) a += ` contour="${contourOf(o.contour)}"`;
  return a;
}
const wrap = (attrs, inner) => (attrs ? `<prosody${attrs}>${inner}</prosody>` : inner);

/** The SSML document for a spec (see PARAMS). Throws, naming the parameter, on anything it would not send as written. */
export function ssmlOf(spec = {}) {
  for (const k of Object.keys(spec)) if (!PARAMS[k]) throw new Error(`utter: unknown parameter ${k} (known: ${Object.keys(PARAMS).join(', ')})`);
  if (spec.ssml !== undefined) {
    if (typeof spec.ssml !== 'string' || !/^\s*<speak[\s>]/.test(spec.ssml) || !/<\/speak>\s*$/.test(spec.ssml)) throw new Error('utter: ssml must be a complete <speak>…</speak> document');
    return spec.ssml;
  }
  const voice = checked('voice', spec.voice ?? DEFAULT_VOICE), known = VOICES.find((v) => v.name === voice);
  if (!known && !spec.anyVoice) throw new Error(`utter: voice ${voice} is not in the voices snapshot (list them with voices(), or pass anyVoice: true)`);
  const lang = spec.lang !== undefined ? checked('lang', spec.lang) : known?.locale ?? (/^[a-z]{2,3}-[A-Za-z]{2,4}/.exec(voice)?.[0] || 'en-US');

  let inner;
  if (spec.segments !== undefined) {
    if (!Array.isArray(spec.segments) || !spec.segments.length) throw new Error('utter: segments must be a non-empty list of { text, rate?, pitch?, volume? }');
    inner = spec.segments.map((seg) => {
      if (typeof seg?.text !== 'string' || !seg.text.trim()) throw new Error('utter: every segment needs text');
      for (const k of Object.keys(seg)) if (!['text', 'rate', 'pitch', 'volume'].includes(k)) throw new Error(`utter: a segment takes text, rate, pitch, volume; got ${k}`);
      return wrap(prosody(seg), say(seg.text));
    }).join(' ');
  } else {
    if (typeof spec.text !== 'string' || !spec.text.trim()) throw new Error('utter: nothing to say: give text, segments or ssml');
    inner = say(spec.text);
  }
  inner = wrap(prosody(spec), inner);

  if (spec.style !== undefined || spec.role !== undefined || spec.styleDegree !== undefined) {
    let a = '';
    if (spec.style !== undefined) {
      checked('style', spec.style);
      if (known && !known.styles.includes(spec.style)) throw new Error(`utter: voice ${voice} has no style ${spec.style} (it has: ${known.styles.join(', ') || 'none'})`);
      a += ` style="${spec.style}"`;
    }
    if (spec.styleDegree !== undefined) {
      const d = spec.styleDegree, { min, max } = PARAMS.styleDegree;
      if (spec.style === undefined || typeof d !== 'number' || !(d >= min && d <= max)) throw new Error(`utter: styleDegree must be a number ${min}..${max} alongside a style, got ${JSON.stringify(d)}`);
      a += ` styledegree="${d}"`;
    }
    if (spec.role !== undefined) {
      checked('role', spec.role);
      if (known && !known.roles.includes(spec.role)) throw new Error(`utter: voice ${voice} has no role ${spec.role} (it has: ${known.roles.join(', ') || 'none'})`);
      a += ` role="${spec.role}"`;
    }
    inner = `<mstts:express-as${a}>${inner}</mstts:express-as>`;
  }
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${voice}">${inner}</voice></speak>`;
}

/** The characters of a spec that are spoken (what Azure bills for, near enough): its text or its segments' text. */
export const charsOf = (spec) => (spec.ssml !== undefined ? spec.ssml.replace(/<[^>]*>/g, '').length : spec.segments ? spec.segments.map((s) => s.text).join(' ').length : (spec.text ?? '').length);
