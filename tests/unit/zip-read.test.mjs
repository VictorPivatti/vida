/**
 * Regression tests for readZipEntry via central directory (incl. data-descriptor / bit 3).
 * Requires Node ≥18 (DecompressionStream).
 */
import zlib from 'zlib';
import { promisify } from 'util';
import { readZipEntry, decodeXmlEntities } from '../../src/js/parsers/workbook.js';

const deflateRaw = promisify(zlib.deflateRaw);

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function cat(...parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out.buffer;
}

/** Build ZIP with GP bit 3 (data descriptor) — local cSize=0, sizes only in CD. */
async function buildStreamingZip(filename, content, { deflate = false } = {}) {
  const enc = new TextEncoder();
  const name = enc.encode(filename);
  const plain = enc.encode(content);
  const crc = crc32(plain);
  const method = deflate ? 8 : 0;
  const compressed = deflate ? await deflateRaw(plain) : plain;
  const cSize = compressed.length;
  const uSize = plain.length;
  const gpFlag = 8;

  const lh = new Uint8Array(30 + name.length);
  const lhv = new DataView(lh.buffer);
  lhv.setUint32(0, 0x04034b50, true);
  lhv.setUint16(4, 20, true);
  lhv.setUint16(6, gpFlag, true);
  lhv.setUint16(8, method, true);
  lhv.setUint32(14, 0, true); // crc 0 in LH when bit3
  lhv.setUint32(18, 0, true); // cSize 0
  lhv.setUint32(22, 0, true); // uSize 0
  lhv.setUint16(26, name.length, true);
  lhv.setUint16(28, 0, true);
  lh.set(name, 30);

  const dd = new Uint8Array(16);
  const ddv = new DataView(dd.buffer);
  ddv.setUint32(0, 0x08074b50, true);
  ddv.setUint32(4, crc, true);
  ddv.setUint32(8, cSize, true);
  ddv.setUint32(12, uSize, true);

  const localOffset = 0;
  const cdStart = lh.length + compressed.length + dd.length;

  const cd = new Uint8Array(46 + name.length);
  const cdv = new DataView(cd.buffer);
  cdv.setUint32(0, 0x02014b50, true);
  cdv.setUint16(4, 20, true);
  cdv.setUint16(6, 20, true);
  cdv.setUint16(8, gpFlag, true);
  cdv.setUint16(10, method, true);
  cdv.setUint32(16, crc, true);
  cdv.setUint32(20, cSize, true);
  cdv.setUint32(24, uSize, true);
  cdv.setUint16(28, name.length, true);
  cdv.setUint16(30, 0, true);
  cdv.setUint16(32, 0, true);
  cdv.setUint16(34, 0, true);
  cdv.setUint16(36, 0, true);
  cdv.setUint32(38, 0, true);
  cdv.setUint32(42, localOffset, true);
  cd.set(name, 46);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, cd.length, true);
  ev.setUint32(16, cdStart, true);
  ev.setUint16(20, 0, true);

  return cat(lh, compressed, dd, cd, eocd);
}

let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL: ' + name); failed++; }
  else console.log('✓ ' + name);
}

if (typeof DecompressionStream === 'undefined') {
  console.log('zip-read.test.mjs: SKIP (DecompressionStream indisponível)');
  process.exit(0);
}

ok('decodeXmlEntities: &amp;lt; não dupla-decodifica', decodeXmlEntities('&amp;lt;') === '&lt;');

const storedZip = await buildStreamingZip('hello.txt', 'conteudo streaming zip', { deflate: false });
const storedText = await readZipEntry(storedZip, 'hello.txt');
ok('readZipEntry: stored + bit3', storedText === 'conteudo streaming zip');

const defZip = await buildStreamingZip('data.xml', '<t>xml deflate</t>', { deflate: true });
const defText = await readZipEntry(defZip, 'data.xml');
ok('readZipEntry: deflate + bit3', defText === '<t>xml deflate</t>');

ok('readZipEntry: alvo ausente → null', (await readZipEntry(storedZip, 'missing.txt')) === null);

if (failed > 0) { console.error(failed + ' test(s) failed'); process.exit(1); }
console.log('zip-read.test.mjs: all OK');
