// render/exames.js — Exames pane rendering
import { state } from '../state.js';
import { $, esc, fmt, pct, norm, shortName, kpi } from '../utils/dom.js';
import { chart, chartSortedHbar, gridColor, tickColor, axes } from '../ui/charts.js';

function grupoExame(n) {
  n = n.toUpperCase();
  if (/TROPONINA|CREATINOFOSFOQUINASE|CPK|CK-MB/.test(n)) return 'Cardíaco';
  if (/HEMOGRAMA|LEUCOCIT|PLAQUETA|ERITROCIT/.test(n)) return 'Hematologia';
  if (/PCR|PROTEINA C|VHS/.test(n)) return 'Inflamatório';
  if (/CREATININA|UREIA|TFG/.test(n)) return 'Renal';
  if (/TGO|TGP|BILIRRUB|GAMA GT|FOSFATASE|AMILASE|LIPASE/.test(n)) return 'Hepático/Pancreático';
  if (/SODIO|POTASSIO|CLORO|CALCIO|MAGNESIO|FOSFORO/.test(n)) return 'Eletrólitos';
  if (/GLICOSE|HBA1C|INSULINA|LACTATO/.test(n)) return 'Metabólico';
  if (/URINA|GRAM DE GOTA|UROCULTURA/.test(n)) return 'Urinário';
  if (/PROTROMBINA|TROMBOPLASTINA|RNI|FIBRINOG|PTT/.test(n)) return 'Coagulação';
  if (/TSH|T3|T4|TIREOIDE/.test(n)) return 'Tireoide';
  return 'Outros';
}

