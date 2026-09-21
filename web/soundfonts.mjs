// The General MIDI soundfonts (`gm_*`: guitars, basses, winds, strings...) as superdough sounds, streamed from the
// same webaudiofont data strudel.cc uses. This is @strudel/soundfonts' fontloader.mjs over the page's `strudel`
// global: the package imports @strudel/core and @strudel/webaudio as modules, which would be a second copy of
// superdough with its own sound map, so the UMD bundle would never see what it registered. The name list is the
// package's own gm.mjs (pure data, also read by lib/packs.mjs so the check knows the names).
import gm from '../node_modules/@strudel/soundfonts/gm.mjs';

const FONTS = 'https://felixroos.github.io/webaudiofontdata/sound';
const fonts = {}, buffers = {};

const loadFont = (name) => (fonts[name] ??= fetch(`${FONTS}/${name}.js`).then((r) => r.text()).then((js) => eval('{' + js.split('={')[1])));

// the decoded sample for one preset at one pitch; an AudioBuffer is not bound to a context, so a live decode serves the offline render too
function fontPitch(name, midi, ac) {
  return (buffers[`${name}:${midi}`] ??= loadFont(name).then(async (preset) => {
    const zone = preset.find((z) => z.keyRangeLow <= midi && z.keyRangeHigh + 1 >= midi);
    if (!zone) throw new Error(`soundfont ${name}: no zone for midi ${midi}`);
    const bytes = Uint8Array.from(atob(zone.file), (c) => c.charCodeAt(0));
    return { buffer: await ac.decodeAudioData(bytes.buffer), zone };
  }));
}

export function registerSoundfonts(S = globalThis.strudel) {
  for (const [name, presets] of Object.entries(gm)) {
    S.registerSound(name, async (time, value, onended) => {
      const [attack, decay, sustain, release] = S.getADSRValues([value.attack, value.decay, value.sustain, value.release]);
      const ac = S.getAudioContext(), font = presets[S.getSoundIndex(value.n, presets.length)];
      const midi = value.freq ? S.freqToMidi(value.freq) : typeof value.note === 'string' ? S.noteToMidi(value.note) : value.note ?? 48;
      const { buffer, zone } = await fontPitch(font, midi, ac);
      const src = ac.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = 2 ** ((100 * midi - (zone.originalPitch - 100 * zone.coarseTune - zone.fineTune)) / 1200);
      if (zone.loopStart > 1 && zone.loopStart < zone.loopEnd) { src.loop = true; src.loopStart = zone.loopStart / zone.sampleRate; src.loopEnd = zone.loopEnd / zone.sampleRate; }
      src.start(time);
      const env = ac.createGain(), node = src.connect(env), holdEnd = time + value.duration;
      S.getParamADSR(node.gain, attack, decay, sustain, release, 0, 0.3, time, holdEnd, 'linear');
      const vibrato = S.getVibratoOscillator(src.detune, value, time);
      S.getPitchEnvelope(src.detune, value, time, holdEnd);
      src.stop(holdEnd + release + 0.01);
      S.onceEnded(src, () => { S.releaseAudioNode(src); vibrato?.stop(); onended(); });
      return { node, stop: () => {}, nodes: { source: [src], ...vibrato?.nodes } };
    }, { type: 'soundfont', prebake: true, fonts: presets });
  }
}
