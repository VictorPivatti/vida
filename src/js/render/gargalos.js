// render/gargalos.js — Gargalos pane rendering
import { state } from '../state.js';
import { $, fmt, fmtN, pct, kpi } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { monthLabel } from '../utils/dates.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { DOW, DOWO } from '../constants.js';

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }

const SVG_CRIT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
const SVG_WARN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
const SVG_CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';

function hourBuckets(rows) {
  const map = {};
  rows.forEach(r => {
    const k = r.diaSem + '-' + r.hora;
    map[k] = map[k] || { diaSem: r.diaSem, hora: r.hora, rows: [], tri: [], med: [], tot: [], grave: 0 };
    const x = map[k]; x.rows.push(r);
    if (r.tEspTri != null) x.tri.push(r.tEspTri);
    if (r.tEspMed != null) x.med.push(r.tEspMed);
    if (r.tTotal != null) x.tot.push(r.tTotal);
    if (['AMARELO', 'LARANJA', 'VERMELHO'].includes(r.cor)) x.grave++;
  });
  return Object.values(map).map(x => ({ ...x, n: x.rows.length, triAvg: avg(x.tri, v => v), medAvg: avg(x.med, v => v), totAvg: avg(x.tot, v => v), gravePct: x.rows.length ? x.grave / x.rows.length * 100 : 0, carga: (x.rows.length * (avg(x.tot, v => v) || 0)) / 60 }));
}

function renderGargalosHeatmap(buckets) {
  const el = $('heatmapGargalos');
  if (!el) return;
  const metric = document.getElementById('gargHeatmapMetric')?.value || 'vol';
  const map = {};
  buckets.forEach(b => { map[b.diaSem + '-' + b.hora] = b; });
  const vals = DOWO.flatMap(dow => Array.from({ length: 24 }, (_, h) => {
    const b = map[dow + '-' + h];
    if (!b) return 0;
    return metric === 'wait' ? (b.medAvg ?? b.triAvg ?? 0) : b.n;
  }));
  const max = Math.max(...vals, 1);
  let html = `<div class="hm-corner"></div>${Array.from({ length: 24 }, (_, h) => `<div class="hm-head">${h}</div>`).join('')}`;
  DOWO.forEach(dow => {
    html += `<div class="hm-row">${DOW[dow]}</div>`;
    for (let h = 0; h < 24; h++) {
      const b = map[dow + '-' + h];
      const n = b?.n || 0;
      const wait = b?.medAvg ?? b?.triAvg;
      const v = metric === 'wait' ? (wait ?? 0) : n;
      const a = v / max;
      const bg = v
        ? (metric === 'wait'
          ? `rgba(200,73,62,${.12 + a * .78})`
          : `rgba(68,128,194,${.12 + a * .78})`)
        : 'var(--sur2)';
      const tip = metric === 'wait'
        ? `${DOW[dow]} ${h}h: ${wait != null ? Math.round(wait) + ' min espera méd.' : 'sem dado'} · ${fmt(n)} atend.`
        : `${DOW[dow]} ${h}h: ${fmt(n)} atend.${wait != null ? ' · espera méd. ' + Math.round(wait) + ' min' : ''}`;
      html += `<div class="hm-cell" data-tip="${tip}" style="background:${bg}"></div>`;
    }
  });
  el.innerHTML = html;
}

