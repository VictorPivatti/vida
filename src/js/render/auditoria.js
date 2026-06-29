// render/auditoria.js — Auditoria pane rendering
import { state } from '../state.js';
import { $, esc, fmt, pct, shortName, kpi } from '../utils/dom.js';
import { chart, gridColor, tickColor } from '../ui/charts.js';
import { CONFIG } from '../constants.js';
import { returns72, returnsFor } from '../metrics/returns.js';

const AUDIT_RULES = [
  { id: 't01', tipo: 'temporal', sev: 'alta', label: 'Acolhimento antes da recepção', fn: r => r.dhAcol && r.dh && r.dhAcol < r.dh, motivo: r => `dh_acolhimento (${r.dhAcol?.toLocaleString('pt-BR')}) < dh_recepcao (${r.dh?.toLocaleString('pt-BR')})`, campo: 'dh_acolhimento' },
  { id: 't02', tipo: 'temporal', sev: 'alta', label: 'Atendimento médico antes do acolhimento', fn: r => r.dhAtend && r.dhAcol && r.dhAtend < r.dhAcol, motivo: r => `dh_atendimento (${r.dhAtend?.toLocaleString('pt-BR')}) < dh_acolhimento (${r.dhAcol?.toLocaleString('pt-BR')})`, campo: 'dh_atendimento' },
  { id: 't03', tipo: 'temporal', sev: 'media', label: 'Data futura — além de hoje', fn: r => r.dh && r.dh > new Date(), motivo: r => `Data ${r.dh?.toLocaleDateString('pt-BR')} está no futuro`, campo: 'dh_recepcao' },
  { id: 't04', tipo: 'temporal', sev: 'media', label: 'Soma das partes maior que tempo total', fn: r => { if (r.tEspTri == null || r.tDurTri == null || r.tTotal == null) return false; return (r.tEspTri + r.tDurTri) > r.tTotal * 1.05; }, motivo: r => `tEspTri(${Math.round(r.tEspTri)}) + tDurTri(${Math.round(r.tDurTri)}) = ${Math.round(r.tEspTri + r.tDurTri)} min > tTotal(${Math.round(r.tTotal)}) min`, campo: 'tTotal' },
  { id: 'o01', tipo: 'outlier', sev: 'alta', label: 'Espera médico > 6h (provável erro)', fn: r => r.tEspMed != null && r.tEspMed > 360, motivo: r => `tEspMed = ${Math.round(r.tEspMed)} min (${(r.tEspMed / 60).toFixed(1)}h)`, campo: 'tEspMed' },
  { id: 'o02', tipo: 'outlier', sev: 'alta', label: 'Tempo total > 12h (provável internação não registrada)', fn: r => r.tTotal != null && r.tTotal > CONFIG.MAX_MINUTES, motivo: r => `tTotal = ${Math.round(r.tTotal)} min (${(r.tTotal / 60).toFixed(1)}h)`, campo: 'tTotal' },
  { id: 'o03', tipo: 'outlier', sev: 'media', label: 'Tempo de triagem > 2h', fn: r => r.tEspTri != null && r.tEspTri > 120, motivo: r => `tEspTri = ${Math.round(r.tEspTri)} min`, campo: 'tEspTri' },
  { id: 'o04', tipo: 'outlier', sev: 'media', label: 'Idade inválida (< 0 ou > 120)', fn: r => r.idade != null && (r.idade < 0 || r.idade > 120), motivo: r => `idade = ${r.idade}`, campo: 'idade' },
  { id: 'o05', tipo: 'outlier', sev: 'baixa', label: 'Tempo total = 0 minutos', fn: r => r.tTotal != null && r.tTotal === 0, motivo: r => `tTotal = 0 min — registro possivelmente incompleto`, campo: 'tTotal' },
  { id: 'o06', tipo: 'outlier', sev: 'media', label: 'Prontuário genérico (000000, 999999, 123456)', fn: r => /^0+$|^9+$|^123456$|^111111$/.test(String(r.pront || '')), motivo: r => `prontuário = "${r.pront}" — padrão de preenchimento genérico`, campo: 'pront' },
  { id: 'c01', tipo: 'classificacao', sev: 'alta', label: 'Vermelho com espera médico > 10 min', fn: r => r.cor === 'VERMELHO' && r.tEspMed != null && r.tEspMed > 10, motivo: r => `VERMELHO com tEspMed = ${Math.round(r.tEspMed)} min — meta Manchester: ≤ 0 min (imediato)`, campo: 'tEspMed' },
  { id: 'c02', tipo: 'classificacao', sev: 'media', label: 'Laranja com espera médico > 15 min', fn: r => r.cor === 'LARANJA' && r.tEspMed != null && r.tEspMed > 15, motivo: r => `LARANJA com tEspMed = ${Math.round(r.tEspMed)} min — meta Manchester: ≤ 15 min`, campo: 'tEspMed' },
  { id: 'c03', tipo: 'classificacao', sev: 'baixa', label: 'Atendimento sem classificação de risco com tempo de triagem registrado', fn: r => (!r.cor || r.cor === 'SEM CLASSIFICACAO') && r.tEspTri != null && r.tEspTri > 0, motivo: r => `Sem classificação mas tEspTri = ${Math.round(r.tEspTri)} min`, campo: 'cor' },
  { id: 'f01', tipo: 'campo', sev: 'media', label: 'Médico não identificado', fn: r => !r.prof || r.prof.trim() === '' || r.prof.length < 3, motivo: r => `prof = "${r.prof || ''}" — campo vazio ou muito curto`, campo: 'prof' },
  { id: 'f02', tipo: 'campo', sev: 'baixa', label: 'Prontuário ausente ou muito curto', fn: r => !r.pront || String(r.pront).trim().length < 2, motivo: r => `pront = "${r.pront || ''}"`, campo: 'pront' },
];

