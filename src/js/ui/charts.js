// ui/charts.js — Chart.js rendering wrapper
// Chart is a CDN global (window.Chart) — not imported, just referenced directly.
// Depends on state.charts and state.theme from state.js.

import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { showToast } from './toast.js';

let _chartWarned = false;

// ── Chart.js plugin: target/meta line ───────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function drawMetaPill(ctx, x, y, label, color, align) {
  const font = "600 11px 'Plus Jakarta Sans',system-ui,sans-serif";
  ctx.font = font;
  const tw = ctx.measureText(label).width;
  const padX = 8;
  const rh = 18;
  const rw = tw + padX * 2;
  const rr = 4;
  const rx = align === 'right' ? x - rw : x;
  const ry = y - rh / 2;

  const rgb = hexToRgb(color.startsWith('#') ? color : '#9aa6b6');
  ctx.fillStyle = state.theme === 'dark'
    ? `rgba(${rgb.r},${rgb.g},${rgb.b},.22)`
    : `rgba(${rgb.r},${rgb.g},${rgb.b},.12)`;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, rr);
  else ctx.rect(rx, ry, rw, rh);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, align === 'right' ? x - padX : x + padX, y);
}

export const targetLinePlugin = {
  id: 'targetLine',
  afterDraw(chart, _args, opts) {
    const lines = opts?.lines || [];
    if (!lines.length) return;
    const { ctx, chartArea: { left, right, top, bottom }, scales } = chart;
    const yScale = scales.y;
    if (!yScale) return;

    const visible = [];
    lines.forEach(line => {
      if (line.value == null || Number.isNaN(line.value)) return;
      const py = yScale.getPixelForValue(line.value);
      if (py < top || py > bottom) return;
      const color = line.color || '#9aa6b6';
      visible.push({ line, py, color, label: line.label || 'meta' });

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(left, py);
      ctx.lineTo(right, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });

    if (!visible.length) return;

    const minGap = 4;
    const rh = 18;
    const placements = visible.map(v => ({ ...v, labelY: v.py }));
    placements.sort((a, b) => a.py - b.py);
    for (let i = 1; i < placements.length; i++) {
      const prev = placements[i - 1];
      const cur = placements[i];
      const minY = prev.labelY + rh + minGap;
      if (cur.labelY < minY) cur.labelY = minY;
      if (cur.labelY > bottom - rh / 2) cur.labelY = bottom - rh / 2;
    }
    for (let i = placements.length - 2; i >= 0; i--) {
      const next = placements[i + 1];
      const cur = placements[i];
      const maxY = next.labelY - rh - minGap;
      if (cur.labelY > maxY) cur.labelY = maxY;
      if (cur.labelY < top + rh / 2) cur.labelY = top + rh / 2;
    }

    const labelX = right - 4;
    placements.forEach(p => {
      ctx.save();
      drawMetaPill(ctx, labelX, p.labelY, p.label, p.color, 'right');
      ctx.restore();
    });
  }
};

export function gridColor(){return state.theme==="dark"?"rgba(255,255,255,.06)":"rgba(0,0,0,.07)"}
export function tickColor(){return state.theme==="dark"?"#7a8da3":"#66758a"}
export function axes(){return{x:{grid:{color:gridColor()},ticks:{color:tickColor()}},y:{grid:{color:gridColor()},ticks:{color:tickColor()}}}}

export function chart(id,cfg){
  if(state.charts[id]){ state.charts[id].destroy(); delete state.charts[id]; }
  const el=$(id);if(!el)return;
  const allEmpty=cfg.data&&cfg.data.datasets&&cfg.data.datasets.length>0&&
    cfg.data.datasets.every(d=>!d.data||!d.data.some(v=>v!=null&&v!==0));
  if(allEmpty){
    // Remover canvas e mostrar estado vazio
    const wrap=el.parentElement;
    if(wrap&&!wrap.querySelector('.chart-empty-state')){
      el.style.display='none';
      const empty=document.createElement('div');
      empty.className='chart-empty-state';
      empty.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.3;margin-bottom:6px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg><div>Sem dados para o período selecionado</div>';
      wrap.appendChild(empty);
    }
    return;
  }
  // Restaurar canvas se estava oculto
  el.style.display='';
  const existingEmpty=el.parentElement&&el.parentElement.querySelector('.chart-empty-state');
  if(existingEmpty)existingEmpty.remove();
  cfg.plugins=[...(cfg.plugins||[]),targetLinePlugin];
  const metaLines=cfg.options?.plugins?.targetLine?.lines;
  if(metaLines?.length){
    cfg.options=cfg.options||{};
    cfg.options.layout=cfg.options.layout||{};
    const pad=cfg.options.layout.padding||{};
    const extra=metaLines.length>1?88:72;
    cfg.options.layout.padding={
      ...(typeof pad==='number'?{top:0,right:pad,bottom:0,left:0}:pad),
      right:Math.max(typeof pad==='number'?pad:(pad.right||0),extra)
    };
  }
  // Chart is a CDN global (window.Chart)
  if (typeof Chart === 'undefined') {
    if (!_chartWarned) {
      _chartWarned = true;
      showToast('Gráficos indisponíveis — Chart.js não carregou. Conecte-se e recarregue (F5).', 'warn', 6000);
    }
    console.warn('[charts] Chart.js não carregado — gráfico omitido:', id);
    return;
  }
  state.charts[id]=new Chart(el,cfg);
}

export function destroyCharts(){Object.values(state.charts).forEach(c=>c.destroy());state.charts={}}
