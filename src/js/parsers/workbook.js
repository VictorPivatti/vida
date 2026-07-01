// parsers/workbook.js — low-level I/O and encoding helpers
import { rowToCsv } from '../utils/csv-escape.js';
// NOTE: smartDecode, xlsxExtract, sheetData, readWorkbook depend on browser APIs
// (TextDecoder, FileReader, DecompressionStream, XLSX CDN global).

const VIDA_DEBUG = typeof localStorage !== 'undefined' && localStorage.getItem('vida_debug') === '1';
function _dbg(...args) { if (VIDA_DEBUG) console.log(...args); }
function _dbgTime(label) { if (VIDA_DEBUG) console.time(label); }
function _dbgTimeEnd(label) { if (VIDA_DEBUG) console.timeEnd(label); }

// ── Encoding / decoding helpers ─────────────────────────────────────────────

/** Normalise a string: strip accents, lowercase, collapse non-alphanum to space. */
export const norm = s =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Decode named + numeric XML entities. */
export function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

/**
 * Reverse CP1252 map: Unicode code points in 0x80-0x9F range → CP1252 byte.
 * Used by fixMojibake to convert mojibake strings back to UTF-8.
 */
export const _CP1252_REV = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A],
  [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92],
  [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C],
  [0x017E, 0x9E], [0x0178, 0x9F],
]);

/**
 * Reverse mojibake: UTF-8 bytes read as CP1252 → correct Unicode string.
 * E.g. "LOURENÃ‡O" (bytes C3 87 read as CP1252) → "LOURENÇO".
 */
export function fixMojibake(str) {
  if (!str || typeof str !== 'string') return str;
  if (!/[\xC0-\xC5\xC7-\xCF\xD1-\xD6\xD8-\xDD\xE0-\xE5\xE7-\xEF\xF1-\xF6\xF8-\xFD]/.test(str)) return str;
  try {
    const bytes = [];
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      if (cp <= 0x7F) { bytes.push(cp); }
      else if (cp >= 0xA0 && cp <= 0xFF) { bytes.push(cp); }
      else if (_CP1252_REV.has(cp)) { bytes.push(_CP1252_REV.get(cp)); }
      else { return str; }
    }
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    return fixed !== str ? fixed : str;
  } catch (e) { return str; }
}

/**
 * Reverse Mac OS Roman → Unicode for bytes 0x80-0xBF (valid UTF-8 continuation range).
 * √ (U+221A) is MacRoman byte 0xC3 — the indicator that a string may be Mac mojibake.
 */
export const _MACROMAN_REV = new Map([
  // 0x80-0x9F: accented letters (differ from Latin-1)
  [0x00C4, 0x80], [0x00C5, 0x81], [0x00C7, 0x82], [0x00C9, 0x83], [0x00D1, 0x84],
  [0x00D6, 0x85], [0x00DC, 0x86], [0x00E1, 0x87], [0x00E0, 0x88], [0x00E2, 0x89],
  [0x00E4, 0x8A], [0x00E3, 0x8B], [0x00E5, 0x8C], [0x00E7, 0x8D], [0x00E9, 0x8E],
  [0x00E8, 0x8F], [0x00EA, 0x90], [0x00EB, 0x91], [0x00ED, 0x92], [0x00EC, 0x93],
  [0x00EE, 0x94], [0x00EF, 0x95], [0x00F1, 0x96], [0x00F3, 0x97], [0x00F2, 0x98],
  [0x00F4, 0x99], [0x00F6, 0x9A], [0x00F5, 0x9B], [0x00FA, 0x9C], [0x00F9, 0x9D],
  [0x00FB, 0x9E], [0x00FC, 0x9F],
  // 0xA0-0xBF: symbols and letters (many differ from Latin-1)
  [0x2020, 0xA0], [0x00B0, 0xA1], [0x00A2, 0xA2], [0x00A3, 0xA3], [0x00A7, 0xA4],
  [0x2022, 0xA5], [0x00B6, 0xA6], [0x00DF, 0xA7], [0x00AE, 0xA8], [0x00A9, 0xA9],
  [0x2122, 0xAA], [0x00B4, 0xAB], [0x00A8, 0xAC], [0x2260, 0xAD], [0x00C6, 0xAE],
  [0x00D8, 0xAF], [0x221E, 0xB0], [0x00B1, 0xB1], [0x2264, 0xB2], [0x2265, 0xB3],
  [0x00A5, 0xB4], [0x00B5, 0xB5], [0x2202, 0xB6], [0x2211, 0xB7], [0x220F, 0xB8],
  [0x03C0, 0xB9], [0x222B, 0xBA], [0x00AA, 0xBB], [0x00BA, 0xBC], [0x03A9, 0xBD],
  [0x00E6, 0xBE], [0x00F8, 0xBF],
]);

