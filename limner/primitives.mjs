// The drawing primitives a host may reuse for its own scenery, so a curtain drawn behind a figure is drawn in the same
// language as the figure. Separate from the main entry because a consumer who wants `person()` should not have to look at
// `ellipse`.
//
// Of these, `tracePath` is the one strudel-bench actually uses (web/visual/sets.mjs draws its curtain and cyclorama with
// it). The rest are published because an op list is only useful to a host that can make ops of its own.
export { tracePath, path, ellipse, rect, line, soft, stroke, shade, mix, merge } from './portrait.mjs';
