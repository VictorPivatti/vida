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
import { showExpiredHomeNotice, hideExpiredHomeNotice, initExpiredHomeNotice, bindExpiredHomeNotice } from './ui/home-notice.js';
import { updateHomeFromStats, renderHomeSourceChecklist } from './ui/home-sources.js';
import { initOfflineGuards } from './ui/offline.js';
import { showLoading, hideLoading } from './ui/progress.js';
import { setupDates, populateMedicoFilter, applyFilters } from './filters.js';
import { refreshDbStats } from './storage/dbstats.js';
import { updateTtlCountdown } from './ui/ttl.js';
import { deriveTriFromHist } from './loaders/hist.js';
import { markDirty } from './render/index.js';

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
    window.UC = Object.assign(window.UC || {}, parsed);
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
      showExpiredHomeNotice();
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
    let period = null;
    try { period = await VidaDB.getPeriodBounds(); } catch (e) { /* IDB indisponível em testes */ }
    updateHomeFromStats(s, period);
    if (banner && savedText) {
      savedText.innerHTML =
        `Continuar de onde parou <span>· ${s.atendimentos.toLocaleString('pt-BR')} registros</span>`;
      banner.style.display = 'flex';
    }
    if (savedBtn && !savedBtn.dataset.bound) {
      savedBtn.dataset.bound = '1';
      savedBtn.onclick = async () => {
        if (VidaDB.dataExpired()) {
          try { await VidaDB.clearAll(); } catch (e) { console.warn('[VIDA] TTL clear on resume:', e); }
          VidaDB.clearTimestamp();
          banner.style.display = 'none';
          showExpiredHomeNotice();
          showToast('Dados de pacientes expiraram (12h) e foram removidos por segurança. Recarregue os relatórios.', 'warn', 9000);
          try { window.refreshDbStats?.(); } catch (e) {}
          return;
        }
        banner.style.display = 'none';
        await _execLoadFromDB(s);
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
    histDrop.addEventListener('click', () => {
      if (histDrop.classList.contains('loading')) return;
      histFile.click();
    });
    histDrop.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!histDrop.classList.contains('loading')) histFile.click();
      }
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
    examesBtn.onclick = () => { examesFile.click(); window.toggleUploadMenu?.(); };
    examesFile.onchange = e => {
      const f = e.target.files[0];
      if (f) window.loadExamesPdf?.(f);
    };
  }

  // ── Other upload buttons ──────────────────────────────────────────────────
  const triBtn = $('triBtn');
  if (triBtn) triBtn.onclick = () => { $('triFile')?.click(); window.toggleUploadMenu?.(); };
  const cidBtn = $('cidBtn');
  if (cidBtn) cidBtn.onclick = () => { $('cidFile')?.click(); window.toggleUploadMenu?.(); };
  const procBtn = $('procBtn');
  if (procBtn) procBtn.onclick = () => { $('procFile')?.click(); window.toggleUploadMenu?.(); };

  const triFile  = $('triFile');  if (triFile)  triFile.onchange  = e => window.loadTri?.(e.target.files[0]);
  const cidFile  = $('cidFile');  if (cidFile)  cidFile.onchange  = e => window.loadCid?.(e.target.files);
  const procFile = $('procFile'); if (procFile) procFile.onchange = e => window.loadProcedimentos?.(e.target.files[0]);

  // ── Theme / print / new ───────────────────────────────────────────────────
  const themeBtn = $('themeBtn'); if (themeBtn) themeBtn.onclick = () => window.toggleTheme?.();
  const printBtn = $('printBtn'); if (printBtn) printBtn.onclick = () => window.exportarPDF?.();
  const exportBtn = $('exportBtn'); if (exportBtn) exportBtn.onclick = () => window.exportXLSX?.();
  const exportMedBtn = $('exportMedBtn'); if (exportMedBtn) exportMedBtn.onclick = () => window.exportMedXlsx?.();
  const presentationBtn = $('presentationBtn');
  if (presentationBtn) presentationBtn.onclick = () => window.togglePresentationMode?.();
  const newBtn   = $('newBtn');   if (newBtn)   newBtn.onclick   = () => window.resetApp?.();

  document.querySelectorAll('[data-theme-choice]').forEach(btn => {
    btn.addEventListener('click', () => window.setTheme?.(btn.dataset.themeChoice));
  });

  // ── Procedimentos filters ─────────────────────────────────────────────────
  ['procFiltroEsp', 'procFiltroProf', 'procFiltroProc', 'procFiltroFat'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', () => {
      markDirty('procedimentos');
      window.renderProcedimentos?.();
    });
  });

  // ── History file-switch (topbar) ──────────────────────────────────────────
  const hsw = $('histFileSwitch');
  if (hsw) {
    hsw.addEventListener('change', async e => {
      if (!e.target.files.length) return;
      try {
        await VidaDB.clear('atendimentos');
      } catch (err) { /* ignore */ }
      window.loadHist?.(e.target.files);
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

  ['metaTri', 'metaMed', 'metaTotal', 'metaRet', 'metaEvasao', 'metaVol', 'capMed', 'capTri',
    'metaVermelho', 'metaLaranja', 'metaAmarelo', 'metaVerde', 'metaAzul', 'metaBranco'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', () => window.savePrefs?.());
  });

  // ── Pacientes ─────────────────────────────────────────────────────────────
  const btnBuscaPront = $('btnBuscaPront');
  const searchPront = $('searchPront');
  const runBuscaPront = () => window.buscaProntuario?.(searchPront?.value?.trim() || '');
  if (btnBuscaPront) btnBuscaPront.onclick = runBuscaPront;
  if (searchPront) {
    searchPront.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); runBuscaPront(); }
    });
  }
  const btnProntTop = $('btnProntTop');
  if (btnProntTop) btnProntTop.onclick = () => window.showTopRetornos?.();
  const pacienteResult = $('pacienteResult');
  if (pacienteResult) {
    pacienteResult.addEventListener('click', e => {
      const btn = e.target.closest('.btn-pront-hist');
      if (!btn?.dataset.pront) return;
      if (searchPront) searchPront.value = btn.dataset.pront;
      window.buscaProntuario?.(btn.dataset.pront);
    });
  }

  // ── Anotações ─────────────────────────────────────────────────────────────
  const btnSalvarAnot = $('btnSalvarAnot');
  if (btnSalvarAnot) btnSalvarAnot.onclick = () => window.salvarAnotacao?.();
  const btnLimparAnot = $('btnLimparAnot');
  if (btnLimparAnot) btnLimparAnot.onclick = () => window.limparAnotForm?.();

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

  // ── Densidade dos cards (topbar) ──────────────────────────────────────────
  // removido — controles de densidade não usados

  // ── Recepcionados (bootstrap only — persists across page loads) ───────────
  loadRecepcionados();
  initExpiredHomeNotice();
  bindExpiredHomeNotice();
  renderHomeSourceChecklist();
  window.loadPrefs?.();
}

