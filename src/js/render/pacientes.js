// render/pacientes.js — Pacientes pane rendering
import { state } from '../state.js';
import { $, esc, fmt, pct, norm, kpi } from '../utils/dom.js';
import { avg } from '../utils/stats.js';
import { RISK_COLOR } from '../constants.js';
import { returnsFor } from '../metrics/returns.js';

function group(arr, fn) { return arr.reduce((m, r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; return m; }, {}); }

export function renderPacientes() {
  if (!state.raw.length) {
    const r = $('pacienteResult');
    if (r) r.innerHTML = '<div class="card" style="padding:24px;text-align:center;color:var(--mut)">Carregue o histórico primeiro.</div>';
    return;
  }
  renderTopRetornos();
}

export function buscaProntuario(q) {
  const res = $('pacienteResult'); if (!res) return;
  if (!state.raw.length) { res.innerHTML = '<div class="card" style="padding:24px;text-align:center;color:var(--mut)">Carregue o histórico primeiro.</div>'; return; }
  if (!q) { renderTopRetornos(); return; }
  const norm_q = norm(q);
  const visits = state.raw.filter(r => norm(r.pront).includes(norm_q) || norm(r.pront) === norm_q).sort((a, b) => a.dh - b.dh);
  if (!visits.length) {
    res.innerHTML = `<div class="card" style="padding:24px;text-align:center;color:var(--mut)">Nenhum registro encontrado para "<strong>${esc(q)}</strong>".</div>`;
    return;
  }
  const { ret } = returnsFor(visits);
  const retornos72 = visits.filter((v, i) => { if (i === 0) return false; const h = (v.dh - visits[i - 1].dh) / 36e5; return h > 0 && h <= 72; });
  const tMed = avg(visits, r => r.tEspMed), tTot = avg(visits, r => r.tTotal);
  const riscoCount = group(visits, r => r.cor);
  const topRisco = Object.entries(riscoCount).sort((a, b) => b[1] - a[1])[0];
  res.innerHTML = `
    <div class="grid" style="margin-bottom:12px">
      ${kpi('Visitas', fmt(visits.length), 'no histórico completo', '#1357a6')}
      ${kpi('Retornos ≤72h', fmt(retornos72.length), pct(retornos72.length, visits.length), '#c8493e')}
      ${kpi('Espera médico', tMed != null ? Math.round(tMed) + ' min' : '-', 'média histórica', '#e8a93b')}
      ${kpi('Tempo total', tTot != null ? Math.round(tTot) + ' min' : '-', 'média histórica', '#7b61c4')}
    </div>
    <div class="pront-card">
      <div class="card-title">Prontuário ${esc(q)} — ${visits.length} visita${visits.length !== 1 ? 's' : ''} · Risco predominante: <span style="color:${RISK_COLOR[topRisco?.[0]] || 'var(--mut)'}">${esc(topRisco?.[0] || '-')}</span></div>
      <div style="margin-top:8px">
        ${visits.map((v, i) => {
    const isRet = i > 0 && (v.dh - visits[i - 1].dh) / 36e5 <= 72;
    return `<div class="pront-visit">
              <span style="min-width:130px;color:var(--txt)">${v.dh.toLocaleString('pt-BR')}</span>
              <span class="pront-badge" style="background:${RISK_COLOR[v.cor] + '22' || 'var(--sur3)'};color:${RISK_COLOR[v.cor] || 'var(--mut)'}">${v.cor || 'S/C'}</span>
              <span style="flex:1;color:var(--txt2)">${esc(v.prof || '—')}</span>
              ${v.tEspMed != null ? `<span class="mono" style="color:var(--mut)">espera ${Math.round(v.tEspMed)}min</span>` : ''}
              ${v.tTotal != null ? `<span class="mono" style="color:var(--mut)">total ${Math.round(v.tTotal)}min</span>` : ''}
              ${isRet ? `<span class="pront-badge" style="background:rgba(200,73,62,.12);color:#c8493e">↩ retorno ${((v.dh - visits[i - 1].dh) / 36e5).toFixed(1)}h</span>` : ''}
            </div>`;
  }).join('')}
      </div>
    </div>`;
}

function renderTopRetornos() {
  const res = $('pacienteResult');
  if (!state.raw.length) { res.innerHTML = ''; return; }
  const byP = {};
  state.raw.forEach(r => { if (!r.pront) return; byP[r.pront] = byP[r.pront] || []; byP[r.pront].push(r); });
  const top = Object.entries(byP)
    .map(([p, v]) => {
      const sorted = v.sort((a, b) => a.dh - b.dh);
      const rets = sorted.filter((x, i) => i > 0 && (x.dh - sorted[i - 1].dh) / 36e5 <= 72);
      return { pront: p, visitas: v.length, rets: rets.length, ultima: sorted[sorted.length - 1].dh, cor: sorted[sorted.length - 1].cor };
    })
    .filter(x => x.rets > 0)
    .sort((a, b) => b.rets - a.rets)
    .slice(0, 30);
  res.innerHTML = `<div class="card full"><div class="card-title">Top 30 pacientes com mais retornos ≤72h</div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>#</th><th>Prontuário</th><th>Visitas</th><th>Retornos ≤72h</th><th>Última visita</th><th>Ação</th></tr></thead>
      <tbody>${top.map((r, i) => `<tr>
        <td class="mono">${i + 1}</td>
        <td class="mono">${esc(r.pront)}</td>
        <td class="mono">${r.visitas}</td>
        <td class="mono erc">${r.rets}</td>
        <td class="mono">${r.ultima.toLocaleDateString('pt-BR')}</td>
        <td><button type="button" class="btn" style="font-size:10px;padding:3px 8px" onclick="document.getElementById('searchPront').value='${esc(r.pront)}';buscaProntuario('${esc(r.pront)}')">Ver histórico</button></td>
      </tr>`).join('')}
      </tbody>
    </table></div></div>`;
}
