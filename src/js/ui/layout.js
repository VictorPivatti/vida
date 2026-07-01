// ui/layout.js — Drag-and-drop pane layout manager (localStorage-backed)

import { $ } from '../utils/dom.js';
import { LAYOUT_KEY } from '../state.js';
import { showToast } from './toast.js';

export function saveLayout() {
  const layout = {};
  document.querySelectorAll('.pane').forEach(pane => {
    const id = pane.id;
    const grid = pane.querySelector('.chart-grid');
    if (!grid) return;
    layout[id] = [...grid.children].map(card => ({
      title: card.querySelector('.card-title')?.textContent?.trim()?.substring(0, 50) || '',
      cols: card.dataset.layoutCols || 'auto',
      height: card.style.height || null,
    }));
  });
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch(e) {}
}

export function applyLayout() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); } catch(e) { return; }
  if (!saved) return;
  document.querySelectorAll('.pane').forEach(pane => {
    const id = pane.id;
    if (!saved[id]) return;
    const grid = pane.querySelector('.chart-grid');
    if (!grid) return;
    const savedOrder = saved[id];
    const cardByTitle = new Map([...grid.children].map(c => [
      c.querySelector('.card-title')?.textContent?.trim()?.substring(0,50), c
    ]));
    // Aplicar tamanhos salvos
    savedOrder.forEach(s => {
      const card = cardByTitle.get(s.title);
      if (card && s.cols !== 'auto') applyCardSize(card, s.cols);
      if (card && s.height) card.style.height = s.height;
    });
    // Reordenar
    savedOrder.forEach(s => {
      const card = cardByTitle.get(s.title);
      if (card) grid.appendChild(card);
    });
  });
}

function applyCardSize(card, cols) {
  card.dataset.layoutCols = cols;
  card.style.gridColumn = cols === 'full' ? '1 / -1' : `span ${cols}`;
  // Atualizar botões ativos
  card.querySelectorAll('.card-size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cols === cols);
  });
}

function addLayoutControls(card) {
  if (card.querySelector('.card-ctrl')) return; // já tem
  const currentCols = card.dataset.layoutCols || 'auto';

  // Alça de arrastar
  const handle = document.createElement('div');
  handle.className = 'card-drag-handle';
  card.prepend(handle);

  // Controles de tamanho
  const ctrl = document.createElement('div');
  ctrl.className = 'card-ctrl';
  const sizes = [
    { label: '½', cols: '4', title: 'Estreito (1/3)' },
    { label: '▬', cols: '6', title: 'Médio (1/2)' },
    { label: '▬▬', cols: '8', title: 'Largo (2/3)' },
    { label: '━', cols: 'full', title: 'Cheio (100%)' },
  ];
  sizes.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'card-size-btn' + (currentCols === s.cols ? ' active' : '');
    btn.textContent = s.label;
    btn.title = s.title;
    btn.dataset.cols = s.cols;
    btn.onclick = e => { e.stopPropagation(); applyCardSize(card, s.cols); saveLayout(); };
    ctrl.appendChild(btn);
  });
  card.appendChild(ctrl);

  // Alça de redimensionamento (canto inferior direito)
  const rh = document.createElement('div');
  rh.className = 'card-resize-handle';
  rh.title = 'Arrastar para redimensionar';
  card.appendChild(rh);
  attachResizeHandle(card, rh);

  // Drag & drop
  card.draggable = false; // ativado só em modo edit
}

function attachResizeHandle(card, handle) {
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const rect = card.getBoundingClientRect();
    const startW = rect.width, startH = rect.height;
    const grid = card.closest('.chart-grid');
    const gridW = grid.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 16;
    const colW = (gridW - gap * 11) / 12;

    card.classList.add('resizing');

    const onMove = ev => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      // Largura: snap para o span de colunas mais próximo (mín 2, máx 12)
      const newW = Math.max(startW + dx, colW * 2 + gap);
      const span = Math.max(2, Math.min(12, Math.round((newW + gap) / (colW + gap))));
      card.style.gridColumn = `span ${span}`;
      card.dataset.layoutCols = String(span);
      card.querySelectorAll('.card-size-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.cols === String(span))
      );
      // Altura: direto em px (mín 120px)
      card.style.height = `${Math.max(120, Math.round(startH + dy))}px`;
    };

    const onUp = () => {
      card.classList.remove('resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.dispatchEvent(new Event('resize'));
      saveLayout();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function enableDragDrop(grid) {
  let dragged = null;
  grid.querySelectorAll('.card').forEach(card => {
    card.draggable = true;
    card.addEventListener('dragstart', e => {
      dragged = card;
      setTimeout(() => card.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      grid.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
      dragged = null;
      saveLayout();
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragged && dragged !== card) {
        grid.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
      }
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
      e.preventDefault();
      if (dragged && dragged !== card) {
        const allCards = [...grid.children];
        const dragIdx = allCards.indexOf(dragged);
        const dropIdx = allCards.indexOf(card);
        if (dragIdx < dropIdx) {
          grid.insertBefore(dragged, card.nextSibling);
        } else {
          grid.insertBefore(dragged, card);
        }
        card.classList.remove('drag-over');
      }
    });
  });
}

function disableDragDrop(grid) {
  grid.querySelectorAll('.card').forEach(card => { card.draggable = false; });
}

let _layoutEditActive = false;
export function toggleLayoutEdit() {
  _layoutEditActive = !_layoutEditActive;
  const btn = $('layoutEditBtn');
  if (btn) btn.classList.toggle('active', _layoutEditActive);
  document.getElementById('app').classList.toggle('layout-edit-mode', _layoutEditActive);

  document.querySelectorAll('.chart-grid').forEach(grid => {
    // Adicionar controles em todos os cards
    grid.querySelectorAll('.card').forEach(card => addLayoutControls(card));
    if (_layoutEditActive) {
      enableDragDrop(grid);
    } else {
      disableDragDrop(grid);
      saveLayout();
    }
  });

  if (!_layoutEditActive) {
    showToast('Layout salvo.', 'ok', 2500);
  }
}

export function resetLayout() {
  try { localStorage.removeItem(LAYOUT_KEY); } catch(e) {}
  location.reload();
}

// ── Density ────────────────────────────────────────────────────────────────────
const DENSITY = {
  compact: { kpi: '160px', gap: '8px' },
  normal:  { kpi: '190px', gap: '16px' },
  wide:    { kpi: '260px', gap: '24px' },
};

export function applyDensity(d) {
  const v = DENSITY[d] || DENSITY.normal;
  const r = document.documentElement.style;
  r.setProperty('--kpi-min', v.kpi);
  r.setProperty('--card-gap', v.gap);
  document.querySelectorAll('.density-btn').forEach(b => b.classList.toggle('active-pill', b.dataset.density === d));
  try { localStorage.setItem('upa_density', d); } catch (e) {}
}
