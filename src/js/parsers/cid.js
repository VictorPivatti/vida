// parsers/cid.js — CID (diagnosis codes) parsing
// Extracted from src/index.template.html <script> block.

import { ALIAS, FALLBACK } from '../constants.js';
import { norm } from './workbook.js';
import { ymd, monthKey } from '../utils/dates.js';
import { state } from '../state.js';
import { csvRows, legacyText, parseDate, chooseParsed } from './hist.js';

// ── Internal schema helpers (cid-specific) ──────────────────────────────────

function val(row, idx) { return idx == null ? '' : row[idx]; }

function indexHeaders(header, type, rows) {
  const names = header.map(norm), out = {};
  Object.entries(ALIAS[type]).forEach(([field, list]) => {
    const wanted = list.map(norm);
    let idx = names.findIndex(h => wanted.includes(h));
    if (idx < 0) idx = names.findIndex(h => wanted.some(w => h.includes(w) || w.includes(h)));
    out[field] = idx >= 0 ? idx : null;
  });
  // Fallback for missing fields
  Object.keys(out).forEach(f => { if (out[f] == null) out[f] = FALLBACK[type]?.[f] ?? null; });
  return out;
}

// ── CID parsers ──────────────────────────────────────────────────────────────

/**
 * Parse CID CSV using fixed positional columns (legacy format).
 * Real file structure (16 fields):
 * [0]codmun [1-3]extras [4]numprontuario [5]codcid [6]data [7]id_paciente
 * [8]nome_paciente [9]descicao_cid [10-13]extras [14]nome_medico
 * Returns {data, total, invalid, msg}.
 */
export function parseCidLegacy(csv) {
  const rows = [], lines = csvRows(csv); let invalid = 0;
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i];
    if (p.length < 6) continue;
    const isFullFormat = p.length >= 10;
    const cid = String(isFullFormat ? p[5] : p[1] || '').trim().toUpperCase();
    const dh = parseDate(isFullFormat ? p[6] : p[2]);
    if (!cid || !dh || cid === 'CODCID') { invalid++; continue; }
    const idAtend = String(isFullFormat ? p[4] : p[0] || '').trim();
    const medico = legacyText(isFullFormat ? p[14] : p[3] || '').trim();
    const desc = legacyText(isFullFormat ? p[9] : p[4] || '').trim();
    const paciente = legacyText(isFullFormat ? (p[8] || '') : '').trim();
    rows.push({
      sourceLine: i + 1, cid, desc, medico, idAtend, paciente,
      dh, dateKey: ymd(dh), anoMes: monthKey(dh), mes: dh.getMonth() + 1, cap: cid[0] || '?',
    });
  }
  return {
    data: rows.sort((a, b) => a.dh - b.dh), total: Math.max(lines.length - 1, 0), invalid,
    msg: `${invalid} linhas sem CID ou data válida foram ignoradas.`,
  };
}

/**
 * Parse CID from raw text (same logic as parseCidLegacy but returns array directly).
 * Used by workerRun to process multiple CID files.
 */
export function parseCidFromText(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const p = line.split(';');
    if (p.length < 6) continue;
    const isFullFormat = p.length >= 10;
    const cid = (isFullFormat ? p[5] : p[1] || '').trim().toUpperCase();
    const dh = parseDate(isFullFormat ? p[6] : p[2]);
    if (!cid || !dh || cid === 'CODCID') continue;
    const idAtend = (isFullFormat ? p[4] : p[0] || '').trim();
    const medico = (isFullFormat ? p[14] : p[3] || '').trim();
    const desc = (isFullFormat ? p[9] : p[4] || '').trim();
    const paciente = (isFullFormat ? (p[8] || '') : '').trim();
    rows.push({
      sourceLine: i + 1, cid, desc, medico, idAtend, paciente,
      dh, dateKey: ymd(dh), anoMes: monthKey(dh), mes: dh.getMonth() + 1, cap: cid[0] || '?',
    });
  }
  return rows.sort((a, b) => a.dh - b.dh);
}

/**
 * Parse CID using header-based column detection.
 * Returns array of row objects (sorted by dh).
 */
export function parseCid(rows, addQuality = true) {
  const header = rows[0] || [], idx = indexHeaders(header, 'cid', rows), data = [], issues = { invalid: 0 };
  rows.slice(1).forEach((row, line) => {
    if (!row.some(x => String(x).trim())) return;
    const cid = String(val(row, idx.cid) || '').trim().toUpperCase();
    const dh = parseDate(val(row, idx.data));
    if (!cid || !dh) { issues.invalid++; return; }
    data.push({
      sourceLine: line + 2, cid,
      desc: String(val(row, idx.desc) || '').trim(),
      medico: String(val(row, idx.medico) || '').trim(),
      idAtend: String(val(row, idx.idAtend) || '').trim(),
      paciente: String(val(row, idx.paciente) || '').trim(),
      dh, dateKey: ymd(dh), anoMes: monthKey(dh), mes: dh.getMonth() + 1, cap: cid[0] || '?',
    });
  });
  if (addQuality) state.quality.push({ type: 'CID', total: rows.length - 1, valid: data.length, invalid: issues.invalid, msg: `${issues.invalid} linhas sem CID ou data válida foram ignoradas.` });
  return data.sort((a, b) => a.dh - b.dh);
}
