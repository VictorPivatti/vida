// parsers/buffer-to-csv.js — ArrayBuffer → sheet rows or CSV text (XLS/XLSX/CSV)

import { smartDecode, xlsxExtract } from './workbook.js';
import { rowToCsv } from '../utils/csv-escape.js';

function _fileMagic(buf) {
  const u8 = new Uint8Array(buf);
  return u8.length >= 2
    ? [u8[0], u8[1]]
    : u8.length === 1 ? [u8[0], 0] : [0, 0];
}

function _isSpreadsheet(buf) {
  const [a, b] = _fileMagic(buf);
  return (a === 0xD0 && b === 0xCF) || (a === 0x50 && b === 0x4B);
}

/**
 * Convert ArrayBuffer to sheet rows (preferred) or CSV text.
 * xlsxExtract is tried before XLSX.read to avoid main-thread freeze on fallback paths.
 *
 * @returns {Promise<{ rows?: string[][], csv: string }>}
 */
export async function bufferToHistData(buf, name, opts = {}) {
  const [m0, m1] = _fileMagic(buf);
  const isBin = _isSpreadsheet(buf);
  console.log('[VIDA:hist] arquivo:', name, '| isBin:', isBin, '| magic: 0x' +
    m0.toString(16).padStart(2, '0') + m1.toString(16).padStart(2, '0'));

  let rows = null;
  let csv = null;

  if (isBin) {
    opts.onConverting?.();
    csv = await xlsxExtract(buf, 'hist');
    if (csv) {
      console.log('[VIDA:hist] xlsxExtract OK | arquivo:', name, '| chars:', csv.length);
    }
  }

  if (!csv && isBin && typeof XLSX !== 'undefined') {
    opts.onConverting?.();
    try {
      // eslint-disable-next-line no-undef
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: true });
      const sh = wb.Sheets[wb.SheetNames[0]];
      // eslint-disable-next-line no-undef
      rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: true });
      csv = rows.map(r => rowToCsv(r)).join('\n');
      console.log('[VIDA:hist] XLSX.read OK | arquivo:', name, '| rows:', rows.length);
    } catch (xlsErr) { console.warn('[workerRun] XLSX.read falhou:', xlsErr.message); }
  }

  if (csv && !csv.includes(';')) csv = null;
  if (!csv && !rows) csv = smartDecode(buf);
  return { rows: rows || undefined, csv: csv || '' };
}

/** @deprecated use bufferToHistData — returns CSV string only (CID path). */
export async function bufferToCsv(buf, name, opts = {}) {
  const { csv } = await bufferToHistData(buf, name, opts);
  return csv;
}