function detectDuplicatas(rows) {
  const results = [];
  const byPront = {};
  rows.forEach(r => { if (!r.pront) return; byPront[r.pront] = byPront[r.pront] || []; byPront[r.pront].push(r); });
  Object.values(byPront).forEach(visits => {
    visits.sort((a, b) => a.dh - b.dh);
    for (let i = 1; i < visits.length; i++) {
      const prev = visits[i - 1], curr = visits[i];
      const diffMin = (curr.dh - prev.dh) / 60000;
      if (diffMin >= 0 && diffMin < 5 && prev.prof && curr.prof && prev.prof === curr.prof) {
        results.push({ row: curr, tipo: 'duplicata', sev: 'alta', motivo: `Prontuário ${curr.pront} com mesmo médico (${shortName(curr.prof)}) em intervalo de ${diffMin.toFixed(1)} min — possível registro duplicado`, campo: 'pront' });
      }
    }
  });
  return results;
}

let _auditCache = null, _auditCacheKey = '';
function runAudit(rows) {
  const key = rows.length + '_' + (rows[0]?.dateKey || '') + '_' + (rows[rows.length - 1]?.dateKey || '');
  if (_auditCache && _auditCacheKey === key) return _auditCache;
  const issues = [];
  rows.forEach(r => {
    AUDIT_RULES.forEach(rule => {
      try { if (rule.fn(r)) { issues.push({ row: r, ruleId: rule.id, tipo: rule.tipo, sev: rule.sev, label: rule.label, motivo: rule.motivo(r), campo: rule.campo }); } } catch (e) { }
    });
  });
  issues.push(...detectDuplicatas(rows));
  _auditCache = issues;
  _auditCacheKey = key;
  return issues;
}

