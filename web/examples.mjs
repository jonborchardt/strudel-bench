// The examples page is data: adding an example is an entry here, not UI code (examples.html renders every entry through one card).
// Example fields: title, blurb, tags, variants: [{ label, hll | src }], and optionally svg (an inline <svg>, shown at 219×135 on the
// left) and explain (HTML shown beside it). `src` fetches a file from songs/ instead of inlining the code. The expanded Strudel is
// generated in the browser on first show. `stub: true` renders a placeholder in the intended spot until a follow-up fills it in.
// Put a space before the slash of a self-closing svg tag: test/pages.test.mjs reads a quote followed by a slash as a root-absolute url.
export const layer = (name, attrs, cycles = 4) => `${name}(${attrs}, { cycles: ${cycles} })`;
export const lbh = (name, axis, lo = .1, hi = .9) => [
  { label: 'Low', hll: layer(name, `{ ${axis}: ${lo} }`) },
  { label: 'Baseline', hll: layer(name, '{}') },
  { label: 'High', hll: layer(name, `{ ${axis}: ${hi} }`) },
];
export const stub = (title, tags, blurb) => ({ title, tags, blurb, stub: true });

// 16-step grid, one row per density level, a playhead sweeping across (SMIL, no script)
const densitySvg = `<svg viewBox="0 0 219 135" xmlns="http://www.w3.org/2000/svg">
  <g fill="#c9d4ee">${[[0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]]
    .map((row, r) => row.map((i) => `<rect x="${8 + i * 13}" y="${20 + r * 38}" width="10" height="26" rx="2" />`).join('')).join('')}</g>
  <g fill="#6b6b6b" font-size="9" font-family="system-ui, sans-serif"><text x="8" y="14">low</text><text x="8" y="52">baseline</text><text x="8" y="90">high</text></g>
  <rect x="8" y="16" width="2" height="112" fill="#2f6fed"><animate attributeName="x" from="8" to="213" dur="4s" repeatCount="indefinite" /></rect>
</svg>`;

