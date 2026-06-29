// loaders/hist.js — Histórico file loader and workerRun orchestrator
// Extracted from src/index.template.html <script> block (Task A.1).
// NOTE: The monolith's <script> block still contains these functions.
//       This module coexists with it during the cutover phase.

import { state } from '../state.js';
import { parseHistLegacy, safeMinutes, histDedupKey } from '../parsers/hist.js';
import { parseCidFromText } from '../parsers/cid.js';
import { smartDecode, xlsxExtract } from '../parsers/workbook.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading, setProgress } from '../ui/progress.js';
import { renderAll } from '../render/index.js';
import { VidaDB } from '../storage/vidadb.js';
import { ymd, monthKey } from '../utils/dates.js';
import { fmt } from '../utils/dom.js';
import { populateMedicoFilter } from '../filters.js';

// ── Layout fingerprint check ──────────────────────────────────────────────────
function _checkLayoutFingerprint(type, csv, name) {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = '_fp_' + type;
    const headerLine = (csv || '').split(/\r?\n/)[0].trim();
    if (!headerLine) return;
    const stored = localStorage.getItem(key);
    if (!stored) { localStorage.setItem(key, headerLine); return; }
    if (stored !== headerLine) {
      console.warn('[fingerprint] Layout de ' + type + ' mudou em "' + name + '". Esperado:\n' + stored + '\nRecebido:\n' + headerLine);
      showToast('⚠ Layout de ' + type + ' diferente do esperado em "' + name + '". Verifique se o arquivo é do formato correto.', 'warn');
      localStorage.setItem(key, headerLine);
    }
  } catch (e) {}
}

// ── Blob Worker URL (built lazily) ────────────────────────────────────────────
// __HIST_WORKER_CODE__ is injected at build time by scripts/build.cjs via esbuild define.
// In dev (no define), typeof returns 'undefined' and the worker path is skipped.
/* global __HIST_WORKER_CODE__ */
let _histWorkerUrl = null;
function _getHistWorkerUrl() {
  if (_histWorkerUrl) return _histWorkerUrl;
  if (typeof __HIST_WORKER_CODE__ !== 'string' || !__HIST_WORKER_CODE__) return null;
  _histWorkerUrl = URL.createObjectURL(new Blob([__HIST_WORKER_CODE__], { type: 'text/javascript' }));
  return _histWorkerUrl;
}

