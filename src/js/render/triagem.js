// render/triagem.js — Triagem pane rendering
import { state } from '../state.js';
import { $, esc, fmt, fmtN, pct, shortName, kpi, kpiPrimary, kpiSecondary, renderKpiTiers } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { monthLabel } from '../utils/dates.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { RISK_ORDER, RISK_COLOR } from '../constants.js';

import { previousRows, prevVal, rowsInRange } from '../metrics/previous-period.js';
import { dateRange } from '../filters.js';
import { monthlyStats } from '../metrics/monthly.js';

function previousTriRows() {
  const { s, e } = dateRange();
  if (!s || !e) return [];
  const span = e.getTime() - s.getTime();
  const prevEnd = new Date(s.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  return rowsInRange(state.triRaw, prevStart, prevEnd);
}

function metricDelta(cur, prev, unit = '', inverse = false) {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return '';
  const diff = cur - prev, pctDiff = diff / Math.abs(prev) * 100, good = inverse ? diff <= 0 : diff >= 0;
  const sign = diff > 0 ? '+' : '';
  return `<div class="k-trend ${good ? 'okc' : 'erc'}">${sign}${unit === 'pp' ? fmtN(diff, 1) + ' p.p.' : Math.round(diff) + (unit ? ` ${unit}` : '')} (${sign}${fmtN(pctDiff, 1)}%) vs período anterior</div>`;
}

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }
function group(arr, fn) { return arr.reduce((m, r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; return m; }, {}); }

