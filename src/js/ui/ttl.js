// ui/ttl.js — updateTtlCountdown: reads TTL from localStorage and updates topbar badge

import { state } from '../state.js';
import { TTL_KEY } from '../state.js';

export function updateTtlCountdown() {
  const el = document.getElementById('ttlBadge');
  if (!el) return;
  if (!state.raw.length) { el.style.display = 'none'; return; }
  try {
    const ts = parseInt(localStorage.getItem(TTL_KEY) || '0', 10);
    if (!ts) { el.style.display = 'none'; return; }
    const rem = 12 * 60 * 60 * 1000 - (Date.now() - ts);
    if (rem <= 0) { el.style.display = 'none'; return; }
    const h = Math.floor(rem / 3600000);
    const m = Math.floor((rem % 3600000) / 60000);
    el.textContent = `⏳ ${h}h${String(m).padStart(2, '0')}m`;
    el.title = `Dados expiram em ${h}h${String(m).padStart(2, '0')}min (TTL 12h — proteção LGPD)`;
    el.className = 'ttl-badge' + (rem < 1800000 ? ' ttl-crit' : rem < 7200000 ? ' ttl-warn' : '');
    el.style.display = '';
  } catch (e) { el.style.display = 'none'; }
}
