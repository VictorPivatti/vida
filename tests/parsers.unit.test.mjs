import { parseHistLegacy, histDedupKey, cleanRisk, parseHist } from '../src/js/parsers/hist.js';
import { fixMojibake, fixMojibakeMac } from '../src/js/parsers/workbook.js';
import { parseTriLegacy } from '../src/js/parsers/tri.js';
import { parseCidLegacy } from '../src/js/parsers/cid.js';
import { parseProcedimentosText } from '../src/js/parsers/proc.js';
import { _parseExamesLines } from '../src/js/parsers/exames.js';
import { catOfEsp, procTipoKey, procTipoLabel } from '../src/js/parsers/proc.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HIST_CSV = fs.readFileSync(path.join(__dirname, '../fixtures/hist_min.csv'), 'utf-8');
const TRI_CSV  = fs.readFileSync(path.join(__dirname, '../fixtures/tri_min.csv'), 'utf-8');
const CID_CSV  = fs.readFileSync(path.join(__dirname, '../fixtures/cid_min.csv'), 'utf-8');
const PROC_TXT = fs.readFileSync(path.join(__dirname, '../fixtures/proc_min.csv'), 'utf-8');

let failed = 0;
function ok(name, cond) { if (!cond) { console.error('FAIL: ' + name); failed++; } else console.log('✓ ' + name); }

// hist
const h = parseHistLegacy(HIST_CSV);
ok('hist: 5 rows', h.data.length === 5);
ok('hist: cor', h.data[0].cor === 'AMARELO');

// tri
const t = parseTriLegacy(TRI_CSV);
ok('tri: 3 rows', t.data.length === 3);

// cid
const c = parseCidLegacy(CID_CSV);
ok('cid: medico≠paciente', c.data[0].medico !== c.data[0].paciente);

// proc
const p = parseProcedimentosText(PROC_TXT);
ok('proc: 3 rows', p.length === 3);

// catOfEsp / procTipoKey
ok('catOfEsp médico', catOfEsp('MÉDICO') === 'med');
ok('catOfEsp enfermeiro', catOfEsp('ENFERMEIRO') === 'enf');
ok('procTipoKey EV', procTipoKey('MEDICAMENTO VIA ENDOVENOSA') === 'ev');
ok('procTipoLabel EV', procTipoLabel('MEDICAMENTO VIA ENDOVENOSA') === 'EV');

// _parseExamesLines
const lines = [
  {text:'06-12345 1 15/01/2026 3 3 1.500,00 450,00', x0:10},
  {text:'HEMOGRAMA COMPLETO 15,00 15,00', x0:50},
  {text:'Solicitante Responsável: DR SILVA A', x0:10},
];
const recs = _parseExamesLines(lines);
ok('exames: 1 guia', recs.length === 1);
ok('exames: doctor', recs[0].doctor === 'DR SILVA A');

