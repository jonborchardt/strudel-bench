// The one process that holds the Azure key: synthesizes one SSML file into a wav with the SDK and prints the word
// boundaries as its last line of stdout. azure.mjs starts one of these per synthesis and kills it on a timeout, which
// is the only stop that is unconditional (closing the SDK's synthesizer cannot interrupt a pending connect: measured,
// see CLAUDE.md). Never run by hand: node worker.mjs <ssml file> <out wav>
import fs from 'node:fs';
import path from 'node:path';
import sdk from 'microsoft-cognitiveservices-speech-sdk';

/** Loads the nearest .env at or above `dir` (variables already in the environment win). */
function loadEnv(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    const f = path.join(d, '.env');
    if (fs.existsSync(f)) { process.loadEnvFile(f); return; }
    if (d === path.dirname(d)) return;
  }
}

const [ssmlFile, outFile] = process.argv.slice(2);
if (!ssmlFile || !outFile) { console.error('usage: node worker.mjs <ssml file> <out wav>'); process.exit(2); }
if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) loadEnv(process.cwd());
const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION;
if (!key || !region) { console.error('utter needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (.env or the environment)'); process.exit(1); }

const cfg = sdk.SpeechConfig.fromSubscription(key, region);
cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm; // FORMAT in speak.mjs names this
cfg.setProperty(sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary, 'true');
const synth = new sdk.SpeechSynthesizer(cfg, null); // null: no speaker, the bytes come back in the result
const boundaries = [];
synth.wordBoundary = (_, e) => boundaries.push({ text: e.text, offset: e.audioOffset, duration: e.duration, type: String(e.boundaryType) });
const fail = (msg) => { console.error(`azure speech failed: ${msg}`); process.exit(1); };
synth.speakSsmlAsync(fs.readFileSync(ssmlFile, 'utf8'), (r) => {
  if (r.reason !== sdk.ResultReason.SynthesizingAudioCompleted) fail(r.errorDetails ?? sdk.ResultReason[r.reason]);
  fs.writeFileSync(outFile, Buffer.from(r.audioData));
  process.stdout.write(JSON.stringify({ boundaries }) + '\n', () => process.exit(0)); // exit ourselves: do not wait on the SDK's socket
}, (e) => fail(String(e)));