/**
 * Reverse Mac OS Roman mojibake: UTF-8 bytes read as MacRoman → correct Unicode.
 * E.g. "JO√£O" (bytes C3 A3 read as MacRoman) → "JOãO".
 * √ (U+221A) is the indicator — MacRoman byte 0xC3 (the UTF-8 2-byte leader for U+00C0–U+00FF).
 */
export function fixMojibakeMac(str) {
  if (!str || typeof str !== 'string') return str;
  // Detect √ (U+221A = MacRoman byte 0xC3) via numeric codepoint to avoid
  // double-escaping when the worker bundle is JSON.stringify'd by the build script.
  let hasSqrt = false;
  for (let _k = 0; _k < str.length; _k++) { if (str.charCodeAt(_k) === 0x221A) { hasSqrt = true; break; } }
  if (!hasSqrt) return str;
  try {
    const bytes = [];
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      if (cp <= 0x7F) { bytes.push(cp); }
      else if (cp === 0x221A) { bytes.push(0xC3); }
      else if (_MACROMAN_REV.has(cp)) { bytes.push(_MACROMAN_REV.get(cp)); }
      else if (cp >= 0xA0 && cp <= 0xFF) { bytes.push(cp); }
      else { return str; }
    }
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    return fixed !== str ? fixed : str;
  } catch (e) { return str; }
}

// ── Browser-only I/O helpers ─────────────────────────────────────────────────
// The functions below require browser APIs (TextDecoder with ArrayBuffer,
// FileReader, DecompressionStream, XLSX global). They are exported so app.js
// can import them, but they will throw/fail in Node.js.

/**
 * Decode an ArrayBuffer to string, auto-detecting UTF-8 vs Windows-1252.
 * Browser-only (requires TextDecoder with ArrayBuffer support).
 */
export function smartDecode(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  const replacements = (utf8.match(/�/g) || []).length;
  if (replacements === 0) return utf8;
  if (replacements / utf8.length < 0.005) return utf8;
  return new TextDecoder('windows-1252').decode(buf);
}

/**
 * Read a named file entry from a ZIP ArrayBuffer using DecompressionStream.
 * Browser-only.
 */
export async function readZipEntry(arrayBuf, targetName) {
  _dbg('[VIDA:zip] readZipEntry | alvo:', targetName, '| buf:', arrayBuf.byteLength, 'bytes');
  _dbgTime('[VIDA:zip] readZipEntry ' + targetName);
  const buf = new Uint8Array(arrayBuf);
  const dv = new DataView(arrayBuf);
  let off = 0, idx = 0;
  while (off < buf.length - 30) {
    if (dv.getUint32(off, true) !== 0x04034B50) break;
    const gpFlag = dv.getUint16(off + 6, true);
    const method = dv.getUint16(off + 8, true);
    const cSize = dv.getUint32(off + 18, true);
    const nameLen = dv.getUint16(off + 26, true);
    const extraLen = dv.getUint16(off + 28, true);
    const name = new TextDecoder().decode(buf.slice(off + 30, off + 30 + nameLen));
    _dbg('[VIDA:zip] entrada #' + idx + ' | nome:', name, '| cSize:', cSize,
      '| gpFlag: 0x' + gpFlag.toString(16), '| bit3(data-descriptor):', !!(gpFlag & 8),
      '| method:', method);
    if (cSize === 0 && (gpFlag & 8)) console.warn('[VIDA:zip] ATENCAO: cSize=0 + bit3 set (ZIP streaming) -- DecompressionStream pode travar');
    if (cSize === 0xFFFFFFFF) console.warn('[VIDA:zip] ATENCAO: cSize=0xFFFFFFFF (ZIP64) -- loop ira travar');
    idx++;
    const dataOff = off + 30 + nameLen + extraLen;
    if (name === targetName) {
      _dbg('[VIDA:zip] alvo encontrado | descomprimindo | cSize efetivo:', cSize);
      const compressed = arrayBuf.slice(dataOff, dataOff + cSize);
      if (method === 0) {
        const result = new TextDecoder('utf-8').decode(compressed);
        _dbg('[VIDA:zip] method=stored | tamanho:', result.length, 'chars');
        _dbgTimeEnd('[VIDA:zip] readZipEntry ' + targetName);
        return result;
      }
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      writer.write(new Uint8Array(compressed));
      writer.close();
      const parts = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; parts.push(value); }
      const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
      let pos = 0; for (const p of parts) { out.set(p, pos); pos += p.length; }
      const result = new TextDecoder('utf-8').decode(out);
      _dbg('[VIDA:zip] descomprimido | tamanho:', result.length, 'chars');
      _dbgTimeEnd('[VIDA:zip] readZipEntry ' + targetName);
      return result;
    }
    off = dataOff + cSize;
  }
  _dbg('[VIDA:zip] alvo nao encontrado:', targetName, '| entradas lidas:', idx);
  _dbgTimeEnd('[VIDA:zip] readZipEntry ' + targetName);
  return null;
}

