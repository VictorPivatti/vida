// render/index.js — Orchestrator: re-exports all render functions
export { renderGeral, renderExecutive, renderHeatmap } from './geral.js';
export { renderIndicadores } from './indicadores.js';
export { renderFluxo } from './fluxo.js';
export { renderGargalos } from './gargalos.js';
export { renderMedicos } from './medicos.js';
export { renderRetornos } from './retornos.js';
export { renderEvolucao, renderAnoAano } from './evolucao.js';
export { renderTriagem } from './triagem.js';
export { renderCid, renderCruzamento } from './cid.js';
export { renderQuality } from './qualidade.js';
export { renderProcedimentos } from './procedimentos.js';
export { renderEnfermagem } from './enfermagem.js';
export { renderExames } from './exames.js';
export { renderAuditoria } from './auditoria.js';
export { renderPacientes, buscaProntuario } from './pacientes.js';
export { renderEscala } from './escala.js';
export { renderAnotacoes, deletarAnotacao } from './anotacoes.js';
export { renderRelatorio } from './relatorio.js';
export { renderNotificaveis, DOENCAS_NOTIFICAVEIS } from './notificaveis.js';

// Dirty-pane tracking (module-level, mirrors script-block pattern)
export const _dirtyPanes = new Set();

export function markDirty(panes) {
  if (Array.isArray(panes)) {
    panes.forEach(p => _dirtyPanes.add(p));
  } else if (panes) {
    _dirtyPanes.add(panes);
  } else {
    // Mark all panes dirty
    const ALL_PANES = [
      'geral', 'indicadores', 'fluxo', 'gargalos', 'medicos',
      'procedimentos', 'enfermagem', 'exames', 'retornos', 'evolucao',
      'relatorio', 'triagem', 'cid', 'auditoria', 'qualidade',
      'pacientes', 'escala', 'anotacoes',
    ];
    ALL_PANES.forEach(p => _dirtyPanes.add(p));
  }
}

export function markDirtyAll() {
  markDirty(null);
}
