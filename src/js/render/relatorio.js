// render/relatorio.js — Relatorio pane rendering
import { state } from '../state.js';
import { $, esc, fmt, fmtN, pct } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { monthlyStats } from '../metrics/monthly.js';
import { returns72 } from '../metrics/returns.js';
import { evasaoDisponivel } from '../metrics/med.js';
import { DOW } from '../constants.js';

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }

function dateRange() {
  const s = document.getElementById('dateStart')?.value;
  const e = document.getElementById('dateEnd')?.value;
  return { s: s ? new Date(s + 'T00:00:00') : null, e: e ? new Date(e + 'T23:59:59') : null };
}

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
  return Object.values(map).map(x => ({ ...x, n: x.rows.length, triAvg: avg(x.tri, v => v), medAvg: avg(x.med, v => v), totAvg: avg(x.tot, v => v) }));
}

function topAlerts(d) {
  const alerts = [];
  const n = d.length || 1;
  const tMed = d.filter(r => r.tEspMed != null);
  const avgMed = tMed.length ? tMed.reduce((s, r) => s + r.tEspMed, 0) / tMed.length : null;
  const metaMed = meta('metaMed');
  const metaRet = meta('metaRet');
  const { ret } = returns72();
  const retRate = n > 0 ? ret.length / n * 100 : 0;
  if (avgMed != null && avgMed > metaMed) alerts.push(['err', 'Espera médica acima da meta', `${Math.round(avgMed)} min (meta ${metaMed} min) — ${tMed.length} atendimentos com dado`]);
  if (retRate > metaRet) alerts.push(['err', 'Retorno ≤72h acima da meta', `${retRate.toFixed(1)}% (meta ${metaRet}%) — ${ret.length} retornos`]);
  const vermelho = d.filter(r => r.cor === 'VERMELHO' && r.tEspMed != null && r.tEspMed > 10);
  if (vermelho.length > 0) alerts.push(['err', 'VERMELHO com espera > 10 min', `${vermelho.length} caso(s) — protocolo Manchester violado`]);
  const semProf = d.filter(r => !r.prof).length;
  if (semProf / n > 0.05) alerts.push(['warn', 'Alta taxa de médico não identificado', `${semProf} registros sem médico (${(semProf / n * 100).toFixed(1)}%)`]);
  const semCor = d.filter(r => !r.cor || r.cor === 'SEM CLASSIFICACAO').length;
  if (semCor / n > 0.03) alerts.push(['warn', 'Alta taxa sem classificação de risco', `${semCor} registros (${(semCor / n * 100).toFixed(1)}%)`]);
  return alerts;
}

