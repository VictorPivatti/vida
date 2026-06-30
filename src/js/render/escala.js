// render/escala.js — Escala/Dimensionamento pane rendering
import { state } from '../state.js';
import { $, fmt, fmtN, norm, kpi } from '../utils/dom.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';

export function renderEscala() {
  const d = state.filt;
  if (!d.length) { $('kpisEscala').innerHTML = kpi('Dados', '—', 'carregue o histórico', '#94a3b8'); return; }
  const capMedico = Number($('capMed')?.value) || 3;
  const slotMap = {};
  d.forEach(r => {
    const k = r.dateKey + '-' + r.hora;
    slotMap[k] = slotMap[k] || { h: r.hora, n: 0, meds: new Set() };
    slotMap[k].n++;
    if (r.prof) slotMap[k].meds.add(norm(r.prof));
  });
  const byH = Array.from({ length: 24 }, (_, h) => {
    const slots = Object.values(slotMap).filter(s => s.h === h);
    if (!slots.length) return { h, n: 0, meds: new Set(), dias: new Set(), medAtivos: 0, volMedio: 0, capacidade: 0, deficit: 0, pressao: 0, nDias: 0, slots: 0 };
    const totalN = slots.reduce((s, sl) => s + sl.n, 0);
    const volMedio = totalN / slots.length;
    const medsPerSlot = slots.map(sl => sl.meds.size).sort((a, b) => a - b);
    const medAtivos = medsPerSlot[Math.floor(medsPerSlot.length / 2)] || 1;
    const capacidade = medAtivos * capMedico;
    const deficit = volMedio - capacidade;
    const pressao = capacidade > 0 ? volMedio / capacidade : 0;
    return { h, n: totalN, meds: new Set(), dias: new Set(), medAtivos, volMedio, capacidade, deficit, pressao, nDias: slots.length, slots: slots.length };
  });
  const horasDeficit = byH.filter(r => r.deficit > 0).length;
  const maxDeficit = Math.max(...byH.map(r => r.deficit));
  const topDef = byH.find(r => r.deficit === maxDeficit);
  const mediaMedicos = fmtN(byH.reduce((s, r) => s + r.medAtivos, 0) / 24, 1);
  $('kpisEscala').innerHTML = [
    kpi('Médicos distintos', fmt(new Set(d.filter(r => r.prof).map(r => r.prof)).size), 'ativos no período', '#1357a6'),
    kpi('Média médicos/hora', mediaMedicos, 'base histórica do período', '#38ac8b'),
    kpi('Horas em déficit', fmt(horasDeficit), 'de 24 slots diários', '#c8493e'),
    kpi('Pico de déficit', maxDeficit > 0 ? (fmtN(maxDeficit, 1) + ' atend/h') : '—', topDef ? `${topDef.h}h — requer reforço` : 'cobertura adequada', '#e8a93b'),
  ].join('');
  const labels = byH.map(r => r.h + 'h');
  chart('chartEscalaHora', { type: 'bar', data: { labels, datasets: [{ label: 'Volume médio/hora', data: byH.map(r => +r.volMedio.toFixed(1)), backgroundColor: 'rgba(68,128,194,.55)', borderRadius: 3 }, { label: 'Capacidade instalada', data: byH.map(r => +r.capacidade.toFixed(1)), backgroundColor: 'rgba(47,158,126,.42)', borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y}` } } }, scales: { ...axes() } } });
  $('tableEscala').innerHTML = `<thead><tr>
    <th>Hora</th><th>Vol. médio</th><th>Méd. ativos</th><th>Cap. instalada</th>
    <th>Déficit/Superávit</th><th>Pressão</th><th>Ação sugerida</th>
  </tr></thead><tbody>${byH.map(r => {
    const pct100 = fmtN(r.pressao * 100, 0) + '%';
    const defStr = r.deficit > 0.5
      ? `<span class="erc">▲ +${fmtN(r.deficit, 1)} atend/h descobertos</span>`
      : r.deficit < -0.5
        ? `<span class="okc">▼ ${fmtN(r.deficit, 1)} atend/h folga</span>`
        : `<span class="wnc">≈ equilibrado</span>`;
    const acao = r.deficit > 1 ? '⚠ Escalar médico adicional'
      : r.deficit > 0 ? '↑ Monitorar pressão'
        : r.pressao < 0.5 ? '↓ Pode redistribuir'
          : '✓ Cobertura adequada';
    const cls = r.deficit > 1 ? 'escala-err' : r.deficit > 0 ? 'escala-warn' : 'escala-ok';
    return `<tr>
      <td class="mono">${r.h}h</td>
      <td class="mono">${fmtN(r.volMedio, 1)}</td>
      <td class="mono">${r.medAtivos}</td>
      <td class="mono">${fmtN(r.capacidade, 1)}</td>
      <td class="mono">${defStr}</td>
      <td class="mono ${r.pressao > 1 ? 'erc' : r.pressao > 0.8 ? 'wnc' : 'okc'}">${pct100}</td>
      <td class="${cls}" style="font-size:11px">${acao}</td>
    </tr>`;
  }).join('')}</tbody>`;
}
