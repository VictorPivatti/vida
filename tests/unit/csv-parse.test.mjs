import { splitCsvLine, csvRowsFromText } from '../../src/js/utils/csv-parse.js';
import { rowToCsv } from '../../src/js/utils/csv-escape.js';
import { csvRows, parseHistLegacy } from '../../src/js/parsers/hist.js';

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

if (failed > 0) { console.error(failed + ' test(s) failed'); process.exit(1); }
console.log('csv-parse.test.mjs: all OK');
