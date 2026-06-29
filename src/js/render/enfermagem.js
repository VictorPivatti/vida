// render/enfermagem.js — Enfermagem pane rendering
import { state } from '../state.js';
import { $, esc, fmt, shortName, kpi } from '../utils/dom.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { catOfEsp, procTipoKey, procTipoLabel } from '../parsers/proc.js';

function sum(arr, fn) { return arr.reduce((s, r) => s + (fn(r) || 0), 0); }

export function renderEnfermagem() {
  const enfEmpty = $('enfEmpty'), enfContent = $('enfContent');
  const hasProc = state.procRaw.length > 0;
  if (!hasProc) {
    if (enfEmpty) enfEmpty.classList.remove('hidden');
    if (enfContent) enfContent.classList.add('hidden');
    return;
  }
  if (enfEmpty) enfEmpty.classList.add('hidden');
  if (enfContent) enfContent.classList.remove('hidden');

  const procBase = state.procFilt.length ? state.procFilt : state.procRaw;
  const enfRows = procBase.filter(r => catOfEsp(r.esp) === 'enf');
  const tecRows = procBase.filter(r => catOfEsp(r.esp) === 'tec');

  const enfProfs = new Set(enfRows.map(r => r.prof)).size;
  const tecProfs = new Set(tecRows.map(r => r.prof)).size;
  const enfTotal = enfRows.reduce((s, r) => s + r.qde, 0);
  const tecTotal = tecRows.reduce((s, r) => s + r.qde, 0);
  const triagensEnf = enfRows.filter(r => procTipoLabel(r.proc) === 'Triagem').reduce((s, r) => s + r.qde, 0);
  $('kpisEnf').innerHTML = [
    kpi('Enfermeiros ativos', fmt(enfProfs), 'no período', '#7b61c4'),
    kpi('Técnicos ativos', fmt(tecProfs), 'no período', '#1357a6'),
    kpi('Triagens realizadas', fmt(triagensEnf), 'por enfermeiros', '#38ac8b'),
    kpi('Proc. técnicos', fmt(tecTotal), 'administrações e cuidados', '#e8a93b'),
  ].join('');

  const enfByProf = {};
  enfRows.forEach(r => {
    enfByProf[r.prof] = enfByProf[r.prof] || { prof: r.prof, total: 0, tipos: {} };
    enfByProf[r.prof].total += r.qde;
    const t = procTipoLabel(r.proc);
    enfByProf[r.prof].tipos[t] = (enfByProf[r.prof].tipos[t] || 0) + r.qde;
  });
  const enfList = Object.values(enfByProf).sort((a, b) => b.total - a.total);
  const top8enf = enfList.slice(0, 8).reverse();
  chart('chartEnfTriagem', { type: 'bar', data: { labels: top8enf.map(r => shortName(r.prof)), datasets: [{ label: 'Triagens', data: top8enf.map(r => r.tipos['Triagem'] || 0), backgroundColor: '#7b61c4', borderRadius: 3 }, { label: 'Outros proc.', data: top8enf.map(r => r.total - (r.tipos['Triagem'] || 0)), backgroundColor: '#0f4789', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } } }, scales: { x: { stacked: true, ...axes().x }, y: { stacked: true, ...axes().y } } } });

  const tiposEnf = {};
  enfRows.forEach(r => { const t = procTipoLabel(r.proc); tiposEnf[t] = (tiposEnf[t] || 0) + r.qde; });
  const tiposEnfArr = Object.entries(tiposEnf).sort((a, b) => b[1] - a[1]);
  chart('chartEnfProcPerfil', { type: 'doughnut', data: { labels: tiposEnfArr.map(x => x[0]), datasets: [{ data: tiposEnfArr.map(x => x[1]), backgroundColor: ['#7b61c4', '#1357a6', '#0f4789', '#4480c2', '#38ac8b', '#e8a93b', '#c8493e', '#4aa3c9'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: tickColor(), usePointStyle: true, font: { size: 10 } } } } } });

  $('tableEnfRanking').innerHTML = `<thead><tr><th>#</th><th>Enfermeiro</th><th>Total proc.</th><th>Triagens</th><th>EV</th><th>IM</th><th>VO</th><th>Outros</th></tr></thead><tbody>${enfList.map((r, i) => `<tr>
    <td class="mono muted">${i + 1}</td>
    <td style="font-weight:600">${esc(shortName(r.prof))}</td>
    <td class="mono">${fmt(r.total)}</td>
    <td class="mono ${r.tipos['Triagem'] > 0 ? 'okc' : ''}">${fmt(r.tipos['Triagem'] || 0)}</td>
    <td class="mono">${fmt(r.tipos['EV'] || 0)}</td>
    <td class="mono">${fmt(r.tipos['IM'] || 0)}</td>
    <td class="mono">${fmt(r.tipos['VO'] || 0)}</td>
    <td class="mono muted">${fmt(r.total - (r.tipos['Triagem'] || 0) - (r.tipos['EV'] || 0) - (r.tipos['IM'] || 0) - (r.tipos['VO'] || 0))}</td>
  </tr>`).join('')}</tbody>`;

  const tecByProf = {};
  tecRows.forEach(r => {
    tecByProf[r.prof] = tecByProf[r.prof] || { prof: r.prof, total: 0, tipos: {} };
    tecByProf[r.prof].total += r.qde;
    const t = procTipoLabel(r.proc);
    tecByProf[r.prof].tipos[t] = (tecByProf[r.prof].tipos[t] || 0) + r.qde;
  });
  const tecList = Object.values(tecByProf).sort((a, b) => b.total - a.total);
  const top8tec = tecList.slice(0, 8).reverse();
  chart('chartTecProd', { type: 'bar', data: { labels: top8tec.map(r => shortName(r.prof)), datasets: [{ data: top8tec.map(r => r.total), backgroundColor: '#1357a6', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });

  const viasLabels = ['EV', 'IM', 'VO', 'SC', 'Neb', 'Curativo', 'Sondagem', 'Outros'];
  const viasCores = ['#4480c2', '#e8a93b', '#38ac8b', '#7b61c4', '#4aa3c9', '#e8a93b', '#ec4899', '#64748b'];
  const viasData = viasLabels.map(v => tecRows.filter(r => procTipoLabel(r.proc) === v).reduce((s, r) => s + r.qde, 0));
  chart('chartTecVias', { type: 'doughnut', data: { labels: viasLabels, datasets: [{ data: viasData, backgroundColor: viasCores, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: tickColor(), usePointStyle: true, font: { size: 10 } } } } } });

  $('tableTecRanking').innerHTML = `<thead><tr><th>#</th><th>Técnico</th><th>Total</th><th>EV</th><th>IM</th><th>VO</th><th>SC</th><th>Neb</th><th>Outros</th></tr></thead><tbody>${tecList.map((r, i) => `<tr>
    <td class="mono muted">${i + 1}</td>
    <td style="font-weight:600">${esc(shortName(r.prof))}</td>
    <td class="mono">${fmt(r.total)}</td>
    <td class="mono">${fmt(r.tipos['EV'] || 0)}</td>
    <td class="mono">${fmt(r.tipos['IM'] || 0)}</td>
    <td class="mono">${fmt(r.tipos['VO'] || 0)}</td>
    <td class="mono">${fmt(r.tipos['SC'] || 0)}</td>
    <td class="mono">${fmt(r.tipos['Neb'] || 0)}</td>
    <td class="mono muted">${fmt(r.total - (r.tipos['EV'] || 0) - (r.tipos['IM'] || 0) - (r.tipos['VO'] || 0) - (r.tipos['SC'] || 0) - (r.tipos['Neb'] || 0))}</td>
  </tr>`).join('')}</tbody>`;
}
