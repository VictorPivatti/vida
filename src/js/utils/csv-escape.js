/** Escapa célula para CSV delimitado por ponto-e-vírgula. */
export function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Converte linha (array) em texto CSV com separador `;`. */
export function rowToCsv(row) {
  return row.map(csvCell).join(';');
}
