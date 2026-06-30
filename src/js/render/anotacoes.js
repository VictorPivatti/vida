// render/anotacoes.js — Anotacoes pane rendering
import { state } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { monthLabel } from '../utils/dates.js';
import { showToast } from '../ui/toast.js';

const ANOT_KEY = 'upa_dash_anotacoes';
const CAT_LABELS = { operacional: 'Operacional', clinico: 'Clínico', rh: 'RH', estrutura: 'Estrutura', externo: 'Externo' };

function loadAnotacoes() {
  try {
    const arr = JSON.parse(localStorage.getItem(ANOT_KEY) || '[]');
    let changed = false;
    arr.forEach((a, i) => {
      if (a.id == null) { a.id = Date.now() + i; changed = true; }
    });
    if (changed) saveAnotacoes(arr);
    return arr;
  } catch { return []; }
}
function saveAnotacoes(arr) { try { localStorage.setItem(ANOT_KEY, JSON.stringify(arr)); } catch { } }

function _nextAnotId(anots) {
  let id = Date.now();
  while (anots.some(a => a.id === id)) id++;
  return id;
}

function popularMesesAnot() {
  const sel = $('anotMes'); if (!sel) return;
  const meses = state.raw.length
    ? [...new Set(state.raw.map(r => r.anoMes))].sort().map(k => ({ k, label: monthLabel(k) }))
    : Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return { k: d.getFullYear() * 100 + d.getMonth() + 1, label: monthLabel(d.getFullYear() * 100 + d.getMonth() + 1) }; });
  const cur = sel.value;
  sel.innerHTML = meses.map(m => `<option value="${m.k}">${m.label}</option>`).join('');
  if (cur) sel.value = cur;
}

function renderAnotLista() {
  const lista = $('anotLista'); if (!lista) return;
  const anots = loadAnotacoes().slice().sort((a, b) => b.k - a.k);
  if (!anots.length) {
    lista.innerHTML = '<div style="color:var(--mut);font-size:12px;font-family:monospace;padding:8px">Nenhuma anotação salva ainda.</div>';
    return;
  }
  lista.innerHTML = anots.map(a => `
    <div class="anot-item">
      <div class="anot-header">
        <span class="anot-mes">${monthLabel(a.k)}</span>
        <span class="anot-cat ${a.cat}">${CAT_LABELS[a.cat] || a.cat}</span>
      </div>
      <div class="anot-texto">${esc(a.texto)}</div>
      <button type="button" class="anot-del" onclick="deletarAnotacao(${a.id})" title="Remover">✕</button>
    </div>`).join('');
}

export function salvarAnotacao() {
  const texto = ($('anotTexto')?.value || '').trim();
  if (!texto) { showToast('Digite uma anotação antes de salvar.', 'warn'); return; }
  const k = Number($('anotMes')?.value);
  const cat = $('anotCategoria')?.value || 'operacional';
  if (!k) { showToast('Selecione o mês da anotação.', 'warn'); return; }
  const anots = loadAnotacoes();
  anots.push({ id: _nextAnotId(anots), k, cat, texto });
  saveAnotacoes(anots);
  limparAnotForm();
  renderAnotLista();
  showToast('Anotação salva.', 'ok');
}

export function limparAnotForm() {
  const t = $('anotTexto');
  if (t) t.value = '';
}

export function deletarAnotacao(id) {
  const anots = loadAnotacoes().filter(a => a.id !== id);
  saveAnotacoes(anots);
  renderAnotLista();
}

export function renderAnotacoes() {
  popularMesesAnot();
  renderAnotLista();
}