/**
 * Extract CSV from xlsx by reading sharedStrings.xml directly (avoids XLSX.read).
 * Browser-only.
 */
export async function xlsxExtract(ab) {
  _dbg('[VIDA:xlsx] xlsxExtract | buf:', ab.byteLength, 'bytes');
  _dbgTime('[VIDA:xlsx] xlsxExtract');
  const xml = await readZipEntry(ab, 'xl/sharedStrings.xml');
  if (!xml) {
    _dbg('[VIDA:xlsx] xlsxExtract | sharedStrings.xml ausente -- retornando null');
    _dbgTimeEnd('[VIDA:xlsx] xlsxExtract');
    return null;
  }
  _dbg('[VIDA:xlsx] sharedStrings.xml | tamanho:', xml.length, 'chars');
  const strings = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  const tRe = /<t[^>]*>([^<]*)<\/t>/g;
  let si;
  while ((si = siRe.exec(xml)) !== null) {
    const block = si[1]; let seg = '', t;
    tRe.lastIndex = 0;
    while ((t = tRe.exec(block)) !== null) seg += t[1];
    strings.push(fixMojibake(decodeXmlEntities(seg)).normalize('NFC'));
  }
  _dbg('[VIDA:xlsx] <si> processados:', strings.length);
  _dbgTimeEnd('[VIDA:xlsx] xlsxExtract');
  return strings.length > 1 ? strings.join('\n') : null;
}

/**
 * Read a File object and return {_csv, text} or {_csv:false, wb}.
 * Browser-only (requires FileReader, XLSX global).
 */
export function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const sniff = new FileReader();
    sniff.onload = async e => {
      try {
        const hdr = new Uint8Array(e.target.result);
        const isBin = (hdr[0] === 0xD0 && hdr[1] === 0xCF) || (hdr[0] === 0x50 && hdr[1] === 0x4B);
        if (!isBin) {
          const r = new FileReader();
          r.onload = ev => { try { resolve({ _csv: true, text: smartDecode(ev.target.result) }); } catch (e) { reject(e); } };
          r.onerror = () => reject(r.error);
          r.readAsArrayBuffer(file);
          return;
        }
        const r = new FileReader();
        r.onload = async ev => {
          try {
            const ab = ev.target.result;
            const csv = await xlsxExtract(ab);
            if (csv && csv.includes(';')) {
              resolve({ _csv: true, text: csv });
            } else {
              // eslint-disable-next-line no-undef
              resolve({ _csv: false, wb: XLSX.read(ab, { type: 'array', raw: true }) });
            }
          } catch (err) { reject(err); }
        };
        r.onerror = () => reject(r.error);
        r.readAsArrayBuffer(file);
      } catch (err) { reject(err); }
    };
    sniff.onerror = () => reject(sniff.error);
    sniff.readAsArrayBuffer(file.slice(0, 4));
  });
}

/**
 * Parse CSV text into {rows, csv}.
 * Works in both browser and Node.
 */
export function parseCsvDirect(text) {
  const lines = text.split(/\r?\n/);
  const sep = lines[0] && lines[0].includes(';') ? ';' : ',';
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    rows.push(line.split(sep));
  }
  return { rows, csv: text };
}

/**
 * Read a File and return {rows, csv}.
 * Browser-only (requires FileReader, XLSX global).
 */
export async function sheetData(file) {
  const result = await readWorkbook(file);
  if (result._csv) return parseCsvDirect(result.text);
  // Fallback BIFF (old xls)
  const wb = result.wb;
  const sh = wb.Sheets[wb.SheetNames[0]];
  // eslint-disable-next-line no-undef
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: true });
  const csv = rows.map(r => rowToCsv(r)).join('\n');
  return { rows, csv };
}
