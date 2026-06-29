// ui/onboarding-panel.js — painel "Próximos passos" no dashboard

import { state } from '../state.js';
import { esc } from '../utils/dom.js';

const DISMISS_KEY = 'vida_onboarding_dismiss';

const STEPS = [
  { id: 'tri', label: 'Triagem', sub: 'Planilha Vivver — conformidade Manchester', fileId: 'triFile', done: () => state.triSource === 'file' || state.triSource === 'db' },
  { id: 'cid', label: 'CID / Diagnósticos', sub: 'Notificáveis e ranking por médico', fileId: 'cidFile', done: () => state.cidRaw.length > 0 },
  { id: 'proc', label: 'Procedimentos (BPA)', sub: 'Produção e faturamento', fileId: 'procFile', done: () => state.procRaw.length > 0 },
  { id: 'exam', label: 'Exames laboratoriais', sub: 'PDF Autolac — lista de conferência', fileId: 'examesFile', done: () => state.examesRaw.length > 0 },
];

function _realSourcesLoaded() {
  return STEPS.filter(s => s.done()).length;
}

export function dismissOnboardingPanel() {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
  const el = document.getElementById('onboardingPanel');
  if (el) el.style.display = 'none';
}

export function renderOnboardingPanel() {
  const el = document.getElementById('onboardingPanel');
  if (!el || !state.raw.length) return;
  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') { el.style.display = 'none'; return; }
  } catch (e) {}
  const loaded = _realSourcesLoaded();
  if (loaded >= 4) { el.style.display = 'none'; return; }

  const body = el.querySelector('.onboarding-panel-body');
  if (!body) return;
  body.innerHTML = STEPS.map(step => {
    const ok = step.done();
    return `<button type="button" class="onboarding-step${ok ? ' done' : ''}" data-file="${esc(step.fileId)}" ${ok ? 'disabled' : ''}>
      <span class="onboarding-step-icon" aria-hidden="true">${ok ? '✓' : '+'}</span>
      <span class="onboarding-step-text"><strong>${esc(step.label)}</strong><span>${esc(step.sub)}</span></span>
    </button>`;
  }).join('');

  body.querySelectorAll('.onboarding-step:not(.done)').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.file)?.click();
    });
  });

  const countEl = el.querySelector('.onboarding-panel-count');
  if (countEl) countEl.textContent = `${loaded}/4 complementos`;

  el.style.display = '';
}
