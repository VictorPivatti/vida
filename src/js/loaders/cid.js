// loaders/cid.js — CID file loader
// Extracted from src/index.template.html <script> block (Task A.1).
// NOTE: The monolith's <script> block still contains these functions.
//       This module coexists with it during the cutover phase.

import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading, setProgress } from '../ui/progress.js';
import { VidaDB } from '../storage/vidadb.js';
import { workerRun } from './hist.js';

// ── loadCid ───────────────────────────────────────────────────────────────────
export async function loadCid(files) {
  if (!files || !files.length) return;
  showLoading('Lendo CID...');
  setProgress(5, 'Lendo CID...');
  try {
    const fileArr = [...files];
    const buffers = await Promise.all(fileArr.map(f => f.arrayBuffer()));
    const result = await workerRun('parseCid', { buffers, names: fileArr.map(f => f.name) });
    state.cidRaw = result.rows;
    state.files.cid = fileArr.length + ' arquivo(s)';
    (async () => {
      try {
        await VidaDB.clear('cid');
        await VidaDB.bulkPut('cid', result.rows);
        if (typeof window.refreshDbStats === 'function') window.refreshDbStats();
      } catch (e) { console.warn('[VidaDB] CID:', e); }
    })();
    const cidBtn = document.getElementById('cidBtn');
    if (cidBtn) {
      cidBtn.textContent = 'CID: ' + state.cidRaw.length.toLocaleString('pt-BR');
      cidBtn.classList.add('ok');
    }
    if (typeof window.applyFilters === 'function') window.applyFilters();
    setProgress(100, 'CID carregado.');
    hideLoading();
    showToast('CID: ' + state.cidRaw.length.toLocaleString('pt-BR') + ' registros.', 'ok');
  } catch (err) {
    hideLoading();
    showToast('Erro CID: ' + err.message, 'err');
    console.error(err);
  }
}
