// ui/actions.js — ghost functions restored from the monolith script block.
// These were present in index.template.html but never extracted during modularization.

import { state } from '../state.js';
import { PREF_KEY, UC_KEY } from '../state.js';
import { $, esc, norm, fmt } from '../utils/dom.js';
import { ymd } from '../utils/dates.js';
import { applyFilters, dateRange } from '../filters.js';
import { renderAll, renderActivePane, markDirtyAll } from '../render/index.js';
import { buildExecutiveCoverData } from '../render/geral.js';
import { buildReportText } from '../render/relatorio.js';
import { renderOnboardingPanel } from './onboarding-panel.js';
import { isPdfExportBlocked, markPdfExportUnavailable, clearPdfExportBlock, refreshOfflineGuards, setExportInProgress } from './offline.js';
import { VidaDB } from '../storage/vidadb.js';
import { showLoading, hideLoading, setProgress } from './progress.js';
import { showToast } from './toast.js';
import { applyTheme } from './theme.js';
import { renderHomeSourceChecklist } from './home-sources.js';
import { syncTopbarStatus } from './topbar-status.js';

// ── Private helpers ───────────────────────────────────────────────────────────

function _writePrefsRaw(value) {
  try { if (window.localStorage) { window.localStorage.setItem(PREF_KEY, value); return; } } catch (e) {}
  try { document.cookie = `${PREF_KEY}=${encodeURIComponent(value)};max-age=31536000;path=/;SameSite=Lax`; } catch (e) {}
}

function _getUC() {
  if (typeof window.UC === 'object' && window.UC !== null) return window.UC;
  try { const r = localStorage.getItem(UC_KEY); if (r) return JSON.parse(r) || {}; } catch (e) {}
  return {};
}

// ── Exported functions ────────────────────────────────────────────────────────

