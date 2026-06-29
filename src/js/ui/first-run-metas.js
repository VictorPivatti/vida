// ui/first-run-metas.js — convite opcional a configurar metas no primeiro upload

const PROMPT_KEY = 'vida_metas_prompt_v1';

function _dismissBanner() {
  document.getElementById('firstRunMetasBanner')?.remove();
}

function _setPromptFlag(value) {
  try { localStorage.setItem(PROMPT_KEY, value); } catch (e) {}
}

export function openMetasFromFirstRunPrompt() {
  _setPromptFlag('opened');
  _dismissBanner();
  document.getElementById('metasModal')?.classList.add('open');
  if (typeof window.renderRecepTable === 'function') window.renderRecepTable();
}

export function dismissFirstRunMetasPrompt() {
  _setPromptFlag('later');
  _dismissBanner();
}

/** Exibe banner não bloqueante após o primeiro histórico carregado. */
export function maybePromptFirstRunMetas() {
  try {
    if (localStorage.getItem(PROMPT_KEY)) return;
  } catch (e) { return; }

  const app = document.getElementById('app');
  if (!app || document.getElementById('firstRunMetasBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'firstRunMetasBanner';
  banner.className = 'first-run-metas-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML =
    '<span class="first-run-metas-text">Configure metas da unidade para calibrar os gráficos de conformidade?</span>' +
    '<span class="first-run-metas-actions">' +
    '<button type="button" class="btn first-run-metas-open">Abrir metas</button>' +
    '<button type="button" class="btn btn-ghost first-run-metas-later">Depois</button>' +
    '</span>';

  banner.querySelector('.first-run-metas-open')?.addEventListener('click', openMetasFromFirstRunPrompt);
  banner.querySelector('.first-run-metas-later')?.addEventListener('click', dismissFirstRunMetasPrompt);

  const topbar = document.querySelector('.topbar');
  if (topbar?.parentNode) {
    topbar.parentNode.insertBefore(banner, topbar.nextSibling);
  } else {
    app.prepend(banner);
  }
}
