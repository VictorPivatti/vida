// metrics/monthly.js — monthly aggregations
// NOTE: Also exists in original <script> block (will be removed in Tasks 7–9).

import { avg } from '../utils/stats.js';
import { state } from '../state.js';
import { metaManchester } from './manchester.js';

// Memoize cache for monthlyStats when called with state.filt
let _msCache = null;
let _msCacheVer = -1;

/**
 * Aggregate attendance rows by month (anoMes).
 * Memoised when called with state.filt.
 *
 * @param {object[]} d  Attendance records.
 * @returns {object[]}  Sorted array of monthly stat objects.
 */
export function monthlyStats(d) {
  const isFilt = d === state.filt;
  if (isFilt && _msCacheVer === state._filtVersion) return _msCache;
  const metaTri = typeof document !== 'undefined' ? (Number(document.getElementById('metaTri')?.value) || 0) : 0;
  const map = {};
  d.forEach(r => {
    const k = r.anoMes;
    map[k] = map[k] || { rows: [], tri: [], med: [], tot: [], triOk: 0, triN: 0, medOk: 0, medN: 0, ret: 0 };
    map[k].rows.push(r);
    // Use Manchester threshold per colour, fallback to global meta
    const mMed = metaManchester(r.cor);
    if (r.tEspTri != null) { map[k].tri.push(r.tEspTri); map[k].triN++; if (r.tEspTri <= metaTri) map[k].triOk++; }
    if (r.tEspMed != null) { map[k].med.push(r.tEspMed); map[k].medN++; if (r.tEspMed <= mMed) map[k].medOk++; }
    if (r.tTotal != null) map[k].tot.push(r.tTotal);
  });
  const result = Object.keys(map).map(Number).sort().map(k => ({
    k,
    ...map[k],
    vol: map[k].rows.length,
    triAvg: avg(map[k].rows, r => r.tEspTri),
    medAvg: avg(map[k].rows, r => r.tEspMed),
    totAvg: avg(map[k].rows, r => r.tTotal),
  }));
  if (isFilt) { _msCache = result; _msCacheVer = state._filtVersion; }
  return result;
}

/**
 * Compute a linear volume projection for the most recent (incomplete) month.
 * Returns null if the current month is already complete or there is no data.
 *
 * @param {object[]} d  Attendance records.
 * @returns {object|null}
 */
export function calcProjecao(d) {
  const m = monthlyStats(d);
  if (!m.length) return null;
  const cur = m[m.length - 1];
  const year = Math.floor(cur.k / 100), month = cur.k % 100;
  const daysInMonth = new Date(year, month, 0).getDate();
  const curRows = d.filter(r => r.anoMes === cur.k);
  const daysPresent = new Set(curRows.map(r => r.dateKey)).size;
  if (!daysPresent || daysPresent >= daysInMonth) return null;
  const projVol = Math.round(cur.vol / daysPresent * daysInMonth);
  const prev = m.length >= 2 ? m[m.length - 2] : null;
  const projDelta = prev && prev.vol ? Math.round((projVol - prev.vol) / prev.vol * 100) : null;
  const pctElapsed = Math.round(daysPresent / daysInMonth * 100);
  const last7Keys = [...new Set(curRows.map(r => r.dateKey))].sort().slice(-7);
  const last7Rows = curRows.filter(r => last7Keys.includes(r.dateKey));
  const dailyLast7 = last7Keys.length ? Math.round(last7Rows.length / last7Keys.length) : null;
  const projVolLast7 = dailyLast7 ? Math.round(cur.vol + (daysInMonth - daysPresent) * dailyLast7) : null;
  return {
    k: cur.k, label: null, year, month, daysPresent, daysInMonth, pctElapsed,
    volCur: cur.vol, projVol, projVolLast7, prev, projDelta,
    tMedCur: cur.medAvg, tTriCur: cur.triAvg, dailyLast7,
  };
}
