// loaders/hist.js — Histórico file loader and workerRun orchestrator
// Extracted from src/index.template.html <script> block (Task A.1).
// NOTE: The monolith's <script> block still contains these functions.
//       This module coexists with it during the cutover phase.

import { state } from '../state.js';
import { parseHistLegacy, safeMinutes, histDedupKey } from '../parsers/hist.js';
import { parseCidFromText } from '../parsers/cid.js';
import { bufferToCsv } from '../parsers/buffer-to-csv.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading, setProgress } from '../ui/progress.js';
import { setUploadStage } from '../ui/upload-stages.js';
import { renderAll } from '../render/index.js';
import { VidaDB } from '../storage/vidadb.js';
import { ymd, monthKey } from '../utils/dates.js';
import { fmt } from '../utils/dom.js';
import { populateMedicoFilter } from '../filters.js';
import { hideExpiredHomeNotice } from '../ui/home-notice.js';
import { validateUploadFiles } from '../ui/file-guard.js';
import { clearAuxiliaryData } from './aux-clear.js';
import { maybePromptFirstRunMetas } from '../ui/first-run-metas.js';

let _histLoadActive = false;

// ── Layout fingerprint check ──────────────────────────────────────────────────
function _checkLayoutFingerprint(type, csv, name) {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = '_fp_' + type;
    const headerLine = (csv || '').split(/\r?\n/)[0].trim().replace(/;+$/, '');
    if (!headerLine) return;
    const stored = localStorage.getItem(key);
    if (!stored) { localStorage.setItem(key, headerLine); return; }
    if (stored.replace(/;+$/, '') !== headerLine) {
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

// ── Leitura via fetch(blobURL) — contorna travamento de arrayBuffer/FileReader ─
async function _readFileViaFetch(file, onProgress) {
  const url = URL.createObjectURL(file);
  try {
    onProgress?.(0, file.size);
    const ab = await Promise.race([
      (async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch status ' + res.status);
        return res.arrayBuffer();
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('fetch timeout 90s')), 90000)),
    ]);
    onProgress?.(file.size, file.size);
    console.log('[VIDA:hist] fetch(blobURL) OK |', file.name, ab.byteLength + 'B');
    return ab;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Pipeline worker: File → XLSX → parse (sem leitura na main thread) ────────
export async function parseFilesViaWorker(files, mode = 'hist') {
  const url = _getHistWorkerUrl();
  if (!url || typeof Worker === 'undefined') throw new Error('Worker indisponível');
  const fpType = mode === 'cid' ? 'cid' : 'hist';
  const parseBase = mode === 'cid' ? 5 : 5;
  return new Promise((res, rej) => {
    const w = new Worker(url);
    w.onmessage = e => {
      const d = e.data;
      if (d.type === 'read') {
        const base = d.phase === 'lendo' ? parseBase : d.phase === 'convertendo' ? 40 : 8;
        const msg = d.phase === 'convertendo'
          ? 'Convertendo ' + d.name + (d.bytes ? ` (${(d.bytes / 1024 / 1024).toFixed(1)} MB)` : '…')
          : d.phase?.startsWith('lendo-') ? `Lendo (${d.phase.slice(6)}) ${d.name}…`
          : d.phase?.startsWith('ok-') ? `Lido via ${d.phase.slice(3)} ${d.name}`
          : d.phase?.startsWith('falhou-') ? `Falhou ${d.phase.slice(7)}: ${d.error || ''}`
          : 'Lendo ' + d.name + '…';
        if (d.phase === 'convertendo') setUploadStage('converting', d.name);
        else if (d.i) setProgress(base + Math.round((d.i - 1) / d.n * 18), msg);
        else setProgress(base, msg);
        console.log('[VIDA:worker] read |', d.phase, d.name, d.bytes || d.error || '');
      } else if (d.type === 'read-progress') {
        setUploadStage('reading', `${d.name} ${Math.round(d.loaded / d.total * 100)}%`);
      } else if (d.type === 'fingerprint') {
        _checkLayoutFingerprint(fpType, d.headerLine + '\n', d.name);
      } else if (d.type === 'stage') {
        setUploadStage(d.stage || 'parsing');
      } else if (d.type === 'progress') {
        setUploadStage('parsing', `${d.name}: ${d.count.toLocaleString('pt-BR')} registros`);
        setProgress(50 + Math.round(d.i / d.n * 45), d.name + ': ' + d.count.toLocaleString('pt-BR') + ' registros');
      } else if (d.type === 'error') {
        w.terminate(); rej(new Error(d.message));
      } else if (d.type === 'done') {
        console.log('[VIDA:worker] done | rows:', d.rows?.length, '| total:', d.total);
        w.terminate(); res({ rows: d.rows, total: d.total, invalid: d.invalid });
      }
    };
    w.onerror = e => {
      console.error('[VIDA:worker] onerror |', e.message, e.filename, e.lineno);
      w.terminate(); rej(new Error(e.message || 'Worker error'));
    };
    console.log('[VIDA:worker] File pipeline | mode:', mode, '|', files.map(f => f.name + ' (' + f.size + 'B)'));
    w.postMessage({ files, mode });
  });
}

/** @deprecated alias — use parseFilesViaWorker(files, 'hist') */
async function _parseHistViaWorker(files) {
  return parseFilesViaWorker(files, 'hist');
}

// ── workerRun — async parsing orchestrator ────────────────────────────────────
export async function workerRun(type, payload) {
  if (type === 'parseHist') {
    // Fase A (main thread): buffer → CSV string; precisa da lib XLSX para .xls/.xlsx
    const csvs = [], names = [];
    for (let i = 0; i < payload.buffers.length; i++) {
      const buf = payload.buffers[i], name = payload.names[i];
      setUploadStage('reading', name, i, payload.buffers.length);
      await new Promise(r => setTimeout(r, 0));
      const csv = await bufferToCsv(buf, name, { onConverting: () => setUploadStage('converting', name) });
      _checkLayoutFingerprint('hist', csv, name);
      csvs.push(csv); names.push(name);
    }
    setUploadStage('parsing');
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
            } else if (e.data.type === 'error') {
              w.terminate(); rej(new Error(e.data.message));
            } else {
              console.log('[VIDA:worker] onmessage | type:', e.data.type, '| rows:', e.data.rows?.length, '| total:', e.data.total, '| invalid:', e.data.invalid);
              w.terminate(); res({ rows: e.data.rows, total: e.data.total, invalid: e.data.invalid });
            }
          };
          w.onerror = e => {
            console.error('[VIDA:worker] onerror | message:', e.message, '| filename:', e.filename, '| lineno:', e.lineno);
            w.terminate(); rej(new Error(e.message || 'Worker parse error'));
          };
          console.log('[VIDA:worker] postMessage | csvs:', csvs.length, '| names:', names, '| mode: hist');
          w.postMessage({ csvs, names, mode: 'hist' });
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
      setUploadStage('reading', payload.names[i], i, payload.buffers.length);
      await new Promise(r => setTimeout(r, 0));
      const cidCsv = await bufferToCsv(payload.buffers[i], payload.names[i], {
        onConverting: () => setUploadStage('converting', payload.names[i]),
      });
      _checkLayoutFingerprint('cid', cidCsv, payload.names[i]);
      setUploadStage('parsing', payload.names[i]);
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

// ── fileToBuffer — leitura com stream para arquivos grandes (evita freeze) ───
export async function fileToBuffer(file, onProgress) {
  const size = file.size || 0;
  if (!size) return new ArrayBuffer(0);

  const report = (loaded, total) => { if (typeof onProgress === 'function') onProgress(loaded, total); };

  const isSpreadsheet = /\.xlsx?$/i.test(file.name || '');
  // Stream sempre que disponível para planilhas (FileReader trava em XLSX Vivver ~1–3 MB)
  const useStream = typeof file.stream === 'function' && (isSpreadsheet || size > 256 * 1024);

  if (useStream) {
    console.log('[VIDA:hist] fileToBuffer | stream |', file.name, size + 'B');
    const reader = file.stream().getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      report(received, size);
      await new Promise(r => setTimeout(r, 0));
    }
    const out = new Uint8Array(received);
    let pos = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.byteLength; }
    console.log('[VIDA:hist] fileToBuffer | stream OK |', received + 'B');
    return out.buffer;
  }

  return new Promise((resolve, reject) => {
    console.log('[VIDA:hist] fileToBuffer | FileReader (fallback) |', file.name, size + 'B');
    const r = new FileReader();
    let lastTick = Date.now();
    const watchdog = setInterval(() => {
      if (Date.now() - lastTick > 120000) {
        r.abort();
        clearInterval(watchdog);
        reject(new Error('Leitura excedeu 2 min — tente exportar como CSV no Vivver.'));
      }
    }, 5000);
    r.onprogress = e => {
      if (e.lengthComputable) { lastTick = Date.now(); report(e.loaded, e.total); }
    };
    r.onload = e => { clearInterval(watchdog); resolve(e.target.result); };
    r.onerror = () => { clearInterval(watchdog); reject(r.error || new Error('Falha ao ler arquivo')); };
    r.onabort = () => { clearInterval(watchdog); reject(new Error('Leitura cancelada')); };
    r.readAsArrayBuffer(file);
  });
}

