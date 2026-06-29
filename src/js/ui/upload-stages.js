// ui/upload-stages.js — estágios de progresso durante importação de arquivos

import { setProgress } from './progress.js';

const STAGE_RANGE = {
  reading: [5, 38],
  converting: [38, 52],
  parsing: [52, 88],
  saving: [88, 99],
};

const STAGE_MSG = {
  reading: 'Lendo arquivo',
  converting: 'Convertendo planilha — pode levar alguns segundos',
  parsing: 'Interpretando registros',
  saving: 'Salvando no navegador',
};

/**
 * @param {'reading'|'converting'|'parsing'|'saving'} stage
 * @param {string} [detail]
 * @param {number} [fileIndex] 0-based
 * @param {number} [fileCount]
 */
export function setUploadStage(stage, detail = '', fileIndex = 0, fileCount = 1) {
  const [lo, hi] = STAGE_RANGE[stage] || [0, 100];
  const slice = fileCount > 1 ? (fileIndex + 1) / fileCount : 1;
  const pct = lo + Math.round((hi - lo) * slice * (stage === 'reading' && fileCount > 1 ? 0.85 : 1));
  let msg = STAGE_MSG[stage] || stage;
  if (detail) msg += ` — ${detail}`;
  setProgress(Math.min(pct, hi), msg);
}
