// ui/topbar-status.js — badge de registros na topbar

import { state } from '../state.js';
import { $ } from '../utils/dom.js';

/** Atualiza badge de registros na topbar (filtrados vs total + detalhes no title). */
export function syncTopbarStatus(dbStats = null) {
  const badge = $('recordBadge');
  if (!badge) return;
  const filt = state.filt.length;
  const total = state.raw.length;
  if (!total) {
    badge.textContent = '0 registros';
    badge.title = '';
    return;
  }
  const filtStr = filt.toLocaleString('pt-BR');
  const totalStr = total.toLocaleString('pt-BR');
  badge.textContent = filt !== total ? `${filtStr} de ${totalStr}` : `${filtStr} no período`;
  const tips = [];
  if (dbStats?.atendimentos != null) {
    tips.push(`${dbStats.atendimentos.toLocaleString('pt-BR')} atendimentos no banco local`);
    if (dbStats.cid) tips.push(`${dbStats.cid.toLocaleString('pt-BR')} CID`);
    if (dbStats.triagem) tips.push(`${dbStats.triagem.toLocaleString('pt-BR')} triagem`);
  } else if (/^banco local/i.test(state.files.hist || '')) {
    tips.push(state.files.hist);
  }
  if (state.files.hist && !/^banco local/i.test(state.files.hist)) {
    tips.push(`Arquivo: ${state.files.hist}`);
  }
  badge.title = tips.join(' · ');
}
