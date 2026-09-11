# How I made "machine" with Claude in the strudle harness

An outline of the conversation that produced `songs/machine.strudel`, an industrial rock track at 90 BPM.

1. **Start with a mood brief, not a spec.** I described the track the way I'd describe it to a producer: the genre, the feel (filthy, mechanical, claustrophobic, hypnotic), the tempo and meter, one dark minor key with almost no chord movement, and what each instrument should feel like (blunt kick, dry ugly snare, primitive bass that's part of the machinery). Then I walked through the arrangement in order: a small unsettling intro, sparse verses with deliberate holes, a chorus that gets bigger by adding pressure rather than switching styles, breakdowns that leave fragments and rebuild more damaged each time, a late section of controlled chaos, and an ending that burns out instead of resolving. No code, no numbers.

2. **Claude turned that into a song file.** It mapped the brief onto the harness's four layers and its axis system (density, drive, brightness, weight, aggression, and so on, each 0 to 1), laid out twelve sections, and added a layer of plain Strudel textures for the things the axes don't cover: metal pulses, hiss, static bursts, reversed scrapes, a low drone, a feedback scream. It ran the checker, committed, and told me where to play it.

3. **Listen once, then give notes section by section.** I played it top to bottom and wrote one line per section, in plain language: "intro is ok", "arrive is a bit too nintendo", "verse I don't like the horn", "build is excellent", "chaos is too much, make it a louder chorus2 instead", "breakdown2 isn't needed but I love the whistle". That single message drove most of the shaping. Naming what I liked mattered as much as what I didn't, because it told Claude what to keep and what to reuse elsewhere.

4. **Correct it when it guesses wrong.** Claude guessed "the horn" was a noise swell and removed that. I said "the horn is still there, I think you removed the wrong thing." It put the swell back and removed the actual culprit, the low melody synth in the verses. Short, blunt corrections work fine.

5. **Push in small increments.** Once the verses were clean I said "verse needs something more, just not horn," then "a bit more," then "even more, it needs a sound that gets going, just not the horn." Each step added one idea: choked guitar-like stabs plus the whistle, then louder and denser, then a grinding riff that gates open and filter-sweeps up across the verse. Each round was one listen and one sentence.

6. **Every round was checked and committed.** Claude can't hear audio, so after each change it ran the headless checker to confirm the song evaluates with no unknown sounds, then committed with a message describing the musical change. The git log reads like a session diary.

## What made it work

- Describe feelings and references, not parameters.
- Give feedback per section in one message.
- Say what you love, not just what you hate.
- Correct wrong guesses immediately.
- Ask for "more" in small steps rather than redesigning.
