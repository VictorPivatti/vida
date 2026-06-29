// Worker: lê File → CSV (XLSX.js via importScripts) → parseHistLegacy
// Injetado em __HIST_WORKER_CODE__ por scripts/build.cjs (prefixo importScripts XLSX).
import { parseHistLegacy, histDedupKey } from '../parsers/hist.js';

function bufToCsv(ab) {
  const hdr = new Uint8Array(ab, 0, 4);
  const isBin = (hdr[0] === 0xD0 && hdr[1] === 0xCF) || (hdr[0] === 0x50 && hdr[1] === 0x4B);
  if (isBin && typeof XLSX !== 'undefined') {
    // XLSX global via importScripts (build.cjs)
    // eslint-disable-next-line no-undef
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array', raw: false });
    const sh = wb.Sheets[wb.SheetNames[0]];
    // eslint-disable-next-line no-undef
    const arr = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false });
    return arr.map(r => r.join(';')).join('\n');
  }
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(ab);
  if (!(utf8.match(/\uFFFD/g) || []).length || utf8.length < 100) return utf8;
  return new TextDecoder('windows-1252').decode(ab);
}

function parseCsvs(csvs, names) {
  const all = [], seen = new Set();
  let total = 0, invalid = 0;
  for (let i = 0; i < csvs.length; i++) {
    const { data: rows, total: t, invalid: inv } = parseHistLegacy(csvs[i]);
    total += t; invalid += inv;
    for (const r of rows) {
      const k = histDedupKey(r);
      if (!seen.has(k)) { seen.add(k); all.push(r); }
    }
    self.postMessage({ type: 'progress', i: i + 1, n: csvs.length, name: names[i], count: rows.length });
  }
  all.sort((a, b) => a.dh - b.dh);
  return { rows: all, total, invalid };
}

async function readFileAb(file) {
  return Promise.race([
    file.arrayBuffer(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Leitura excedeu 2 min no worker')), 120000)),
  ]);
}

self.onmessage = async function(e) {
  try {
    const { files, csvs, names } = e.data;

    // Pipeline completo: File → buffer → CSV → parse (main thread não lê o arquivo)
    if (files && files.length) {
      const csvList = [], nameList = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        self.postMessage({ type: 'read', i: i + 1, n: files.length, name: file.name, phase: 'lendo' });
        const ab = await readFileAb(file);
        self.postMessage({ type: 'read', i: i + 1, n: files.length, name: file.name, phase: 'convertendo', bytes: ab.byteLength });
        const csv = bufToCsv(ab);
        const headerLine = (csv || '').split(/\r?\n/)[0] || '';
        self.postMessage({ type: 'fingerprint', name: file.name, headerLine });
        csvList.push(csv);
        nameList.push(file.name);
      }
      const result = parseCsvs(csvList, nameList);
      self.postMessage({ type: 'done', ...result });
      return;
    }

    // Legado: CSVs já convertidos na main thread
    if (csvs && names) {
      const result = parseCsvs(csvs, names);
      self.postMessage({ type: 'done', ...result });
      return;
    }

    throw new Error('Worker: payload inválido (esperado files ou csvs)');
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
