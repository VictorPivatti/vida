// loaders/exames.js — Exames laboratoriais (PDF) file loader
// Extracted from src/index.template.html <script> block (Task A.1).
// NOTE: The monolith's <script> block still contains these functions.
//       This module coexists with it during the cutover phase.

import { state } from '../state.js';
import { parseExamesPdf } from '../parsers/exames.js';
import { showToast } from '../ui/toast.js';
import { fmt } from '../utils/dom.js';
import { markDirty } from '../render/index.js';

// ── loadPdfJs (lazy CDN loader) ───────────────────────────────────────────────
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      res(window.pdfjsLib);
    };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── loadExamesPdf ─────────────────────────────────────────────────────────────
export async function loadExamesPdf(file) {
  try {
    const lib = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const records = await parseExamesPdf(lib, buf);
    if (!records || !records.length) { showToast('Nenhuma guia encontrada no PDF', 'err'); return; }
    state.examesRaw = records;
    try { if (typeof window.updateUploadStatuses === 'function') window.updateUploadStatuses(); } catch (e) {}
    markDirty('exames');
    showToast('Exames carregados: ' + fmt(records.length) + ' guias', 'ok', 3000);
    if (typeof window.renderActivePane === 'function') window.renderActivePane();
  } catch (e) {
    console.error('[VIDA] Erro ao processar PDF de exames:', e);
    showToast('Erro ao processar PDF: ' + e.message, 'err', 6000);
  }
}
