// ui/toast.js — Toast notification system

import { esc } from '../utils/dom.js';

function dismissToast(toast) {
  toast.style.animation = 'toastOut .2s ease forwards';
  setTimeout(() => toast.remove(), 220);
}

export function showToast(msg, type='ok', duration=4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<span class="toast-dot"></span><span style="flex:1">${esc(msg)}</span><button type="button" class="toast-dismiss" aria-label="Fechar notificação">✕</button>`;
  toast.querySelector('.toast-dismiss').onclick = () => dismissToast(toast);
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => dismissToast(toast), duration);
}
