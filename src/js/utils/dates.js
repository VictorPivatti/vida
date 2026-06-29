// utils/dates.js — date helper functions extracted from the original script block
// NOTE: These are duplicated here intentionally (also exist in the original <script>)
// The original script block will be removed in Tasks 7–9.

import { MES } from '../constants.js';

/** Date → 'YYYY-MM-DD' string */
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Date → YYYYMM number (e.g. 202601 for January 2026) */
export const monthKey = d => d.getFullYear() * 100 + d.getMonth() + 1;

/** YYYYMM → display string (e.g. 'Jan/26') */
export const monthLabel = k => `${MES[k % 100 - 1]}/${String(Math.floor(k / 100)).slice(2)}`;
