#!/usr/bin/env node
/**
 * V.I.D.A. — Testes de integração de loaders (CID / workerRun)
 */
const fs = require('fs');
const path = require('path');
const { buildHtml, runTests, report } = require('./helpers.cjs');

const CID_CSV = fs.readFileSync(path.join(__dirname, '../fixtures/cid_min.csv'), 'utf-8');

const TESTS_SCRIPT = `<script>
window.__results = [];
function __ok(name)        { window.__results.push([name, 'ok']); }
function __fail(name, msg) { window.__results.push([name, 'ERRO: ' + String(msg)]); }

// parseCidFromText — fixture
try {
  var rows = parseCidFromText(${JSON.stringify(CID_CSV)});
  if (rows.length !== 3) throw new Error('esperado 3 registros, obtido ' + rows.length);
  if (rows[0].dateKey !== '2026-01-15') throw new Error('dateKey ' + rows[0].dateKey);
  __ok('parseCidFromText — fixture cid_min');
} catch(e) { __fail('parseCidFromText — fixture cid_min', e.message); }

// workerRun parseCid — buffer CSV (fallback main thread)
(async function() {
  try {
    var enc = new TextEncoder();
    var buf = enc.encode(${JSON.stringify(CID_CSV)}).buffer;
    var r = await workerRun('parseCid', { buffers: [buf], names: ['cid_min.csv'] });
    if (!r.rows || r.rows.length !== 3) throw new Error('rows=' + (r.rows && r.rows.length));
    if (r.total == null) throw new Error('total ausente');
    __ok('workerRun parseCid — retorna rows/total/invalid');
  } catch(e) { __fail('workerRun parseCid — retorna rows/total/invalid', e.message); }

  // DOM: status em #cidStatus, não sobrescreve #cidBtn
  try {
    var btn = document.getElementById('cidBtn');
    var status = document.getElementById('cidStatus');
    if (!btn || !status) throw new Error('elementos upload menu ausentes');
    if (!btn.querySelector('.upload-menu-label')) throw new Error('cidBtn sem estrutura de menu');
    status.textContent = '3 reg.';
    status.className = 'upload-menu-status loaded';
    if (btn.textContent.indexOf('CID /') < 0 && btn.textContent.indexOf('Diagnósticos') < 0) {
      throw new Error('cidBtn textContent sobrescrito: ' + btn.textContent.slice(0, 40));
    }
    __ok('upload menu CID — label preservado, status separado');
  } catch(e) { __fail('upload menu CID — label preservado, status separado', e.message); }

  window.__asyncDone = true;
})();
</script>`;

(async () => {
  const { results, fatal } = await runTests(TESTS_SCRIPT, 3500);
  const fail = report({ results, fatal });
  process.exit(fail ? 1 : 0);
})();
