/**
 * Parser CSV com máquina de estados para campos entre aspas.
 * Compatível com rowToCsv (csv-escape.js) — delimitador ; por padrão.
 */

/** Divide uma linha CSV em células, respeitando aspas e "" como escape. */
export function splitCsvLine(line, sep = ';') {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Converte texto CSV em matriz de linhas (arrays de strings). */
export function csvRowsFromText(text, sep = ';') {
  const rows = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    rows.push(splitCsvLine(line, sep));
  }
  return rows;
}

/** Detecta separador (; ou ,) pela primeira linha não vazia. */
export function detectCsvSep(text) {
  const first = String(text ?? '').split(/\r?\n/).find(l => l.trim()) || '';
  const sc = (first.match(/;/g) || []).length;
  const cc = (first.match(/,/g) || []).length;
  return sc >= cc ? ';' : ',';
}

/** Parse CSV texto → { rows, csv } (csv = texto original). */
export function parseCsvToRows(text) {
  const csv = String(text ?? '');
  const sep = detectCsvSep(csv);
  return { rows: csvRowsFromText(csv, sep), csv };
}
