// render/index.js — Orchestrator: re-exports all render functions
import { applyLayout } from '../ui/layout.js';
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
import { renderPacientes, buscaProntuario, showTopRetornos } from './pacientes.js';
import { renderEscala } from './escala.js';
import { renderPrintCover } from './relatorio.js';
import { renderNotificaveis, DOENCAS_NOTIFICAVEIS } from './notificaveis.js';
import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { manchesterConformidade } from '../metrics/manchester.js';
import { returns72 } from '../metrics/returns.js';

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
export { renderPacientes, buscaProntuario, showTopRetornos };
export { renderEscala };
export { renderNotificaveis, DOENCAS_NOTIFICAVEIS };

function meta(id) { return Number(document.getElementById(id)?.value) || 0; }

export function updateNavAlerts() {
  if (!state.raw.length) return;
  const alerts = {};

  const manch = manchesterConformidade(state.filt);
  const manchCrit = Object.values(manch).some(x => x.total > 0 && (x.ok / x.total * 100) < 90);
  if (manchCrit) alerts['indicadores'] = true;

  const { ret } = returns72();
  const retRate = state.filt.length ? ret.length / state.filt.length * 100 : 0;
  if (retRate > meta('metaRet')) alerts['retornos'] = true;

  const meses = [...new Set(state.triFilt.map(r => r.anoMes))];
  const taxasEvasao = meses.map(m => {
    const recep = state.recepcionados[m] || null;
    if (!recep) return null;
    const brancos = state.triFilt.filter(r => r.anoMes === m && r.cor === 'BRANCO').length;
    const atend = state.filt.filter(r => r.anoMes === m).length;
    const ev = recep - brancos - atend;
    return recep > 0 ? ev / recep * 100 : null;
  }).filter(v => v != null);
  const taxaMedia = taxasEvasao.length ? taxasEvasao.reduce((a, b) => a + b, 0) / taxasEvasao.length : null;
  if (taxaMedia != null && taxaMedia > meta('metaEvasao')) alerts['triagem'] = true;

  document.querySelectorAll('.nav-item[data-pane]').forEach(btn => {
    const pane = btn.dataset.pane;
    let dot = btn.querySelector('.nav-alert');
    if (alerts[pane]) {
      if (!dot) { dot = document.createElement('span'); dot.className = 'nav-alert'; btn.appendChild(dot); }
    } else {
      if (dot) dot.remove();
    }
  });
}

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
      'triagem', 'cid', 'auditoria', 'qualidade',
      'pacientes', 'escala',
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
    case 'triagem':       renderTriagem(); break;
    case 'cid':           renderCid(); break;
    case 'auditoria':     renderAuditoria(); break;
    case 'qualidade':     renderQuality(); renderCruzamento(); break;
    case 'pacientes':     renderPacientes(); break;
    case 'escala':        renderEscala(); break;
  }
  requestAnimationFrame(() => applyLayout());
}
