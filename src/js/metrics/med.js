// metrics/med.js — médico (doctor) productivity metrics

import { avg } from '../utils/stats.js';
import { norm } from '../utils/dom.js';
import { state } from '../state.js';
import { calcularPontos } from './executive.js';

// Memoize cache
let _mrCache = null;
let _mrCacheVer = -1;

/**
 * Build per-doctor productivity rows from state.filt.
 * Memoised by state._filtVersion.
 *
 * @returns {object[]}
 */
export function medRows() {
  if (_mrCacheVer === state._filtVersion) return _mrCache;
  const d = state.filt.filter(r => r.tConsulta == null || r.tConsulta <= 60);
  const map = {};
  d.forEach(r => {
    if (!r.prof) return;
    const profKey = norm(r.prof);
    map[profKey] = map[profKey] || { prof: r.prof, total: 0, D: 0, N: 0, tri: [], med: [], tot: [], risks: {}, plantaoCount: {} };
    const x = map[profKey];
    x.total++; x[r.turno]++;
    if (r.tEspTri != null) x.tri.push(r.tEspTri);
    if (r.tEspMed != null) x.med.push(r.tEspMed);
    if (r.tTotal != null) x.tot.push(r.tTotal);
    x.risks[r.cor] = (x.risks[r.cor] || 0) + 1;
    const pKey = r.dateKey + '_' + r.turno;
    x.plantaoCount[pKey] = (x.plantaoCount[pKey] || 0) + 1;
  });
  const MIN_PLT = 10;
  const result = Object.values(map).sort((a, b) => b.total - a.total).map((x, i) => {
    const pltDKeys = Object.keys(x.plantaoCount).filter(k => k.endsWith('_D') && x.plantaoCount[k] > MIN_PLT);
    const pltNKeys = Object.keys(x.plantaoCount).filter(k => k.endsWith('_N') && x.plantaoCount[k] > MIN_PLT);
    const plantD = pltDKeys.length, plantN = pltNKeys.length, plantTotal = plantD + plantN;
    const atPlantD = pltDKeys.reduce((s, k) => s + x.plantaoCount[k], 0);
    const atPlantN = pltNKeys.reduce((s, k) => s + x.plantaoCount[k], 0);
    const mediaD = plantD > 0 ? Math.round(atPlantD / plantD) : null;
    const mediaN = plantN > 0 ? Math.round(atPlantN / plantN) : null;
    const mediaPlantao = plantTotal > 0 ? Math.round((atPlantD + atPlantN) / plantTotal) : null;
    const _rows = d.filter(r => norm(r.prof || '') === norm(x.prof || ''));
    const _pontos = calcularPontos(_rows);
    const _le2 = _rows.filter(r => r.idade != null && r.idade <= 2).length;
    const _le12 = _rows.filter(r => r.idade != null && r.idade <= 12).length;
    const _ge60 = _rows.filter(r => r.idade != null && r.idade >= 60).length;
    const _ge80 = _rows.filter(r => r.idade != null && r.idade >= 80).length;
    return {
      ...x, i: i + 1, triAvg: avg(x.tri, v => v), medAvg: avg(x.med, v => v), totAvg: avg(x.tot, v => v),
      plantD, plantN, plantTotal, mediaPlantao, mediaD, mediaN,
      pontos: _pontos, le2: _le2, le12: _le12, ge60: _ge60, ge80: _ge80,
    };
  });
  _mrCacheVer = state._filtVersion;
  return (_mrCache = result);
}

/**
 * Detect whether the loaded dataset contains traceable evasion data.
 * Reports that do not record evasions return false.
 *
 * @param {object[]} rows  state.raw or any attendance array.
 * @returns {boolean}
 */
export function evasaoDisponivel(rows) {
  if (rows.some(r => r.evadido)) return true;
  const kws = ['evasao', 'evad', 'saiu', 'abandono', 'fuga', 'alta pedido', 'sem atend', 'nao aguard', 'nao esper', 'desistiu', 'recusou'];
  return rows.some(r => { const t = norm(r.tipo || ''); return kws.some(k => t.includes(k)); });
}
