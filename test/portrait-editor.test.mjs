import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPortrait, portraitOps, DEFAULTS, NOSES, FACIAL_HAIR, FACIAL_HAIR_STYLES } from 'limner';
import { GROUPS, CONTROLS, POSE_NAMES, posePreset, THEMES, THEME_NAMES, JITTER, groupsFor, controlsFor, blank, base, params, encode, decode, setOv, at, expand, flat, report, presetMatch, idle } from '../web/visual/editor.mjs';
import { CASTS, CAST_MODULES } from 'limner';
const ELVES = CASTS.elves, { ELF_EARS, ELF_BUILD } = CAST_MODULES.elves;
import { FAMILIES } from 'limner';
import { ZOMBIE_NAMES, ZOMBIE_SKINS } from '../web/visual/thriller.mjs';

const state = (ov = {}, over = {}) => ({ ...blank(), ...over, ov });
const svg = (st) => renderPortrait(params(st)).replace(/c\d+/g, 'c'); // clip ids are document-global, so two renders of one face differ only there

test('every control names a parameter that exists, with the value in its range', () => {
  const p = params(state());
  for (const c of CONTROLS) {
    if (c.state || c.kind === 'preset') continue;
    const v = at(p, c.path);
    const parent = c.path.includes('.') && at(p, c.path.split('.').slice(0, -1).join('.'));
    assert.ok(v !== undefined || c.nullable || parent === null, `${c.path} is not a portrait parameter`);
    if (c.kind === 'num' && typeof v === 'number') assert.ok(v >= c.min && v <= c.max, `${c.path} = ${v} outside ${c.min}..${c.max}`);
    if (c.kind === 'enum' && !c.nullable && v !== undefined) assert.ok(c.options.includes(v), `${c.path} = ${v} not an option`);
    if (c.kind === 'multi') assert.ok((v ?? []).every((x) => c.options.includes(x)), `${c.path} has an unlisted name`);
  }
  assert.equal(new Set(GROUPS.map((g) => g.name)).size, GROUPS.length);
});

test('the hash is the whole face: encode/decode round trips and the same state draws the same portrait', () => {
  const st = state({ 'face.width': 170, 'hair.style': 'afroMedium', 'glasses': null, 'accessories': ['tie'] }, { seed: 4321, family: 'heavyBrow' });
  assert.deepEqual(decode(encode(st)), st);
  assert.deepEqual(decode('#' + encode(st)), st);
  assert.deepEqual(decode('not base64'), blank());
  assert.ok(svg(st) === svg(decode(encode(st))), 'the same hash draws the same portrait');
  assert.ok(svg(st) !== svg(state({}, { seed: 4322 })), 'another seed draws another portrait');
});

test('one edit changes one parameter', () => {
  const before = params(state());
  const after = params(state({ 'eyes.spacing': 61 }));
  const [a, b] = [flat(before), flat(after)];
  assert.deepEqual(Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])), ['eyes.spacing']);
  assert.equal(after.eyes.spacing, 61);
});

test('setOv drops the entries an edit contradicts', () => {
  assert.deepEqual(setOv(setOv({}, 'glasses', null), 'glasses.style', 'round'), { 'glasses.style': 'round' }); // a style un-nulls the object
  assert.deepEqual(setOv(setOv({}, 'glasses.style', 'round'), 'glasses', null), { glasses: null }); // and 'none' clears the style
  assert.deepEqual(expand({ 'face.asym.chin': 0.5, 'hat.style': 'cowboy' }), { face: { asym: { chin: 0.5 } }, hat: { style: 'cowboy' } });
});

test('the base character is the seed, constrained to a family when asked', () => {
  assert.deepEqual(base(7, 'any'), base(7, 'any'));
  assert.notDeepEqual(base(7, 'any'), base(8, 'any'));
  for (const fam of Object.keys(FAMILIES)) {
    const c = base(11, fam);
    assert.ok(FAMILIES[fam].eyes.includes(c.eyes.style) && FAMILIES[fam].noses.includes(c.nose.style), `${fam}: ${c.eyes.style}/${c.nose.style} is outside the family`);
  }
});

