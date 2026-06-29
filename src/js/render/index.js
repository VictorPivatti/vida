// render/index.js — Orchestrator: re-exports all render functions
import { renderGeral, renderExecutive, renderHeatmap } from './geral.js';
import { renderIndicadores } from './indicadores.js';
import { renderFluxo } from './fluxo.js';
import { renderGargalos } from './gargalos.js';
import { renderMedicos } from './medicos.js';
import { renderRetornos } from './retornos.js';
import { renderEvolucao, renderAnoAano } from './evolucao.js';
import { renderTriagem } from './triagem.js';
import { renderCid, renderCruzamento } from './cid.js';
import { renderQuality } from './qualidade.js';
import { renderProcedimentos } from './procedimentos.js';
import { renderEnfermagem } from './enfermagem.js';
import { renderExames } from './exames.js';
import { renderAuditoria } from './auditoria.js';
import { renderPacientes, buscaProntuario } from './pacientes.js';
import { renderEscala } from './escala.js';
import { renderAnotacoes, deletarAnotacao } from './anotacoes.js';
import { renderRelatorio } from './relatorio.js';
import { renderNotificaveis, DOENCAS_NOTIFICAVEIS } from './notificaveis.js';
import { state } from '../state.js';
import { showToast } from '../ui/toast.js';

export { renderGeral, renderExecutive, renderHeatmap };
export { renderIndicadores };
export { renderFluxo };
export { renderGargalos };
export { renderMedicos };
export { renderRetornos };
export { renderEvolucao, renderAnoAano };
export { renderTriagem };
export { renderCid, renderCruzamento };
export { renderQuality };
export { renderProcedimentos };
export { renderEnfermagem };
export { renderExames };
export { renderAuditoria };
export { renderPacientes, buscaProntuario };
export { renderEscala };
export { renderAnotacoes, deletarAnotacao };
export { renderRelatorio };
export { renderNotificaveis, DOENCAS_NOTIFICAVEIS };

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

export function renderAll() {
  if (!state.raw.length) return;
  markDirty();
  try { renderPrintCover(); } catch (e) {}
  try { updateNavAlerts(); } catch (e) {}
  try {
    renderActivePane();
  } catch (err) {
    const tab = (document.querySelector('.nav-item.active')?.dataset?.pane) || 'geral';
    console.error(`[VIDA] Erro ao renderizar painel "${tab}":`, err);
    const s = document.getElementById('status');
    if (s) { s.textContent = `Erro no painel "${tab}": ${err.message}`; s.className = 'status mono error-state'; }
    showToast(`Erro no painel "${tab}": ${err.message}`, 'err', 8000);
  }
}

export function renderActivePane() {
  const active = document.querySelector('.nav-item.active');
  const tab = active ? active.dataset.pane : 'geral';
  if (!_dirtyPanes.has(tab)) return;
  _dirtyPanes.delete(tab);
  switch (tab) {
    case 'geral':         renderGeral(); break;
    case 'indicadores':   renderIndicadores(); break;
    case 'fluxo':         renderFluxo(); break;
    case 'gargalos':      renderGargalos(); break;
    case 'medicos':       renderMedicos(); break;
    case 'procedimentos': renderProcedimentos(); break;
    case 'enfermagem':    renderEnfermagem(); break;
    case 'exames':        renderExames(); break;
    case 'retornos':      renderRetornos(); break;
    case 'evolucao':      renderEvolucao(); renderAnoAano(); break;
    case 'relatorio':     renderRelatorio(); break;
    case 'triagem':       renderTriagem(); break;
    case 'cid':           renderCid(); break;
    case 'auditoria':     renderAuditoria(); break;
    case 'qualidade':     renderQuality(); renderCruzamento(); break;
    case 'pacientes':     renderPacientes(); break;
    case 'escala':        renderEscala(); break;
    case 'anotacoes':     renderAnotacoes(); break;
  }
}
