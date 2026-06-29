// utils/stats.js — statistical helper functions extracted from the original script block
// NOTE: These are duplicated here intentionally (also exist in the original <script>)
// The original script block will be removed in Tasks 7–9.

/** Array average; fn maps each element to a number. Returns null for empty/all-non-finite. */
export const avg = (arr, fn) => {
  const v = arr.map(fn).filter(x => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Array sum; fn (optional) maps each element to a number */
export const sum = (arr, fn) => arr.reduce((s, x) => s + (fn ? fn(x) : x), 0);

/** p-th percentile of an array of numbers (e.g. p=50 → median) */
export const percentile = (arr, p) => {
  const v = [...arr].filter(x => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = (p / 100) * (v.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return +(v[lo] + (v[hi] - v[lo]) * (idx - lo)).toFixed(1);
};