test('every option of every list draws', () => {
  for (const c of CONTROLS) {
    if (c.kind === 'enum' && !c.state) for (const o of c.options) renderPortrait(params(state({ [c.nullable && o === 'none' ? (c.clears ?? c.path) : c.path]: c.nullable && o === 'none' ? null : o })));
    if (c.kind === 'multi') for (const o of c.options) renderPortrait(params(state({ [c.path]: [o] })));
    if (c.kind === 'preset') for (const o of c.options) { const ov = {}; for (const [k, v] of Object.entries(c.apply(o))) setOv(ov, k, v); renderPortrait(params(state(ov))); }
  }
  for (const c of CONTROLS) if (c.kind === 'num' && !c.state) for (const v of [c.min, c.max]) renderPortrait(params(state({ [c.path]: v })));
});

test('a preset reads back as itself, and the report says what the face is', () => {
  const shape = CONTROLS.find((c) => c.path === 'shape'), expr = CONTROLS.find((c) => c.path === 'expression');
  for (const c of [shape, expr]) {
    const ov = {}; for (const [k, v] of Object.entries(c.apply(c.options[1]))) setOv(ov, k, v);
    assert.equal(presetMatch(c, params(state(ov))), c.options[1]);
  }
  const txt = report(state({ 'hair.style': 'bob' }), 'the hair is bad', 'http://x/#abc');
  assert.match(txt, /the hair is bad/);
  assert.match(txt, /hair: bob/);
  assert.match(txt, /edits: hair\.style="bob"/);
  assert.match(txt, /link: http:\/\/x\/#abc/);
});

test('a theme in the editor: off, the menus are the editorial ones; on, they gain the theme\'s parts and a preset of its characters, every option draws, and the hash carries it', () => {
  assert.equal(blank().theme, 'none'); assert.deepEqual(THEME_NAMES, ['none', ...Object.keys(THEMES)]);
  assert.deepEqual(groupsFor(state()), GROUPS, 'no theme: the editorial groups themselves');
  const zombie = (name) => ['top.style', 'hair.style', 'makeup', 'costume', 'expression', 'mouth.teeth'].map((p) => CONTROLS.find((c) => c.path === p)).every((c) => !c.options.some((o) => Object.values(THEMES.thriller.extras).flat().includes(o)));
  assert.ok(zombie(), 'CONTROLS lists no theme part'); assert.ok(!CONTROLS.some((c) => c.path === 'undead' || c.path === 'zombie'));
  const on = state({}, { theme: 'thriller' }), cs = controlsFor(on);
  for (const [path, extra] of Object.entries(THEMES.thriller.extras)) { const c = cs.find((x) => x.path === path); assert.ok(c && extra.length && extra.every((o) => c.options.includes(o)), `${path} offers ${extra.join(', ')}`); }
  // the menus are built from the tags, not from a hand-written list: the 80s clothes (era:80s, shared) and the rot (only:undead) reach the menus they belong to
  assert.ok(cs.find((c) => c.path === 'top.style').options.includes('leotard') && cs.find((c) => c.path === 'makeup').options.includes('rotLips') && cs.find((c) => c.path === 'mouth.teeth').options.includes('rotten') && cs.find((c) => c.path === 'hat.style').options.includes('veil') && cs.find((c) => c.path === 'costume').options.includes('bride') && cs.find((c) => c.path === 'expression').options.includes('hunger'));
  const zp = cs.find((c) => c.path === 'undead'); assert.ok(zp && zp.kind === 'preset' && zp.options.length === ZOMBIE_NAMES.length, 'one preset per cast archetype, named by the cast');
  THEMES._bare = { extras: {}, presets: [] }; try { assert.equal(groupsFor(state({}, { theme: '_bare' })).length, GROUPS.length, 'a theme whose cast has no presets still builds a panel'); } finally { delete THEMES._bare; }
  for (const c of cs) {
    if (c.kind === 'enum' && !c.state) for (const o of c.options) renderPortrait(params(state({ [c.nullable && o === 'none' ? (c.clears ?? c.path) : c.path]: c.nullable && o === 'none' ? null : o }, { theme: 'thriller' })));
    if (c.kind === 'multi') for (const o of c.options) renderPortrait(params(state({ [c.path]: [o] }, { theme: 'thriller' })));
    if (c.kind === 'preset') for (const o of c.options) { const ov = {}; for (const [k, v] of Object.entries(c.apply(o))) setOv(ov, k, v); const svg = renderPortrait(params(state(ov, { theme: 'thriller' }))); assert.ok(svg.startsWith('<svg') && !/NaN/.test(svg), `${c.path} ${o}`); }
  }
  const ov = {}; for (const [k, v] of Object.entries(zp.apply('bride'))) setOv(ov, k, v);
  const p = params(state(ov, { theme: 'thriller' }));
  assert.ok(ZOMBIE_SKINS.includes(p.skin) && p.mouth.teeth === 'rotten' && p.makeup.includes('rotLips') && p.hat.style === 'veil' && p.top.style === 'laceGown', 'the zombie preset writes the whole person');
  assert.equal(presetMatch(zp, p), 'bride', 'and reads back');
  const st = state(ov, { seed: 9, theme: 'thriller' }); assert.deepEqual(decode(encode(st)), st); assert.equal(decode(encode(st)).theme, 'thriller');
  assert.match(report(st, '', 'http://x/#h'), /theme thriller/);
  assert.equal(decode(encode(state())).theme, 'none', 'and a plain state stays plain');
});

test('randomize is of the theme that is on, and moves every parameter that makes sense', () => {
  const plain = base(11), elf = base(11, 'any', 'elves');
  assert.equal(plain.ears?.pointed ?? 0, 0, 'with no theme it is a random person: round ears');
  assert.ok(elf.ears.pointed >= ELF_EARS[0] && ELVES.pools.tops.includes(elf.top.style), 'with the elves on it is a random elf: the cast\'s ears, the cast\'s clothes');
  assert.deepEqual(elf.build, ELF_BUILD, 'and the cast\'s build, which the draw leaves alone');
  assert.deepEqual(base(11, 'any', 'elves'), elf, 'the same seed and theme is the same person');
  assert.notDeepEqual(base(12, 'any', 'elves'), elf, 'the next seed is another');
  assert.notDeepEqual(base(11, 'any', 'dwarves'), elf, 'and another theme is another cast');
  assert.equal(base(5, 'squareJaw', 'thriller').mouth.teeth, 'rotten', 'choosing a skull does not cost a cast its signature');
  // what the generators leave at the portrait's default, randomize draws: every one of them moves between seeds
  for (const path of Object.keys(JITTER)) {
    const seen = new Set();
    for (let s = 1; s <= 40; s++) seen.add(JSON.stringify(at(base(s), path)));
    assert.ok(seen.size > 1, `${path} is the same on all forty faces`);
  }
  // and nothing it draws leaves its slider's range
  for (let s = 1; s <= 40; s++) { const p = params({ ...blank(), seed: s, ov: {} });
    for (const c of CONTROLS) { if (c.state || c.kind !== 'num') continue; const v = at(p, c.path); if (typeof v === 'number') assert.ok(v >= c.min && v <= c.max, `seed ${s}: ${c.path} = ${v} outside ${c.min}..${c.max}`); }
    for (const c of CONTROLS) if (c.kind === 'multi') assert.ok((at(p, c.path) ?? []).every((x) => c.options.includes(x)), `seed ${s}: ${c.path} has an unlisted name`);
  }
});

test('a cast preset writes the whole person, so picking one cast after another sets back what the last one left: its ears and its build, always', () => {
  const presetFor = (theme, path) => controlsFor(state({}, { theme })).find((c) => c.path === path);
  const applied = (c, option) => { const ov = {}; for (const [k, v] of Object.entries(c.apply(option))) setOv(ov, k, v); return ov; };
  const elf = applied(presetFor('elves', 'elves'), 'moonsinger'), dwarf = applied(presetFor('dwarves', 'dwarves'), 'ironBrow'), zombie = applied(presetFor('thriller', 'undead'), 'bride');
  for (const [who, ov] of [['an elf', elf], ['a dwarf', dwarf], ['a zombie', zombie]]) { assert.ok('ears.pointed' in ov, `${who} writes its ears`); assert.ok('build.legs' in ov, `${who} writes its build`); }
  assert.ok(elf['ears.pointed'] >= 0.7, 'an elf is pointed-eared');
  assert.ok(dwarf['ears.pointed'] <= 0.2 && zombie['ears.pointed'] === 0, 'a dwarf and a zombie are not: elf ears do not survive the switch');
  assert.ok(elf['build.legs'] > 1 && dwarf['build.legs'] < 0.7 && zombie['build.legs'] === 1, 'and a cast with no build of its own writes the portrait\'s back');
  assert.deepEqual(applied(presetFor('elves', 'elves'), 'moonsinger'), elf, 'a preset is the same person every time, so a signature drawn by a rule still reads back as itself');
  assert.equal(presetMatch(presetFor('elves', 'elves'), params(state(elf, { theme: 'elves' }))), 'moonsinger');
});

test('the idle animation drifts the pose, moves the gaze and blinks, and never leaves the sliders behind', () => {
  const p = params(state()), lim = CONTROLS.filter((c) => c.kind === 'num' && /^(pose|eyes\.look|eyes\.brow|mouth\.(smile|open|fullness))/.test(c.path));
  assert.deepEqual(idle(p, 3.7), idle(p, 3.7)); // deterministic: the same second is the same face
  const at2 = idle(p, 2), at9 = idle(p, 9);
  assert.notDeepEqual(at2.pose, at9.pose);
  assert.notDeepEqual(at2.eyes.look, at9.eyes.look);
  assert.notDeepEqual(at2.mouth, at9.mouth); // the expression drifts too: mouth and brows
  assert.notEqual(at2.eyes.browLift, at9.eyes.browLift);
  let shut = 0;
  for (let t = 0; t < 30; t += 0.02) {
    const q = idle(p, t);
    shut += q.eyes.openness < p.eyes.openness * 0.3 ? 1 : 0;
    for (const c of lim) assert.ok(at(q, c.path) >= c.min && at(q, c.path) <= c.max, `${c.path} ${at(q, c.path)}`);
    if (t % 1 < 0.02) renderPortrait(q);
  }
  assert.ok(shut > 5 && shut < 200, `blinks: ${shut} frames shut`);
});

// --- the dials added for matching a face to a photograph: the beard's own colour and density, the hairline,
// the cheeks' weight, the smile's squint, the print on the chest, and the gaze through a turn ---

test('the moustache belongs to the features: under the nose, above the lip, and it travels with them on a turned head', () => {
  const stache = (o) => portraitOps({ facialHair: { style: 'mustache' }, ...o }).filter((x) => x.stache);
  const xOf = (ops) => +ops[0].d.match(/-?[\d.]+/)[0];
  assert.equal(stache({}).length, 1);
  for (const turn of [-1, 1]) {
    const moved = xOf(stache({ pose: { turn } })) - xOf(stache({}));
    assert.equal(moved, 12 * turn, `a turn of ${turn} slides the moustache with the mouth, not with the jaw`); // the beard's mass travels 8, the features 12: before this the moustache went with the mass and came off the lip
  }
  const yOf = (ops) => ops[0].d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2); // every y in the path
  const noseBottom = (nose) => DEFAULTS.eyes.y + 10 + (NOSES[nose.style].len + NOSES[nose.style].tip * 1.1) * (nose.length / 38);
  for (const nose of [{ style: 'short', length: 30 }, { style: 'long', length: 52 }]) for (const mouth of [{ y: 268 }, { y: 292, fullness: 1, style: 'full' }]) {
    const ys = yOf(stache({ nose, mouth })), what = JSON.stringify({ nose, mouth });
    if (noseBottom(nose) + 10 < mouth.y - 8) assert.ok(Math.min(...ys) >= noseBottom(nose), `the moustache hangs from the nose, wherever the nose ends (${what})`); // where there is a gap to hang in
    assert.ok(Math.max(...ys) < mouth.y, `and stops above the lip (${what})`);
  }
  const squeezed = yOf(stache({ nose: { style: 'long', length: 52 }, mouth: { y: 250 } })); // a nose that runs down to the lip leaves no gap: the hair is squeezed, never drawn over the mouth
  assert.ok(Math.max(...squeezed) < 250 && Math.max(...squeezed) - Math.min(...squeezed) >= 8);
});

