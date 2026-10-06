// The figure itself: every part style draws finite numbers as SVG and on a canvas, an ear comes to a point from the lobe
// rather than having one stuck beside it, a hairline meets the head on every face shape, and a part tagged only:<cast>
// reaches no pool that did not ask for it. These assertions came out of the host's faces-world test, where they had
// grown up around a world that only happened to draw portraits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portraitOps, renderPortrait, toSvg, tracePath, drawOn, eyeY, mouthY, feetY, mapXY, hatWidth, HAT_TUCK, HAIR_STYLES, HAT_STYLES, TOP_STYLES, FACIAL_HAIR_STYLES, EYE_STYLES, BROW_STYLES, NOSE_STYLES, MOUTH_STYLES, GLASSES_STYLES, JACKET_STYLES, ACCESSORY_STYLES, DETAIL_STYLES, HEAD_DY, EAR_POINT, FACE_SHAPES, tag, tagsOf, parts, REGISTRIES, CASTS, identityFrom, dress, seed, prng } from '../index.mjs';
import '../registry.mjs'; // every cast and pack registers and tags its parts, so the only:* assertions have something to keep out
import { ctxStub } from './_stub.mjs';

// an eye's lid clip: a Q curve up on the face, not the neckline opening's own Q curve down on the chest
const isLid = (o) => o.k === 'clip' && /^M [\d.]+ [\d.]+ Q/.test(o.d) && +o.d.split(' ')[2] < 300;

