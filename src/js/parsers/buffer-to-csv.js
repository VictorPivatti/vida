// parsers/buffer-to-csv.js — ArrayBuffer → CSV text (XLS/XLSX/CSV)

import { smartDecode, xlsxExtract } from './workbook.js';
import { rowToCsv } from '../utils/csv-escape.js';

/**
 * Convert an ArrayBuffer to CSV-like text for parsers.
 * Tries XLSX.read, then xlsxExtract, then smartDecode.
 *
 * @param {ArrayBuffer} buf
 * @param {string} name  Original filename (for logs)
 * @param {{ onConverting?: () => void }} [opts]
 * @returns {Promise<string>}
 */
export async function bufferToCsv(buf, name, opts = {}) {
  const hdr = new Uint8Array(buf, 0, 4);
  const isBin = (hdr[0] === 0xD0 && hdr[1] === 0xCF) || (hdr[0] === 0x50 && hdr[1] === 0x4B);
  console.log('[VIDA:hist] arquivo:', name, '| isBin:', isBin, '| magic: 0x' +
    hdr[0].toString(16).padStart(2, '0') + hdr[1].toString(16).padStart(2, '0'));
  let csv = null;
  if (isBin && typeof XLSX !== 'undefined') {
    opts.onConverting?.();
    try {
      // eslint-disable-next-line no-undef
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: false });
      const sh = wb.Sheets[wb.SheetNames[0]];
      // eslint-disable-next-line no-undef
      const arr = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false });
      csv = arr.map(r => rowToCsv(r)).join('\n');
      console.log('[VIDA:hist] XLSX.read OK | arquivo:', name, '| chars:', csv.length);
    } catch (xlsErr) { console.warn('[workerRun] XLSX.read falhou:', xlsErr.message); }
  }
  if (!csv && isBin) {
    opts.onConverting?.();
    csv = await xlsxExtract(buf);
    console.log('[VIDA:hist] xlsxExtract result | arquivo:', name, '| csv:', csv ? ('string[' + csv.length + '] temPontoVirgula=' + csv.includes(';')) : null);
  }
  if (csv && !csv.includes(';')) csv = null;
  if (!csv) csv = smartDecode(buf);
  return csv;
}
