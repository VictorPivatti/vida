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

function _progress(file, loaded, total) {
  self.postMessage({ type: 'read-progress', name: file.name, loaded, total });
}

async function readViaFetch(file) {
  const url = URL.createObjectURL(file);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch status ' + res.status);
    return await res.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readViaSlices(file) {
  const CHUNK = 256 * 1024;
  const out = new Uint8Array(file.size);
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK, file.size);
    const buf = await file.slice(offset, end).arrayBuffer();
    out.set(new Uint8Array(buf), offset);
    offset = end;
    _progress(file, offset, file.size);
  }
  return out.buffer;
}

async function readViaStream(file) {
  if (typeof file.stream !== 'function') throw new Error('stream indisponível');
  const reader = file.stream().getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    _progress(file, received, file.size);
  }
  const out = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.byteLength; }
  return out.buffer;
}

async function readFileAb(file) {
  const strategies = [
    ['slices',      () => readViaSlices(file),    120000],
    ['stream',      () => readViaStream(file),    120000],
    ['fetch',       () => readViaFetch(file),       8000],
    ['arrayBuffer', () => file.arrayBuffer(),      8000],
  ];
  let lastErr;
  for (const [name, fn, timeout] of strategies) {
    try {
      self.postMessage({ type: 'read', phase: 'lendo-' + name, name: file.name });
      const ab = await Promise.race([
        fn(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + timeout / 1000 + 's (' + name + ')')), timeout)),
      ]);
      if (!ab || !ab.byteLength) throw new Error('buffer vazio');
      self.postMessage({ type: 'read', phase: 'ok-' + name, name: file.name, bytes: ab.byteLength });
      return ab;
    } catch (e) {
      lastErr = e;
      self.postMessage({ type: 'read', phase: 'falhou-' + name, name: file.name, error: e.message });
    }
  }
  throw lastErr || new Error(
    'Não foi possível ler o arquivo. Se estiver no iCloud, baixe uma cópia local ou exporte CSV no Vivver.'
  );
}

self.onmessage = async function(e) {
  try {
    const { files, csvs, names } = e.data;

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
