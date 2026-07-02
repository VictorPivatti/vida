// ui/ttl.js — TTL countdown badge + active purge when expired (LGPD)

import { state, resetState, TTL_KEY } from '../state.js';
import { VidaDB } from '../storage/vidadb.js';
import { showExpiredHomeNotice } from './home-notice.js';
import { showToast } from './toast.js';

const TTL_MS = 12 * 60 * 60 * 1000;
let _purgePending = false;
let _intervalStarted = false;

/** Clear patient data from memory, IndexedDB and UI when TTL expires. */
export async function purgeExpiredPatientData() {
  if (_purgePending) return;
  _purgePending = true;
  try {
    try { await VidaDB.clearAll(); } catch (e) { console.warn('[VIDA] TTL purge clearAll:', e); }
    VidaDB.clearTimestamp();
    resetState();
    document.getElementById('ttlMenu')?.remove();
    const badge = document.getElementById('ttlBadge');
    if (badge) badge.style.display = 'none';
    const app = document.getElementById('app');
    if (app) app.classList.remove('visible');
    const upload = document.getElementById('upload');
    if (upload) upload.style.display = '';
    const banner = document.getElementById('upSavedBanner');
    if (banner) banner.style.display = 'none';
    showExpiredHomeNotice();
    try { window.refreshDbStats?.(); } catch (e) {}
    showToast(
      'Dados de pacientes expiraram (12h) e foram removidos automaticamente por segurança. Recarregue os relatórios.',
      'warn',
      9000
    );
  } finally {
    _purgePending = false;
  }
}

export function updateTtlCountdown() {
  const el = document.getElementById('ttlBadge');
  if (!el) return;
  if (!state.raw.length) { el.style.display = 'none'; return; }
  try {
    const ts = parseInt(localStorage.getItem(TTL_KEY) || '0', 10);
    if (!ts) { el.style.display = 'none'; return; }
    const rem = TTL_MS - (Date.now() - ts);
    if (rem <= 0) {
      el.style.display = 'none';
      purgeExpiredPatientData();
      return;
    }
    const h = Math.floor(rem / 3600000);
    const m = Math.floor((rem % 3600000) / 60000);
    el.textContent = `⏳ ${h}h${String(m).padStart(2, '0')}m`;
    el.title = `Dados expiram em ${h}h${String(m).padStart(2, '0')}min (TTL 12h — proteção LGPD)`;
    el.className = 'ttl-badge' + (rem < 1800000 ? ' ttl-crit' : rem < 7200000 ? ' ttl-warn' : '');
    el.style.display = '';
  } catch (e) { el.style.display = 'none'; }
}

/** Start periodic TTL check (every 60s). Safe to call multiple times. */
export function startTtlCountdown() {
  if (_intervalStarted) return;
  _intervalStarted = true;
  updateTtlCountdown();
  setInterval(updateTtlCountdown, 60000);
}
