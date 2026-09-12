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
The companion to making-machine-with-claude.md: the general pattern of section-by-section one-line feedback, saying what you love, correcting wrong guesses bluntly, and asking for "more" in small steps. Could fold in a second song (nocturne or arc) to show it isn't a one-off.
