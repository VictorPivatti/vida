import { splitCsvLine, csvRowsFromText } from '../../src/js/utils/csv-parse.js';
import { rowToCsv } from '../../src/js/utils/csv-escape.js';
import { csvRows, parseHistLegacy, histInputToLines, histParseInput, isSheetRowMatrix, pickHistParse } from '../../src/js/parsers/hist.js';
import { fpHeaderNorm } from '../../src/js/parsers/workbook.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HIST_MIN = fs.readFileSync(path.join(__dirname, '../../fixtures/hist_min.csv'), 'utf-8');

let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL: ' + name); failed++; }
  else console.log('✓ ' + name);
}

ok('splitCsvLine: campo com ; entre aspas', splitCsvLine('a;"b;c";d')[1] === 'b;c');
ok('splitCsvLine: aspas duplas escapadas', splitCsvLine('"a""b";c')[0] === 'a"b');
ok('splitCsvLine: quebra dentro de aspas', splitCsvLine('"linha\n2";x')[0] === 'linha\n2');

const round = rowToCsv(['VERDE', 'PACIENTE', 'AVC; sequela', 'DR SILVA']);
const parsed = csvRowsFromText(round)[0];
ok('roundtrip rowToCsv → csvRowsFromText', parsed[2] === 'AVC; sequela');

const hdr = Array.from({ length: 21 }, (_, i) => 'col' + i).join(';');
const c = Array(21).fill('');
c[3] = 'VERDE';
c[5] = '1001';
c[6] = 'João; Maria';
c[8] = 'NORMAL';
c[9] = '01/01/2026 10:00:00';
c[15] = 'DR SILVA';
const csv = hdr + '\n' + rowToCsv(c);
const legacy = parseHistLegacy(csv);
ok('parseHistLegacy: nome com ; preservado', legacy.data.length === 1 && legacy.data[0]._nomeRaw.includes(';'));

const viaCsvRows = csvRows(csv);
ok('csvRows: colunas na linha de dados', viaCsvRows[1].length >= 20);
ok('csvRows: nome com ; intacto', viaCsvRows[1][6] === 'João; Maria');

const legacyRows = [viaCsvRows[0], viaCsvRows[1]];
const fromRows = parseHistLegacy(legacyRows);
ok('parseHistLegacy: aceita string[][]', fromRows.data.length === 1 && fromRows.data[0]._nomeRaw.includes(';'));

// Regressão Phase 1: array de strings (linhas CSV) não pode zerar parse
const rawLines = HIST_MIN.split(/\r?\n/).filter(l => l.trim());
const mistaken = parseHistLegacy(rawLines);
ok('parseHistLegacy: array de linhas CSV → 5 rows', mistaken.data.length === 5);

// XLSX Vivver: linha inteira em uma célula
const singleCell = rawLines.map(l => [l]);
ok('histInputToLines: expande célula única', histInputToLines(singleCell)[1].length >= 20);
ok('parseHistLegacy: célula única com ; → 5 rows', parseHistLegacy(singleCell).data.length === 5);

// Preferir matriz multi-coluna (sheet_to_json) sobre CSV serializado — preserva Date/serial Excel
const properRows = csvRows(HIST_MIN);
const quotedCsv = properRows.map(rowToCsv).join('\n');
ok('isSheetRowMatrix: multi-col', isSheetRowMatrix(properRows));
ok('histParseInput: prefere matriz multi-col', Array.isArray(histParseInput(properRows, quotedCsv)));
ok('histParseInput matrix: 5 rows', parseHistLegacy(histParseInput(properRows, quotedCsv)).data.length === 5);

const dateMatrix = [properRows[0], properRows[1].slice()];
dateMatrix[1][9] = new Date(2026, 0, 15, 10, 0, 0);
ok('parseHistLegacy: Date object col 9', parseHistLegacy(dateMatrix).data.length === 1);

// CSV string path (xlsxExtract / arquivo .csv)
ok('histParseInput: csv quando sem matriz', typeof histParseInput(null, HIST_MIN) === 'string');
ok('histParseInput csv: 5 rows', parseHistLegacy(histParseInput(null, HIST_MIN)).data.length === 5);

// Regressão: cabeçalho Vivver alternativo (dh_recepcao col 7, sem cor Manchester)
const atmHeader = 'codunidade;nomunidade;numprontuario;nompaciente;idade;tipo_entrada;id_recepcao;dh_recepcao;dh_acolhimento;dh_atendimento;codespecialidade;nomespecialidade;codprofissional;nomprofissional;recepcao_triagem;triagem_atendimento;recepcao_alta';
const atmRow = Array(17).fill('');
atmRow[2] = '1001';
atmRow[3] = 'PACIENTE TESTE';
atmRow[5] = 'NORMAL';
atmRow[7] = '15/01/2026 10:00:00';
atmRow[9] = '15/01/2026 11:00:00';
atmRow[13] = 'DR SILVA';
const atmCsv = atmHeader + '\n' + atmRow.join(';');
const atmPick = pickHistParse(atmCsv);
ok('pickHistParse: layout ATM dh col 7', atmPick.data.length === 1 && atmPick.data[0].prof === 'DR SILVA');

ok('fpHeaderNorm: ignora BOM e espaços em ;', fpHeaderNorm('\uFEFFa; b;c') === 'a;b;c');

if (failed > 0) { console.error(failed + ' test(s) failed'); process.exit(1); }
console.log('csv-parse.test.mjs: all OK');
