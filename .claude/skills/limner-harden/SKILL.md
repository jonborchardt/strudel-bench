---
name: limner-harden
description: Use when the user asks to harden limner, run the limner quality loop, survey the figures, or fix what the hardening ledger ranks first. Renders sheets of limner figures, judges them against limner/scripts/harden/rubric.md, records findings in the ledger, fixes the top entry, verifies it from a render and closes it. Runs for as long as the user wants: /loop /limner-harden.
---

# limner-harden: render, judge, record, fix

The hands are `npm run harden -- <cmd>` (`limner/scripts/harden.mjs`). The eyes are you, reading a png with the Read
tool. The rubric is `limner/scripts/harden/rubric.md`; read it before the first sheet of a session. The ledger is
`limner/scripts/harden/todos.json`; read `npm run harden -- todos` before judging, so a known fault is a count.

Set the browser once per session (PowerShell):
`$env:CHROME = "C:/Users/Jon/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe"`

## One cycle

**Survey, three sheets** (`--survey n` in the user's words changes the count):

1. `npm run harden -- next`. Read the table it prints (cell, cast/stance/expression, lint flags, editor link) and the png.
2. Judge every cell but cell 1 against the rubric, cell 1 being the scale. For a face fault on a figure sheet, run
   `npm run harden -- crop <sheet> head` and read that png before deciding.
3. Write findings as JSON to the scratchpad: `[{ "cell": 4, "category": "stack", "parts": ["hat:leafCirclet", "hair:highBun"], "severity": 2, "note": "circlet floats clear of the bun" }]`.
   Severity and categories are the rubric's. No parts, no finding. A clean sheet is an empty array, still recorded.
4. `npm run harden -- record <sheet> <file>`. Read what it opened, what it counted, what it refused; a refusal is a
   malformed finding, fix the JSON and record again.

**Fix, one entry:**

5. `npm run harden -- todos`. Take the top entry. Open one of its evidence links' hash in your head: `npm run harden --
   lint "<hash>"` for the flags, and read `limner/CLAUDE.md` for the rules (parts by tag, one body per stance, paths
   absolute, never regenerate a golden to make a test pass).
6. Edit limner. One entry per change.
7. `npm run harden -- verify <id>` and read the png: then on the left, now on the right, for every evidence cell. The
   fault is gone and nothing new arrived, or keep editing.
8. If the fault is geometric, add a lint to `limner/scripts/harden/lint.mjs` and a test in `limner/test/harden.test.mjs`
   over one of the evidence states (decode the hash, assert the lint fires on the old drawing's shape and not on the new).
9. `npm test`. A moved golden is read, not regenerated; `UPDATE_GOLDEN=1` only when the moved faces are the ones you
   meant to move, and say so in the commit.
10. Commit limner's change with the entry's id and a one-line description of what changed in the drawing, in the repo's
    style (`limner: T014 the circlet sits on the bun`). Then
    `npm run harden -- close <id> --commit <sha> [--lint <name>]` and commit `todos.json` with it.
11. Back to 1.

**Wontfix** is `npm run harden -- close <id> --wontfix "<why>"`, only when the rubric says it is in character or the user
says so; put the reason in the rubric's Corrections if it is a rule.

## What you never do

- Choose seeds, write a ledger entry or crop a png by hand. The scripts do those.
- Close an entry from a description. Only from the verify png.
- Judge a face from the ops or the svg text. Render it.
- Reach outside `limner/` from anything under it.
