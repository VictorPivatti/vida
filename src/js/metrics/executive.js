// metrics/executive.js — scoring / executive points functions

/**
 * Calculate doctor productivity score for a set of attendance rows.
 * Points are awarded per attendance, per age group, and per triage colour.
 *
 * @param {object[]} rows  Attendance records for one doctor.
 * @returns {number}
 */
export function calcularPontos(rows) {
  return rows.reduce((p, r) => {
    p++;
    if (r.idade != null) {
      if (r.idade <= 12) p++;
      if (r.idade <= 2) p++;
      if (r.idade >= 60) p++;
      if (r.idade >= 80) p++;
    }
    if (r.cor === 'AMARELO') p += 2;
    else if (r.cor === 'LARANJA' || r.cor === 'VERMELHO') p += 5;
    return p;
  }, 0);
}
