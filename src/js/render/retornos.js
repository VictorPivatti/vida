// render/retornos.js — Retornos pane rendering
import { state } from '../state.js';
import { $, esc, fmt, fmtN, pct, norm, shortName, kpi } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { monthLabel } from '../utils/dates.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { returnsFor, returnsWithin, returns72, monthReturnRate } from '../metrics/returns.js';
import { previousRows } from '../metrics/previous-period.js';

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }

function group(arr, fn) { return arr.reduce((m, r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; return m; }, {}); }
function riskWeight(c) { return ({ BRANCO: 0, AZUL: 1, VERDE: 2, AMARELO: 3, LARANJA: 4, VERMELHO: 5 }[c] ?? 1); }

function metricDelta(cur, prev, unit = '', inverse = false) {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return '';
  const diff = cur - prev, pctDiff = diff / Math.abs(prev) * 100, good = inverse ? diff <= 0 : diff >= 0;
  const sign = diff > 0 ? '+' : '';
  return `<div class="k-trend ${good ? 'okc' : 'erc'}">${sign}${unit === 'pp' ? fmtN(diff, 1) + ' p.p.' : Math.round(diff) + (unit ? ` ${unit}` : '')} (${sign}${fmtN(pctDiff, 1)}%) vs período anterior</div>`;
}

