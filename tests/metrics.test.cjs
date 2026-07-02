#!/usr/bin/env node
/**
 * V.I.D.A. — Testes de métricas
 * Valida valores calculados (não só ausência de crash).
 *
 * Cobre os 9 casos edge prioritários do plano A+C:
 *   1. tEspMed usa p[18], não dhAtend−dhAcol
 *   2. Teto 720 min (era 200 — bug v3.3.0)
 *   3. returns72 virada de mês
 *   4. returns72 taxa = eventos ÷ atendimentos
 *   5. monthlyStats campos k/vol/medOk/medN
 *   6. monthlyStats usa metaManchester por cor, não meta global
 *   7. dateKey plantão noturno (00h–06h → dia anterior)
 *   8. prevVal com período anterior com <50% meses → null
 *   9. evasaoDisponivel com/sem tipo_entrada
 *  10. monthReturnRate — retorno 31/mai→02/jun conta em jun, não em mai
 *  11. manchesterConformidade — thresholds e split D/N corretos
 *  12. calcProjecao — mês incompleto projeta, mês completo retorna null
 *  13. calcularPontos — pontuação por cor e faixa etária correta
 *
 * Uso: node tests/metrics.test.js
 */
const { buildHtml, report } = require('./helpers.cjs');
const { JSDOM } = require('jsdom');

let html = buildHtml();

// ─── Helpers compartilhados com o script de teste ──────────────────────────
// makeHistRow monta uma linha CSV no formato positional do Vivver (29 campos, sep=;)
// índices relevantes:
//   [3]=cor  [5]=pront  [6]=paciente  [7]=idade  [8]=tipo_entrada
//   [9]=dh_recepcao  [10]=dh_acolhimento  [11]=dh_atendimento
//   [15]=nomprofissional  [16]=recepcao_triagem  [17]=triagem_duracao
//   [18]=triagem_atendimento(tEspMed)  [19]=tempo_consulta  [20]=recepcao_alta
const HEADER = 'h0;h1;h2;cor;h4;pront;paciente;idade;tipo;dh_rec;dh_acol;dh_atend;h12;h13;h14;prof;tEspTri;tDurTri;tEspMed;tConsulta;tTotal;h21;h22;h23;h24;h25;h26;h27;h28';

