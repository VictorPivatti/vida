// render/geral.js — Visão Geral, Executive, Heatmap pane rendering
import { state } from '../state.js';
import { $, esc, fmt, fmtN, pct, norm, shortName, kpi } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { monthKey, monthLabel } from '../utils/dates.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { CONFIG, EXEC_SCORE, DOW, DOWO } from '../constants.js';
import { monthlyStats, calcProjecao } from '../metrics/monthly.js';
import { metaManchester } from '../metrics/manchester.js';
import { returns72 } from '../metrics/returns.js';
import { evasaoDisponivel } from '../metrics/med.js';
import { previousRows, prevVal, periodDelta } from '../metrics/previous-period.js';
import { renderOnboardingPanel } from '../ui/onboarding-panel.js';
import { dateRange } from '../filters.js';

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Group an array by a key function, counting occurrences. */
function group(arr, fn) {
  return arr.reduce((m, r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; return m; }, {});
}

/** Read a meta input value by element id. */
function meta(id) {
  return Number(document.getElementById(id)?.value) || 0;
}

function metricDelta(cur, prev, unit = '', inverse = false) {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return '';
  const diff = cur - prev, pctDiff = diff / Math.abs(prev) * 100, good = inverse ? diff <= 0 : diff >= 0;
  const sign = diff > 0 ? '+' : '';
  return `<div class="k-trend ${good ? 'okc' : 'erc'}">${sign}${unit === 'pp' ? fmtN(diff, 1) + ' p.p.' : Math.round(diff) + (unit ? ` ${unit}` : '')} (${sign}${fmtN(pctDiff, 1)}%) vs período anterior</div>`;
}

function topAlerts(rows) {
  const { ret } = returns72();
  const alerts = [], retRate = rows.length ? ret.length / rows.length * 100 : 0;
  const tMed = avg(rows, r => r.tEspMed), tTri = avg(rows, r => r.tEspTri), tTot = avg(rows, r => r.tTotal);
  const n = rows.length || 1;
  if (retRate > meta('metaRet')) alerts.push(['err', 'Retorno ≤72h acima da meta', `Taxa de ${fmtN(retRate, 1)}% (${ret.length} eventos). Meta: < ${meta('metaRet')}%.`]);
  if (tMed != null && tMed > meta('metaMed')) alerts.push(['warn', 'Espera médica acima da meta', `Média de ${Math.round(tMed)} min (meta: ≤ ${meta('metaMed')} min).`]);
  if (tTri != null && tTri > meta('metaTri')) alerts.push(['warn', 'Espera de triagem acima da meta', `Média de ${Math.round(tTri)} min (meta: ≤ ${meta('metaTri')} min).`]);
  if (tTot != null && tTot > meta('metaTotal')) alerts.push(['warn', 'Tempo total acima da meta', `Média de ${Math.round(tTot)} min (meta: ≤ ${meta('metaTotal')} min).`]);
  const semMed = rows.filter(r => !r.prof).length;
  if (semMed / n > 0.1) alerts.push(['warn', 'Alto índice de atendimentos sem médico', `${fmt(semMed)} atendimentos (${pct(semMed, n)}) sem médico.`]);
  const vermSemRapido = rows.filter(r => r.cor === 'VERMELHO' && r.tEspMed != null && r.tEspMed > 10).length;
  if (vermSemRapido > 0) alerts.push(['err', 'Vermelhos com espera > 10 min', `${fmt(vermSemRapido)} paciente(s) com espera > 10 min.`]);
  const byM = group(rows, r => r.anoMes), keys = Object.keys(byM).map(Number).sort();
  for (let i = 1; i < keys.length; i++) {
    const p = byM[keys[i - 1]], v = byM[keys[i]], drop = (v - p) / p * 100;
    if (drop < -10) alerts.push(['warn', 'Queda de volume mensal', `${monthLabel(keys[i])}: ${fmtN(drop, 1)}%.`]);
  }
  if (!alerts.length) alerts.push(['ok', 'Sem alerta crítico no período', 'Metas principais dentro do esperado.']);
  return alerts;
}

