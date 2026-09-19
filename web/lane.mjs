// An automation lane: a signal axis sampled across its section, drawn as one polyline. Display only; the shape pick on the
// page writes a movement literal through lib/resolve.mjs setAxisText, so the lane is always what the source says.
export function lanePoints(pattern, cycles, per = 16) {
  const n = Math.max(1, Math.round(cycles * per));
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * cycles;
    const v = pattern.queryArc(t, t + 1e-4)[0]?.value;
    return typeof v === 'number' ? v : typeof v?.value === 'number' ? v.value : null;
  });
}
export const laneSvg = (points, cycles) => `<svg class="lane" viewBox="0 0 100 20" preserveAspectRatio="none">${Array.from({ length: Math.max(0, Math.ceil(cycles) - 1) }, (_, b) => `<line x1="${((b + 1) / cycles) * 100}" y1="0" x2="${((b + 1) / cycles) * 100}" y2="20" stroke="#ddd" />`).join('')}<polyline points="${points.map((v, i) => (v == null ? '' : `${((i / points.length) * 100).toFixed(2)},${(20 - v * 20).toFixed(2)}`)).filter(Boolean).join(' ')}" fill="none" stroke="currentColor" stroke-width="1" /></svg>`;
