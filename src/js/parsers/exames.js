// parsers/exames.js — exam (exames/PDF) parsing
// Extracted from src/index.template.html <script> block.
// parseExamesPdf depends on state.examesMeta and requires pdf.js (browser CDN global).

import { state } from '../state.js';

/**
 * Parse pre-extracted PDF text lines into exam records.
 * allLines: [{text: string, x0: number}]
 * Returns array of {guia, data, n_exames, n_sub, valor, doctor, exames[]}.
 */
export function _parseExamesLines(allLines) {
  const records = [];
  let cur = null;
  for (const { text, x0 } of allLines) {
    const gm = text.match(/^(06-\d+)\s+(.*)/);
    if (gm) {
      const rest = gm[2];
      const fm = rest.match(/(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)/);
      if (fm) {
        const val = parseFloat(fm[6].replace(/\./g, '').replace(',', '.')) || 0;
        cur = { guia: gm[1], data: fm[2], n_exames: parseInt(fm[3]), n_sub: parseInt(fm[4]), valor: val, doctor: null, exames: [] };
        records.push(cur);
      }
      continue;
    }
    if (cur && x0 > 35 && !text.includes('Solicitante')) {
      const em = text.match(/^([A-ZÀ-ÖØ-Þ\/\-\+\s\.\(\)]+?)\s+[\d,]+\s+[\d,]+\s*$/);
      if (em) {
        const nome = em[1].trim();
        if (nome.length > 2 && !/^(Total|Lista|Período|Conv|Prest|Local|Usu|Autolac|Pág)/.test(nome)) {
          cur.exames.push(nome);
        }
      }
    }
    if (text.includes('Solicitante Responsável:') && cur) {
      cur.doctor = text.split('Solicitante Responsável:')[1].trim() || null;
    }
  }
  return records;
}

/**
 * Parse a PDF exam file using pdf.js.
 * Browser-only (requires pdf.js CDN library and state.examesMeta).
 * @param {object} lib - pdf.js library object (pdfjsLib)
 * @param {ArrayBuffer} buf - PDF file buffer
 */
export async function parseExamesPdf(lib, buf) {
  const pdf = await lib.getDocument({ data: buf }).promise;
  const allLines = [];
  let periodo = '', prestador = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const byY = {};
    for (const item of tc.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      (byY[y] = byY[y] || []).push({ x: Math.round(item.transform[4]), s: item.str.trim() });
    }
    Object.keys(byY).map(Number).sort((a, b) => b - a).forEach(y => {
      const items = byY[y].sort((a, b) => a.x - b.x);
      const text = items.map(i => i.s).join(' ');
      allLines.push({ text, x0: items[0].x });
      if (!periodo && text.includes('Período:')) {
        const m = text.match(/Período:\s*([\d\/: à]+)/);
        if (m) periodo = m[1].trim();
      }
      if (!prestador && text.includes('Prestador:')) {
        prestador = text.replace('Prestador:', '').trim();
      }
    });
  }
  const records = _parseExamesLines(allLines);
  state.examesMeta = {
    periodo, prestador,
    validacao: {
      guias: records.length,
      exames: records.reduce((s, r) => s + r.n_exames, 0),
      valor: records.reduce((s, r) => s + r.valor, 0),
    },
  };
  return records;
}

/**
 * Classify an exam by name into a clinical group.
 */
export function grupoExame(n) {
  n = n.toUpperCase();
  if (/TROPONINA|CREATINOFOSFOQUINASE|CPK|CK-MB/.test(n)) return 'Cardíaco';
  if (/HEMOGRAMA|LEUCOCIT|PLAQUETA|ERITROCIT/.test(n)) return 'Hematologia';
  if (/PCR|PROTEINA C|VHS/.test(n)) return 'Inflamatório';
  if (/CREATININA|UREIA|TFG/.test(n)) return 'Renal';
  if (/TGO|TGP|BILIRRUB|GAMA GT|FOSFATASE|AMILASE|LIPASE/.test(n)) return 'Hepático/Pancreático';
  if (/SODIO|POTASSIO|CLORO|CALCIO|MAGNESIO|FOSFORO/.test(n)) return 'Eletrólitos';
  if (/GLICOSE|HBA1C|INSULINA|LACTATO/.test(n)) return 'Metabólico';
  if (/URINA|GRAM DE GOTA|UROCULTURA/.test(n)) return 'Urinário';
  if (/PROTROMBINA|TROMBOPLASTINA|RNI|FIBRINOG|PTT/.test(n)) return 'Coagulação';
  if (/TSH|T3|T4|TIREOIDE/.test(n)) return 'Tireoide';
  return 'Outros';
}