const TESTS_SCRIPT = `<script>
window.__results = [];
function __ok(name)       { window.__results.push([name, 'ok']); }
function __fail(name, msg){ window.__results.push([name, 'ERRO: ' + String(msg)]); }

function makeHistRow(opts) {
  opts = opts || {};
  var p = Array(29).fill('');
  p[3]  = opts.cor    || 'AMARELO';
  p[5]  = opts.pront  || 'P001';
  p[6]  = opts.paciente || 'PACIENTE TESTE';
  p[7]  = opts.idade  || '30';
  p[8]  = opts.tipo   || 'NORMAL COM TRIAGEM';
  p[9]  = opts.dh     || '01/05/2026 10:00';
  p[10] = opts.dhAcol || '01/05/2026 10:10';
  p[11] = opts.dhAtend|| '01/05/2026 11:09';
  p[15] = opts.prof   || 'DR TESTE';
  p[16] = opts.tEspTri  || '00:10:00';
  p[17] = opts.tDurTri  || '00:10:00';
  p[18] = opts.tEspMedRaw !== undefined ? opts.tEspMedRaw : '00:45:00';
  p[19] = opts.tConsulta || '00:15:00';
  p[20] = opts.tTotal    || '01:00:00';
  return p.join(';');
}

var HIST_HDR = '${HEADER}';

// ─── Caso 1: tEspMed usa p[18] quando disponível ─────────────────────────
try {
  // p[18]="00:45:00" (45 min); dhAtend-dhAcol=59 min → tEspMed DEVE ser 45, não 59
  var csv1 = [HIST_HDR, makeHistRow({
    tEspMedRaw: '00:45:00',
    dhAcol:  '01/05/2026 10:00',
    dhAtend: '01/05/2026 10:59'
  })].join('\\n');
  var r1 = parseHistLegacy(csv1);
  if (!r1.data.length) throw new Error('nenhuma linha parseada');
  var got1 = r1.data[0].tEspMed;
  if (got1 !== 45) throw new Error('esperado 45, obtido ' + got1 + ' (usa dhAtend−dhAcol em vez de p[18])');
  __ok('tEspMed — usa p[18], não dhAtend−dhAcol');
} catch(e) { __fail('tEspMed — usa p[18], não dhAtend−dhAcol', e.message); }

// ─── Caso 1b: fallback quando p[18] está vazio ───────────────────────────
try {
  // p[18]="" → fallback: (dhAtend−dhAcol) − tDurTri = 59min − 10min = 49min
  var csv1b = [HIST_HDR, makeHistRow({
    tEspMedRaw: '',
    dhAcol:  '01/05/2026 10:00',
    dhAtend: '01/05/2026 10:59',
    tDurTri: '00:10:00'
  })].join('\\n');
  var r1b = parseHistLegacy(csv1b);
  if (!r1b.data.length) throw new Error('nenhuma linha parseada');
  var got1b = r1b.data[0].tEspMed;
  // fallback = (59) - 10 = 49 min
  if (got1b === null || Math.abs(got1b - 49) > 1) throw new Error('fallback esperado ~49, obtido ' + got1b);
  __ok('tEspMed — fallback (dhAtend−dhAcol)−tDurTri quando p[18] vazio');
} catch(e) { __fail('tEspMed — fallback (dhAtend−dhAcol)−tDurTri quando p[18] vazio', e.message); }

// ─── Caso 2: teto 720 min ────────────────────────────────────────────────
try {
  if (CONFIG.MAX_MINUTES !== 720) throw new Error('CONFIG.MAX_MINUTES esperado 720, obtido ' + CONFIG.MAX_MINUTES);
  // 800 min → null (acima do teto)
  var t800 = safeMinutes(800, CONFIG.MAX_MINUTES);
  if (t800 !== null) throw new Error('800 min deveria ser null, obtido ' + t800);
  // 719 min → 719 (abaixo do teto)
  var t719 = safeMinutes(719, CONFIG.MAX_MINUTES);
  if (t719 !== 719) throw new Error('719 min deveria ser 719, obtido ' + t719);
  // 720 min → null (limite é exclusivo: v < max)
  var t720 = safeMinutes(720, CONFIG.MAX_MINUTES);
  if (t720 !== null) throw new Error('720 min deveria ser null (exclusivo), obtido ' + t720);
  // Regressão: com teto antigo de 200 min, 250 min virava null
  var t250 = safeMinutes(250, CONFIG.MAX_MINUTES);
  if (t250 !== 250) throw new Error('250 min deveria passar com teto 720, obtido ' + t250);
  __ok('tEspMed — teto 720 min (bug: era 200)');
} catch(e) { __fail('tEspMed — teto 720 min (bug: era 200)', e.message); }

// ─── Caso 3: returns72 — virada de mês ──────────────────────────────────
try {
  // Visita 31/mai 20:00 → retorno 02/jun 10:00 = 38h (≤72h) → DEVE contar
  var dh3a = new Date(2026, 4, 31, 20, 0);  // mai
  var dh3b = new Date(2026, 5,  2, 10, 0);  // jun — 38h depois
  var rows3 = [
    {pront:'P999', dh: dh3a, dateKey:'2026-05-31', anoMes:202605},
    {pront:'P999', dh: dh3b, dateKey:'2026-06-02', anoMes:202606}
  ];
  var res3 = returnsFor(rows3);
  if (res3.ret.length !== 1) throw new Error('esperado 1 retorno, obtido ' + res3.ret.length);
  var diffH3 = (dh3b - dh3a) / 36e5;
  if (Math.abs(res3.ret[0].diffH - diffH3) > 0.01) throw new Error('diffH incorreto: ' + res3.ret[0].diffH);
  // retorno indexa anoMes da VISITA DE RETORNO (jun), não da original
  if (res3.ret[0].anoMes !== 202606) throw new Error('anoMes esperado 202606, obtido ' + res3.ret[0].anoMes);
  __ok('returns72 — virada de mês (mai→jun) conta corretamente');
} catch(e) { __fail('returns72 — virada de mês (mai→jun) conta corretamente', e.message); }

// ─── Caso 4: returns72 — taxa = eventos ÷ atendimentos ──────────────────
try {
  // P100 faz 3 visitas em sequência (cada par ≤ 72h) → gera 2 eventos de retorno
  // Taxa = 2/102, NÃO 1/102 (paciente único)
  var rows4 = [];
  var baseTime4 = new Date(2026, 4, 1, 10, 0).getTime();
  for (var i4 = 1; i4 < 100; i4++) {
    rows4.push({pront: 'P' + String(i4).padStart(3,'0'), dh: new Date(baseTime4 + i4*24*36e5), anoMes:202605});
  }
  var t0 = new Date(2026, 4, 15, 8, 0);
  rows4.push({pront:'P100', dh: t0,                               anoMes:202605});
  rows4.push({pront:'P100', dh: new Date(t0.getTime() + 24*36e5), anoMes:202605});
  rows4.push({pront:'P100', dh: new Date(t0.getTime() + 48*36e5), anoMes:202605});

  var res4 = returnsFor(rows4);
  var p100ret = res4.ret.filter(function(r){return r.pront==='P100';});
  if (p100ret.length !== 2) throw new Error('P100 deveria ter 2 retornos, obtido ' + p100ret.length);
  var taxa4 = res4.ret.length / rows4.length * 100;
  var unicoPct = 1 / rows4.length * 100;
  if (Math.abs(taxa4 - unicoPct) < 0.001) throw new Error('taxa igual à de paciente único — conta pacientes, não eventos');
  if (taxa4 <= 0 || taxa4 > 100) throw new Error('taxa fora de 0–100: ' + taxa4);
  __ok('returns72 — taxa conta eventos, não pacientes únicos');
} catch(e) { __fail('returns72 — taxa conta eventos, não pacientes únicos', e.message); }

// ─── Caso 5: monthlyStats — campos obrigatórios ──────────────────────────
try {
  var rows5 = [
    {anoMes:202605, tEspTri:10, tEspMed:30, tTotal:60, cor:'AMARELO'},
    {anoMes:202605, tEspTri:12, tEspMed:50, tTotal:80, cor:'LARANJA'},
    {anoMes:202606, tEspTri:8,  tEspMed:20, tTotal:50, cor:'VERDE'}
  ];
  var stats5 = monthlyStats(rows5);
  if (!Array.isArray(stats5) || stats5.length !== 2) throw new Error('esperado 2 meses, obtido ' + stats5.length);
  var required5 = ['k','vol','medOk','medN','triOk','triN','medAvg','triAvg','totAvg'];
  required5.forEach(function(f){ if(!(f in stats5[0])) throw new Error('campo ausente: ' + f); });
  if (stats5[0].k !== 202605) throw new Error('k errado: ' + stats5[0].k);
  if (stats5[0].vol !== 2)    throw new Error('vol errado: ' + stats5[0].vol);
  if (stats5[1].k !== 202606) throw new Error('segundo k errado: ' + stats5[1].k);
  __ok('monthlyStats — campos k/vol/medOk/medN/triOk/triN presentes');
} catch(e) { __fail('monthlyStats — campos k/vol/medOk/medN/triOk/triN presentes', e.message); }

// ─── Caso 6: monthlyStats usa metaManchester por cor ─────────────────────
try {
  // VERMELHO: meta = 0 min → tEspMed=1 é fora da meta (medOk=0)
  // VERDE:    meta = 120 min → tEspMed=1 está dentro da meta (medOk=1)
  var rows6 = [
    {anoMes:202605, tEspTri:5, tEspMed:1, tTotal:30, cor:'VERMELHO'},
    {anoMes:202605, tEspTri:5, tEspMed:1, tTotal:30, cor:'VERDE'}
  ];
  var stats6 = monthlyStats(rows6);
  if (!stats6.length) throw new Error('sem dados');
  if (stats6[0].medOk !== 1) throw new Error('medOk esperado 1 (VERDE na meta), obtido ' + stats6[0].medOk);
  if (stats6[0].medN  !== 2) throw new Error('medN esperado 2, obtido ' + stats6[0].medN);
  __ok('monthlyStats — usa metaManchester por cor (não meta global)');
} catch(e) { __fail('monthlyStats — usa metaManchester por cor (não meta global)', e.message); }

// ─── Caso 7: dateKey — plantão noturno ───────────────────────────────────
try {
  // Atendimento às 02:30 → turno N, madrugada < 06h → dateKey = dia anterior
  var csv7 = [HIST_HDR, makeHistRow({
    dh:      '02/06/2026 02:30',
    dhAcol:  '02/06/2026 02:35',
    dhAtend: '02/06/2026 03:10',
    tEspMedRaw: '00:35:00'
  })].join('\\n');
  var r7 = parseHistLegacy(csv7);
  if (!r7.data.length) throw new Error('nenhuma linha parseada');
  var row7 = r7.data[0];
  // dh real = 2026-06-02 02:30, dateKey DEVE ser 2026-06-01 (dia anterior)
  if (row7.dateKey !== '2026-06-01') throw new Error('dateKey esperado 2026-06-01, obtido ' + row7.dateKey);
  if (row7.turno !== 'N') throw new Error('turno esperado N, obtido ' + row7.turno);
  // anoMes ainda é junho (o ajuste move só o dia, não o mês neste caso)
  if (row7.anoMes !== 202606) throw new Error('anoMes esperado 202606, obtido ' + row7.anoMes);
  __ok('dateKey — madrugada 02:30 → dia anterior (plantão noturno)');
} catch(e) { __fail('dateKey — madrugada 02:30 → dia anterior (plantão noturno)', e.message); }

// ─── Caso 7b: dia às 10h não é ajustado ─────────────────────────────────
try {
  var csv7b = [HIST_HDR, makeHistRow({dh:'15/05/2026 10:00'})].join('\\n');
  var r7b = parseHistLegacy(csv7b);
  if (!r7b.data.length) throw new Error('nenhuma linha parseada');
  if (r7b.data[0].dateKey !== '2026-05-15') throw new Error('dateKey errado: ' + r7b.data[0].dateKey);
  if (r7b.data[0].turno !== 'D') throw new Error('turno esperado D, obtido ' + r7b.data[0].turno);
  __ok('dateKey — horário diurno não é ajustado');
} catch(e) { __fail('dateKey — horário diurno não é ajustado', e.message); }

// ─── Caso 8: prevVal — período anterior insuficiente → null ──────────────
try {
  var manyRows = Array.from({length:100}, function(_,i){ return {anoMes:202601+i}; });
  // Normal: curMonths=4, prevMonths=4, 100 rows → retorna o valor
  var v8a = prevVal(50, manyRows, 4, 4);
  if (v8a !== 50) throw new Error('caso normal deveria retornar 50, obtido ' + v8a);
  // prevMonths < curMonths*0.5 → null
  var v8b = prevVal(50, manyRows, 4, 1);  // 1 < 4*0.5=2
  if (v8b !== null) throw new Error('prevMonths=1 deveria ser null, obtido ' + v8b);
  // val null → sempre null
  var v8c = prevVal(null, manyRows, 4, 4);
  if (v8c !== null) throw new Error('val=null deveria ser null, obtido ' + v8c);
  // prevRows muito pequeno (< curMonths*10 = 40) → null
  var fewRows = Array.from({length:5}, function(){return {};});
  var v8d = prevVal(50, fewRows, 4, 4);
  if (v8d !== null) throw new Error('5 rows (< 40) deveria ser null, obtido ' + v8d);
  __ok('prevVal — período anterior <50% meses ou rows insuficiente → null');
} catch(e) { __fail('prevVal — período anterior <50% meses ou rows insuficiente → null', e.message); }

// ─── Caso 9: evasaoDisponivel ────────────────────────────────────────────
try {
  // Com campo evadido=true → true
  var e9a = evasaoDisponivel([{evadido:true, tipo:'NORMAL COM TRIAGEM'}]);
  if (!e9a) throw new Error('deveria ser true com evadido=true');
  // Com tipo contendo keyword "EVASAO" → true
  var e9b = evasaoDisponivel([{evadido:false, tipo:'EVASAO'}]);
  if (!e9b) throw new Error('deveria ser true com tipo="EVASAO"');
  // Keyword parcial "evad" → true
  var e9c = evasaoDisponivel([{evadido:false, tipo:'SAIDA POR EVASÃO'}]);
  if (!e9c) throw new Error('deveria ser true com tipo="SAIDA POR EVASÃO"');
  // Sem nenhum indicador → false
  var e9d = evasaoDisponivel([{evadido:false, tipo:'NORMAL COM TRIAGEM'}]);
  if (e9d) throw new Error('deveria ser false sem indicador de evasão');
  // Array vazio → false
  var e9e = evasaoDisponivel([]);
  if (e9e) throw new Error('deveria ser false com array vazio');
  __ok('evasaoDisponivel — detecta com/sem campo tipo_entrada');
} catch(e) { __fail('evasaoDisponivel — detecta com/sem campo tipo_entrada', e.message); }

// ─── Caso 10: monthReturnRate — virada de mês ────────────────────────────
try {
  // P999: visita 31/mai → retorno 02/jun (38h depois, ≤72h)
  // monthReturnRate(state.filt, 202605) deve ser 0  — o evento de retorno é em JUNHO
  // monthReturnRate(state.filt, 202606) deve ser 100% — a única row de junho É o retorno
  var dh_mai = new Date(2026, 4, 31, 20, 0);
  var dh_jun = new Date(2026, 5,  2, 10, 0);  // 38h depois
  state.raw = [
    {pront:'P999', dh:dh_mai, dateKey:'2026-05-31', anoMes:202605, tEspMed:30, tEspTri:5, tTotal:60, cor:'VERDE',   turno:'N'},
    {pront:'P999', dh:dh_jun, dateKey:'2026-06-02', anoMes:202606, tEspMed:25, tEspTri:5, tTotal:55, cor:'VERDE',   turno:'D'},
    {pront:'P001', dh:new Date(2026,4,15,10,0), dateKey:'2026-05-15', anoMes:202605, tEspMed:40, tEspTri:5, tTotal:60, cor:'AMARELO', turno:'D'},
  ];
  state.filt = state.raw.slice();
  state._retCache = null; state._retCacheKey = -1; state._filtVersion++;
  var rMai = monthReturnRate(state.filt, 202605);
  var rJun = monthReturnRate(state.filt, 202606);
  if (rMai !== 0) throw new Error('taxa mai esperado 0%, obtido ' + rMai);
  if (rJun === null || rJun <= 0) throw new Error('taxa jun deveria ser > 0%, obtido ' + rJun);
  __ok('monthReturnRate — retorno 31/mai→02/jun conta em jun, não em mai');
} catch(e) { __fail('monthReturnRate — virada de mês', e.message); }

// ─── Caso 11: manchesterConformidade — thresholds e split D/N ────────────
// MANCHESTER_METAS: VERMELHO=0, LARANJA=15, AMARELO=60
try {
  var rows_mc = [
    {cor:'VERMELHO', tEspMed:1,  turno:'D'},  // meta=0, 1>0 → fora
    {cor:'VERMELHO', tEspMed:0,  turno:'N'},  // meta=0, 0<=0 → ok
    {cor:'LARANJA',  tEspMed:10, turno:'N'},  // meta=15, 10<=15 → ok
    {cor:'LARANJA',  tEspMed:20, turno:'D'},  // meta=15, 20>15 → fora
    {cor:'AMARELO',  tEspMed:50, turno:'D'},  // meta=60, 50<=60 → ok
    {cor:'AMARELO',  tEspMed:70, turno:'N'},  // meta=60, 70>60 → fora
  ];
  var mc = manchesterConformidade(rows_mc);
  if (!mc.VERMELHO) throw new Error('VERMELHO ausente');
  if (mc.VERMELHO.total !== 2) throw new Error('VERMELHO.total esperado 2, obtido ' + mc.VERMELHO.total);
  if (mc.VERMELHO.ok    !== 1) throw new Error('VERMELHO.ok esperado 1 (tEspMed=0), obtido ' + mc.VERMELHO.ok);
  if (mc.VERMELHO.D.ok  !== 0) throw new Error('VERMELHO.D.ok esperado 0, obtido ' + mc.VERMELHO.D.ok);
  if (mc.VERMELHO.N.ok  !== 1) throw new Error('VERMELHO.N.ok esperado 1, obtido ' + mc.VERMELHO.N.ok);
  if (!mc.LARANJA) throw new Error('LARANJA ausente');
  if (mc.LARANJA.ok     !== 1) throw new Error('LARANJA.ok esperado 1, obtido ' + mc.LARANJA.ok);
  if (mc.LARANJA.D.ok   !== 0) throw new Error('LARANJA.D.ok esperado 0 (20>15), obtido ' + mc.LARANJA.D.ok);
  if (mc.LARANJA.N.ok   !== 1) throw new Error('LARANJA.N.ok esperado 1 (10<=15), obtido ' + mc.LARANJA.N.ok);
  if (!mc.AMARELO) throw new Error('AMARELO ausente');
  if (mc.AMARELO.D.ok   !== 1) throw new Error('AMARELO.D.ok esperado 1 (50<=60), obtido ' + mc.AMARELO.D.ok);
  if (mc.AMARELO.N.ok   !== 0) throw new Error('AMARELO.N.ok esperado 0 (70>60), obtido ' + mc.AMARELO.N.ok);
  __ok('manchesterConformidade — thresholds (VERMELHO=0,LARANJA=15,AMARELO=60) e split D/N corretos');
} catch(e) { __fail('manchesterConformidade — thresholds e split D/N', e.message); }

// ─── Caso 12: calcProjecao — mês incompleto vs completo ─────────────────
try {
  // Junho 2026 tem 30 dias. 15 dias com dados → projeta.
  var jun_rows = [];
  for (var d12 = 1; d12 <= 15; d12++) {
    jun_rows.push({anoMes:202606, dateKey:'2026-06-'+String(d12).padStart(2,'0'),
                   tEspTri:5, tEspMed:30, tTotal:60, cor:'AMARELO'});
  }
  var proj = calcProjecao(jun_rows);
  if (!proj) throw new Error('esperava projeção para mês incompleto (15/30 dias), obteve null');
  if (proj.daysInMonth !== 30) throw new Error('daysInMonth esperado 30, obtido ' + proj.daysInMonth);
  if (proj.daysPresent !== 15) throw new Error('daysPresent esperado 15, obtido ' + proj.daysPresent);
  if (proj.projVol <= proj.volCur) throw new Error('projVol deveria ser > volCur (projeção linear)');
  // Mês completo (30 dias) → null
  var full_jun = [];
  for (var d12b = 1; d12b <= 30; d12b++) {
    full_jun.push({anoMes:202606, dateKey:'2026-06-'+String(d12b).padStart(2,'0'),
                   tEspTri:5, tEspMed:30, tTotal:60, cor:'AMARELO'});
  }
  var projFull = calcProjecao(full_jun);
  if (projFull !== null) throw new Error('mês completo deveria retornar null, obteve ' + JSON.stringify(projFull));
  __ok('calcProjecao — mês incompleto projeta, mês completo retorna null');
} catch(e) { __fail('calcProjecao — mês incompleto vs completo', e.message); }

// ─── Caso 13: calcularPontos — fixture fixo ──────────────────────────────
// Fórmula: +1/row, +1 se <=12, +1 se <=2, +1 se >=60, +1 se >=80, +2 se AMARELO, +5 se LARANJA/VERMELHO
try {
  // AMARELO, idade=5: 1 + 1(<=12) + 0(>2) + 0(<60) + 0(<80) + 2(AMARELO) = 4
  var pts1 = calcularPontos([{cor:'AMARELO', idade:5}]);
  if (pts1 !== 4) throw new Error('AMARELO/5anos esperado 4, obtido ' + pts1);
  // VERMELHO, idade=82: 1 + 0(>12) + 0(>2) + 1(>=60) + 1(>=80) + 5(VERMELHO) = 8
  var pts2 = calcularPontos([{cor:'VERMELHO', idade:82}]);
  if (pts2 !== 8) throw new Error('VERMELHO/82anos esperado 8, obtido ' + pts2);
  // VERDE, idade=30: 1 + 0 + 0 + 0 + 0 + 0 = 1
  var pts3 = calcularPontos([{cor:'VERDE', idade:30}]);
  if (pts3 !== 1) throw new Error('VERDE/30anos esperado 1, obtido ' + pts3);
  // LARANJA, idade=1: 1 + 1(<=12) + 1(<=2) + 0 + 0 + 5(LARANJA) = 8
  var pts4 = calcularPontos([{cor:'LARANJA', idade:1}]);
  if (pts4 !== 8) throw new Error('LARANJA/1ano esperado 8, obtido ' + pts4);
  __ok('calcularPontos — pontuação por cor e faixa etária correta');
} catch(e) { __fail('calcularPontos — pontuação conhecida', e.message); }

// ─── Caso 14: returns72 — filtro jun-only, índice em maio ───────────────
try {
  var dhMaiIdx = new Date(2026, 4, 31, 20, 0);
  var dhJunRet = new Date(2026, 5,  1, 10, 0);
  state.raw = [
    {pront:'P777', dh:dhMaiIdx, dateKey:'2026-05-31', anoMes:202605, prof:'DR A'},
    {pront:'P777', dh:dhJunRet, dateKey:'2026-06-01', anoMes:202606, prof:'DR B'}
  ];
  state.filt = [state.raw[1]];
  state._rawVersion = (state._rawVersion || 0) + 1;
  state._filtVersion = (state._filtVersion || 0) + 1;
  state._retCache = null;
  var res14 = returns72();
  if (res14.ret.length !== 1) throw new Error('esperado 1 retorno com filtro jun-only, obtido ' + res14.ret.length);
  if (res14.ret[0].anoMes !== 202606) throw new Error('anoMes retorno esperado 202606');
  __ok('returns72 — filtro jun-only detecta retorno c/ índice fora do período');
} catch(e) { __fail('returns72 — filtro jun-only detecta retorno c/ índice fora do período', e.message); }

// ─── Caso 15: buildShortNameLookup — colisão JOÃO CARLOS ───────────────
try {
  var map15 = buildShortNameLookup(['JOÃO CARLOS SILVA', 'JOÃO CARLOS SOUZA', 'MARIA SANTOS']);
  var labels15 = Array.from(map15.values()).filter(function(l){ return l.indexOf('JOÃO') >= 0; });
  if (labels15.length !== 2) throw new Error('esperado 2 labels JOÃO, obtido ' + labels15.length);
  if (labels15[0] === labels15[1]) throw new Error('colisão não resolvida: ' + labels15[0]);
  __ok('buildShortNameLookup — desambigua JOÃO CARLOS SILVA vs SOUZA');
} catch(e) { __fail('buildShortNameLookup — desambigua colisão', e.message); }

</script>`;

html = html.replace('</body>', TESTS_SCRIPT + '</body>');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
const fatal = [];
dom.window.addEventListener('error', e => fatal.push(e.message || String(e.error)));

setTimeout(() => {
  process.exit(report({ results: dom.window.__results || [], fatal }));
}, 2000);