export function renderGargalos() {
  const buckets = hourBuckets(state.filt);
  const topVol = [...buckets].sort((a, b) => b.n - a.n)[0];
  const topCarga = [...buckets].sort((a, b) => b.carga - a.carga)[0];
  const label = x => x ? `${DOW[x.diaSem]} ${x.hora}h` : '-';
  const medPicos = state.filt.filter(r => r.tEspMed != null);
  const triPicos = state.filt.filter(r => r.tEspTri != null);
  const medPicoMax = medPicos.length ? medPicos.reduce((m, r) => r.tEspMed > m.tEspMed ? r : m) : null;
  const triPicoMax = triPicos.length ? triPicos.reduce((m, r) => r.tEspTri > m.tEspTri ? r : m) : null;
  const picoLabel = r => r && r.dh ? r.dh.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + String(r.dh.getHours()).padStart(2, '0') + 'h' : '-';
  $('kpisGargalos').innerHTML = [
    kpi('Maior espera médica', medPicoMax ? Math.round(medPicoMax.tEspMed) + ' min' : '-', picoLabel(medPicoMax), '#e8a93b'),
    kpi('Maior espera triagem', triPicoMax ? Math.round(triPicoMax.tEspTri) + ' min' : '-', picoLabel(triPicoMax), '#1357a6'),
    kpi('Maior volume horario', topVol ? fmt(topVol.n) : '-', label(topVol), '#38ac8b'),
    kpi('Maior carga estimada', topCarga ? fmtN(topCarga.carga, 1) : '-', `${label(topCarga)} - atend × permanência`, '#c8493e')
  ].join('');

  const vAll = state.filt.filter(r => r.cor === 'VERMELHO');
  const vTard = vAll.filter(r => r.tEspMed != null && r.tEspMed > 10);
  const vSemDado = vAll.filter(r => r.tEspMed == null).length;
  const vTotal = vAll.length, vN = vTard.length;
  const vPct = vTotal ? +(vN / vTotal * 100).toFixed(1) : null;
  const vAvg = vN ? Math.round(avg(vTard, r => r.tEspMed)) : null;
  const vMax = vN ? vTard.reduce((m, r) => r.tEspMed > m ? r.tEspMed : m, 0) : null;
  const vMeses = {};
  vTard.forEach(r => { const k = r.dh && !isNaN(r.dh) ? r.dh.toISOString().slice(0, 7) : 'sem-data'; vMeses[k] = (vMeses[k] || 0) + 1; });
  const vMesesKeys = Object.keys(vMeses).sort();
  const alertDiv = $('alertaVermelho');
  if (alertDiv) {
    if (vTotal === 0) {
      alertDiv.innerHTML = '';
    } else {
      const isCrit = vPct != null && vPct >= 20;
      const isWarn = vPct != null && vPct > 0 && vPct < 20;
      const bgColor = isCrit ? 'rgba(200,73,62,0.12)' : isWarn ? 'rgba(232,169,59,0.10)' : 'rgba(47,158,126,0.12)';
      const borderColor = isCrit ? '#c8493e' : isWarn ? '#e8a93b' : '#38ac8b';
      const icon = isCrit ? SVG_CRIT : isWarn ? SVG_WARN : SVG_CHECK;
      const title = isCrit ? 'Alerta crítico: VERMELHO aguardando além do protocolo' : isWarn ? 'Atenção: VERMELHO com espera superior a 10 min detectado' : 'Protocolo VERMELHO cumprido no período';
      const semDadoNote = vSemDado > 0 ? `<span class="risco-alert-note" style="margin-left:12px">${fmt(vSemDado)} VERMELHO sem dado de espera registrado</span>` : '';
      alertDiv.innerHTML = `
        <div class="risco-alert" style="border-color:${borderColor};background:${bgColor}">
          <div class="risco-alert-hd">
            <span style="color:${borderColor};display:flex;align-items:center;flex:none">${icon}</span>
            <strong style="font-size:13px;color:${borderColor}">${title}</strong>
            ${semDadoNote}
          </div>
          <div class="risco-kpis" style="margin-bottom:${vN > 0 ? '10' : '0'}px">
            <div class="risco-kpi"><div class="risco-kpi-label">Total VERMELHO</div><div class="risco-kpi-value" style="color:${borderColor}">${fmt(vTotal)}</div></div>
            ${vN > 0 ? `
            <div class="risco-kpi"><div class="risco-kpi-label">Fora do protocolo</div><div class="risco-kpi-value" style="color:${borderColor}">${fmt(vN)} <span style="font-size:14px">(${fmtN(vPct, 1)}%)</span></div></div>
            <div class="risco-kpi"><div class="risco-kpi-label">Espera média</div><div class="risco-kpi-value">${vAvg} min</div></div>
            <div class="risco-kpi"><div class="risco-kpi-label">Espera máxima</div><div class="risco-kpi-value">${Math.round(vMax)} min</div></div>
            ` : ''}
          </div>
          ${vN > 0 ? '<div class="risco-alert-note">Protocolo Manchester: pacientes VERMELHO devem ser atendidos em até 10 min.</div>' : ''}
        </div>`;
    }
  }

  if (vMesesKeys.length > 0) {
    chart('chartVermelhoMes', { type: 'bar', data: { labels: vMesesKeys.map(k => k === 'sem-data' ? 'Sem data' : monthLabel(+k.replace('-', ''))), datasets: [{ label: 'VERMELHO >10 min', data: vMesesKeys.map(k => vMeses[k]), backgroundColor: '#c8493e', borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${fmt(c.parsed.y)} casos fora do protocolo` } } }, scales: { ...axes(), y: { grid: { color: gridColor() }, ticks: { color: tickColor() }, beginAtZero: true } } } });
  } else {
    const cv = document.getElementById('chartVermelhoMes');
    if (cv) { const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); }
  }

  const rank = [...buckets].sort((a, b) => (b.medAvg || 0) + (b.triAvg || 0) + b.carga / 2 - ((a.medAvg || 0) + (a.triAvg || 0) + a.carga / 2)).slice(0, 30);
  $('tableGargalos').innerHTML = `<thead><tr><th>Dia/hora</th><th>Volume</th><th>Espera triagem</th><th>Espera médico</th><th>Total médio</th><th>Amarelo+</th><th>Carga</th></tr></thead><tbody>${rank.map(x => `<tr><td class="mono">${DOW[x.diaSem]} ${x.hora}h</td><td class="mono">${fmt(x.n)}</td><td class="mono">${x.triAvg == null ? '-' : Math.round(x.triAvg) + ' min'}</td><td class="mono ${x.medAvg > meta('metaMed') ? 'erc' : ''}">${x.medAvg == null ? '-' : Math.round(x.medAvg) + ' min'}</td><td class="mono">${x.totAvg == null ? '-' : Math.round(x.totAvg) + ' min'}</td><td class="mono">${fmtN(x.gravePct, 1)}%</td><td class="mono">${fmtN(x.carga, 1)}</td></tr>`).join('')}</tbody>`;
  const medTop = [...buckets].filter(x => x.medAvg != null).sort((a, b) => b.medAvg - a.medAvg).slice(0, 10).reverse();
  chart('chartGargMed', { type: 'bar', data: { labels: medTop.map(label), datasets: [{ data: medTop.map(x => Math.round(x.medAvg)), backgroundColor: medTop.map(x => x.medAvg > meta('metaMed') ? '#c8493e' : '#38ac8b'), borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, targetLine: { lines: [{ value: meta('metaMed'), label: 'META' }] } }, scales: axes() } });
  const cargaTop = [...buckets].sort((a, b) => b.carga - a.carga).slice(0, 10).reverse();
  chart('chartCarga', { type: 'bar', data: { labels: cargaTop.map(label), datasets: [{ data: cargaTop.map(x => +x.carga.toFixed(1)), backgroundColor: '#7b61c4', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  renderGargalosHeatmap(buckets);
}
