// Worker entry point for parseHistLegacy — compiled separately by scripts/build.cjs
// and injected into the main bundle as __HIST_WORKER_CODE__.
// Must NOT reference any DOM or window APIs.
import { parseHistLegacy } from '../parsers/hist.js';

self.onmessage = function(e) {
  const { csvs, names } = e.data, all = [], seen = new Set();
  let total = 0, invalid = 0;
  for (let i = 0; i < csvs.length; i++) {
    const { data: rows, total: t, invalid: inv } = parseHistLegacy(csvs[i]);
    total += t; invalid += inv;
    for (const r of rows) {
      const k = r.pront + '|' + r.dateKey + '|' + r.hora;
      if (!seen.has(k)) { seen.add(k); all.push(r); }
    }
    self.postMessage({ type: 'progress', i: i + 1, n: csvs.length, name: names[i], count: rows.length });
  }
  all.sort((a, b) => a.dh - b.dh);
  self.postMessage({ type: 'done', rows: all, total, invalid });
};
