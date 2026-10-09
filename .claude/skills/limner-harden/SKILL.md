---
name: limner-harden
description: Use when the user asks to harden limner, run the limner quality loop, survey the figures, or fix what the hardening ledger ranks first. Renders sheets of limner figures, judges them against limner/scripts/harden/rubric.md, records findings in the ledger, fixes only severity-3 entries, verifies each from a render, checks related combinations for regressions, parks an entry after three attempts, tracks defects per sheet and closes it. Runs for as long as the user wants: /loop /limner-harden.
---

# limner-harden: render, judge, record, fix

The hands are `npm run harden -- <cmd>` (`limner/scripts/harden.mjs`). The eyes are you, reading a png with the Read
tool. The rubric is `limner/scripts/harden/rubric.md`; read it before the first sheet of a session. The ledger is
`limner/scripts/harden/todos.json`; read `npm run harden -- todos` before judging, so a known fault is a count.

The browser is found by itself: the newest playwright headless shell under `%LOCALAPPDATA%\ms-playwright` (`chromePath` in
`limner/scripts/harden/sheet.mjs`). Set `CHROME` to a Chromium binary only when a render fails with `no browser`.

The sheet pngs are the loop's *then* side and live only where they were rendered (`limner/scripts/harden/sheets/`, gitignored). Keep that folder with the checkout that runs the loop; moving the loop to another checkout means copying it over, or `verify` shows only the now side.

## One cycle

**Survey: twenty sheets.** More sheets before a fix means truer `seen` counts, and the stats need the volume. Do not count them: `limner/scripts/harden/cycle.json` holds the cycle's number and first sheet, and `next` refuses a twenty-first. For each of the twenty:

1. `npm run harden -- next`. Read the table it prints and the png.
2. Judge every cell but cell 1 against the rubric, cell 1 being the scale. For a face fault on a figure sheet, `npm run harden -- crop <sheet> head` first.
3. Write the findings as JSON to the scratchpad: `[{ "cell": 4, "category": "stack", "parts": ["hat:leafCirclet", "hair:highBun"], "severity": 2, "note": "circlet floats clear of the bun" }]`. Categories and severity are the rubric's. Name parts from the cell's own `parts` list in the sheet json (`sheets/<sheet>.json`: every hair, hat, garment, mark and feature style the cell draws, spelled as a finding takes them), never from the picture alone; `parts` may be `["unknown"]` when the fault belongs to none of them. A clean sheet is `[]`, and it is still recorded: the stats need it.
4. `npm run harden -- record <sheet> <file>`. A refusal is a malformed finding; fix the JSON and record again (a refused batch writes nothing, so the sheet is not yet recorded; a sheet already recorded is refused, never recorded twice).

**Fix: severity 3 only.** Severity 3 is wrong at thumbnail size, so none of those waits a cycle; severity 1 and 2 entries are recorded and counted, never fixed by the loop. A cycle with no open severity-3 entry fixes nothing and goes straight to 11: that is a normal cycle, not a skipped step. Steps 6 to 10 run once per severity-3 entry.

