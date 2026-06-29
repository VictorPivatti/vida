#!/usr/bin/env node
/**
 * V.I.D.A. — Testes de parsers
 * Valida a lógica de parsing de dados do Vivver com fixtures anonimizadas.
 *
 * Cobre 10 casos:
 *   1. parseHistLegacy — cor, pront, prof, tEspMed=p[18], tEspTri, tTotal
 *   2. parseHistLegacy — tipo=EVASAO → evadido=true
 *   3. parseHistLegacy — plantão noturno (02:30) → dateKey=dia anterior, turno=N
 *   4. parseHistLegacy — tEspMed fallback quando p[18] vazio
 *   5. parseTriLegacy  — pront, cor, tDur, triador e dateKey noturno
 *   6. parseCidLegacy  — medico=p[14] ≠ paciente=p[8] (regressão v3.3.0)
 *   7. parseProcedimentosText — offset auto-detectado (dados +1 col vs cabeçalho)
 *   8. chooseParsed    — prefere header quando completeness ≥ legacy, e vice-versa
 *   9. parseHist — tEspMed usa triagem_atendimento (campo direto) com teto=720 (fix bug teto=200)
 *  10. _parseExamesLines — guias, valores, exames e médicos parseados de allLines do PDF
 *
 * Uso: node tests/parsers.test.js
 */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { buildHtml, report } = require('./helpers.cjs');

let html = buildHtml();

// Fixtures anonimizadas — dados fictícios, nomes genéricos, prontuários fake
const HIST_CSV = fs.readFileSync(path.join(__dirname, '../fixtures/hist_min.csv'), 'utf-8');
const TRI_CSV  = fs.readFileSync(path.join(__dirname, '../fixtures/tri_min.csv'),  'utf-8');
const CID_CSV  = fs.readFileSync(path.join(__dirname, '../fixtures/cid_min.csv'),  'utf-8');
const PROC_TXT = fs.readFileSync(path.join(__dirname, '../fixtures/proc_min.csv'), 'utf-8');

