// globals.js — expose module functions on window for inline onclick/onchange handlers
//
// Every function listed here maps to an onclick="X()" or onchange="X()" in
// src/index.template.html. When Task 9 removes the <script> block, these
// window.* bindings will be the sole runtime source for those handlers.
//
// Functions that are NOT yet fully extracted to modules are implemented here
// as stubs that delegate to the script-block version (window.__vida_*) when
// available, or provide a minimal safe fallback. They will be replaced by real
// module implementations in Task 9.

import { toggleLayoutEdit, resetLayout } from './ui/layout.js';
import { toggleTheme } from './ui/theme.js';
import { renderAll, renderActivePane, markDirty, renderNotificaveis } from './render/index.js';
import { deletarAnotacao } from './render/anotacoes.js';
import { buscaProntuario } from './render/pacientes.js';
import { state } from './state.js';
import { RECEP_KEY, RECEP_OVERRIDE_KEY, UC_KEY } from './state.js';
import { VidaDB } from './storage/vidadb.js';
import { showToast } from './ui/toast.js';
import { $ } from './utils/dom.js';

// ── Helpers that some stubs need ─────────────────────────────────────────────
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// ── Unit-config modal ─────────────────────────────────────────────────────────
// These rely on UC (unit config object) defined in the script block. Until the
// script block is removed, window.UC is provided by it. The stubs delegate to
// the script-block copies when present, and provide safe fallbacks otherwise.

function openUnitConfig() {
  if (typeof window._openUnitConfig === 'function') { window._openUnitConfig(); return; }
  const UC = _getUC();
  const set = (id, val) => { const el = $(id); if (el) el.value = val || ''; };
  set('ucNome', UC.nome); set('ucTipo', UC.tipo || 'UPA'); set('ucCnes', UC.cnes);
  set('ucEndereco', UC.endereco); set('ucTelefone', UC.telefone);
  set('ucGestao', UC.gestao); set('ucRT', UC.rt); set('ucCoren', UC.coren);
  const modal = $('unitConfigModal');
  if (!modal) return;
  modal.classList.add('open');
  if (!modal._boundClose) {
    modal._boundClose = true;
    modal.addEventListener('click', e => { if (e.target === modal) closeUnitConfig(); });
  }
}

function closeUnitConfig() {
  const modal = $('unitConfigModal');
  if (modal) modal.classList.remove('open');
}

function saveUnitConfig() {
  if (typeof window._saveUnitConfig === 'function') { window._saveUnitConfig(); return; }
  const get = id => { const el = $(id); return el ? el.value.trim() : ''; };
  const UC = {
    nome: get('ucNome'), tipo: get('ucTipo'), cnes: get('ucCnes'),
    endereco: get('ucEndereco'), telefone: get('ucTelefone'),
    gestao: get('ucGestao'), rt: get('ucRT'), coren: get('ucCoren'),
  };
  try { localStorage.setItem(UC_KEY, JSON.stringify(UC)); } catch (e) {}
  _applyUnitConfig(UC);
  closeUnitConfig();
  showToast('Configuração da unidade salva.', 'ok');
}

function _getUC() {
  // Prefer the UC object maintained by the script block, if still present
  if (typeof window.UC === 'object' && window.UC !== null) return window.UC;
  try { const r = localStorage.getItem(UC_KEY); if (r) return JSON.parse(r) || {}; } catch (e) {}
  return { nome: '', tipo: 'UPA', cnes: '', endereco: '', telefone: '', gestao: '', rt: '', coren: '' };
}

function _applyUnitConfig(UC) {
  const sub = $('topbarUnitSub');
  if (sub) {
    if (UC.nome) {
      const parts = [UC.nome];
      if (UC.cnes) parts.push('CNES ' + UC.cnes);
      if (UC.endereco) parts.push(UC.endereco);
      if (UC.telefone) parts.push(UC.telefone);
      sub.textContent = parts.join(' · ');
    } else {
      sub.textContent = 'Visualização Integrada de Dados Assistenciais';
    }
  }
  const sbsub = $('sidebarUnitSub');
  if (sbsub) sbsub.textContent = UC.nome || 'UPA Tiago Cardoso Santos';
  const unitTag = $('upUnitNameTag');
  if (unitTag) {
    const parts = [];
    if (UC.nome) parts.push(UC.nome);
    if (UC.endereco) parts.push(UC.endereco.split(',')[0]);
    unitTag.textContent = parts.join(' — ');
    unitTag.classList.toggle('visible', !!UC.nome);
  }
  const pc = $('printUnit');
  if (pc) {
    const parts = [];
    if (UC.nome) parts.push(UC.nome);
    if (UC.endereco) parts.push(UC.endereco);
    if (UC.cnes) parts.push('CNES ' + UC.cnes);
    if (UC.rt) parts.push('RT: ' + UC.rt + (UC.coren ? ' (' + UC.coren + ')' : ''));
    pc.textContent = parts.join(' — ');
  }
}

