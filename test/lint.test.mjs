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
  // the check table prints a list or weights sound as JSON: a raw saw inside one still counts
  const lists = lint({ sections: [sec('a', 'climax', { bass: { sound: '["sawtooth","square"]' }, melody: { sound: '{"saw":2,"piano":1}' }, pad: { sound: 'piano' } }, 2)] });
  assert.ok(lists.some((x) => /bass, melody: raw saws/.test(x.text)), JSON.stringify(lists));
  assert.ok(texts.some((t) => /melody plays the seeded line/.test(t)) && texts.some((t) => /bass plays the seeded line/.test(t)), texts);
  assert.ok(texts.some((t) => /error c melody.density is 1.2/.test(t)), texts);
  assert.ok(texts.some((t) => /melody.level is 3/.test(t)), texts);
  const peak = lint({ sections: [sec('a', 'climax', { drums: { density: .3 } }, 2), sec('b', 'release', { drums: { density: .9 } }, 9)] });
  assert.ok(peak.some((x) => /most energetic section is b/.test(x.text)), JSON.stringify(peak));
  assert.deepEqual(lint({ sections: undefined, problems: [] }), [], 'plain strudel: nothing to say');
});

test('lint: a load warning for a per-hit compressor on a dense part; density alone warns nothing', () => {
  const L = (attrs, onsetsPerCycle) => ({ attrs, onsetsPerCycle });
  const out = lint({ sections: [{ name: 'drop', role: 'climax', energy: 70, layers: { drums: L({ compressor: { threshold: -24 }, notes: 'x' }, 50), bass: L({ notes: '0', compressor: { threshold: -18 } }, 4), pad: L({}, 12), melody: L({ notes: '0' }, 11), perc: L({}, 3) } }] });
  const t = out.map((x) => x.text);
  assert.ok(t.some((s) => /^drums\.compressor is applied per hit \(50 a bar/.test(s)), t);
  assert.ok(!t.some((s) => /^bass\.compressor/.test(s)), 'four hits a bar is fine');
  assert.ok(!t.some((s) => /hits a bar/.test(s)), 'density alone is not a load warning: the dropouts were convolvers per part, fixed in song()');
  const V = (attrs, voices) => ({ attrs, onsetsPerCycle: 4, voices });
  const crowded = lint({ sections: [{ name: 'peak', role: 'climax', energy: 30, voices: 52, layers: { pad: V({}, 13), pad2: V({}, 13), pad3: V({}, 10), bass: V({ notes: '0' }, 1), drums: V({}, 2), melody: V({ notes: '0' }, 13) } }] });
  assert.ok(crowded.some((x) => /^~52 voices sounding at once \(pad 13, pad2 13, melody 13\)/.test(x.text)), JSON.stringify(crowded));
  assert.ok(!lint({ sections: [{ name: 'a', role: 'climax', energy: 20, voices: 30, layers: { pad: V({}, 30) } }] }).some((x) => /voices/.test(x.text)), 'thirty is fine');
  const light = lint({ sections: [{ name: 'a', role: 'climax', energy: 20, layers: { drums: L({ notes: 'x' }, 20), bass: L({ notes: '0' }, 4) } }] });
  assert.ok(!light.some((x) => /compressor/.test(x.text)), JSON.stringify(light));
});

test('lintMeasure: headroom, inaudible and dominant parts, a flat stage, masking pairs and no depth contrast', async () => {
  const { lintMeasure } = await import('../scripts/lint.mjs');
  const row = (name, relativeDb, more = {}) => ({ name, relativeDb, highRatio: .1, tail: .2, meanPan: .5, panStd: 0, depth: .4, peak: .5, ...more });
  const grazed = lintMeasure({ section: 'a', parts: [row('mix', -6, { peak: 1, clipped: .00002 }), row('bass', -8)] });
  assert.ok(grazed.length === 1 && /^transients touch full scale \(0\.002%/.test(grazed[0].text), JSON.stringify(grazed));
  const out = lintMeasure({ section: 'a', parts: [row('mix', -6, { peak: .99, clipped: .01 }), row('bass', -8), row('pad', -9), row('melody', -10), row('perc', -35), row('fx', -1)],
    pairs: [{ a: 'bass', b: 'pad', low: .62, mid: .2, high: 0 }, { a: 'pad', b: 'melody', low: 0, mid: .7, high: .1 }, { a: 'bass', b: 'melody', low: .1, mid: .1, high: 0 }] });
  const t = out.map((x) => x.text);
  assert.ok(out.every((x) => x.level === 'warn' && x.section === 'a'));
  assert.ok(t.some((s) => /^no headroom: the mix peaks at 0.99 \(-6 dBFS\), 1.00% of samples clip/.test(s)), t);
  assert.ok(t.some((s) => /^perc is inaudible/.test(s)), t);
  assert.ok(t.some((s) => /^fx dominates/.test(s)), t);
  assert.ok(t.some((s) => /^flat stage: pad, melody, fx/.test(s)), t);
  assert.ok(t.some((s) => /^bass and pad share the low band \(masking 0.62\)/.test(s)), t);
  assert.ok(t.some((s) => /^pad and melody share the mids/.test(s)) && !t.some((s) => /bass and melody/.test(s)), t);
  assert.ok(t.some((s) => /^no depth contrast: bass 0.4, pad 0.4, melody 0.4, fx 0.4 .*\(the same brightness\)/.test(s)), t); // levels spread 7 dB (fx at -1), so brightness is the component they share
  const fine = lintMeasure({ section: 'b', parts: [row('mix', -6), row('bass', -8), row('pad', -14, { meanPan: .3, depth: .6 }), row('melody', -9, { meanPan: .6, depth: .2 }), row('pad2', -12, { width: .5, depth: .4 }), row('fx', -20, { depth: .5, meanPan: .5 })], pairs: [{ a: 'bass', b: 'pad', low: .2, mid: .1, high: 0 }] });
  assert.deepEqual(fine, [], `a wide pad at centre is not a flat stage: ${JSON.stringify(fine)}`);
  const oneSide = lintMeasure({ section: 'c', parts: [row('mix', -6, { peak: .6, clipped: .01 }), row('bass', -8)] });
  assert.ok(oneSide.some((x) => /^no headroom/.test(x.text)), `one channel clipping under a tame mono peak: ${JSON.stringify(oneSide)}`);
});

test('lint runs over a real song and only warns', async () => {
  const out = lint(await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel')));
  assert.ok(out.every((x) => x.level === 'warn'), JSON.stringify(out));
});

test('lint: static audibility from the sample meta, and a sub-audible lowest note', () => {
  const P = (attrs, sounds, minNote = Infinity) => ({ attrs, onsetsPerCycle: 2, voices: 1, sounds, minNote });
  const out = lint({ sections: [{ name: 'drop', role: 'climax', energy: 20, voices: 10, layers: {
    drums: P({}, [{ name: 'bd', n: 0, rms: -12 }, { name: 'hh', n: 0, rms: -30 }]),
    melody: P({ notes: '0', level: 1.6 }, [{ name: 'marimba', n: 0, rms: -58 }], 62), // -54 on paper: 42 under the kit
    melody2: P({ notes: '0', level: .5 }, [{ name: 'kalimba', n: 0, rms: -33 }], 62), // -39: 27 under, fine
    pad: P({}, [{ name: 'sawtooth', n: 0 }]), // a synth: unmeasured, never compared
    bass: P({ notes: '0' }, [{ name: 'pipeorgan_loud_pedal', n: 0, rms: -21 }], 14), // D0
  } }] }).map((x) => x.text);
  assert.ok(out.some((t) => /^melody plays marimba:0 \(rms -58 dBFS\) at level 1\.6: about 42 dB under the loudest part/.test(t)), out);
  assert.ok(!out.some((t) => /^melody2 plays/.test(t)), 'kalimba at .5 is 27 dB under: heard');
  assert.ok(!out.some((t) => /^pad plays/.test(t)), 'a synth has no meta and is not judged');
  assert.ok(out.some((t) => /^bass reaches midi 14 \(18 Hz\)/.test(t)), out);
  assert.ok(!out.some((t) => /^melody reaches/.test(t)), 'D4 is a note');
  const sub = lint({ sections: [{ name: 'a', role: 'climax', energy: 2, voices: 1, layers: { bass: P({ notes: '0' }, [{ name: 'sawtooth', n: 0 }], 24) } }] });
  assert.ok(!sub.some((x) => /reaches midi/.test(x.text)), 'C1 (33 Hz) is a normal synth sub');
});
