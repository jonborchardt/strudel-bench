# Blog ideas

Pitches, one paragraph each. Promote one to its own file when it's written.

## An agent that can't hear: building a feedback loop for music without ears
Claude edits songs but never hears them. What replaces listening: the headless event dump (`npm run check`), unknown-sound detection, and the render → analyze → verify chain that turns "brighter" into a measured centroid delta. The honest ceiling: "verified directionally" is the strongest claim the tool will make, and why that's enough for a collaborator who does hear.

## 0.5 is a no-op: designing axes so an agent can't guess
The rules in the README are really rules for keeping a language model honest. Every axis has a baseline that's provably a no-op (a test enforces it), a direction with no implementation is a documented no-op instead of a guess, and adapters run in a fixed phase order because transforms don't commute. A post on writing constraints for a tool whose main failure mode is confident improvisation.

## Vocabulary is data: "dreamier", "punchier", "much darker" as JSON deltas
How words map to axis nudges (`descriptors.json`), how emotions and genres stack as overlays, how modifiers scale, and why descriptors are deltas rather than states. Includes the resolver's one hard line: it edits numeric literals in declarative state and refuses to touch hand-written Strudel expressions.

## Harmony is not an axis
Why key and progression live outside the 0..1 axis system, what roman numerals over a section key buy you (a real V in harmonic minor), the words that map to progressions (resolved, tense, circular), and the deliberate omissions: inversions, voice leading, chords longer than a bar. A short case study in deciding what a model shouldn't try to model yet.

## A git log that reads like a session diary
Every change to a song is committed with the musical change as the message, and `songs/<name>.notes.json` records the ask and the why per section and layer. Provenance for creative work: what it looks like six weeks later to open a track and know why the drop got its own progression.

## The dump: printing source code that never existed
`song()` builds patterns at runtime, so there's nothing to show. `lib/dump.mjs` wraps every core function and Pattern method for one evaluation, records the call chain, and prints the plain Strudel the declarative file reduces to. Same trick powers the page's expanded pane and the Strudel export. A small piece of instrumentation with an outsized payoff for trust.

## Rendering offline one cycle at a time
Why a single `renderPatternAudio` graph runs ~40x slower than realtime on long songs, the OfflineAudioContext-while-live-context-stays-open dance, the WeakRef patch that stops superdough's node pool from handing one context's nodes to the other, and the cross-context error you filter rather than fix.

## Node stdlib only: a no-bundler live-coding harness
What it costs and saves to serve `node_modules` straight to the browser, the `@kabelsalat/web` missing-exports hook, and `fs.watch` firing twice on Windows. The unglamorous plumbing post.

## Shipping sample packs you're allowed to ship
Local packs with `deploy: true | false | [sounds]`, license required to deploy, and a Pages build that drops any song declaring a pack it can't ship and re-checks the rest against the shipped index so the site fails to build rather than plays silence. Licensing as a build-time constraint.

## Notes to a producer, not a spec (the machine post, generalised)
The companion to making-machine-with-claude.md: the general pattern of section-by-section one-line feedback, saying what you love, correcting wrong guesses bluntly, and asking for "more" in small steps. Could fold in a second song (arc) to show it isn't a one-off.

## Encoding taste as a linter
`scripts/lint.mjs` turns judgment calls — no climax, climax isn't the peak, two sections that sound identical, raw saws colliding in the same section, a melody or bass with no notes — into static analysis over the check table, errors vs warnings, exit code and all. A post about the moment a subjective "that section drags" becomes a rule that runs in CI, and what's still deliberately left as taste rather than a check.

## One undo stack for six kinds of editing
Typing in a pane, dragging a knob, adding a vocabulary pill, renaming a section, swapping a kit — all of it funnels through one `commit` and one stack, coalesced by time so a drag doesn't spam ctrl-z. The interesting part is what deliberately bypasses it: solo/mute and A/B never touch the source, so "what you hear" and "what's written" can diverge on purpose. A post on drawing that line.

## A share link with no server
The Link button deflates `name\nsource` with `CompressionStream`, base64url-encodes it into the URL hash, and a page load decodes it back — no backend, no database, works on GitHub Pages. Small, but a good worked example of the browser's native compression API doing a job people reach for a paste-bin service to solve.

## Drawing a drum sound from its own description
`scripts/kiticons.mjs` reads a kit's one-line description and picks a texture, weight, colour and accent for a generated SVG glyph — no image asset, no artist, just words already written for a different reason (the mixer's kit-picker label) turned into a visual. A short post on mining data you already have instead of adding a new field for it.

## Golden files for a system that's supposed to be reproducible
`test/golden.test.mjs` pins the full event stream of fixture songs; `test/check.test.mjs` only asks that real songs check clean. Two different tests for two different promises — one says "this exact output must not drift," the other says "this must still work" — and the discipline of only regenerating the golden file on purpose, then checking that just the fixtures you touched moved.
