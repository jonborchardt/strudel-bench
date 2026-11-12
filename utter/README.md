# utter

Turns one utterance into audio: text and voice parameters in, a 48 kHz wav and the time of every word out, through
[Azure AI Speech](https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech).

It knows nothing about music, songs or sample packs. A host that wants speech in a song takes the wav and the word
times and does the rest (in the repo this lives in, that is `scripts/say.mjs`).

```js
import { speak } from 'utter';

const r = await speak({ text: 'hold the line a little while longer' });
r.wav;      // a Buffer: RIFF, 48 kHz, 16-bit, mono
r.words;    // [{ text: 'hold', start: 0.1, end: 0.2875 }, ...] in seconds from the start of the file
r.seconds;  // the length of the audio
```

## Setting up

Node 22 or later. One dependency, `microsoft-cognitiveservices-speech-sdk`.

You need an Azure AI Speech resource (Azure portal: create a *Speech* resource, then *Keys and Endpoint*). Put its key
and region in the environment, or in a `.env` file at or above the directory you run from:

```
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=...
```

There is no endpoint URL to configure: the SDK derives it from the region. `.env.example` has the two names. Never
commit the key.

## speak(spec, options)

`spec` says what to say and how. `options` are about the call, not the voice:

| option | default | what it does |
|---|---|---|
| `cacheDir` | none | a folder for the cache. Without it nothing is cached and nothing is written. |
| `fresh` | `false` | synthesize even when the cache has this utterance. The old entry is replaced only by a complete new one. |
| `timeoutMs` | `120000` | how long one attempt may take before it is stopped. |
| `backoff` | `[2000, 5000, 10000, 20000, 60000, 120000]` | the waits, in ms, before each retry of a transient failure. |
| `synth` | Azure | the synthesis function. Tests pass a fake; see "Testing without Azure". |

It resolves to:

| field | what it is |
|---|---|
| `wav` | the audio, a Buffer |
| `words` | `[{ text, start, end }]`, seconds from the start of the file |
| `seconds`, `rate` | the audio's length and sample rate (48000) |
| `chars`, `cost` | the characters spoken and what they cost at list price: an estimate |
| `spent` | `cost` when a request was sent, `0` on a cache hit |
| `cached` | `true` when the result came from the cache and no request was made |
| `voice`, `ssml`, `key` | the voice used, the document sent, the cache key |

## Parameters

Every key of `spec`. `PARAMS` is the same table as data (`import { PARAMS } from 'utter'`), and a bad value throws
with the parameter's name before anything is sent.

| param | lands in | what it takes |
|---|---|---|
| `text` | the body | What to say. Escaped, so `&`, `<` and `>` are spoken text. `[400ms]` or `[1.5s]` inside it is a pause. |
| `voice` | `<voice name>` | An Azure voice name. Default `en-US-AndrewMultilingualNeural`. Must be in the snapshot (see Voices) unless `anyVoice` is set. |
| `lang` | `xml:lang` | The document language, such as `en-GB`. Defaults to the voice's own locale. |
| `rate` | `<prosody rate>` | A signed percentage (`-50%` to `+100%` is the useful range) or `x-slow`, `slow`, `medium`, `fast`, `x-fast`. |
| `pitch` | `<prosody pitch>` | Relative (`+2st`, `-10%`, `+20Hz`), absolute (`220Hz`), or `x-low`, `low`, `medium`, `high`, `x-high`. A nudge to the voice, not a musical note. |
| `volume` | `<prosody volume>` | Relative (`+6dB`, `-20%`) or `silent`, `x-soft`, `soft`, `medium`, `loud`, `x-loud`. |
| `contour` | `<prosody contour>` | Pitch over the utterance: `[[position 0..100, pitch], ...]`. |
| `style` | `<mstts:express-as style>` | A speaking style (`whispering`, `shouting`, `sad`, ...). Only the styles the snapshot lists for that voice. |
| `styleDegree` | `styledegree` | How strongly the style is applied, 0.01 to 2. Needs `style`. |
| `role` | `<mstts:express-as role>` | A role the voice can play. Only the roles the snapshot lists for that voice. |
| `segments` | `<prosody>` spans | In place of `text`: `[{ text, rate?, pitch?, volume? }, ...]`, spans of one utterance each with its own prosody. |
| `ssml` | the whole document | The escape hatch: a complete `<speak>` document, sent as written. Every other parameter is then ignored. |
| `anyVoice` | nothing | Accept a voice name the snapshot does not list (a new or custom voice). Its styles are then not checked. |

```js
import { speak, ssmlOf } from 'utter';

await speak({ text: 'slower, and lower', rate: '-15%', pitch: '-2st' });
await speak({ text: 'wait [400ms] now' });                       // a pause inside the line
await speak({ text: 'keep it down', voice: 'en-US-AriaNeural', style: 'whispering', styleDegree: 1.5 });
await speak({ segments: [{ text: 'hold', pitch: '+3st' }, { text: 'the line' }] });

ssmlOf({ text: 'hi', rate: '-10%' });   // the document itself, without sending it
```

`ssmlOf(spec)` is pure: it builds and validates and makes no call, so it is the way to see what would be sent.

## Voices

