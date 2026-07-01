// storage/dbstats.js — refreshDbStats: reads IndexedDB and updates UI badge

import { VidaDB } from './vidadb.js';
import { syncTopbarStatus } from '../ui/topbar-status.js';

export async function refreshDbStats() {
  try {
    const s = await VidaDB.stats();
    const el = document.getElementById('dbStatsBadge');
    if (el) el.style.display = 'none';
    syncTopbarStatus(s);
    return s;
  } catch (e) {
    console.warn('VidaDB stats:', e);
    return null;
  }
}