const TESTS_SCRIPT = `<script>
window.__results = [];
function __ok(name)        { window.__results.push([name, 'ok']); }
function __fail(name, msg) { window.__results.push([name, 'ERRO: ' + String(msg)]); }

var histCsv = ${JSON.stringify(HIST_CSV)};
var triCsv  = ${JSON.stringify(TRI_CSV)};
var cidCsv  = ${JSON.stringify(CID_CSV)};
var procTxt = ${JSON.stringify(PROC_TXT)};

// ─── Caso 1: parseHistLegacy — campos básicos ─────────────────────────────
try {
  var r1 = parseHistLegacy(histCsv);
  if (!r1.data.length) throw new Error('nenhuma linha parseada');
  if (r1.data.length !== 5) throw new Error('esperado 5 linhas, obtido ' + r1.data.length);
  // Ordenado por dh: [0]=15jan10h, [1]=15jan11h, [2]=15jan14h, [3]=16jan02h30, [4]=16jan10h
  var row0 = r1.data[0];
  if (row0.cor !== 'AMARELO')            throw new Error('cor: ' + row0.cor);
  if (row0.pront !== '1001')             throw new Error('pront: ' + row0.pront);
  if (!row0.prof.includes('DR SILVA A')) throw new Error('prof: ' + row0.prof);
  if (row0.tEspMed !== 45)               throw new Error('tEspMed esperado 45 (p[18]), obtido ' + row0.tEspMed);
  if (row0.tEspTri !== 5)                throw new Error('tEspTri esperado 5, obtido ' + row0.tEspTri);
  if (row0.tTotal !== 120)               throw new Error('tTotal esperado 120, obtido ' + row0.tTotal);
  __ok('parseHistLegacy — cor, pront, prof, tEspMed=p[18]=45, tEspTri=5, tTotal=120');
} catch(e) { __fail('parseHistLegacy — cor, pront, prof, tEspMed=p[18]=45, tEspTri=5, tTotal=120', e.message); }

// ─── Caso 2: parseHistLegacy — evasão ────────────────────────────────────
try {
  var r2 = parseHistLegacy(histCsv);
  var rowEvasao = r2.data[2]; // 15jan14h — tipo=EVASAO
  if (!rowEvasao.evadido)         throw new Error('evadido deveria ser true para tipo=EVASAO');
  if (rowEvasao.pront !== '1003') throw new Error('pront errado: ' + rowEvasao.pront);
  if (rowEvasao.cor !== 'VERDE')  throw new Error('cor errada: ' + rowEvasao.cor);
  __ok('parseHistLegacy — tipo=EVASAO → evadido=true');
} catch(e) { __fail('parseHistLegacy — tipo=EVASAO → evadido=true', e.message); }

// ─── Caso 3: parseHistLegacy — dateKey plantão noturno ────────────────────
try {
  var r3 = parseHistLegacy(histCsv);
  var rowNight = r3.data[3]; // dh=16/01/2026 02:30
  if (rowNight.pront !== '1004')         throw new Error('pront errado: ' + rowNight.pront);
  if (rowNight.turno !== 'N')            throw new Error('turno esperado N, obtido ' + rowNight.turno);
  if (rowNight.dateKey !== '2026-01-15') throw new Error('dateKey esperado 2026-01-15, obtido ' + rowNight.dateKey);
  if (rowNight.anoMes !== 202601)        throw new Error('anoMes esperado 202601, obtido ' + rowNight.anoMes);
  __ok('parseHistLegacy — plantão 02:30 → dateKey=2026-01-15 (dia anterior), turno=N');
} catch(e) { __fail('parseHistLegacy — plantão 02:30 → dateKey=2026-01-15 (dia anterior), turno=N', e.message); }

// ─── Caso 4: parseHistLegacy — tEspMed fallback quando p[18] vazio ────────
try {
  var r4 = parseHistLegacy(histCsv);
  var rowFallback = r4.data[4]; // dh=16/01/2026 10:00, p[18]=''
  if (rowFallback.pront !== '1005') throw new Error('pront errado: ' + rowFallback.pront);
  // dhAcol=10:03, dhAtend=10:20, tDurTri=3 min → fallback = 17 − 3 = 14 min
  if (rowFallback.tEspMed === null) throw new Error('tEspMed null — fallback não acionado');
  if (Math.abs(rowFallback.tEspMed - 14) > 1)
    throw new Error('tEspMed esperado ~14 (fallback), obtido ' + rowFallback.tEspMed);
  __ok('parseHistLegacy — tEspMed fallback (dhAtend−dhAcol)−tDurTri quando p[18] vazio');
} catch(e) { __fail('parseHistLegacy — tEspMed fallback (dhAtend−dhAcol)−tDurTri quando p[18] vazio', e.message); }

// ─── Caso 5: parseTriLegacy — pront, cor, tDur, triador e dateKey noturno ─
try {
  var r5 = parseTriLegacy(triCsv);
  if (r5.data.length !== 3) throw new Error('esperado 3 linhas, obtido ' + r5.data.length);
  // Ordenado por dh: [0]=15jan10h, [1]=15jan14h, [2]=16jan02h30
  var t0 = r5.data[0];
  if (t0.pront !== '1001')          throw new Error('pront[0] errado: ' + t0.pront);
  if (t0.cor !== 'AMARELO')         throw new Error('cor[0] errada: ' + t0.cor);
  if (t0.tDur !== 7)                throw new Error('tDur[0] esperado 7, obtido ' + t0.tDur);
  if (t0.triador !== 'ENF SOUSA C') throw new Error('triador[0]: ' + t0.triador);
  // Plantão noturno: 16jan 02:30 → dateKey=2026-01-15 (igual ao hist row 4)
  var tNight = r5.data[2];
  if (tNight.pront !== '1004')             throw new Error('pront noturno errado: ' + tNight.pront);
  if (tNight.turno !== 'N')               throw new Error('turno noturno esperado N, obtido ' + tNight.turno);
  if (tNight.dateKey !== '2026-01-15')    throw new Error('dateKey noturno esperado 2026-01-15, obtido ' + tNight.dateKey);
  __ok('parseTriLegacy — pront, cor, tDur, triador e dateKey noturno alinhado com hist');
} catch(e) { __fail('parseTriLegacy — pront, cor, tDur, triador e dateKey noturno alinhado com hist', e.message); }

// ─── Caso 6: parseCidLegacy — medico=p[14] ≠ paciente=p[8] ──────────────
// Antes da correção v3.3.0 os campos estavam trocados: medico era p[8] e paciente p[14].
try {
  var r6 = parseCidLegacy(cidCsv);
  if (r6.data.length < 3) throw new Error('esperado ≥3 linhas, obtido ' + r6.data.length);
  var cid0 = r6.data[0]; // PACIENTE A, J06.9, DR SILVA A
  if (!cid0.medico.includes('DR SILVA A'))
    throw new Error('medico errado: ' + cid0.medico + ' — esperado DR SILVA A (em p[14])');
  if (!cid0.paciente.includes('PACIENTE A'))
    throw new Error('paciente errado: ' + cid0.paciente + ' — esperado PACIENTE A (em p[8])');
  if (cid0.medico === cid0.paciente)
    throw new Error('medico === paciente — campos trocados (bug v3.3.0 regrediu)');
  if (cid0.cid !== 'J06.9')   throw new Error('cid errado: ' + cid0.cid);
  if (cid0.idAtend !== '1001') throw new Error('idAtend errado: ' + cid0.idAtend);
  __ok('parseCidLegacy — medico=p[14], paciente=p[8] corretos (regressão v3.3.0 não voltou)');
} catch(e) { __fail('parseCidLegacy — medico=p[14], paciente=p[8] corretos (regressão v3.3.0 não voltou)', e.message); }

// ─── Caso 7: parseProcedimentosText — offset auto-detection ──────────────
// O Vivver exporta coluna sequencial extra no início de cada linha de dados,
// sem correspondência no cabeçalho. offset = firstData.length − header.length = 1.
try {
  var r7 = parseProcedimentosText(procTxt);
  if (r7.length !== 3) throw new Error('esperado 3 linhas (offset correto), obtido ' + r7.length);
  var p0 = r7[0];
  if (!p0.prof.includes('DR SILVA A'))      throw new Error('prof[0] errado: ' + p0.prof);
  if (!p0.proc.includes('CONSULTA MEDICA')) throw new Error('proc[0] errado: ' + p0.proc);
  if (p0.qde !== 3)                         throw new Error('qde[0] esperado 3, obtido ' + p0.qde);
  if (p0.faturavelFlag !== 'S')             throw new Error('faturavelFlag[0] esperado S, obtido ' + p0.faturavelFlag);
  var p1 = r7[1];
  if (p1.qde !== 5)             throw new Error('qde[1] esperado 5, obtido ' + p1.qde);
  if (p1.faturavelFlag !== 'N') throw new Error('faturavelFlag[1] esperado N, obtido ' + p1.faturavelFlag);
  var p2 = r7[2];
  if (!p2.prof.includes('DR COSTA B')) throw new Error('prof[2] errado: ' + p2.prof);
  if (p2.qde !== 2)                    throw new Error('qde[2] esperado 2, obtido ' + p2.qde);
  __ok('parseProcedimentosText — offset=1 auto-detectado, prof/proc/qde/faturavelFlag corretos');
} catch(e) { __fail('parseProcedimentosText — offset=1 auto-detectado, prof/proc/qde/faturavelFlag corretos', e.message); }

// ─── Caso 8: chooseParsed — prefere modern quando completeness ≥ legacy ──
try {
  var now8 = new Date(2026, 0, 15, 10, 0);
  var modern8 = {data:[{dh:now8, prof:'DR SILVA A', cor:'AMARELO'}], total:1, invalid:0, msg:''};
  var legacy8  = {data:[], total:1, invalid:1, msg:''};
  var chosen8 = chooseParsed('hist', modern8, legacy8);
  if (!Array.isArray(chosen8)) throw new Error('chooseParsed não retornou array');
  if (chosen8.length !== 1)    throw new Error('modern deveria vencer (1 row vs 0): ' + chosen8.length);
  if (chosen8[0].prof !== 'DR SILVA A') throw new Error('conteúdo incorreto: ' + JSON.stringify(chosen8[0]));
  // Inverso: legacy com dados, modern vazio → legacy deve vencer
  var modern8b = {data:[], total:1, invalid:1, msg:''};
  var legacy8b = {data:[{dh:now8, prof:'DR COSTA B', cor:'VERDE'}], total:1, invalid:0, msg:''};
  var chosen8b = chooseParsed('hist', modern8b, legacy8b);
  if (chosen8b.length !== 1) throw new Error('legacy deveria vencer quando modern vazio: ' + chosen8b.length);
  if (chosen8b[0].prof !== 'DR COSTA B') throw new Error('legacy data incorreta: ' + JSON.stringify(chosen8b[0]));
  __ok('chooseParsed — modern vence com completeness ≥ legacy; legacy vence quando maior');
} catch(e) { __fail('chooseParsed — modern vence com completeness ≥ legacy; legacy vence quando maior', e.message); }

// ─── Caso 10: _parseExamesLines — guia + exames + médico ─────────────────
try {
  var lines10 = [
    {text:'06-12345 1 15/01/2026 3 3 1.500,00 450,00', x0:10},
    {text:'HEMOGRAMA COMPLETO 15,00 15,00', x0:50},
    {text:'PCR QUANTITATIVO 45,00 45,00', x0:50},
    {text:'Solicitante Responsável: DR SILVA A', x0:10},
    {text:'06-12346 2 15/01/2026 1 1 200,00 200,00', x0:10},
    {text:'TROPONINA I 200,00 200,00', x0:50},
    {text:'Solicitante Responsável: DR COSTA B', x0:10},
  ];
  var recs10 = _parseExamesLines(lines10);
  if(recs10.length !== 2) throw new Error('esperado 2 guias, obtido ' + recs10.length);
  var g0 = recs10[0];
  if(g0.guia !== '06-12345') throw new Error('guia[0] errado: ' + g0.guia);
  if(g0.n_exames !== 3) throw new Error('n_exames[0] esperado 3, obtido ' + g0.n_exames);
  if(Math.abs(g0.valor - 450) > 0.01) throw new Error('valor[0] esperado 450, obtido ' + g0.valor);
  if(g0.doctor !== 'DR SILVA A') throw new Error('doctor[0] errado: ' + g0.doctor);
  if(g0.exames.length < 2) throw new Error('exames[0] esperado ≥2, obtido ' + g0.exames.length);
  var g1 = recs10[1];
  if(g1.guia !== '06-12346') throw new Error('guia[1] errado: ' + g1.guia);
  if(g1.doctor !== 'DR COSTA B') throw new Error('doctor[1] errado: ' + g1.doctor);
  __ok('_parseExamesLines — 2 guias, valores, exames e médicos parseados corretamente');
} catch(e) { __fail('_parseExamesLines — guia + exames + médico', e.message); }

// ─── Caso 9: parseHist — tEspMed usa triagem_atendimento (campo direto, teto=720) ─
// Bug corrigido em v3.4.0: parseHist agora lê triagem_atendimento via ALIAS/FALLBACK
// e usa CONFIG.MAX_MINUTES (720) como teto, igual ao parseHistLegacy.
// Cenário: triagem_atendimento = 250 min (estava retornando null com teto=200).
try {
  var hdr9 = ['numprontuario','classificacao','nompaciente','nomprofissional','tipo_entrada',
               'dh_recepcao','dh_acolhimento','dh_atendimento','recepcao_triagem','triagem_duracao',
               'triagem_atendimento','tempo_consulta','recepcao_alta'];
  // triagem_atendimento = 250 min (acima do antigo teto de 200, abaixo do correto 720)
  var row9 = ['1001','AMARELO','PACIENTE A','DR SILVA A','NORMAL COM TRIAGEM',
              '15/01/2026 10:00','15/01/2026 10:00','15/01/2026 14:10',
              '00:05:00','00:05:00','04:10:00','00:20:00','05:00:00'];
  var parsed9 = parseHist([hdr9, row9], false);
  if (!parsed9.length) throw new Error('nenhuma linha parseada pelo parseHist');
  var tEsp9 = parsed9[0].tEspMed;
  if (tEsp9 !== 250)
    throw new Error('tEspMed=' + tEsp9 + ', esperado 250 — bug teto=200 ainda presente?');
  __ok('parseHist — triagem_atendimento (250 min) lido corretamente com teto=720 (fix teto=200)');
} catch(e) { __fail('parseHist tEspMed campo direto teto=720', e.message); }

</script>`;

html = html.replace('</body>', TESTS_SCRIPT + '</body>');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
const fatal = [];
dom.window.addEventListener('error', e => fatal.push(e.message || String(e.error)));

setTimeout(() => {
  process.exit(report({ results: dom.window.__results || [], fatal }));
}, 2000);
