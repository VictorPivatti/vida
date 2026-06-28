#!/usr/bin/env node
/**
 * V.I.D.A. — Testes de integração
 * Valida comportamento cross-source: cruzamento hist↔tri, returns72
 * e consistência de dateKey na virada do plantão noturno.
 *
 * Cobre 3 casos:
 *   1. Cruzamento hist↔tri — pronts presentes em ambas as fontes identificados corretamente
 *   2. Virada de plantão — pront 1004 (02:30h) tem mesmo dateKey em hist e tri (2026-01-15)
 *   3. returns72 cross-source — mesmo pront com visitas a 48h gera 1 evento de retorno
 *
 * Uso: node tests/integration.test.js
 */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { buildHtml, report } = require('./helpers');

let html = buildHtml();

const HIST_CSV = fs.readFileSync(path.join(__dirname, '../fixtures/hist_min.csv'), 'utf-8');
const TRI_CSV  = fs.readFileSync(path.join(__dirname, '../fixtures/tri_min.csv'),  'utf-8');

const TESTS_SCRIPT = `<script>
window.__results = [];
function __ok(name)        { window.__results.push([name, 'ok']); }
function __fail(name, msg) { window.__results.push([name, 'ERRO: ' + String(msg)]); }

var HIST_CSV = ${JSON.stringify(HIST_CSV)};
var TRI_CSV  = ${JSON.stringify(TRI_CSV)};

// ─── Caso 1: cruzamento hist↔tri — pront overlap ─────────────────────────
// hist_min: pronts 1001, 1002, 1003, 1004, 1005
// tri_min:  pronts 1001, 1003, 1004
// Overlap esperado: {1001, 1003, 1004}
try {
  var histParsed = parseHistLegacy(HIST_CSV);
  var triParsed  = parseTriLegacy(TRI_CSV);

  if (!histParsed.data.length) throw new Error('hist sem dados');
  if (!triParsed.data.length)  throw new Error('tri sem dados');

  var histPronts = new Set(histParsed.data.map(function(r){ return r.pront; }));
  var triPronts  = new Set(triParsed.data.map(function(r){ return r.pront; }));
  var overlap    = [...histPronts].filter(function(p){ return triPronts.has(p); }).sort();

  if (overlap.length !== 3) throw new Error('overlap esperado 3 pronts, obtido ' + overlap.length + ': ' + overlap.join(','));
  if (!overlap.includes('1001')) throw new Error('pront 1001 deveria estar no overlap');
  if (!overlap.includes('1003')) throw new Error('pront 1003 deveria estar no overlap');
  if (!overlap.includes('1004')) throw new Error('pront 1004 deveria estar no overlap');
  if (overlap.includes('1002')) throw new Error('pront 1002 não deveria estar no overlap (só no hist)');
  if (overlap.includes('1005')) throw new Error('pront 1005 não deveria estar no overlap (só no hist)');

  __ok('cruzamento hist↔tri — overlap {1001, 1003, 1004} correto; 1002 e 1005 apenas no hist');
} catch(e) { __fail('cruzamento hist↔tri — pront overlap', e.message); }

// ─── Caso 2: virada de plantão — dateKey consistente entre hist e tri ─────
// pront 1004: dh = 16/01/2026 02:30 → ajuste noturno → dateKey = 2026-01-15 em AMBOS
try {
  var histParsed2 = parseHistLegacy(HIST_CSV);
  var triParsed2  = parseTriLegacy(TRI_CSV);

  var hRow = histParsed2.data.find(function(r){ return r.pront === '1004'; });
  var tRow = triParsed2.data.find(function(r){ return r.pront === '1004'; });

  if (!hRow) throw new Error('pront 1004 não encontrado no hist');
  if (!tRow) throw new Error('pront 1004 não encontrado no tri');

  if (hRow.dateKey !== '2026-01-15') throw new Error('hist dateKey esperado 2026-01-15, obtido ' + hRow.dateKey);
  if (tRow.dateKey !== '2026-01-15') throw new Error('tri dateKey esperado 2026-01-15, obtido ' + tRow.dateKey);
  if (hRow.turno !== 'N') throw new Error('hist turno esperado N, obtido ' + hRow.turno);
  if (tRow.turno !== 'N') throw new Error('tri turno esperado N, obtido ' + tRow.turno);

  // dateKeys iguais → filtro de data não vai divergir entre hist e tri para esta linha
  if (hRow.dateKey !== tRow.dateKey) throw new Error('dateKey diverge entre hist (' + hRow.dateKey + ') e tri (' + tRow.dateKey + ')');

  __ok('virada de plantão — pront 1004 (02:30h) tem dateKey=2026-01-15 em hist e tri');
} catch(e) { __fail('virada de plantão — dateKey consistente hist↔tri', e.message); }

// ─── Caso 3: returns72 cross-source ──────────────────────────────────────
// Duas visitas do mesmo pront com 48h de diferença → deve gerar 1 evento de retorno
try {
  var t0_i3 = new Date(2026, 4, 10, 9, 0);
  var t1_i3 = new Date(2026, 4, 12, 9, 0);  // 48h depois
  var rows_i3 = [
    // 8 pacientes únicos de fundo (não retornam)
    {pront:'B001', dh:new Date(2026,4,1,10,0), dateKey:'2026-05-01', anoMes:202605},
    {pront:'B002', dh:new Date(2026,4,2,10,0), dateKey:'2026-05-02', anoMes:202605},
    {pront:'B003', dh:new Date(2026,4,3,10,0), dateKey:'2026-05-03', anoMes:202605},
    {pront:'B004', dh:new Date(2026,4,4,10,0), dateKey:'2026-05-04', anoMes:202605},
    {pront:'B005', dh:new Date(2026,4,5,10,0), dateKey:'2026-05-05', anoMes:202605},
    // P999: 2 visitas a 48h (retorno)
    {pront:'P999', dh:t0_i3, dateKey:'2026-05-10', anoMes:202605},
    {pront:'P999', dh:t1_i3, dateKey:'2026-05-12', anoMes:202605},
  ];
  // returnsFor testa a lógica pura sem state
  var res_i3 = returnsFor(rows_i3);
  if (!res_i3.ret.length) throw new Error('esperado pelo menos 1 retorno, obtido 0');
  var p999ret = res_i3.ret.filter(function(r){ return r.pront === 'P999'; });
  if (p999ret.length !== 1) throw new Error('P999 deveria ter 1 retorno, obtido ' + p999ret.length);
  var diffH = (t1_i3 - t0_i3) / 36e5;
  if (Math.abs(p999ret[0].diffH - diffH) > 0.01) throw new Error('diffH incorreto: ' + p999ret[0].diffH + ' esperado ' + diffH);
  // Pacientes de fundo não devem gerar retorno
  var bgRet = res_i3.ret.filter(function(r){ return r.pront.startsWith('B'); });
  if (bgRet.length !== 0) throw new Error('pacientes de fundo geraram retornos: ' + bgRet.map(function(r){return r.pront;}).join(','));
  __ok('returns72 cross-source — P999 (48h) gera 1 retorno; B001-B005 (únicos) não geram');
} catch(e) { __fail('returns72 cross-source', e.message); }

</script>`;

html = html.replace('</body>', TESTS_SCRIPT + '</body>');

const dom   = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
const fatal = [];
dom.window.addEventListener('error', e => fatal.push(e.message || String(e.error)));

setTimeout(() => {
  process.exit(report({ results: dom.window.__results || [], fatal }));
}, 2000);
