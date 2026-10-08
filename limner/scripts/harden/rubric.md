# What a sheet is judged against

Three standing rules. **Name the cell and the parts (`kind:name`, as the editor menus spell them: `hat:leafCirclet`,
`hair:highBun`, `stance:swaggerLean`, `expression:grin`, `top:elvenTunic`, `eyes:almond`) or it is not a finding.**
**A thing that is ugly but in character is not a finding**: a zombie's rot, a wastelander's grime, an orc's underbite,
a robot's seams. Cell 1 is the calibration face, the same on every sheet: judge the others against it, never against the
last sheet. **`unknown` is allowed as a part** when a real defect cannot be attributed to a specific part:
`parts: ['unknown']`, or `['unknown:<word>']` to keep two different unattributed faults apart (`unknown:neck`). Use it
rarely; an unattributed entry cannot be checked against related combinations.

Severity: 3 is wrong at thumbnail size (a stray line, a hat in the air, a limb off the body); 2 is wrong at the sheet's
cell size (a collar over the neck, a beard off the jaw, an expression that reads as another); 1 is wrong only when
looked for (a seam, a tone that is flat, a brow a touch high). Severity is visual size, in every category. A lint flag
(`render:nan`, `render:offsheet`, `pose:stance-noop`) is a correctness fact, not a judgment: when the eye confirms it,
record it at the size it shows; a lint that fires with nothing visible is recorded as severity 1 with the lint's name as
the note.

## stack: parts interfacing

The neck is drawn behind every garment; a collar, lapel or neckline never leaves skin standing as a column on the shirt.
A hat's hair is cut above its crown; no crescent of forehead between brim and hairline. Ears sit beside the eye line and
behind hair that falls over them. A beard wraps the jaw outline and the moustache sits on the lip. Glasses sit on the
nose at the eye line with their shadow. A hood frames the face, never a face stuffed in a bag. A finding here names the
two parts that meet wrong.

## anatomy: the body

Features on the face: eyes under the brow, nose between, mouth under the nose tip, chin on one line. Limbs attached and
inside the sheet; hands at the end of arms. A people's proportions are its own (`ANATOMY`): a dwarf is short and broad,
an elf tall and slight; a finding is a figure outside its own people's range, not outside a human's.

## expression: does it read

The named expression and nothing else: a grin has squint, a stare has the brow down, shut eyes are shut. A finding names
`expression:<name>` and what it reads as instead. A cast's own expressions (hunger, slackJaw) are judged as that cast's.

## pose: one body

A stance reads as one body standing that way: the head's tilt and lean belong to the same figure as the shoulder, the
hands match the stance's intent (claws clawed, hands up up). A stance that moves nothing visible is a finding
(`stance:<name>`). Where a body is in the frame is not judged here; there is one body.

## costume: the clothes

A garment is modelled (neckline thickness, a fold, the head's shadow on the chest, jacket over shirt) and coherent with
the cast. It hides what it should (skin under a top) and not what it should not (the face under a hood or hat). A
finding names the garment.

## style: the editorial brief

Eyes first: lid weight, visible sclera, the iris cut by the upper lid, depth under the brow; never white shape plus
circular iris plus outline. Noses tonal, not contour. Shadow tight at eyes and nose, large irregular planes on cheek and
forehead, nothing in some areas; never a uniform airbrush. Three or four coherent asymmetries per face; never a passport
rig. Stroke weight varies. One or two memorable details, not every system at once. A finding here is a face that reads
as an avatar: name the feature that does it. This is an editorial direction, not a checklist. Never add an asymmetry, a
shadow or a detail to reach a number. A face that is calm, symmetric and plain on purpose is a choice, not a finding; a
finding here names what reads as *generated*, not what is missing.

## render: the drawing itself

A stray line to a corner, a hole where a fill should be, a part drawn twice, a shape that is not closed, a NaN.
Severity by the size rule like every category: a stray line across the sheet is 3, a hairline gap in a fill is 1. Name the part the stray belongs to if it can be told, else `render:unknown`.

## Regressions

A fix is to the generator, not to the picture. After a fix, `harden related <id>` renders other combinations that draw the
same parts; a new fault there is a regression and the fix is not done. A fix that narrows what the generator can draw (a
part removed from a pool, a range pinned) must say so in its commit; variety is part of what is being hardened.

## Corrections

When the user corrects a judgment, the correction goes here, dated, as a rule the next reader follows.
