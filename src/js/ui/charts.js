// ui/charts.js — Chart.js rendering wrapper
// Chart is a CDN global (window.Chart) — not imported, just referenced directly.
// Depends on state.charts and state.theme from state.js.

import { state } from '../state.js';
import { $ } from '../utils/dom.js';

// ── Chart.js plugin: target/meta line ───────────────────────
export const targetLinePlugin = {
  id:"targetLine",
  afterDraw(chart,args,opts){
    const lines=opts?.lines||[];
    if(!lines.length)return;
    const {ctx,chartArea:{left,right},scales}=chart, y=scales.y;
    if(!y)return;
    lines.forEach(line=>{
      if(line.value==null||Number.isNaN(line.value))return;
      const py=y.getPixelForValue(line.value);
      if(py<chart.chartArea.top||py>chart.chartArea.bottom)return;
      const lc=line.color||"#9aa6b6";
      ctx.save();ctx.strokeStyle=lc;ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right,py);ctx.stroke();ctx.setLineDash([]);
      const lbl=line.label||"meta";ctx.font="500 10px 'Plus Jakarta Sans',system-ui,sans-serif";const tw=ctx.measureText(lbl).width;const px2=right-6;const py2=py-6;const rx=px2-tw-8,ry=py2-10,rw=tw+10,rh=14,rr=3;ctx.fillStyle=state.theme==="dark"?"#18202a":"#ffffff";ctx.beginPath();if(ctx.roundRect){ctx.roundRect(rx,ry,rw,rh,rr);}else{ctx.moveTo(rx+rr,ry);ctx.lineTo(rx+rw-rr,ry);ctx.arcTo(rx+rw,ry,rx+rw,ry+rr,rr);ctx.lineTo(rx+rw,ry+rh-rr);ctx.arcTo(rx+rw,ry+rh,rx+rw-rr,ry+rh,rr);ctx.lineTo(rx+rr,ry+rh);ctx.arcTo(rx,ry+rh,rx,ry+rh-rr,rr);ctx.lineTo(rx,ry+rr);ctx.arcTo(rx,ry,rx+rr,ry,rr);ctx.closePath();}ctx.fill();ctx.fillStyle=lc;ctx.strokeStyle=lc;ctx.lineWidth=.75;ctx.stroke();ctx.fillStyle=state.theme==="dark"?"#8896a8":"#515e70";ctx.textAlign="right";ctx.fillText(lbl,px2,py2);ctx.restore();
    });
  }
};

export function gridColor(){return state.theme==="dark"?"rgba(255,255,255,.06)":"rgba(0,0,0,.07)"}
export function tickColor(){return state.theme==="dark"?"#7a8da3":"#66758a"}
export function axes(){return{x:{grid:{color:gridColor()},ticks:{color:tickColor()}},y:{grid:{color:gridColor()},ticks:{color:tickColor()}}}}

export function chart(id,cfg){
  if(state.charts[id])state.charts[id].destroy();
  const el=$(id);if(!el)return;
  // Verificar se todos os datasets estão vazios
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
  // Chart is a CDN global (window.Chart)
  state.charts[id]=new Chart(el,cfg);
}

export function destroyCharts(){Object.values(state.charts).forEach(c=>c.destroy());state.charts={}}
