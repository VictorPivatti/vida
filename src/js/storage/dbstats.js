// storage/dbstats.js — refreshDbStats: reads IndexedDB and updates UI badge

import { VidaDB } from './vidadb.js';

export async function refreshDbStats() {
  try {
    const s = await VidaDB.stats();
    const total = s.atendimentos + s.cid + s.triagem;
    const el = document.getElementById('dbStatsBadge');
    if (el) {
      if (total > 0) {
        el.style.display = 'inline-flex';
        el.innerHTML = `<span style="opacity:.6">⛁</span> ${s.atendimentos.toLocaleString('pt-BR')} no banco`;
        el.title = `Atendimentos: ${s.atendimentos.toLocaleString('pt-BR')} · CID: ${s.cid.toLocaleString('pt-BR')} · Triagem: ${s.triagem.toLocaleString('pt-BR')}`;
      } else {
        el.style.display = 'none';
      }
    }
    return s;
  } catch (e) {
    console.warn('VidaDB stats:', e);
    return null;
  }
}