// ── loadHist ──────────────────────────────────────────────────────────────────
export async function loadHist(fileOrFiles) {
  const files = fileOrFiles instanceof FileList ? [...fileOrFiles] : Array.isArray(fileOrFiles) ? fileOrFiles : fileOrFiles ? [fileOrFiles] : [];
  if (!files.length) return;
  if (_histLoadActive) {
    showToast('Aguarde — outro carregamento de histórico em andamento.', 'warn');
    return;
  }
  _histLoadActive = true;
  try {
    try {
      await validateUploadFiles(files, { kind: 'hist' });
    } catch (e) {
      if (e.message !== 'Importação cancelada.') showToast(e.message, 'warn');
      return;
    }
    showLoading('Lendo histórico...');
    setProgress(0, 'Lendo ' + files.length + ' arquivo(s)...');
    try {
    state.quality = [];
    const _isFirstLoad = state.raw.length === 0;
    const _replacing = state.raw.length > 0;
    let result;
    const names = files.map(f => f.name);
    // 1) Worker lê File diretamente (off main thread — nao freezes iCloud)
    try {
      console.log('[VIDA:hist] tentando worker File pipeline');
      result = await _parseHistViaWorker(files);
    } catch (workerErr) {
      console.warn('[VIDA:hist] worker File falhou:', workerErr.message);
      // 2) fetch(blobURL) na main com timeout
      try {
        console.log('[VIDA:hist] tentando fetch(blobURL)…');
        const buffers = await Promise.all(files.map(f => _readFileViaFetch(f, (loaded, total) => {
          setProgress(Math.round(loaded / total * 40), `Lendo ${f.name}… ${Math.round(loaded / total * 100)}%`);
        })));
        result = await workerRun('parseHist', { buffers, names });
      } catch (fetchErr) {
        console.warn('[VIDA:hist] fetch falhou:', fetchErr.message);
        // 3) Fallback FileReader na main thread
        console.log('[VIDA:hist] fallback fileToBuffer');
        const buffers = await Promise.all(files.map(f => fileToBuffer(f, (loaded, total) => {
          setProgress(Math.round(loaded / total * 40), `Lendo ${f.name}… ${Math.round(loaded / total * 100)}%`);
        })));
        result = await workerRun('parseHist', { buffers, names });
      }
    }
    setProgress(90, 'Finalizando...');
    if (!result.rows.length) throw new Error('Nenhum atendimento válido encontrado.');
    if (result.total != null) {
      state.quality.push({ type: 'Histórico', total: result.total, invalid: result.invalid ?? 0 });
    }
    if (_replacing) await clearAuxiliaryData();
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
    hideExpiredHomeNotice();
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
        setTimeout(() => maybePromptFirstRunMetas(), 2500);
        const noExtras = !state.cidRaw.length && state.triSource !== 'file' && state.triSource !== 'db' && !state.procRaw.length;
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
  } finally {
    _histLoadActive = false;
  }
}
