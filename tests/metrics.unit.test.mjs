import { returnsFor, monthReturnRate } from '../src/js/metrics/returns.js';
import { metaManchester } from '../src/js/metrics/manchester.js';

let failed = 0;
function ok(name, cond) { if (!cond) { console.error('FAIL: ' + name); failed++; } else console.log('✓ ' + name); }

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
ok('meta VERDE', metaManchester('VERDE') === 240);
ok('meta unknown', metaManchester('UNKNOWN') > 0);

if (failed > 0) { console.error(failed + ' failed'); process.exit(1); }
console.log('metrics.unit.test.mjs: all OK');
