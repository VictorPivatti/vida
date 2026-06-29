import { returnsFor, monthReturnRate } from '../src/js/metrics/returns.js';
import { metaManchester } from '../src/js/metrics/manchester.js';
import { previousRows, prevVal, periodDelta } from '../src/js/metrics/previous-period.js';

let failed = 0;
function ok(name, cond) { if (!cond) { console.error('FAIL: ' + name); failed++; } else console.log('✓ ' + name); }

// previousRows — mock DOM dates via global stub
const mockRows = [];
for (let d = 1; d <= 20; d++) {
  mockRows.push({ dateKey: `2026-01-${String(d).padStart(2, '0')}`, anoMes: 202601, turno: 'D', tEspTri: 10, tTotal: 100 });
}
for (let d = 1; d <= 15; d++) {
  mockRows.push({ dateKey: `2025-12-${String(d).padStart(2, '0')}`, anoMes: 202512, turno: 'D', tEspTri: 12, tTotal: 110 });
}

global.document = {
  getElementById: (id) => {
    if (id === 'dateStart') return { value: '2026-01-01' };
    if (id === 'dateEnd') return { value: '2026-01-20' };
    if (id === 'turno') return { value: 'all' };
    return null;
  },
};

// stub state.raw via dynamic import hack — previousRows uses state.raw
import { state } from '../src/js/state.js';
state.raw = mockRows;

const prev = previousRows();
ok('previousRows count', prev.length === 4);
ok('previousRows december', prev.every(r => r.dateKey.startsWith('2025-12')));

ok('prevVal coverage', prevVal(100, Array.from({ length: 12 }, () => prev[0]), 1, 1) === 100);
ok('prevVal rejects short', prevVal(100, prev.slice(0, 2), 2, 2) === null);

const d = periodDelta(120, 100);
ok('periodDelta up', d.dir === 'up' && d.good === true);
const d2 = periodDelta(90, 100, { inverse: true });
ok('periodDelta inverse good', d2.good === true);

// returnsFor
const t0 = new Date(2026, 0, 10, 9, 0), t1 = new Date(2026, 0, 12, 9, 0);
const rows = [
  { pront: 'A', dh: t0, dateKey: '2026-01-10', anoMes: 202601 },
  { pront: 'A', dh: t1, dateKey: '2026-01-12', anoMes: 202601 },
  { pront: 'B', dh: t0, dateKey: '2026-01-10', anoMes: 202601 },
];
const r = returnsFor(rows);
ok('returnsFor: A returns', r.ret.some(x => x.pront === 'A'));
ok('returnsFor: B no return', !r.ret.some(x => x.pront === 'B'));

// metaManchester
ok('meta VERMELHO', metaManchester('VERMELHO') === 0);
ok('meta LARANJA', metaManchester('LARANJA') === 15);
ok('meta AMARELO', metaManchester('AMARELO') === 60);
ok('meta VERDE', metaManchester('VERDE') === 120);
ok('meta unknown', metaManchester('UNKNOWN') > 0);

if (failed > 0) { console.error(failed + ' failed'); process.exit(1); }
console.log('metrics.unit.test.mjs: all OK');
