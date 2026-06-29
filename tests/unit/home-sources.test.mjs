import {
  getSourceStatus,
  formatSessionHealth,
} from '../../src/js/ui/home-sources.js';

let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL: ' + name); failed++; }
  else console.log('✓ ' + name);
}

const emptyState = { raw: [], triRaw: [], triSource: 'none', cidRaw: [], procRaw: [], examesRaw: [] };

ok('hist pending', getSourceStatus('hist', null, emptyState) === 'pending');
ok('hist done from stats', getSourceStatus('hist', { atendimentos: 100 }, emptyState) === 'done');
ok('tri derived', getSourceStatus('tri', { atendimentos: 50, triagem: 0 }, emptyState) === 'derived');
ok('tri done', getSourceStatus('tri', { atendimentos: 50, triagem: 40 }, emptyState) === 'done');
ok('cid pending', getSourceStatus('cid', { atendimentos: 10, cid: 0 }, emptyState) === 'pending');
ok('cid done', getSourceStatus('cid', { atendimentos: 10, cid: 500 }, emptyState) === 'done');

const health = formatSessionHealth(
  { atendimentos: 21253, cid: 107365, triagem: 0 },
  emptyState,
  { min: new Date(2026, 0, 1), max: new Date(2026, 5, 29) }
);
ok('health line1', health.line1.includes('21.253') && health.line1.includes('Triagem derivada') && health.line1.includes('107.365'));
ok('health line2', health.line2.includes('01/01/2026') && health.line2.includes('29/06/2026'));

if (failed > 0) { console.error(failed + ' test(s) failed'); process.exit(1); }
console.log('home-sources.test.mjs: all OK');
