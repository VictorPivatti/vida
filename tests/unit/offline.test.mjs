import { buildOfflineMessages } from '../../src/js/ui/offline.js';

let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL: ' + name); failed++; }
  else console.log('✓ ' + name);
}

const xlsxOnly = buildOfflineMessages({ xlsx: true, chart: false, pdf: false });
ok('xlsx message', xlsxOnly.length === 1 && xlsxOnly[0].includes('.csv'));
ok('xlsx mentions xlsx', xlsxOnly[0].includes('.xlsx'));

const chartOnly = buildOfflineMessages({ xlsx: false, chart: true, pdf: false });
ok('chart message', chartOnly.length === 1 && chartOnly[0].includes('Gráficos'));

const all = buildOfflineMessages({ xlsx: true, chart: true, pdf: true });
ok('all three', all.length === 3);

const none = buildOfflineMessages({ xlsx: false, chart: false, pdf: false });
ok('none empty', none.length === 0);

if (failed > 0) { console.error(failed + ' failed'); process.exit(1); }
console.log('offline.test.mjs: all OK');
