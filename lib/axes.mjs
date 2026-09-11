import { S, isPattern, val } from './strudel.mjs';

export const PHASES = ['structural', 'timing', 'pitch', 'articulation', 'spectral', 'spatial', 'level'];

// verify.class: direct | proxy | code. metric names match scripts/analyze.mjs keys. sign: expected direction when the axis rises.
export const AXES = [
  { name: 'density', kind: 'structural', meaning: 'amount of musical activity', verify: { class: 'direct', metric: 'onsetsPerSec', sign: +1 } },
  { name: 'drive', kind: 'structural', meaning: 'rhythmic insistence toward the primary pulse: where onsets fall and which are accented, not how many', verify: { class: 'code' } },
  { name: 'brightness', kind: 'continuous', meaning: 'spectral character, dark to bright', verify: { class: 'direct', metric: 'centroidHz', sign: +1 } },
  { name: 'weight', kind: 'continuous', meaning: 'perceived low end and body', verify: { class: 'direct', metric: 'lowRatio', sign: +1 } },
  { name: 'space', kind: 'continuous', meaning: 'dry and close to spacious', verify: { class: 'proxy', metric: 'tail', sign: +1 } },
  { name: 'articulation', kind: 'continuous', meaning: 'sustained and smooth to short and punchy', verify: { class: 'proxy', metric: 'crest', sign: +1 } },
  { name: 'aggression', kind: 'continuous', meaning: 'smooth to abrasive', verify: { class: 'proxy' } },
  { name: 'groove', kind: 'continuous', meaning: 'rigid to swung', verify: { class: 'proxy' } },
  { name: 'variation', kind: 'structural', meaning: 'repetitive to variable (0 = pure loop)', verify: { class: 'proxy' } },
  { name: 'organicness', kind: 'continuous', meaning: 'mechanical to humanized', verify: { class: 'proxy' } },
  { name: 'width', kind: 'continuous', meaning: 'narrow to wide', verify: { class: 'direct', metric: 'width', sign: +1 } },
  { name: 'register', kind: 'structural', meaning: 'low to high', verify: { class: 'code' } },
];
export const AXIS_NAMES = AXES.map((a) => a.name);
export const axis = (name) => AXES.find((a) => a.name === name);

export const cells = {};
export function defineCell(layer, axisName, cell) {
  if (!axis(axisName)) throw new Error(`unknown axis "${axisName}"`);
  for (const k of Object.keys(cell)) if (k !== 'describe' && k !== 'builtIn' && !PHASES.includes(k)) throw new Error(`cell ${layer}.${axisName}: unknown phase "${k}"`);
  (cells[layer] ??= {})[axisName] = cell;
}

/** Structural axes must be plain numbers in v1. */
export function num(value, axisName) {
  if (typeof value !== 'number') throw new Error(`${axisName} is structural: it takes a number in 0..1, not a signal or pattern`);
  return value;
}

/** Piecewise map around the baseline: v<.5 goes base→lo, v>.5 goes base→hi. log=true interpolates geometrically (Hz). */
export const piece = (lo, base, hi, { log = false } = {}) => {
  const f = (v) => {
    if (v === 0.5) return base;
    const t = v < 0.5 ? (0.5 - v) * 2 : (v - 0.5) * 2;
    const to = v < 0.5 ? lo : hi;
    return log ? base * Math.pow(to / base, t) : base + (to - base) * t;
  };
  f.toString = () => `piece(${lo}, ${base}, ${hi}${log ? ', { log: true }' : ''})`; // so scripts/dump.mjs prints it by name
  return f;
};

/**
 * Apply control `name` from an axis value through mapping fn, honouring the invariants:
 * exactly 0.5 (number) returns the same pattern object; noopBelow skips numbers <= .5;
 * signals are fmapped (fn must itself return the baseline/off value for x<=.5 when noopBelow).
 */
export function ctl(pat, name, value, fn, { noopBelow = false } = {}) {
  if (typeof value === 'number') {
    if (value === 0.5 || (noopBelow && value <= 0.5)) return pat;
    return pat[name](fn(value));
  }
  if (!isPattern(value)) throw new Error(`axis value must be a number or a pattern, got ${typeof value}`);
  return pat[name](value.fmap(fn));
}

export function applyPlanPhase(layer, plan, attrs, ctx) {
  for (const a of AXIS_NAMES) {
    const cell = cells[layer]?.[a];
    if (attrs[a] === undefined || !cell?.structural) continue;
    plan = cell.structural(plan, num(attrs[a], a), ctx);
  }
  return plan;
}

export function applyPatternPhases(layer, pat, attrs, ctx) {
  for (const phase of PHASES.slice(1)) {
    for (const a of AXIS_NAMES) {
      const cell = cells[layer]?.[a];
      if (attrs[a] === undefined || !cell?.[phase]) continue;
      pat = cell[phase](pat, attrs[a], ctx);
    }
  }
  return pat;
}

/** Human-readable control change for the resolve report. */
export function describeCell(layer, axisName, from, to, ctx = {}) {
  const d = cells[layer]?.[axisName]?.describe;
  return d ? d(from, to, ctx) : null;
}