function _deltaPill(label, cur, prev, { unit = '', inverse = false, format = v => String(v) } = {}) {
  const d = periodDelta(cur, prev, { inverse });
  if (d.dir == null) {
    return `<div class="dash-delta-pill muted"><span class="dash-delta-label">${esc(label)}</span><span class="dash-delta-val">${format(cur ?? '—')}</span><span class="dash-delta-sub">sem período anterior</span></div>`;
  }
  const arrow = d.dir === 'up' ? '↑' : d.dir === 'down' ? '↓' : '→';
  const cls = d.good ? 'okc' : 'erc';
  const sign = d.diff > 0 ? '+' : '';
  const diffTxt = unit === 'pp' ? `${sign}${fmtN(d.diff, 1)} p.p.` : unit === 'min' ? `${sign}${Math.round(d.diff)} min` : `${sign}${Math.round(d.diff)}`;
  const pctTxt = d.pct != null ? ` (${sign}${fmtN(d.pct, 1)}%)` : '';
  return `<div class="dash-delta-pill ${cls}"><span class="dash-delta-label">${esc(label)}</span><span class="dash-delta-val">${format(cur)}</span><span class="dash-delta-sub">${arrow} ${diffTxt}${pctTxt} vs período anterior</span></div>`;
}

function renderDashDeltaRow(d, prev, pm_g, m_g) {
  const el = $('dashDeltaRow');
  if (!el) return;
  const metaTri = meta('metaTri');
  const triN = d.filter(r => r.tEspTri != null).length;
  const triOk = d.filter(r => r.tEspTri != null && r.tEspTri <= metaTri).length;
  const triRate = triN ? triOk / triN * 100 : null;
  const pTriN = prev.filter(r => r.tEspTri != null).length;
  const pTriOk = prev.filter(r => r.tEspTri != null && r.tEspTri <= metaTri).length;
  const prevTriRate = prevVal(pTriN ? pTriOk / pTriN * 100 : null, prev, m_g, pm_g.length);
  const curTotal = avg(d, r => r.tTotal);
  const prevTotal = prevVal(avg(prev, r => r.tTotal), prev, m_g, pm_g.length);
  const prevVol = prevVal(prev.length, prev, m_g, pm_g.length);
  el.innerHTML =
    _deltaPill('Volume', d.length, prevVol, { format: v => fmt(v) }) +
    _deltaPill('Triagem na meta', triRate, prevTriRate, { unit: 'pp', format: v => v != null ? fmtN(v, 1) + '%' : '—' }) +
    _deltaPill('Tempo total médio', curTotal, prevTotal, { unit: 'min', inverse: true, format: v => v != null ? Math.round(v) + ' min' : '—' });
}

/** Dados serializáveis para capa executiva do PDF. */
export function buildExecutiveCoverData() {
  const d = state.filt;
  const total = d.length;
  const days = new Set(d.map(r => r.dateKey)).size;
  const curDaily = days ? Math.round(total / days) : 0;
  const curTotalTime = avg(d, r => r.tTotal);
  const { ret } = returns72();
  const retRate = total ? ret.length / total * 100 : 0;
  const grave = d.filter(r => ['VERMELHO', 'LARANJA', 'AMARELO'].includes(r.cor)).length;
  const graveRate = total ? grave / total * 100 : 0;
  const allAlerts = topAlerts(d);
  const alerts = allAlerts.slice(0, 3);
  const { s, e } = dateRange();
  const UC = typeof window.UC === 'object' && window.UC ? window.UC : {};
  let score = 0;
  try {
    const bad = allAlerts.filter(a => a[0] === 'err').length;
    const warn = allAlerts.filter(a => a[0] === 'warn').length;
    const tMed = avg(d, r => r.tEspMed), tTri = avg(d, r => r.tEspTri);
    const p = EXEC_SCORE.penalties;
    const penalty = bad * p.criticalAlert + warn * p.warningAlert +
      Math.max(0, retRate - meta('metaRet')) * p.retornoPerPoint +
      Math.max(0, (tMed ?? 0) - meta('metaMed')) * p.medicoPerMinute +
      Math.max(0, (tTri ?? 0) - meta('metaTri')) * p.triagemPerMinute +
      Math.max(0, (curTotalTime ?? 0) - meta('metaTotal')) * p.totalPerMinute +
      Math.max(0, graveRate - 35) * p.graveShareOver35PerPoint;
    score = Math.max(0, Math.round(EXEC_SCORE.base - penalty));
  } catch (err) { /* score opcional */ }
  return {
    unitName: UC.nome || 'Unidade de Saúde',
    periodStart: s ? s.toLocaleDateString('pt-BR') : '',
    periodEnd: e ? e.toLocaleDateString('pt-BR') : '',
    kpis: [
      { label: 'Atendimentos', value: fmt(total), sub: `${days} dias` },
      { label: 'Média diária', value: fmt(curDaily), sub: 'atend./dia' },
      { label: 'Tempo total médio', value: curTotalTime != null ? Math.round(curTotalTime) + ' min' : '—', sub: 'recepção → alta' },
      { label: 'Retorno ≤72h', value: fmtN(retRate, 1) + '%', sub: fmt(ret.length) + ' eventos' },
    ],
    alerts,
    score,
  };
}