export function renderTriagem() {
  if (!state.triRaw.length) { $('triEmpty').classList.remove('hidden'); $('triContent').classList.add('hidden'); return; }
  $('triEmpty').classList.add('hidden'); $('triContent').classList.remove('hidden');
  const d = state.triFilt, total = d.length;
  const fromHist = state.triSource === 'hist';
  const triadores = new Set(d.filter(r => r.triador).map(r => r.triador)).size;
  const branco = d.filter(r => r.cor === 'BRANCO').length;

  const sourceBadge = fromHist
    ? `<div class="tri-source-banner warn"><strong>⚠ Dados derivados do histórico</strong> — campo "triador" não disponível. Carregue a planilha específica de triagem para desbloquear produtividade por triador e dados mais precisos.</div>`
    : `<div class="tri-source-banner ok"><strong>✓ Planilha de triagem carregada</strong> — todos os campos disponíveis, incluindo nome do triador.</div>`;
  $('triSourceBanner').innerHTML = sourceBadge;

  const prevTri = previousTriRows();
  const pm = monthlyStats(state.filt), ptm = monthlyStats(prevTri);
  const espAvg = avg(d, r => r.tEsp);
  const prevEsp = prevVal(avg(prevTri, r => r.tEsp), prevTri, pm.length, ptm.length);
  const gap = Math.max(total - branco - state.filt.length, 0);
  const prevGap = Math.max(prevTri.length - prevTri.filter(r => r.cor === 'BRANCO').length - previousRows().length, 0);

  renderKpiTiers('kpisTri', [
    kpiPrimary('Triagens', fmt(total), `${fmt(state.filt.length)} atendimentos médicos no período`, '#1357a6', metricDelta(total, prevVal(prevTri.length, prevTri, pm.length, ptm.length), '')),
    kpiPrimary('Espera média', espAvg != null ? Math.round(espAvg) + ' min' : '-', `meta ≤ ${meta('metaTri')} min`, '#e8a93b', metricDelta(espAvg, prevEsp, 'min', true)),
    kpiPrimary('Gap triagem-médico', fmt(gap), 'triados não brancos sem atendimento médico aparente', '#e8a93b', metricDelta(gap, prevVal(prevGap, prevTri, pm.length, ptm.length), '', true)),
  ], [
    fromHist
      ? kpiSecondary('Triadores', '—', 'carregue planilha de triagem', '#94a3b8')
      : kpiSecondary('Triadores', fmt(triadores), 'profissionais distintos', '#7b61c4'),
    kpiSecondary('Brancos', fmt(branco), pct(branco, total) + ' das triagens', '#94a3b8'),
    kpiSecondary('Não brancos', fmt(total - branco), pct(total - branco, total) + ' encaminhados', '#38ac8b'),
  ]);

  const byH = group(d, r => r.hora), esp = {};
  d.forEach(r => { if (r.tEsp == null) return; (esp[r.hora] = esp[r.hora] || []).push(r.tEsp); });
  chart('chartTriHora', { type: 'bar', data: { labels: Array.from({ length: 24 }, (_, i) => i + 'h'), datasets: [
    { type: 'bar', label: 'Triagens', data: Array.from({ length: 24 }, (_, i) => byH[i] || 0), backgroundColor: 'rgba(79,142,247,.55)', yAxisID: 'y', borderRadius: 3 },
    { label: 'Espera média (min)', data: Array.from({ length: 24 }, (_, i) => esp[i] ? +avg(esp[i], v => v).toFixed(1) : 0), backgroundColor: 'rgba(232,169,59,.55)', yAxisID: 'y1', borderRadius: 3 }
  ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, targetLine: { lines: [{ value: meta('metaTri'), label: 'META ESPERA', axis: 'y1' }] } }, scales: { x: { grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { position: 'left', grid: { color: gridColor() }, ticks: { color: tickColor() }, beginAtZero: true }, y1: { position: 'right', grid: { display: false }, ticks: { color: '#e8a93b', callback: v => v + ' min' }, beginAtZero: true } } } });

  const risks = group(d, r => r.cor), rkeys = RISK_ORDER.filter(k => risks[k]).reverse();
  chart('chartTriRisco', { type: 'bar', data: { labels: rkeys, datasets: [{ data: rkeys.map(k => risks[k]), backgroundColor: rkeys.map(k => RISK_COLOR[k] || '#64748b'), borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${fmt(c.parsed.x)} triagens (${pct(c.parsed.x, total)})` } } }, scales: { x: { grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { size: 10 } } } } } });

  if (fromHist) {
    $('chartTriador').closest('.card').style.display = 'none';
    $('tableTri').closest('.card').style.display = 'none';
  } else {
    $('chartTriador').closest('.card').style.display = '';
    $('tableTri').closest('.card').style.display = '';
    const triMap = {};
    d.forEach(r => { if (!r.triador) return; triMap[r.triador] = triMap[r.triador] || { name: r.triador, total: 0, esp: [], risks: {} }; triMap[r.triador].total++; if (r.tEsp != null) triMap[r.triador].esp.push(r.tEsp); triMap[r.triador].risks[r.cor] = (triMap[r.triador].risks[r.cor] || 0) + 1; });
    const rows = Object.values(triMap).sort((a, b) => b.total - a.total);
    chart('chartTriador', { type: 'bar', data: { labels: rows.slice(0, 12).reverse().map(r => shortName(r.name)), datasets: [{ data: rows.slice(0, 12).reverse().map(r => r.total), backgroundColor: '#38ac8b', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
    $('tableTri').innerHTML = `<thead><tr><th>Triador</th><th>Total</th><th>Espera média</th><th>Cor predominante</th></tr></thead><tbody>${rows.map(r => { const top = Object.entries(r.risks).sort((a, b) => b[1] - a[1])[0] || ['-', 0]; return `<tr><td>${esc(r.name)}</td><td class="mono">${fmt(r.total)}</td><td class="mono">${r.esp.length ? Math.round(avg(r.esp, v => v)) + ' min' : '-'}</td><td><span class="triage-badge ${({ VERMELHO: 'tb-vermelho', LARANJA: 'tb-laranja', AMARELO: 'tb-amarelo', VERDE: 'tb-verde', AZUL: 'tb-azul', BRANCO: 'tb-branco' })[top[0]] || ''}"><span class="tb-dot"></span>${esc(top[0])}</span>&nbsp;<span class="mono muted" style="font-size:11px">${pct(top[1], r.total, 0)}</span></td></tr>`; }).join('')}</tbody>`;
  }
  renderEvasao(d);
}

export function renderRecepTable() {
  const body = document.getElementById('recepInputBody'); if (!body) return;
  const mesesTri = [...new Set(state.triFilt.map(r => r.anoMes))];
  const mesesHist = [...new Set(state.filt.map(r => r.anoMes))];
  const meses = [...new Set([...mesesTri, ...mesesHist])].sort();
  if (!meses.length) { body.innerHTML = '<tr><td colspan="4" style="color:var(--mut);text-align:center;padding:16px">Carregue o historico para liberar os campos</td></tr>'; return; }
  const brancosPorMes = {}, triadosPorMes = {};
  state.triFilt.forEach(r => {
    triadosPorMes[r.anoMes] = (triadosPorMes[r.anoMes] || 0) + 1;
    if (r.cor === 'BRANCO') brancosPorMes[r.anoMes] = (brancosPorMes[r.anoMes] || 0) + 1;
  });
  const atendidosPorMes = {};
  state.filt.forEach(r => { atendidosPorMes[r.anoMes] = (atendidosPorMes[r.anoMes] || 0) + 1; });
  const inpStyle = 'width:80px;background:var(--sur3);border:1px solid var(--bdr2);border-radius:4px;padding:3px 7px;color:var(--txt);font-family:inherit;font-size:12px;text-align:right';
  const inpStyleOv = 'width:80px;background:rgba(99,102,241,.08);border:1px solid var(--ac);border-radius:4px;padding:3px 7px;color:var(--txt);font-family:inherit;font-size:12px;text-align:right';
  body.innerHTML = meses.map(m => {
    const ov = state.recepOverride[m] || {};
    const trAuto = triadosPorMes[m] || 0, brAuto = brancosPorMes[m] || 0, atAuto = atendidosPorMes[m] || 0;
    const trVal = ov.triados != null ? ov.triados : trAuto;
    const brVal = ov.brancos != null ? ov.brancos : brAuto;
    const atVal = ov.atendidos != null ? ov.atendidos : atAuto;
    const hasOv = ov.triados != null || ov.brancos != null || ov.atendidos != null;
    const onchg = `(function(el){
      const m='${m}';
      const field=el.dataset.field;
      const val=el.value?Number(el.value):null;
      if(val===null){delete(state.recepOverride[m]||{})[field];}
      else{state.recepOverride[m]=state.recepOverride[m]||{};state.recepOverride[m][field]=val;}
      if(Object.keys(state.recepOverride[m]||{}).length===0)delete state.recepOverride[m];
      saveRecepcionados();
      if(state.triRaw.length)renderEvasao(state.triFilt);
      else if(state.raw.length)renderEvasao(state.filt);
    })(this)`;
    return `<tr>
      <td class="mono">${monthLabel(m)}</td>
      <td><input type="number" min="0" step="1" style="${inpStyle}"
        value="${state.recepcionados[m] || ''}" placeholder="—" data-mes="${m}"
        onchange="state.recepcionados[this.dataset.mes]=this.value?Number(this.value):undefined;saveRecepcionados();if(state.triRaw.length)renderEvasao(state.triFilt);else if(state.raw.length)renderEvasao(state.filt)">
      </td>
      <td><input type="number" min="0" step="1" style="${ov.triados != null ? inpStyleOv : inpStyle}"
        value="${trVal}" placeholder="${trAuto}" title="Auto: ${trAuto}. Edite para sobrescrever."
        data-mes="${m}" data-field="triados" onchange="${onchg}">
      </td>
      <td><input type="number" min="0" step="1" style="${ov.brancos != null ? inpStyleOv : inpStyle}"
        value="${brVal}" placeholder="${brAuto}" title="Auto: ${brAuto}. Edite para sobrescrever."
        data-mes="${m}" data-field="brancos" onchange="${onchg}">
      </td>
      <td><input type="number" min="0" step="1" style="${ov.atendidos != null ? inpStyleOv : inpStyle}"
        value="${atVal}" placeholder="${atAuto}" title="Auto: ${atAuto}. Edite para sobrescrever."
        data-mes="${m}" data-field="atendidos" onchange="${onchg}">
      </td>
      <td style="text-align:center">${hasOv ? `<button type="button" onclick="delete state.recepOverride['${m}'];saveRecepcionados();renderRecepTable();if(state.triRaw.length)renderEvasao(state.triFilt);else if(state.raw.length)renderEvasao(state.filt);" style="background:none;border:none;cursor:pointer;color:var(--mut);font-size:13px;padding:2px 5px;border-radius:4px" title="Restaurar valores automáticos">↺</button>` : '<span style="color:var(--bdr2)">—</span>'}</td>
    </tr>`;
  }).join('');
}

export function renderEvasao(triFilt) {
  const sec = $('evasaoSection'); if (!sec) return;
  const mesesSet = new Set(triFilt.map(r => r.anoMes));
  const meses = [...mesesSet].sort();
  const mData = meses.map(m => {
    const triadosAuto = triFilt.filter(r => r.anoMes === m).length;
    const brancosAuto = triFilt.filter(r => r.anoMes === m && r.cor === 'BRANCO').length;
    const atendidosAuto = state.filt.filter(r => r.anoMes === m).length;
    const ov = state.recepOverride[m] || {};
    const triados = ov.triados != null ? ov.triados : triadosAuto;
    const brancos = ov.brancos != null ? ov.brancos : brancosAuto;
    const atendidos = ov.atendidos != null ? ov.atendidos : atendidosAuto;
    const recep = state.recepcionados[m] || null;
    const evasoes = recep != null ? recep - brancos - atendidos : null;
    const taxa = recep && recep > 0 ? evasoes / recep * 100 : null;
    return { m, label: monthLabel(m), triados, brancos, atendidos, triadosAuto, brancosAuto, atendidosAuto, recep, evasoes, taxa };
  });
  const temRecep = mData.some(r => r.recep != null);
  sec.style.display = '';
  const totTriados = mData.reduce((s, r) => s + r.triados, 0);
  const totBrancos = mData.reduce((s, r) => s + r.brancos, 0);
  const totAtendidos = mData.reduce((s, r) => s + r.atendidos, 0);
  const totRecep = temRecep ? mData.reduce((s, r) => s + (r.recep || 0), 0) : null;
  const totEvasoes = totRecep != null ? totRecep - totBrancos - totAtendidos : null;
  const totTaxa = totRecep && totRecep > 0 ? totEvasoes / totRecep * 100 : null;
  const noRecepMsg = '— inserir recepcionados';
  const evasaoWarn = totRecep == null ? 'kpi-warn' : '';
  renderKpiTiers('kpisEvasao', [
    kpiPrimary('Taxa de evasão', totTaxa != null ? (totTaxa < 0 ? '<0%' : fmtN(totTaxa, 1) + '%') : noRecepMsg, '(Recep - Brancos - Atend.) / Recep', '#e8a93b', '', null),
    kpiPrimary('Evasoes', totEvasoes != null ? (totEvasoes < 0 ? '<0 (revisar)' : fmt(totEvasoes)) : noRecepMsg, 'saíram sem atendimento (excl. brancos)', '#c8493e', '', null),
  ], [
    kpiSecondary('Triados', fmt(totTriados), 'passaram pela triagem', '#1357a6'),
    kpiSecondary('Brancos', fmt(totBrancos), 'redirecionados — excluidos do calculo', '#94a3b8'),
    kpiSecondary('Atendidos', fmt(totAtendidos), 'atendimento medico registrado', '#38ac8b'),
    kpiSecondary('Recepcionados', totRecep != null ? fmt(totRecep) : noRecepMsg, 'total registrado na recepcao', '#7b61c4', evasaoWarn),
  ]);
  const comTaxa = mData.filter(r => r.taxa != null);
  if (comTaxa.length >= 1) {
    const mesesAll = [...new Set(state.triRaw.map(r => r.anoMes))].filter(Boolean).sort();
    const trendData = mesesAll.map(m => {
      const recep = state.recepcionados[m] || null;
      if (!recep) return { m, label: monthLabel(m), taxa: null };
      const ov = state.recepOverride[m] || {};
      const brancosAuto = state.triRaw.filter(r => r.anoMes === m && r.cor === 'BRANCO').length;
      const atendAuto = state.raw.filter(r => r.anoMes === m).length;
      const brancos = ov.brancos != null ? ov.brancos : brancosAuto;
      const atend = ov.atendidos != null ? ov.atendidos : atendAuto;
      const ev = recep - brancos - atend;
      const taxa = recep > 0 ? +(ev / recep * 100).toFixed(1) : null;
      return { m, label: monthLabel(m), taxa };
    });
    const trendWithData = trendData.filter(x => x.taxa != null);
    const metaEv = meta('metaEvasao') || 10;
    if (trendWithData.length >= 2) {
      chart('chartEvasaoTrend', { type: 'line', data: { labels: trendData.map(x => x.label), datasets: [{ label: 'Taxa de evasão (%)', data: trendData.map(x => x.taxa), borderColor: '#c8493e', backgroundColor: 'rgba(200,73,62,.08)', fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: '#c8493e', spanGaps: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, targetLine: { lines: [{ value: metaEv, label: `META ${fmtN(metaEv,1)}%` }] } }, scales: { x: { grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => v + '%' }, suggestedMin: 0, suggestedMax: Math.max(metaEv * 1.5, ...trendData.map(x => x.taxa || 0), 15) } } } });
    }
    chart('chartEvasaoRecep', { type: 'line', data: { labels: mData.map(r => r.label), datasets: [{ label: 'Taxa de Evasao (%)', data: mData.map(r => r.taxa), borderColor: '#c8493e', backgroundColor: 'rgba(200,73,62,.12)', fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: '#c8493e', yAxisID: 'y' }, { label: 'Evasoes', data: mData.map(r => r.evasoes), borderColor: '#e8a93b', backgroundColor: 'transparent', tension: .35, pointRadius: 3, pointBackgroundColor: '#e8a93b', borderDash: [5, 4], yAxisID: 'y1' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true, padding: 16 } }, targetLine: { lines: [{ value: metaEv, label: `META ${fmtN(metaEv, 1)}%` }] }, tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y' ? `Evasão: ${c.parsed.y != null ? fmtN(c.parsed.y, 1) + '%' : '-'}` : c.dataset.yAxisID === 'y1' ? `Evasoes: ${c.parsed.y != null ? fmt(c.parsed.y) : '-'}` : '' } } }, scales: { x: { grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { position: 'left', grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => v + '%' }, beginAtZero: true }, y1: { position: 'right', grid: { display: false }, ticks: { color: '#e8a93b', callback: v => Math.round(v) }, beginAtZero: true } } } });
  }
  $('tableEvasao').innerHTML = `<thead><tr><th>Mes</th><th>Recepcionados</th><th>Triados</th><th>Brancos</th><th>Atendidos</th><th>Evasoes</th><th>Taxa</th></tr></thead><tbody>${mData.map(r => {
    const taxaStr = r.taxa != null ? (r.taxa < 0 ? '<span class="erc">&lt;0% (revisar)</span>' : `<span class="${r.taxa > 5 ? 'erc' : r.taxa > 2 ? 'wnc' : 'okc'}">${fmtN(r.taxa, 1)}%</span>`) : '-';
    const evStr = r.evasoes != null ? (r.evasoes < 0 ? '<span class="erc">revisar</span>' : fmt(r.evasoes)) : '-';
    return `<tr><td class="mono">${esc(r.label)}</td><td class="mono">${r.recep != null ? fmt(r.recep) : '<span style="color:var(--mut)">—</span>'}</td><td class="mono">${fmt(r.triados)}</td><td class="mono">${fmt(r.brancos)}</td><td class="mono">${fmt(r.atendidos)}</td><td class="mono">${evStr}</td><td class="mono">${taxaStr}</td></tr>`;
  }).join('')}</tbody>`;
}
