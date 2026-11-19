# CLAUDE.md — utter

Guidance for working inside `utter/`. The outer `../CLAUDE.md` covers the Strudel harness that consumes it; this file
covers the package. `README.md` is written for someone who has only the package and is the better place to learn what
it does.

utter turns **one utterance** into audio: a spec in, a 48 kHz wav and its word times out, through Azure AI Speech. It
knows nothing about songs, packs, bars, sections or Strudel.

## The rules that are not negotiable

**utter never imports from outside itself.** Not `../lib/`, not `../scripts/`, not `../web/`. The host imports utter
through its one entry (`package.json` `exports`: `.` only); `../scripts/say.mjs` is the single file out there that
does. If utter needs something the host has, copy it in and say so in a comment (`wavInfo` in `speak.mjs` reads a wav
header itself for that reason).

**Only `worker.mjs` holds the key and the SDK.** `azure.mjs` starts the worker and reads the region (it is part of the
cache identity), never the key. Nothing else names either. `test/exports.test.mjs` enforces all three rules;
`scripts/voices.mjs --refresh` is a script run by hand and is the one other reader of the key.

**No test makes a network call or needs a key.** `speak` takes its synthesis as a function, and every test passes a
fake. A live call is something you run by hand and say you ran.

**Key values are never printed, logged or committed.** `.env` is gitignored in the host.

## What is where

| file | what it is |
|---|---|
| `ssml.mjs` | pure: `PARAMS` (the parameter table as data) and `ssmlOf(spec)`. Text is escaped; every attribute is a validated value. |
| `speak.mjs` | `speak`: the cache, the retry loop, one attempt at a time. No SDK, no key. |
| `azure.mjs` | the default synth: one child process per synthesis, killed on abort, settled on the child's `close`. |
| `worker.mjs` | the child: loads `.env`, calls the SDK, writes the wav, prints the boundaries. Never run by hand. |
| `voices.json`, `voices.mjs` | the committed snapshot of Azure's voice list and its filter. |
| `scripts/voices.mjs` | lists the snapshot; `--refresh` rewrites it from the live list. |
| `index.mjs` | the published barrel. |

## Why a worker process

`speak` promises that a timed-out attempt has really stopped before the next one starts. An `AbortController` does not
give that, and neither does the SDK. Measured 2026-11-11 (SDK 1.53, Node 24):

- Closing the synthesizer 300 ms into a live synthesis: the speak callback still fired after the close, and the close's
  own callback came 2.3 s later.
- Against an unroutable route, closing could not interrupt the pending connect: the socket was still open 5 s after the
  close and the close's callback arrived only when the OS gave up, 18 s later.

A killed child stops unconditionally. So the stop contract is: **a synth's promise settles only when the operation has
actually ended**, and `azure.mjs` settles on the child's `close` event. `speak` waits for that settlement
(`STOP_GRACE_MS`, 5 s) and, if it never comes, fails with "could not stop" instead of retrying over a live attempt.
Do not replace this with an in-process timeout; if you believe the SDK has changed, repeat the two measurements first.

## The cache

`<cacheDir>/<key>.wav` + `<key>.json`; the key hashes the SSML, the format, the region and the request properties. If a
new input can change the audio, it goes into `cacheKey`. An entry is a hit only when both files exist and the wav's
hash matches the json's. Nothing unusable is cached: `speak` checks the words against the audio first.

The cache reproduces itself; Azure does not reproduce Azure. The same text synthesized twice can differ (it did, during
this package's own development: 2.05 s and 2.30 s for one line). Whoever keeps the wav has the asset.

Writes are whole-file, read back, then swapped with the old pair held aside and restored on error. That is not
crash-atomic and does not claim to be: a killed process leaves a pair the hash check rejects.

## Changing things

- A new parameter: a row in `PARAMS`, its handling in `ssmlOf`, a test in `test/ssml.test.mjs`, a row in the README
  table (`test/readme.test.mjs` fails without it).
- `voices.json` moves only through `node scripts/voices.mjs --refresh`. After a refresh run the suite: one test
  accepts every voice, style and role in the snapshot as written, which is how a new character in Azure's names shows.
- Singing, syllables and pitch correction are not here on purpose (README, last section). Words stay regions over a
  whole wav so that finer regions can be added later.

Suite: `npm run test:utter` from the host, or `npm test` in this folder.
