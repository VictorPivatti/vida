// ui/home-sources.js — checklist de fontes e saúde da sessão na tela inicial

import { state } from '../state.js';
import { TTL_KEY } from '../state.js';

const SOURCE_LABELS = {
  hist: 'Histórico',
  tri: 'Triagem',
  cid: 'CID',
  proc: 'Procedimentos',
  exam: 'Exames',
};

/** @returns {'pending'|'done'|'derived'} */
export function getSourceStatus(source, stats = null, st = state) {
  switch (source) {
    case 'hist':
      return (stats?.atendimentos > 0 || st.raw.length > 0) ? 'done' : 'pending';
    case 'tri': {
      if (stats?.triagem > 0 || st.triSource === 'file' || st.triSource === 'db') return 'done';
      if (stats?.atendimentos > 0 || st.raw.length > 0) return 'derived';
      return 'pending';
    }
    case 'cid':
      return (stats?.cid > 0 || st.cidRaw.length > 0) ? 'done' : 'pending';
    case 'proc':
      return st.procRaw.length > 0 ? 'done' : 'pending';
    case 'exam':
      return st.examesRaw.length > 0 ? 'done' : 'pending';
    default:
      return 'pending';
  }
}

export function renderHomeSourceChecklist(stats = null, st = state) {
  const el = document.getElementById('upSourceChecklist');
  if (!el) return;
  el.querySelectorAll('li[data-source]').forEach(li => {
    const src = li.dataset.source;
    li.className = getSourceStatus(src, stats, st);
    const label = SOURCE_LABELS[src] || src;
    li.innerHTML = `<span class="up-check-icon" aria-hidden="true"></span> ${label}`;
    if (li.className === 'derived') {
      li.title = 'Triagem derivada do histórico — carregue a planilha para dados completos';
    } else {
      li.title = '';
    }
  });
}

export function formatTtlRemaining() {
  try {
    const ts = parseInt(localStorage.getItem(TTL_KEY) || '0', 10);
    if (!ts) return null;
    const rem = 12 * 60 * 60 * 1000 - (Date.now() - ts);
    if (rem <= 0) return null;
    const h = Math.floor(rem / 3600000);
    const m = Math.floor((rem % 3600000) / 60000);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  } catch {
    return null;
  }
}

function _fmtDateBR(d) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * @param {{ atendimentos?: number, cid?: number, triagem?: number }} stats
 * @param {{ min?: Date, max?: Date }|null} period
 */
export function formatSessionHealth(stats, st = state, period = null) {
  const parts = [];
  const att = stats?.atendimentos ?? st.raw.length;
  if (att > 0) parts.push(`${att.toLocaleString('pt-BR')} atendimentos`);

  const triCount = stats?.triagem ?? st.triRaw.length;
  const triPersisted = (stats?.triagem > 0) || st.triSource === 'file' || st.triSource === 'db';
  if (triPersisted && triCount > 0) {
    parts.push(`Triagem: ${triCount.toLocaleString('pt-BR')}`);
  } else if (att > 0) {
    parts.push('Triagem derivada');
  }

  const cidCount = stats?.cid ?? st.cidRaw.length;
  if (cidCount > 0) parts.push(`CID: ${cidCount.toLocaleString('pt-BR')}`);

  const ttl = formatTtlRemaining();
  if (ttl) parts.push(`TTL: ${ttl}`);

  const line1 = parts.join(' · ');
  let line2 = '';
  if (period?.min && period?.max) {
    line2 = `Período: ${_fmtDateBR(period.min)} – ${_fmtDateBR(period.max)}`;
  } else if (st.raw.length) {
    const dhs = st.raw.map(r => r.dh?.getTime?.()).filter(Boolean);
    if (dhs.length) {
      line2 = `Período: ${_fmtDateBR(new Date(Math.min(...dhs)))} – ${_fmtDateBR(new Date(Math.max(...dhs)))}`;
    }
  }
  return { line1, line2 };
}

export function renderSessionHealth(stats, period = null, st = state) {
  const el = document.getElementById('upSessionHealth');
  if (!el) return;
  const { line1, line2 } = formatSessionHealth(stats, st, period);
  if (!line1) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.innerHTML = escHtml(line1) + (line2 ? `<div class="up-session-period">${escHtml(line2)}</div>` : '');
  el.style.display = 'block';
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Atualiza checklist + saúde da sessão na home (antes ou após carregar dashboard). */
export function updateHomeFromStats(stats, period = null) {
  renderHomeSourceChecklist(stats);
  renderSessionHealth(stats, period);
}
