---
name: limner-harden
description: Use when the user asks to harden limner, run the limner quality loop, survey the figures, or fix what the hardening ledger ranks first. Renders sheets of limner figures, judges them against limner/scripts/harden/rubric.md, records findings in the ledger, fixes the top entry, verifies it from a render, checks related combinations for regressions, parks an entry after three attempts, tracks defects per sheet and closes it. Runs for as long as the user wants: /loop /limner-harden.
---

# limner-harden: render, judge, record, fix

The hands are `npm run harden -- <cmd>` (`limner/scripts/harden.mjs`). The eyes are you, reading a png with the Read
tool. The rubric is `limner/scripts/harden/rubric.md`; read it before the first sheet of a session. The ledger is
`limner/scripts/harden/todos.json`; read `npm run harden -- todos` before judging, so a known fault is a count.

The browser is found by itself: the newest playwright headless shell under `%LOCALAPPDATA%\ms-playwright` (`chromePath` in
`limner/scripts/harden/sheet.mjs`). Set `CHROME` to a Chromium binary only when a render fails with `no browser`.

The sheet pngs are the loop's *then* side and live only where they were rendered (`limner/scripts/harden/sheets/`, gitignored). Keep that folder with the checkout that runs the loop; moving the loop to another checkout means copying it over, or `verify` shows only the now side.

## One cycle

**Survey: ten sheets.** More sheets before a fix means truer `seen` counts, and the stats need the volume. For each of the ten:

1. `npm run harden -- next`. Read the table it prints and the png.
2. Judge every cell but cell 1 against the rubric, cell 1 being the scale. For a face fault on a figure sheet, `npm run harden -- crop <sheet> head` first.
3. Write the findings as JSON to the scratchpad: `[{ "cell": 4, "category": "stack", "parts": ["hat:leafCirclet", "hair:highBun"], "severity": 2, "note": "circlet floats clear of the bun" }]`. Categories and severity are the rubric's; `parts` may be `["unknown"]` when nothing specific can be named. A clean sheet is `[]`, and it is still recorded: the stats need it.
4. `npm run harden -- record <sheet> <file>`. A refusal is a malformed finding; fix the JSON and record again (a refused batch writes nothing, so the sheet is not yet recorded; a sheet already recorded is refused, never recorded twice).

**Fix: every severity-3 entry, then the top one left.** Severity 3 is wrong at thumbnail size, so none of those waits a cycle; after they are all closed or parked, one more entry, whatever ranks first. Steps 6 to 10 run once per entry.

5. `npm run harden -- todos`. Take the open severity-3 entries in the order listed, then the top entry of the rest. No open entries: skip to 11. Parked entries (three attempts) are not listed; they are not taken.
6. `npm run harden -- snap <id> before` (and `snap <id> before --crop head` for a face fault) **before touching any file**: the before png is the proof of what was wrong, rendered from the code as it stands. Then read `limner/CLAUDE.md`'s rules (parts by tag, one body per stance, paths absolute, never regenerate a golden to make a test pass). Edit limner. Fix the generator's rule, not the one picture: the smallest change to the part or the stack order that the parts name. Do not widen the fix into a refactor of neighbouring code; if the fault needs one, record that with `attempt` and move on.
7. `npm run harden -- snap <id> after` (same crop as the before), then `npm run harden -- verify <id>` (verify pairs the before snapshot, when it exists, with the now render; it prints which then source it used) and read the png: then on the left, now on the right. For a face fault, `verify <id> --crop head` (or `eyes`, or `"x y w h"` in bust units): the then cell enlarged, the now bust cropped the same. The fault is gone, or go to 9.
8. `npm run harden -- related <id>` and read the png: other combinations drawing the same parts. A fault there is a regression: record it with `npm run harden -- record <id>-related <file>` and go to 9. Clean: go to 10. No related cells means the check was not done, not that it passed: judge a fresh `next` sheet before closing.
9. `npm run harden -- attempt <id> "<what you tried and what it did>"` (the next attempt's `snap <id> after` overwrites the after png; the before is never retaken), then undo the attempt's edit: `git checkout -- <the limner source files this attempt edited>`, named one by one (e.g. `git checkout -- limner/portrait.mjs limner/parts/elf.mjs`), never `limner/` whole, which would revert the ledger; a file the attempt created is deleted by hand. No failed edit stays in the tree: every attempt starts from clean source. Under three attempts: back to 6 with a different idea, not a variation of the last. At three the entry parks itself: go to 11.
10. If the fault is geometric, add a lint to `limner/scripts/harden/lint.mjs` and a test in `limner/test/harden.test.mjs` over one evidence state. `npm test`; a moved golden is read, not regenerated. Commit limner's change with the id (`limner: T014 the circlet sits on the bun`), its body naming the two pngs (`before: sheets/fixes/T014-before.png, after: sheets/fixes/T014-after.png`; gitignored, so the names tell the reader where to look on the machine that ran the loop), then `npm run harden -- close <id> --commit <sha> [--lint <name>]` and commit `todos.json` with it.
11. `npm run harden -- stats`. Report the open list, what was fixed or parked, and the fresh-defect rate early against late. Commit the loop's state so the ledger is never only in the working tree: `git add limner/scripts/harden/todos.json limner/scripts/harden/coverage.json`, commit `limner: harden, cycle <n>` (with the trailer). Back to 1.

**Wontfix** is `npm run harden -- close <id> --wontfix "<why>"`, only when the rubric says it is in character or the user says so; a rule goes in the rubric's Corrections.

## What you never do

- Choose seeds, write a ledger entry or crop a png by hand. The scripts do those.
- Close an entry from a description. Only from the verify png.
- Edit limner before `snap <id> before` has run.
- Judge a face from the ops or the svg text. Render it.
- Reach outside `limner/` from anything under it.
- Add a detail or an asymmetry to satisfy the style section. It is a direction, not a target.
- Close an entry whose `related` sheet shows a new fault, or keep attempting past three.
