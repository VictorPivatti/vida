// render/medicos.js — Medicos pane rendering
import { state } from '../state.js';
import { $, esc, fmt, fmtN, pct, norm, shortName, kpi } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { RISK_ORDER, RISK_COLOR } from '../constants.js';
import { medRows } from '../metrics/med.js';

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }

export function renderMedicos() {
  const rows = medRows(), total = state.filt.length;
  const topPts = rows.slice().sort((a, b) => (b.pontos ?? 0) - (a.pontos ?? 0))[0];
  const topVol = rows.slice().sort((a, b) => b.total - a.total)[0];
  $('kpisMed').innerHTML = [
    kpi('Médicos ativos', fmt(rows.length), 'no período', '#1357a6'),
    kpi('Maior pontuação', topPts ? esc(shortName(topPts.prof)) : '-', topPts ? `${fmt(topPts.pontos)} pts · ${fmt(topPts.total)} atend.` : 'sem dados', '#38ac8b'),
    kpi('Maior volume', topVol ? esc(shortName(topVol.prof)) : '-', topVol ? `${fmt(topVol.total)} atendimentos` : 'sem dados', '#e8a93b'),
    kpi('Atend. por médico', rows.length ? fmt(Math.round(total / rows.length)) : '-', 'média no período', '#7b61c4')
  ].join('');
  const top = rows.slice(0, 12).reverse();
  chart('chartMed', { type: 'bar', data: { labels: top.map(r => shortName(r.prof)), datasets: [{ data: top.map(r => r.total), backgroundColor: '#1357a6', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  const riskKeys = RISK_ORDER.filter(k => rows.some(r => r.risks[k]));
  chart('chartMedRisco', { type: 'bar', data: { labels: rows.slice(0, 12).map(r => shortName(r.prof)), datasets: riskKeys.map(k => ({ label: k, data: rows.slice(0, 12).map(r => r.risks[k] || 0), backgroundColor: RISK_COLOR[k] || '#64748b' })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } } }, scales: { x: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor(), maxRotation: 35 } }, y: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } } } } });
  renderMedTable(rows);

  const plantaoMap = {};
  state.filt.forEach(r => {
    const k = r.dateKey + '_' + r.turno;
    plantaoMap[k] = plantaoMap[k] || { dateKey: r.dateKey, turno: r.turno, meds: new Set(), n: 0, tri: [], med: [] };
    plantaoMap[k].n++;
    if (r.prof) plantaoMap[k].meds.add(norm(r.prof));
    if (r.tEspTri != null) plantaoMap[k].tri.push(r.tEspTri);
    if (r.tEspMed != null) plantaoMap[k].med.push(r.tEspMed);
  });
  const plantoes = Object.values(plantaoMap).map(p => ({
    ...p, medAtivos: p.meds.size,
    porMedico: p.meds.size ? +(p.n / p.meds.size).toFixed(1) : p.n,
    medAvgEsp: avg(p.med, x => x)
  })).sort((a, b) => b.n - a.n);
  const plantD = plantoes.filter(p => p.turno === 'D'), plantN = plantoes.filter(p => p.turno === 'N');
  const mediaD = avg(plantD, p => p.n), mediaN = avg(plantN, p => p.n);
  const mediaDpM = avg(plantD.filter(p => p.medAtivos > 0), p => p.porMedico);
  const mediaNpM = avg(plantN.filter(p => p.medAtivos > 0), p => p.porMedico);
  const allDates = [...new Set([...plantD, ...plantN].map(p => p.dateKey))].sort();
  const dByDate = Object.fromEntries(plantD.map(p => [p.dateKey, p.n]));
  const nByDate = Object.fromEntries(plantN.map(p => [p.dateKey, p.n]));
  chart('chartPlantaoBox', { type: 'bar', data: { labels: allDates.map(dk => { const d = new Date(dk + 'T12:00:00'); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }), datasets: [{ label: 'Diurno', data: allDates.map(dk => dByDate[dk] || 0), backgroundColor: 'rgba(68,128,194,.7)', borderRadius: 2 }, { label: 'Noturno', data: allDates.map(dk => nByDate[dk] || 0), backgroundColor: 'rgba(68,128,194,.75)', borderRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y} atend.` } } }, scales: { x: { grid: { color: gridColor() }, ticks: { color: tickColor(), maxRotation: 60, font: { size: 8 } } }, y: { grid: { color: gridColor() }, ticks: { color: tickColor() }, title: { display: true, text: 'atendimentos/plantão', color: tickColor(), font: { size: 9 } }, beginAtZero: true } } } });

  const tablePlantao = $('tablePlantao');
  if (tablePlantao) {
    tablePlantao.innerHTML = `<thead><tr><th>Turno</th><th>Plantões</th><th>Média atend./plantão</th><th>Máx. atend.</th><th>Mín. atend.</th><th>Média atend./médico</th><th>Média espera méd.</th></tr></thead><tbody>
    <tr>
      <td style="font-weight:700">Diurno (7h–19h)</td>
      <td class="mono">${fmt(plantD.length)}</td>
      <td class="mono ${mediaD > avg(plantoes, p => p.n) * 1.2 ? 'wnc' : ''}">${mediaD != null ? mediaD.toFixed(1) : '-'}</td>
      <td class="mono">${fmt(Math.max(...plantD.map(p => p.n), 0))}</td>
      <td class="mono">${fmt(Math.min(...plantD.map(p => p.n), Infinity) === Infinity ? 0 : Math.min(...plantD.map(p => p.n)))}</td>
      <td class="mono">${mediaDpM != null ? mediaDpM.toFixed(1) : '-'}</td>
      <td class="mono">${avg(plantD, p => p.medAvgEsp) != null ? Math.round(avg(plantD, p => p.medAvgEsp)) + ' min' : '-'}</td>
    </tr>
    <tr>
      <td style="font-weight:700">Noturno (19h–7h)</td>
      <td class="mono">${fmt(plantN.length)}</td>
      <td class="mono">${mediaN != null ? mediaN.toFixed(1) : '-'}</td>
      <td class="mono">${fmt(Math.max(...plantN.map(p => p.n), 0))}</td>
      <td class="mono">${fmt(Math.min(...plantN.map(p => p.n), Infinity) === Infinity ? 0 : Math.min(...plantN.map(p => p.n)))}</td>
      <td class="mono">${mediaNpM != null ? mediaNpM.toFixed(1) : '-'}</td>
      <td class="mono">${avg(plantN, p => p.medAvgEsp) != null ? Math.round(avg(plantN, p => p.medAvgEsp)) + ' min' : '-'}</td>
    </tr>
    <tr style="border-top:2px solid var(--bdr);font-weight:700">
      <td>TOTAL</td>
      <td class="mono">${fmt(plantoes.length)}</td>
      <td class="mono">${avg(plantoes, p => p.n) != null ? avg(plantoes, p => p.n).toFixed(1) : '-'}</td>
      <td class="mono">${fmt(Math.max(...plantoes.map(p => p.n), 0))}</td>
      <td class="mono">${fmt(Math.min(...plantoes.map(p => p.n), Infinity) === Infinity ? 0 : Math.min(...plantoes.map(p => p.n)))}</td>
      <td class="mono">${avg(plantoes.filter(p => p.medAtivos > 0), p => p.porMedico) != null ? avg(plantoes.filter(p => p.medAtivos > 0), p => p.porMedico).toFixed(1) : '-'}</td>
      <td class="mono">—</td>
    </tr></tbody>`;
  }
}

function renderMedTable(rows) {
  const q = norm($('searchMed')?.value || '');
  const data = q ? rows.filter(r => norm(r.prof).includes(q)).slice() : rows.slice();
  const pp = (n, tot) => `<span style="font-weight:600">${fmt(n)}</span><br><span style="font-size:10px;opacity:.75">${tot > 0 ? (n / tot * 100).toFixed(1) + '%' : '--'}</span>`;
  $('tableMed').innerHTML = `<thead><tr>
    <th>#</th><th>Médico</th><th>Total</th>
    <th title="Pacientes ≤ 2 anos">≤2</th><th title="Pacientes ≤ 12 anos">≤12</th>
    <th title="Pacientes ≥ 60 anos">≥60</th><th title="Pacientes ≥ 80 anos">≥80</th>
    <th title="Fichas amarelas">Amarelo</th><th title="Fichas laranja+vermelho">L/V</th>
    <th title="Plantões diurnos válidos">Plt. D</th><th title="Plantões noturnos válidos">Plt. N</th>
    <th title="Média atend./plantão diurno">Média D.</th><th title="Média atend./plantão noturno">Média N.</th>
    <th title="Média geral por plantão">At./Plt</th>
    <th title="Espera média para atendimento médico">Esp. méd. (min)</th>
  </tr></thead><tbody>${data.map((r, i) => {
    const amCount = r.risks['AMARELO'] || 0;
    const lvCount = (r.risks['LARANJA'] || 0) + (r.risks['VERMELHO'] || 0);
    const tot = r.total || 1;
    const amPct = amCount / tot * 100, lvPct = lvCount / tot * 100;
    const mpColor = r.mediaPlantao != null && r.mediaPlantao >= 30 ? 'okc' : r.mediaPlantao != null && r.mediaPlantao >= 20 ? 'wnc' : '';
    const medColor = r.medAvg != null && r.medAvg > meta('metaMed') ? 'erc' : r.medAvg != null && r.medAvg > meta('metaMed') * 0.8 ? 'wnc' : '';
    return `<tr>
      <td class="mono muted">${i + 1}</td>
      <td style="font-weight:600">${esc(shortName(r.prof))}</td>
      <td class="mono">${fmt(r.total)}</td>
      <td class="mono muted" style="line-height:1.3">${pp(r.le2 ?? 0, tot)}</td>
      <td class="mono muted" style="line-height:1.3">${pp(r.le12 ?? 0, tot)}</td>
      <td class="mono muted" style="line-height:1.3">${pp(r.ge60 ?? 0, tot)}</td>
      <td class="mono muted" style="line-height:1.3">${pp(r.ge80 ?? 0, tot)}</td>
      <td class="mono ${amPct > 20 ? 'erc' : amPct > 10 ? 'wnc' : 'muted'}" style="line-height:1.3">${pp(amCount, tot)}</td>
      <td class="mono ${lvPct > 5 ? 'erc' : lvPct > 2 ? 'wnc' : 'muted'}" style="line-height:1.3">${pp(lvCount, tot)}</td>
      <td class="mono">${r.plantD > 0 ? r.plantD : '-'}</td>
      <td class="mono">${r.plantN > 0 ? r.plantN : '-'}</td>
      <td class="mono ${mpColor}">${r.mediaD != null ? r.mediaD : '-'}</td>
      <td class="mono">${r.mediaN != null ? r.mediaN : '-'}</td>
      <td class="mono ${mpColor}">${r.mediaPlantao != null ? r.mediaPlantao : '-'}</td>
      <td class="mono ${medColor}">${r.medAvg == null ? '-' : Math.round(r.medAvg)}</td>
    </tr>`;
  }).join('')}</tbody>`;
}
