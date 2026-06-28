import { fmt, norm } from '../../src/js/utils/dom.js';
import { ymd, monthKey } from '../../src/js/utils/dates.js';
import { avg, sum } from '../../src/js/utils/stats.js';
import { CONFIG } from '../../src/js/constants.js';

let failed = 0;
function ok(name, got, expected) {
  if (got !== expected) { console.error(`FAIL ${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`); failed++; }
  else console.log(`✓ ${name}`);
}

ok('fmt 1234', fmt(1234), '1.234');
ok('fmt 0', fmt(0), '0');
ok('norm', norm('  DR. SILVA  '), 'dr silva');
ok('ymd', ymd(new Date(2026, 0, 15)), '2026-01-15');
ok('monthKey', monthKey(new Date(2026, 0, 15)), 202601);
ok('avg empty', avg([], r => r), null);
ok('sum', sum([{n:3},{n:5}], r => r.n), 8);
ok('CONFIG.MAX_MINUTES', typeof CONFIG.MAX_MINUTES, 'number');

if (failed > 0) { console.error(`${failed} test(s) failed`); process.exit(1); }
console.log('utils.test.mjs: all OK');
