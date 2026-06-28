import { parseHistLegacy } from '../src/js/parsers/hist.js';
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

if (failed > 0) { console.error(failed + ' test(s) failed'); process.exit(1); }
console.log('parsers.unit.test.mjs: all OK');
