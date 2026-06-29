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
import { showLoading, hideLoading } from './ui/progress.js';
import { setupDates, populateMedicoFilter, applyFilters } from './filters.js';
import { refreshDbStats } from './storage/dbstats.js';
import { updateTtlCountdown } from './ui/ttl.js';

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
    if (savedBtn && !savedBtn.dataset.bound) {
      savedBtn.dataset.bound = '1';
      savedBtn.onclick = async () => {
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
      state.triRaw = typeof window.deriveTriFromHist === 'function'
        ? window.deriveTriFromHist(state.raw)
        : [];
      state.triSource = 'hist';
    }
    state.files.tri = '';
    if (typeof window.updateTriBtn === 'function') window.updateTriBtn();

    if (cidRows.length) {
      state.cidRaw = cidRows;
      const _cAS = document.getElementById('cidStatus');
      if (_cAS) {
        _cAS.textContent = cidRows.length.toLocaleString('pt-BR') + ' reg.';
        _cAS.className = 'upload-menu-status loaded';
      }
      try { if (typeof window.updateUploadStatuses === 'function') window.updateUploadStatuses(); } catch (e) {}
    }

    setupDates();
    populateMedicoFilter();
    applyFilters();

    if (uploadEl) uploadEl.style.display = 'none';
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
// Checks if CDN libraries (XLSX, Chart) loaded; shows warning bar if not.
export function checkDeps() {
  const missing = [];
  if (typeof XLSX === 'undefined') missing.push('leitura de planilhas (XLSX.js)');
  if (typeof Chart === 'undefined') missing.push('gráficos (Chart.js)');
  if (!missing.length) return;
  const bar = document.createElement('div');
  bar.id = 'depWarnBar';
  bar.setAttribute('role', 'alert');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:var(--er,#a83a31);color:#fff;padding:10px 16px;font:600 13px "Plus Jakarta Sans",system-ui,sans-serif;display:flex;align-items:center;gap:10px;justify-content:center;text-align:center';
  bar.innerHTML = '<span>⚠ Sem conexão com a internet: ' + missing.join(' e ') + ' indisponíveis. Conecte-se e recarregue a página (F5). O parser interno de .xlsx continua funcionando parcialmente.</span><button type="button" style="background:rgba(255,255,255,.2);border:0;color:#fff;padding:4px 12px;border-radius:6px;cursor:pointer;font:inherit" onclick="location.reload()">Recarregar</button>';
  document.body.prepend(bar);
}

// ── showPrivacyNotice ─────────────────────────────────────────────────────────
// Shows the LGPD privacy banner once, acknowledged via localStorage.
export function showPrivacyNotice() {
  const KEY = 'vida_priv_ack_v1';
  try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'privTitle');
  ov.innerHTML = '<div style="background:var(--sur,#16191f);border:1px solid var(--bdr2,rgba(255,255,255,.09));border-radius:10px;max-width:480px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,.5)">'
    + '<div id="privTitle" style="font:700 16px &quot;Plus Jakarta Sans&quot;,system-ui,sans-serif;color:var(--txt,#e8eaf0);margin-bottom:12px">Proteção de dados de pacientes</div>'
    + '<div style="font:400 13px/1.6 &quot;Plus Jakarta Sans&quot;,system-ui,sans-serif;color:var(--txt2,#8b90a0)">'
    + '<p style="margin:0 0 10px">Os relatórios carregados contêm dados pessoais sensíveis (prontuário, nome, idade), armazenados <strong style="color:var(--txt,#e8eaf0)">apenas neste navegador</strong>, sem envio a servidores.</p>'
    + '<p style="margin:0 0 10px">Por segurança, os dados <strong style="color:var(--txt,#e8eaf0)">expiram automaticamente após 12 horas</strong> e são apagados na próxima abertura.</p>'
    + '<p style="margin:0">Use esta ferramenta somente em computador de acesso restrito. Para apagar tudo imediatamente, use Configurações → Limpar banco de dados.</p>'
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;margin-top:18px">'
    + '<button type="button" id="privAckBtn" style="background:var(--ac,#1357a6);border:0;color:#fff;padding:9px 22px;border-radius:7px;cursor:pointer;font:600 13px &quot;Plus Jakarta Sans&quot;,system-ui,sans-serif">Entendi</button>'
    + '</div></div>';
  document.body.appendChild(ov);
  const btn = ov.querySelector('#privAckBtn');
  btn.focus();
  btn.onclick = () => { try { localStorage.setItem(KEY, '1'); } catch (e) {} ov.remove(); };
}