function buildReportText() {
  const { s, e } = dateRange(), d = state.filt, m = monthlyStats(d), { ret } = returns72(), alerts = topAlerts(d);
  const days = new Set(d.map(r => r.dateKey)).size, tTri = avg(d, r => r.tEspTri), tMed = avg(d, r => r.tEspMed), tTot = avg(d, r => r.tTotal);
  const buckets = hourBuckets(d), topVol = [...buckets].sort((a, b) => b.n - a.n)[0];
  const medPicosRel = d.filter(r => r.tEspMed != null);
  const medPicoMaxRel = medPicosRel.length ? medPicosRel.reduce((m, r) => r.tEspMed > m.tEspMed ? r : m) : null;
  const picoLabelRel = r => r && r.dh ? r.dh.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + String(r.dh.getHours()).padStart(2, '0') + 'h' : '-';
  const medLine = medPicoMaxRel ? `pico de ${Math.round(medPicoMaxRel.tEspMed)} min em ${picoLabelRel(medPicoMaxRel)}` : 'sem dados suficientes';
  const volLine = topVol ? `${DOW[topVol.diaSem]} ${topVol.hora}h, com ${topVol.n} atendimentos` : 'sem dados suficientes';
  const turnoLabel = { all: 'Todos os turnos', D: 'Diurno', N: 'Noturno' }[document.getElementById('turno')?.value] || 'Todos';
  const medLabel = (() => { const el = document.getElementById('filtroMedico'); const v = el ? el.value.trim() : ''; return v ? `Médico: ${v}` : 'Todos os médicos'; })();
  const riscoLabel = (() => { const el = document.getElementById('filtroRisco'); return el && el.value !== 'all' ? `Risco: ${el.value}` : 'Todos os riscos'; })();
  const ev = d.filter(r => r.evadido).length;
  const evRate = d.length ? fmtN(ev / d.length * 100, 1) : '0';
  const _evasaoDispRel = evasaoDisponivel(d);
  const evasaoLinha = _evasaoDispRel
    ? `\nEvasão: ${fmt(ev)} saídas sem atendimento (${evRate}% do período${ev > 0 ? ', acima de 2% merece atenção' : ''}).`
    : '\nEvasão: não rastreada neste relatório — o arquivo exportado contém apenas atendimentos concluídos. Para obter esse dado, exportar relatório de saídas/evasões separado do sistema.';
  const uniteName = (typeof UC !== 'undefined' && UC?.nome) || 'Unidade de Saúde';
  return `RELATÓRIO GERENCIAL - ${uniteName}\nPeríodo: ${s ? s.toLocaleDateString('pt-BR') : '-'} a ${e ? e.toLocaleDateString('pt-BR') : '-'}\nFiltros: ${turnoLabel} | ${medLabel} | ${riscoLabel}\n\nNo período analisado, a unidade realizou ${fmt(d.length)} atendimentos em ${fmt(days)} dias, com média diária de ${days ? fmt(Math.round(d.length / days)) : '-'} atendimentos. O tempo médio de espera para triagem foi ${tTri == null ? '-' : Math.round(tTri) + ' min'}, a espera média para atendimento médico foi ${tMed == null ? '-' : Math.round(tMed) + ' min'} e o tempo médio recepção-alta foi ${tTot == null ? '-' : Math.round(tTot) + ' min'}.${evasaoLinha}\n\nRetornos: foram identificados ${fmt(ret.length)} retornos em até 72h, correspondendo a ${ret.length && d.length ? pct(ret.length, d.length) : '0%'} dos atendimentos. A meta configurada é inferior a ${meta('metaRet')}%. \n\nPrincipais gargalos:\n- Maior espera médica: ${medLine}.\n- Maior volume horario: ${volLine}.\n\nPontos de atenção:\n${alerts.slice(0, 5).map((a, i) => `${i + 1}. ${a[1]} - ${a[2]}`).join('\n')}\n\nLeitura gerencial sugerida:\n${(tMed != null && tMed > meta('metaMed')) ? 'A espera médica está acima da meta e deve ser priorizada na revisão de fluxo e escala.' : 'A espera médica está dentro ou próxima da meta configurada.'} ${(ret.length / d.length * 100) > meta('metaRet') ? 'A taxa de retorno em até 72h esta acima da meta e merece revisao clinico-assistencial dos casos recorrentes.' : 'A taxa de retorno em até 72h nao ultrapassou a meta configurada.'} ${(m.length >= 2) ? 'Comparar mensalmente esses indicadores ajuda a identificar piora precoce e justificar intervenções.' : ''}`;
}

export function renderRelatorio() {
  const el = $('reportText');
  if (el) el.value = buildReportText();
}

export function renderPrintCover() {
  const { s, e } = dateRange(), d = state.filt, alerts = topAlerts(d), tMed = avg(d, r => r.tEspMed), tTri = avg(d, r => r.tEspTri), tTot = avg(d, r => r.tTotal);
  const printCover = $('printCover');
  if (!printCover) return;
  printCover.innerHTML = `<h2>V.I.D.A. — Relatório Assistencial</h2>
    <p class="mono" id="printUnit"></p>
    <p class="mono">Período: ${s ? s.toLocaleDateString('pt-BR') : '-'} até ${e ? e.toLocaleDateString('pt-BR') : '-'} - ${fmt(d.length)} atendimentos</p>
    <p class="mono">Arquivo histórico: ${esc(state.files.hist || '-')} | Triagem: ${state.triSource === 'file' ? esc(state.files.tri) : state.triSource === 'hist' ? 'derivada do histórico' : 'não carregada'} | CID: ${esc(state.files.cid || 'não carregado')}</p>
    <p class="mono">Resumo: triagem ${tTri == null ? '-' : Math.round(tTri) + ' min'}; médico ${tMed == null ? '-' : Math.round(tMed) + ' min'}; total ${tTot == null ? '-' : Math.round(tTot) + ' min'}.</p>
    <p class="mono">Prioridade principal: ${esc(alerts[0]?.[1] || 'Sem alerta crítico')} - ${esc(alerts[0]?.[2] || '')}</p>`;
}