test('the beard takes a colour, a density, a cheek line and a moustache of its own', () => {
  const ops = (f) => portraitOps({ facialHair: { style: 'shortBeard', ...f }, hairColor: '#123123' });
  const band = (f) => ops(f).filter((o) => o.k === 'path' && / 700/.test(o.d)).at(-1); // the mass is the band that runs off the bottom of the sheet, drawn after the shirt that does the same
  assert.equal(band({}).fill, '#123123', 'the beard is the hair colour by default');
  assert.equal(band({ color: '#a05020' }).fill, '#a05020', 'a beard colour of its own, apart from the hair');
  // density is how much hair, drawn as the skin showing between it, never as a transparent beard (which shows the mouth through itself)
  const near = (a, b) => [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0);
  const thin = band({ density: 0.15 }), thick = band({ density: 1 });
  assert.ok((thin.op ?? 1) === 1 && (thick.op ?? 1) === 1, 'every density is opaque');
  assert.ok(near(thin.fill, DEFAULTS.skin) < near(thick.fill, DEFAULTS.skin), 'a thin beard is nearer the skin, a full one is the hair');
  assert.equal(thick.fill, '#123123');
  assert.equal(ops({ mustache: false }).filter((o) => o.stache).length, 0);
  assert.equal(portraitOps({ facialHair: { style: 'heavyStubble', mustache: true } }).filter((o) => o.stache).length, 3, 'and a stubble carries one: the moustache itself plus the strip down each corner of the mouth that joins it to the mass'); // stubble grows on the upper lip too, so it is the default for every stubble now
  assert.equal(portraitOps({ facialHair: { style: 'mustache' } }).filter((o) => o.stache).length, 1, 'a moustache with no beard under it has nothing to join to');
  const high = band({ cheekLine: 1 }), low = band({ cheekLine: 0 });
  assert.ok(Math.min(...high.d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2)) < Math.min(...low.d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2)), 'the cheek line climbs');
  for (const s of FACIAL_HAIR_STYLES) assert.ok(Array.isArray(FACIAL_HAIR[s](DEFAULTS)), s); // every style still answers as a function of the face
});