export const GROUPS = [
  { id: 'axes', title: 'Axes', blurb: 'Each axis is one perceptual dimension of one layer. 0.5 leaves the layer untouched; lower and higher values move it in a fixed direction. Compare low, baseline and high.', items: [
    { title: 'Density', tags: ['density', 'drums', 'structural'], blurb: 'Amount of musical activity: how many steps of the grid the drums fill.',
      svg: densitySvg, explain: 'The grid has 16 steps per bar. Density picks how many of them carry a hit, from the downbeats alone to every step; the pattern itself is otherwise the same.',
      variants: lbh('drums', 'density', .2, .9) },
    { title: 'Brightness', tags: ['brightness', 'pad', 'spectral'], blurb: 'Spectral character of the pad, dark to bright: the filter cutoff moves geometrically around its baseline.',
      variants: [{ label: 'Dark', hll: layer('pad', '{ brightness: .1 }') }, { label: 'Baseline', hll: layer('pad', '{}') }, { label: 'Bright', hll: layer('pad', '{ brightness: .9 }') }] },
    { title: 'Weight', tags: ['weight', 'bass', 'spectral'], blurb: 'Perceived low end and body of the bass.', variants: lbh('bass', 'weight', .2, .9) },
    { title: 'Space', tags: ['space', 'pad', 'spatial'], blurb: 'Dry and close to spacious: reverb amount and size on the pad.', variants: lbh('pad', 'space', .1, .95) },
    stub('Drive', ['drive', 'drums', 'structural'], 'Rhythmic insistence toward the pulse: where onsets fall and which are accented, not how many.'),
    stub('Articulation', ['articulation', 'bass'], 'Sustained and smooth to short and punchy.'),
    stub('Aggression', ['aggression', 'bass'], 'Smooth to abrasive: drive and distortion.'),
    stub('Groove', ['groove', 'drums', 'timing'], 'Rigid to swung.'),
    stub('Variation', ['variation', 'drums', 'structural'], 'Repetitive to variable; 0 is a pure loop.'),
    stub('Organicness', ['organicness', 'drums', 'timing'], 'Mechanical to humanized timing and level.'),
    stub('Width', ['width', 'melody', 'spatial'], 'Narrow to wide stereo image.'),
    stub('Register', ['register', 'melody', 'structural'], 'Low to high octave placement.'),
  ] },
  { id: 'descriptors', title: 'Descriptors', blurb: 'A descriptor is a named bundle of axis deltas (lib/descriptors.json), not hidden magic. "Dreamy" on a baseline pad is the same as writing the five numbers it expands to.', items: [
    { title: 'Dreamy', tags: ['descriptor', 'pad', 'space', 'articulation', 'drive'], blurb: 'dreamy = space +.35, articulation −.20, drive −.15, brightness −.05, variation +.10, applied to the baseline.',
      variants: [{ label: 'Baseline', hll: layer('pad', '{}') }, { label: 'Dreamy', hll: layer('pad', '{ space: .85, articulation: .3, drive: .35, brightness: .45, variation: .6 }') }] },
    { title: 'Punchy', tags: ['descriptor', 'drums', 'articulation', 'drive'], blurb: 'punchy = articulation +.40, weight +.15, drive +.20, space −.15.',
      variants: [{ label: 'Baseline', hll: layer('drums', '{}') }, { label: 'Punchy', hll: layer('drums', '{ articulation: .9, weight: .65, drive: .7, space: .35 }') }] },
    ...['Massive', 'Frantic', 'Delicate', 'Heavy', 'Spacious', 'Tight', 'Loose', 'Mechanical', 'Human'].map((d) => stub(d, ['descriptor'], `Shows which axes "${d.toLowerCase()}" moves and by how much.`)),
  ] },
  { id: 'modifiers', title: 'Modifiers', blurb: 'Modifiers scale a descriptor’s deltas: slightly ×0.5, (plain) ×1, much ×2, extremely ×3, and "less" flips the sign. Results clamp to 0..1.', items: [
    { title: 'Heavier, four ways', tags: ['modifier', 'heavy', 'bass', 'weight'], blurb: 'heavy = weight +.35, aggression +.15, register −.15. Each step scales those three deltas.',
      variants: [
        { label: 'Baseline', hll: layer('bass', '{}') },
        { label: 'slightly heavier', hll: layer('bass', '{ weight: .675, aggression: .575, register: .425 }') },
        { label: 'heavier', hll: layer('bass', '{ weight: .85, aggression: .65, register: .35 }') },
        { label: 'much heavier', hll: layer('bass', '{ weight: 1, aggression: .8, register: .2 }') },
        { label: 'extremely heavier', hll: layer('bass', '{ weight: 1, aggression: .95, register: .05 }') },
      ] },
    stub('Less bright, much less spacious', ['modifier', 'negative'], 'Negative forms: "less" flips the descriptor’s deltas before scaling.'),
  ] },
  { id: 'harmony', title: 'Harmony', blurb: 'Harmony is material, not an axis: a section has a key and a roman-numeral progression. Harmony words pick those (lib/harmony.json).', items: [
    { title: 'Major vs minor', tags: ['harmony', 'key', 'pad', 'bass'], blurb: 'Same section, the key’s mode changes.',
      variants: [{ label: 'C minor', hll: `song({ cps: .5, key: 'C:minor' }, [section('a', 4, { pad: {}, bass: {} })])` }, { label: 'C major', hll: `song({ cps: .5, key: 'C:major' }, [section('a', 4, { pad: {}, bass: {} })])` }] },
    { title: 'Resolved vs tense', tags: ['harmony', 'progression', 'pad', 'bass'], blurb: 'resolved = I IV V I, tense = i VII VI VII. The word becomes the progression string.',
      variants: [{ label: 'Resolved', hll: `song({ cps: .5, key: 'C:major' }, [section('a', 4, { progression: 'I IV V I', pad: {}, bass: {} })])` }, { label: 'Tense', hll: `song({ cps: .5, key: 'C:minor' }, [section('a', 4, { progression: 'i VII VI VII', pad: {}, bass: {} })])` }] },
    ...[['Pop', 'I V vi IV'], ['Epic', 'vi IV I V'], ['Circular', 'i VI III VII'], ['Static', 'i'], ['Unresolved', 'i VI VII']].map(([w, p]) => stub(w, ['harmony', 'progression'], `${w.toLowerCase()} = ${p}`)),
    stub('Relative major / minor', ['harmony', 'key'], 'Switch to the relative key: same notes, different home.'),
    stub('Modes', ['harmony', 'mode'], 'dorian, lydian, mixolydian, phrygian on the same root.'),
  ] },
  { id: 'sections', title: 'Section-level edits', blurb: 'The editing workflow: a request names a section, and only that section’s numbers move. Everything else stays byte-identical, so the change is easy to hear and easy to review.', items: [
    { title: 'Make the drop heavier', tags: ['section', 'heavy', 'drums', 'bass'], blurb: 'Two sections; "heavier" applied to the drop’s bass and drums. The intro is unchanged.',
      variants: [
        { label: 'Before', hll: `song({ cps: .5, key: 'C:minor', seed: 3 }, [\n  section('intro', 4, { drums: { density: .4 }, pad: { space: .7 } }),\n  section('drop', 4, { drums: { density: .8 }, bass: { weight: .5 }, pad: {} }),\n])` },
        { label: 'After', hll: `song({ cps: .5, key: 'C:minor', seed: 3 }, [\n  section('intro', 4, { drums: { density: .4 }, pad: { space: .7 } }),\n  section('drop', 4, { drums: { density: .8, weight: .85 }, bass: { weight: .85, aggression: .65, register: .35 }, pad: {} }),\n])` },
      ] },
    stub('Make the verse dreamier', ['section', 'dreamy'], 'Only the verse gains space and loses articulation and drive.'),
    stub('Make the second half brighter', ['section', 'brightness'], 'Brightness raised in every layer of the later sections only.'),
    stub('Make the chorus more spacious', ['section', 'space', 'width'], 'Space and width up in the chorus, the verse stays dry.'),
    stub('More variation in one section', ['section', 'variation'], 'Variation raised in the final drop without touching its twin.'),
  ] },
  { id: 'songs', title: 'Full songs', blurb: 'Sections, layers, axes, harmony and trajectories together. These play the files in songs/.', items: [
    { title: 'demo', tags: ['song', 'sections', 'trajectory', 'harmony'], blurb: 'intro → verse → drop. The verse melody’s brightness is a saw ramp; the drop switches progression.', variants: [{ label: 'demo.strudel', src: 'songs/demo.strudel' }] },
    { title: 'arc', tags: ['song', 'sections', 'key change'], blurb: 'Sad to happy over 40 cycles: intro → verse → lift → drop → outro, with a key change into the drop.', variants: [{ label: 'arc.strudel', src: 'songs/arc.strudel' }] },
    stub('Trajectories', ['trajectory', 'signal'], 'Brightness rising through a section, width opening, space swelling into a transition.'),
  ] },
];