Azure has over a thousand voices. `voices.json` is a committed snapshot of the English-locale and multilingual ones
(name, locale, gender, styles, roles), so a voice or a style is checked and listed without a network call.

```js
import { voices } from 'utter';

voices({ locale: 'en-GB' });            // every British voice
voices({ style: 'whispering' });        // every voice that can whisper
voices({ gender: 'Female', locale: 'en-US' }).map((v) => v.name);
```

Refresh the snapshot on purpose, with the key in place: `node scripts/voices.mjs --refresh`. A voice that is not in
the snapshot still works with `anyVoice: true`.

## Word timings

`words` are Azure's own word boundaries, reported while it synthesizes: `start` is the word's offset and `end` is that
offset plus the duration Azure gives for the word itself. `end` is never "the start of the next word", so a pause
between two words belongs to neither. Punctuation is dropped. The audio is not trimmed: leading and trailing silence
stays in the wav, and a caller selects a region by these times instead of cutting the file.

They are alignment data, not edit points. Inside a phrase the words are connected speech, and the boundary between two
of them often falls in the middle of continuous sound. If words are going to be lifted out one at a time, write the
line with pauses (`hold [120ms] the [120ms] line`) and they come apart cleanly.

A result whose words do not fit its audio (out of order, no duration, past the end) is an error and is never cached.

## The cache, and what it does and does not promise

With `cacheDir`, each utterance is kept as `<key>.wav` and `<key>.json`, the key being a hash of everything that can
change the audio: the whole SSML document (so the text, the voice and every parameter), the output format and the
region. A repeat call returns the pair and sends nothing.

Two different guarantees:

- **The cache is reproducible.** A valid entry returns exactly the audio and words that were synthesized before.
- **Azure is not.** Asking for the same text again can return different audio: Microsoft updates its voices, and two
  calls minutes apart can differ in pacing. If the audio matters, keep the wav. The wav you keep is the canonical
  asset; the text and parameters describe how it was made and do not promise it can be made again.

An entry counts only when both files are present and the wav matches the hash its json records; anything else is a
miss. `fresh: true` synthesizes again and replaces the entry only once the new pair is complete, so a failed attempt
leaves the old one. Replacement survives an ordinary write error; it is not crash-atomic, and a process killed
mid-replace leaves a pair that fails the hash check and is read as a miss.

## Cost and terms

`cost` is `chars × $15 / 1,000,000`, Azure's list price for neural voices when this was written. It is an estimate:
your tier and Azure's bill decide the real number. `estimateCost(chars)` is the same sum. One subscription is one
bill: if the same key is used by another project, both spend from it.

Use of the generated audio is governed by Microsoft's product terms for Azure AI Speech. The project this code came
from reads them as allowing the audio in published media. That reading was not checked again here; check it for your
own use.

## Failures

| message | what happened |
|---|---|
| `utter needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION` | no key or region in the environment or a `.env` above the working directory |
| `utter: <param> "..." is not a valid value` | a parameter failed validation; nothing was sent |
| `utter: voice ... is not in the voices snapshot` | a typo, or a voice newer than the snapshot: refresh it or pass `anyVoice: true` |
| `azure speech failed: ...` | Azure refused the request; the rest of the message is Azure's |
| `utter: azure speech timed out after 120 s` | an attempt ran out of time and was stopped; it was retried if retries remained |
| `utter: could not stop a synthesis ...` | an attempt would not end after being stopped; no retry is made over it |
| `utter: azure returned no word boundaries` | audio came back with no words (text that is only punctuation, for one) |

Load shedding ("No free synthesizer", 429, websocket 1013), a dropped connection (1006, "Unable to contact server")
and a timeout are retried after the `backoff` waits. Anything else fails at once.

**How a stalled call is stopped.** Each synthesis runs in a child process (`worker.mjs`), and a timeout kills it. The
next attempt starts only after the child has exited. Closing the SDK's synthesizer in-process was measured and is not
a stop: against a dead route its socket stayed open for 18 seconds after the close, and that time belongs to the
network. The key is read only inside that child.

## Testing without Azure

`speak` takes the synthesis as a function, so a host's tests never need a key or a network:

```js
import { speak } from 'utter';

const fake = async (ssml, { signal }) => ({
  wav: await speak({ text: 'any real result will do' }).then((r) => r.wav),
  boundaries: [{ text: 'hello', offset: 1000000, duration: 3000000, type: 'WordBoundary' }],   // 100 ns ticks
});
const r = await speak({ text: 'hello' }, { synth: fake });
r.words;   // [{ text: 'hello', start: 0.1, end: 0.4 }]
```

A synth resolves to `{ wav, boundaries }` and must keep one rule: when `signal` aborts, its promise settles only once
the work has really stopped. `speak` waits for that before it retries.

## What it is for, and what it is not

- **A phrase**, played whole.
- **Its words**, selected by their times: placed, repeated, reordered.
- **Not singing.** Words are not syllables, and `pitch` is not a musical note. Singing needs smaller units, a measured
  pitch per unit and a correction to the note; none of that is here. What is here does not stand in its way: the wav is
  kept whole and words are regions over it, so finer regions can be added to the same record.

## License

MIT for the code. The audio it produces is Microsoft's service output, under Microsoft's terms.
