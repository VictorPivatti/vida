// render/fluxo.js — Fluxo pane rendering
import { state } from '../state.js';
import { $, fmt, fmtN, pct, kpi } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { monthLabel } from '../utils/dates.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { CONFIG, RISK_ORDER, RISK_COLOR } from '../constants.js';
import { monthlyStats } from '../metrics/monthly.js';
import { previousRows, prevVal } from '../metrics/previous-period.js';

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }

function group(arr, fn) { return arr.reduce((m, r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; return m; }, {}); }

function metricDelta(cur, prev, unit = '', inverse = false) {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return '';
  const diff = cur - prev, pctDiff = diff / Math.abs(prev) * 100, good = inverse ? diff <= 0 : diff >= 0;
  const sign = diff > 0 ? '+' : '';
  return `<div class="k-trend ${good ? 'okc' : 'erc'}">${sign}${Math.round(diff)}${unit ? ` ${unit}` : ''} (${sign}${fmtN(pctDiff, 1)}%) vs período anterior</div>`;
}

export function renderFluxo() {
  const d = state.filt, prev = previousRows();
  const m = monthlyStats(d), pm = monthlyStats(prev);
  const triAvg = avg(d, r => r.tEspTri), medAvg = avg(d, r => r.tEspMed), consAvg = avg(d, r => r.tConsulta), totAvg = avg(d, r => r.tTotal);
  const pTri = prevVal(avg(prev, r => r.tEspTri), prev, m.length, pm.length);
  const pMed = prevVal(avg(prev, r => r.tEspMed), prev, m.length, pm.length);
  const pCons = prevVal(avg(prev, r => r.tConsulta), prev, m.length, pm.length);
  const pTot = prevVal(avg(prev, r => r.tTotal), prev, m.length, pm.length);
  $('kpisFluxo').innerHTML = [
    kpi('Espera triagem', triAvg != null ? Math.round(triAvg) + ' min' : '-', `meta <= ${meta('metaTri')} min`, '#1357a6', metricDelta(triAvg, pTri, 'min', true)),
    kpi('Espera médico', medAvg != null ? Math.round(medAvg) + ' min' : '-', `meta <= ${meta('metaMed')} min`, '#e8a93b', metricDelta(medAvg, pMed, 'min', true)),
    kpi('Consulta', consAvg != null ? Math.round(consAvg) + ' min' : '-', 'duracao media', '#7b61c4', metricDelta(consAvg, pCons, 'min', true)),
    kpi('Total', totAvg != null ? Math.round(totAvg) + ' min' : '-', `meta <= ${meta('metaTotal')} min`, '#c8493e', metricDelta(totAvg, pTot, 'min', true))
  ].join('');
  const fluxoVals = m.flatMap(x => [x.triAvg, x.medAvg, x.totAvg]).filter(Number.isFinite);
  chart('chartTempos', { type: 'line', data: { labels: m.map(x => monthLabel(x.k)), datasets: [{ label: 'Espera triagem', data: m.map(x => x.triAvg), borderColor: '#1357a6', tension: .3, spanGaps: true }, { label: 'Espera médico', data: m.map(x => x.medAvg), borderColor: '#e8a93b', tension: .3, spanGaps: true }, { label: 'Total', data: m.map(x => x.totAvg), borderColor: '#c8493e', tension: .3, spanGaps: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, targetLine: { lines: [{ value: meta('metaTri'), label: 'meta triagem', color: '#1357a6' }, { value: meta('metaMed'), label: 'meta médico', color: '#e8a93b' }, { value: meta('metaTotal'), label: 'meta total', color: '#c8493e' }] } }, scales: { ...axes(), y: { ...axes().y, suggestedMax: Math.max(meta('metaTri'), meta('metaMed'), meta('metaTotal'), ...fluxoVals, 1) * 1.15 } } } });
  const risks = group(d, r => r.cor), keys = RISK_ORDER.filter(k => risks[k]).reverse();
  chart('chartRisco', { type: 'bar', data: { labels: keys, datasets: [{ data: keys.map(k => risks[k]), backgroundColor: keys.map(k => RISK_COLOR[k] || '#64748b'), borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${fmt(c.parsed.x)} atend. (${pct(c.parsed.x, d.length)})` } } }, scales: { x: { grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { size: 10 } } } } } });
  const turns = group(d, r => r.turno);
  chart('chartTurno', { type: 'bar', data: { labels: ['Diurno', 'Noturno'], datasets: [{ data: [turns.D || 0, turns.N || 0], backgroundColor: ['#1357a6', '#7b61c4'], borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });

  const permEl = $('cardPermanencia');
  if (permEl) {
    const comTotal = d.filter(r => r.tTotal != null);
    const obs4h = comTotal.filter(r => r.tTotal > 240);
    const obs12h = comTotal.filter(r => r.tTotal > CONFIG.MAX_MINUTES);
    const obs24h = comTotal.filter(r => r.tTotal > 1440);
    const pct4 = comTotal.length ? (obs4h.length / comTotal.length * 100).toFixed(1) : 0;
    const pct12 = comTotal.length ? (obs12h.length / comTotal.length * 100).toFixed(1) : 0;
    const pct24 = comTotal.length ? (obs24h.length / comTotal.length * 100).toFixed(1) : 0;
    const medObs = avg(obs4h, r => r.tTotal);
    permEl.innerHTML = `
      <div class="grid" style="margin:0 0 8px">
        ${kpi('Em observação (>4h)', fmt(obs4h.length), `${pct4}% dos atendimentos com registro de saída`, '#e8a93b')}
        ${kpi('Permanência longa (>12h)', fmt(obs12h.length), `${pct12}% — risco de superlotação`, '#c8493e')}
        ${kpi('Alerta regulação (>24h)', obs24h.length > 0 ? '⚠ ' + fmt(obs24h.length) : '0 casos', obs24h.length > 0 ? 'critério de regulação — encaminhar' : 'dentro do padrão esperado', obs24h.length > 0 ? '#a83a31' : '#38ac8b')}
        ${kpi('Média permanência obs.', medObs != null ? Math.round(medObs) + ' min' : '-', 'entre pacientes em observação (>4h)', '#7b61c4')}
      </div>
      <div style="font-size:11px;color:var(--mut)">
        Portaria GM/MS 10/2017: pacientes em observação > 24h devem ser notificados à Central de Regulação. Total ${fmt(comTotal.length)} registros com tempo de saída.
      </div>`;
    const mObs = monthlyStats(d).map(mx => {
      const mRows = d.filter(r => r.anoMes === mx.k && r.tTotal != null);
      return { k: mx.k, obs4h: mRows.filter(r => r.tTotal > 240).length, obs24h: mRows.filter(r => r.tTotal > 1440).length, total: mRows.length };
    });
    chart('chartPermanenciaMes', { type: 'bar', data: { labels: mObs.map(x => monthLabel(x.k)), datasets: [{ label: 'Obs. >4h', data: mObs.map(x => x.total ? +(x.obs4h / x.total * 100).toFixed(1) : 0), backgroundColor: 'rgba(232,169,59,.7)', borderRadius: 3 }, { label: 'Obs. >24h (regulação)', data: mObs.map(x => x.total ? +(x.obs24h / x.total * 100).toFixed(1) : 0), backgroundColor: 'rgba(220,38,38,.85)', borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true, font: { size: 10 } } } }, scales: { ...axes(), y: { ...axes().y, ticks: { callback: v => v + '%' } } } } });
  }
}
