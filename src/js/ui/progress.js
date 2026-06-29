// ui/progress.js — Progress bar and loading overlay

import { $ } from '../utils/dom.js';

let _progressStart = null;

export function setProgress(v,msg,detail){
  const p=$("progress"), b=$("bar"), s=$("status");
  if(!p)return;
  p.style.display="block";
  b.style.width=v+"%";
  let txt = msg || "";
  if(detail){
    if(!_progressStart) _progressStart = Date.now();
    const elapsed = ((Date.now()-_progressStart)/1000).toFixed(1);
    txt += ` <span style="opacity:.6"> · ${detail} · ${elapsed}s</span>`;
  } else if(v>=100){
    _progressStart = null;
  }
  s.innerHTML = txt;
  // Loading state visual no drop zone
  const drop=$('histDrop'), pt=$('upDropProgressText');
  if(drop&&!drop.classList.contains('ready')){
    if(v>0&&v<100){
      drop.classList.add('loading');
      if(pt)pt.textContent=msg||(detail?detail:'processando…');
    } else {
      drop.classList.remove('loading');
    }
  }
}

export function showLoading(msg='Processando...') {
  const ov = document.getElementById('loadingOverlay');
  const tx = document.getElementById('loadingText');
  if (ov) { ov.classList.add('visible'); if (tx) tx.textContent = msg; }
}

export function hideLoading() {
  const ov = document.getElementById('loadingOverlay');
  if (ov) ov.classList.remove('visible');
}