// hist dedup key — blank pront must not collapse large files to ~1 row/hour
function _genHistCsv(n, blankPront) {
  const header = Array.from({ length: 21 }, (_, i) => 'col' + i).join(';');
  const lines = [header];
  for (let i = 0; i < n; i++) {
    const c = Array(21).fill('');
    c[3] = 'VERDE';
    c[5] = blankPront ? '' : String(100000 + i);
    c[6] = 'PACIENTE';
    c[8] = 'NORMAL';
    c[9] = `${String((i % 28) + 1).padStart(2, '0')}/03/2026 ${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00`;
    c[15] = 'DR FULANO';
    lines.push(c.join(';'));
  }
  return lines.join('\n');
}
function _dedup(rows, keyFn) {
  const seen = new Set(), out = [];
  for (const r of rows) { const k = keyFn(r); if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}
const _legacyKey = r => r.pront + '|' + r.dateKey + '|' + r.hora;
const _big = parseHistLegacy(_genHistCsv(30000, true)).data;
const _oldDedup = _dedup(_big, _legacyKey);
const _newDedup = _dedup(_big, histDedupKey);
ok('dedup: legacy key collapses blank-pront file', _oldDedup.length < 500);
ok('dedup: histDedupKey keeps distinct rows', _newDedup.length > 500);
ok('dedup: histDedupKey removes re-upload duplicates', _dedup(_big.concat(_big), histDedupKey).length === _newDedup.length);

// cleanRisk — descrições textuais Vivver (formato com colunas extras)
ok('cleanRisk: VERDE por nome', cleanRisk('VERDE') === 'VERDE');
ok('cleanRisk: Emergência → VERMELHO', cleanRisk('Emergência') === 'VERMELHO');
ok('cleanRisk: Muito urgente → LARANJA', cleanRisk('Muito urgente') === 'LARANJA');
ok('cleanRisk: Urgência → AMARELO', cleanRisk('Urgência') === 'AMARELO');
ok('cleanRisk: Sem risco de morte imediato → VERDE', cleanRisk('Sem risco de morte imediato') === 'VERDE');
ok('cleanRisk: Quadro crônico → AZUL', cleanRisk('Quadro crônico sem sofrimento agudo ou caso social') === 'AZUL');
ok('cleanRisk: Sem classificação de risco → BRANCO', cleanRisk('Sem classificação de risco') === 'BRANCO');
ok('cleanRisk: Alerta Extremo → VERMELHO', cleanRisk('Alerta Extremo') === 'VERMELHO');

// parseHist (header-based) com formato Vivver de colunas extras
// Cabeçalho com 24 campos, dados com 29 — mesmo formato do TEMPO MEDIO ATM 2026.xlsx
function _vivverCsv(n) {
  const hdr = 'codunidade;nomunidade;numprontuario; nompaciente;tidade;ipo_entrada;id_recepcao;dh_recepcao;dh_acolhimento;dh_atendimento;codespecialidade;nomespecialidade;codprofissional;nomprofissional;recepcao_triagem;triagem_atendimento;recepcao_alta;dados;media_recepcao_triagem;media_duracao_triagem;media_triagem_atendimento;media_tempo_atendimento;media_recepcao_alta;total_pacientes';
  const rows = [hdr];
  for (let i = 0; i < n; i++) {
    const dt = `${String((i % 28) + 1).padStart(2,'0')}/01/2026 ${String(i % 24).padStart(2,'0')}:00:00`;
    rows.push([
      '19', 'Sem risco de morte imediato', '(0,128,0)', 'VERDE',
      'UPA 24H', String(70000 + i), 'Paciente Teste', '30',
      'NORMAL COM TRIAGEM', dt, dt, dt,
      '225125', 'Medico clinico', '302', 'DR TESTE',
      '00:06:00', '00:01:00', '00:40:00', '00:10:00', '00:57:00', '1',
      '00:06:00', '00:01:00', '00:40:00', '00:10:00', '00:57:00', '3768', '1',
    ].join(';'));
  }
  return rows.join('\n');
}
const _vivver = parseHist(_vivverCsv(5).split('\n').map(l => l.split(';')), false);
ok('parseHist: offset detectado — 5 linhas Vivver', _vivver.length === 5);
ok('parseHist: pront correto após offset', _vivver[0].pront === '70000');
ok('parseHist: cor correta após offset', _vivver[0].cor === 'VERDE');
ok('parseHist: dh válida após offset', _vivver[0].dh instanceof Date && !isNaN(_vivver[0].dh));
ok('parseHist: prof correto após offset', _vivver[0].prof === 'DR TESTE');

// fixMojibakeMac — Mac OS Roman mojibake (new)
ok('fixMojibakeMac: JO√£O → JOãO', fixMojibakeMac('JO√£O') === 'JOãO');
ok('fixMojibakeMac: B√°RBARA → BáRBARA', fixMojibakeMac('B√°RBARA') === 'BáRBARA');
ok('fixMojibakeMac: GUIMAR√ÉES → GUIMARÃES', fixMojibakeMac('GUIMAR√ÉES') === 'GUIMARÃES');
ok('fixMojibakeMac: PATR√≠CIA → PATRíCIA', fixMojibakeMac('PATR√≠CIA') === 'PATRíCIA');
ok('fixMojibakeMac: GON√ßALVES → GONçALVES', fixMojibakeMac('GON√ßALVES') === 'GONçALVES');
ok('fixMojibakeMac: no-op on plain string', fixMojibakeMac('JOAO DA SILVA') === 'JOAO DA SILVA');
ok('fixMojibakeMac: no-op on already-correct Ã', fixMojibakeMac('GUIMARÃES') === 'GUIMARÃES');

if (failed > 0) { console.error(failed + ' test(s) failed'); process.exit(1); }
console.log('parsers.unit.test.mjs: all OK');