test('every part style draws finite numbers, as SVG and on a canvas', () => {
  const of = (key, styles) => styles.map((s) => ({ [key]: { style: s } }));
  const styles = [...of('hair', HAIR_STYLES), ...of('hat', HAT_STYLES), ...of('top', TOP_STYLES), ...of('jacket', JACKET_STYLES), ...of('facialHair', FACIAL_HAIR_STYLES), ...of('eyes', EYE_STYLES), ...BROW_STYLES.map((s) => ({ eyes: { browStyle: s } })), ...of('nose', NOSE_STYLES), ...of('mouth', MOUTH_STYLES), ...of('glasses', GLASSES_STYLES),
    ...ACCESSORY_STYLES.map((s) => ({ accessories: [s] })), ...DETAIL_STYLES.map((s) => ({ details: [s] })), { mouth: { open: .8 } }, { mouth: { smile: .9 } }, { mouth: { style: 'full', open: .5 } }];
  assert.ok(HAIR_STYLES.length >= 20 && HAT_STYLES.length >= 12 && TOP_STYLES.length >= 9 && JACKET_STYLES.length >= 7 && EYE_STYLES.length === 7 && NOSE_STYLES.length === 8, 'the wardrobe is there');
  for (const o of styles) {
    const ops = portraitOps(o), svg = toSvg(ops);
    assert.ok(ops.length > 20 && !/NaN|undefined/.test(JSON.stringify(ops)), JSON.stringify(o));
    assert.ok(svg.startsWith('<svg') && svg.includes('<path'), 'svg');
    const ctx = ctxStub(); drawOn(ctx, ops); assert.ok(ctx.calls.fill > 10 && ctx.calls.stroke > 5, 'painted');
  }
  assert.ok(renderPortrait({ background: '#123' }).includes('fill="#123"'), 'the background rect');
  const ops = portraitOps({ face: { width: 176 } }), ear = ops.find((o) => o.k === 'ellipse' && o.ry === 27);
  assert.equal(ear.cx, 200 - 88, 'the ears, hair and hat follow the face width');
  const hatted = portraitOps({ hair: { style: 'afroMedium' }, hat: { style: 'baseballCap', color: '#123456' } }), at = hatted.findIndex((o) => o.k === 'clip' && o.d.startsWith('M -100 900') && / 137 L [\d.]+ 137 L /.test(o.d)); // the crown line at 137 between the cap's edges, then the slants out to the sides
  const afro = hatted.findIndex((o) => o.k === 'ellipse' && o.rx === 96), end = hatted.findIndex((o, i) => i > at && o.k === 'unclip');
  assert.ok(at > 0 && afro > at && afro < end, 'under a hat the hair is clipped to below the crown line: its mass above is inside the hat');
  assert.ok(!hatted.some((o) => o.k === 'ellipse' && o.fill === '#123456' && o.rx === 96), 'the cap does not take the afro\'s shape');
  const skirt = hatted.findIndex((o) => o.k === 'clip' && o.d === `M -100 -200 L 500 -200 L 500 137 L -100 137 Z`);
  const own = hatted.find((o, i) => i > hatted.findIndex((x, j) => j > skirt && x.k === 'unclip') && o.k === 'path' && o.fill === '#123456'); // the hat itself, after the skirt's clip closes: its size is the hair's business (a big style pushes it out), so the skirt is checked against it, not against a pinned number
  assert.ok(skirt > at && hatted[skirt + 1].fill === '#123456' && hatted[skirt + 1].d === mapXY([own], (x) => x, (y) => y + HAT_TUCK)[0].d, 'the hat wears a skirt of its own shape HAT_TUCK lower, clipped above its line, to fill the crescent under its arched edge');
  const big = (h) => { const ops = portraitOps({ hair: { style: h }, hat: { style: 'baseballCap', color: '#123456' } }); return hatWidth(ops.filter((o) => o.fill === '#123456' && o.k === 'path'), 137); };
  assert.ok(big('afroMedium') > big('sidePart') && big('afroMedium') < big('sidePart') * 1.3, 'a hat goes over the hair, not the skull: a big style pushes it out a little, and only a little');
  // and it sits on what is under it: a bald or buzzed head has none of the hair the hat is drawn over, so the hat comes down the head instead of floating over hair that is not there (a thin style is measured by its top, since its crown line has moved off 137)
  const top = (h) => Math.min(...portraitOps({ hair: { style: h }, hat: { style: 'baseballCap', color: '#123456' } }).filter((o) => o.fill === '#123456' && o.k === 'path').flatMap((o) => o.d.match(/-?[\d.]+/g).filter((_, i) => i % 2).map(Number)));
  assert.ok(top('bald') - top('sidePart') > 10 && Math.abs(top('bald') - top('buzz')) < 3 && top('bald') - top('crewCut') > 5 && top('afroMedium') < top('sidePart'), 'a hat seats itself on a bald, buzzed or thin head, and a big style still pushes it up');
  assert.ok(big('bob') > big('sidePart') && big('longStraight') > big('sidePart'), 'a bob and long hair go over the hat line too: left at the skull size, their cut shows past the hat as a shelf at the temple');
  assert.equal(portraitOps({ hair: { style: 'afroMedium' } }).filter((o) => o.k === 'clip').length, 13, 'without a hat the eyes, the neck twice (once behind the clothes and once through the neckline), the neckline opening, the top and the jacket to the trunk, the cloth, the planes, the light, the hairline shadow and the hair texture clip (an afro textures its back and its front)');
  assert.ok(portraitOps({ light: { amount: 1 } }).some((o) => o.fill === '#fff' && o.k === 'path' && o.op === 0.035), 'the soft light is a pale plane over the front of the face');
  const flat = portraitOps({ light: { amount: 0 } }); assert.ok(flat.filter((o) => o.k === 'clip').length === 11, 'a flat face has no light clip (the trunk clips for the top and the jacket count)');
  const through = portraitOps({}).filter((o) => o.k === 'clip' && o.d === 'M 161 361 Q 200 389 239 361 L 239 240 L 161 240 Z'); // the neckline curve closed upward, not on its own chord
  assert.equal(through.length, 1, 'the crew neckline is an opening: the neck is drawn again through it, so skin shows inside the curve instead of the curve sitting on the cloth');
  assert.equal(portraitOps({ top: { style: 'turtleneck' } }).filter((o) => o.k === 'clip' && / Z$/.test(o.d) && o.d.startsWith('M 1') && o.d.includes('Q 200 3')).length, 0, 'a turtleneck has no opening: its collar covers the neck');
  const tall = portraitOps({ face: { height: 230 } }), lidOf = (o) => o.find((x) => isLid(x)).d, mouthOf = (o) => o.find((x) => x.k === 'path' && x.stroke === '#4c2d28').d;
  assert.ok(lidOf(tall).startsWith('M 188 206.7') && mouthOf(tall).startsWith('M 176 278.8') && lidOf(portraitOps({})).startsWith('M 188 196') && mouthOf(portraitOps({})).startsWith('M 176 260'), 'the eyes and mouth are laid out by the face height: a long face is long between its features');
  assert.equal(Math.round(eyeY({ face: { height: 230 } }) * 10) / 10, 180.7, 'eyeY says where the eye line landed on the sheet: laid out down the taller face, then the whole head moved up the neck so the chin sits where every chin sits'); assert.equal(eyeY({}), 196);
  const chinOf = (o) => { const g = o.find((x) => x.k === 'push' && x.cy === 308); return g.ty + 112 + 230 + 16 * 0.2; }; assert.equal(Math.round(chinOf(portraitOps({ face: { height: 230 } })) * 10) / 10, 327.2, 'a tall face\'s chin lands on the same line as the default\'s');
  const bearded = portraitOps({ facialHair: { style: 'fullBeard' }, face: { width: 180, height: 204, jaw: 0.67, chin: 0.1, corner: 40 } }), bandAt = bearded.findIndex((o) => o.fill === '#30231e' && o.k === 'path' && o.d.includes(' 700 '));
  assert.ok(bandAt > 0 && bearded[bandAt - 1].k === 'clip' && bearded[bandAt - 1].d.startsWith('M 200 '), 'a beard is a band cut to this face\'s own outline, let out');
  const stache = (smile) => portraitOps({ facialHair: { style: 'mustache' }, mouth: { smile } }).find((o) => o.k === 'path' && o.fill === '#30231e' && !o.brow).d.split(' ').map(Number); // the brows are hair-coloured fills too (tapered), so skip them
  const rest = stache(0), smiled = stache(0.9), moved = rest.map((v, i) => Math.abs(v - smiled[i])).filter(Number.isFinite);
  assert.ok(Math.max(...moved) > 3, 'the moustache rides the lip: a smile bows it down with the lip line');
  assert.ok(Math.abs(rest[1] - smiled[1]) < 0.01, 'and its outer tip stays pinned where the nose holds it');
  assert.ok(portraitOps({ light: { contrast: 2 } }).find((o) => o.k === 'ellipse' && o.fill === '#4a2418' && o.ry === 7).op === 0.16 && portraitOps({}).find((o) => o.k === 'ellipse' && o.fill === '#4a2418' && o.ry === 7).op === 0.08, 'contrast deepens the planes (the tableau\'s dial), 1 is the default');
  const long = portraitOps({ hair: { style: 'longStraight' } }), firstPop = long.findIndex((o) => o.k === 'pop');
  assert.ok(long.slice(0, firstPop).some((o) => o.k === 'path' && o.d.includes('L 294 350')), 'long hair puts a sheet behind the neck before the front frame');
  assert.ok(firstPop < long.findIndex((o) => o.k === 'path' && o.d.includes('L 340 700')), 'and behind the shirt');
  const asym = portraitOps({ eyes: { asym: 0.8, browSkew: 0.4 } }), lids = asym.filter(isLid);
  assert.ok(lids[0].d.includes('Q 172 188.8') && lids[1].d.includes('Q 228 187 '), 'the left eye opens 80% as far as the right, each lid peaking toward its outer corner');
  assert.ok(portraitOps({ eyes: { dy: 3 } }).filter(isLid)[0].d.startsWith('M 188 199'), 'one eye sits lower than the other');
  const nostril = (o) => o.find((x) => x.k === 'path' && x.fill === '#543c2c' || x.fill === '#1d1310'), n20 = nostril(portraitOps({})), n30 = nostril(portraitOps({ nose: { width: 30 } }));
  assert.ok(n20.d.startsWith('M 194.5 247.9') && n30.d.startsWith('M 191.75 247.9'), 'the nose is tone (a nostril shadow), scaled to its width');
  assert.ok(!portraitOps({}).some((o) => o.stroke && o.k === 'path' && o.d.startsWith('M 199 205')), 'no line traces the bridge');
  assert.equal(nostril(portraitOps({ skin: '#452d27' })).fill, '#1d1310', 'the nostril on deep skin is darker than the skin, not the light-skin brown');
  assert.equal(ops.filter((o) => o.k === 'clip').length, 12, 'each iris is clipped to its lids, the neck\'s shading to the neck (twice: behind the clothes and through the neckline), the neckline opening, the cloth to the shirt, the planes, the light and the hair shadow to the face, the strands to the hair'); assert.ok(toSvg(ops).includes('<clipPath'));
  const cc = ctxStub(); drawOn(cc, ops); assert.equal(cc.calls.clip, 12); // the trunk clips for the top and the jacket, since the portrait is a figure (2026-10-04)
  const shells = (o) => { const e = portraitOps(o).filter((x) => x.k === 'ellipse' && x.ry === 27); return { near: { out: 200 - (e[0].cx - e[0].rx), w: e[0].rx }, far: { out: e[1].cx + e[1].rx - 200, w: e[1].rx } }; }; // each ear's reach past the centre and its drawn width
  const square = shells({}), swung = shells({ pose: { turn: 0.8 } });
  const half = FACE_SHAPES.oval.width / 2; // where the outline runs: an ear inside it is covered by the head, which is drawn after
  assert.ok(square.far.out > half && swung.far.out < half, 'square on, an ear shows past the outline; turned toward +x the +x one swings in behind the head');
  assert.ok(swung.far.w < square.far.w * 0.7, 'and foreshortens as it goes, instead of staying a full ear beside the outline');
  assert.ok(swung.near.out > square.near.out && swung.near.w > square.near.w, 'while the near one comes forward: clear of the outline and a little fuller');
  const tip = (o) => Math.max(...portraitOps({ ...o, ears: { pointed: 1 } }).filter((x) => x.ear).flatMap((x) => x.d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2 === 0))) - 200;
  assert.ok(tip({ pose: { turn: 1 } }) < 60, `a pointed ear tucks its tip away too, where the head is narrow (${tip({ pose: { turn: 1 } })})`);
  assert.ok(portraitOps({ pose: { turn: 0.8 } }).some((o) => o.k === 'clip' && o.d.startsWith('M 197.6 196')), 'the features slide further than the outline');
  const sheared = portraitOps({ pose: { shoulder: 1 } }), torsoOf = (o) => o.find((x) => x.k === 'path' && x.d.endsWith('L 60 600 Z') || (x.k === 'path' && x.d.includes('L 340 ')));
  assert.notEqual(torsoOf(sheared).d, torsoOf(portraitOps({})).d, 'a dropped shoulder shears the torso');
  const tied = portraitOps({ top: { style: 'buttonDown' }, accessories: ['tie'] });
  assert.ok(tied.map((o) => !!o.collar).lastIndexOf(true) < tied.findIndex((o) => o.fill === '#b3202a'), 'the collar is drawn again over the neck, and the tie over it');
  const specs = portraitOps({ glasses: { style: 'round', color: '#abc' } });
  assert.ok(specs.findIndex((o) => o.stroke === '#000' && o.op === 0.16) < specs.findIndex((o) => o.stroke === '#abc'), 'glasses drop a shadow on the face under the frames');
  const irregular = portraitOps({ face: { asym: { cheek: 1, jaw: -1, temple: 1, chin: 1 } } }).find((o) => o.k === 'path' && o.d.startsWith('M 200 112')).d, regular = portraitOps({}).find((o) => o.k === 'path' && o.d.startsWith('M 200 112')).d;
  assert.ok(irregular !== regular && irregular.startsWith('M 200 112 C 140 110, 117 170,') && irregular.endsWith('266 110, 200 112 Z'), 'the asymmetries move one cheek, one jaw corner, one temple and the chin, and the other temple stays');
  const posed = portraitOps({ pose: { headX: 10, headTilt: 0.1, bodyTilt: -0.03 } }), pushes = posed.filter((o) => o.k === 'push');
  assert.equal(pushes.length, 5, 'the body group, the head group twice, the neck group twice (behind the clothes and through the neckline)'); assert.equal(posed.filter((o) => o.k === 'pop').length, 5);
  assert.ok(toSvg(posed).includes(`<g transform="translate(10 ${HEAD_DY}) rotate(`), 'the head sits down the neck and the pose prints as svg groups');
  assert.deepEqual([pushes[2].tx, pushes[2].rot, pushes[2].cy], [3, 0.1 * 0.15, 374], 'the neck slides 30% of the head\'s way and turns 15%, pivoting at its base');
  const pc = ctxStub(); drawOn(pc, posed); assert.equal(pc.calls.save, pc.calls.restore, 'every push and clip is restored');
  const ctx = ctxStub(); tracePath(ctx, 'M 1 2 L 3 4 C 1 2 3 4 5 6 Q 1 2 3 4 Z');
  assert.deepEqual([ctx.calls.moveTo, ctx.calls.lineTo, ctx.calls.bezierCurveTo, ctx.calls.quadraticCurveTo, ctx.calls.closePath], [1, 1, 1, 1, 1]);
});

