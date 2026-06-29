// metrics/returns.js — return-visit metrics
// NOTE: Also exists in original <script> block (will be removed in Tasks 7–9).

import { CONFIG } from '../constants.js';
import { state } from '../state.js';

/**
 * Compute all return visits within CONFIG.RETURN_HOURS from an arbitrary rows
 * array. Pure function — does not touch state.
 *
 * @param {object[]} rows  Attendance records (must have .pront, .dh).
 * @returns {{ byP: object, ret: object[] }}
 */
export function returnsFor(rows) {
  const byP = {};
  rows.forEach(r => {
    if (!r.pront || String(r.pront).trim() === '' || /^0+$/.test(String(r.pront))) return;
    byP[r.pront] = byP[r.pront] || [];
    byP[r.pront].push(r);
  });
  Object.values(byP).forEach(v => v.sort((a, b) => a.dh - b.dh));
  const ret = [];
  Object.entries(byP).forEach(([p, vis]) => {
    for (let i = 1; i < vis.length; i++) {
      const h = (vis[i].dh - vis[i - 1].dh) / 36e5;
      if (h > 0 && h <= CONFIG.RETURN_HOURS) ret.push({ ...vis[i], pront: p, diffH: h, prev: vis[i - 1] });
    }
  });
  return { byP, ret };
}

/**
 * Return all visits within `hours` hours from a rows array. Pure function.
 *
 * @param {object[]} rows
 * @param {number} hours
 * @returns {object[]}
 */
export function returnsWithin(rows, hours) {
  const byP = {};
  rows.forEach(r => {
    if (!r.pront || String(r.pront).trim() === '' || /^0+$/.test(String(r.pront))) return;
    byP[r.pront] = byP[r.pront] || [];
    byP[r.pront].push(r);
  });
  Object.values(byP).forEach(v => v.sort((a, b) => a.dh - b.dh));
  const ret = [];
  Object.entries(byP).forEach(([p, vis]) => {
    for (let i = 1; i < vis.length; i++) {
      const h = (vis[i].dh - vis[i - 1].dh) / 36e5;
      if (h > 0 && h <= hours) ret.push({ ...vis[i], pront: p, diffH: h, prev: vis[i - 1] });
    }
  });
  return ret;
}

/**
 * Return the ≤72h return cache for state.filt, memoised by _filtVersion.
 *
 * @returns {{ byP: object, ret: object[] }}
 */
export function returns72() {
  if (state._retCache && state._retCacheKey === state._filtVersion) return state._retCache;
  const result = returnsFor(state.filt);
  state._retCache = result;
  state._retCacheKey = state._filtVersion;
  return result;
}

/**
 * Compute the return rate (%) for a given month from the full filtered dataset.
 * Uses returns72() which reads state.filt — cross-month returns are attributed
 * to the month in which the return visit occurred.
 *
 * @param {object[]} rows  state.filt (or a compatible array).
 * @param {number} k       anoMes key (e.g. 202606).
 * @returns {number|null}
 */
export function monthReturnRate(rows, k) {
  const mRows = rows.filter(r => r.anoMes === k);
  if (!mRows.length) return null;
  const { ret } = returns72();
  return ret.filter(r => r.anoMes === k).length / mRows.length * 100;
}
