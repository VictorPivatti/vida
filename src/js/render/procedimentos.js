// render/procedimentos.js — Procedimentos pane rendering
import { state } from '../state.js';
import { $, esc, fmt, pct, norm, shortName, kpi } from '../utils/dom.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { catOfEsp, procTipoKey, procTipoLabel } from '../parsers/proc.js';

function sum(arr, fn) { return arr.reduce((s, r) => s + (fn(r) || 0), 0); }

function procFilteredRows() {
  const esp = $('procFiltroEsp')?.value || 'all';
  const prof = $('procFiltroProf')?.value || 'all';
  const proc = $('procFiltroProc')?.value || 'all';
  const fat = $('procFiltroFat')?.value || 'all';
  return state.procRaw.filter(r =>
    (esp === 'all' || r.esp === esp) &&
    (prof === 'all' || r.prof === prof) &&
    (proc === 'all' || r.proc === proc) &&
    (fat === 'all' || r.faturavelFlag === fat)
  );
}

function setSelectOptions(id, values, allLabel) {
  const el = $(id); if (!el) return;
  const cur = el.value || 'all';
  el.innerHTML = `<option value="all">${allLabel}</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  el.value = values.includes(cur) ? cur : 'all';
}

export function renderProcedimentos() {
  const empty = $('procEmpty'), contentEl = $('procContent');
  if (!state.procRaw.length) {
    if (empty) empty.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  if (contentEl) contentEl.classList.remove('hidden');
  setSelectOptions('procFiltroEsp', [...new Set(state.procRaw.map(r => r.esp).filter(Boolean))].sort(), 'Todas as especialidades');
  setSelectOptions('procFiltroProf', [...new Set(state.procRaw.map(r => r.prof).filter(Boolean))].sort(), 'Todos os profissionais');
  setSelectOptions('procFiltroProc', [...new Set(state.procRaw.map(r => r.proc).filter(Boolean))].sort(), 'Todos os procedimentos');
  const rows = procFilteredRows();
  state.procFilt = rows;

  const total = sum(rows, r => r.qde);
  const fat = sum(rows.filter(r => r.faturavelFlag === 'S'), r => r.qde);
  const byCategoria = { med: [], enf: [], tec: [], out: [] };
  rows.forEach(r => byCategoria[catOfEsp(r.esp)].push(r));

  const profs = new Set(rows.map(r => norm(r.prof))).size;
  const medProfs = new Set(byCategoria.med.map(r => norm(r.prof))).size;
  const enfProfs = new Set(byCategoria.enf.map(r => norm(r.prof))).size;
  const tecProfs = new Set(byCategoria.tec.map(r => norm(r.prof))).size;
  $('kpisProc').innerHTML = [
    kpi('Total BPA', fmt(total), `${fmt(profs)} profissionais ativos`, '#1357a6'),
    kpi('Equipe médica', fmt(sum(byCategoria.med, r => r.qde)), `${medProfs} médicos — ${total ? (sum(byCategoria.med, r => r.qde) / total * 100).toFixed(0) : '0'}% do total`, '#7b61c4'),
    kpi('Enfermeiros', fmt(sum(byCategoria.enf, r => r.qde)), `${enfProfs} enfermeiros — ${total ? (sum(byCategoria.enf, r => r.qde) / total * 100).toFixed(0) : '0'}% do total`, '#38ac8b'),
    kpi('Téc. de enfermagem', fmt(sum(byCategoria.tec, r => r.qde)), `${tecProfs} técnicos — ${total ? (sum(byCategoria.tec, r => r.qde) / total * 100).toFixed(0) : '0'}% do total`, '#e8a93b'),
    kpi('Faturáveis', pct(fat, total), `${fmt(fat)} procedimentos`, '#4aa3c9'),
  ].join('');

  const cats = [
    { label: 'Médicos Clínicos', cat: 'med', cor: '#7b61c4' },
    { label: 'Enfermeiros', cat: 'enf', cor: '#38ac8b' },
    { label: 'Técnicos de Enfermagem', cat: 'tec', cor: '#e8a93b' },
    { label: 'Outros', cat: 'out', cor: '#94a3b8' },
  ];
  const resumoRows = cats.map(c => {
    const r = byCategoria[c.cat];
    const tot = sum(r, x => x.qde);
    const ps = new Set(r.map(x => norm(x.prof))).size;
    const med = ps ? Math.round(tot / ps) : 0;
    const vals = Object.values(r.reduce((m, x) => { const k = norm(x.prof); m[k] = (m[k] || 0) + x.qde; return m; }, {})).sort((a, b) => a - b);
    const mediana = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
    return { ...c, tot, ps, med, mediana, pct: total ? +(tot / total * 100).toFixed(1) : 0 };
  }).filter(c => c.tot > 0);
  const totalGeral = sum(resumoRows, r => r.tot), profsGeral = sum(resumoRows, r => r.ps);
  $('tableProcResumo').innerHTML = `<thead><tr>
    <th>Categoria</th><th>Profissionais</th><th>Total BPA</th><th>Média/profissional</th><th>Mediana</th><th>% do total</th>
  </tr></thead><tbody>${resumoRows.map(r => `<tr>
    <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${r.cor};margin-right:6px"></span><strong>${esc(r.label)}</strong></td>
    <td class="mono">${fmt(r.ps)}</td>
    <td class="mono" style="color:${r.cor};font-weight:700">${fmt(r.tot)}</td>
    <td class="mono">${fmt(r.med)}</td>
    <td class="mono">${fmt(r.mediana)}</td>
    <td class="mono"><div style="display:flex;align-items:center;gap:6px"><div style="width:${Math.round(r.pct * 1.2)}px;max-width:80px;height:6px;background:${r.cor};border-radius:3px"></div>${r.pct}%</div></td>
  </tr>`).join('')}
  <tr style="border-top:2px solid var(--bdr);font-weight:700">
    <td>TOTAL GERAL</td><td class="mono">${fmt(profsGeral)}</td>
    <td class="mono">${fmt(totalGeral)}</td>
    <td class="mono">${profsGeral ? fmt(Math.round(totalGeral / profsGeral)) : '-'}</td>
    <td class="mono">—</td><td class="mono">100%</td>
  </tr></tbody>`;

  // Section: Medicos
  const medRowsData = byCategoria.med;
  const medTotal = sum(medRowsData, r => r.qde);
  if ($('kpiMedTotal')) $('kpiMedTotal').textContent = `${fmt(medTotal)} procedimentos · ${medProfs} médicos`;
  const medByProf = Object.values(medRowsData.reduce((m, r) => { const k = norm(r.prof); m[k] = m[k] || { prof: r.prof, total: 0 }; m[k].total += r.qde; return m; }, {})).sort((a, b) => b.total - a.total);
  const topMed = medByProf.slice(0, 15).reverse();
  chart('chartMedTotal', { type: 'bar', data: { labels: topMed.map(r => shortName(r.prof)), datasets: [{ data: topMed.map(r => r.total), backgroundColor: '#7b61c4', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  const medProcTypes = [['consulta', 'Consulta/Urgência', '#7b61c4'], ['ecg', 'ECG', '#1357a6'], ['radio', 'Radiologia', '#4aa3c9'], ['outro', 'Outros', '#94a3b8']];
  const topMed15 = medByProf.slice(0, 15);
  const medProfMap = medRowsData.reduce((m, r) => { const k = norm(r.prof); (m[k] = m[k] || {})[procTipoKey(r.proc, r.codProc)] = (m[k][procTipoKey(r.proc, r.codProc)] || 0) + r.qde; return m; }, {});
  chart('chartMedPerfil', { type: 'bar', data: { labels: topMed15.map(r => shortName(r.prof)), datasets: medProcTypes.map(([t, l, c]) => ({ label: l, data: topMed15.map(r => medProfMap[norm(r.prof)]?.[t] || 0), backgroundColor: c, borderRadius: 2 })) }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true, font: { size: 10 } } } }, scales: { ...axes(), x: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor(), font: { size: 9 } } } } } });
  const medByProfDetail = Object.values(medRowsData.reduce((m, r) => { const k = norm(r.prof); m[k] = m[k] || { prof: r.prof, total: 0, tipos: {} }; m[k].total += r.qde; const t = procTipoKey(r.proc, r.codProc); m[k].tipos[t] = (m[k].tipos[t] || 0) + r.qde; return m; }, {})).sort((a, b) => b.total - a.total);
  const medMax = medByProfDetail[0]?.total || 1;
  if ($('tableProcMedicos')) {
    $('tableProcMedicos').innerHTML = `<thead><tr><th>#</th><th>Médico</th><th>Consultas/UPA</th><th>ECG</th><th>Radiologia</th><th>Outros</th><th>Total BPA</th><th>Perfil</th></tr></thead><tbody>${medByProfDetail.map((r, i) => {
      const c = r.tipos, bars = '█'.repeat(Math.round(r.total / medMax * 12)) + '░'.repeat(12 - Math.round(r.total / medMax * 12));
      return `<tr><td class="mono muted">${i + 1}</td><td style="font-weight:600">${esc(shortName(r.prof))}</td>
        <td class="mono">${(c.consulta || 0) > 0 ? fmt(c.consulta || 0) : '-'}</td>
        <td class="mono">${(c.ecg || 0) > 0 ? fmt(c.ecg || 0) : '-'}</td>
        <td class="mono">${(c.radio || 0) > 0 ? fmt(c.radio || 0) : '-'}</td>
        <td class="mono">${(c.outro || 0) > 0 ? fmt(c.outro || 0) : '-'}</td>
        <td class="mono" style="font-weight:700;color:var(--ac)">${fmt(r.total)}</td>
        <td class="mono" style="font-size:10px;letter-spacing:-1px;color:#7b61c4">${bars}</td></tr>`;
    }).join('')}</tbody>`;
  }

  // Section: Enfermeiros
  const enfRowsData = byCategoria.enf;
  const enfTotal = sum(enfRowsData, r => r.qde);
  if ($('kpiEnfTotal')) $('kpiEnfTotal').textContent = `${fmt(enfTotal)} procedimentos · ${enfProfs} enfermeiros`;
  const enfByProf = Object.values(enfRowsData.reduce((m, r) => { const k = norm(r.prof); m[k] = m[k] || { prof: r.prof, total: 0 }; m[k].total += r.qde; return m; }, {})).sort((a, b) => b.total - a.total);
  const topEnf = enfByProf.slice(0, 14).reverse();
  chart('chartEnfTotal', { type: 'bar', data: { labels: topEnf.map(r => shortName(r.prof)), datasets: [{ data: topEnf.map(r => r.total), backgroundColor: '#38ac8b', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  const enfProcTypes = [['triagem', 'Triagens', '#38ac8b'], ['ev', 'Med. EV', '#1357a6'], ['im', 'Med. IM', '#e8a93b'], ['vo', 'Med. VO', '#e8a93b'], ['outro', 'Outros', '#94a3b8']];
  const enfProfMap = enfRowsData.reduce((m, r) => { const k = norm(r.prof); (m[k] = m[k] || {})[procTipoKey(r.proc, r.codProc)] = (m[k][procTipoKey(r.proc, r.codProc)] || 0) + r.qde; return m; }, {});
  const topEnf14 = enfByProf.slice(0, 14);
  chart('chartEnfPerfil', { type: 'bar', data: { labels: topEnf14.map(r => shortName(r.prof)), datasets: enfProcTypes.map(([t, l, c]) => ({ label: l, data: topEnf14.map(r => enfProfMap[norm(r.prof)]?.[t] || 0), backgroundColor: c, borderRadius: 2 })) }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true, font: { size: 10 } } } }, scales: { ...axes(), x: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor(), font: { size: 9 } } } } } });
  const enfByProfDetail = Object.values(enfRowsData.reduce((m, r) => { const k = norm(r.prof); m[k] = m[k] || { prof: r.prof, total: 0, tipos: {} }; m[k].total += r.qde; const t = procTipoKey(r.proc, r.codProc); m[k].tipos[t] = (m[k].tipos[t] || 0) + r.qde; return m; }, {})).sort((a, b) => b.total - a.total);
  const enfMax = enfByProfDetail[0]?.total || 1;
  if ($('tableProcEnfermeiros')) {
    $('tableProcEnfermeiros').innerHTML = `<thead><tr><th>#</th><th>Enfermeiro(a)</th><th>Triagens</th><th>Med. EV</th><th>Med. IM</th><th>Med. VO</th><th>Diagnóstico/Outros</th><th>Total BPA</th><th>Perfil</th></tr></thead><tbody>${enfByProfDetail.map((r, i) => {
      const c = r.tipos, bars = '█'.repeat(Math.round(r.total / enfMax * 12)) + '░'.repeat(12 - Math.round(r.total / enfMax * 12));
      return `<tr><td class="mono muted">${i + 1}</td><td style="font-weight:600">${esc(shortName(r.prof))}</td>
        <td class="mono" style="${(c.triagem || 0) > 0 ? 'color:var(--ok)' : ''}">${(c.triagem || 0) > 0 ? fmt(c.triagem || 0) : '-'}</td>
        <td class="mono">${(c.ev || 0) > 0 ? fmt(c.ev || 0) : '-'}</td>
        <td class="mono">${(c.im || 0) > 0 ? fmt(c.im || 0) : '-'}</td>
        <td class="mono">${(c.vo || 0) > 0 ? fmt(c.vo || 0) : '-'}</td>
        <td class="mono">${fmt((c.glicemia || 0) + (c.outro || 0) + (c.curativo || 0))}</td>
        <td class="mono" style="font-weight:700;color:var(--ok)">${fmt(r.total)}</td>
        <td class="mono" style="font-size:10px;letter-spacing:-1px;color:#38ac8b">${bars}</td></tr>`;
    }).join('')}</tbody>`;
  }

  // Section: Tecnicos
  const tecRowsData = byCategoria.tec;
  const tecTotal = sum(tecRowsData, r => r.qde);
  if ($('kpiTecTotal')) $('kpiTecTotal').textContent = `${fmt(tecTotal)} procedimentos · ${tecProfs} técnicos`;
  const tecByProf = Object.values(tecRowsData.reduce((m, r) => { const k = norm(r.prof); m[k] = m[k] || { prof: r.prof, total: 0 }; m[k].total += r.qde; return m; }, {})).sort((a, b) => b.total - a.total);
  const topTec = tecByProf.slice(0, 15).reverse();
  chart('chartTecTotal', { type: 'bar', data: { labels: topTec.map(r => shortName(r.prof)), datasets: [{ data: topTec.map(r => r.total), backgroundColor: '#e8a93b', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  const tecProcTypes = [['ev', 'Med. EV', '#e8a93b'], ['im', 'Med. IM', '#e8a93b'], ['vo', 'Med. VO', '#38ac8b'], ['sc', 'Med. SC', '#1357a6'], ['neb', 'Nebulização', '#7b61c4'], ['outro', 'Outros', '#94a3b8']];
  const tecProfMap = tecRowsData.reduce((m, r) => { const k = norm(r.prof); (m[k] = m[k] || {})[procTipoKey(r.proc, r.codProc)] = (m[k][procTipoKey(r.proc, r.codProc)] || 0) + r.qde; return m; }, {});
  const topTec15 = tecByProf.slice(0, 15);
  chart('chartTecPerfil', { type: 'bar', data: { labels: topTec15.map(r => shortName(r.prof)), datasets: tecProcTypes.map(([t, l, c]) => ({ label: l, data: topTec15.map(r => tecProfMap[norm(r.prof)]?.[t] || 0), backgroundColor: c, borderRadius: 2 })) }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true, font: { size: 10 } } } }, scales: { ...axes(), x: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor(), font: { size: 9 } } } } } });
  const tecByProfDetail = Object.values(tecRowsData.reduce((m, r) => { const k = norm(r.prof); m[k] = m[k] || { prof: r.prof, total: 0, tipos: {} }; m[k].total += r.qde; const t = procTipoKey(r.proc, r.codProc); m[k].tipos[t] = (m[k].tipos[t] || 0) + r.qde; return m; }, {})).sort((a, b) => b.total - a.total);
  const tecMax = tecByProfDetail[0]?.total || 1;
  if ($('tableProcTecnicos')) {
    $('tableProcTecnicos').innerHTML = `<thead><tr><th>#</th><th>Técnico(a)</th><th>Med. EV</th><th>Med. IM</th><th>Med. VO</th><th>Med. SC</th><th>Nebulização</th><th>Outros</th><th>Total BPA</th><th>Perfil</th></tr></thead><tbody>${tecByProfDetail.map((r, i) => {
      const c = r.tipos, bars = '█'.repeat(Math.round(r.total / tecMax * 12)) + '░'.repeat(12 - Math.round(r.total / tecMax * 12));
      return `<tr><td class="mono muted">${i + 1}</td><td style="font-weight:600">${esc(shortName(r.prof))}</td>
        <td class="mono" style="${(c.ev || 0) > 0 ? 'color:var(--ac)' : ''}">${(c.ev || 0) > 0 ? fmt(c.ev || 0) : '-'}</td>
        <td class="mono">${(c.im || 0) > 0 ? fmt(c.im || 0) : '-'}</td>
        <td class="mono">${(c.vo || 0) > 0 ? fmt(c.vo || 0) : '-'}</td>
        <td class="mono">${(c.sc || 0) > 0 ? fmt(c.sc || 0) : '-'}</td>
        <td class="mono">${(c.neb || 0) > 0 ? fmt(c.neb || 0) : '-'}</td>
        <td class="mono">${(c.outro || 0) + (c.glicemia || 0) + (c.curativo || 0) > 0 ? fmt((c.outro || 0) + (c.glicemia || 0) + (c.curativo || 0)) : '-'}</td>
        <td class="mono" style="font-weight:700;color:#e8a93b">${fmt(r.total)}</td>
        <td class="mono" style="font-size:10px;letter-spacing:-1px;color:#e8a93b">${bars}</td></tr>`;
    }).join('')}</tbody>`;
  }

  // Section: Outros
  const outRows = byCategoria.out;
  const secOut = $('secaoOutros');
  if (outRows.length && secOut) {
    secOut.classList.remove('hidden');
    const outTotal = sum(outRows, r => r.qde);
    const outProfs = new Set(outRows.map(r => norm(r.prof))).size;
    if ($('kpiOutTotal')) $('kpiOutTotal').textContent = `${fmt(outTotal)} procedimentos · ${outProfs} profissionais`;
    const outDetail = Object.values(outRows.reduce((m, r) => { const k = norm(r.prof); m[k] = m[k] || { prof: r.prof, esp: r.esp, total: 0 }; m[k].total += r.qde; return m; }, {})).sort((a, b) => b.total - a.total);
    if ($('tableProcOutros')) {
      $('tableProcOutros').innerHTML = `<thead><tr><th>#</th><th>Profissional</th><th>Especialidade</th><th>Total BPA</th></tr></thead><tbody>${outDetail.map((r, i) => `<tr><td class="mono muted">${i + 1}</td><td>${esc(shortName(r.prof))}</td><td class="muted">${esc(r.esp)}</td><td class="mono">${fmt(r.total)}</td></tr>`).join('')}</tbody>`;
    }
  } else if (secOut) {
    secOut.classList.add('hidden');
  }
}
