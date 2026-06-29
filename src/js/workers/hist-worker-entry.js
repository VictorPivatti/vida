// Worker: lê File → CSV (XLSX.js via importScripts) → parse hist ou CID
// Injetado em __HIST_WORKER_CODE__ por scripts/build.cjs (prefixo importScripts XLSX).
import { parseHistLegacy, histDedupKey } from '../parsers/hist.js';
import { parseCidFromText } from '../parsers/cid.js';

function bufToCsv(ab) {
  const hdr = new Uint8Array(ab, 0, 4);
  const isBin = (hdr[0] === 0xD0 && hdr[1] === 0xCF) || (hdr[0] === 0x50 && hdr[1] === 0x4B);
  if (isBin) {
    if (typeof XLSX === 'undefined') throw new Error('XLSX nao disponivel para arquivo binario'); // eslint-disable-line no-undef
    // eslint-disable-next-line no-undef
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array', raw: false });
    const sh = wb.Sheets[wb.SheetNames[0]];
    // eslint-disable-next-line no-undef
    const arr = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false });
    return arr.map(r => r.join(';')).join('\n');
  }
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(ab);
  if (!(utf8.match(/�/g) || []).length || utf8.length < 100) return utf8;
  return new TextDecoder('windows-1252').decode(ab);
}

function parseHistCsvs(csvs, names) {
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

function parseCidCsvs(csvs, names) {
  let all = [], total = 0, invalid = 0;
  for (let i = 0; i < csvs.length; i++) {
    const csv = csvs[i];
    const parsed = parseCidFromText(csv);
    const lineCount = Math.max(0, csv.split(/\r?\n/).filter(l => l.trim()).length - 1);
    total += lineCount;
    invalid += Math.max(0, lineCount - parsed.length);
    all = all.concat(parsed);
    self.postMessage({ type: 'progress', i: i + 1, n: csvs.length, name: names[i], count: parsed.length });
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

async function readViaSlices(file, signal) {
  const CHUNK = 256 * 1024;
  const out = new Uint8Array(file.size);
  let offset = 0;
  while (offset < file.size) {
    if (signal?.aborted) throw new Error('aborted');
    const end = Math.min(offset + CHUNK, file.size);
    const buf = await file.slice(offset, end).arrayBuffer();
    out.set(new Uint8Array(buf), offset);
    offset = end;
    _progress(file, offset, file.size);
  }
  return out.buffer;
}

async function readViaStream(file, signal) {
  if (typeof file.stream !== 'function') throw new Error('stream indisponivel');
  const reader = file.stream().getReader();
  try {
    const chunks = [];
    let received = 0;
    while (true) {
      if (signal?.aborted) throw new Error('aborted');
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      chunks.push(value);
      received += value.byteLength;
      _progress(file, received, file.size);
    }
    if (!received) throw new Error('stream retornou 0 bytes');
    const out = new Uint8Array(received);
    let pos = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.byteLength; }
    return out.buffer;
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
}

async function readFileAb(file) {
  const strategies = [
    ['slices',      (sig) => readViaSlices(file, sig), 120000],
    ['stream',      (sig) => readViaStream(file, sig), 120000],
    ['fetch',       ()    => readViaFetch(file),          8000],
    ['arrayBuffer', ()    => file.arrayBuffer(),          8000],
  ];
  let lastErr;
  for (const [name, fn, timeout] of strategies) {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    try {
      self.postMessage({ type: 'read', phase: 'lendo-' + name, name: file.name });
      const ab = await Promise.race([
        fn(ac?.signal),
        new Promise((_, rej) => setTimeout(() => { ac?.abort(); rej(new Error('timeout ' + timeout / 1000 + 's (' + name + ')')); }, timeout)),
      ]);
      if (!ab || !ab.byteLength) throw new Error('buffer vazio');
      self.postMessage({ type: 'read', phase: 'ok-' + name, name: file.name, bytes: ab.byteLength });
      return ab;
    } catch (e) {
      ac?.abort();
      lastErr = e;
      self.postMessage({ type: 'read', phase: 'falhou-' + name, name: file.name, error: e.message });
    }
  }
  throw lastErr || new Error(
    'Nao foi possivel ler o arquivo. Se estiver no iCloud, baixe uma copia local ou exporte CSV no Vivver.'
  );
}

function parseCsvs(csvs, names, mode) {
  return mode === 'cid' ? parseCidCsvs(csvs, names) : parseHistCsvs(csvs, names);
}

self.onmessage = async function(e) {
  try {
    const { files, csvs, names, mode = 'hist' } = e.data;

    if (files && files.length) {
      const csvList = [], nameList = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        self.postMessage({ type: 'read', i: i + 1, n: files.length, name: file.name, phase: 'lendo' });
        const ab = await readFileAb(file);
        self.postMessage({ type: 'read', i: i + 1, n: files.length, name: file.name, phase: 'convertendo', bytes: ab.byteLength });
        const csv = bufToCsv(ab);
        const headerLine = (csv || '').split(/\r?\n/)[0] || '';
        self.postMessage({ type: 'fingerprint', name: file.name, headerLine, mode });
        csvList.push(csv);
        nameList.push(file.name);
      }
      self.postMessage({ type: 'stage', stage: 'parsing' });
      const result = parseCsvs(csvList, nameList, mode);
      self.postMessage({ type: 'done', ...result });
      return;
    }

    if (csvs && names) {
      const result = parseCsvs(csvs, names, mode);
      self.postMessage({ type: 'done', ...result });
      return;
    }

    throw new Error('Worker: payload invalido (esperado files ou csvs)');
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