test('the hairline, the cheeks, the squint, the print and the gaze', () => {
  const lowest = (ops, fill) => Math.max(...ops.filter((o) => o.fill === fill && !o.brow).flatMap((o) => (o.d ?? '').match(/-?[\d.]+/g)?.map(Number).filter((_, i) => i % 2) ?? []));
  const hair = (h) => lowest(portraitOps({ hair: { style: 'sidePart', ...h }, hairColor: '#123123' }), '#123123');
  assert.ok(hair({ hairline: 1 }) < hair({}) && hair({ hairline: -1 }) > hair({}), 'the hairline moves up and down the forehead');
  assert.ok(hair({ recession: 1 }) < hair({}), 'and the temples retreat');
  // the face path is M crown, then one cubic down to the cheek: its end point is where the cheek sits (to the left of centre, so wider is smaller)
  const cheek = (fn) => portraitOps({ face: { fullness: fn } }).find((o) => o.fill === DEFAULTS.skin && o.d?.startsWith('M 200 112')).d.match(/-?[\d.]+/g).map(Number)[6];
  const temple = (fn) => portraitOps({ face: { fullness: fn } }).find((o) => o.fill === DEFAULTS.skin && o.d?.startsWith('M 200 112')).d.match(/-?[\d.]+/g).map(Number)[2];
  assert.ok(cheek(1) < cheek(0) && cheek(-1) > cheek(0), 'fullness puts weight on the cheek');
  assert.equal(temple(1), temple(0), 'and none on the temple, which is bone');
  const aperture = (sq) => { const o = portraitOps({ eyes: { squint: sq } }).find((x) => x.k === 'path' && x.fill?.startsWith('#') && / Q /.test(x.d) && x.d.split('Q').length === 3); return o; };
  assert.notEqual(JSON.stringify(aperture(0)), JSON.stringify(aperture(1)), 'the squint closes the eye from below');
  const print = (t) => portraitOps({ top: { style: 'crewTshirt', graphic: 'concentric', ...t } }).filter((o) => o.k === 'ellipse' && o.cy > 380 && o.cy < 600); // on the chest: the shoes are ellipses too, lower down
  assert.equal(print({ graphicColor: '#ff0000' })[0].stroke, '#ff0000');
  assert.ok(print({ graphicScale: 2 })[0].rx > print({})[0].rx * 1.9 && print({ graphicY: 40 })[0].cy - print({})[0].cy === 40, 'the print sizes and moves on the chest');
  const iris = (pose) => portraitOps({ pose, eyes: { iris: '#abcdef' } }).find((o) => o.fill === '#abcdef').cx;
  assert.ok(iris({ turn: -1, gaze: 'camera' }) > iris({ turn: -1 }), 'the gaze stays on the viewer through a turn');
  assert.equal(iris({ gaze: 'camera' }), iris({}), 'and changes nothing on a square head');
});


