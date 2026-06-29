// render/indicadores.js — Indicadores pane rendering
import { state } from '../state.js';
import { $, fmt, fmtN, pct, kpi } from '../utils/dom.js';
import { percentile } from '../utils/stats.js';
import { monthLabel } from '../utils/dates.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { monthlyStats } from '../metrics/monthly.js';
import { metaManchester, manchesterConformidade } from '../metrics/manchester.js';
import { RISK_COLOR } from '../constants.js';
import { previousRows, prevVal } from '../metrics/previous-period.js';

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }

function metricDelta(cur, prev, unit = '', inverse = false) {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return '';
  const diff = cur - prev, pctDiff = diff / Math.abs(prev) * 100, good = inverse ? diff <= 0 : diff >= 0;
  const sign = diff > 0 ? '+' : '';
  return `<div class="k-trend ${good ? 'okc' : 'erc'}">${sign}${unit === 'pp' ? fmtN(diff, 1) + ' p.p.' : Math.round(diff) + (unit ? ` ${unit}` : '')} (${sign}${fmtN(pctDiff, 1)}%) vs período anterior</div>`;
}

export function renderIndicadores() {
  const d = state.filt, m = monthlyStats(d);
  const triN = d.filter(r => r.tEspTri != null).length, triOk = d.filter(r => r.tEspTri != null && r.tEspTri <= meta('metaTri')).length;
  const medN = d.filter(r => r.tEspMed != null).length, medOk = d.filter(r => r.tEspMed != null && r.tEspMed <= metaManchester(r.cor)).length;
  const totalN = d.filter(r => r.tTotal != null).length, totalOk = d.filter(r => r.tTotal != null && r.tTotal <= meta('metaTotal')).length;
  const monthAvg = m.length ? Math.round(d.length / m.length) : 0;

  const prev = previousRows();
  const pTriN = prev.filter(r => r.tEspTri != null).length, pTriOk = prev.filter(r => r.tEspTri != null && r.tEspTri <= meta('metaTri')).length;
  const pMedN = prev.filter(r => r.tEspMed != null).length, pMedOk = prev.filter(r => r.tEspMed != null && r.tEspMed <= metaManchester(r.cor)).length;
  const pTotalN = prev.filter(r => r.tTotal != null).length, pTotalOk = prev.filter(r => r.tTotal != null && r.tTotal <= meta('metaTotal')).length;
  const pm = monthlyStats(prev);
  const triRate = triN ? triOk / triN * 100 : null, medRate = medN ? medOk / medN * 100 : null, totalRate = totalN ? totalOk / totalN * 100 : null;

  $('kpisInd').innerHTML = [
    kpi('Triagem na meta', pct(triOk, triN), `meta <= ${meta('metaTri')} min`, '#38ac8b', metricDelta(triRate, prevVal(pTriN ? pTriOk / pTriN * 100 : null, prev, m.length, pm.length), 'pp'), '', triN > 0 ? { expr: `${pct(triOk, triN)} = ${fmt(triOk)} ÷ ${fmt(triN)}`, linhas: [['na meta (≤' + meta('metaTri') + 'min)', fmt(triOk)], ['com dado de espera', fmt(triN)], ['sem dado de espera', fmt(d.length - triN)], ['conformidade', pct(triOk, triN)]] } : null),
    kpi('Médico na meta', pct(medOk, medN), 'meta Manchester por cor', '#e8a93b', metricDelta(medRate, prevVal(pMedN ? pMedOk / pMedN * 100 : null, prev, m.length, pm.length), 'pp'), '', medN > 0 ? { expr: `${pct(medOk, medN)} = ${fmt(medOk)} ÷ ${fmt(medN)}`, linhas: [['atendidos na meta Manchester', fmt(medOk)], ['com dado de espera médica', fmt(medN)], ['sem dado', fmt(d.length - medN)], ['conformidade', pct(medOk, medN)]] } : null),
    kpi('Total na meta', pct(totalOk, totalN), `meta <= ${meta('metaTotal')} min`, '#7b61c4', metricDelta(totalRate, prevVal(pTotalN ? pTotalOk / pTotalN * 100 : null, prev, m.length, pm.length), 'pp'), '', totalN > 0 ? { expr: `${pct(totalOk, totalN)} = ${fmt(totalOk)} ÷ ${fmt(totalN)}`, linhas: [['tempo total na meta', fmt(totalOk)], ['com tempo total registrado', fmt(totalN)], ['sem registro', fmt(d.length - totalN)], ['conformidade', pct(totalOk, totalN)]] } : null),
    kpi('Volume medio mensal', fmt(monthAvg), `meta >= ${fmt(meta('metaVol'))}`, '#1357a6', metricDelta(monthAvg, prevVal(pm.length ? Math.round(prev.length / pm.length) : null, prev, m.length, pm.length), ''), '', m.length > 0 ? { expr: `${fmt(monthAvg)} = ${fmt(d.length)} ÷ ${m.length} ${m.length === 1 ? 'mês' : 'meses'}`, linhas: [['atendimentos no período', fmt(d.length)], ['meses com atendimentos', m.length], ['média mensal', fmt(monthAvg) + '/mês'], ['meta configurada', '≥ ' + fmt(meta('metaVol')) + '/mês']] } : null)
  ].join('');

  chart('chartIndTri', { type: 'bar', data: { labels: m.map(x => monthLabel(x.k)), datasets: [{ data: m.map(x => x.triN ? +(x.triOk / x.triN * 100).toFixed(1) : null), backgroundColor: m.map(x => x.triN && x.triOk / x.triN >= .9 ? '#38ac8b' : '#c8493e'), borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, targetLine: { lines: [{ value: 90, label: 'meta 90%', color: '#e8a93b' }] } }, scales: { ...axes(), y: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => v + '%' }, max: 100 } } } });
  const tempoVals = m.flatMap(x => [x.triAvg, x.medAvg, x.totAvg]).filter(Number.isFinite);
  chart('chartIndTempo', { type: 'line', data: { labels: m.map(x => monthLabel(x.k)), datasets: [{ label: 'Triagem', data: m.map(x => x.triAvg), borderColor: '#1357a6', tension: .3, spanGaps: true }, { label: 'Médico', data: m.map(x => x.medAvg), borderColor: '#e8a93b', tension: .3, spanGaps: true }, { label: 'Total', data: m.map(x => x.totAvg), borderColor: '#c8493e', tension: .3, spanGaps: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, targetLine: { lines: [{ value: meta('metaTri'), label: 'meta triagem', color: '#1357a6' }, { value: meta('metaMed'), label: 'meta médico', color: '#e8a93b' }, { value: meta('metaTotal'), label: 'meta total', color: '#c8493e' }] } }, scales: { ...axes(), y: { ...axes().y, suggestedMax: Math.max(meta('metaTri'), meta('metaMed'), meta('metaTotal'), ...tempoVals, 1) * 1.15 } } } });

  const manch = manchesterConformidade(d);
  const manchOrder = ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL', 'BRANCO'];
  const manchRows = manchOrder.filter(cor => manch[cor]);
  const manchEl = $('tableManchester');
  if (manchEl) {
    if (!manchRows.length) {
      manchEl.innerHTML = '<tbody><tr class="table-empty"><td colspan="7">Sem dados de espera médica para calcular conformância Manchester.</td></tr></tbody>';
    } else {
      const head = '<thead><tr><th>Classificação</th><th>Meta</th><th>Conform. geral</th><th>Diurno</th><th>Noturno</th><th>Cobertura</th><th>Status</th></tr></thead>';
      const body = '<tbody>' + manchRows.map(cor => {
        const x = manch[cor];
        const totalCor = x.total + (x.semDado || 0);
        const cobertura = totalCor ? x.total / totalCor * 100 : 0;
        const baixaCob = cobertura < 50 && totalCor > 0;
        const rate = x.total ? x.ok / x.total * 100 : 0;
        const rateD = x.D?.total ? x.D.ok / x.D.total * 100 : null;
        const rateN = x.N?.total ? x.N.ok / x.N.total * 100 : null;
        const cls = rate >= 90 ? 'okc' : rate >= 70 ? 'wnc' : 'erc';
        const status = rate >= 90 ? '✓ ok' : rate >= 70 ? 'atenção' : 'fora';
        const tbCls = { VERMELHO: 'tb-vermelho', LARANJA: 'tb-laranja', AMARELO: 'tb-amarelo', VERDE: 'tb-verde', AZUL: 'tb-azul', BRANCO: 'tb-branco' }[cor] || '';
        const badge = '<span class="triage-badge ' + tbCls + '"><span class="tb-dot"></span>' + cor.charAt(0) + cor.slice(1).toLowerCase() + '</span>';
        const cobCell = baixaCob ? '<td class="mono wnc" title="Cobertura baixa">' + cobertura.toFixed(0) + '% ⚠️</td>' : '<td class="mono">' + cobertura.toFixed(0) + '% <span class="muted">(' + fmt(x.total) + '/' + fmt(totalCor) + ')</span></td>';
        const difDN = rateD != null && rateN != null ? Math.abs(rateD - rateN) : 0;
        const piordDN = difDN >= 10 ? (rateD < rateN ? 'D' : 'N') : null;
        const fmtTurno = (r, t) => r == null ? '<td class="mono muted">-</td>' : '<td class="mono ' + (r < 70 ? 'erc' : r < 90 ? 'wnc' : 'okc') + '" title="' + (t === 'D' ? 'Plantão diurno' : 'Plantão noturno') + '">' + r.toFixed(1) + '%' + (piordDN === t ? ' ⚠️' : '') + ' </td>';
        return '<tr><td>' + badge + '</td>' +
          '<td class="mono">' + (x.meta === 0 ? 'imediato' : x.meta + ' min') + '</td>' +
          '<td class="mono" style="color:' + (RISK_COLOR[cor] || '#64748b') + '">' + rate.toFixed(1) + '%</td>' +
          fmtTurno(rateD, 'D') + fmtTurno(rateN, 'N') + cobCell +
          '<td class="mono ' + cls + '">' + status + '</td></tr>';
      }).join('') + '</tbody>';
      manchEl.innerHTML = head + body;
    }
  }

  const dispEl = $('cardDispersao');
  if (dispEl) {
    const medVals = d.filter(r => r.tEspMed != null).map(r => r.tEspMed);
    const triVals = d.filter(r => r.tEspTri != null).map(r => r.tEspTri);
    const metaMed_ = meta('metaMed'), metaTri_ = meta('metaTri');
    const p50m = percentile(medVals, 50), p75m = percentile(medVals, 75), p90m = percentile(medVals, 90), p95m = percentile(medVals, 95);
    const p50t = percentile(triVals, 50), p75t = percentile(triVals, 75), p90t = percentile(triVals, 90), p95t = percentile(triVals, 95);
    const bar = (v, metaV, max) => { const p = Math.min(100, v / max * 100); const c = v > metaV * 1.5 ? 'var(--er)' : v > metaV ? 'var(--wn)' : 'var(--ok)'; return `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--sur2);border-radius:3px"><div style="width:${p}%;height:6px;background:${c};border-radius:3px"></div></div><span class="mono" style="min-width:44px;font-size:11px;color:${c}">${Math.round(v)} min</span></div>`; };
    const maxM = Math.max(p95m || 0, metaMed_ * 2, 1), maxT = Math.max(p95t || 0, metaTri_ * 2, 1);
    dispEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:8px 0">
        <div>
          <div class="section-title-inset" style="margin:0 0 10px">Espera médica — ${fmt(medVals.length)} registros</div>
          ${[['P50 (mediana)', p50m], ['P75', p75m], ['P90', p90m], ['P95', p95m]].map(([l, v]) => v != null ? `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:var(--txt)">${l}</span><span class="mono muted" style="font-size:10px">meta: ${metaMed_} min</span></div>${bar(v, metaMed_, maxM)}</div>` : '').join('')}
        </div>
        <div>
          <div class="section-title-inset" style="margin:0 0 10px">Espera triagem — ${fmt(triVals.length)} registros</div>
          ${[['P50 (mediana)', p50t], ['P75', p75t], ['P90', p90t], ['P95', p95t]].map(([l, v]) => v != null ? `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:var(--txt)">${l}</span><span class="mono muted" style="font-size:10px">meta: ${metaTri_} min</span></div>${bar(v, metaTri_, maxT)}</div>` : '').join('')}
        </div>
      </div>
      <div style="font-size:11px;color:var(--mut);padding-bottom:4px">
        P50 = metade dos pacientes esperou menos · P95 = apenas 5% esperou mais · Meta ${metaMed_}min para espera médica
      </div>`;
  }

  $('tableInd').innerHTML = `<thead><tr><th>Mês</th><th>Volume</th><th>Triagem média</th><th>Triagem na meta</th><th>Espera médico</th><th>Total médio</th><th>Status</th></tr></thead><tbody>${m.map(x => { const ok = [x.vol >= meta('metaVol'), x.triAvg == null || x.triAvg <= meta('metaTri'), x.medAvg == null || x.medAvg <= meta('metaMed'), x.totAvg == null || x.totAvg <= meta('metaTotal')].filter(Boolean).length; return `<tr><td class="mono">${monthLabel(x.k)}</td><td class="mono">${fmt(x.vol)}</td><td class="mono">${x.triAvg == null ? '-' : Math.round(x.triAvg) + ' min'}</td><td class="mono">${pct(x.triOk, x.triN)}</td><td class="mono">${x.medAvg == null ? '-' : Math.round(x.medAvg) + ' min'}</td><td class="mono">${x.totAvg == null ? '-' : Math.round(x.totAvg) + ' min'}</td><td class="mono ${ok >= 3 ? 'okc' : ok >= 2 ? 'wnc' : 'erc'}">${ok}/4</td></tr>`; }).join('')}</tbody>`;
}