function fieldScores(rows, issues) {
  const n = rows.length || 1;
  const fields = [
    { campo: 'dh_recepcao', label: 'Data/hora recepção', fn: r => r.dh && !isNaN(r.dh) },
    { campo: 'prof', label: 'Médico', fn: r => r.prof && r.prof.length >= 3 },
    { campo: 'pront', label: 'Prontuário', fn: r => r.pront && String(r.pront).length >= 2 && !/^0+$|^9+$/.test(String(r.pront)) },
    { campo: 'cor', label: 'Classificação risco', fn: r => r.cor && r.cor !== 'SEM CLASSIFICACAO' },
    { campo: 'tEspTri', label: 'Espera triagem', fn: r => r.tEspTri != null && r.tEspTri >= 0 && r.tEspTri < 360 },
    { campo: 'tEspMed', label: 'Espera médico', fn: r => r.tEspMed != null && r.tEspMed >= 0 && r.tEspMed < CONFIG.MAX_MINUTES },
    { campo: 'tTotal', label: 'Tempo total', fn: r => r.tTotal != null && r.tTotal > 0 && r.tTotal < CONFIG.MAX_MINUTES },
    { campo: 'dh_acolhimento', label: 'Acolhimento', fn: r => r.dhAcol && !isNaN(r.dhAcol) },
    { campo: 'dh_atendimento', label: 'Atend. médico', fn: r => r.dhAtend && !isNaN(r.dhAtend) },
    { campo: 'idade', label: 'Idade', fn: r => r.idade != null && r.idade >= 0 && r.idade <= 120 },
  ];
  return fields.map(f => {
    const ok = rows.filter(f.fn).length;
    const erros = issues.filter(i => i.campo === f.campo).length;
    const score = Math.round(ok / n * 100);
    return { ...f, ok, erros, score, n };
  });
}

