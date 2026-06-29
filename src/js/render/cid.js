// render/cid.js — CID and Cruzamento pane rendering
import { state } from '../state.js';
import { $, esc, fmt, pct, norm, kpi } from '../utils/dom.js';
import { monthLabel } from '../utils/dates.js';
import { chart, gridColor, tickColor, axes } from '../ui/charts.js';
import { CAP, CAP_COLOR, RISK_COLOR } from '../constants.js';
import { renderNotificaveis } from './notificaveis.js';

function group(arr, fn) { return arr.reduce((m, r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; return m; }, {}); }

export function renderCid() {
  if (!state.cidRaw.length) { $('cidEmpty').classList.remove('hidden'); $('cidContent').classList.add('hidden'); return; }
  $('cidEmpty').classList.add('hidden'); $('cidContent').classList.remove('hidden');
  const d = state.cidFilt, total = d.length, att = new Set(d.map(r => r.idAtend).filter(Boolean)).size, cids = new Set(d.map(r => r.cid)).size;
  $('kpisCid').innerHTML = [kpi('Registros CID', fmt(total), 'linhas importadas no período', '#1357a6'), kpi('Atendimentos com CID', fmt(att || '-'), att ? pct(att, state.filt.length) + ' do historico' : 'sem ID confiável', '#38ac8b'), kpi('CIDs distintos', fmt(cids), 'diagnósticos diferentes', '#7b61c4')].join('');

  const SENTINELA = {
    'Dor Torácica': { cids: ['R07', 'R070', 'R071', 'R072', 'R073', 'R074', 'I20', 'I200', 'I208', 'I209'], color: '#c8493e', icon: '💔' },
    'Sepse': { cids: ['A41', 'A418', 'A419'], color: '#e8a93b', icon: '🦠' },
    'AVE/AVC': { cids: ['I64', 'I640', 'I641', 'I642', 'I643', 'I649', 'I610', 'I611', 'I612', 'I613', 'I614', 'I615', 'I616', 'I618', 'I619', 'I630', 'I631', 'I632', 'I633', 'I634', 'I635', 'I638', 'I639', 'I694'], color: '#7b61c4', icon: '🧠' }
  };
  const sentMatch = r => Object.entries(SENTINELA).find(([, g]) => g.cids.some(c => r.cid === c || r.cid.startsWith(c)));
  const sentCounts = {}, sentMonthly = {};
  Object.keys(SENTINELA).forEach(k => { sentCounts[k] = 0; sentMonthly[k] = {}; });
  d.forEach(r => {
    const m = sentMatch(r);
    if (!m) return;
    sentCounts[m[0]]++;
    sentMonthly[m[0]][r.anoMes] = (sentMonthly[m[0]][r.anoMes] || 0) + 1;
  });
  $('kpisSentinela').innerHTML = Object.entries(SENTINELA).map(([nome, g]) => {
    const n = sentCounts[nome], pctSent = total ? +(n / total * 100).toFixed(1) : 0;
    return `<div class="card kpi" style="--k:${g.color}">
      <div class="kpi-stripe"></div>
      <div class="k-label">${g.icon} ${esc(nome)}</div>
      <div class="k-value" style="color:${g.color}">${fmt(n)}</div>
      <div class="k-sub">${pctSent}% dos registros CID · ${n} ocorrências</div>
    </div>`;
  }).join('');
  const sentKeys = Object.keys(sentMonthly['Dor Torácica']).concat(Object.keys(sentMonthly['Sepse'])).concat(Object.keys(sentMonthly['AVE/AVC']));
  const allMonths = [...new Set(sentKeys)].map(Number).sort();
  chart('chartSentinela', { type: 'line', data: { labels: allMonths.map(monthLabel), datasets: Object.entries(SENTINELA).map(([nome, g]) => ({ label: nome, data: allMonths.map(k => sentMonthly[nome][k] || 0), borderColor: g.color, backgroundColor: g.color + '22', fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: g.color })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true, padding: 16 } } }, scales: { ...axes(), y: { ...axes().y, beginAtZero: true, ticks: { ...axes().y?.ticks, precision: 0 } } } } });

  const byM = {}; d.forEach(r => { byM[r.anoMes] = byM[r.anoMes] || {}; byM[r.anoMes][r.cap] = (byM[r.anoMes][r.cap] || 0) + 1; });
  const keys = Object.keys(byM).map(Number).sort(), capCount = group(d, r => r.cap), caps = Object.entries(capCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
  chart('chartCidCap', { type: 'bar', data: { labels: keys.map(monthLabel), datasets: caps.map(c => ({ label: CAP[c] || c, data: keys.map(k => byM[k]?.[c] || 0), backgroundColor: CAP_COLOR[c] || '#94a3b8' })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } } }, scales: { x: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } } } } });
  const cidCount = group(d, r => r.cid), top = Object.entries(cidCount).sort((a, b) => b[1] - a[1]).slice(0, 15).reverse();
  chart('chartCidTop', { type: 'bar', data: { labels: top.map(([c]) => c), datasets: [{ data: top.map(([, n]) => n), backgroundColor: '#4aa3c9', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  const semCid = Math.max(state.filt.length - att, 0);
  chart('chartCidCoverage', { type: 'bar', data: { labels: ['Cobertura'], datasets: [{ label: 'Com CID', data: [att], backgroundColor: '#38ac8b', borderRadius: 3 }, { label: 'Sem CID ou sem ID', data: [semCid], backgroundColor: '#334155', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.parsed.x)} (${pct(c.parsed.x, att + semCid)})` } } }, scales: { x: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } }, y: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } } } } });
  renderCidTable();
  renderCidTrend();
  renderCidNotificaveisInternal();
}

export function renderCidTable() {
  const q = norm($('searchCid')?.value || ''), rows = state.cidFilt, count = {};
  rows.forEach(r => { const k = r.cid + '|' + r.desc; count[k] = (count[k] || 0) + 1; });
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 150).map(([k, n], i) => { const [cid, desc] = k.split('|'); return { i: i + 1, cid, desc, n, cap: cid[0] }; }).filter(r => !q || norm(r.cid + ' ' + r.desc).includes(q));
  $('tableCid').innerHTML = `<thead><tr><th>#</th><th>CID</th><th>Capítulo</th><th>Descrição</th><th>Qtd</th></tr></thead><tbody>${top.map(r => `<tr><td class="mono">${r.i}</td><td class="mono" style="color:${CAP_COLOR[r.cap] || 'var(--txt)'}">${esc(r.cid)}</td><td>${esc(CAP[r.cap] || r.cap)}</td><td>${esc(r.desc)}</td><td class="mono">${fmt(r.n)}</td></tr>`).join('')}</tbody>`;
}

// ── CID Trend filter state ────────────────────────────────────────────────────
let _trendFilter = 'all';
export function setTrendFilter(type) { _trendFilter = type; }

export function renderCidTrend() {
  const d = state.cidFilt;
  if (!d || !d.length) {
    const el = document.getElementById('cidTrendAlerts');
    if (el) el.innerHTML = '<div class="trend-empty-alert">Carregue dados de CID para analisar tendências.</div>';
    return;
  }

  const windowSize = parseInt(document.getElementById('trendWindow')?.value || '4');
  const threshold  = parseFloat(document.getElementById('trendThreshold')?.value || '2');

  const byMonth = {};
  d.forEach(r => {
    const m = r.anoMes || r.dateKey?.substring(0, 7);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = {};
    if (!byMonth[m][r.cid]) byMonth[m][r.cid] = { count: 0, desc: r.desc || r.cid };
    byMonth[m][r.cid].count++;
  });

  const months = Object.keys(byMonth).sort();
  if (months.length < 3) {
    const el = document.getElementById('cidTrendAlerts');
    if (el) el.innerHTML = '<div class="trend-empty-alert">São necessários ao menos 3 meses de dados para análise de tendência.</div>';
    const note = document.getElementById('cidTrendNote');
    if (note) note.textContent = 'Dados insuficientes para análise. Importe pelo menos 3 meses de CID.';
    return;
  }

  const lastMonth  = months[months.length - 1];
  const baseMonths = months.slice(
    Math.max(0, months.length - 1 - windowSize),
    months.length - 1
  );

  const cidLastMonth = byMonth[lastMonth] || {};
  const alerts = [];

  const totalByMonth = {};
  months.forEach(m => {
    totalByMonth[m] = Object.values(byMonth[m]).reduce((s, v) => s + v.count, 0);
  });

  Object.entries(cidLastMonth).forEach(([cid, { count, desc }]) => {
    const totalLast = totalByMonth[lastMonth] || 1;
    const rateLast = count / totalLast;
    const baseRates = baseMonths
      .map(m => ((byMonth[m]?.[cid]?.count || 0) / (totalByMonth[m] || 1)))
      .filter(r => r > 0);
    if (baseRates.length < Math.max(1, Math.floor(baseMonths.length / 2))) return;
    const baseline = baseRates.reduce((s, r) => s + r, 0) / baseRates.length;
    if (baseline === 0) return;
    const ratio = rateLast / baseline;
    const pctChange = Math.round((ratio - 1) * 100);
    const absChange = count - Math.round(baseline * totalLast);
    const sparkMonths = months.slice(Math.max(0, months.length - windowSize - 1));
    const sparkData = sparkMonths.map(m => byMonth[m]?.[cid]?.count || 0);
    let direction, label, confidence;
    if (ratio >= threshold) {
      direction = 'rising';
      label = `+${pctChange}%`;
      confidence = baseRates.length >= windowSize ? 'alta' : 'moderada';
    } else if (ratio <= 1 / threshold) {
      direction = 'falling';
      label = `${pctChange}%`;
      confidence = baseRates.length >= windowSize ? 'alta' : 'moderada';
    } else {
      return;
    }
    alerts.push({
      cid, desc, direction, label, pctChange, absChange,
      countLast: count, baseline: Math.round(baseline * totalLast),
      confidence, sparkData, sparkMonths,
      lastMonth, ratio
    });
  });

  const allCidsInBase = new Set(baseMonths.flatMap(m => Object.keys(byMonth[m] || {})));
  allCidsInBase.forEach(cid => {
    if (cidLastMonth[cid]) return;
    const baseRates = baseMonths
      .map(m => ((byMonth[m]?.[cid]?.count || 0) / (totalByMonth[m] || 1)))
      .filter(r => r > 0);
    if (baseRates.length < Math.ceil(baseMonths.length / 2)) return;
    const baseline = baseRates.reduce((s, r) => s + r, 0) / baseRates.length;
    if (baseline === 0) return;
    const avgCount = Math.round(baseline * (totalByMonth[lastMonth] || 1));
    if (avgCount < 3) return;
    const desc = baseMonths.map(m => byMonth[m]?.[cid]?.desc).find(Boolean) || cid;
    const sparkMonths = months.slice(Math.max(0, months.length - windowSize - 1));
    const sparkData = sparkMonths.map(m => byMonth[m]?.[cid]?.count || 0);
    alerts.push({
      cid, desc, direction: 'falling', label: '-100%', pctChange: -100,
      absChange: -avgCount, countLast: 0, baseline: avgCount,
      confidence: 'moderada', sparkData, sparkMonths,
      lastMonth, ratio: 0
    });
  });

  alerts.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  window._lastTrendAlerts = alerts;

  const note = document.getElementById('cidTrendNote');
  if (note) {
    const rising  = alerts.filter(a => a.direction === 'rising').length;
    const falling = alerts.filter(a => a.direction === 'falling').length;
    const refLabel = monthLabel(lastMonth);
    note.innerHTML = `Comparando <strong>${refLabel}</strong> com a média dos <strong>${baseMonths.length} meses</strong> anteriores.
      Limiar: variação acima de <strong>${Math.round((threshold - 1) * 100)}%</strong> da média.
      ${rising ? `<span style="color:#c8493e;font-weight:600">${rising} CID${rising > 1 ? 's' : ''} em alta</span>` : ''}
      ${rising && falling ? ' · ' : ''}
      ${falling ? `<span style="color:#38ac8b;font-weight:600">${falling} CID${falling > 1 ? 's' : ''} em queda</span>` : ''}
      ${!rising && !falling ? '<span style="color:var(--mut)">Nenhuma variação significativa encontrada.</span>' : ''}`;
  }

  renderCidTrendAlerts(alerts);
}

export function renderCidTrendAlerts(alerts) {
  const el = document.getElementById('cidTrendAlerts');
  if (!el) return;

  const filtered = _trendFilter === 'all'
    ? alerts
    : alerts.filter(a => a.direction === _trendFilter);

  if (!filtered.length) {
    el.innerHTML = '<div class="trend-empty-alert">Nenhum alerta para o filtro selecionado no período.</div>';
    return;
  }

  el.innerHTML = filtered.map(a => {
    const max = Math.max(...a.sparkData, 1);
    const bars = a.sparkData.map((v, i) => {
      const isLast = i === a.sparkData.length - 1;
      const h = Math.round((v / max) * 28) + 4;
      const color = isLast
        ? (a.direction === 'rising' ? '#c8493e' : '#38ac8b')
        : 'var(--bdr2)';
      return `<div class="trend-bar" style="height:${h}px;background:${color};opacity:${isLast ? 1 : 0.6}"></div>`;
    }).join('');

    const badgeClass = a.direction === 'rising' ? 'badge-rising' : 'badge-falling';
    const dirLabel   = a.direction === 'rising' ? 'Alta' : 'Queda';
    const absLabel   = a.absChange > 0 ? `+${a.absChange} casos` : `${a.absChange} casos`;

    return `<div class="trend-alert ${a.direction}" role="article" aria-label="Alerta CID ${a.cid}: ${dirLabel}">
      <div class="trend-alert-header">
        <span class="trend-alert-badge ${badgeClass}">${dirLabel} ${a.label}</span>
        <span class="trend-alert-cid">${esc(a.cid)}</span>
      </div>
      <div class="trend-alert-desc">${esc(a.desc)}</div>
      <div class="trend-sparkline" role="img" aria-label="Sparkline de tendência do CID ${a.cid}">${bars}</div>
      <div class="trend-alert-meta">
        <span>${monthLabel(a.lastMonth)}: <strong style="color:var(--txt)">${a.countLast} casos</strong></span>
        <span>Média anterior: <strong style="color:var(--txt)">${a.baseline} casos</strong></span>
        <span style="opacity:.7">${absLabel} · conf. ${a.confidence}</span>
      </div>
    </div>`;
  }).join('');
}

function renderCidNotificaveisInternal() {
  renderNotificaveis();
}

export function renderCruzamento() {
  const el = $('cruzamento'); if (!el) return;
  const hist = state.filt;
  if (!hist.length) { el.innerHTML = '<div class="muted mono" style="font-size:12px;padding:8px 0">Sem dados no período selecionado.</div>'; return; }
  const dpct = (a, b) => b > 0 ? ((a - b) / b * 100) : null;
  const sevCls = p => p == null ? 'muted' : Math.abs(p) > 8 ? 'erc' : Math.abs(p) > 2 ? 'wnc' : 'okc';
  const sevTag = p => p == null ? '—' : Math.abs(p) > 8 ? 'crítico' : Math.abs(p) > 2 ? 'atenção' : 'ok';
  const fdp = p => p == null ? '—' : (p > 0 ? '+' : '') + p.toFixed(1) + '%';
  const triIndep = state.triSource === 'file' || state.triSource === 'db';
  const triRows = state.triFilt && state.triFilt.length ? state.triFilt : [];
  const cidRows = state.cidFilt && state.cidFilt.length ? state.cidFilt : [];

  const meses = [...new Set(hist.map(r => r.anoMes))].sort();
  const hM = {}; meses.forEach(m => hM[m] = { tot: 0, atend: 0, tri: 0, cidUniq: new Set(), cidNoId: 0, cidTot: 0 });
  hist.forEach(r => { const o = hM[r.anoMes]; if (!o) return; o.tot++; if (r.dhAtend) o.atend++; });
  if (triIndep) triRows.forEach(r => { const o = hM[r.anoMes]; if (o) o.tri++; });
  cidRows.forEach(r => { const o = hM[r.anoMes]; if (!o) return; o.cidTot++; if (r.idAtend) o.cidUniq.add(r.idAtend); else o.cidNoId++; });

  let html = '';
  html += '<div class="mono" style="font-size:11px;color:var(--txt2);line-height:1.6;margin-bottom:12px">Totais que deveriam coincidir entre planilhas. <span class="okc">●</span> até ±2% (esperado) · <span class="wnc">●</span> ±2 a 8% (verificar período/exportação) · <span class="erc">●</span> acima de ±8% (fontes inconsistentes — não usar para relatório oficial sem investigar).</div>';

  const rowsM = meses.map(m => {
    const o = hM[m];
    const cidU = o.cidUniq.size + o.cidNoId;
    const dT = triIndep ? dpct(o.tri, o.tot) : null;
    const dC = cidRows.length ? dpct(cidU, o.atend) : null;
    return `<tr><td class="mono">${monthLabel(m)}</td>` +
      `<td class="mono">${fmt(o.tot)}</td>` +
      `<td class="mono">${triIndep ? fmt(o.tri) : '—'}</td>` +
      `<td class="mono ${sevCls(dT)}">${triIndep ? fdp(dT) + ' · ' + sevTag(dT) : '—'}</td>` +
      `<td class="mono">${fmt(o.atend)}</td>` +
      `<td class="mono">${cidRows.length ? fmt(cidU) : '—'}</td>` +
      `<td class="mono ${sevCls(dC)}">${cidRows.length ? fdp(dC) + ' · ' + sevTag(dC) : '—'}</td></tr>`;
  }).join('');
  html += '<div class="table-wrap"><table class="table"><thead><tr><th>Mês</th><th>Triados (histórico)</th><th>Triagens (planilha)</th><th>Δ triagem</th><th>Atend. médicos (histórico)</th><th>Atend. com CID</th><th>Δ CID</th></tr></thead><tbody>' + rowsM + '</tbody></table></div>';

  if (triIndep && triRows.length) {
    const CORES = ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL', 'BRANCO'];
    const hC = {}, tC = {}; CORES.forEach(c => { hC[c] = 0; tC[c] = 0; });
    let hOut = 0, tOut = 0;
    hist.forEach(r => { if (hC[r.cor] != null) hC[r.cor]++; else hOut++; });
    triRows.forEach(r => { if (tC[r.cor] != null) tC[r.cor]++; else tOut++; });
    const rowsC = CORES.filter(c => hC[c] > 0 || tC[c] > 0).map(c => {
      const dC = dpct(tC[c], hC[c]);
      return `<tr><td class="mono" style="color:${RISK_COLOR[c] || 'var(--txt)'}">${c}</td><td class="mono">${fmt(hC[c])}</td><td class="mono">${fmt(tC[c])}</td><td class="mono ${sevCls(dC)}">${fdp(dC)} · ${sevTag(dC)}</td></tr>`;
    }).join('');
    const outRow = (hOut || tOut) ? `<tr><td class="mono muted">sem cor / inválida</td><td class="mono muted">${fmt(hOut)}</td><td class="mono muted">${fmt(tOut)}</td><td class="mono muted">—</td></tr>` : '';
    html += '<div style="margin-top:14px"><div class="card-title" style="margin-bottom:8px">Distribuição por cor — histórico × planilha de triagem (período filtrado)</div><div class="table-wrap"><table class="table"><thead><tr><th>Cor</th><th>Histórico</th><th>Planilha triagem</th><th>Δ</th></tr></thead><tbody>' + rowsC + outRow + '</tbody></table></div></div>';
  } else {
    html += '<div class="mono wnc" style="font-size:11px;margin-top:12px;line-height:1.6">⚠ Planilha de triagem não carregada — triagens exibidas acima derivam do próprio histórico (comparação tautológica, sem valor de verificação). Carregue o relatório de triagem para cruzar as fontes de forma independente.</div>';
  }
  if (!cidRows.length) {
    html += '<div class="mono muted" style="font-size:11px;margin-top:8px">Planilha de CID não carregada — coluna de CID indisponível.</div>';
  } else {
    const semId = meses.reduce((a, m) => a + hM[m].cidNoId, 0);
    if (semId > 0) html += `<div class="mono muted" style="font-size:11px;margin-top:8px">${fmt(semId)} registros de CID sem nº de atendimento — contados individualmente (podem inflar o total se houver mais de um CID por atendimento).</div>`;
  }
  el.innerHTML = html;
}