export function setHistFileName(name) {
  const el = $('fileName');
  if (!el) return;
  if (!name || /^banco local/i.test(name)) {
    el.innerHTML = '';
    el.hidden = true;
    syncTopbarStatus();
    return;
  }
  el.hidden = false;
  el.style.display = 'flex';
  el.innerHTML =
    `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1" title="${esc(name)}">${esc(name)}</span>` +
    `<button type="button" onclick="document.getElementById('histFileSwitch').click()" title="Trocar arquivo de histórico" aria-label="Trocar arquivo" ` +
    `style="flex:none;background:none;border:none;cursor:pointer;padding:0 2px;opacity:.55;line-height:1;color:inherit" ` +
    `onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity='.55'">` +
    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>`;
  syncTopbarStatus();
}

export async function resetApp() {
  if (!confirm('Trocar base de dados?\n\nOs dados atuais serão removidos do banco local e você poderá carregar um novo arquivo.')) return;
  showLoading('Limpando banco...');
  try { await VidaDB.clearAll(); VidaDB.clearTimestamp(); } catch (e) { console.warn('[resetApp] clearAll:', e); }
  location.reload();
}

export const PREF_FIELD_IDS = [
  'metaTri', 'metaMed', 'metaTotal', 'metaRet', 'metaEvasao', 'metaVol', 'capMed', 'capTri',
  'metaVermelho', 'metaLaranja', 'metaAmarelo', 'metaVerde', 'metaAzul', 'metaBranco',
];

function _readPrefsRaw() {
  try {
    if (window.localStorage) {
      const r = window.localStorage.getItem(PREF_KEY);
      if (r) return r;
    }
  } catch (e) {}
  try {
    const hit = document.cookie.split('; ').find(row => row.indexOf(PREF_KEY + '=') === 0);
    return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : null;
  } catch (e) {}
  return null;
}

export function loadPrefs() {
  try {
    const raw = _readPrefsRaw();
    if (!raw) return;
    const prefs = JSON.parse(raw);
    PREF_FIELD_IDS.forEach(id => {
      if (prefs[id] != null) {
        const el = $(id);
        if (el) el.value = prefs[id];
      }
    });
  } catch (e) {}
}

export function savePrefs() {
  try {
    const prefs = { theme: state.theme };
    PREF_FIELD_IDS.forEach(id => { const el = $(id); if (el) prefs[id] = el.value; });
    _writePrefsRaw(JSON.stringify(prefs));
  } catch (e) {}
}

export function setTheme(theme, { save = true, render = true } = {}) {
  if (theme !== 'light' && theme !== 'dark') return;
  applyTheme(theme);
  document.querySelectorAll('[data-theme-choice]').forEach(btn => {
    const active = btn.dataset.themeChoice === state.theme;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (save) savePrefs();
  if (render && state.raw.length) renderAll();
}

export function showKpiSkeletons(containerId, count = 4) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const grid = document.createElement('div');
  grid.className = 'skeleton-kpi-grid';
  for (let i = 0; i < count; i++) {
    grid.innerHTML += `<div class="skeleton-kpi"><div class="skeleton s-label"></div><div class="skeleton s-value"></div><div class="skeleton s-sub"></div></div>`;
  }
  el.innerHTML = '';
  el.appendChild(grid);
}

export function updateQualityChip() {
  const el = document.getElementById('qualityChip');
  if (!el) return;
  if (!state.quality.length) { el.style.display = 'none'; return; }
  const worst = state.quality
    .filter(q => q.total > 0)
    .map(q => ({ ...q, rate: q.invalid / q.total }))
    .filter(q => q.rate > 0.05)
    .sort((a, b) => b.rate - a.rate)[0];
  if (!worst) { el.style.display = 'none'; return; }
  const p = Math.round(worst.rate * 100);
  el.textContent = `⚠ ${worst.type}: ${p}% ignoradas`;
  el.title = `${worst.invalid} de ${worst.total} linhas de ${worst.type} foram ignoradas (>5%). Verifique o formato do arquivo.`;
  el.style.display = '';
}

export function updateSourceChips() {
  const wrap = document.getElementById('tbSourceChips');
  if (!wrap) return;
  const hasHist = state.raw.length > 0;
  wrap.classList.toggle('is-visible', hasHist);
  function _chip(id, cls, loaded, label, titleLoaded, titleMissing, action) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = '';
    el.className = 'tb-source-chip ' + (loaded ? cls : 'missing');
    el.textContent = loaded ? label : '+' + label;
    el.title = loaded ? titleLoaded : titleMissing;
    el.onclick = action;
  }
  _chip('tbChipHist', 'loaded', hasHist,
    'Hist', 'Histórico carregado — clique para substituir', '',
    () => document.getElementById('histFileSwitch')?.click());
  const triLoaded = state.triRaw.length > 0;
  const triPersisted = state.triSource === 'file' || state.triSource === 'db';
  const triCls = triPersisted ? 'loaded' : 'derived';
  _chip('tbChipTri', triCls, triLoaded,
    'Tri',
    triPersisted ? 'Triagem carregada — clique para substituir' : 'Triagem derivada do histórico — clique para carregar planilha',
    'Adicionar planilha de Triagem — clique para carregar',
    () => document.getElementById('triFile')?.click());
  _chip('tbChipCid', 'loaded', state.cidRaw.length > 0,
    'CID', 'CID carregado — clique para substituir', 'Adicionar CID / Diagnósticos — clique para carregar',
    () => document.getElementById('cidFile')?.click());
  _chip('tbChipProc', 'loaded', state.procRaw.length > 0,
    'Proc', 'Procedimentos carregados — clique para substituir', 'Adicionar Procedimentos (BPA) — clique para carregar',
    () => document.getElementById('procFile')?.click());
  _chip('tbChipExam', 'loaded', state.examesRaw.length > 0,
    'Exam', 'Exames carregados — clique para substituir', 'Adicionar Exames Laboratoriais — clique para carregar',
    () => document.getElementById('examesFile')?.click());
}

export function updateUploadStatuses() {
  const procTotal = state.procRaw.reduce((s, r) => s + (r.qde || 0), 0);
  const triPersisted = state.triSource === 'file' || state.triSource === 'db';
  const statuses = {
    triStatus: triPersisted ? `${state.triRaw.length.toLocaleString('pt-BR')} reg.`
      : (state.triSource === 'hist' ? 'derivado' : ''),
    cidStatus: state.cidRaw.length ? `${state.cidRaw.length.toLocaleString('pt-BR')} reg.` : '',
    procStatus: procTotal ? `${procTotal.toLocaleString('pt-BR')} proc.` : '',
    examesStatus: state.examesRaw.length ? `${state.examesRaw.length.toLocaleString('pt-BR')} guias` : '',
  };
  const itemIds = { triStatus: 'triBtn', cidStatus: 'cidBtn', procStatus: 'procBtn', examesStatus: 'examesBtn' };
  Object.entries(statuses).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'upload-menu-status' + (text ? ' loaded' : '');
    if (id === 'triStatus' && text === 'derivado') {
      el.style.background = 'rgba(232,169,59,.12)';
      el.style.color = 'var(--wn)';
    } else if (el) {
      el.style.background = '';
      el.style.color = '';
    }
    const item = document.getElementById(itemIds[id]);
    if (item) item.classList.toggle('loaded', !!text);
  });
  const loaded = [triPersisted, state.cidRaw.length > 0, state.procRaw.length > 0, state.examesRaw.length > 0].filter(Boolean).length;
  const badge = document.getElementById('uploadBadge');
  if (badge) { badge.textContent = loaded + '/4'; badge.style.display = loaded > 0 ? 'inline' : 'none'; }
  updateSourceChips();
  updateQualityChip();
  renderHomeSourceChecklist();
  renderOnboardingPanel();
}

export function updateTriBtn() {
  updateUploadStatuses();
}

export function shortcut(k) {
  const max = state.raw[state.raw.length - 1]?.dh;
  if (!max) return;
  let s = new Date(max), e = new Date(max);
  if (k === '7d') s.setDate(s.getDate() - 6);
  else if (k === '30d') s.setDate(s.getDate() - 29);
  else if (k === '3m') s.setMonth(s.getMonth() - 2, 1);
  else if (k === 'year') s = new Date(max.getFullYear(), 0, 1);
  else if (k !== '1d') s = new Date(state.raw[0].dh);
  $('dateStart').value = ymd(s);
  $('dateEnd').value = ymd(e);
  applyFilters();
}

export async function exportarPDF() {
  if (!state.filt.length) { showToast('Carregue dados antes de exportar.', 'warn'); return; }
  if (isPdfExportBlocked()) {
    showToast('Exportação PDF indisponível offline. Conecte-se à internet e recarregue a página.', 'warn', 6000);
    return;
  }
  const _pdfBtn = $('printBtn');
  const _btnSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>PDF';
  if (_pdfBtn) { _pdfBtn.disabled = true; _pdfBtn.style.opacity = '.5'; _pdfBtn.style.cursor = 'wait'; _pdfBtn.textContent = 'Gerando...'; }
  setExportInProgress(true);

  // Restaurações diferidas (garantem estado limpo mesmo em erro)
  const _prevTheme = state.theme;
  const _origActive = document.querySelector('.nav-item.active')?.dataset?.pane;
  const _Chart = window.Chart;
  const _prevAnim = _Chart?.defaults ? _Chart.defaults.animation : undefined;
  const _origGCS = window.getComputedStyle;
  let _gcsPatched = false;

  try {
    // Load CDN libs on demand
    if (typeof html2canvas === 'undefined' || !window.jspdf) {
      showToast('Carregando bibliotecas de PDF...', 'ok', 2000);
      await new Promise((resolve, reject) => {
        let loaded = 0;
        const check = () => { if (++loaded === 2) resolve(); };
        const err = () => reject(new Error('Falha ao carregar bibliotecas de PDF'));
        if (typeof html2canvas === 'undefined') {
          const s1 = document.createElement('script');
          s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s1.onload = check; s1.onerror = err;
          document.head.appendChild(s1);
        } else { check(); }
        if (!window.jspdf) {
          const s2 = document.createElement('script');
          s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          s2.onload = check; s2.onerror = err;
          document.head.appendChild(s2);
        } else { check(); }
      });
      clearPdfExportBlock();
      refreshOfflineGuards();
    }
    showLoading('Gerando PDF — aguarde...');

    // Tema claro fixo na captura: cores corretas e melhor contraste em papel
    if (_prevTheme !== 'light') setTheme('light', { save: false, render: true });
    // Sem animação: garante que os gráficos estejam 100% desenhados na captura
    if (_Chart?.defaults) _Chart.defaults.animation = false;

    const UC = _getUC();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const _now = new Date().toLocaleString('pt-BR');
    const panes = [
      { id: 'pane-geral',       title: 'Visão geral' },
      { id: 'pane-indicadores', title: 'Indicadores' },
      { id: 'pane-medicos',     title: 'Médicos' },
      { id: 'pane-retornos',    title: 'Retornos ≤72h', confidencial: true },
      { id: 'pane-cid',         title: 'CID / Notificáveis', confidencial: true },
    ];

    // Patch: html2canvas 1.4.1 não entende color(srgb ...) do getComputedStyle do Chrome
    const _patchColor = v => typeof v !== 'string' ? v :
      v.replace(/\bcolor\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/gi,
        (_, r, g, b, a) => {
          const ri = Math.round(r * 255), gi = Math.round(g * 255), bi = Math.round(b * 255);
          return a != null ? `rgba(${ri},${gi},${bi},${parseFloat(a)})` : `rgb(${ri},${gi},${bi})`;
        });
    window.getComputedStyle = (...args) => {
      const s = _origGCS.apply(window, args);
      return new Proxy(s, {
        get(t, p) {
          const v = t[p];
          if (typeof v === 'string') return _patchColor(v);
          if (typeof v === 'function') return v.bind(t);
          return v;
        },
      });
    };
    _gcsPatched = true;

    const _footer = () => {
      pdf.setFontSize(6.5); pdf.setTextColor(150, 150, 160);
      pdf.text(`V.I.D.A. · Uso interno · Não substitui notificação SINAN · Gerado em ${_now}`, pdfW / 2, pdfH - 4, { align: 'center' });
    };

    const _header = (title, confidencial) => {
      pdf.setFontSize(8); pdf.setTextColor(120, 120, 130);
      pdf.text(`V.I.D.A. — ${UC.nome || 'Unidade de Saúde'}`, margin, margin + 1);
      pdf.setFontSize(13); pdf.setTextColor(20, 20, 30);
      pdf.text(title, margin, margin + 8);
      if (confidencial) {
        pdf.setFillColor(255, 232, 232);
        pdf.rect(margin, margin + 10.5, pdfW - margin * 2, 7, 'F');
        pdf.setFontSize(6.5); pdf.setTextColor(160, 30, 30);
        pdf.text('⚠ CONFIDENCIAL — Contém dados nominais de pacientes. Uso interno. Não divulgar fora da equipe de saúde autorizada.', margin + 2, margin + 15);
        pdf.setTextColor(20, 20, 30);
      }
      _footer();
    };

    // ── Página 1: capa executiva ──────────────────────────────────────────
    const cover = buildExecutiveCoverData();
    pdf.setFillColor(245, 246, 250);
    pdf.rect(0, 0, pdfW, pdfH, 'F');
    pdf.setFontSize(22); pdf.setTextColor(15, 23, 42);
    pdf.text('V.I.D.A.', margin, margin + 14);
    pdf.setFontSize(11); pdf.setTextColor(80, 90, 110);
    pdf.text(cover.unitName, margin, margin + 22);
    pdf.setFontSize(10);
    pdf.text(`Período: ${cover.periodStart} – ${cover.periodEnd}`, margin, margin + 30);
    if (cover.score) {
      pdf.setFontSize(9);
      pdf.text(`Score executivo: ${cover.score}`, pdfW - margin, margin + 14, { align: 'right' });
    }
    const gridY = margin + 40;
    const cellW = (pdfW - margin * 2 - 8) / 2;
    const cellH = 28;
    cover.kpis.forEach((k, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = margin + col * (cellW + 8), y = gridY + row * (cellH + 8);
      pdf.setDrawColor(220, 224, 232); pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(x, y, cellW, cellH, 3, 3, 'FD');
      pdf.setFontSize(8); pdf.setTextColor(100, 110, 130);
      pdf.text(k.label, x + 6, y + 10);
      pdf.setFontSize(16); pdf.setTextColor(20, 30, 50);
      pdf.text(String(k.value), x + 6, y + 20);
      pdf.setFontSize(7); pdf.setTextColor(130, 140, 155);
      pdf.text(k.sub || '', x + 6, y + 26);
    });
    const alertY = gridY + cellH * 2 + 24;
    pdf.setFontSize(10); pdf.setTextColor(20, 30, 50);
    pdf.text('Prioridades do período', margin, alertY);
    let ay = alertY + 8;
    cover.alerts.forEach(([t, title, msg]) => {
      const color = t === 'err' ? [200, 73, 62] : t === 'warn' ? [210, 145, 42] : [47, 158, 126];
      pdf.setFillColor(...color);
      pdf.circle(margin + 2, ay + 1.5, 1.2, 'F');
      pdf.setFontSize(8.5); pdf.setTextColor(30, 35, 50);
      pdf.text(title, margin + 7, ay + 2.5);
      pdf.setFontSize(7.5); pdf.setTextColor(90, 100, 120);
      const lines = pdf.splitTextToSize(msg, pdfW - margin * 2 - 8);
      pdf.text(lines, margin + 7, ay + 7);
      ay += 7 + lines.length * 3.5 + 4;
    });
    _footer();

    // ── Página 2+: relatório gerencial (texto nativo, nítido) ─────────────
    setProgress(8, 'Montando relatório gerencial');
    {
      const usableW = pdfW - margin * 2;
      const top = margin + 14, bottom = pdfH - 10, lineH = 5;
      pdf.setFont('helvetica', 'normal');
      let yy;
      const startPage = () => { pdf.addPage(); _header('Relatório gerencial', false); yy = top; };
      startPage();
      // Fontes padrão do jsPDF não têm alguns glifos Unicode — normaliza para ASCII
      const _asciiSafe = t => t
        .replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, '...')
        .replace(/\u2264/g, '<=').replace(/\u2265/g, '>=')
        .replace(/\u2192/g, '->').replace(/\u2022/g, '-');
      const paras = _asciiSafe(buildReportText()).split('\n');
      for (const para of paras) {
        const lines = para.length ? pdf.splitTextToSize(para, usableW) : [''];
        for (const ln of lines) {
          if (yy > bottom) startPage();
          pdf.setFontSize(10); pdf.setTextColor(40, 45, 60);
          pdf.text(ln, margin, yy);
          yy += lineH;
        }
      }
    }

    // ── Páginas seguintes: capturas dos painéis (largura ajustada + paginação) ──
    markDirtyAll();
    const _addPanePaged = (canvas, title, confidencial) => {
      const imgW = pdfW - margin * 2;
      const pxPerMm = canvas.width / imgW;
      const confH = confidencial ? 9 : 0;
      const contentTop = margin + 12 + confH;
      const availH = (pdfH - 8) - contentTop;      // altura útil por página (mm)
      const sliceHpx = Math.max(1, Math.floor(availH * pxPerMm));
      let y = 0, first = true;
      while (y < canvas.height) {
        const sh = Math.min(sliceHpx, canvas.height - y);
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = sh;
        tmp.getContext('2d').drawImage(canvas, 0, y, canvas.width, sh, 0, 0, canvas.width, sh);
        pdf.addPage();
        _header(title + (first ? '' : ' (continuação)'), confidencial);
        pdf.addImage(tmp.toDataURL('image/png'), 'PNG', margin, contentTop, imgW, sh / pxPerMm);
        y += sh; first = false;
      }
    };

    let idx = 0;
    for (const p of panes) {
      const el = document.getElementById(p.id);
      if (!el) { idx++; continue; }
      document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.nav-item[data-pane]').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      document.querySelector(`.nav-item[data-pane="${p.id.replace('pane-', '')}"]`)?.classList.add('active');
      renderActivePane();
      // Aguarda o próximo frame + folga para os gráficos (sem animação) desenharem
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 350)));
      setProgress(10 + (idx / panes.length) * 85, `Capturando: ${p.title}`);
      const canvas = await html2canvas(el, { // eslint-disable-line no-undef
        backgroundColor: '#ffffff',
        scale: 2, logging: false, useCORS: true, imageTimeout: 0,
      });
      _addPanePaged(canvas, p.title, p.confidencial);
      idx++;
    }

    // Numeração de páginas ao final (contagem dinâmica)
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7); pdf.setTextColor(150, 150, 160);
      pdf.text(`Página ${i}/${pageCount}`, pdfW - margin, margin + 1, { align: 'right' });
    }

    const { s, e } = dateRange();
    const periodo = (s ? s.toLocaleDateString('pt-BR').replace(/\//g, '-') : 'inicio') + '_a_' + (e ? e.toLocaleDateString('pt-BR').replace(/\//g, '-') : 'fim');
    pdf.save(`VIDA_relatorio_${periodo}.pdf`);
    setProgress(100, 'PDF gerado');
    hideLoading();
    showToast('PDF exportado com sucesso.', 'ok');
  } catch (err) {
    hideLoading();
    if (/PDF|html2canvas|jspdf|biblioteca/i.test(err.message || '')) markPdfExportUnavailable();
    showToast('Erro ao gerar PDF: ' + err.message, 'err');
    console.error(err);
  } finally {
    if (_gcsPatched) window.getComputedStyle = _origGCS;
    if (_Chart?.defaults) _Chart.defaults.animation = _prevAnim;
    // Restaura tema e painel ativo originais
    if (_prevTheme !== 'light') setTheme(_prevTheme, { save: false, render: true });
    if (_origActive) {
      document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.nav-item[data-pane]').forEach(x => x.classList.remove('active'));
      document.getElementById('pane-' + _origActive)?.classList.add('active');
      document.querySelector(`.nav-item[data-pane="${_origActive}"]`)?.classList.add('active');
      markDirtyAll();
      renderActivePane();
    }
    setExportInProgress(false);
    if (_pdfBtn) { _pdfBtn.disabled = false; _pdfBtn.style.opacity = ''; _pdfBtn.style.cursor = ''; _pdfBtn.innerHTML = _btnSvg; }
    refreshOfflineGuards();
  }
}