test('a pointed ear is the ear, not a tip stuck beside it: one blade from the lobe to the point, and 0 is the round ear as it was', () => {
  const round = portraitOps({}), pointed = portraitOps({ ears: { pointed: 1 } });
  const shell = (ops) => ops.find((o) => o.k === 'ellipse' && o.rx === 15 && o.ry === 27);
  assert.ok(shell(round) && !shell(pointed), 'the round shell is an ellipse; a pointed ear replaces it, so there is no seam where a tip was stuck on');
  const blades = pointed.filter((o) => o.ear);
  assert.equal(blades.length, 2, 'one blade per ear');
  assert.equal(round.filter((o) => o.ear).length, 0, 'and none when the ears are round');
  const ys = (o) => o.d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2);
  for (const b of blades) { assert.equal(Math.min(...ys(b)), 185 - EAR_POINT, 'the tip rises EAR_POINT above the round ear\'s top of 185'); assert.ok(Math.max(...ys(b)) >= 239, 'and the lobe is still the ear\'s own bottom'); }
  assert.equal(Math.min(...ys(blades[0])), Math.min(...ys(blades[1])), 'both ears point as high as each other');
  const xs = (o) => o.d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2 === 0);
  assert.ok(Math.min(...xs(blades[0])) <= 107 && Math.max(...xs(blades[1])) >= 293, 'and each reaches at least as far out as the round ear did');
  const half = portraitOps({ ears: { pointed: 0.5 } }).filter((o) => o.ear);
  assert.ok(Math.min(...ys(half[0])) > Math.min(...ys(blades[0])) && Math.min(...ys(half[0])) < 185, 'the dial is continuous: half as pointed is half as tall');
  assert.ok(!/NaN|Infinity/.test(JSON.stringify([...pointed, ...half])));
  const big = portraitOps({ ears: { pointed: 1, size: 1.4 } }).filter((o) => o.ear);
  assert.ok(Math.min(...ys(big[0])) < Math.min(...ys(blades[0])), 'a bigger ear points higher: the blade scales with the ear, as the round shell does');
  const ctx = ctxStub(); drawOn(ctx, pointed); assert.equal(ctx.calls.save, ctx.calls.restore);
});