// ── workerRun — async parsing orchestrator ────────────────────────────────────
export async function workerRun(type, payload) {
  if (type === 'parseHist') {
    // Fase A (main thread): buffer → CSV string; precisa da lib XLSX para .xls/.xlsx
    const csvs = [], names = [];
    for (let i = 0; i < payload.buffers.length; i++) {
      const buf = payload.buffers[i], name = payload.names[i];
      setProgress(5 + Math.round(i / payload.buffers.length * 40), 'Lendo ' + name + '...');
      await new Promise(r => setTimeout(r, 0));
      const hdr = new Uint8Array(buf, 0, 4);
      const isBin = (hdr[0] === 0xD0 && hdr[1] === 0xCF) || (hdr[0] === 0x50 && hdr[1] === 0x4B);
      console.log('[VIDA:hist] arquivo:', name, '| isBin:', isBin, '| magic: 0x' +
        hdr[0].toString(16).padStart(2,'0') + hdr[1].toString(16).padStart(2,'0'));
      let csv = isBin ? (await xlsxExtract(buf)) : null;
      console.log('[VIDA:hist] xlsxExtract result | arquivo:', name, '| csv:', csv ? ('string[' + csv.length + '] temPontoVirgula=' + csv.includes(';')) : null);
      if (csv && !csv.includes(';')) csv = null;
      if (!csv && isBin) {
        try {
          // XLSX is a CDN global — guard with typeof
          if (typeof XLSX !== 'undefined') {
            // eslint-disable-next-line no-undef
            const wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: false });
            const sh = wb.Sheets[wb.SheetNames[0]];
            // eslint-disable-next-line no-undef
            const arr = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false });
            csv = arr.map(r => r.join(';')).join('\n');
          }
        } catch (xlsErr) { console.warn('[workerRun] XLSX.read falhou:', xlsErr.message); }
      }
      if (!csv) csv = smartDecode(buf);
      _checkLayoutFingerprint('hist', csv, name);
      csvs.push(csv); names.push(name);
    }
    setProgress(50, 'Parseando...');
    // Fase B: tenta Worker real (desbloqueia UI); cai para main thread em ambientes sem Worker
    if (typeof Worker !== 'undefined') {
      try {
        const url = _getHistWorkerUrl();
        if (!url) throw new Error('Worker code not available');
        const result = await new Promise((res, rej) => {
          const w = new Worker(url);
          w.onmessage = e => {
            if (e.data.type === 'progress') {
              setProgress(50 + Math.round(e.data.i / e.data.n * 45), e.data.name + ': ' + e.data.count.toLocaleString('pt-BR') + ' registros');
            } else {
              console.log('[VIDA:worker] onmessage | type:', e.data.type, '| rows:', e.data.rows?.length, '| total:', e.data.total, '| invalid:', e.data.invalid);
              w.terminate(); res({ rows: e.data.rows, total: e.data.total, invalid: e.data.invalid });
            }
          };
          w.onerror = e => {
            console.error('[VIDA:worker] onerror | message:', e.message, '| filename:', e.filename, '| lineno:', e.lineno);
            w.terminate(); rej(new Error(e.message || 'Worker parse error'));
          };
          console.log('[VIDA:worker] postMessage | csvs:', csvs.length, '| names:', names);
          w.postMessage({ csvs, names });
        });
        return result;
      } catch (workerErr) { console.warn('[workerRun] Worker falhou, fallback main thread:', workerErr.message); }
    }
    // Fallback main thread
    let totTotal = 0, totInvalid = 0;
    const all = [], seen = new Set();
    for (let i = 0; i < csvs.length; i++) {
      const { data: rows, total, invalid } = parseHistLegacy(csvs[i]);
      totTotal += total; totInvalid += invalid;
      for (const r of rows) { const k = histDedupKey(r); if (!seen.has(k)) { seen.add(k); all.push(r); } }
      setProgress(50 + Math.round((i + 1) / csvs.length * 45), names[i] + ': ' + rows.length.toLocaleString('pt-BR') + ' registros');
      await new Promise(r => setTimeout(r, 0));
    }
    all.sort((a, b) => a.dh - b.dh);
    return { rows: all, total: totTotal, invalid: totInvalid };
  } else if (type === 'parseCid') {
    let all = [], cidTotal = 0, cidInvalid = 0;
    for (let i = 0; i < payload.buffers.length; i++) {
      setProgress(10 + Math.round(i / payload.buffers.length * 80), 'Lendo ' + payload.names[i] + '...');
      await new Promise(r => setTimeout(r, 0));
      const cidCsv = smartDecode(payload.buffers[i]);
      _checkLayoutFingerprint('cid', cidCsv, payload.names[i]);
      const parsed = parseCidFromText(cidCsv);
      const lineCount = Math.max(0, cidCsv.split(/\r?\n/).filter(l => l.trim()).length - 1);
      cidTotal += lineCount;
      cidInvalid += Math.max(0, lineCount - parsed.length);
      all = all.concat(parsed);
    }
    all.sort((a, b) => a.dh - b.dh);
    return { rows: all, total: cidTotal, invalid: cidInvalid };
  } else { throw new Error('Unknown type: ' + type); }
}

// ── deriveTriFromHist ─────────────────────────────────────────────────────────
export function deriveTriFromHist(histRows) {
  return histRows
    .filter(r => r.dhAcol || r.tEspTri != null)
    .map(r => {
      const dh = r.dhAcol || r.dh;
      const tEsp = r.tEspTri != null ? r.tEspTri
        : (r.dhAcol && r.dhAtend ? safeMinutes((r.dhAtend - r.dhAcol) / 60000, 600) : null);
      return {
        sourceLine: r.sourceLine,
        pront: r.pront || '',
        cor: r.cor,
        triador: '',
        dh,
        dhTri: r.dhAtend || null,
        dateKey: ymd(dh),
        anoMes: monthKey(dh),
        hora: dh.getHours(),
        diaSem: dh.getDay(),
        turno: dh.getHours() >= 7 && dh.getHours() < 19 ? 'D' : 'N',
        tEsp,
        tDur: r.tDurTri || null,
        _fromHist: true,
      };
    });
}

// ── fileToBuffer — FileReader em vez de File.arrayBuffer() (mais compativel) ──
export function fileToBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

