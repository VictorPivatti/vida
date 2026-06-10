#!/usr/bin/env node
/**
 * V.I.D.A. — Teste de fumaça (smoke test) dos painéis
 * ----------------------------------------------------
 * Carrega o dashboard num DOM headless, injeta dados sintéticos
 * e executa cada função de render, reportando exceções.
 *
 * Uso:  node harness.js [arquivo.html]    (padrão: vida.html)
 * Requisito:  npm install jsdom
 *
 * O que ele PEGA: erro de carregamento do script (ReferenceError,
 * const removida, sintaxe), exceção dentro de qualquer render.
 * O que ele NÃO pega: número calculado errado, layout quebrado,
 * problemas que dependem do formato real das planilhas.
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const FILE = process.argv[2] || 'vida.html';
if (!fs.existsSync(FILE)) { console.error(`Arquivo não encontrado: ${FILE}`); process.exit(2); }
let html = fs.readFileSync(FILE, 'utf-8');

// Stubs das libs de CDN (teste roda offline)
const stubs = `<script>
class Chart{constructor(){this.data={datasets:[]}}destroy(){}update(){}resize(){}}
Chart.register=()=>{};Chart.defaults={font:{},plugins:{}};
window.Chart=Chart;
window.XLSX={read:()=>({SheetNames:[],Sheets:{}}),utils:{sheet_to_json:()=>[]}};
HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:()=>()=>({})})};
</script>`;
html = html.replace(/<script src="https:[^"]*"><\/script>/g, '').replace('</head>', stubs + '</head>');

// Script de teste — mesmo escopo lexical global do script principal
const test = `<script>
window.__results=[];window.__loadOk=true;
function __mkRow(i){
  const dh=new Date(2026,4,1+(i%28),(i%24),(i*7)%60);
  const cores=['VERMELHO','LARANJA','AMARELO','VERDE','AZUL','BRANCO'];
  return {dh,dhAcol:new Date(dh.getTime()+10*60000),dhAtend:new Date(dh.getTime()+45*60000),
    cor:cores[i%6],anoMes:202605,dateKey:dh.toISOString().slice(0,10),mes:5,
    hora:dh.getHours(),diaSem:dh.getDay(),turno:dh.getHours()>=7&&dh.getHours()<19?'D':'N',
    pront:'P'+(1000+(i%300)),paciente:'PACIENTE '+i,prof:'DR TESTE '+(i%8),idade:20+(i%60),
    tipo:'NORMAL COM TRIAGEM',tEspTri:10+(i%20),tEspMed:30+(i%40),tTotal:60+(i%90),tAtend:15,
    evadido:false,espec:'CLINICA'};
}
try{
  state.raw=Array.from({length:600},(_,i)=>__mkRow(i));
  state.filt=state.raw.slice();
  state.triRaw=deriveTriFromHist(state.raw);state.triFilt=state.triRaw.slice();state.triSource='hist';
  state.cidRaw=state.raw.map((r,i)=>({cid:'J0'+(i%9),desc:'TESTE',medico:r.prof,idAtend:String(i),dh:r.dh,dateKey:r.dateKey,anoMes:r.anoMes,mes:5,cap:'J'}));
  state.cidFilt=state.cidRaw.slice();state.procRaw=[];state.procFilt=[];
}catch(e){window.__results.push(['SETUP DOS DADOS','ERRO: '+e.message]);window.__loadOk=false;}
// renderHeatmap exige argumento; renderExecutive exige 5 — chamados com parâmetros corretos
const fns=[['renderGeral'],['renderIndicadores'],['renderFluxo'],['renderGargalos'],
  ['renderMedicos'],['renderProcedimentos'],['renderEnfermagem'],['renderExames'],
  ['renderRetornos'],['renderEvolucao'],['renderAnoAano'],['renderRelatorio'],
  ['renderTriagem'],['renderCid'],['renderAuditoria'],['renderQuality'],['renderCruzamento'],
  ['renderPacientes'],['renderEscala'],['renderAnotacoes'],
  ['renderHeatmap',()=>renderHeatmap(state.filt)],
  ['renderExecutive',()=>renderExecutive(100,10,60,5,40)]];
for(const [name,call] of fns){
  try{
    const fn=typeof window[name]==='function'?window[name]:(typeof eval(name)==='function'?eval(name):null);
    if(!fn){window.__results.push([name,'NÃO EXISTE']);continue;}
    call?call():fn();
    window.__results.push([name,'ok']);
  }catch(e){window.__results.push([name,'ERRO: '+e.message]);}
}
</script>`;
html = html.replace('</body>', test + '</body>');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
const fatal = [];
dom.window.addEventListener('error', e => fatal.push(e.message || String(e.error)));

setTimeout(() => {
  const res = dom.window.__results || [];
  let fail = 0;
  // Erros fatais de carregamento (exceto indexedDB, ausente no jsdom)
  const realFatal = fatal.filter(m => !/indexedDB/i.test(m));
  if (realFatal.length) { console.log('✗ CARREGAMENTO DO SCRIPT — ' + realFatal[0]); fail++; }
  if (!res.length && !realFatal.length) { console.log('✗ Script de teste não executou — erro fatal no script principal'); fail++; }
  for (const [f, s] of res) {
    const ok = s === 'ok';
    if (!ok) fail++;
    console.log((ok ? '✓' : '✗') + ' ' + f + (ok ? '' : ' — ' + s));
  }
  console.log(fail === 0 ? `\n${res.length} painéis OK.` : `\n${fail} FALHA(S).`);
  process.exit(fail === 0 ? 0 : 1);
}, 2000);
