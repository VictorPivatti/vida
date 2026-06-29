// parsers/tri.js — triage (triagem) parsing
// Extracted from src/index.template.html <script> block.

import { ALIAS, FALLBACK } from '../constants.js';
import { norm } from './workbook.js';
import { ymd, monthKey } from '../utils/dates.js';
import { state } from '../state.js';
import { csvRows, legacyText, parseDate, parseDuration, safeMinutes, cleanRisk, chooseParsed } from './hist.js';

// ── Internal schema helpers (tri-specific) ───────────────────────────────────

function val(row, idx) { return idx == null ? '' : row[idx]; }

function inferColTypes(rows) {
  const sample = rows.slice(1, 41), ncols = (rows[0] || []).length, types = {};
  for (let c = 0; c < ncols; c++) {
    let dates = 0, durs = 0, risks = 0, names = 0, nums = 0, total = 0;
    sample.forEach(row => {
      const v = String(row[c] || '').trim(); if (!v) return; total++;
      if (parseDate(v)) dates++;
      else if (parseDuration(v) != null && /[:hm]/.test(v)) durs++;
      else if (/^(VERDE|AMARELO|LARANJA|VERMELHO|AZUL|BRANCO|SEM)/i.test(v)) risks++;
      else if (/^[A-ZÀ-Ú][a-zà-ú]/.test(v) && v.split(' ').length >= 2) names++;
      else if (Number.isFinite(Number(v.replace(',', '.')))) nums++;
    });
    if (!total) continue;
    const best = Math.max(dates, durs, risks, names, nums);
    if (best / total >= 0.6) {
      if (best === dates) types[c] = 'date';
      else if (best === durs) types[c] = 'duration';
      else if (best === risks) types[c] = 'risk';
      else if (best === names) types[c] = 'name';
      else if (best === nums) types[c] = 'number';
    }
  }
  return types;
}

function indexHeaders(header, type, rows) {
  const names = header.map(norm), out = {};
  Object.entries(ALIAS[type]).forEach(([field, list]) => {
    const wanted = list.map(norm);
    let idx = names.findIndex(h => wanted.includes(h));
    if (idx < 0) idx = names.findIndex(h => wanted.some(w => h.includes(w) || w.includes(h)));
    out[field] = idx >= 0 ? idx : null;
  });
  const missing = Object.entries(out).filter(([, v]) => v == null).map(([k]) => k);
  if (missing.length && rows && rows.length > 1) {
    const colTypes = inferColTypes(rows);
    const typeMap = {
      tri: { date: ['dh', 'dhTri'], duration: ['tEsp', 'tDur'], risk: ['cor'], name: ['triador'] },
    }[type] || {};
    const usedCols = new Set(Object.values(out).filter(v => v != null));
    missing.forEach(field => {
      const wantTypes = Object.entries(typeMap).filter(([, fields]) => fields.includes(field)).map(([t]) => t);
      if (!wantTypes.length) { out[field] = FALLBACK[type]?.[field] ?? null; return; }
      const candidate = Object.entries(colTypes)
        .filter(([c, t]) => wantTypes.includes(t) && !usedCols.has(+c))
        .map(([c]) => +c)[0];
      out[field] = candidate ?? FALLBACK[type]?.[field] ?? null;
      if (candidate != null) usedCols.add(candidate);
    });
  }
  Object.keys(out).forEach(f => { if (out[f] == null) out[f] = FALLBACK[type]?.[f] ?? null; });
  return out;
}

// ── Tri parsers ──────────────────────────────────────────────────────────────

/**
 * Parse triagem CSV using fixed positional columns (legacy format).
 * Returns {data, total, invalid, msg}.
 */
export function parseTriLegacy(csv) {
  const rows = [], lines = csvRows(csv); let invalid = 0;
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i]; if (p.length < 17) continue;
    const dh = parseDate(p[10]); if (!dh) { invalid++; continue; }
    const dhTri = parseDate(p[12]); let tEsp = null;
    if (dhTri && dhTri >= dh) tEsp = safeMinutes((dhTri - dh) / 60000, 360);
    const _tTurno = dh.getHours() >= 7 && dh.getHours() < 19 ? 'D' : 'N';
    const _tDhAdj = (_tTurno === 'N' && dh.getHours() < 7) ? new Date(dh.getTime() - 864e5) : dh;
    rows.push({
      sourceLine: i + 1, pront: String(p[5] || '').trim(), cor: cleanRisk(legacyText(p[3])),
      triador: legacyText(p[16]).trim(), dh, dhTri,
      dateKey: ymd(_tDhAdj), anoMes: monthKey(_tDhAdj),
      hora: dh.getHours(), diaSem: _tDhAdj.getDay(), turno: _tTurno,
      tEsp, tDur: safeMinutes(parseDuration(p[19]), 90),
    });
  }
  return { data: rows.sort((a, b) => a.dh - b.dh), total: Math.max(lines.length - 1, 0), invalid, msg: `Modo compatibilidade: ${invalid} linhas sem data válida foram ignoradas.` };
}

/**
 * Parse triagem using header-based column detection.
 * Returns array of row objects (sorted by dh).
 */
export function parseTri(rows, addQuality = true) {
  const header = rows[0] || [], idx = indexHeaders(header, 'tri', rows), data = [], issues = { invalidDate: 0 };
  rows.slice(1).forEach((row, line) => {
    if (!row.some(x => String(x).trim())) return;
    const dh = parseDate(val(row, idx.dh)); if (!dh) { issues.invalidDate++; return; }
    const dhTri = parseDate(val(row, idx.dhTri)); let tEsp = null;
    if (dhTri && dhTri >= dh) tEsp = safeMinutes((dhTri - dh) / 60000, 360);
    const _tTurnoM = dh.getHours() >= 7 && dh.getHours() < 19 ? 'D' : 'N';
    const _tDhAdjM = (_tTurnoM === 'N' && dh.getHours() < 7) ? new Date(dh.getTime() - 864e5) : dh;
    data.push({
      sourceLine: line + 2, pront: String(val(row, idx.pront) || '').trim(),
      cor: cleanRisk(val(row, idx.cor)), triador: String(val(row, idx.triador) || '').trim(),
      dh, dhTri, dateKey: ymd(_tDhAdjM), anoMes: monthKey(_tDhAdjM),
      hora: dh.getHours(), diaSem: _tDhAdjM.getDay(), turno: _tTurnoM,
      tEsp, tDur: safeMinutes(parseDuration(val(row, idx.tDur)), 90),
    });
  });
  if (addQuality) state.quality.push({ type: 'Triagem', total: rows.length - 1, valid: data.length, invalid: issues.invalidDate, msg: `${issues.invalidDate} linhas sem data válida foram ignoradas.` });
  return data.sort((a, b) => a.dh - b.dh);
}

/**
 * Auto-select the better of header-based and legacy parsers for a triagem file.
 * data = {rows, csv}. Returns array of row objects.
 */
export function parseBestTri(data) {
  const parsed = parseTri(data.rows, false), total = Math.max(data.rows.length - 1, 0);
  return chooseParsed('Triagem', { data: parsed, total, invalid: Math.max(total - parsed.length, 0), msg: 'Leitura por cabeçalho/planilha.' }, parseTriLegacy(data.csv));
}
