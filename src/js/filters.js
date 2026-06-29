// filters.js — Central filter, date setup, and medico filter population
// Extracted from src/index.template.html <script> block (Task A.1).
// NOTE: The monolith's <script> block still contains these functions.
//       This module coexists with it during the cutover phase.

import { state } from './state.js';
import { parseDate } from './parsers/hist.js';
import { norm } from './parsers/workbook.js';
import { ymd } from './utils/dates.js';
import { $, esc, shortName } from './utils/dom.js';
import { renderAll } from './render/index.js';

// ── setupDates ────────────────────────────────────────────────────────────────
export function setupDates() {
  if (!state.raw.length) return;
  const min = state.raw[0].dh;
  const max = state.raw[state.raw.length - 1].dh;
  $('dateStart').value = ymd(min);
  $('dateEnd').value = ymd(max);
}

// ── applyFilters — central filter for state ───────────────────────────────────
export function applyFilters() {
  state._filtVersion++;
  if (!state.raw.length) return;
  const s = parseDate($('dateStart').value);
  const e = parseDate($('dateEnd').value);
  if (e) e.setHours(23, 59, 59, 999);
  const turno = $('turno').value;
  const medFiltEl = $('filtroMedico');
  const medFilt = norm((medFiltEl ? medFiltEl.value : '') || '');
  const riscoFiltEl = $('filtroRisco');
  const riscoFilt = riscoFiltEl ? riscoFiltEl.value : 'all';
  // FIX: usar dateKey AJUSTADA para filtro de período (igual ao código base Python)
  // Atendimentos da madrugada (00:00–06:59) pertencem ao plantão noturno do dia anterior,
  // então r.dateKey já está ajustado. Comparar dateKey (string YYYY-MM-DD) com s/e.
  const sKey = s ? ymd(s) : null;
  const eKey = e ? ymd(e) : null;
  const inRange = r =>
    (!sKey || r.dateKey >= sKey) &&
    (!eKey || r.dateKey <= eKey) &&
    (turno === 'all' || r.turno === turno) &&
    (!medFilt || norm(shortName(r.prof || '')).includes(medFilt)) &&
    (riscoFilt === 'all' || (r.cor || '').toUpperCase() === riscoFilt);
  state.filt = state.raw.filter(inRange);
  // Triagem: dateKey agora ajustada igual ao histórico (madrugada → dia anterior)
  state.triFilt = state.triRaw.filter(r =>
    (!sKey || r.dateKey >= sKey) && (!eKey || r.dateKey <= eKey) &&
    (turno === 'all' || r.turno === turno)
  );
  state.cidFilt = state.cidRaw.filter(r => (!s || r.dh >= s) && (!e || r.dh <= e));
  const recordBadge = $('recordBadge');
  if (recordBadge) recordBadge.textContent = `${state.filt.length.toLocaleString('pt-BR')} registros`;
  renderAll();
}

// ── populateMedicoFilter — fills the médico dropdown datalist ─────────────────
export function populateMedicoFilter() {
  const dl = $('filtroMedicoList');
  if (!dl) return;
  // dedup por norm() antes de exibir shortName
  const seen = new Set();
  const medicos = state.raw
    .filter(r => r.prof)
    .filter(r => { const k = norm(r.prof); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(r => shortName(r.prof))
    .filter(Boolean)
    .sort();
  dl.innerHTML = medicos.map(m => `<option value="${esc(m)}">`).join('');
}
