// parsers/hist.js — historical attendance (histórico) parsing
// Extracted from src/index.template.html <script> block.
// NOTE: chooseParsed writes to state.quality (imported from state.js).
// The original <script> block retains these functions; this module is
// the ESM-importable copy for tests and future app.js integration.

import { CONFIG, ALIAS, FALLBACK } from '../constants.js';
import { norm, fixMojibake } from './workbook.js';
import { ymd, monthKey } from '../utils/dates.js';
import { state } from '../state.js';

// ── Low-level CSV helpers ───────────────────────────────────────────────────

/** Split a semicolon-delimited CSV string into array of rows (arrays of strings). */
export function csvRows(csv) {
  return String(csv ?? '').split(/\r?\n/).filter(l => l.trim()).map(l => l.split(';'));
}

/** Dedup key for hist rows — full timestamp + prof avoids collapsing rows when pront is blank. */
export function histDedupKey(r) {
  return r.pront + '|' + (r.dh ? r.dh.getTime() : r.dateKey) + '|' + (r.prof || '');
}

/** Safe string coercion for legacy positional fields. */
export function legacyText(v) { return String(v ?? ''); }

// ── Date / duration parsers ─────────────────────────────────────────────────

/**
 * Parse a date value (string, Date, or Excel serial number) to a Date object.
 * Returns null if unparseable.
 * NOTE: Excel serial numbers require XLSX.SSF which is a browser CDN global.
 * In Node (tests), Excel serial numbers won't be encountered via fixtures.
 */