// ── _execLoadFromDB ────────────────────────────────────────────────────────────
// Loads all data from IndexedDB into state and renders the dashboard.
export async function _execLoadFromDB(s) {
  try {
    if (typeof window.showKpiSkeletons === 'function') window.showKpiSkeletons('kpisGeral', 4);
    const statusEl = $('status'), uploadEl = $('upload');

    // Lê em paralelo para economizar tempo
    const [rows, cidRows, triRows] = await Promise.all([
      VidaDB.getAll('atendimentos'),
      s.cid > 0 ? VidaDB.getAll('cid') : Promise.resolve([]),
      s.triagem > 0 ? VidaDB.getAll('triagem') : Promise.resolve([]),
    ]);

    if (!rows.length) return;

    rows.sort((a, b) => (a.dh?.getTime() || 0) - (b.dh?.getTime() || 0));

    state.raw = rows;
    state.files.hist = `banco local (${s.atendimentos.toLocaleString('pt-BR')} registros)`;

    if (triRows.length) {
      state.triRaw = triRows;
      state.triSource = 'db';
    } else {
      state.triRaw = deriveTriFromHist(state.raw);
      state.triSource = 'hist';
    }
    state.files.tri = '';
    if (typeof window.updateTriBtn === 'function') window.updateTriBtn();

    if (cidRows.length) {
      state.cidRaw = cidRows;
      try { if (typeof window.updateUploadStatuses === 'function') window.updateUploadStatuses(); } catch (e) {}
    }

    setupDates();
    populateMedicoFilter();
    applyFilters();

    if (uploadEl) uploadEl.style.display = 'none';
    hideExpiredHomeNotice();
    const appEl = $('app');
    if (appEl) appEl.classList.add('visible');
    if (typeof window.setHistFileName === 'function') window.setHistFileName(state.files.hist);
    if (typeof window.updateSourceChips === 'function') window.updateSourceChips();
    if (typeof window.updateQualityChip === 'function') window.updateQualityChip();
    updateTtlCountdown();

    const minDt = rows[0]?.dh?.toLocaleDateString('pt-BR') || '-';
    const maxDt = rows[rows.length - 1]?.dh?.toLocaleDateString('pt-BR') || '-';
    if (statusEl) {
      statusEl.textContent = `Carregado do banco local — ${s.atendimentos.toLocaleString('pt-BR')} atendimentos (${minDt} a ${maxDt})`;
      statusEl.className = 'status mono';
    }
    showToast(`Dados carregados: ${s.atendimentos.toLocaleString('pt-BR')} atendimentos (${minDt} a ${maxDt}).`, 'ok', 6000);
    refreshDbStats();
  } catch (e) {
    console.warn('[VIDA] _execLoadFromDB falhou:', e);
  }
}

// ── checkDeps ─────────────────────────────────────────────────────────────────
// Verifica bibliotecas CDN (XLSX, Chart) e conectividade; delega a offline.js.
export function checkDeps() {
  initOfflineGuards();
}

// ── showPrivacyNotice ─────────────────────────────────────────────────────────
// Banner contextual não bloqueante — reconhecido via localStorage.
export function showPrivacyNotice() {
  const KEY = 'vida_priv_ack_v1';
  try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }
  const bar = document.createElement('div');
  bar.className = 'priv-banner';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  bar.innerHTML = '<div class="priv-banner-inner">'
    + '<div class="priv-banner-icon" aria-hidden="true">'
    + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
    + '</div>'
    + '<div class="priv-banner-body">'
    + '<strong class="priv-banner-title">Dados de pacientes protegidos</strong>'
    + '<p>Relatórios com prontuário e identificação ficam <strong>apenas neste navegador</strong>, sem envio a servidores. Expiração automática em 12 h — exclusão imediata em Configurações.</p>'
    + '</div>'
    + '<button type="button" class="btn primary priv-banner-btn" id="privAckBtn">Entendi</button>'
    + '</div>';
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('visible'));
  const btn = bar.querySelector('#privAckBtn');
  btn.onclick = () => {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    bar.classList.remove('visible');
    setTimeout(() => bar.remove(), 280);
  };
}
