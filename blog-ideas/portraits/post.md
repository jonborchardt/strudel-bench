# The family that didn't age

*Two days of changes to a portrait renderer, told through five people who never changed.*

---

## The idea, in one paragraph

Pick five portrait specs — a grandmother, a father, a mother, two kids — and freeze them. They are plain
objects: face width, eye spacing, nose style, a jumper colour. Then hand that same frozen family to each
day's version of the drawing code and shoot them again. Nobody in the family gets older, changes clothes or
moves. The only thing that changes between the rows is the hand drawing them. It makes a two-day diff into a
family album, and it makes every "why did we change that" answerable by pointing at a face.

No old code goes back into the repo to do it: `git show <rev>:web/visual/portrait.mjs` into a temp file, import
it, render, throw it away. The whole apparatus is `family.mjs` (data) and `render.mjs` (25 lines) in this folder.

---

## Day 0: a head is a circle with a smile

![Four heads from the parlor world, Sep 24](img/01-day0.png)

Faces did not start as a feature. They started as a prop. On 24 September the project got a visual world
called **parlor** — an old folks' home common room, where the drums rock the chairs and the pads fall asleep
under a blanket. That room needed people in it, so it got a `head(ctx, x, y, r, …)` function: an ellipse, two
white ovals with dots in them, an arc for a mouth, two pink blobs for cheeks, three crow's feet.

At the size it was drawn — a head about forty pixels across, in a scene that never stops moving — it works
fine. Blown up, it is an emoji. And the moment a second world wanted people, the honest options were to copy
the function or to build something real.

## Day 1: tone over line

![The family, Sep 25 and Sep 27](img/02-family.png)

The first instinct is to blame proportions. It is almost never proportions. What made those heads cartoons is
that **every feature was a stroke**: the eye was an outline, the nose was an arc, the smile was an arc. Line
art is a style, but it is a style that has to be very good to not read as clip art, and nothing about a
procedural generator is going to be very good at line.

So `web/visual/portrait.mjs` (25 September) threw out the line and modelled with tone instead. Every head got
its planes as soft stacked ellipses — eye sockets, cheek hollows, temples, a front light — and a real contour:
a cheekbone, a rounded jaw angle that sits higher on the square and broad heads, a seeded skew so no face is
mirror-symmetric. The nose stopped being a hook and became two shadows and a highlight. The eye filled with
iris under a lid shadow and a lash. Hair got grain — strands that fall, curls on the curly styles, none on
locs and braids — and cast a shadow on the forehead.

Two things went in the bin the same day: a rectangular face shape, and a cigarette prop. A generator gets more
interesting by having fewer bad options, not more options. That is the whole lesson of the second day, arriving
early.

That is the top row of the family above.

## Day 2: the cartoon was never in the face

Then a day of just looking at them. The remaining tells were, almost without exception, *not in the face*.

**The neck.** The least glamorous fix and the biggest one. A neck used to be a column of its own height,
which meant it stopped somewhere around the collarbone and *sat on top of the jumper* — two tabs of skin on
the shoulders. Now every neck runs to a fixed `NECK_BOTTOM`, behind every garment, and is then drawn a second
time through the hole the outermost neckline makes, closed upward rather than on its own chord. A neckline is a
hole with skin inside it, not a curve painted on cloth. Look at Nan's turtleneck:

![Nan, Sep 25 and Sep 27](img/04-nan.png)

**Asymmetry that agrees with itself.** A symmetrical face with one random wobble in it reads as a mistake. A
face where one cheek is fuller *and* one jaw corner sharper *and* one temple wider *and* the chin sits toward
the same side reads as a person. So faces are now built in structural *families*, each carrying three or four
coherent asymmetries on one side, and then perturbed.

**Features derived from each other.** Before, features were parts placed on a head: a broad face got the
default nose. Now eye spacing comes from the face's width, the nose and mouth widths come from the eye spacing,
the mouth sits a fixed gap under the nose tip, and the eyes and brows scale a little with the head (0.92 to
1.12) so one fixed eye is never a bead on a broad face and a saucer on a narrow one.

**Beards cut to the jaw.** A beard used to be a beard-shaped thing fitted over a chin. Now it is a band cut
from *this* face's own outline, let out — so a beard on a square jaw is square. And the moustache rides the
lip it sits on: pinned under the nose, its lower edge taking the lip curve's own move, so a smile bows it and
it is never the one still thing on a moving face.

![Dad, Sep 25 and Sep 27](img/03-dad.png)

**Cloth behaving as cloth.** The head's shadow on the chest, shoulder folds, armpit pull, neckline thickness,
the torso shaded as a cylinder. Compare the two shirts above; the collar on the right sits *on* someone.

**Hats that admit hair is under them.** The hair is clipped to below the crown line and pressed in at a slant
rather than cut flat, and because a crown's bottom edge arcs upward, the hat wears a small skirt in its own
colour to fill the crescent of forehead a level cut would leave.

## What got deleted

The two most useful changes of the second day were removals.

A **halo** — a soft light disc behind every head. You can see it in the Sep 25 row. It flattered every portrait
equally, which means it flattered none of them, and it was doing the work that the contour should have been
doing. It went on 26 September and nothing replaced it.

A **lighting system** — hard side light, overhead, stage lights, four setups with their own maths. Built and
deleted the same day. Every face is soft-lit by one frontal wash now, with a single `contrast` dial for how deep
the tonal planes go. The four setups were a knob that nobody ever wanted to turn anywhere good.

## The arc

Two days, and essentially one move repeated: **stop drawing the outline of a thing and start drawing the thing
the light does to it.** Tone instead of line on the face. A neck that goes *into* a collar instead of a column
parked in front of it. A beard cut from a jaw instead of fitted over one. Asymmetries that agree with each
other instead of dice rolled per feature.

Every change that made the faces more interesting was either subtractive or structural. Nothing in the list
above is a new feature. The props, the halo and the lighting rigs were the additions, and every one of them
came back out.

The family in the sheet never aged. Only the hand drawing them did.

---

## Reproducing the pictures

```sh
node blog-ideas/portraits/render.mjs d11afc8 .    # ./out/sheet.html, one row per revision
```

`family.mjs` is the five specs, written only with keys that exist in both revisions' `DEFAULTS`, so the same
five people survive the trip. `render.mjs` pulls each old `portrait.mjs` out with `git show` into a temp file
and imports it — the module has no imports of its own, so nothing else has to be reconstructed, and no old
code is ever checked back in. Day 0 is the one exception: those heads come from `parlor.mjs` at `3ef6bd4`,
which draws to a canvas rather than SVG, so they were shot in a headless browser.
