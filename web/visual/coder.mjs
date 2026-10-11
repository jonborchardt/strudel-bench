// coder: someone writing the universe's simulation engine, live, and the music is their typing. A dark editor with a
// gutter, a tab bar and a status line; the file being written is plausible code about running a world (physics,
// cells, evolution, climate), never Strudel, never a REPL. Hats and ticks are keystrokes, so the hat rate is the
// typing rate; a kick finishes the line and presses Enter, nudging the frame and scrolling the buffer up as the cursor
// passes two thirds down; a snare or clap sends the cursor back up to a visible line to retune a number or comment it
// out, a second cursor sitting there until the next kick; a melody note types a whole token and lights it in the line
// hue; the bass feeds an oscilloscope; the pad keeps a small Life grid running in a popup; a riser is the operator
// going back up the file retuning faster and faster; a dropout stops the typing and leaves the cursor blinking; a
// section boundary saves the file and opens the next one as a new tab named for the section. Popups are small
// overlapping windows (a log, the scope, a population chart, the cells), opened by what fires, closed after a few
// bars, as many at once as the energy allows. Deterministic: randomness only from the state's own generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, DEFAULT_SLOT } from './kit.mjs';

// the corpus: plausible, not compilable; the operator's engine for running a world
const FILES = [
  ['physics', 'c', `#include "universe.h"
#include <math.h>

#define TICK_HZ        240
#define SOFTENING      1e-9
#define ENTROPY_CEIL   0.998
#define MAX_BODIES     (1 << 20)

static body_t bodies[MAX_BODIES];
static size_t n_bodies = 0;

static inline double dist2(const vec3 *a, const vec3 *b) {
    double dx = a->x - b->x, dy = a->y - b->y, dz = a->z - b->z;
    return dx * dx + dy * dy + dz * dz + SOFTENING;
}

void physics_step(universe_t *u, double dt) {
    for (size_t i = 0; i < n_bodies; i++) {
        vec3 acc = { 0, 0, 0 };
        for (size_t j = 0; j < n_bodies; j++) {
            if (i == j) continue;
            double d2 = dist2(&bodies[i].pos, &bodies[j].pos);
            double f = G * bodies[j].mass / (d2 * sqrt(d2));
            acc.x += f * (bodies[j].pos.x - bodies[i].pos.x);
            acc.y += f * (bodies[j].pos.y - bodies[i].pos.y);
            acc.z += f * (bodies[j].pos.z - bodies[i].pos.z);
        }
        bodies[i].vel = vadd(bodies[i].vel, vscale(acc, dt));
        bodies[i].pos = vadd(bodies[i].pos, vscale(bodies[i].vel, dt));
    }
    u->epoch += dt;
    u->entropy = measure_entropy(bodies, n_bodies);
    if (u->entropy > ENTROPY_CEIL) universe_reseed(u, u->epoch);
}

void spawn_body(double mass, vec3 pos, vec3 vel) {
    if (n_bodies >= MAX_BODIES) return;
    bodies[n_bodies++] = (body_t){ .mass = mass, .pos = pos, .vel = vel, .age = 0 };
}

int main(int argc, char **argv) {
    universe_t u = universe_open(argc > 1 ? argv[1] : "worlds/default.uni");
    while (!u.halted) {
        physics_step(&u, 1.0 / TICK_HZ);
        if (u.tick % 1000 == 0) checkpoint(&u);
        u.tick++;
    }
    return universe_close(&u);
}`],
  ['evolve', 'py', `import random
from dataclasses import dataclass, field
from universe import World, Genome

MUTATION_RATE = 0.012
POPULATION_CAP = 50_000
GENERATIONS = 10_000
FITNESS_FLOOR = 0.35


@dataclass
class Organism:
    genome: Genome
    energy: float = 1.0
    age: int = 0
    children: list = field(default_factory=list)

    def fitness(self, world: World) -> float:
        return self.genome.express(world.climate) * self.energy

    def divide(self):
        child = Organism(self.genome.copy())
        if random.random() < MUTATION_RATE:
            child.genome.mutate(strength=0.2)
        self.energy *= 0.5
        self.children.append(child)
        return child


def select_fittest(pop, world, keep=0.6):
    ranked = sorted(pop, key=lambda o: o.fitness(world), reverse=True)
    survivors = ranked[: int(len(ranked) * keep)]
    return [o for o in survivors if o.fitness(world) > FITNESS_FLOOR]


def run(world: World, seed: int = 7):
    random.seed(seed)
    pop = [Organism(Genome.random()) for _ in range(1000)]
    for gen in range(GENERATIONS):
        world.advance(dt=1.0)
        pop = select_fittest(pop, world)
        pop += [o.divide() for o in pop if o.energy > 0.7]
        pop = pop[:POPULATION_CAP]
        if gen % 100 == 0:
            world.log(f"gen {gen}: {len(pop)} alive, climate {world.climate:.2f}")
        if not pop:
            world.log("extinction; reseeding")
            pop = [Organism(Genome.random()) for _ in range(100)]
    return pop


if __name__ == "__main__":
    run(World.load("worlds/default.uni"))`],
  ['cells', 'rs', `use crate::universe::{Grid, Tick};
use std::collections::VecDeque;

const WIDTH: usize = 4096;
const HEIGHT: usize = 4096;
const DIFFUSION: f32 = 0.18;
const DECAY: f32 = 0.004;

#[derive(Clone, Copy, Default)]
pub struct Cell {
    pub alive: bool,
    pub nutrient: f32,
    pub lineage: u32,
}

pub struct Colony {
    grid: Grid<Cell>,
    queue: VecDeque<(usize, usize)>,
    tick: Tick,
}

impl Colony {
    pub fn new(seed: u64) -> Self {
        let mut grid = Grid::filled(WIDTH, HEIGHT, Cell::default());
        grid.sprinkle(seed, 0.02, |c| c.alive = true);
        Colony { grid, queue: VecDeque::new(), tick: 0 }
    }

    pub fn step(&mut self) {
        for (x, y, cell) in self.grid.iter_mut() {
            let n = self.grid.neighbours(x, y).filter(|c| c.alive).count();
            cell.alive = matches!((cell.alive, n), (true, 2) | (true, 3) | (false, 3));
            cell.nutrient = (cell.nutrient * (1.0 - DECAY)).max(0.0);
            if cell.alive && cell.nutrient < 0.1 {
                self.queue.push_back((x, y));
            }
        }
        self.diffuse(DIFFUSION);
        self.tick += 1;
    }

    fn diffuse(&mut self, rate: f32) {
        let snapshot = self.grid.clone();
        for (x, y, cell) in self.grid.iter_mut() {
            let avg = snapshot.neighbours(x, y).map(|c| c.nutrient).sum::<f32>() / 8.0;
            cell.nutrient += (avg - cell.nutrient) * rate;
        }
    }

    pub fn diverge(&mut self, lineage: u32) -> usize {
        let mut n = 0;
        while let Some((x, y)) = self.queue.pop_front() {
            self.grid[(x, y)].lineage = lineage;
            n += 1;
        }
        n
    }
}`],
  ['climate', 'js', `import { Field, Sun } from './universe.js';

const AXIAL_TILT = 23.4;
const ALBEDO = 0.31;
const OCEAN_HEAT = 4.2e6;
const STEP_HOURS = 6;

export class Climate {
  constructor(planet, seed = 1) {
    this.planet = planet;
    this.temp = new Field(planet.lat, planet.lon, 287.6);
    this.wind = new Field(planet.lat, planet.lon, [0, 0]);
    this.sun = new Sun({ tilt: AXIAL_TILT, seed });
    this.day = 0;
  }

  insolation(lat, hour) {
    const decl = this.sun.declination(this.day);
    const cosz = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hour);
    return Math.max(0, cosz) * this.sun.flux * (1 - ALBEDO);
  }

  advance(dt = STEP_HOURS) {
    this.temp.each((t, lat, lon) => {
      const q = this.insolation(lat, (lon + this.day * 24) % 24);
      return t + ((q - this.planet.emission(t)) / OCEAN_HEAT) * dt * 3600;
    });
    this.wind.each((w, lat, lon) => {
      const g = this.temp.gradient(lat, lon);
      return [w[0] * 0.92 - g[1] * 0.4, w[1] * 0.92 + g[0] * 0.4];
    });
    this.day += dt / 24;
    if (this.temp.mean() > 330) this.planet.flag('runaway');
  }

  weather(lat, lon) {
    const [u, v] = this.wind.at(lat, lon);
    const speed = Math.hypot(u, v);
    if (speed > 32) return 'storm';
    if (this.temp.at(lat, lon) < 273) return 'snow';
    return speed > 12 ? 'wind' : 'clear';
  }
}

export function forecast(climate, days = 7) {
  const out = [];
  for (let d = 0; d < days; d++) {
    climate.advance(24);
    out.push(climate.temp.mean());
  }
  return out;
}`],
];
const KEYWORDS = new Set('#include #define #derive static inline const let var mut pub fn impl struct class def return if else for while in of import from export new this self match matches use as not and or true false None null int double void size_t float f32 u32 u64 usize bool lambda with try except while continue break'.split(' '));
const COMMENT = { c: '// ', py: '# ', rs: '// ', js: '// ' };
const LOG = ['colony %n diverged', 'gen %n: climate drifted', 'checkpoint %n written', 'body %n captured', 'lineage %n extinct', 'storm over lon %n', 'entropy %n.%n%n', 'reseed epoch %n', 'tick %n ok', 'cells alive: %n%n%n'];

