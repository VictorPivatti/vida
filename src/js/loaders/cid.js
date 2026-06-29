// loaders/cid.js — CID file loader

import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading, setProgress } from '../ui/progress.js';
import { setUploadStage } from '../ui/upload-stages.js';
import { validateUploadFiles } from '../ui/file-guard.js';
import { VidaDB } from '../storage/vidadb.js';
import { parseFilesViaWorker, workerRun, fileToBuffer } from './hist.js';

// ── loadCid ───────────────────────────────────────────────────────────────────
export async function loadCid(files) {
  if (!files || !files.length) return;
  const fileArr = [...files];
  try {
    await validateUploadFiles(fileArr, { kind: 'cid' });
  } catch (e) {
    if (e.message !== 'Importação cancelada.') showToast(e.message, 'warn');
    return;
  }
  showLoading('Lendo CID...');
  setUploadStage('reading', fileArr[0].name, 0, fileArr.length);
  try {
    let result;
    try {
      console.log('[VIDA:cid] tentando worker File pipeline');
      result = await parseFilesViaWorker(fileArr, 'cid');
    } catch (workerErr) {
      console.warn('[VIDA:cid] worker File falhou:', workerErr.message);
      const buffers = await Promise.all(fileArr.map((f, i) => fileToBuffer(f, (loaded, total) => {
        setUploadStage('reading', `${f.name} ${Math.round(loaded / total * 100)}%`, i, fileArr.length);
      })));
      result = await workerRun('parseCid', { buffers, names: fileArr.map(f => f.name) });
    }
    if (result.total != null) {
      state.quality.push({ type: 'CID', total: result.total, invalid: result.invalid ?? 0 });
    }
    setUploadStage('saving');
    state.cidRaw = result.rows;
    state.files.cid = fileArr.length + ' arquivo(s)';
    (async () => {
      try {
        await VidaDB.clear('cid');
        await VidaDB.bulkPut('cid', result.rows);
        if (typeof window.refreshDbStats === 'function') window.refreshDbStats();
      } catch (e) { console.warn('[VidaDB] CID:', e); }
    })();
    if (typeof window.updateUploadStatuses === 'function') window.updateUploadStatuses();
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
