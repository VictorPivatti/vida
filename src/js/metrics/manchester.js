// metrics/manchester.js — Manchester triage conformity metrics

// Default Manchester time thresholds (minutes) per triage colour.
// These match the values stored in the DOM input elements; when running
// outside the browser the constants below are used as fallbacks.
const MANCHESTER_METAS = { VERMELHO: 0, LARANJA: 15, AMARELO: 60, VERDE: 120, AZUL: 240, BRANCO: 240 };
const MANCHESTER_CORES = ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL', 'BRANCO'];

/**
 * Return the Manchester time threshold (minutes) for a given triage colour.
 * In the browser, reads the user-configurable input element; outside the
 * browser (tests, Node), falls back to MANCHESTER_METAS.
 *
 * @param {string} cor  Triage colour (e.g. "VERMELHO", "LARANJA").
 * @returns {number}
 */
export function metaManchester(cor) {
  if (!cor) return 60;
  if (typeof document !== 'undefined') {
    const id = 'meta' + cor.charAt(0) + cor.slice(1).toLowerCase();
    const el = document.getElementById(id);
    if (el) return Number(el.value);
  }
  return MANCHESTER_METAS[cor] ?? 60;
}

/**
 * Compute Manchester conformity stats per triage colour over a rows array.
 *
 * @param {object[]} rows  Array of attendance records.
 * @returns {object}  Map from colour → { total, ok, semDado, meta, D, N }.
 */
export function manchesterConformidade(rows) {
  const metas = {};
  MANCHESTER_CORES.forEach(c => { metas[c] = metaManchester(c); });
  const byRisco = {};
  rows.forEach(r => {
    if (!r.cor) return;
    byRisco[r.cor] = byRisco[r.cor] || {
      total: 0, ok: 0, semDado: 0, meta: metas[r.cor] ?? metaManchester(r.cor),
      D: { total: 0, ok: 0 }, N: { total: 0, ok: 0 }
    };
    const x = byRisco[r.cor];
    if (r.tEspMed == null) { x.semDado++; return; }
    x.total++;
    if (r.tEspMed <= x.meta) x.ok++;
    const t = (r.turno === 'D' || r.turno === 'N') ? r.turno : null;
    if (!t) return;
    x[t].total++;
    if (r.tEspMed <= x.meta) x[t].ok++;
  });
  return byRisco;
}