// The pose menu is limner's stances now, not the tableau's layoutOf -- the editor used to import a world to find out
// how a body stands, which was the one backwards edge in the visual graph.
test('the pose menu is limner\'s editorial stances, in the order it always offered them', () => {
  assert.deepEqual(POSE_NAMES, ['directFrontal', 'slightLeanLeft', 'slightLeanRight', 'swaggerLean', 'statueStill', 'handsAtSides', 'handHeart', 'handsUp']);
});

test('a pose preset writes the whole stance and nothing else -- never a blocking field', () => {
  assert.deepEqual(Object.keys(posePreset('handsUp')).sort(), ['pose.bodyTilt', 'pose.headTilt', 'pose.headX', 'pose.headY', 'pose.shoulder', 'pose.turn', 'props']);
  assert.deepEqual(posePreset('handsUp').props, ['handsUp']);
  assert.equal(posePreset('swaggerLean')['pose.headX'], 14, 'the stance comes through');
  assert.ok(!('dx' in posePreset('swaggerLean')), 'but its dx does not: this editor draws one figure, so blocking is meaningless here');
  assert.deepEqual(posePreset('directFrontal'), { 'pose.headX': 0, 'pose.headY': 0, 'pose.headTilt': 0.02, 'pose.bodyTilt': 0, 'pose.turn': 0.15, 'pose.shoulder': 0.3, props: [] });
});

test('a themed stance is offered and writable: the claw is a pose the editor can set', () => {
  const UNDEAD_THEME = THEMES.undead ?? THEMES.thriller; // keyed by theme name until T6 re-keys the editor's themes by cast
  assert.ok(UNDEAD_THEME.extras.pose.includes('thrillerClaw'), 'the undead cast puts its stances on the menu');
  assert.ok(!UNDEAD_THEME.extras.pose.includes('hordeLine'), 'and not its dance\'s blocking');
  assert.deepEqual(posePreset('thrillerClaw').props, ['clawHands']);
  assert.equal(posePreset('thrillerClaw')['pose.turn'], 0.2);
});
