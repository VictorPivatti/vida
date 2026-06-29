// loaders/proc.js — Procedimentos file loader
// Extracted from src/index.template.html <script> block (Task A.1).
// NOTE: The monolith's <script> block still contains these functions.
//       This module coexists with it during the cutover phase.

import { state } from '../state.js';
import { parseProcedimentosText } from '../parsers/proc.js';
import { smartDecode } from '../parsers/workbook.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/progress.js';
import { markDirty } from '../render/index.js';
import { fmt } from '../utils/dom.js';

// ── Layout fingerprint check (inline) ────────────────────────────────────────
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

// ── Helper: sum over array field ──────────────────────────────────────────────
function sum(arr, fn) {
  return arr.reduce((s, r) => s + (fn(r) || 0), 0);
}

// ── loadProcedimentos ─────────────────────────────────────────────────────────
export async function loadProcedimentos(file) {
  if (!file) return;
  showLoading('Lendo procedimentos...');
  try {
    const text = smartDecode(await file.arrayBuffer());
    _checkLayoutFingerprint('proc', text, file.name);
    const rows = parseProcedimentosText(text);
    if (!rows.length) throw new Error('Nenhum procedimento válido encontrado.');
    state.procRaw = rows;
    state.files.proc = file.name;
    try { if (typeof window.updateUploadStatuses === 'function') window.updateUploadStatuses(); } catch (e) {}
    showToast('Procedimentos carregados: ' + fmt(sum(rows, r => r.qde)) + ' registros de produção.', 'ok');
    hideLoading();
    markDirty();
    if (typeof window.renderProcedimentos === 'function') window.renderProcedimentos();
  } catch (err) {
    hideLoading();
    showToast('Erro em procedimentos: ' + err.message, 'err');
    console.error(err);
  }
}
