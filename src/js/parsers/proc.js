// parsers/proc.js — procedimentos (Vivver procedures) parsing
// Extracted from src/index.template.html <script> block.

import { norm, fixMojibake } from './workbook.js';

// ── CSV line split (handles quoted fields) ───────────────────────────────────

function splitDelimitedLine(line, sep = ';') {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === sep && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// ── Category / type helpers ───────────────────────────────────────────────────

/**
 * Classify a professional by specialty string.
 * Returns 'med' | 'enf' | 'tec' | 'out'.
 */
export function catOfEsp(esp) {
  const e = (esp || '').toLowerCase();
  if (e.includes('médico') || e.includes('medico')) return 'med';
  if (e.includes('enfermeiro')) return 'enf';
  if (e.includes('técnico') || e.includes('tecnico')) return 'tec';
  return 'out';
}

/**
 * Map a procedure name to a canonical key.
 */
export function procTipoKey(proc, codProc) {
  const n = (proc || '').toUpperCase();
  if (n.includes('ACOLHIMENTO') && n.includes('RISCO')) return 'triagem';
  if (n.includes('ATENDIMENTO MEDICO') || n.includes('ATENDIMENTO DE URGENCIA') || n.includes('URGENCIA COM OBSERVACAO')) return 'consulta';
  if (n.includes('ELETROCARDIOGRAMA')) return 'ecg';
  if (n.includes('RADIOLOGIA') || n.includes('RAIO') || n.includes('RADIOGR')) return 'radio';
  if (n.includes('ENDOVENOSA') || n.includes('INTRAVENOSA')) return 'ev';
  if (n.includes('INTRAMUSCULAR')) return 'im';
  if (n.includes('VIA ORAL') && n.includes('MEDICAMENTO')) return 'vo';
  if (n.includes('SUBCUTAN')) return 'sc';
  if (n.includes('NEBULIZ') || n.includes('INALAC')) return 'neb';
  if (n.includes('GLICEMIA')) return 'glicemia';
  if (n.includes('CURATIVO')) return 'curativo';
  if (n.includes('SONDAGEM')) return 'sondagem';
  if (n.includes('SUTURA')) return 'sutura';
  return 'outro';
}

/**
 * Map a procedure name to a human-readable label.
 */
export function procTipoLabel(proc) {
  return {
    triagem: 'Triagem', ev: 'EV', im: 'IM', vo: 'VO', sc: 'SC', neb: 'Neb',
    curativo: 'Curativo', sondagem: 'Sondagem', sutura: 'Sutura',
    consulta: 'Consulta', ecg: 'ECG', radio: 'Radio', glicemia: 'Glicemia',
  }[procTipoKey(proc)] || 'Outros';
}

// ── Procedimentos parser ─────────────────────────────────────────────────────

/**
 * Parse a Vivver procedures export (CSV text) into an array of row objects.
 * The Vivver system exports one extra unnamed column at the start of each data line
 * (a sequential number not present in the header). The offset is auto-detected.
 *
 * Throws if required columns are missing.
 */
export function parseProcedimentosText(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const header = splitDelimitedLine(lines[0]).map(h => norm(fixMojibake(h)));
  const idx = name => header.findIndex(h => h === norm(name));
  const col = {
    codProf: idx('codprofissional'), prof: idx('NomProfissional'), codEsp: idx('codespecialidade'),
    esp: idx('nomespecialidade'), codProc: idx('CodProcedimento'), proc: idx('NomProcedimento'),
    fat: idx('Faturavel'), qde: idx('qdeprocedimento'), tip: idx('TipLancamento'), inst: idx('CodInstrumento'),
  };
  if (col.prof < 0 || col.proc < 0 || col.qde < 0)
    throw new Error('Arquivo de procedimentos sem colunas esperadas do Vivver.');
  const firstData = lines.length > 1 ? splitDelimitedLine(lines[1]) : [];
  const offset = Math.max(0, firstData.length - header.length);
  const g = (p, c) => c >= 0 ? String(p[c + offset] || '').trim() : '';
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const p = splitDelimitedLine(lines[i]);
    const qde = Number(g(p, col.qde).replace(',', '.'));
    if (!Number.isFinite(qde) || qde <= 0) continue;
    const prof = fixMojibake(g(p, col.prof));
    const proc = fixMojibake(g(p, col.proc));
    if (!prof || !proc || /^\d+$/.test(prof)) continue;
    const faturavel = g(p, col.fat).toUpperCase();
    rows.push({
      sourceLine: i + 1,
      codProf: g(p, col.codProf),
      prof, profKey: norm(prof),
      codEsp: g(p, col.codEsp),
      esp: fixMojibake(g(p, col.esp)) || 'Sem especialidade',
      codProc: g(p, col.codProc),
      proc, procKey: norm(proc),
      faturavel,
      faturavelFlag: faturavel.startsWith('S') ? 'S' : 'N',
      qde,
      tip: g(p, col.tip),
      instrumento: g(p, col.inst),
    });
  }
  return rows;
}
