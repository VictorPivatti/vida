// metrics/previous-period.js — comparação com período anterior equivalente

import { state } from '../state.js';
import { ymd } from '../utils/dates.js';
import { dateRange } from '../filters.js';

/** Filtra rows por intervalo dateKey + turno. */
export function rowsInRange(rows, s, e, turno) {
  const t = turno ?? document.getElementById('turno')?.value ?? 'all';
  const sKey = s ? ymd(s) : null;
  const eKey = e ? ymd(e) : null;
  return rows.filter(r =>
    (!sKey || (r.dateKey || '') >= sKey) &&
    (!eKey || (r.dateKey || '') <= eKey) &&
    (t === 'all' || r.turno === t)
  );
}

/**
 * Rows do período imediatamente anterior com mesma duração.
 * @param {object[]} [raw]
 * @param {{ turnoFilter?: string }} [opts]
 */
export function previousRows(raw = state.raw, opts = {}) {
  const { s, e } = dateRange();
  if (!s || !e) return [];
  const span = e.getTime() - s.getTime();
  const prevEnd = new Date(s.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  return rowsInRange(raw, prevStart, prevEnd, opts.turnoFilter);
}

/** Retorna valor anterior só se cobertura ≥ 50% do período atual. */
export function prevVal(val, prevRowsArr, curMonths, prevMonths) {
  if (val == null || !Number.isFinite(val)) return null;
  if (!curMonths) return null;
  if (!prevMonths || prevMonths < curMonths * 0.5) return null;
  if (!prevRowsArr || prevRowsArr.length < curMonths * 10) return null;
  return val;
}

/**
 * @returns {{ pct: number|null, dir: 'up'|'down'|'flat'|null, diff: number|null, good: boolean|null }}
 */
export function periodDelta(curVal, prevValNum, { inverse = false } = {}) {
  if (curVal == null || prevValNum == null || !Number.isFinite(curVal) || !Number.isFinite(prevValNum) || prevValNum === 0) {
    return { pct: null, dir: null, diff: null, good: null };
  }
  const diff = curVal - prevValNum;
  const pct = diff / Math.abs(prevValNum) * 100;
  const good = inverse ? diff <= 0 : diff >= 0;
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  return { pct, dir, diff, good };
}
