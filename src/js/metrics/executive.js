// metrics/executive.js — scoring / executive points functions
// NOTE: Also exists in original <script> block (will be removed in Tasks 7–9).

/**
 * Calculate doctor productivity score for a set of attendance rows.
 * Points are awarded per attendance, per age group, and per triage colour.
 *
 * @param {object[]} rows  Attendance records for one doctor.
 * @returns {number}
 */
export function calcularPontos(rows) {
  let p = 0;
  p += rows.length;
  p += rows.filter(r => r.idade != null && r.idade <= 12).length;
  p += rows.filter(r => r.idade != null && r.idade <= 2).length;
  p += rows.filter(r => r.idade != null && r.idade >= 60).length;
  p += rows.filter(r => r.idade != null && r.idade >= 80).length;
  p += rows.filter(r => r.cor === 'AMARELO').length * 2;
  p += rows.filter(r => r.cor === 'LARANJA' || r.cor === 'VERMELHO').length * 5;
  return p;
}