export function renderRetornos() {
  const { byP, ret } = returns72(), d = state.filt;
  const patients = Object.keys(byP).length, multi = Object.values(byP).filter(v => v.length > 1).length;
  const prev = previousRows(), prevRet = returnsFor(prev).ret;
  const retRate = d.length ? ret.length / d.length * 100 : null;
  const prevRate = prev.length ? prevRet.length / prev.length * 100 : null;
  $('kpisRet').innerHTML = [
    kpi('Retornos ≤72h', fmt(ret.length), `${pct(ret.length, d.length)} eventos/atend. — meta < ${meta('metaRet')}%`, '#c8493e', metricDelta(retRate, prevRate, 'pp', true)),
    kpi('Pacientes unicos', fmt(patients), 'prontuários distintos', '#1357a6'),
    kpi('Multiplas visitas', fmt(multi), pct(multi, patients) + ' dos pacientes', '#7b61c4')
  ].join('');
  const r24 = ret.filter(r => r.diffH <= 24), r48 = ret.filter(r => r.diffH <= 48);
  const ret7 = returnsWithin(d, 168), retCrit = ret.filter(r => ['AMARELO', 'LARANJA', 'VERMELHO'].includes(r.cor)), retPiora = ret.filter(r => riskWeight(r.cor) > riskWeight(r.prev?.cor));
  $('kpisRetAdv').innerHTML = [
    kpi('Retorno <=24h', fmt(r24.length), pct(r24.length, d.length), '#c8493e'),
    kpi('Retorno <=48h', fmt(r48.length), pct(r48.length, d.length), '#e8a93b'),
    kpi('Retorno <=7 dias', fmt(ret7.length), pct(ret7.length, d.length), '#7b61c4'),
    kpi('Retorno critico', fmt(retCrit.length), 'retornou amarelo/laranja/vermelho', '#e8a93b')
  ].join('');
  const totalM = group(d, r => r.anoMes), retM = group(ret, r => r.anoMes), keys = Object.keys(totalM).map(Number).sort(), retVals = keys.map(k => +(((retM[k] || 0) / totalM[k]) * 100).toFixed(1));
  chart('chartRetMes', { type: 'bar', data: { labels: keys.map(monthLabel), datasets: [{ data: retVals, backgroundColor: keys.map(k => ((retM[k] || 0) / totalM[k] * 100) > meta('metaRet') ? '#c8493e' : '#38ac8b'), borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, targetLine: { lines: [{ value: meta('metaRet'), label: 'meta retorno', color: '#9aa6b6' }] } }, scales: { ...axes(), y: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => v + '%' }, suggestedMax: Math.max(meta('metaRet'), ...retVals, 1) * 1.25 } } } });
  const byH = group(ret, r => r.hora);
  chart('chartRetHora', { type: 'bar', data: { labels: Array.from({ length: 24 }, (_, i) => i + 'h'), datasets: [{ data: Array.from({ length: 24 }, (_, i) => byH[i] || 0), backgroundColor: '#e8a93b', borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  chart('chartRetJanelas', { type: 'bar', data: { labels: ['24h', '48h', '72h', '7 dias'], datasets: [{ data: [r24.length, r48.length, ret.length, ret7.length], backgroundColor: ['#c8493e', '#e8a93b', '#2f9e7e', '#7b61c4'], borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  const top = Object.entries(byP).filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length).slice(0, 20);
  $('tableRet').innerHTML = `<thead><tr><th>Prontuário</th><th>Visitas</th><th>Retornos 72h</th><th>Ultima visita</th></tr></thead><tbody>${top.map(([p, v]) => `<tr><td class="mono">${esc(p)}</td><td class="mono">${v.length}</td><td class="mono">${ret.filter(r => r.pront === p).length}</td><td class="mono">${v[v.length - 1].dh.toLocaleDateString('pt-BR')}</td></tr>`).join('')}</tbody>`;

  const retByMed = {};
  ret.forEach(r => {
    if (!r.prof) return;
    const k = norm(r.prof);
    retByMed[k] = retByMed[k] || { prof: r.prof, total: 0, critico: 0, piora: 0 };
    retByMed[k].total++;
    if (['AMARELO', 'LARANJA', 'VERMELHO'].includes(r.cor)) retByMed[k].critico++;
    if (riskWeight(r.cor) > riskWeight(r.prev?.cor)) retByMed[k].piora++;
  });
  const allByMed = {}; d.forEach(r => { if (!r.prof) return; const k = norm(r.prof); allByMed[k] = (allByMed[k] || 0) + 1 });
  const topMedRet = Object.values(retByMed)
    .map(x => ({ ...x, totalAtend: allByMed[norm(x.prof)] || 0, taxa: allByMed[norm(x.prof)] ? +(x.total / allByMed[norm(x.prof)] * 100).toFixed(1) : null }))
    .sort((a, b) => b.total - a.total).slice(0, 15);
  $('tableRetMed').innerHTML = `<thead><tr><th>#</th><th>Médico</th><th>Retornos ≤72h</th><th>Taxa s/ atend.</th><th>Críticos</th><th>Piora de risco</th></tr></thead><tbody>${topMedRet.map((r, i) => `<tr>
    <td class="mono">${i + 1}</td>
    <td>${esc(r.prof)}</td>
    <td class="mono ${r.total > 10 ? 'erc' : r.total > 5 ? 'wnc' : ''}">${fmt(r.total)}</td>
    <td class="mono ${r.taxa != null && r.taxa > meta('metaRet') ? 'erc' : ''}">${r.taxa != null ? r.taxa + '%' : '-'}</td>
    <td class="mono ${r.critico > 0 ? 'wnc' : ''}">${fmt(r.critico)}</td>
    <td class="mono ${r.piora > 0 ? 'erc' : ''}">${fmt(r.piora)}</td>
  </tr>`).join('')}</tbody>`;

  const critRows = [...retCrit.map(r => ({ ...r, tipo: 'Critico' })), ...retPiora.map(r => ({ ...r, tipo: 'Piora de risco' }))].sort((a, b) => a.dh - b.dh).slice(-60).reverse();
  $('tableRetCrit').innerHTML = `<thead><tr><th>Tipo</th><th>Prontuário</th><th>Intervalo</th><th>Risco anterior</th><th>Risco retorno</th><th>Data retorno</th><th>Médico</th></tr></thead><tbody>${critRows.map(r => `<tr><td class="mono ${r.tipo === 'Critico' ? 'erc' : 'wnc'}">${esc(r.tipo)}</td><td class="mono">${esc(r.pront)}</td><td class="mono">${r.diffH.toFixed(1)}h</td><td class="mono">${esc(r.prev?.cor || '-')}</td><td class="mono">${esc(r.cor)}</td><td class="mono">${r.dh.toLocaleString('pt-BR')}</td><td>${esc(r.prof || '-')}</td></tr>`).join('')}</tbody>`;

  const cidCard = $('cardRetCid');
  const _cidSrc = state.cidFilt.length ? state.cidFilt : state.cidRaw;
  if (cidCard && _cidSrc.length) {
    cidCard.classList.remove('hidden');
    const cidByProntDate = {};
    _cidSrc.forEach(c => {
      const k = String(c.idAtend || '').trim() + '|' + String(c.dateKey || '').trim();
      cidByProntDate[k] = cidByProntDate[k] || [];
      cidByProntDate[k].push(c.cid || '');
    });
    const retComCid = ret.filter(r => {
      const kAtual = String(r.pront) + '|' + String(r.dateKey);
      const kAnter = String(r.pront) + '|' + String(r.prev?.dateKey || '');
      const cidAtual = cidByProntDate[kAtual], cidAnter = cidByProntDate[kAnter];
      if (!cidAtual || !cidAnter) return false;
      return cidAtual.some(c => cidAnter.includes(c));
    }).map(r => {
      const kAtual = String(r.pront) + '|' + String(r.dateKey);
      const kAnter = String(r.pront) + '|' + String(r.prev?.dateKey || '');
      const cidAtual = cidByProntDate[kAtual] || [], cidAnter = cidByProntDate[kAnter] || [];
      return { ...r, cidsRepetidos: cidAtual.filter(c => cidAnter.includes(c)) };
    });
    const taxaFalha = ret.length ? (retComCid.length / ret.length * 100).toFixed(1) : 0;
    const byCidRep = {};
    retComCid.forEach(r => r.cidsRepetidos.forEach(c => { byCidRep[c] = (byCidRep[c] || 0) + 1; }));
    const topCidsRep = Object.entries(byCidRep).sort((a, b) => b[1] - a[1]).slice(0, 10);
    $('kpisRetCid').innerHTML = [
      kpi('Retornos com mesmo CID', fmt(retComCid.length), `${taxaFalha}% dos retornos ≤72h`, '#c8493e'),
      kpi('Taxa de falha diagnóstica potencial', taxaFalha + '%', `${retComCid.length} de ${fmt(ret.length)} retornos`, '#e8a93b'),
      kpi('CIDs com maior recidiva', fmt(topCidsRep.length), 'diagnósticos repetidos em retornos', '#7b61c4'),
    ].join('');
    $('tableRetMesmoCid').innerHTML = `<thead><tr><th>#</th><th>CID repetido</th><th>Ocorrências</th><th>% dos retornos c/ mesmo CID</th></tr></thead><tbody>${
      topCidsRep.map(([cid, n], i) => `<tr>
        <td class="mono muted">${i + 1}</td>
        <td class="mono" style="font-weight:700">${esc(cid)}</td>
        <td class="mono ${n > 10 ? 'erc' : n > 5 ? 'wnc' : ''}">${fmt(n)}</td>
        <td class="mono">${retComCid.length ? (n / retComCid.length * 100).toFixed(1) : '0'}%</td>
      </tr>`).join('')
    }</tbody>`;
  } else if (cidCard) {
    cidCard.classList.add('hidden');
  }
}