test('every hairline meets the head: no background between the front hair and the face on any face shape', () => {
  // the face and the front hair rasterized on a coarse grid over the forehead and temples: a cell that is neither, with hair just above and face just below, is a gap
  const poly = (d) => { const pts = []; let cur; const bez = (p0, p1, p2, p3) => { for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t, f = (k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]; pts.push([f(0), f(1)]); } cur = p3; };
    tracePath({ moveTo: (x, y) => pts.push(cur = [x, y]), lineTo: (x, y) => pts.push(cur = [x, y]), bezierCurveTo: (a, b, c, d, e, f) => bez(cur, [a, b], [c, d], [e, f]), quadraticCurveTo: (a, b, c, d) => bez(cur, [cur[0] + 2 / 3 * (a - cur[0]), cur[1] + 2 / 3 * (b - cur[1])], [c + 2 / 3 * (a - c), d + 2 / 3 * (b - d)], [c, d]), closePath() {} }, d); return pts; };
  const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const hit = (polys) => (x, y) => polys.some((p) => inside(p, x, y));
  for (const style of HAIR_STYLES) for (const [shape, face] of Object.entries(FACE_SHAPES)) {
    const ops = portraitOps({ hair: { style }, face }), fi = ops.findIndex((o) => o.k === 'path' && o.d.startsWith('M 200 112'));
    const inFace = hit([poly(ops[fi].d)]), inHair = hit(ops.slice(fi).filter((o) => o.k === 'path' && o.fill === '#30231e' && !o.stroke).map((o) => poly(o.d)));
    let gaps = 0;
    for (let x = 100; x <= 300; x += 2) for (let y = 100; y < 150; y += 2) {
      if (inHair(x, y) || inFace(x, y)) continue;
      let above = false, below = false;
      for (let k = 1; k <= 6; k++) { above ||= inHair(x, y - k); below ||= inFace(x, y + k); }
      gaps += above && below;
    }
    assert.ok(gaps <= 1, `${style} on a ${shape} face: ${gaps} gap cells between the hair and the head`);
  }
});

