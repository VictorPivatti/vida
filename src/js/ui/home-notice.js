// home-notice.js — avisos contextuais na tela de upload (ex.: TTL expirado)
import { $ } from '../utils/dom.js';

const EXPIRED_NOTICE_KEY = 'vida_ttl_expired_notice';

export function showExpiredHomeNotice() {
  try { sessionStorage.setItem(EXPIRED_NOTICE_KEY, '1'); } catch (e) {}
  const el = $('upExpiredBanner');
  if (el) el.style.display = 'flex';
  const saved = $('upSavedBanner');
  if (saved) saved.style.display = 'none';
}

export function hideExpiredHomeNotice() {
  try { sessionStorage.removeItem(EXPIRED_NOTICE_KEY); } catch (e) {}
  const el = $('upExpiredBanner');
  if (el) el.style.display = 'none';
}

export function initExpiredHomeNotice() {
  try {
    if (sessionStorage.getItem(EXPIRED_NOTICE_KEY) !== '1') return;
  } catch (e) { return; }
  const el = $('upExpiredBanner');
  if (el) el.style.display = 'flex';
}

export function bindExpiredHomeNotice() {
  const btn = $('upExpiredDismiss');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.onclick = () => hideExpiredHomeNotice();
  }
}