// Re-export for globals / tests
export { prevVal } from '../metrics/previous-period.js';

// ── Exported render functions ────────────────────────────────────────────────

export function renderGeral() {
  const d = state.filt, total = d.length, days = new Set(d.map(r => r.dateKey)).size;
  const prev = previousRows(), prevDays = new Set(prev.map(r => r.dateKey)).size;
  const pm_g = monthlyStats(prev), m_g = new Set(d.map(r => r.anoMes)).size;
  renderDashDeltaRow(d, prev, pm_g, m_g);
  const curDaily = days ? Math.round(total / days) : 0, prevDaily = prevDays ? Math.round(prev.length / prevDays) : null;
  const curTotalTime = avg(d, r => r.tTotal), prevTotalTime = avg(prev, r => r.tTotal);
  const { ret } = returns72(), retRate = total ? ret.length / total * 100 : 0;
  const grave = d.filter(r => ['VERMELHO', 'LARANJA', 'AMARELO'].includes(r.cor)).length, graveRate = total ? grave / total * 100 : 0;
  renderExecutive(total, curDaily, curTotalTime, retRate, graveRate);
  const evasoes = d.filter(r => r.evadido).length;
  const evasaoRate = total > 0 ? (evasoes / total * 100) : 0;
  const _evasaoDisp = evasaoDisponivel(d);
  const mesesGeral = [...new Set(d.map(r => r.anoMes))];
  const temRecepGeral = mesesGeral.some(m => state.recepcionados[m] != null);
  let evasaoKpi;
  if (_evasaoDisp) {
    evasaoKpi = kpi('Taxa de evasão', evasoes > 0 ? fmtN(evasaoRate, 1) + '%' : '0%', `${fmt(evasoes)} saídas sem atendimento`, evasoes > 0 ? '#c8493e' : 'var(--ok)');
  } else if (temRecepGeral) {
    let totRec = 0, totBr = 0, totAt = 0;
    mesesGeral.forEach(m => {
      const recep = state.recepcionados[m]; if (!recep) return;
      const ov = state.recepOverride[m] || {};
      const triRows = state.triFilt.filter(r => r.anoMes === m);
      const brAuto = triRows.filter(r => r.cor === 'BRANCO').length;
      const atAuto = d.filter(r => r.anoMes === m).length;
      totRec += recep;
      totBr += ov.brancos != null ? ov.brancos : brAuto;
      totAt += ov.atendidos != null ? ov.atendidos : atAuto;
    });
    const totEv = totRec - totBr - totAt;
    const totTx = totRec > 0 ? totEv / totRec * 100 : null;
    evasaoKpi = kpi('Taxa de evasão',
      totTx != null ? (totTx < 0 ? '<0%' : totTx.toFixed(1) + '%') : '—',
      totEv >= 0 ? `${fmt(Math.max(0, totEv))} evasões · ${fmt(totRec)} recepcionados` : 'Revisar dados',
      totTx != null && totTx > 5 ? '#c8493e' : totTx != null && totTx > 2 ? '#e8a93b' : 'var(--ok)');
  } else {
    evasaoKpi = kpi('Evasão', 'N/D', 'insira recepcionados em Configurações → Metas para calcular', 'var(--mut)');
  }
  $('kpisGeral').innerHTML = [
    kpi('Atendimentos', fmt(total), `${days} dias no período`, '#1357a6', metricDelta(total, prevVal(prev.length, prev, m_g, pm_g.length), ''), '', { expr: `${fmt(total)} registros no período filtrado`, linhas: [['registros totais', fmt(total)], ['dias distintos', days], ['resultado', fmt(total) + ' atendimentos']] }),
    kpi('Média diária', fmt(curDaily), 'atendimentos/dia', '#38ac8b', metricDelta(curDaily, prevVal(prevDaily, prev, m_g, pm_g.length), ''), '', { expr: `${fmt(total)} ÷ ${days} dias = ${fmt(curDaily)}/dia`, linhas: [['atendimentos no período', fmt(total)], ['dias com atendimento', days], ['média diária', fmt(curDaily) + '/dia']] }),
    evasaoKpi,
    kpi('Tempo total médio', curTotalTime != null ? Math.round(curTotalTime) + ' min' : '-', 'recepção até alta', '#e8a93b', metricDelta(curTotalTime, prevVal(prevTotalTime, prev, m_g, pm_g.length), 'min', true), '', curTotalTime != null ? (() => { const _n = d.filter(r => r.tTotal != null).length; return { expr: `média(recepção → alta) — ${fmt(_n)} de ${fmt(total)} registros`, linhas: [['com tempo total registrado', fmt(_n)], ['sem dado de tempo', fmt(total - _n)], ['tempo médio calculado', Math.round(curTotalTime) + ' min']] }; })() : null)
  ].join('');
  const byM = group(d, r => r.anoMes), keys = Object.keys(byM).map(Number).sort();
  const volVals = keys.map(k => byM[k]);
  chart('chartMensal', { type: 'bar', data: { labels: keys.map(monthLabel), datasets: [{ data: volVals, backgroundColor: '#1357a6', borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, targetLine: { lines: [{ value: meta('metaVol'), label: 'META VOLUME' }] } }, scales: { ...axes(), y: { ...axes().y, suggestedMax: Math.max(meta('metaVol'), ...volVals, 1) * 1.15 } } } });
  const byDow = group(d, r => r.diaSem);
  chart('chartDow', { type: 'bar', data: { labels: DOWO.map(i => DOW[i]), datasets: [{ data: DOWO.map(i => byDow[i] || 0), backgroundColor: '#2f9e7e', borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  const byH = group(d, r => r.hora);
  chart('chartHora', { type: 'line', data: { labels: Array.from({ length: 24 }, (_, i) => i + 'h'), datasets: [{ data: Array.from({ length: 24 }, (_, i) => byH[i] || 0), borderColor: '#7b61c4', backgroundColor: 'rgba(123,97,196,.12)', fill: true, tension: .35, pointRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  renderHeatmap(d);
  const _pj = calcProjecao(d), pgn = $('projGeralNotice');
  if (pgn) {
    if (!_pj) { pgn.innerHTML = ''; }
    else {
      const dColor = _pj.projDelta == null ? 'var(--mut)' : _pj.projDelta > 5 ? 'var(--er)' : _pj.projDelta < -5 ? 'var(--ok)' : 'var(--mut)';
      const dSign = _pj.projDelta != null ? (_pj.projDelta > 0 ? '+' : '') + _pj.projDelta + '%' : '';
      pgn.innerHTML = `<div class="proj-notice">
        <span class="proj-notice-label">Projeção ${_pj.label || monthLabel(_pj.k)}</span>
        <span class="mono"><strong style="font-size:16px">${fmt(_pj.projVol)}</strong> <span class="muted">atend. estimados</span></span>
        <span class="mono" style="font-weight:700;color:${dColor}">${dSign ? dSign + ' vs ' + (_pj.prev ? monthLabel(_pj.prev.k) : '') : ''}</span>
        <span class="muted mono">${_pj.daysPresent}/${_pj.daysInMonth} dias (${_pj.pctElapsed}% do mês)</span>
        <span class="muted" style="font-size:11px">ritmo últimos 7 dias: ${_pj.dailyLast7 != null ? _pj.dailyLast7 + '/dia' : '-'}</span>
      </div>`;
    }
  }
  renderOnboardingPanel();
}

export function renderExecutive(total, daily, totalTime, retRate, graveRate) {
  const alerts = topAlerts(state.filt), bad = alerts.filter(a => a[0] === 'err').length, warn = alerts.filter(a => a[0] === 'warn').length;
  const tMed = avg(state.filt, r => r.tEspMed), tTri = avg(state.filt, r => r.tEspTri);
  const p = EXEC_SCORE.penalties;
  const penalty = bad * p.criticalAlert + warn * p.warningAlert +
    Math.max(0, retRate - meta('metaRet')) * p.retornoPerPoint +
    Math.max(0, (tMed ?? 0) - meta('metaMed')) * p.medicoPerMinute +
    Math.max(0, (tTri ?? 0) - meta('metaTri')) * p.triagemPerMinute +
    Math.max(0, (totalTime ?? 0) - meta('metaTotal')) * p.totalPerMinute +
    Math.max(0, graveRate - 35) * p.graveShareOver35PerPoint;
  const score = Math.max(0, Math.round(EXEC_SCORE.base - penalty));
  const fl = EXEC_SCORE.floors;
  const isExc = score >= fl.excellent, isAtt = score >= fl.attention;
  const scoreColor = isExc ? 'var(--ok)' : isAtt ? 'var(--wn)' : 'var(--er)';
  const scoreLabel = isExc ? 'Excelente' : isAtt ? 'Atenção' : 'Crítico';
  const scoreSub = isExc ? 'Metas principais dentro do esperado.' : isAtt ? `${bad} alerta${bad !== 1 ? 's' : ''} crítico${bad !== 1 ? 's' : ''}, ${warn} de atenção.` : `${bad} alerta${bad !== 1 ? 's' : ''} crítico${bad !== 1 ? 's' : ''} identificado${bad !== 1 ? 's' : ''}.`;
  const trackGrad = `linear-gradient(to right, var(--er) 0%, var(--er) ${fl.attention}%, var(--wn) ${fl.attention}%, var(--wn) ${fl.excellent}%, var(--ok) ${fl.excellent}%, var(--ok) 100%)`;
  const penItems = [];
  if (bad > 0) penItems.push({ label: `${bad} alerta${bad > 1 ? 's' : ''} crítico${bad > 1 ? 's' : ''}`, val: -(bad * p.criticalAlert), tip: `${bad} × 24 pts` });
  if (warn > 0) penItems.push({ label: `${warn} alerta${warn > 1 ? 's' : ''} de atenção`, val: -(warn * p.warningAlert), tip: `${warn} × 9 pts` });
  const penRet = Math.max(0, retRate - meta('metaRet')) * p.retornoPerPoint;
  if (penRet > 0) penItems.push({ label: `Retorno ${fmtN(retRate, 1)}% (meta ${meta('metaRet')}%)`, val: -penRet, tip: `${fmtN(retRate - meta('metaRet'), 1)} pp × 1,4` });
  const penMed = Math.max(0, (tMed || 0) - meta('metaMed')) * p.medicoPerMinute;
  if (penMed > 0) penItems.push({ label: `Espera médico ${tMed != null ? Math.round(tMed) + ' min' : '-'} (meta ${meta('metaMed')} min)`, val: -penMed, tip: `${Math.round((tMed || 0) - meta('metaMed'))} min × 0,35` });
  const penTri = Math.max(0, (tTri || 0) - meta('metaTri')) * p.triagemPerMinute;
  if (penTri > 0) penItems.push({ label: `Espera triagem ${tTri != null ? Math.round(tTri) + ' min' : '-'} (meta ${meta('metaTri')} min)`, val: -penTri, tip: `${Math.round((tTri || 0) - meta('metaTri'))} min × 0,45` });
  const penTot = Math.max(0, (totalTime || 0) - meta('metaTotal')) * p.totalPerMinute;
  if (penTot > 0) penItems.push({ label: `Tempo total ${totalTime != null ? Math.round(totalTime) + ' min' : '-'} (meta ${meta('metaTotal')} min)`, val: -penTot, tip: `${Math.round((totalTime || 0) - meta('metaTotal'))} min × 0,18` });
  const penGrave = Math.max(0, graveRate - 35) * p.graveShareOver35PerPoint;
  if (penGrave > 0) penItems.push({ label: `Casos amarelo+ ${fmtN(graveRate, 1)}% (acima de 35%)`, val: -penGrave, tip: `${fmtN(graveRate - 35, 1)} pp × 0,35` });
  const penHTML = penItems.length ? penItems.map(x => `<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:3px"><span style="color:var(--txt2)">${esc(x.label)}</span><span style="color:var(--er);font-weight:700;white-space:nowrap" title="${esc(x.tip)}">${Math.round(x.val)} pts</span></div>`).join('') : `<div style="color:var(--ok)">Nenhuma penalidade aplicada no período.</div>`;
  $('execSituation').innerHTML = `
    <div class="card-title">Situação executiva</div>
    <div class="exec-score-row">
      <div>
        <div class="exec-score" style="color:${scoreColor}">${score}</div>
        <div class="exec-score-label" style="color:${scoreColor}">${scoreLabel}</div>
      </div>
      <div class="exec-score-detail">
        <div class="k-sub" style="margin-bottom:8px">${scoreSub}</div>
        <div class="exec-gauge-track" style="background:${trackGrad}">
          <div class="exec-gauge-fill" style="width:${score}%;background:${scoreColor}"></div>
          <div class="exec-gauge-needle" style="left:${score}%;color:${scoreColor};border-color:${scoreColor}"></div>
        </div>
        <div class="exec-gauge-labels">
          <span>0</span>
          <span style="left:${fl.attention}%">62 — Atenção</span>
          <span style="left:${fl.excellent}%">82 — Excelente</span>
          <span>100</span>
        </div>
      </div>
    </div>
    <div class="k-sub" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bdr)">
      Demanda: ${fmt(total)} atendimentos (${fmt(daily)}/dia) · Permanência média: ${totalTime == null ? '-' : Math.round(totalTime) + ' min'} · Retorno 72h: ${fmtN(retRate, 1)}% · Casos amarelo+: ${fmtN(graveRate, 1)}%
    </div>
    <details style="margin-top:10px">
      <summary style="cursor:pointer;font-size:11px;color:var(--mut);user-select:none">ℹ Metodologia do score</summary>
      <div style="margin-top:8px;padding:10px 12px;background:var(--sur2);border:1px solid var(--bdr);border-radius:8px;font-size:11px;font-family:'Geist Mono',monospace">
        <div style="font-weight:700;margin-bottom:8px;color:var(--txt)">Base: 100 pts — penalidades aplicadas:</div>
        ${penHTML}
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--bdr);display:flex;justify-content:space-between">
          <span style="color:var(--mut)">Score final</span>
          <span style="font-weight:800;color:${scoreColor}">${score} pts</span>
        </div>
        <div style="margin-top:6px;color:var(--mut);font-size:10px">Zonas: &lt;62 Crítico · 62–81 Atenção · ≥82 Excelente</div>
      </div>
    </details>`;
  $('execAlerts').innerHTML = alerts.slice(0, 4).map(([t, title, msg]) => `<div class="exec-alert"><span class="dot" style="background:var(--${t === 'err' ? 'er' : t === 'warn' ? 'wn' : t === 'ok' ? 'ok' : 'inf'})"></span><div><strong>${esc(title)}</strong><span class="mono">${esc(msg)}</span></div></div>`).join('');
}

export function renderHeatmap(rows) {
  const map = {};
  rows.forEach(r => { const k = r.diaSem + '-' + r.hora; map[k] = (map[k] || 0) + 1 });
  const max = Object.values(map).reduce((m, v) => v > m ? v : m, 1);
  let html = `<div class="hm-corner"></div>${Array.from({ length: 24 }, (_, h) => `<div class="hm-head">${h}</div>`).join('')}`;
  DOWO.forEach(dow => {
    html += `<div class="hm-row">${DOW[dow]}</div>`;
    for (let h = 0; h < 24; h++) {
      const n = map[dow + '-' + h] || 0, a = n / max, bg = n ? `rgba(68,128,194,${.12 + a * .78})` : 'var(--sur2)';
      html += `<div class="hm-cell" data-tip="${DOW[dow]} ${h}h: ${fmt(n)} atend." style="background:${bg}"></div>`;
    }
  });
  $('heatmap').innerHTML = html;
}