test('parts are tagged and picked by query; an only:* part never comes without being asked for', () => {
  assert.deepEqual(parts('top', { all: ['everyday'] }), TOP_STYLES.filter((x) => !['bare', 'tunic', 'hoodieBig', 'trackTop', 'openShirt'].includes(x)), 'the everyday tops are exactly what PLAIN_TOPS was, in registry order');
  assert.ok(parts('top').includes('crewTshirt') && parts('top').includes('tunic') && parts('top').includes('leotard') && !parts('makeup').includes('rotLips'), 'a plain query gives the untagged and the shared (the 80s clothes carry no only:* tag since the split), never an only:* part (the rot)');
  assert.ok(!parts('top', { all: ['everyday'] }).includes('leotard') && parts('top', { any: ['era:80s'] }).includes('leotard'), 'a shared part comes when its tag is asked for and not from a pool that asks for another');
  assert.ok(parts('makeup', { any: ['only:undead'] }).includes('rotLips'), 'asked for, a quarantined part comes');
  assert.deepEqual(parts('hat', { any: ['era:80s'] }), ['headband', 'veil'], 'per kind: a tag on a top says nothing about hats, and the 80s hats are exactly the two');
  assert.ok(parts('makeup').includes('severeContour') && !parts('makeup').includes('rotLips') && !parts('makeup', { any: ['only:undead'] }).includes('severeContour'), 'any is the tags a part must carry one of: the editorial makeup, untagged, comes with a plain query and not with a tagged one');
  assert.deepEqual(parts('makeup', { all: ['only:undead'] }).sort(), Object.keys(REGISTRIES.makeup).filter((n) => tagsOf('makeup', n).has('only:undead')).sort(), 'all narrows to the tag');
  assert.throws(() => parts('shoes'), /no registry for kind/);
  assert.ok(!parts('top', { not: ['everyday'] }).includes('crewTshirt'), 'not excludes');
  tag('top', 'crewTshirt', 'test:tmp'); assert.ok(tagsOf('top', 'crewTshirt').has('test:tmp')); tagsOf('top', 'crewTshirt').delete('test:tmp');
});

