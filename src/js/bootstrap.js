// bootstrap.js — app initialisation helpers (browser-only; not testable in Node/jsdom)
//
// Extracted from the DOMContentLoaded block in src/index.template.html.
// The <script> block still contains identical implementations; this module
// version runs first (IIFE) and the script-block version runs after — both
// operate on the same shared `state` object, so double-init is safe.

import { state, UC_KEY, RECEP_KEY, RECEP_OVERRIDE_KEY } from './state.js';
import { VidaDB } from './storage/vidadb.js';
import { $ } from './utils/dom.js';
import { showToast } from './ui/toast.js';

// ── loadUnitConfig ─────────────────────────────────────────────────────────────
// Mirrors the script-block function of the same name.
// Reads unit configuration from localStorage and populates window.UC so that
// the script-block modal helpers (_openUnitConfig, _saveUnitConfig) still work.
export function loadUnitConfig() {
  try {
    const raw = localStorage.getItem(UC_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    // Keep window.UC in sync for the script-block stubs (present during transition)
    if (typeof window.UC === 'object' && window.UC !== null) {
      Object.assign(window.UC, parsed);
    }
  } catch (e) {
    // localStorage may be blocked in sandboxed iframes — silently ignore
  }
}

// ── autoLoadFromDB ─────────────────────────────────────────────────────────────
// Checks IndexedDB for saved records and shows the "resume" banner if data
// exists and has not expired. Mirrors the script-block autoLoadFromDB().
export async function autoLoadFromDB() {
  try {
    const s = await VidaDB.stats();
    if (s.atendimentos === 0) return; // empty db — wait for manual upload

    // TTL 12h: patient data must not persist beyond a shift
    if (VidaDB.dataExpired()) {
      try { await VidaDB.clearAll(); } catch (e) { console.warn('[VIDA] TTL clear:', e); }
      VidaDB.clearTimestamp();
      showToast(
        'Dados de pacientes expiraram (12h) e foram removidos automaticamente por segurança. Recarregue os relatórios.',
        'inf',
        9000
      );
      try { window.refreshDbStats?.(); } catch (e) {}
      return;
    }

    // Show banner and wait for user click — do NOT auto-load
    const banner = $('upSavedBanner');
    const savedText = $('upSavedText');
    const savedBtn = $('upSavedBtn');
    if (banner && savedText) {
      savedText.innerHTML =
        `Continuar de onde parou <span style="font-weight:400;opacity:.7">· ${s.atendimentos.toLocaleString('pt-BR')} registros</span>`;
      banner.style.display = 'flex';
    }
    if (savedBtn) {
      savedBtn.onclick = async () => {
        banner.style.display = 'none';
        // Delegate to the full _execLoadFromDB that lives in the script block
        if (typeof window._execLoadFromDB === 'function') {
          await window._execLoadFromDB(s);
        }
      };
    }
  } catch (e) {
    console.warn('[VIDA] auto-load falhou:', e);
  }
}

// ── loadRecepcionados ──────────────────────────────────────────────────────────
// Restores persisted recepcionados map from localStorage into state.
function loadRecepcionados() {
  try {
    const r = localStorage.getItem(RECEP_KEY);
    if (r) state.recepcionados = JSON.parse(r) || {};
  } catch (e) {}
  try {
    const r = localStorage.getItem(RECEP_OVERRIDE_KEY);
    if (r) state.recepOverride = JSON.parse(r) || {};
  } catch (e) {}
}

// ── bindDrop helper ────────────────────────────────────────────────────────────
function bindDrop(drop, input, handler) {
  if (!drop || !input) return;
  input.addEventListener('change', () => handler(input.files));
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag');
    handler(e.dataTransfer.files);
    drop.classList.add('ready');
  });
}

