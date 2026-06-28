import { initGlobals } from './globals.js';
import { CONFIG, MES, DOW, DOWO, RISK_ORDER, RISK_COLOR, CAP, CAP_COLOR, EXEC_SCORE, ALIAS, FALLBACK } from './constants.js';
import { $, esc, norm, fmt, fmtN, pct, shortName, kpi } from './utils/dom.js';
import { ymd, monthKey, monthLabel } from './utils/dates.js';
import { avg, sum, percentile } from './utils/stats.js';
import { state, resetState, RECEP_KEY, RECEP_OVERRIDE_KEY, UC_KEY, TTL_KEY, LAYOUT_KEY, PREF_KEY, ANOT_KEY } from './state.js';

initGlobals();
console.log('[VIDA] build scaffold OK');