// ── KPI info panel ────────────────────────────────────────────────────────────
function toggleKpiInfo(btn) {
  const card = btn.closest('.kpi');
  const panel = card.querySelector('.kpi-formula-panel');
  const isOpen = !panel.hidden;
  document.querySelectorAll('.kpi-formula-panel:not([hidden])').forEach(p => { p.hidden = true; });
  document.querySelectorAll('.kpi-info-btn.active').forEach(b => b.classList.remove('active'));
  if (isOpen) return;
  let formula = null;
  try { formula = JSON.parse(card.dataset.formula); } catch (e) { return; }
  if (!formula) return;
  let rows = '';
  if (formula.linhas) {
    formula.linhas.forEach((r, i) => {
      const isTot = i === formula.linhas.length - 1 && formula.linhas.length > 1;
      rows += `<tr class="${isTot ? 'kpi-formula-total' : ''}"><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`;
    });
  }
  panel.innerHTML = `<div class="kpi-formula-expr">${esc(formula.expr)}</div>${rows ? `<table class="kpi-formula-table">${rows}</table>` : ''}`;
  panel.hidden = false;
  btn.classList.add('active');
}

// ── Danger zone ───────────────────────────────────────────────────────────────
function toggleDangerZone() {
  const zone = document.getElementById('dangerZone');
  if (!zone) return;
  const header = zone.querySelector('.danger-zone-header');
  const isOpen = zone.classList.toggle('open');
  if (header) header.setAttribute('aria-expanded', isOpen);
  if (isOpen) _atualizarDangerStats();
}

async function _atualizarDangerStats() {
  const el = document.getElementById('dangerZoneStats');
  if (!el) return;
  try {
    const s = await VidaDB.stats();
    const total = s.atendimentos + s.cid + s.triagem;
    if (total === 0) { el.innerHTML = '<span>Banco vazio — nenhum dado para apagar.</span>'; return; }
    el.innerHTML = `<div><span>Atendimentos </span><strong>${s.atendimentos.toLocaleString('pt-BR')}</strong></div><div><span>Triagem </span><strong>${s.triagem.toLocaleString('pt-BR')}</strong></div><div><span>CID </span><strong>${s.cid.toLocaleString('pt-BR')}</strong></div><div><span>Total </span><strong style="color:var(--er)">${total.toLocaleString('pt-BR')} registros</strong></div>`;
  } catch (e) { el.innerHTML = '<span style="color:var(--mut)">Erro ao ler banco.</span>'; }
}

function abrirConfirmacaoLimpeza() {
  const overlay = document.getElementById('dangerConfirmOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  overlay.onclick = e => { if (e.target === overlay) fecharConfirmacaoLimpeza(); };
  setTimeout(() => overlay.querySelector('.btn')?.focus(), 50);
}

function fecharConfirmacaoLimpeza() {
  const overlay = document.getElementById('dangerConfirmOverlay');
  if (overlay) overlay.classList.remove('open');
}

let _undoTimer = null, _undoCancelled = false;

function executarLimpeza() {
  fecharConfirmacaoLimpeza();
  _undoCancelled = false;
  const toast = document.getElementById('undoToast');
  const countdown = document.getElementById('undoCountdown');
  const bar = document.getElementById('undoBar');
  if (!toast) return;
  toast.classList.add('visible');
  bar.style.transition = 'none'; bar.style.width = '100%';
  requestAnimationFrame(() => { bar.style.transition = 'width 5s linear'; bar.style.width = '0%'; });
  let n = 5; if (countdown) countdown.textContent = n;
  _undoTimer = setInterval(() => {
    n--; if (countdown) countdown.textContent = n;
    if (n <= 0) { clearInterval(_undoTimer); toast.classList.remove('visible'); if (!_undoCancelled) _confirmarLimpezaFinal(); }
  }, 1000);
}

function desfazerLimpeza() {
  _undoCancelled = true; clearInterval(_undoTimer);
  const toast = document.getElementById('undoToast');
  if (toast) toast.classList.remove('visible');
  showToast('Limpeza cancelada.', 'ok', 2500);
}

async function _confirmarLimpezaFinal() {
  if (typeof window.showLoading === 'function') window.showLoading('Limpando banco...');
  try {
    await VidaDB.clearAll(); VidaDB.clearTimestamp(); location.reload();
  } catch (e) {
    if (typeof window.hideLoading === 'function') window.hideLoading();
    showToast('Erro ao limpar banco: ' + e.message, 'err');
  }
}

// ── Upload menu ───────────────────────────────────────────────────────────────
function toggleUploadMenu() {
  const dd = document.getElementById('uploadDropdown');
  if (!dd) return;
  const isOpen = dd.classList.toggle('open');
  const btn = document.getElementById('uploadMenuBtn');
  if (btn) btn.setAttribute('aria-expanded', isOpen);
  if (isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!dd.contains(e.target)) {
          dd.classList.remove('open');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
        document.removeEventListener('click', closeMenu);
      });
    }, 0);
    _updateUploadStatuses();
  }
}

