---
name: limner-harden
description: Use when the user asks to harden limner, run the limner quality loop, survey the figures, or fix what the hardening ledger ranks first. Renders sheets of limner figures, judges them against limner/scripts/harden/rubric.md, records findings in the ledger, fixes the top entry, verifies it from a render, checks related combinations for regressions, parks an entry after three attempts, tracks defects per sheet and closes it. Runs for as long as the user wants: /loop /limner-harden.
---

# limner-harden: render, judge, record, fix

The hands are `npm run harden -- <cmd>` (`limner/scripts/harden.mjs`). The eyes are you, reading a png with the Read
tool. The rubric is `limner/scripts/harden/rubric.md`; read it before the first sheet of a session. The ledger is
`limner/scripts/harden/todos.json`; read `npm run harden -- todos` before judging, so a known fault is a count.

Set the browser once per session (PowerShell):
`$env:CHROME = "C:/Users/Jon/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe"`

## One cycle

**Survey: three sheets.** For each of the three:

1. `npm run harden -- next`. Read the table it prints and the png.
2. Judge every cell but cell 1 against the rubric, cell 1 being the scale. For a face fault on a figure sheet, `npm run harden -- crop <sheet> head` first.
3. Write the findings as JSON to the scratchpad: `[{ "cell": 4, "category": "stack", "parts": ["hat:leafCirclet", "hair:highBun"], "severity": 2, "note": "circlet floats clear of the bun" }]`. Categories and severity are the rubric's; `parts` may be `["unknown"]` when nothing specific can be named. A clean sheet is `[]`, and it is still recorded: the stats need it.
4. `npm run harden -- record <sheet> <file>`. A refusal is a malformed finding; fix the JSON and record again.

**Fix: one entry.**

5. `npm run harden -- todos`. Take the top entry. No open entries: skip to 11. The top entry is parked (three attempts): it is not listed; take the one shown.
6. Read `limner/CLAUDE.md`'s rules (parts by tag, one body per stance, paths absolute, never regenerate a golden to make a test pass). Edit limner. Fix the generator's rule, not the one picture: the smallest change to the part or the stack order that the parts name. Do not widen the fix into a refactor of neighbouring code; if the fault needs one, record that with `attempt` and move on.
7. `npm run harden -- verify <id>` and read the png: then on the left, now on the right. The fault is gone, or go to 9.
8. `npm run harden -- related <id>` and read the png: other combinations drawing the same parts. A fault there is a regression: record it with `npm run harden -- record <id>-related <file>` and go to 9. Clean: go to 10.
9. `npm run harden -- attempt <id> "<what you tried and what it did>"`. Under three attempts: back to 6 with a different idea, not a variation of the last. At three the entry parks itself; leave the code as it was before this attempt (`git checkout -- limner/`) and go to 11.
10. If the fault is geometric, add a lint to `limner/scripts/harden/lint.mjs` and a test in `limner/test/harden.test.mjs` over one evidence state. `npm test`; a moved golden is read, not regenerated. Commit limner's change with the id (`limner: T014 the circlet sits on the bun`), then `npm run harden -- close <id> --commit <sha> [--lint <name>]` and commit `todos.json` with it.
11. `npm run harden -- stats`. Report the open list, what was fixed or parked, and the fresh-defect rate early against late. Back to 1.

**Wontfix** is `npm run harden -- close <id> --wontfix "<why>"`, only when the rubric says it is in character or the user says so; a rule goes in the rubric's Corrections.

## What you never do

- Choose seeds, write a ledger entry or crop a png by hand. The scripts do those.
- Close an entry from a description. Only from the verify png.
- Judge a face from the ops or the svg text. Render it.
- Reach outside `limner/` from anything under it.
- Add a detail or an asymmetry to satisfy the style section. It is a direction, not a target.
- Close an entry whose `related` sheet shows a new fault, or keep attempting past three.