export function renderAuditoria() {
  const d = state.filt;
  if (!d.length) { $('kpisAudit').innerHTML = kpi('Dados', '—', 'carregue o histórico primeiro', '#94a3b8'); return; }
  const issues = runAudit(d);
  const n = d.length;
  const alta = issues.filter(i => i.sev === 'alta');
  const media = issues.filter(i => i.sev === 'media');
  const baixa = issues.filter(i => i.sev === 'baixa');
  const rowsComProblema = new Set(issues.map(i => i.row?.sourceLine || i.row?.dateKey + '_' + i.row?.pront)).size;
  const taxaDesvio = rowsComProblema / n * 100;
  const penalidade = alta.length * 3 + media.length * 1.5 + baixa.length * 0.5;
  const scoreGeral = Math.max(0, Math.round(100 - penalidade / n * 100));
  const scoreColor = scoreGeral >= 85 ? 'var(--ok)' : scoreGeral >= 65 ? 'var(--wn)' : 'var(--er)';

  $('kpisAudit').innerHTML = [
    `<div class="card kpi" style="--k:${scoreColor}">
      <div class="k-label">Score de confiabilidade</div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:8px">
        <div class="audit-score-ring" style="color:${scoreColor}">${scoreGeral}</div>
        <div>
          <div class="k-sub">${scoreGeral >= 85 ? 'Dados confiáveis' : scoreGeral >= 65 ? 'Atenção necessária' : 'Alta taxa de desvio'}</div>
          <div class="k-sub" style="margin-top:4px">${fmt(rowsComProblema)} registros com problema de ${fmt(n)} total</div>
        </div>
      </div>
    </div>`,
    kpi('Taxa de desvio', taxaDesvio.toFixed(1) + '%', `${fmt(issues.length)} inconsistências detectadas`, taxaDesvio < 5 ? 'var(--ok)' : taxaDesvio < 15 ? 'var(--wn)' : 'var(--er)'),
    kpi('Severidade alta', fmt(alta.length), 'requerem correção imediata', 'var(--er)'),
    kpi('Severidade média', fmt(media.length), 'requerem revisão', 'var(--wn)'),
  ].join('');

  const scores = fieldScores(d, issues);
  $('auditFieldScores').innerHTML = scores.map(f => {
    const color = f.score >= 90 ? 'var(--ok)' : f.score >= 70 ? 'var(--wn)' : 'var(--er)';
    return `<div class="audit-field-row">
      <span class="audit-field-name">${esc(f.label)}</span>
      <div class="audit-bar-wrap"><div class="audit-bar" style="width:${f.score}%;background:${color}"></div></div>
      <span class="audit-score-val" style="color:${color}">${f.score}%</span>
      <span class="audit-count">${f.erros > 0 ? `<span style="color:var(--er)">${fmt(f.erros)} erros</span>` : '<span style="color:var(--ok)">OK</span>'}</span>
    </div>`;
  }).join('');

  const tipos = ['temporal', 'outlier', 'classificacao', 'duplicata', 'campo'];
  const tipoLabels = ['Temporal', 'Outlier', 'Classificação', 'Duplicata', 'Campo'];
  const tipoColors = ['#e8a93b', '#c8493e', '#7b61c4', '#4aa3c9', '#64748b'];
  const tipoData = tipos.map(t => issues.filter(i => i.tipo === t).length);
  chart('chartAuditTipos', { type: 'doughnut', data: { labels: tipoLabels, datasets: [{ data: tipoData, backgroundColor: tipoColors, borderWidth: 2, borderColor: 'var(--sur)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true, padding: 12 } }, tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.parsed)} (${issues.length ? (c.parsed / issues.length * 100).toFixed(1) : 0}%)` } } } } });

  const errByMed = {};
  issues.forEach(i => { if (!i.row?.prof) return; const sn = shortName(i.row.prof); errByMed[sn] = errByMed[sn] || { alta: 0, media: 0, baixa: 0 }; errByMed[sn][i.sev]++; });
  const topMedErr = Object.entries(errByMed).map(([n, v]) => ({ n, total: v.alta + v.media + v.baixa, ...v })).sort((a, b) => b.total - a.total).slice(0, 15);
  chart('chartAuditMed', { type: 'bar', data: { labels: topMedErr.map(x => x.n), datasets: [{ label: 'Alta', data: topMedErr.map(x => x.alta), backgroundColor: '#c8493e', borderRadius: 2 }, { label: 'Média', data: topMedErr.map(x => x.media), backgroundColor: '#e8a93b', borderRadius: 2 }, { label: 'Baixa', data: topMedErr.map(x => x.baixa), backgroundColor: '#64748b', borderRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } } }, scales: { x: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor(), font: { size: 9 }, maxRotation: 35 } }, y: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } } } } });

  const rowsLimpos = d.filter(r => !issues.some(i => i.row === r && i.sev === 'alta'));
  const impact = [
    { ind: 'Volume total', todos: fmt(d.length), limpos: fmt(rowsLimpos.length), delta: d.length - rowsLimpos.length },
    { ind: 'Espera triagem', todos: (() => { const v = d.filter(r => r.tEspTri != null); return v.length ? v.reduce((s, r) => s + r.tEspTri, 0) / v.length : null; })(), limpos: (() => { const v = rowsLimpos.filter(r => r.tEspTri != null); return v.length ? v.reduce((s, r) => s + r.tEspTri, 0) / v.length : null; })(), unit: 'min' },
    { ind: 'Espera médico', todos: (() => { const v = d.filter(r => r.tEspMed != null); return v.length ? v.reduce((s, r) => s + r.tEspMed, 0) / v.length : null; })(), limpos: (() => { const v = rowsLimpos.filter(r => r.tEspMed != null); return v.length ? v.reduce((s, r) => s + r.tEspMed, 0) / v.length : null; })(), unit: 'min' },
    { ind: 'Tempo total', todos: (() => { const v = d.filter(r => r.tTotal != null); return v.length ? v.reduce((s, r) => s + r.tTotal, 0) / v.length : null; })(), limpos: (() => { const v = rowsLimpos.filter(r => r.tTotal != null); return v.length ? v.reduce((s, r) => s + r.tTotal, 0) / v.length : null; })(), unit: 'min' },
    { ind: 'Retorno ≤72h', todos: (() => { const { ret } = returns72(); return d.length ? ret.length / d.length * 100 : 0; })(), limpos: (() => { const { ret } = returnsFor(rowsLimpos); return rowsLimpos.length ? ret.length / rowsLimpos.length * 100 : 0; })(), unit: '%' },
  ];
  $('tableAuditImpact').innerHTML = `<thead><tr>
    <th>Indicador</th><th>Com todos os registros</th><th>Sem alta severidade</th><th>Diferença</th><th>Confiança</th>
  </tr></thead><tbody>${impact.map(r => {
    const vT = typeof r.todos === 'number' ? r.todos : null;
    const vL = typeof r.limpos === 'number' ? r.limpos : null;
    const diff = vT != null && vL != null ? Math.abs(vT - vL) : null;
    const diffPct = vT && diff ? diff / Math.abs(vT) * 100 : null;
    const fmtV = v => v == null ? '-' : typeof v === 'number' ? (r.unit ? v.toFixed(1) + ' ' + r.unit : fmt(Math.round(v))) : v;
    const confianca = diffPct == null ? '—' : diffPct < 2 ? 'Alta' : diffPct < 5 ? 'Média' : 'Baixa';
    const confColor = diffPct == null ? 'var(--mut)' : diffPct < 2 ? 'var(--ok)' : diffPct < 5 ? 'var(--wn)' : 'var(--er)';
    return `<tr>
      <td style="font-weight:600">${esc(r.ind)}</td>
      <td class="mono">${fmtV(r.todos)}</td>
      <td class="mono">${fmtV(r.limpos)}</td>
      <td class="mono ${diffPct != null && diffPct > 5 ? 'erc' : diffPct != null && diffPct > 2 ? 'wnc' : ''}">${diffPct != null ? diffPct.toFixed(1) + '%' : diff === 0 ? '0.0%' : '—'}</td>
      <td style="color:${confColor};font-weight:700;font-size:11px">${confianca}</td>
    </tr>`;
  }).join('')}</tbody>`;

  renderAuditLog(issues);
  $('auditFilter').onchange = () => renderAuditLog(issues);
  const expBtn = $('auditExportBtn');
  if (expBtn) expBtn.onclick = () => exportAuditLog(issues);
}