function _updateUploadStatuses() {
  const statuses = {
    triStatus: state.triSource === 'file' ? `${state.triRaw.length.toLocaleString('pt-BR')} reg.` : (state.triSource === 'hist' ? 'derivado' : ''),
    cidStatus: state.cidRaw.length ? `${state.cidRaw.length.toLocaleString('pt-BR')} reg.` : '',
    procStatus: state.procRaw.length ? `${state.procRaw.length.toLocaleString('pt-BR')} proc.` : '',
    examesStatus: state.examesRaw.length ? `${state.examesRaw.length.toLocaleString('pt-BR')} guias` : '',
  };
  Object.entries(statuses).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'upload-menu-status' + (text ? ' loaded' : '');
  });
  const loaded = [state.triSource === 'file', state.cidRaw.length > 0, state.procRaw.length > 0, state.examesRaw.length > 0].filter(Boolean).length;
  const badge = document.getElementById('uploadBadge');
  if (badge) { badge.textContent = loaded || ''; badge.style.display = loaded ? '' : 'none'; }
}

// ── TTL menu ──────────────────────────────────────────────────────────────────
function toggleTtlMenu(e) {
  e?.stopPropagation();
  const existing = document.getElementById('ttlMenu');
  if (existing) { existing.remove(); return; }
  const badge = document.getElementById('ttlBadge');
  if (!badge) return;
  const rect = badge.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'ttlMenu';
  menu.className = 'ttl-menu';
  menu.innerHTML = `<button onclick="renovarTtl()">↺ Renovar TTL (+ 12h)</button><button class="ttl-del" onclick="document.getElementById('ttlMenu')?.remove();abrirConfirmacaoLimpeza()">⊘ Apagar agora</button>`;
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = rect.left + 'px';
  document.body.appendChild(menu);
  setTimeout(() => {
    function _close(ev) {
      if (!menu.contains(ev.target) && ev.target !== badge) { menu.remove(); document.removeEventListener('click', _close); }
    }
    document.addEventListener('click', _close);
  }, 0);
}

function renovarTtl() {
  document.getElementById('ttlMenu')?.remove();
  try { VidaDB.touchTimestamp(); } catch (e) {}
  if (typeof window.updateTtlCountdown === 'function') window.updateTtlCountdown();
  showToast('TTL renovado — dados protegidos por mais 12h.', 'ok', 3000);
}

// ── Mobile sidebar ────────────────────────────────────────────────────────────
function toggleMobileSidebar() { document.body.classList.toggle('sidebar-open'); }
function closeMobileSidebar() { document.body.classList.remove('sidebar-open'); }

// ── CID trend filter ──────────────────────────────────────────────────────────
// The full renderCidTrend implementation lives in the script block (and will
// move to render/cid.js in Task 9). Here we expose the filter toggle only;
// the actual render is delegated to the script-block version via window.*.
let _trendFilter = 'all';

