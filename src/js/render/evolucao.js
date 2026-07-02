// render/evolucao.js — Evolucao and AnoAano pane rendering
import { state } from '../state.js';
import { $, esc, fmt, fmtN, pct, kpi } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { monthLabel } from '../utils/dates.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { MES, RISK_COLOR } from '../constants.js';
import { monthlyStats, calcProjecao } from '../metrics/monthly.js';
import { monthReturnRate } from '../metrics/returns.js';
import { returnsFor } from '../metrics/returns.js';

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }

export function renderEvolucao() {
  const d = state.filt, m = monthlyStats(d), keys = m.map(x => x.k);
  const pj = calcProjecao(d), peDiv = $('projEvolucao');
  if (peDiv) {
    if (!pj) { peDiv.innerHTML = ''; }
    else {
      const dColor = pj.projDelta == null ? 'var(--mut)' : pj.projDelta > 10 ? 'var(--er)' : pj.projDelta < -10 ? 'var(--ok)' : 'var(--wn)';
      const dArrow = pj.projDelta == null ? '' : pj.projDelta > 0 ? '▲' : '▼';
      const prevLabel = pj.prev ? (pj.prev.label || monthLabel(pj.prev.k)) : '';
      const dText = pj.projDelta != null ? `${dArrow} ${Math.abs(pj.projDelta)}% vs ${prevLabel}` : 'primeiro mês';
      const barW = pj.pctElapsed;
      const pjLabel = pj.label || monthLabel(pj.k);
      peDiv.innerHTML = `
        <div class="proj-card">
          <div class="proj-hd">
            <strong style="font-size:13px">Projeção - ${pjLabel}</strong>
            <span class="muted mono" style="font-size:11px">baseada em ritmo linear dos ${pj.daysPresent} dias com dados</span>
          </div>
          <div class="proj-kpis">
            <div class="proj-kpi">
              <div class="proj-kpi-label">Volume atual</div>
              <div class="proj-kpi-value">${fmt(pj.volCur)}</div>
              <div class="proj-kpi-sub muted">${pj.daysPresent} de ${pj.daysInMonth} dias</div>
            </div>
            <div class="proj-kpi">
              <div class="proj-kpi-label">Projeção fim do mês</div>
              <div class="proj-kpi-value">~${fmt(pj.projVol)}</div>
              <div class="proj-kpi-sub" style="color:${dColor};font-weight:700">${dText}</div>
            </div>
            ${pj.projVolLast7 != null && pj.projVolLast7 !== pj.projVol ? `
            <div class="proj-kpi">
              <div class="proj-kpi-label">Projeção (ritmo 7d)</div>
              <div class="proj-kpi-value muted">~${fmt(pj.projVolLast7)}</div>
              <div class="proj-kpi-sub muted">${pj.dailyLast7} atend./dia nos últimos 7 dias</div>
            </div>` : ''}
            ${pj.tMedCur != null ? `
            <div class="proj-kpi">
              <div class="proj-kpi-label">Espera medica atual</div>
              <div class="proj-kpi-value" style="color:${pj.tMedCur > meta('metaMed') ? 'var(--er)' : 'var(--ok)'}">${Math.round(pj.tMedCur)} min</div>
              <div class="proj-kpi-sub muted">meta ${meta('metaMed')} min</div>
            </div>` : ''}
            ${pj.tTriCur != null ? `
            <div class="proj-kpi">
              <div class="proj-kpi-label">Espera triagem atual</div>
              <div class="proj-kpi-value" style="color:${pj.tTriCur > meta('metaTri') ? 'var(--er)' : 'var(--ok)'}">${Math.round(pj.tTriCur)} min</div>
              <div class="proj-kpi-sub muted">meta ${meta('metaTri')} min</div>
            </div>` : ''}
          </div>
          <div class="proj-bar-track">
            <div class="proj-bar-fill" style="width:${barW}%"></div>
          </div>
          <div class="proj-note">${pj.pctElapsed}% do mês decorrido — projeção linear simples, não considera sazonalidade intra-mensal</div>
        </div>`;
    }
  }
  if (keys.length < 2) { $('kpisEvolucao').innerHTML = kpi('Evolução', '-', 'selecione pelo menos dois meses', '#94a3b8'); $('tableEvolucao').innerHTML = ''; return; }
  const cur = m[m.length - 1], prev = m[m.length - 2], curRet = monthReturnRate(d, cur.k), prevRet = monthReturnRate(d, prev.k);
  const metrics = [
    { nome: 'Volume', cur: cur.vol, prev: prev.vol, unit: '', inverse: false },
    { nome: 'Espera triagem', cur: cur.triAvg, prev: prev.triAvg, unit: ' min', inverse: true },
    { nome: 'Espera médico', cur: cur.medAvg, prev: prev.medAvg, unit: ' min', inverse: true },
    { nome: 'Tempo total', cur: cur.totAvg, prev: prev.totAvg, unit: ' min', inverse: true },
    { nome: 'Retorno 72h', cur: curRet, prev: prevRet, unit: '%', inverse: true }
  ].filter(x => x.cur != null && x.prev != null).map(x => ({ ...x, diff: x.cur - x.prev, pct: x.prev ? ((x.cur - x.prev) / Math.abs(x.prev) * 100) : 0, bad: x.inverse ? (x.cur > x.prev) : (x.cur < x.prev) }));
  const worst = [...metrics].sort((a, b) => (b.bad ? Math.abs(b.pct) : -Math.abs(b.pct)) - (a.bad ? Math.abs(a.pct) : -Math.abs(a.pct)))[0];
  const best = [...metrics].sort((a, b) => (a.bad ? Math.abs(a.pct) : -Math.abs(a.pct)) - (b.bad ? Math.abs(b.pct) : -Math.abs(b.pct)))[0];
  $('kpisEvolucao').innerHTML = [
    kpi('Mês comparado', monthLabel(cur.k), `vs ${monthLabel(prev.k)}`, '#1357a6'),
    kpi('Maior piora', worst ? worst.nome : '-', worst ? `${worst.diff > 0 ? '+' : ''}${fmtN(worst.diff, 1)}${worst.unit}` : 'sem dados', '#c8493e'),
    kpi('Maior melhora', best ? best.nome : '-', best ? `${best.diff > 0 ? '+' : ''}${fmtN(best.diff, 1)}${best.unit}` : 'sem dados', '#38ac8b')
  ].join('');
  $('tableEvolucao').innerHTML = `<thead><tr><th>Indicador</th><th>${monthLabel(prev.k)}</th><th>${monthLabel(cur.k)}</th><th>Variação</th><th>Leitura</th></tr></thead><tbody>${metrics.map(x => `<tr><td>${esc(x.nome)}</td><td class="mono">${fmtN(x.prev, 1)}${x.unit}</td><td class="mono">${fmtN(x.cur, 1)}${x.unit}</td><td class="mono ${x.bad ? 'erc' : 'okc'}">${x.diff > 0 ? '+' : ''}${fmtN(x.diff, 1)}${x.unit} (${x.pct > 0 ? '+' : ''}${fmtN(x.pct, 1)}%)</td><td class="mono ${x.bad ? 'erc' : 'okc'}">${x.bad ? 'piorou' : 'melhorou'}</td></tr>`).join('')}</tbody>`;
  chart('chartEvolucao', { type: 'line', data: { labels: m.map(x => monthLabel(x.k)), datasets: [{ label: 'Espera triagem', data: m.map(x => x.triAvg), borderColor: '#1357a6', tension: .3, spanGaps: true, yAxisID: 'y' }, { label: 'Espera médico', data: m.map(x => x.medAvg), borderColor: '#e8a93b', tension: .3, spanGaps: true, yAxisID: 'y' }, { label: 'Tempo total', data: m.map(x => x.totAvg), borderColor: '#c8493e', tension: .3, spanGaps: true, yAxisID: 'y' }, { label: 'Volume /100', data: m.map(x => x.vol / 100), borderColor: '#7b61c4', tension: .3, yAxisID: 'y1' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, targetLine: { lines: [{ value: meta('metaTri'), label: 'META TRIAGEM' }, { value: meta('metaMed'), label: 'META MÉDICO' }, { value: meta('metaTotal'), label: 'META TOTAL' }, { value: meta('metaVol') / 100, label: 'META VOL/100', axis: 'y1' }] } }, scales: { ...axes(), y: { ...axes().y, suggestedMax: Math.max(meta('metaTri'), meta('metaMed'), meta('metaTotal'), ...m.flatMap(x => [x.triAvg, x.medAvg, x.totAvg]).filter(Number.isFinite), 1) * 1.15 }, y1: { position: 'right', grid: { display: false }, ticks: { color: '#7b61c4' }, suggestedMax: Math.max(meta('metaVol') / 100, ...m.map(x => x.vol / 100), 1) * 1.15 } } } });
}

export function renderAnoAano() {
  const YR_COLORS = ['#1357a6', '#e8a93b', '#38ac8b', '#7b61c4', '#c8493e', '#4aa3c9'];
  const rawAll = state.raw;
  const years = [...new Set(rawAll.map(r => r.dh && !isNaN(r.dh) ? r.dh.getFullYear() : null).filter(Boolean))].sort();
  if (!years.length) { $('secAnoAano').style.display = 'none'; return; }
  $('secAnoAano').style.display = '';
  const byYr = {};
  rawAll.forEach(r => {
    if (!r.dh || isNaN(r.dh)) return;
    const y = r.dh.getFullYear(), mo = r.dh.getMonth();
    byYr[y] = byYr[y] || Array.from({ length: 12 }, () => ({ vol: 0, tri: [], med: [], tot: [] }));
    byYr[y][mo].vol++;
    if (r.tEspTri != null) byYr[y][mo].tri.push(r.tEspTri);
    if (r.tEspMed != null) byYr[y][mo].med.push(r.tEspMed);
    if (r.tTotal != null) byYr[y][mo].tot.push(r.tTotal);
  });
  $('kpisAnoAano').innerHTML = years.map((y, i) => {
    const mo = byYr[y]; const total = mo.reduce((s, m) => s + m.vol, 0);
    const allMed = mo.flatMap(m => m.med), allTri = mo.flatMap(m => m.tri);
    return kpi(String(y), fmt(total), `tri ${allTri.length ? Math.round(avg(allTri, v => v)) + ' min' : '-'} | med ${allMed.length ? Math.round(avg(allMed, v => v)) + ' min' : '-'}`, YR_COLORS[i % YR_COLORS.length]);
  }).join('');
  chart('chartAnoVol', { type: 'bar', data: { labels: MES, datasets: years.map((y, i) => ({ label: String(y), data: byYr[y].map(m => m.vol || null), backgroundColor: YR_COLORS[i % YR_COLORS.length] + '99', borderColor: YR_COLORS[i % YR_COLORS.length], borderWidth: 1, borderRadius: 3 })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, targetLine: { lines: [{ value: meta('metaVol'), label: 'META VOLUME' }] } }, scales: { ...axes(), y: { ...axes().y, suggestedMax: Math.max(meta('metaVol'), ...years.flatMap(y => byYr[y].map(m => m.vol || 0)), 1) * 1.15 } } } });
  chart('chartAnoMed', { type: 'line', data: { labels: MES, datasets: years.map((y, i) => ({ label: String(y), data: byYr[y].map(m => m.med.length ? +avg(m.med, v => v).toFixed(1) : null), borderColor: YR_COLORS[i % YR_COLORS.length], backgroundColor: YR_COLORS[i % YR_COLORS.length] + '22', tension: .35, spanGaps: true, pointRadius: 3 })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, targetLine: { lines: [{ value: meta('metaMed'), label: 'META' }] } }, scales: { ...axes(), y: { grid: { color: gridColor() }, ticks: { color: tickColor() }, beginAtZero: true } } } });
  const yStats = years.map(y => {
    const mo = byYr[y], total = mo.reduce((s, m) => s + m.vol, 0);
    const activeMes = mo.filter(m => m.vol > 0).length;
    const allTri = mo.flatMap(m => m.tri), allMed = mo.flatMap(m => m.med), allTot = mo.flatMap(m => m.tot);
    const yRows = rawAll.filter(r => r.dh && !isNaN(r.dh) && r.dh.getFullYear() === y);
    const vermTot = yRows.filter(r => r.cor === 'VERMELHO').length;
    const vermTard = yRows.filter(r => r.cor === 'VERMELHO' && r.tEspMed != null && r.tEspMed > 10).length;
    const { ret } = returnsFor(yRows);
    const retPct = yRows.length ? (ret.length / yRows.length * 100).toFixed(1) : '-';
    return { y, total, activeMes, allTri, allMed, allTot, vermTot, vermTard, retPct };
  });
  $('tableAnoAano').innerHTML = `<thead><tr><th>Ano</th><th>Total atend.</th><th>Média/mês</th><th>Espera triagem</th><th>Espera médico</th><th>Tempo total</th><th>Retorno ≤72h</th><th>VERMELHO &gt;10 min</th></tr></thead><tbody>${yStats.map(r => `<tr>
    <td class="mono" style="font-weight:800">${r.y}</td>
    <td class="mono">${fmt(r.total)}</td>
    <td class="mono">${r.activeMes ? fmt(Math.round(r.total / r.activeMes)) : '-'}</td>
    <td class="mono">${r.allTri.length ? Math.round(avg(r.allTri, v => v)) + ' min' : '-'}</td>
    <td class="mono">${r.allMed.length ? Math.round(avg(r.allMed, v => v)) + ' min' : '-'}</td>
    <td class="mono">${r.allTot.length ? Math.round(avg(r.allTot, v => v)) + ' min' : '-'}</td>
    <td class="mono">${r.retPct}%</td>
    <td class="mono ${r.vermTard > 0 ? 'erc' : ''}">${r.vermTard > 0 ? fmt(r.vermTard) + ' (' + pct(r.vermTard, r.vermTot) + ')' : '0'}</td>
  </tr>`).join('')}</tbody>`;

  chart('chartAnoTri', { type: 'line', data: { labels: MES, datasets: years.map((y, i) => ({ label: String(y), data: byYr[y].map(m => m.tri.length ? +avg(m.tri, v => v).toFixed(1) : null), borderColor: YR_COLORS[i % YR_COLORS.length], backgroundColor: YR_COLORS[i % YR_COLORS.length] + '22', tension: .35, spanGaps: true, pointRadius: 3 })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, targetLine: { lines: [{ value: meta('metaTri'), label: 'META' }] } }, scales: { ...axes(), y: { grid: { color: gridColor() }, ticks: { color: tickColor() }, beginAtZero: true } } } });

  const RISK_SHOW = ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL', 'BRANCO'];
  const riskByYr = {};
  rawAll.forEach(r => {
    if (!r.dh || isNaN(r.dh) || !r.cor) return;
    const y = r.dh.getFullYear();
    riskByYr[y] = riskByYr[y] || {};
    riskByYr[y][r.cor] = (riskByYr[y][r.cor] || 0) + 1;
  });
  const riskTotByYr = {};
  years.forEach(y => { riskTotByYr[y] = Object.values(riskByYr[y] || {}).reduce((s, v) => s + v, 0) || 1; });
  chart('chartAnoRisco', { type: 'bar', data: { labels: years.map(String), datasets: RISK_SHOW.filter(k => years.some(y => (riskByYr[y] || {})[k])).map(k => ({ label: k, data: years.map(y => +(((riskByYr[y] || {})[k] || 0) / riskTotByYr[y] * 100).toFixed(1)), backgroundColor: RISK_COLOR[k] || '#64748b', stack: 's' })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toFixed(1)}%` } } }, scales: { x: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => v + '%' }, max: 100 } } } });

  const sazonRows = MES.map((mes, mo) => {
    const cols = years.map(y => {
      const m = byYr[y][mo];
      return { vol: m.vol || 0, med: m.med.length ? Math.round(avg(m.med, v => v)) : null };
    });
    const medVals = cols.map(c => c.med).filter(v => v != null);
    const bestMed = medVals.length ? Math.min(...medVals) : null;
    const worstMed = medVals.length ? Math.max(...medVals) : null;
    const volVals = cols.map(c => c.vol).filter(v => v > 0);
    const bestVol = volVals.length ? Math.max(...volVals) : null;
    const worstVol = volVals.length ? Math.min(...volVals) : null;
    return { mes, cols, bestMed, worstMed, bestVol, worstVol };
  });
  const yrHeaders = years.map((y, i) => `<th colspan="2" style="color:${YR_COLORS[i % YR_COLORS.length]};font-weight:700">${y}</th>`).join('');
  const yrSubHeaders = years.map(() => '<th style="font-size:10px">Vol.</th><th style="font-size:10px">Esp. méd.</th>').join('');
  $('tableAnoMes').innerHTML = `<thead><tr><th>Mês</th>${yrHeaders}</tr><tr><th></th>${yrSubHeaders}</tr></thead><tbody>${sazonRows.map(r => {
    const cells = r.cols.map(c => {
      const volColor = c.vol === r.bestVol ? 'color:var(--ok);font-weight:700' : c.vol === r.worstVol && r.worstVol !== r.bestVol ? 'color:var(--er)' : '';
      const medColor = c.med != null && c.med === r.bestMed ? 'color:var(--ok);font-weight:700' : c.med != null && c.med === r.worstMed && r.worstMed !== r.bestMed ? 'color:var(--er)' : '';
      return `<td class="mono" style="${volColor}">${c.vol ? fmt(c.vol) : '-'}</td><td class="mono" style="${medColor}">${c.med != null ? c.med + ' min' : '-'}</td>`;
    }).join('');
    return `<tr><td class="mono" style="font-weight:600">${r.mes}</td>${cells}</tr>`;
  }).join('')}</tbody>`;
}