// ── bindEvents ────────────────────────────────────────────────────────────────
// Attaches file-input, drag-drop, and UI event listeners.
// All heavy handlers (loadHist, loadTri, etc.) still live in the script block;
// they are accessed via window.* so this module does not need to import them.
export function bindEvents() {
  // ── History drop zone ────────────────────────────────────────────────────
  const histDrop = $('histDrop');
  const histFile = $('histFile');
  if (histDrop && histFile) {
    bindDrop(histDrop, histFile, files => {
      const fn = $('histFileName');
      if (fn && files && files.length) {
        fn.textContent = files.length === 1 ? files[0].name : `${files.length} arquivos`;
        histDrop.classList.add('ready');
      }
      window.loadHist?.(files);
    });
  }

  // ── Full-screen drag overlay ──────────────────────────────────────────────
  (function () {
    const overlay = $('upDragOverlay');
    if (!overlay) return;
    let _dragCount = 0;
    document.addEventListener('dragenter', e => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      _dragCount++;
      overlay.classList.add('active');
    });
    document.addEventListener('dragleave', () => {
      _dragCount = Math.max(0, _dragCount - 1);
      if (_dragCount === 0) overlay.classList.remove('active');
    });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
      e.preventDefault();
      _dragCount = 0;
      overlay.classList.remove('active');
      const files = e.dataTransfer?.files;
      if (files && files.length) {
        const fn = $('histFileName');
        if (fn) {
          fn.textContent = files.length === 1 ? files[0].name : `${files.length} arquivos`;
          $('histDrop')?.classList.add('ready');
        }
        window.loadHist?.(files);
      }
    });
  })();

  // ── Triagem drop zone ─────────────────────────────────────────────────────
  bindDrop($('triDrop'), $('triFileUp'), files => {
    state.pending.tri = files[0] || null;
    $('triDrop')?.classList.add('ready');
    const small = document.querySelector('#triDrop .drop-body small') ||
                  document.querySelector('#triDrop small');
    if (small) small.textContent = files[0]?.name || 'Opcional';
    if (files[0]) {
      const num = document.querySelector('#triDrop .drop-num');
      if (num) { num.style.background = 'var(--ok)'; num.style.color = '#fff'; }
    }
    if (files[0] && state.raw.length) window.loadTri?.(files[0]);
  });

  // ── CID drop zone ─────────────────────────────────────────────────────────
  bindDrop($('cidDrop'), $('cidFileUp'), files => {
    state.pending.cid = [...files];
    $('cidDrop')?.classList.add('ready');
    const small = document.querySelector('#cidDrop .drop-body small') ||
                  document.querySelector('#cidDrop small');
    if (small) small.textContent = `${files.length} arquivo(s) selecionado(s)`;
    if (files.length) {
      const num = document.querySelector('#cidDrop .drop-num');
      if (num) { num.style.background = 'var(--ok)'; num.style.color = '#fff'; }
    }
    if (files.length && state.raw.length) window.loadCid?.(files);
  });

  // ── Exames button / file input ────────────────────────────────────────────
  const examesBtn = $('examesBtn');
  const examesFile = $('examesFile');
  if (examesBtn && examesFile) {
    examesBtn.onclick = () => examesFile.click();
    examesFile.onchange = e => {
      const f = e.target.files[0];
      if (f) window.loadExamesPdf?.(f);
    };
  }

  // ── Other upload buttons ──────────────────────────────────────────────────
  const triBtn = $('triBtn');   if (triBtn)  triBtn.onclick  = () => $('triFile')?.click();
  const cidBtn = $('cidBtn');   if (cidBtn)  cidBtn.onclick  = () => $('cidFile')?.click();
  const procBtn = $('procBtn'); if (procBtn) procBtn.onclick = () => $('procFile')?.click();

  const triFile  = $('triFile');  if (triFile)  triFile.onchange  = e => window.loadTri?.(e.target.files[0]);
  const cidFile  = $('cidFile');  if (cidFile)  cidFile.onchange  = e => window.loadCid?.(e.target.files);
  const procFile = $('procFile'); if (procFile) procFile.onchange = e => window.loadProcedimentos?.(e.target.files[0]);

  // ── Theme / print / new ───────────────────────────────────────────────────
  const themeBtn = $('themeBtn'); if (themeBtn) themeBtn.onclick = () => window.toggleTheme?.();
  const printBtn = $('printBtn'); if (printBtn) printBtn.onclick = () => window.exportarPDF?.();
  const newBtn   = $('newBtn');   if (newBtn)   newBtn.onclick   = () => window.resetApp?.();

  document.querySelectorAll('[data-theme-choice]').forEach(btn => {
    btn.addEventListener('click', () => window.setTheme?.(btn.dataset.themeChoice));
  });

  // ── Procedimentos filters ─────────────────────────────────────────────────
  ['procFiltroEsp', 'procFiltroProf', 'procFiltroProc', 'procFiltroFat'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', () => {
      window._dirtyPanes?.add?.('procedimentos');
      window.renderProcedimentos?.();
    });
  });

  // ── History file-switch (topbar) ──────────────────────────────────────────
  const hsw = $('histFileSwitch');
  if (hsw) {
    hsw.addEventListener('change', e => {
      if (!e.target.files.length) return;
      VidaDB.clear('atendimentos').catch(() => {}).finally(() => window.loadHist?.(e.target.files));
      e.target.value = '';
    });
  }

  // ── Sidebar navigation ────────────────────────────────────────────────────
  document.querySelectorAll('.nav-item[data-pane]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item[data-pane]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      $('pane-' + item.dataset.pane)?.classList.add('active');
      const titleEl = document.getElementById('topbarSectionTitle');
      if (titleEl) titleEl.textContent = item.dataset.label || 'Visão geral';
      window.renderActivePane?.();
    });
  });

  // ── Shortcut pills ────────────────────────────────────────────────────────
  document.querySelectorAll('[data-shortcut]').forEach(b => {
    b.addEventListener('click', () => {
      const k = b.dataset.shortcut;
      window.shortcut?.(k);
      document.querySelectorAll('[data-shortcut]').forEach(x => x.classList.toggle('active-pill', x.dataset.shortcut === k));
    });
  });

  // ── Metas modal ───────────────────────────────────────────────────────────
  const metasBtn    = $('metasBtn');
  const metasClose  = $('metasClose');
  const metasClose2 = $('metasClose2');
  const metasApply  = $('metasApply');
  const metasModal  = $('metasModal');
  if (metasBtn)    metasBtn.onclick    = () => { metasModal?.classList.add('open'); window.renderRecepTable?.(); };
  if (metasClose)  metasClose.onclick  = () => metasModal?.classList.remove('open');
  if (metasClose2) metasClose2.onclick = () => metasModal?.classList.remove('open');
  if (metasModal)  metasModal.addEventListener('click', e => { if (e.target === metasModal) metasModal.classList.remove('open'); });
  if (metasApply)  metasApply.onclick  = () => {
    window.savePrefs?.();
    window.applyFilters?.();
    if (state.triRaw.length) window.renderEvasao?.(state.triFilt);
    else if (state.raw.length) window.renderEvasao?.(state.filt.map(r => ({ ...r, cor: r.cor })));
    metasModal?.classList.remove('open');
  };

  // ── Date / filter controls ────────────────────────────────────────────────
  ['dateStart', 'dateEnd', 'turno'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', () => window.applyFilters?.());
  });
  const fmEl = $('filtroMedico');
  if (fmEl) {
    let _fmT;
    fmEl.addEventListener('input', () => { clearTimeout(_fmT); _fmT = setTimeout(() => window.applyFilters?.(), 250); });
  }
  const frEl = $('filtroRisco');
  if (frEl) frEl.addEventListener('change', () => window.applyFilters?.());

  ['metaTri', 'metaMed', 'metaTotal', 'metaRet', 'metaVol', 'capMed', 'capTri'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', () => window.savePrefs?.());
  });

  // ── Search inputs ─────────────────────────────────────────────────────────
  const searchMed = $('searchMed');
  if (searchMed) searchMed.addEventListener('input', () => window.renderMedTable?.(window.medRows?.()));
  const searchCid = $('searchCid');
  if (searchCid) searchCid.addEventListener('input', () => window.renderCidTable?.());

  // ── Report buttons ────────────────────────────────────────────────────────
  const copyBtn = $('copyReportBtn');
  if (copyBtn) copyBtn.addEventListener('click', () => window.copyReport?.());
  const dlBtn = $('downloadReportBtn');
  if (dlBtn) dlBtn.addEventListener('click', () => window.downloadReport?.());

  // ── Recepcionados (bootstrap only — persists across page loads) ───────────
  loadRecepcionados();
}