function filterCidTrend(type, btn) {
  _trendFilter = type;
  document.querySelectorAll('#cidTrendFilters .trend-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Delegate to script-block implementation until Task 9
  if (typeof window._renderCidTrendAlerts === 'function') {
    window._renderCidTrendAlerts(window._lastTrendAlerts || []);
  } else if (typeof window.renderCidTrendAlerts === 'function') {
    window.renderCidTrendAlerts(window._lastTrendAlerts || []);
  }
}

// ── onchange="renderCidTrend()" ───────────────────────────────────────────────
// Full implementation lives in the script block (will move to render/cid.js in
// Task 9). This stub is intentionally a no-op so that the private
// renderCidTrend() inside render/cid.js (which calls window.renderCidTrend)
// does not recurse. At runtime the script block overwrites this binding with
// the real implementation.
function renderCidTrend() {
  // no-op stub: overwritten by the <script> block at runtime.
  // render/cid.js's private renderCidTrend() calls window.renderCidTrend()
  // only when it exists — this binding satisfies that guard without recursing.
}

// ── Notificáveis filter ───────────────────────────────────────────────────────
let _notifGrupoAtivo = 'Todos';

function filterNotifGrupo(grupo, btn) {
  _notifGrupoAtivo = grupo;
  document.querySelectorAll('#notifGrupoFilters .notif-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (typeof window._renderNotifGrid === 'function') {
    window._renderNotifGrid(window._lastNotifResultados || []);
  } else if (typeof window.renderNotifGrid === 'function') {
    window.renderNotifGrid(window._lastNotifResultados || []);
  }
}

// ── onchange="renderCidNotificaveis()" ───────────────────────────────────────
function renderCidNotificaveis() {
  renderNotificaveis();
}

// ── Notif checklist export ────────────────────────────────────────────────────
function exportNotifChecklist() {
  if (typeof window._exportNotifChecklist === 'function') { window._exportNotifChecklist(); return; }
  const resultados = (window._lastNotifResultados || []).filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);
  if (!resultados.length) { showToast('Nenhum caso notificável encontrado para gerar checklist.', 'warn'); return; }
  const cl = document.getElementById('notifChecklist');
  const body = document.getElementById('notifChecklistBody');
  if (!cl || !body) return;
  body.innerHTML = resultados.map((r, i) =>
    `<div class="notif-checklist-item">
      <div class="notif-check-num">${i + 1}</div>
      <div class="notif-check-body">
        <div class="notif-check-doenca">${esc(r.nome)} — ${r.count} caso${r.count > 1 ? 's' : ''}</div>
        <div class="notif-check-detail">${(r.detalhes || []).map(c => `${esc(c.data)}${c.hora ? ' ' + esc(c.hora) : ''} · ${esc(c.paciente || '(sem nome)')}${c.pront ? ' · pront. ' + esc(c.pront) : ''} · ${esc(c.cid)}`).join('<br>')}</div>
        <div class="notif-check-detail">CIDs: ${(r.cidsEncontrados || []).join(', ')} · ${r.ultSemana > 0 ? `${r.ultSemana} caso${r.ultSemana > 1 ? 's' : ''} nos últimos 7 dias · ` : ''}Prazo: 24h · Enviar para SMS Mateus Leme</div>
      </div>
      <div style="font-size:18px;color:var(--bdr2);flex-shrink:0" title="Marcar como enviado">☐</div>
    </div>`
  ).join('');
  cl.style.display = cl.style.display === 'none' ? 'block' : 'none';
  if (cl.style.display !== 'none') {
    cl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    showToast(`Checklist gerado — ${resultados.length} doença${resultados.length > 1 ? 's' : ''} para conferir.`, 'ok');
  }
}

// ── saveRecepcionados (used in inline onchange) ───────────────────────────────
function saveRecepcionados() {
  try { localStorage.setItem(RECEP_KEY, JSON.stringify(state.recepcionados)); } catch (e) {}
  try { localStorage.setItem(RECEP_OVERRIDE_KEY, JSON.stringify(state.recepOverride)); } catch (e) {}
}

// ── renderRecepTable (used in onclick) ───────────────────────────────────────
// Delegates to script-block version; will move to a module in Task 9.
function renderRecepTable() {
  if (typeof window._renderRecepTable === 'function') { window._renderRecepTable(); return; }
  if (typeof window.renderRecepTable_impl === 'function') { window.renderRecepTable_impl(); return; }
  // Fallback: no-op until extracted
}

// ── renderEvasao (used in onchange) ──────────────────────────────────────────
// Delegates to script-block version; will move to render/triagem.js in Task 9.
function renderEvasao(triFilt) {
  if (typeof window._renderEvasao === 'function') { window._renderEvasao(triFilt); return; }
  if (typeof window.renderEvasao_impl === 'function') { window.renderEvasao_impl(triFilt); return; }
  // Fallback: no-op until extracted
}

// ── Main export ───────────────────────────────────────────────────────────────
export function initGlobals() {
  Object.assign(window, {
    // ── UI: layout
    toggleLayoutEdit,
    resetLayout,

    // ── UI: theme
    toggleTheme,

    // ── Render
    renderAll,
    renderActivePane,
    markDirty,

    // ── Unit config modal
    openUnitConfig,
    closeUnitConfig,
    saveUnitConfig,

    // ── KPI info panel
    toggleKpiInfo,

    // ── Danger zone
    toggleDangerZone,
    abrirConfirmacaoLimpeza,
    fecharConfirmacaoLimpeza,
    executarLimpeza,
    desfazerLimpeza,

    // ── Upload menu
    toggleUploadMenu,

    // ── TTL
    toggleTtlMenu,
    renovarTtl,

    // ── Mobile sidebar
    toggleMobileSidebar,
    closeMobileSidebar,

    // ── CID
    filterCidTrend,
    renderCidTrend,
    renderCidNotificaveis,

    // ── Notificáveis
    filterNotifGrupo,
    exportNotifChecklist,

    // ── Recepcionados (used in onchange / onclick inline code)
    saveRecepcionados,
    renderRecepTable,
    renderEvasao,

    // ── Annotations
    deletarAnotacao,

    // ── Patients
    buscaProntuario,

    // ── Build flag
    VIDA_BUILD: 'modular',
  });
}