export function renderExames() {
  const emEl = $('examesEmpty'), ctEl = $('examesContent');
  if (!state.examesRaw.length) {
    if (emEl) emEl.classList.remove('hidden');
    if (ctEl) ctEl.classList.add('hidden');
    return;
  }
  if (emEl) emEl.classList.add('hidden');
  if (ctEl) ctEl.classList.remove('hidden');

  const recs = state.examesRaw;
  const totGuias = recs.length;
  const totEx = recs.reduce((s, r) => s + r.n_exames, 0);
  const totVal = recs.reduce((s, r) => s + r.valor, 0);

  const byDoc = {};
  recs.forEach(r => {
    const k = r.doctor || 'SEM MÉDICO';
    if (!byDoc[k]) byDoc[k] = { guias: 0, exames: 0, valor: 0, exsList: [] };
    byDoc[k].guias++; byDoc[k].exames += r.n_exames; byDoc[k].valor += r.valor;
    byDoc[k].exsList.push(...r.exames);
  });
  const ranking = Object.entries(byDoc)
    .filter(([k]) => k !== 'SEM MÉDICO')
    .map(([doc, s]) => ({
      doc, guias: s.guias, exames: s.exames, valor: s.valor,
      mediaGuia: s.guias ? +(s.exames / s.guias).toFixed(1) : 0,
      custoGuia: s.guias ? +(s.valor / s.guias).toFixed(2) : 0,
      alerta: s.guias ? s.exames / s.guias > 9 : false,
      pctVal: totVal ? +(s.valor / totVal * 100).toFixed(1) : 0,
      vivverAtend: 0, pctSolicit: null, custoPorAtend: null
    }))
    .sort((a, b) => b.guias - a.guias);

  const hasVivver = state.filt.length > 0;
  if (hasVivver) {
    const vByDoc = {};
    state.filt.forEach(r => { if (!r.prof) return; const k = norm(r.prof); vByDoc[k] = (vByDoc[k] || 0) + 1; });
    ranking.forEach(r => {
      r.vivverAtend = vByDoc[norm(r.doc)] || 0;
      if (r.vivverAtend > 0) {
        r.pctSolicit = +(r.guias / r.vivverAtend * 100).toFixed(1);
        r.custoPorAtend = +(r.valor / r.vivverAtend).toFixed(2);
      }
    });
    const note = $('examesCrossNote');
    if (note) {
      const vPer = state.raw.length ? (
        new Date(state.raw[0].dh).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) + ' – ' +
        new Date(state.raw[state.raw.length - 1].dh).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      ) : '?';
      note.innerHTML = '⚠ Cruzamento ativo: Vivver (' + vPer + ') × Autolac (' + (state.examesMeta?.periodo || '?') + ') | Colunas % Solic. e R$/atend. normalizam o volume de exames pelo total de atendimentos do médico no Vivver.';
      note.classList.remove('hidden');
    }
  }

  const totMed = ranking.length;
  const mediaGlobal = totGuias ? +(totEx / totGuias).toFixed(1) : 0;
  $('kpisExames').innerHTML = [
    kpi('Guias processadas', fmt(totGuias), state.examesMeta?.periodo || 'período', '#1357a6'),
    kpi('Total de exames', fmt(totEx), state.examesMeta?.prestador || 'laboratório', '#38ac8b'),
    kpi('Valor total', 'R$ ' + totVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 'custo com exames', '#7b61c4'),
    kpi('Médicos solicitantes', fmt(totMed), 'com guias no período', '#e8a93b'),
    kpi('Média exames/guia', String(mediaGlobal), mediaGlobal > 9 ? '⚠ acima de 9 — revisar' : '≤ 9 dentro do esperado', mediaGlobal > 9 ? '#c8493e' : '#4aa3c9'),
    kpi('Custo médio/guia', 'R$ ' + (totVal / totGuias).toFixed(2), 'por atendimento com exame', '#e8a93b')
  ].join('');

  const exCnt = {};
  recs.forEach(r => r.exames.forEach(e => { exCnt[e] = (exCnt[e] || 0) + 1; }));
  const topEx = Object.entries(exCnt).sort((a, b) => b[1] - a[1]).slice(0, 12).reverse();
  chart('chartExamesTop', { type: 'bar', data: { labels: topEx.map(([n]) => n.length > 28 ? n.slice(0, 26) + '…' : n), datasets: [{ label: 'Solicitações', data: topEx.map(([, v]) => v), backgroundColor: '#1357a6', borderRadius: 3 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });

  const gpCnt = {};
  recs.forEach(r => r.exames.forEach(e => { const g = grupoExame(e); gpCnt[g] = (gpCnt[g] || 0) + 1; }));
  const gpArr = Object.entries(gpCnt).sort((a, b) => b[1] - a[1]);
  const gpColors = ['#185FA5', '#1D9E75', '#BA7517', '#A32D2D', '#534AB7', '#0F6E56', '#993C1D', '#3B6D11', '#888780', '#442C89'];
  if (gpArr.length > 4) {
    chartSortedHbar('chartExamesGrupos', gpArr, { colors: gpColors });
  } else {
    chart('chartExamesGrupos', { type: 'doughnut', data: { labels: gpArr.map(([n]) => n), datasets: [{ data: gpArr.map(([, v]) => v), backgroundColor: gpColors, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor(), usePointStyle: true, font: { size: 10 } } } } } });
  }

  const maxG = ranking[0]?.guias || 1;
  const crossTh = hasVivver ? `<th title="Atendimentos no histórico Vivver">Atend. Vivver</th><th title="% pacientes com exame solicitado">% Solic.</th><th title="Custo de exames por atendimento">R$/atend.</th>` : '';
  $('tableExames').innerHTML = `<thead><tr><th>#</th><th>Médico</th><th>Guias</th><th>Exames</th><th>Méd./guia</th><th>Valor</th><th>% total</th><th>R$/guia</th>${crossTh}<th>Vol.</th></tr></thead><tbody>` +
    ranking.map((r, i) => {
      const pctBar = Math.round(r.guias / maxG * 100);
      const bc = r.alerta ? '#c8493e' : r.mediaGuia > 8 ? '#e8a93b' : '#1357a6';
      const mgStyle = r.alerta ? 'color:#c8493e;font-weight:700' : r.mediaGuia > 8 ? 'color:#e8a93b' : '';
      const alertBadge = r.alerta ? ` <span style="font-size:9px;background:#FCEBEB;color:#A32D2D;padding:2px 5px;border-radius:99px">⚠ alto</span>` : '';
      const crossTds = hasVivver ? `<td class="mono">${r.vivverAtend > 0 ? fmt(r.vivverAtend) : '—'}</td><td class="mono ${r.pctSolicit != null && r.pctSolicit > 30 ? 'erc' : r.pctSolicit != null && r.pctSolicit > 20 ? 'wnc' : ''}">${r.pctSolicit != null ? r.pctSolicit + '%' : '—'}</td><td class="mono">${r.custoPorAtend != null ? 'R$ ' + r.custoPorAtend.toFixed(2) : '—'}</td>` : '';
      return `<tr><td class="mono muted">${i + 1}</td><td style="font-weight:600">${esc(shortName(r.doc))}${alertBadge}</td><td class="mono">${r.guias}</td><td class="mono">${fmt(r.exames)}</td><td class="mono" style="${mgStyle}">${r.mediaGuia}</td><td class="mono">R$ ${r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="mono muted">${r.pctVal}%</td><td class="mono">R$ ${r.custoGuia.toFixed(2)}</td>${crossTds}<td><div style="background:var(--bdr);border-radius:2px;height:4px;width:70px"><div style="width:${pctBar}%;height:4px;border-radius:2px;background:${bc}"></div></div></td></tr>`;
    }).join('') + `</tbody>`;

  const vEl = $('examesValidacao');
  if (vEl && state.examesMeta?.validacao) {
    const v = state.examesMeta.validacao;
    vEl.textContent = 'Validação: ' + fmt(v.guias) + ' guias • ' + fmt(v.exames) + ' exames • R$ ' + v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' calculados | PDF oficial: conferir totais na última página';
  }
}