const ROWS = 30; // text rows per frame height (the tab bar and status line take their own)
const SLOT_OF = (s, e) => s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain';

/** One line of source as coloured tokens: comment, string, number, keyword, or plain. */
export function tokens(text) {
  const out = [];
  const re = /(\/\/.*|#(?!include|define|derive|\[).*)|("[^"]*"|'[^']*')|(\b\d[\w.]*\b)|([A-Za-z_]\w*|#\w+)|(\s+)|(.)/g;
  let m;
  while ((m = re.exec(text))) out.push({ t: m[0], k: m[1] ? 'comment' : m[2] ? 'string' : m[3] ? 'number' : m[4] ? (KEYWORDS.has(m[4]) ? 'keyword' : 'ident') : 'plain' });
  return out;
}

const fileAt = (s) => FILES[s.order[s.file % s.order.length]];
const srcLines = (s) => fileAt(s)[2].split('\n');

/** The line under the cursor and the source it is being typed from. */
const openLine = (s) => {
  if (s.buf.length === 0 || s.buf[s.buf.length - 1].done) s.buf.push({ text: '', hot: 1, done: false, edited: false });
  return s.buf[s.buf.length - 1];
};

/** Type up to `n` characters of the source line into the open line, or one whole token when `word`. */
function type(s, n, word = false) {
  const src = srcLines(s), line = openLine(s), from = src[s.srcLine % src.length] ?? '';
  if (line.text.length >= from.length) { s.flash = 1; return; }
  let take = n;
  if (word) { const rest = from.slice(line.text.length), m = /^\s*\S+/.exec(rest); take = m ? m[0].length : 1; }
  line.text = from.slice(0, Math.min(from.length, line.text.length + take));
  line.hot = 1; s.flash = 1; s.glow = word ? 1 : s.glow;
}

/** Enter: finish the open line, commit it, move the cursor down; scroll when the cursor passes two thirds down. */
function enter(s) {
  const src = srcLines(s), line = openLine(s), from = src[s.srcLine % src.length] ?? '';
  line.text = from; line.done = true; line.hot = 1;
  s.srcLine++;
  if (s.srcLine >= src.length) { s.srcLine = 0; s.buf.push({ text: '', hot: 0, done: true, edited: false }); } // the file wraps around with a blank line between
  s.edit = null; s.nudge = 1;
  const cur = s.buf.length;
  if (cur - s.top > ROWS * 0.66) s.topTarget = cur - ROWS * 0.66;
}

/** A snare: go back to a visible committed line and retune a number, or comment the line out. */
function backEdit(s, strength = 1) {
  const lo = Math.max(0, Math.floor(s.top)), hi = s.buf.length - 2;
  if (hi < lo) return;
  const numbered = [];
  for (let i = lo; i <= hi; i++) if (/\d/.test(s.buf[i].text) && !/^\s*(\/\/|#\s)/.test(s.buf[i].text)) numbered.push(i);
  const retune = numbered.length > 0 && rand(s) < 0.95; // mostly a number retuned; now and then a line commented out, or a commented one put back first
  const out = [];
  for (let i = lo; i <= hi; i++) if (/^\s*(\/\/|#\s)/.test(s.buf[i].text) && s.buf[i].edited) out.push(i);
  const i = retune ? numbered[Math.floor(rand(s) * numbered.length)] : out.length ? out[Math.floor(rand(s) * out.length)] : lo + Math.floor(rand(s) * (hi - lo + 1));
  const line = s.buf[i];
  const ms = retune ? [...line.text.matchAll(/\b\d+(\.\d+)?\b/g)] : [];
  if (ms.length) {
    const m = ms[Math.floor(rand(s) * ms.length)];
    const was = m[0], dec = was.includes('.') ? was.split('.')[1].length : 0;
    const v = parseFloat(was), bump = (rand(s) < 0.5 ? -1 : 1) * (dec ? 10 ** -dec * Math.ceil(rand(s) * 3 * strength) : Math.max(1, Math.round(Math.abs(v) * 0.1 * strength)));
    const now = Math.max(0, v + bump).toFixed(dec);
    line.text = line.text.slice(0, m.index) + now + line.text.slice(m.index + was.length);
    s.edit = { line: i, col: m.index + now.length };
  } else {
    const ext = fileAt(s)[1], pre = COMMENT[ext];
    line.text = line.text.startsWith(pre.trim()) ? line.text.slice(pre.length) : line.text.replace(/^(\s*)/, `$1${pre}`);
    s.edit = { line: i, col: line.text.length };
  }
  line.hot = 1; line.edited = true;
  s.log.push(LOG[Math.floor(rand(s) * LOG.length)].replace(/%n/g, () => String(Math.floor(rand(s) * 10 ** Math.ceil(rand(s) * 3)))));
  if (s.log.length > 40) s.log.shift();
}

/** Open a popup of `kind` if none is open and the energy allows another; refresh its life if one is. */
function popup(s, kind, bars = 6) {
  const have = s.popups.find((p) => p.kind === kind);
  const life = bars / s.cps;
  if (have) { have.life = Math.max(have.life, life); return have; }
  const max = Math.round(lerp(1, 4, s.energy));
  if (s.popups.length >= max) return null;
  const p = { kind, x: 0.38 + rand(s) * 0.36, y: 0.08 + rand(s) * 0.55, w: kind === 'cells' ? 0.36 : 0.42, h: kind === 'log' ? 0.3 : 0.24, life, age: 0, hot: 1 };
  s.popups.push(p);
  return p;
}

function lifeStep(s) {
  const { cells, cw, ch } = s;
  const next = new Array(cells.length).fill(0);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += cells[((y + dy + ch) % ch) * cw + ((x + dx + cw) % cw)];
    const a = cells[y * cw + x];
    next[y * cw + x] = n === 3 || (a && n === 2) ? 1 : 0;
  }
  s.cells = next;
}

export default {
  name: 'coder',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const s = {
      pal, size: { ...size }, cps: score.cps,
      bg: [pal.hue, 22, lerp(5, 9, p.luminance)], ink: lerp(68, 84, p.luminance),
      roles: score.sections.map((x) => x.role ?? 'none'), names: score.sections.map((x) => x.name),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      order: [], file: 0, srcLine: 0, // which corpus file this tab types from, and where in it
      buf: [], top: 0, topTarget: 0, tabs: [], tab: 0, edit: null,
      t: 0, flash: 0, glow: 0, nudge: 0, blink: 0, energy: 0.5, dark: 0, riserAcc: 0,
      popups: [], log: [], hits: [0], scope: { amp: 0, note: 40, phase: 0 },
      cw: 24, ch: 14, cells: [], beat: -1, bar: -1,
      section: null,
    };
    seed(s, rng);
    const idx = FILES.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    s.order = idx;
    s.cells = Array.from({ length: s.cw * s.ch }, () => (rand(s) < 0.3 ? 1 : 0));
    const first = score.sections[0]?.name ?? 'main';
    s.tabs.push(`${first}.${fileAt(s)[1]}`);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.flash = decay(s.flash, 12, dt); s.glow = decay(s.glow, 4, dt); s.nudge = decay(s.nudge, 14, dt);
    s.top = ease(s.top, s.topTarget, 6, dt);
    if (clock.boundary || (s.section !== null && s.section !== clock.section && clock.section !== null)) {
      // save and open the next file as a new tab
      // the buffer stays, so the old file scrolls off the top under the new one rather than the screen going blank
      if (s.buf.length) { if (!s.buf[s.buf.length - 1].done) enter(s); s.buf.push({ text: '', hot: 0, done: true, edited: false }); }
      s.file++; s.srcLine = 0; s.edit = null;
      s.tabs.push(`${clock.section ?? 'main'}.${fileAt(s)[1]}`); s.tab = s.tabs.length - 1;
      if (s.tabs.length > 6) { s.tabs.shift(); s.tab--; }
      s.log.push(`saved ${s.tabs[s.tab]}`);
    }
    s.section = clock.section;
    if (clock.beat !== s.beat) { s.beat = clock.beat; if (s.popups.some((p) => p.kind === 'cells')) lifeStep(s); }
    if (clock.bar !== s.bar) { s.bar = clock.bar; s.hits.push(0); }
    // the riser: the operator going back up the file, retuning faster and faster toward the drop
    if (clock.riser > 0 && clock.riserBars > 0) {
      s.riserAcc += dt * lerp(1.5, 10, 1 - clock.riser / clock.riserBars);
      while (s.riserAcc > 1) { s.riserAcc -= 1; backEdit(s, 2); }
    } else s.riserAcc = 0;
    for (const e of events) {
      const slot = SLOT_OF(s, e), v = clamp(e.gain * e.velocity, 0, 1.5);
      if (e.role === 'impact') { backEdit(s); popup(s, 'log'); s.nudge = Math.max(s.nudge, 0.5); continue; }
      if (slot === 'ground') { s.scope.amp = Math.min(1.5, s.scope.amp + v); s.scope.note = e.note ?? s.scope.note; popup(s, 'scope'); s.hits[s.hits.length - 1]++; continue; }
      if (slot === 'field') { popup(s, 'cells', 12); for (let i = 0; i < 6; i++) s.cells[Math.floor(rand(s) * s.cells.length)] = 1; continue; }
      if (slot === 'line' || slot === 'counter') { type(s, 1, true); s.hits[s.hits.length - 1]++; continue; }
      if (slot === 'transition') { s.nudge = 1.5; s.flash = 1; continue; }
      if (e.role === 'grain' || e.role === 'hit' || slot === 'grain') { type(s, 1 + Math.round(v * 2)); s.hits[s.hits.length - 1]++; continue; }
      // a kick, a sample, an impulse with no voice: Enter
      enter(s); s.hits[s.hits.length - 1]++; popup(s, 'pop', 8);
    }
    if (s.hits.length > 24) s.hits.shift();
    for (const l of s.buf) l.hot = decay(l.hot, 3, dt);
    s.scope.amp = decay(s.scope.amp, 1.6, dt);
    s.scope.phase += dt * s.cps * 4 * Math.PI;
    for (const p of s.popups) { p.age += dt; p.life -= dt; p.hot = decay(p.hot, 6, dt); }
    s.popups = s.popups.filter((p) => p.life > -0.5);
  },

  draw(s, ctx, w, h) {
    const lh = h / ROWS, fs = lh * 0.78, tabH = lh * 1.3, status = lh * 1.1;
    const { pal } = s, dim = (l, a = 1) => hsla(pal.hue, 18, l * (1 - s.dark * 0.6), a);
    const nudge = -s.nudge * lh * 0.25;
    ctx.save();
    ctx.fillStyle = hsla(...s.bg); ctx.fillRect(0, 0, w, h);
    ctx.font = `${fs}px ui-monospace, Menlo, Consolas, monospace`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const cw = ctx.measureText?.('M')?.width || fs * 0.6, gut = cw * 5, mapW = w * 0.06; // the real glyph width (a stub context has none)
    // the editor body: gutter, lines, cursor
    ctx.save();
    ctx.beginPath(); ctx.rect(0, tabH, w - mapW, h - tabH - status); ctx.clip();
    ctx.fillStyle = dim(8); ctx.fillRect(0, tabH, gut, h);
    const colour = { comment: dim(38), string: hsla(pal.field, pal.sat, 62), number: hsla(pal.line, pal.sat, 66), keyword: hsla(pal.hue, pal.sat, 68), ident: dim(s.ink), plain: dim(s.ink - 20) };
    const first = Math.max(0, Math.floor(s.top) - 1), last = Math.min(s.buf.length - 1, first + ROWS + 2);
    const cur = s.buf.length - 1;
    for (let i = first; i <= last; i++) {
      const y = tabH + (i - s.top) * lh + nudge, line = s.buf[i];
      if (i === cur) { ctx.fillStyle = dim(14, 0.9); ctx.fillRect(gut, y, w - gut, lh); }
      if (s.edit && s.edit.line === i) { ctx.fillStyle = hsla(pal.line, pal.sat, 50, 0.18); ctx.fillRect(gut, y, w - gut, lh); }
      ctx.fillStyle = dim(line.edited ? 55 : 30); ctx.textAlign = 'right'; ctx.fillText(String(i + 1), gut - cw * 0.8, y + lh * 0.1); ctx.textAlign = 'left';
      let x = gut + cw;
      for (const tk of tokens(line.text)) {
        ctx.fillStyle = colour[tk.k];
        if (tk.k !== 'plain' || !/^\s+$/.test(tk.t)) ctx.fillText(tk.t, x, y + lh * 0.1);
        x += cw * tk.t.length;
      }
      if (line.hot > 0.02) { ctx.fillStyle = hsla(pal.line, pal.sat, 70, line.hot * (i === cur ? 0.06 : 0.14)); ctx.fillRect(gut, y, Math.max(w - gut, 0), lh); }
      if (i === cur && (s.glow > 0.05)) { const tk = tokens(line.text).filter((t) => t.k !== 'plain').pop(); if (tk) { ctx.fillStyle = hsla(pal.line, 90, 75, s.glow * 0.6); ctx.fillRect(x - cw * tk.t.length, y, cw * tk.t.length, lh); } }
    }
    // the cursors: the typing one on the open line, the editing one where the snare sent it
    const blink = s.dark > 0.5 ? (Math.floor(s.t * 2) % 2 === 0) : true;
    if (blink) {
      const y = tabH + (cur - s.top) * lh + nudge, x = gut + cw + cw * (s.buf[cur]?.text.length ?? 0);
      ctx.fillStyle = hsla(pal.hue, pal.sat, 80, 0.85 - s.dark * 0.2); ctx.fillRect(x, y, cw, lh);
      if (s.flash > 0.05) { ctx.fillStyle = hsla(pal.hue, pal.sat, 85, s.flash * 0.5); ctx.fillRect(x - cw, y - lh * 0.2, cw * 3, lh * 1.4); }
    }
    if (s.edit) { const y = tabH + (s.edit.line - s.top) * lh + nudge; ctx.fillStyle = hsla(pal.line, pal.sat, 70, 0.9); ctx.fillRect(gut + cw + cw * s.edit.col, y, cw * 0.5, lh); }
    ctx.restore();
    // the minimap: the whole buffer at a sixth of the line height, the viewport boxed, the hot lines lit
    {
      const mx = w - mapW, mlh = lh / 6, mcw = mapW / 90, top = tabH + lh * 0.3;
      ctx.fillStyle = dim(7); ctx.fillRect(mx, tabH, mapW, h - tabH - status);
      const from = Math.max(0, s.buf.length - Math.floor((h - tabH - status - lh * 0.6) / mlh));
      for (let i = from; i < s.buf.length; i++) {
        const line = s.buf[i], y = top + (i - from) * mlh, m = /^(\s*)(.*)$/.exec(line.text);
        ctx.fillStyle = line.edited ? hsla(pal.line, pal.sat, 55, 0.7) : dim(line.hot > 0.1 ? 60 : 32, 0.8);
        ctx.fillRect(mx + mcw * 2 + mcw * m[1].length, y, Math.min(mapW - mcw * 4, mcw * m[2].length), mlh * 0.7);
      }
      ctx.fillStyle = dim(60, 0.12); ctx.fillRect(mx, top + (s.top - from) * mlh, mapW, ROWS * mlh);
    }
    // tab bar
    ctx.fillStyle = dim(6); ctx.fillRect(0, 0, w, tabH);
    let tx = 0;
    const tfs = fs * 0.85; ctx.font = `${tfs}px ui-monospace, Menlo, Consolas, monospace`;
    s.tabs.forEach((name, i) => {
      const tw = tfs * 0.6 * (name.length + 3);
      ctx.fillStyle = i === s.tab ? hsla(...s.bg) : dim(6); ctx.fillRect(tx, 0, tw, tabH);
      if (i === s.tab) { ctx.fillStyle = hsla(pal.hue, pal.sat, 60); ctx.fillRect(tx, 0, tw, lh * 0.08); }
      ctx.fillStyle = dim(i === s.tab ? s.ink : 40); ctx.fillText(name, tx + tfs * 0.9, (tabH - tfs) / 2);
      tx += tw;
    });
    // status line
    const sy = h - status;
    ctx.fillStyle = hsla(pal.hue, pal.sat, 22); ctx.fillRect(0, sy, w, status);
    ctx.fillStyle = dim(88); ctx.font = `${tfs}px ui-monospace, Menlo, Consolas, monospace`;
    const l = s.buf.length, c = (s.buf[cur]?.text.length ?? 0) + 1;
    ctx.fillText(`${s.tabs[s.tab] ?? ''}   Ln ${l}, Col ${c}   ${s.section ?? 'sim'}   ${(s.energy * 100).toFixed(0)}% load   ${s.dark > 0.5 ? 'halted' : 'running'}`, cw, sy + (status - tfs) / 2);
    // popups, newest on top
    for (const p of s.popups) {
      const a = clamp(Math.min(p.age * 6, (p.life + 0.5) * 2)), px = p.x * w, py = p.y * h, pw = p.w * h, ph = p.h * h, th = lh * 0.9;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0 0 0 / .45)'; ctx.fillRect(px + lh * 0.2, py + lh * 0.2, pw, ph);
      ctx.fillStyle = dim(10); ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = hsla(pal.hue, pal.sat, 26 + p.hot * 30); ctx.fillRect(px, py, pw, th);
      ctx.strokeStyle = dim(30); ctx.lineWidth = Math.max(1, h / 900); ctx.strokeRect(px, py, pw, ph);
      ctx.fillStyle = dim(88); ctx.font = `${tfs * 0.9}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.fillText({ log: 'universe.log', scope: 'bass carrier', pop: 'population', cells: 'cells' }[p.kind], px + cw, py + (th - tfs * 0.9) / 2);
      ctx.save(); ctx.beginPath(); ctx.rect(px, py + th, pw, ph - th); ctx.clip();
      const ix = px + cw, iy = py + th + lh * 0.3, iw = pw - cw * 2, ih = ph - th - lh * 0.6;
      if (p.kind === 'log') {
        ctx.fillStyle = dim(60); const n = Math.floor(ih / (lh * 0.8));
        s.log.slice(-n).forEach((m, i) => ctx.fillText(m, ix, iy + i * lh * 0.8));
      } else if (p.kind === 'scope') {
        ctx.strokeStyle = hsla(pal.line, pal.sat, 65); ctx.lineWidth = Math.max(1, h / 540); ctx.beginPath();
        const k = lerp(2, 9, clamp((s.scope.note - 24) / 48));
        for (let i = 0; i <= 60; i++) { const x = ix + (i / 60) * iw, y = iy + ih / 2 - Math.sin(s.scope.phase + (i / 60) * k * Math.PI * 2) * s.scope.amp * ih * 0.4; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
        ctx.strokeStyle = dim(25); ctx.beginPath(); ctx.moveTo(ix, iy + ih / 2); ctx.lineTo(ix + iw, iy + ih / 2); ctx.stroke();
      } else if (p.kind === 'pop') {
        const n = s.hits.length, bw = iw / 24, peak = Math.max(1, ...s.hits);
        s.hits.forEach((v, i) => { const bh = (v / peak) * ih; ctx.fillStyle = hsla(pal.field, pal.sat, i === n - 1 ? 70 : 50); ctx.fillRect(ix + (24 - n + i) * bw, iy + ih - bh, bw * 0.8, bh); });
      } else if (p.kind === 'cells') {
        const cs = Math.min(iw / s.cw, ih / s.ch);
        ctx.fillStyle = hsla(pal.field, pal.sat, 60);
        for (let y = 0; y < s.ch; y++) for (let x = 0; x < s.cw; x++) if (s.cells[y * s.cw + x]) ctx.fillRect(ix + x * cs, iy + y * cs, cs * 0.85, cs * 0.85);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (s.dark > 0.02) { ctx.fillStyle = `rgba(0 0 0 / ${s.dark * 0.35})`; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  },
};