export function parseDate(v) {
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number' && Number.isFinite(v) && v > 1) {
    try {
      // XLSX is a CDN global — only available in browser
      // eslint-disable-next-line no-undef
      const d = XLSX.SSF.parse_date_code(v);
      return d ? new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0)) : null;
    } catch { return null; }
  }
  const s = String(v ?? '').trim();
  if (!s || s === '-' || s === '0' || s === '00:00:00') return null;
  // DD/MM/AAAA HH:MM or DD/MM/AA
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) { const y = +m[3] < 100 ? 2000 + (+m[3]) : +m[3]; return new Date(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)); }
  // AAAA-MM-DD HH:MM (ISO)
  m = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  if (/\d{4}/.test(s) && (/\//.test(s) || /-/.test(s))) { const d = new Date(s); return isNaN(d) ? null : d; }
  return null;
}

/**
 * Parse a duration value to minutes (number).
 * Handles HH:MM:SS, HH:MM, decimal day fractions, plain numbers, "90 min" etc.
 * Returns null if unparseable.
 */
export function parseDuration(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v < 1 ? Math.round(v * 24 * 60) : v;
  const s = String(v).trim();
  if (!s || s === '0' || s === '00:00' || s === '00:00:00') return 0;
  let m = s.match(/^(\d+):(\d{2}):(\d{2})(?:[.,]\d+)?$/);
  if (m) return +m[1] * 60 + (+m[2]) + (+m[3]) / 60;
  m = s.match(/^(\d+):(\d{2})$/);
  if (m) return +m[1] * 60 + (+m[2]);
  m = s.match(/^(\d+(?:[,.]\d+)?)\s*(min|m|h)$/i);
  if (m) { const n = Number(m[1].replace(',', '.')); return m[2].toLowerCase() === 'h' ? n * 60 : n; }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Clamp minutes to [0, max); return null if out of range. */
export function safeMinutes(v, max) {
  return Number.isFinite(v) && v >= 0 && v < max ? v : null;
}

/** Normalise a risk colour string to the canonical Manchester set. */
export function cleanRisk(v) {
  const s = norm(v).toUpperCase().replaceAll(' ', '_');
  if (!s) return 'SEM CLASSIFICACAO';
  if (s.includes('VERMELHO')) return 'VERMELHO';
  if (s.includes('LARANJA')) return 'LARANJA';
  if (s.includes('AMARELO')) return 'AMARELO';
  if (s.includes('VERDE')) return 'VERDE';
  if (s.includes('AZUL')) return 'AZUL';
  if (s.includes('BRANCO')) return 'BRANCO';
  // Descrições textuais exportadas pelo Vivver (formato com colunas extras)
  if (s.includes('EMERGENCIA') || s.includes('ALERTA_EXTREMO')) return 'VERMELHO';
  if (s.includes('MUITO_URGENTE')) return 'LARANJA';
  if (s.includes('URGENCIA') && !s.includes('NAO') && !s.includes('POUCO') && !s.includes('MUITO')) return 'AMARELO';
  if (s.includes('SEM_RISCO') || s.includes('POUCO_URGENTE')) return 'VERDE';
  if (s.includes('CRONICO') || s.includes('CASO_SOCIAL') || s.includes('NAO_URGENTE')) return 'AZUL';
  if (s.includes('SEM_CLASSIFICACAO') || s.includes('SEM_TRIAGEM')) return 'BRANCO';
  return String(v || 'SEM CLASSIFICACAO').trim().toUpperCase();
}

/** Detect evasion/no-show from tipo and prof fields. */
export function isEvasao(tipo, prof) {
  const t = norm(tipo);
  return t.includes('evasao') || t.includes('evad') || t.includes('saiu sem') ||
    t.includes('abandono') || t.includes('desistiu') || t.includes('alta a pedido') ||
    t.includes('sem atendimento') || t.includes('fuga') || t.includes('recusou') ||
    t.includes('nao aguardou') || t.includes('nao esperou');
}

// ── Schema detection helpers (used by parseHist / parseTri / parseCid) ───────

function val(row, idx) { return idx == null ? '' : row[idx]; }

function inferColTypes(rows) {
  const sample = rows.slice(1, 41);
  const ncols = Math.max((rows[0] || []).length, ...sample.map(r => r.length));
  const types = {};
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
  // Quando o cabeçalho tem menos colunas que os dados (Vivver exporta header desatualizado),
  // verificar se o arquivo é o formato posicional conhecido (cor[3], data[9]).
  // Se for, usar FALLBACK diretamente em vez de confiar nos índices do cabeçalho errado.
  if (rows && rows.length > 1 && type === 'hist' && FALLBACK.hist) {
    const _row1 = rows[1] || [];
    if (_row1.length > header.length) {
      const _looksLegacy =
        /^(VERDE|AMARELO|LARANJA|VERMELHO|AZUL|BRANCO)$/i.test(String(_row1[3]).trim()) &&
        !!parseDate(_row1[9]);
      if (_looksLegacy) return { ...FALLBACK.hist };
    }
  }
  const missing = Object.entries(out).filter(([, v]) => v == null).map(([k]) => k);
  if (missing.length && rows && rows.length > 1) {
    const colTypes = inferColTypes(rows);
    const typeMap = {
      hist: { date: ['dh', 'dhAcol', 'dhAtend'], duration: ['tEspTri', 'tDurTri', 'tTotal', 'tConsulta'], risk: ['cor'], name: ['prof'], number: ['pront', 'idade'] },
      tri: { date: ['dh', 'dhTri'], duration: ['tEsp', 'tDur'], risk: ['cor'], name: ['triador'] },
      cid: { date: ['data'], name: ['desc', 'medico'], number: ['idAtend', 'cid'] },
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

// ── Hist parsers ─────────────────────────────────────────────────────────────

/**
 * Parse historical attendance CSV using fixed positional columns (legacy format).
 * Format: 29 semicolon-separated fields per line.
 * Returns {data, total, invalid, msg}.
 */
export function parseHistLegacy(csv) {
  const rows = [], lines = csvRows(csv); let invalid = 0;
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i]; if (p.length < 20) continue;
    const dh = parseDate(p[9]); if (!dh) { invalid++; continue; }
    const dhAcol = parseDate(p[10]), dhAtend = parseDate(p[11]);
    const _tDurTri = safeMinutes(parseDuration(p[17]), 90);
    const _p18 = parseDuration(p[18]);
    let tEspMed = null;
    if (_p18 != null) { tEspMed = safeMinutes(_p18, CONFIG.MAX_MINUTES); }
    else if (dhAcol && dhAtend) { tEspMed = safeMinutes((dhAtend - dhAcol) / 60000 - (_tDurTri ?? 0), CONFIG.MAX_MINUTES); }
    const _turnoL = dh.getHours() >= 7 && dh.getHours() < 19 ? 'D' : 'N';
    const _dhAjL = (_turnoL === 'N' && dh.getHours() < 7) ? new Date(dh.getTime() - 864e5) : dh;
    rows.push({
      sourceLine: i + 1, pront: String(p[5] || '').trim(), cor: cleanRisk(legacyText(p[3])),
      _nomeRaw: fixMojibake(legacyText(p[6]).trim()).normalize('NFC'),
      prof: fixMojibake(legacyText(p[15]).trim()).normalize('NFC'), tipo: legacyText(p[8]).trim(),
      evadido: isEvasao(legacyText(p[8]).trim(), legacyText(p[15]).trim()),
      idade: Number.parseFloat(String(p[7]).replace(',', '.')) || null,
      dh, dhAcol, dhAtend, dateKey: ymd(_dhAjL), ano: _dhAjL.getFullYear(), mes: _dhAjL.getMonth() + 1,
      anoMes: monthKey(_dhAjL), hora: dh.getHours(), diaSem: _dhAjL.getDay(), turno: _turnoL,
      tEspTri: safeMinutes(parseDuration(p[16]), 300),
      tDurTri: _tDurTri,
      tTotal: safeMinutes(parseDuration(p[20]), CONFIG.MAX_MINUTES),
      tConsulta: safeMinutes(parseDuration(p[19]), 300),
      tEspMed,
    });
  }
  return { data: rows.sort((a, b) => a.dh - b.dh), total: Math.max(lines.length - 1, 0), invalid, msg: `Modo compatibilidade: ${invalid} linhas sem data válida foram ignoradas.` };
}

/**
 * Parse historical attendance using header-based column detection.
 * Returns array of row objects (sorted by dh).
 */
export function parseHist(rows, addQuality = true) {
  const header = rows[0] || [], idx = indexHeaders(header, 'hist', rows), data = [], issues = { invalidDate: 0, short: 0 };
  rows.slice(1).forEach((row, line) => {
    if (!row.some(x => String(x).trim())) return;
    const dh = parseDate(val(row, idx.dh));
    if (!dh) { issues.invalidDate++; return; }
    const dhAcol = parseDate(val(row, idx.dhAcol)), dhAtend = parseDate(val(row, idx.dhAtend));
    const _tDurTriH = safeMinutes(parseDuration(val(row, idx.tDurTri)), 90);
    const _rawTEspMed = parseDuration(val(row, idx.tEspMed));
    let tEspMed = null;
    if (_rawTEspMed != null) { tEspMed = safeMinutes(_rawTEspMed, CONFIG.MAX_MINUTES); }
    else if (dhAcol && dhAtend) { tEspMed = safeMinutes((dhAtend - dhAcol) / 60000 - (_tDurTriH ?? 0), CONFIG.MAX_MINUTES); }
    const tEspTri = safeMinutes(parseDuration(val(row, idx.tEspTri)), 300);
    const tipoRaw = String(val(row, idx.tipo) || '').trim();
    const evadido = isEvasao(tipoRaw, val(row, idx.prof));
    const _t = dh.getHours() >= 7 && dh.getHours() < 19 ? 'D' : 'N';
    const _da = (_t === 'N' && dh.getHours() < 7) ? new Date(dh.getTime() - 864e5) : dh;
    data.push({
      sourceLine: line + 2, pront: String(val(row, idx.pront) || '').trim(), cor: cleanRisk(val(row, idx.cor)),
      _nomeRaw: String(val(row, idx.paciente) || '').trim(),
      prof: String(val(row, idx.prof) || '').trim(), tipo: tipoRaw, evadido,
      idade: Number.parseFloat(String(val(row, idx.idade)).replace(',', '.')) || null,
      dh, dhAcol, dhAtend, dateKey: ymd(_da), ano: _da.getFullYear(), mes: _da.getMonth() + 1,
      anoMes: monthKey(_da), hora: dh.getHours(), diaSem: _da.getDay(), turno: _t,
      tEspTri, tDurTri: _tDurTriH,
      tTotal: safeMinutes(parseDuration(val(row, idx.tTotal)), CONFIG.MAX_MINUTES),
      tConsulta: safeMinutes(parseDuration(val(row, idx.tConsulta)), 300),
      tEspMed,
    });
  });
  if (addQuality) state.quality.push({ type: 'Histórico', total: rows.length - 1, valid: data.length, invalid: issues.invalidDate, msg: `${issues.invalidDate} linhas sem data válida foram ignoradas.` });
  return data.sort((a, b) => a.dh - b.dh);
}

/**
 * Choose the better of modern (header-based) and legacy (positional) parsed results.
 * Scores by field completeness. Writes to state.quality.
 * Returns the chosen data array.
 */
export function chooseParsed(type, modern, legacy) {
  function completeness(rows) {
    if (!rows.length) return 0;
    const sample = rows.slice(0, 200);
    const criticals = { 'Histórico': ['dh', 'prof', 'cor'], 'Triagem': ['dh', 'cor'], 'CID': ['dh', 'cid'] }[type] || ['dh'];
    const filled = sample.reduce((s, r) => s + criticals.filter(f => r[f] != null && String(r[f]).trim()).length, 0);
    return (filled / (sample.length * criticals.length)) * 0.7 + (rows.length / Math.max(modern.total, legacy.total, 1)) * 0.3;
  }
  const mScore = completeness(modern.data), lScore = completeness(legacy.data);
  const chosen = mScore >= lScore ? modern : legacy;
  const src = chosen === legacy ? ' Leitura por posição usada.' : ' Leitura por cabeçalho usada.';
  state.quality.push({
    type, total: chosen.total, valid: chosen.data.length, invalid: chosen.invalid,
    msg: chosen.msg + src, score: { modern: mScore.toFixed(2), legacy: lScore.toFixed(2) },
  });
  return chosen.data;
}
