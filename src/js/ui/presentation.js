// ui/presentation.js — modo apresentação para reuniões

const PREF_KEY = 'vida_presentation_theme';

function _wasDark() {
  return document.documentElement.dataset.theme === 'dark';
}

export function isPresentationMode() {
  return document.body.classList.contains('presentation-mode');
}

export function togglePresentationMode(force) {
  const on = force != null ? !!force : !isPresentationMode();
  document.body.classList.toggle('presentation-mode', on);
  const btn = document.getElementById('presentationBtn');
  if (btn) {
    btn.classList.toggle('active-pill', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on ? 'Sair do modo apresentação (Shift+P)' : 'Modo apresentação — oculta menus e amplia KPIs (Shift+P)';
  }
  if (on) {
    document.body.dataset.presentationPrevTheme = _wasDark() ? 'dark' : 'light';
    if (typeof window.setTheme === 'function') window.setTheme('light', { save: false, render: true });
  } else {
    const prev = document.body.dataset.presentationPrevTheme;
    if (prev && typeof window.setTheme === 'function') {
      window.setTheme(prev, { save: false, render: true });
    }
    delete document.body.dataset.presentationPrevTheme;
  }
  try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch (e) {}
}

export function initPresentationMode() {
  try {
    if (localStorage.getItem(PREF_KEY) === '1') togglePresentationMode(true);
  } catch (e) { /* preferência opcional */ }
  document.addEventListener('keydown', e => {
    if (e.shiftKey && (e.key === 'P' || e.key === 'p') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      e.preventDefault();
      togglePresentationMode();
    }
  });
}