function renderAuditLog(issues) {
  const filtro = $('auditFilter')?.value || 'all';
  const filtered = filtro === 'all' ? issues : issues.filter(i => i.tipo === filtro);
  $('auditLogCount').textContent = `${fmt(filtered.length)} de ${fmt(issues.length)} inconsistências exibidas`;
  $('tableAuditLog').innerHTML = `<thead><tr>
    <th>Linha</th><th>Data/hora</th><th>Prontuário</th><th>Médico</th>
    <th>Tipo</th><th>Severidade</th><th>Campo</th><th>Detalhe</th>
  </tr></thead><tbody>${filtered.slice(0, 500).map(i => {
    const r = i.row;
    const sevColor = i.sev === 'alta' ? 'var(--er)' : i.sev === 'media' ? 'var(--wn)' : 'var(--mut)';
    return `<tr>
      <td class="mono muted">${r?.sourceLine ?? '—'}</td>
      <td class="mono">${r?.dh ? r.dh.toLocaleString('pt-BR') : '-'}</td>
      <td class="mono">${esc(r?.pront || '—')}</td>
      <td>${esc(shortName(r?.prof || '—'))}</td>
      <td><span class="audit-tag ${i.tipo}">${esc(i.tipo)}</span></td>
      <td style="color:${sevColor};font-weight:700;font-size:11px;font-family:'IBM Plex Mono',monospace">${esc(i.sev)}</td>
      <td class="mono muted">${esc(i.campo || '—')}</td>
      <td style="font-size:11px;color:var(--txt2);max-width:300px">${esc(i.motivo || '—')}</td>
    </tr>`;
  }).join('')}${filtered.length > 500 ? `<tr><td colspan="8" class="mono muted" style="padding:12px">... ${fmt(filtered.length - 500)} registros adicionais. Exporte o log completo.</td></tr>` : ''}</tbody>`;
}

function exportAuditLog(issues) {
  if (!issues.length) { if (typeof window !== 'undefined' && window.showToast) window.showToast('Nenhuma inconsistência para exportar.', 'warn'); return; }
  const rows = issues.map(i => ({
    'Linha fonte': i.row?.sourceLine ?? '',
    'Data/hora': i.row?.dh ? i.row.dh.toLocaleString('pt-BR') : '',
    'Prontuário': i.row?.pront ?? '',
    'Médico': i.row?.prof ?? '',
    'Classificação': i.row?.cor ?? '',
    'Tipo': i.tipo,
    'Severidade': i.sev,
    'Campo': i.campo ?? '',
    'Regra': i.ruleId ?? '',
    'Descrição': i.label ?? '',
    'Detalhe': i.motivo ?? '',
  }));
  try {
    if (typeof XLSX !== 'undefined') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Log Auditoria');
      XLSX.writeFile(wb, `VIDA_auditoria_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
      if (typeof window !== 'undefined' && window.showToast) window.showToast(`Log exportado: ${fmt(rows.length)} inconsistências.`, 'ok');
    }
  } catch (e) { if (typeof window !== 'undefined' && window.showToast) window.showToast('Erro ao exportar: ' + e.message, 'err'); }
}