// A radius is never negative. A feature's width passes through zero as the head turns -- the far eye at a near profile
// -- and a negative one is invalid SVG: the browser refuses the attribute with a console error and the feature simply
// does not draw. Found by drawing every stance on every cast, which is what the explorer's poses tab does.
test('no radius is ever negative, at any turn, for any cast', () => {
  const bad = [];
  for (const cast of Object.keys(CASTS)) {
    const sitter = identityFrom(CASTS[cast], (() => { const s = {}; seed(s, prng(7)); return s; })(), CASTS[cast].archetypeNames[0], 0);
    for (const turn of [-1, -0.95, -0.5, 0, 0.5, 0.95, 1]) {
      const ops = portraitOps(dress(sitter, { pose: { turn } }));
      for (const o of ops) {
        if (o.k === 'ellipse' && (o.rx < 0 || o.ry < 0)) bad.push(`${cast} turn=${turn} ellipse rx=${o.rx} ry=${o.ry}`);
        if (o.k === 'rect' && (o.w < 0 || o.h < 0)) bad.push(`${cast} turn=${turn} rect w=${o.w} h=${o.h}`);
      }
    }
  }
  assert.deepEqual([...new Set(bad)].slice(0, 5), [], 'these would be refused by the SVG parser and the feature would vanish');
});