5. Before choosing, merge entries that are one fault under different parts: `npm run harden -- merge <keep> <ids> [--parts <shared part>]`; the merged entry keeps every member's parts (plus `--parts`, if given) and ranks by its total. `npm run harden -- todos`. Take the open severity-3 entries in the order listed. None: skip to 11. Parked entries (three attempts) are not listed; they are not taken.
6. `npm run harden -- snap <id> before` (and `snap <id> before --crop head` for a face fault) **before touching any file**: the before png is the proof of what was wrong, rendered from the code as it stands. Then read `limner/CLAUDE.md`'s rules (parts by tag, one body per stance, paths absolute, never regenerate a golden to make a test pass). Edit limner. Fix the generator's rule, not the one picture: the smallest change to the part or the stack order that the parts name. Do not widen the fix into a refactor of neighbouring code; if the fault needs one, record that with `attempt` and move on.
7. `npm run harden -- snap <id> after` (same crop as the before), then `npm run harden -- verify <id>` (verify pairs the before snapshot, when it exists, with the now render; it prints which then source it used) and read every png it prints (eight pairs a page: `<id>-verify.png`, `<id>-verify-2.png`, ...): then on the left, now on the right; judge every pair from these, not from the snaps. For a face fault, `verify <id> --crop head` (or `eyes`, or `"x y w h"` in bust units): the then cell enlarged, the now bust cropped the same. The fault is gone, or go to 9.
8. `npm run harden -- related <id>` and read the png: other combinations drawing the same parts; the related sheet holds one cell per cast that can wear the part, so a cast's own light, makeup and hats are checked; judge every cell. A fault there is a regression: record it with `npm run harden -- record <id>-related <file>` and go to 9. Clean: go to 10. No related cells means the check was not done, not that it passed: judge a fresh `next` sheet before closing.
9. `npm run harden -- attempt <id> "<what you tried and what it did>"` (the next attempt's `snap <id> after` overwrites the after png; the before is never retaken), then undo the attempt's edit: `git checkout -- <the limner source files this attempt edited>`, named one by one (e.g. `git checkout -- limner/portrait.mjs limner/parts/elf.mjs`), never `limner/` whole, which would revert the ledger; a file the attempt created is deleted by hand. No failed edit stays in the tree: every attempt starts from clean source. Under three attempts: back to 6 with a different idea, not a variation of the last. At three the entry parks itself: go to 11.
10. If the fault is geometric, add a lint to `limner/scripts/harden/lint.mjs` and a test in `limner/test/harden.test.mjs` over one evidence state; the noise test there fails a lint that fires on more than 5% of a fixed grid slice, so tighten it until it fires on the fault, not the cast. `npm run harden -- test` (the whole suite, judged by its `ℹ fail` line: it prints `PASS n tests` or `FAIL` with the failing tests; never read `npm test` through a pipe and trust the exit code); a moved golden is read, not regenerated. Commit limner's change with the id (`limner: T014 the circlet sits on the bun`), its body naming the two pngs (`before: sheets/fixes/T014-before.png, after: sheets/fixes/T014-after.png`; gitignored, so the names tell the reader where to look on the machine that ran the loop), then `npm run harden -- close <id> --commit <sha> [--lint <name>]` and commit `todos.json` with it.
11. `npm run harden -- stats`. Report the open list, what was fixed or parked, and both rates early against late: fresh defects per fresh cell, and defects per cell (every cell is a new seed, so this one keeps measuring once every tuple has been covered). Commit the loop's state with `npm run harden -- cycle --trailer "<the commit trailer>" [--note "<one sentence the numbers cannot say, e.g. a failed attempt>"]`: it refuses until the cycle's twenty sheets are recorded, writes the `limner: harden, cycle <n>` commit body from the sheets and the ledger, commits `todos.json`, `coverage.json` and `cycle.json` alone, and starts the next cycle. `--dry` prints the message without committing. Never write or amend that commit by hand. If it prints `review due`, run 12 first. Back to 1.
12. **Review, every third cycle** (the `cycle` command says when, and lists the fixes since the last review). The agent that judged, fixed and verified does not grade its own work: dispatch a separate agent (the Agent tool, a fresh context) with the rubric's path and, per listed id, `limner/scripts/harden/sheets/fixes/<id>-before*.png` and `<id>-after*.png` plus the entry's `notes` from `npm run harden -- todos --all`. It judges each pair against the rubric and answers per id: holds, or does not hold and why. Do not argue it down. For each that does not hold, `npm run harden -- reopen <id> "<the reviewer's why>"` (the fix counts as an attempt; a third parks it), then commit `todos.json` as `limner: harden, review after cycle <n>` with the reopened ids in the body. A missing before or after png is reported, not guessed: re-render it with `snap <id> after` and hand that over.

**Wontfix** is `npm run harden -- close <id> --wontfix "<why>"`, only when the rubric says it is in character or the user says so; a rule goes in the rubric's Corrections.

## What you never do

- Choose seeds, write a ledger entry, crop a png, count the cycle or write its commit by hand. The scripts do those.
- Close an entry from a description. Only from the verify png.
- Edit limner before `snap <id> before` has run.
- Judge a face from the ops or the svg text. Render it.
- Reach outside `limner/` from anything under it.
- Add a detail or an asymmetry to satisfy the style section. It is a direction, not a target.
- Close an entry whose `related` sheet shows a new fault, or keep attempting past three.
