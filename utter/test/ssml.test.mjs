// The SSML builder: every parameter reaches the document as a validated attribute or as escaped text, never as markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ssmlOf, PARAMS, DEFAULT_VOICE } from '../ssml.mjs';
import { voices } from '../voices.mjs';

const HEAD = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="en-US-AndrewMultilingualNeural">';
const TAIL = '</voice></speak>';
const body = (spec) => { const s = ssmlOf(spec); assert.ok(s.startsWith(HEAD) && s.endsWith(TAIL), s); return s.slice(HEAD.length, -TAIL.length); };
const styled = voices({}).find((v) => v.styles.length); // any voice in the snapshot that has a style

test('plain text: the default voice, its locale, and no prosody element', () => {
  assert.equal(DEFAULT_VOICE, 'en-US-AndrewMultilingualNeural');
  assert.equal(ssmlOf({ text: 'hi' }), HEAD + 'hi' + TAIL);
});

test('prosody keys share one element', () => {
  assert.equal(body({ text: 'hi', rate: '-10%' }), '<prosody rate="-10%">hi</prosody>');
  assert.equal(body({ text: 'hi', rate: '-10%', pitch: '+2st', volume: '+6dB', contour: [[0, '+0st'], [100, '+4st']] }),
    '<prosody rate="-10%" pitch="+2st" volume="+6dB" contour="(0%,+0st) (100%,+4st)">hi</prosody>');
});

test('text is escaped, so markup characters are spoken text', () => {
  assert.equal(body({ text: 'Tom & "Jerry" <now>' }), 'Tom &amp; "Jerry" &lt;now&gt;');
});

test('a bad attribute value is refused by name and can never carry a quote', () => {
  assert.throws(() => ssmlOf({ text: 'x', rate: '"+10%' }), /rate/);
  assert.throws(() => ssmlOf({ text: 'x', pitch: '2 semitones' }), /pitch/);
  assert.throws(() => ssmlOf({ text: 'x', volume: 'loudest' }), /volume/);
  assert.throws(() => ssmlOf({ text: 'x', voice: 'x" onload="', anyVoice: true }), /voice/);
  assert.throws(() => ssmlOf({ text: 'x', lang: 'en"US' }), /lang/);
  assert.throws(() => ssmlOf({ text: 'x', contour: [[0, 'up']] }), /contour/);
  assert.throws(() => ssmlOf({ text: 'x', contour: [[140, '+1st']] }), /contour/);
  assert.throws(() => ssmlOf({ text: 'x', speed: 2 }), /speed/, 'an unknown parameter is named, not ignored');
});

test('a voice outside the snapshot is refused unless anyVoice', () => {
  assert.throws(() => ssmlOf({ text: 'x', voice: 'en-ZZ-NobodyNeural' }), /en-ZZ-NobodyNeural/);
  assert.match(ssmlOf({ text: 'x', voice: 'en-ZZ-NobodyNeural', anyVoice: true }), /<voice name="en-ZZ-NobodyNeural">x<\/voice>/);
});

test('style only on a voice that has it', () => {
  assert.ok(styled, 'the snapshot holds at least one styled voice');
  const s = ssmlOf({ text: 'x', voice: styled.name, style: styled.styles[0], styleDegree: 1.5 });
  assert.ok(s.includes(`<mstts:express-as style="${styled.styles[0]}" styledegree="1.5">x</mstts:express-as>`), s);
  assert.throws(() => ssmlOf({ text: 'x', voice: styled.name, style: 'no-such-style' }), new RegExp(styled.name));
  assert.throws(() => ssmlOf({ text: 'x', voice: styled.name, style: styled.styles[0], styleDegree: 3 }), /styleDegree/);
  assert.throws(() => ssmlOf({ text: 'x', voice: styled.name, style: styled.styles[0], styleDegree: 0 }), /styleDegree/);
});

test('every voice, style and role in the snapshot is accepted as written', () => {
  for (const v of voices({})) {
    assert.ok(ssmlOf({ text: 'x', voice: v.name }).includes(`<voice name="${v.name}">`), v.name);
    for (const style of v.styles) ssmlOf({ text: 'x', voice: v.name, style });
    for (const role of v.roles) ssmlOf({ text: 'x', voice: v.name, role });
  }
});

test('inline breaks', () => {
  assert.equal(body({ text: 'wait [400ms] now' }), 'wait <break time="400ms"/> now');
  assert.equal(body({ text: 'wait [1.5s] now' }), 'wait <break time="1.5s"/> now');
  assert.equal(body({ text: 'wait [400] now' }), 'wait [400] now');
});

test('segments: per-span prosody inside one voice', () => {
  assert.equal(body({ segments: [{ text: 'hold', pitch: '+3st' }, { text: 'on' }] }), '<prosody pitch="+3st">hold</prosody> on');
  assert.throws(() => ssmlOf({ segments: [{ text: 'hold', pitch: 'high-ish' }] }), /pitch/);
  assert.throws(() => ssmlOf({ segments: [{ pitch: '+1st' }] }), /text/);
});

test('ssml is the escape hatch, verbatim', () => {
  const doc = '<speak version="1.0" xml:lang="en-US"><voice name="x">y</voice></speak>';
  assert.equal(ssmlOf({ ssml: doc }), doc);
  assert.throws(() => ssmlOf({ ssml: 'hello' }), /ssml/);
});

test('nothing to say is an error', () => {
  assert.throws(() => ssmlOf({}), /text/);
  assert.throws(() => ssmlOf({ text: '   ' }), /text/);
});

test('every parameter documents itself', () => {
  for (const [name, p] of Object.entries(PARAMS)) for (const k of ['type', 'ssml', 'about']) assert.equal(typeof p[k], 'string', `${name}.${k}`);
  for (const name of ['text', 'voice', 'lang', 'rate', 'pitch', 'volume', 'contour', 'style', 'styleDegree', 'role', 'segments', 'ssml', 'anyVoice']) assert.ok(PARAMS[name], name);
});

test('voices filters the snapshot', () => {
  const us = voices({ locale: 'en-US' });
  assert.ok(us.length && us.every((v) => v.locale === 'en-US'));
  assert.ok(voices({}).some((v) => v.name === DEFAULT_VOICE));
  assert.ok(voices({ style: styled.styles[0] }).every((v) => v.styles.includes(styled.styles[0])));
});
