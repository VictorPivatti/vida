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
 *
 * Uso: node tests/metrics.test.js
 */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const FILE = path.join(__dirname, '..', 'index.html');
if (!fs.existsSync(FILE)) { console.error(`Arquivo não encontrado: ${FILE}`); process.exit(2); }
let html = fs.readFileSync(FILE, 'utf-8');

const stubs = `<script>
class Chart{constructor(){this.data={datasets:[]}}destroy(){}update(){}resize(){}}
Chart.register=()=>{};Chart.defaults={font:{},plugins:{}};
window.Chart=Chart;
window.XLSX={
  read:()=>({SheetNames:[],Sheets:{}}),
  utils:{sheet_to_json:()=>[]},
  SSF:{parse_date_code:()=>null}
};
HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:()=>()=>({})})};
</script>`;
html = html.replace(/<script src="https:[^"]*"><\/script>/g, '').replace('</head>', stubs + '</head>');

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

</script>`;

html = html.replace('</body>', TESTS_SCRIPT + '</body>');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
const fatal = [];
dom.window.addEventListener('error', e => fatal.push(e.message || String(e.error)));

setTimeout(() => {
  const res  = dom.window.__results || [];
  let   fail = 0;
  const realFatal = fatal.filter(m => !/indexedDB/i.test(m));
  if (realFatal.length) { console.log('✗ CARREGAMENTO — ' + realFatal[0]); fail++; }
  for (const [name, status] of res) {
    const ok = status === 'ok';
    if (!ok) fail++;
    console.log((ok ? '✓' : '✗') + ' ' + name + (ok ? '' : '\n    ' + status));
  }
  const total = res.length;
  console.log(fail === 0
    ? `\n${total} testes OK.`
    : `\n${fail} FALHA(S) de ${total}.`);
  process.exit(fail === 0 ? 0 : 1);
}, 2000);
