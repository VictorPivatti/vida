// ui/file-guard.js — validação antes de ler arquivos grandes

const EXT_BY_KIND = {
  hist: /\.(xlsx|xls|csv)$/i,
  cid: /\.(xlsx|xls|csv)$/i,
  tri: /\.(xlsx|xls|csv)$/i,
  proc: /\.(xlsx|xls|csv)$/i,
};

/**
 * @param {File} file
 * @param {{ kind: 'hist'|'cid'|'tri'|'proc' }} opts
 * @returns {{ ok: true|'confirm'|false, warn?: string, estimateSec?: number }}
 */
export function validateUploadFile(file, { kind }) {
  const name = (file?.name || '').toLowerCase();
  const extRe = EXT_BY_KIND[kind] || EXT_BY_KIND.hist;
  if (!extRe.test(name)) {
    return { ok: false, warn: 'Formato não suportado. Use .xlsx, .xls ou .csv.' };
  }
  const size = file.size || 0;
  const estimateSec = size > 5_000_000 ? Math.ceil(size / 400_000) : null;
  if (size > 50_000_000) {
    const mb = (size / 1e6).toFixed(0);
    return {
      ok: 'confirm',
      warn: `Arquivo grande (${mb} MB). A conversão pode levar cerca de ${estimateSec}s. Continuar?`,
      estimateSec,
    };
  }
  return { ok: true, estimateSec };
}

/**
 * Valida lista de arquivos; lança Error se inválido ou usuário cancelar.
 * @param {File[]} files
 * @param {{ kind: 'hist'|'cid'|'tri'|'proc' }} opts
 */
export async function validateUploadFiles(files, { kind }) {
  for (const file of files) {
    const r = validateUploadFile(file, { kind });
    if (r.ok === false) throw new Error(r.warn);
    if (r.ok === 'confirm') {
      if (typeof confirm === 'function' && !confirm(r.warn)) {
        throw new Error('Importação cancelada.');
      }
    } else if (r.estimateSec && r.estimateSec > 15 && typeof showToast === 'undefined') {
      // hint via dynamic import avoided — loaders call showToast separately if needed
    }
  }
}
