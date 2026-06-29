// loaders/tri.js — Triagem file loader
// Extracted from src/index.template.html <script> block (Task A.1).
// NOTE: The monolith's <script> block still contains these functions.
//       This module coexists with it during the cutover phase.

import { state } from '../state.js';
import { parseBestTri } from '../parsers/tri.js';
import { sheetData } from '../parsers/workbook.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading, setProgress } from '../ui/progress.js';
import { VidaDB } from '../storage/vidadb.js';

// ── Layout fingerprint check (inline — same logic as in hist.js loader) ───────
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
      showToast('⚠ Layout de ' + type + ' diferente do esperado em "' + name + '". Verifique se o arquivo é do formato correto.', 'wn');
      localStorage.setItem(key, headerLine);
    }
  } catch (e) {}
}

// ── loadTri ───────────────────────────────────────────────────────────────────
export async function loadTri(file) {
  if (!file) return;
  showLoading('Lendo triagem...');
  setProgress(30, 'Lendo triagem...');
  try {
    const triData = await sheetData(file);
    _checkLayoutFingerprint('tri', triData.csv, file.name);
    state.triRaw = parseBestTri(triData);
    state.files.tri = file.name;
    state.triSource = 'file';
    (async () => {
      try {
        await VidaDB.clear('triagem');
        await VidaDB.bulkPut('triagem', state.triRaw);
        if (typeof window.refreshDbStats === 'function') window.refreshDbStats();
      } catch (e) { console.warn('[VidaDB] Tri:', e); }
    })();
    if (typeof window.updateTriBtn === 'function') window.updateTriBtn();
    if (typeof window.applyFilters === 'function') window.applyFilters();
    setProgress(100, 'Triagem carregada.');
    hideLoading();
    showToast('Triagem carregada: ' + state.triRaw.length.toLocaleString('pt-BR') + ' registros.', 'ok');
  } catch (err) {
    hideLoading();
    showToast('Erro ao ler triagem: ' + err.message, 'err');
    const status = document.getElementById('status');
    if (status) status.textContent = 'Erro: ' + err.message;
    console.error(err);
  }
}
