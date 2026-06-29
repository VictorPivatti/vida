// ui/offline.js — detecção de CDN ausente e banner offline

let _pdfBlocked = false;
let _exportInProgress = false;

/** Impede refreshOfflineGuards de reabilitar botões durante exportação. */
export function setExportInProgress(on) {
  _exportInProgress = !!on;
}

export function isExportInProgress() {
  return _exportInProgress;
}

/** @returns {{ xlsx: boolean, chart: boolean, pdf: boolean }} */
export function getCdnStatus() {
  return {
    xlsx: typeof XLSX !== 'undefined',
    chart: typeof Chart !== 'undefined',
    pdf: typeof html2canvas !== 'undefined' && !!window.jspdf,
  };
}

/** @param {{ xlsx?: boolean, chart?: boolean, pdf?: boolean }} flags */
export function buildOfflineMessages(flags) {
  const lines = [];
  if (flags.xlsx) {
    lines.push('Leitura de planilhas .xls/.xlsx indisponível sem conexão. Arquivos .csv em texto ainda podem funcionar parcialmente.');
  }
  if (flags.chart) {
    lines.push('Gráficos indisponíveis — KPIs numéricos e tabelas continuam funcionando.');
  }
  if (flags.pdf) {
    lines.push('Exportação PDF requer conexão com a internet na primeira utilização.');
  }
  return lines;
}

function _setDisabled(el, disabled, reason) {
  if (!el) return;
  el.disabled = disabled;
  el.classList.toggle('cdn-disabled', disabled);
  if (disabled && reason) el.title = reason;
  else if (el.dataset.defaultTitle) el.title = el.dataset.defaultTitle;
}

function _applyBodyClasses(status, offline) {
  document.body.classList.toggle('cdn-missing-xlsx', !status.xlsx);
  document.body.classList.toggle('cdn-missing-chart', !status.chart);
  document.body.classList.toggle('cdn-missing-pdf', _pdfBlocked || offline);
  document.body.classList.toggle('is-offline', offline);
}

function _renderOfflineBar(lines) {
  let bar = document.getElementById('offlineBar');
  if (!lines.length) {
    bar?.remove();
    document.body.classList.remove('has-offline-bar');
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'offlineBar';
    bar.className = 'offline-bar';
    bar.setAttribute('role', 'alert');
    bar.innerHTML =
      '<div class="offline-bar-icon" aria-hidden="true">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg></div>' +
      '<div class="offline-bar-body"></div>' +
      '<button type="button" class="offline-bar-reload">Recarregar</button>';
    bar.addEventListener('click', e => {
      if (e.target.closest('.offline-bar-reload')) location.reload();
    });
    document.body.prepend(bar);
  }
  const body = bar.querySelector('.offline-bar-body');
  if (body) body.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
  document.body.classList.add('has-offline-bar');
}

function _syncControls(status, offline) {
  const xlsxReason = 'Requer XLSX.js — conecte-se à internet e recarregue a página (F5).';
  const pdfReason = 'Exportação PDF requer conexão com a internet.';

  document.querySelectorAll('.requires-cdn-xlsx').forEach(el => {
    if (_exportInProgress && (el.id === 'exportBtn' || el.id === 'exportMedBtn')) return;
    if (!el.dataset.defaultTitle && el.title) el.dataset.defaultTitle = el.title;
    _setDisabled(el, !status.xlsx, xlsxReason);
  });

  document.querySelectorAll('.requires-cdn-pdf').forEach(el => {
    if (_exportInProgress && el.id === 'printBtn') return;
    if (!el.dataset.defaultTitle && el.title) el.dataset.defaultTitle = el.title;
    _setDisabled(el, offline || _pdfBlocked, pdfReason);
  });
}

/** Atualiza banner e controles conforme CDN / conectividade. */
export function refreshOfflineGuards() {
  document.getElementById('depWarnBar')?.remove();
  const status = getCdnStatus();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  _applyBodyClasses(status, offline);

  const lines = buildOfflineMessages({
    xlsx: !status.xlsx,
    chart: !status.chart,
    pdf: offline || _pdfBlocked,
  });
  _renderOfflineBar(lines);
  _syncControls(status, offline);
}

/** Marca export PDF indisponível após falha de carregamento das libs. */
export function markPdfExportUnavailable() {
  _pdfBlocked = true;
  refreshOfflineGuards();
}

export function clearPdfExportBlock() {
  _pdfBlocked = false;
}

export function isXlsxAvailable() {
  return getCdnStatus().xlsx;
}

export function isPdfExportBlocked() {
  if (_pdfBlocked) return true;
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Checagem inicial — substitui checkDeps legado. */
export function initOfflineGuards() {
  refreshOfflineGuards();
  window.addEventListener('online', refreshOfflineGuards);
  window.addEventListener('offline', refreshOfflineGuards);
}
