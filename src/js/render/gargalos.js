// render/gargalos.js — Gargalos pane rendering
import { state } from '../state.js';
import { $, fmt, fmtN, pct, kpi } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { monthLabel } from '../utils/dates.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { DOW } from '../constants.js';

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }

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
      const icon = isCrit ? '🚨' : isWarn ? '⚠️' : '✅';
      const title = isCrit ? 'Alerta crítico: VERMELHO aguardando além do protocolo' : isWarn ? 'Atenção: VERMELHO com espera superior a 10 min detectado' : 'Protocolo VERMELHO cumprido no período';
      const semDadoNote = vSemDado > 0 ? `<span class="risco-alert-note" style="margin-left:12px">${fmt(vSemDado)} VERMELHO sem dado de espera registrado</span>` : '';
      alertDiv.innerHTML = `
        <div class="risco-alert" style="border-color:${borderColor};background:${bgColor}">
          <div class="risco-alert-hd">
            <span style="font-size:20px">${icon}</span>
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
  chart('chartGargMed', { type: 'bar', data: { labels: medTop.map(label), datasets: [{ data: medTop.map(x => Math.round(x.medAvg)), backgroundColor: medTop.map(x => x.medAvg > meta('metaMed') ? '#c8493e' : '#38ac8b'), borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, targetLine: { lines: [{ value: meta('metaMed'), label: 'meta', color: '#9aa6b6' }] } }, scales: axes() } });
  const cargaTop = [...buckets].sort((a, b) => b.carga - a.carga).slice(0, 10).reverse();
  chart('chartCarga', { type: 'bar', data: { labels: cargaTop.map(label), datasets: [{ data: cargaTop.map(x => +x.carga.toFixed(1)), backgroundColor: '#7b61c4', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
}
