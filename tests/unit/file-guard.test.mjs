import { validateUploadFile } from '../../src/js/ui/file-guard.js';

function mockFile(name, size) {
  return { name, size };
}

let ok = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  ok++;
}

// extensão válida
{
  const r = validateUploadFile(mockFile('test.xlsx', 1000), { kind: 'cid' });
  assert(r.ok === true, 'xlsx ok');
}

// extensão inválida
{
  const r = validateUploadFile(mockFile('test.pdf', 1000), { kind: 'cid' });
  assert(r.ok === false, 'pdf rejected');
}

// arquivo grande pede confirm
{
  const r = validateUploadFile(mockFile('big.xls', 55_000_000), { kind: 'cid' });
  assert(r.ok === 'confirm', 'large file confirm');
  assert(r.estimateSec > 0, 'estimate present');
}

console.log(`file-guard.test.mjs: ${ok} OK`);