// ── loadHist ──────────────────────────────────────────────────────────────────
export async function loadHist(fileOrFiles) {
  const files = fileOrFiles instanceof FileList ? [...fileOrFiles] : Array.isArray(fileOrFiles) ? fileOrFiles : fileOrFiles ? [fileOrFiles] : [];
  if (!files.length) return;
  showLoading('Lendo histórico...');
  setProgress(0, 'Lendo ' + files.length + ' arquivo(s)...');
  try {
    state.quality = [];
    const _isFirstLoad = state.raw.length === 0;
    console.log('[VIDA:hist] fileToBuffer -- inicio | arquivos:', files.map(f => f.name + ' (' + f.size + 'B)'));
    console.time('[VIDA:hist] fileToBuffer');
    const buffers = await Promise.all(files.map(fileToBuffer));
    console.timeEnd('[VIDA:hist] fileToBuffer');
    console.log('[VIDA:hist] buffers lidos | tamanhos:', buffers.map(b => b.byteLength + 'B'));
    const result = await workerRun('parseHist', { buffers, names: files.map(f => f.name) });
    setProgress(90, 'Finalizando...');
    if (!result.rows.length) throw new Error('Nenhum atendimento válido encontrado.');
    if (result.total != null) {
      state.quality.push({ type: 'Histórico', total: result.total, invalid: result.invalid ?? 0 });
    }
    state.raw = result.rows;
    state.files.hist = files.length === 1 ? files[0].name : files.length + ' arquivos';
    (async () => {
      try {
        await VidaDB.clear('atendimentos');
        const n = await VidaDB.bulkPut('atendimentos', result.rows);
        console.log(`[VidaDB] ${n.toLocaleString('pt-BR')} atendimentos salvos`);
        if (typeof window.refreshDbStats === 'function') window.refreshDbStats();
      } catch (dbErr) {
        console.warn('[VidaDB] save failed (memory data unaffected):', dbErr);
      }
    })();
    state.triRaw = deriveTriFromHist(state.raw);
    state.triSource = 'hist';
    state.files.tri = '';
    if (typeof window.updateTriBtn === 'function') window.updateTriBtn();
    if (typeof window.setupDates === 'function') window.setupDates();
    populateMedicoFilter();
    if (typeof window.applyFilters === 'function') window.applyFilters();
    if (typeof window.setHistFileName === 'function') window.setHistFileName(state.files.hist);
    const upload = document.getElementById('upload');
    if (upload) upload.style.display = 'none';
    const app = document.getElementById('app');
    if (app) app.classList.add('visible');
    setProgress(100, 'Histórico carregado.');
    hideLoading();
    const _qh = state.quality.find(x => x.type === 'Histórico');
    const _qMsg = _qh && _qh.invalid > 0 ? ` (${fmt(state.filt.length)} de ${fmt(_qh.total)} válidos)` : '';
    showToast(`Histórico carregado: ${fmt(state.filt.length)} atendimentos${_qMsg}.`, 'ok');
    if (typeof window.updateSourceChips === 'function') window.updateSourceChips();
    if (typeof window.updateQualityChip === 'function') window.updateQualityChip();
    if (typeof window.updateTtlCountdown === 'function') window.updateTtlCountdown();
    setTimeout(() => {
      const q = state.quality.find(x => x.type === 'Histórico');
      if (q && q.total > 0) {
        const invalRate = q.invalid / q.total;
        if (invalRate >= 0.2) showToast(`Atenção: ${(invalRate * 100).toFixed(0)}% das linhas foram ignoradas (${fmt(q.invalid)} de ${fmt(q.total)}). Verifique o formato do arquivo.`, 'warn', 7000);
      }
      const fmtN = (n, d = 1) => n == null || Number.isNaN(n) ? '-' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
      const ev = state.filt.filter(r => r.evadido).length;
      if (ev > 0 && state.filt.length > 0) {
        const evRate = fmtN(ev / state.filt.length * 100, 1);
        if (parseFloat(evRate.replace(',', '.')) >= 2) showToast(`${ev} evasões detectadas (${evRate}% do período). Verifique o fluxo de triagem.`, 'warn', 6000);
      }
      if (_isFirstLoad) {
        const noExtras = !state.cidRaw.length && state.triSource !== 'file' && !state.procRaw.length;
        if (noExtras) {
          showToast('1/3 — Adicione a planilha de Triagem para conformidade Manchester, tempos por enfermeiro e cruzamento de dados.', 'inf', 7000);
          setTimeout(() => showToast('2/3 — Adicione o arquivo CID para ver Notificáveis compulsórios e diagnósticos por médico.', 'inf', 7000), 8000);
          setTimeout(() => showToast('3/3 — Com todas as fontes, o painel Qualidade cruza os três arquivos e detecta inconsistências entre registros.', 'inf', 7000), 16000);
        }
      }
    }, 1200);
    const tri = state.pending.tri || (document.getElementById('triFileUp') ? document.getElementById('triFileUp').files[0] : null);
    if (tri && typeof window.loadTri === 'function') await window.loadTri(tri);
    const cid = state.pending.cid || (document.getElementById('cidFileUp') ? document.getElementById('cidFileUp').files : null);
    if (cid && cid.length && typeof window.loadCid === 'function') await window.loadCid(cid);
  } catch (err) {
    hideLoading();
    showToast('Erro ao ler histórico: ' + err.message, 'err');
    const status = document.getElementById('status');
    if (status) { status.textContent = 'Erro: ' + err.message; status.className = 'status mono error-state'; }
    console.error(err);
  }
}
