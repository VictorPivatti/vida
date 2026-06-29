'use strict';
/**
 * Utilitários compartilhados entre os arquivos de teste.
 * Evita duplicação do boot jsdom + stubs entre metrics, parsers e integration.
 */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML_FILE    = path.join(__dirname, '..', 'index.html');
const SRC_MODULES  = path.join(__dirname, '..', 'src', 'js');

const STUBS = `<script>
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

/** Lê index.html, remove CDN externos e injeta stubs de dependências. */
function buildHtml() {
  if (!fs.existsSync(HTML_FILE)) {
    console.error(`Arquivo não encontrado: ${HTML_FILE}`);
    process.exit(2);
  }
  let html = fs.readFileSync(HTML_FILE, 'utf-8');
  return html
    .replace(/<script src="https:[^"]*"><\/script>/g, '')
    .replace('</head>', STUBS + '</head>');
}

/**
 * Injeta um script de teste como string, cria jsdom e aguarda delayMs.
 * O script pode usar window.__results + __ok/__fail diretamente.
 * Retorna Promise<{results, fatal}>.
 */
function runTests(testsScript, delayMs = 2000) {
  return new Promise((resolve) => {
    const html = buildHtml().replace('</body>', testsScript + '</body>');
    const dom  = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
    const fatal = [];
    dom.window.addEventListener('error', e => fatal.push(e.message || String(e.error)));
    setTimeout(() => resolve({ results: dom.window.__results || [], fatal }), delayMs);
  });
}

/**
 * Imprime resultados no stdout e retorna número de falhas.
 * Filtra erros esperados de indexedDB (não disponível no jsdom).
 */
function report({ results, fatal }) {
  let fail = 0;
  const realFatal = fatal.filter(m => !/indexedDB/i.test(m));
  if (realFatal.length) { console.log('✗ CARREGAMENTO — ' + realFatal[0]); fail++; }
  for (const [name, status] of results) {
    const ok = status === 'ok';
    if (!ok) fail++;
    console.log((ok ? '✓' : '✗') + ' ' + name + (ok ? '' : '\n    ' + status));
  }
  const total = results.length;
  console.log(fail === 0
    ? `\n${total} testes OK.`
    : `\n${fail} FALHA(S) de ${total}.`);
  return fail;
}

module.exports = { buildHtml, runTests, report, STUBS, HTML_FILE, SRC_MODULES };
