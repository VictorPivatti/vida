// render/qualidade.js — Quality and Cruzamento pane rendering
import { state } from '../state.js';
import { $, esc, fmt, pct, norm, kpi } from '../utils/dom.js';
import { chart, gridColor, tickColor } from '../ui/charts.js';
import { CONFIG } from '../constants.js';
import { returns72 } from '../metrics/returns.js';

function topAlerts(d) {
  const alerts = [];
  const n = d.length || 1;
  const tMed = d.filter(r => r.tEspMed != null);
  const avgMed = tMed.length ? tMed.reduce((s, r) => s + r.tEspMed, 0) / tMed.length : null;
  const metaMed = Number(document.getElementById('metaMed')?.value) || 30;
  const metaRet = Number(document.getElementById('metaRet')?.value) || 5;
  const { ret } = returns72();
  const retRate = n > 0 ? ret.length / n * 100 : 0;
  if (avgMed != null && avgMed > metaMed) alerts.push(['err', 'Espera médica acima da meta', `${Math.round(avgMed)} min (meta ${metaMed} min) — ${tMed.length} atendimentos com dado`]);
  if (retRate > metaRet) alerts.push(['err', 'Retorno ≤72h acima da meta', `${retRate.toFixed(1)}% (meta ${metaRet}%) — ${ret.length} retornos`]);
  const vermelho = d.filter(r => r.cor === 'VERMELHO' && r.tEspMed != null && r.tEspMed > 10);
  if (vermelho.length > 0) alerts.push(['err', 'VERMELHO com espera > 10 min', `${vermelho.length} caso(s) — protocolo Manchester violado`]);
  const semProf = d.filter(r => !r.prof).length;
  if (semProf / n > 0.05) alerts.push(['warn', 'Alta taxa de médico não identificado', `${semProf} registros sem médico (${(semProf / n * 100).toFixed(1)}%)`]);
  const semCor = d.filter(r => !r.cor || r.cor === 'SEM CLASSIFICACAO').length;
  if (semCor / n > 0.03) alerts.push(['warn', 'Alta taxa sem classificação de risco', `${semCor} registros (${(semCor / n * 100).toFixed(1)}%)`]);
  return alerts;
}

export function renderQuality() {
  const d = state.filt, alerts = topAlerts(d);
  if (alerts.length) {
    $('alerts').innerHTML = alerts.map(([t, title, msg]) => `
      <div class="alert ${t}" style="margin-bottom:10px">
        <strong style="display:block;margin-bottom:4px">${esc(title)}</strong>
        <p class="mono" style="margin:0;line-height:1.55;font-size:11px">${esc(msg)}</p>
      </div>`).join('');
  } else {
    $('alerts').innerHTML = `<div class="alert ok" style="margin-bottom:10px"><strong>✅ Nenhum alerta no período</strong><p class="mono" style="margin:0;font-size:11px">Todos os indicadores estão dentro das metas configuradas.</p></div>`;
  }
  const n = d.length || 1;
  const fields = [
    { campo: 'Médico (prof)', falta: d.filter(r => !r.prof).length, fonte: 'Histórico' },
    { campo: 'Prontuário', falta: d.filter(r => !r.pront).length, fonte: 'Histórico' },
    { campo: 'Classificação', falta: d.filter(r => !r.cor).length, fonte: 'Histórico' },
    { campo: 'Espera triagem', falta: d.filter(r => r.tEspTri == null).length, fonte: 'Histórico' },
    { campo: 'Espera médico', falta: d.filter(r => r.tEspMed == null).length, fonte: 'Histórico' },
    { campo: 'Tempo total', falta: d.filter(r => r.tTotal == null).length, fonte: 'Histórico' },
    { campo: 'Data/hora', falta: d.filter(r => !r.dh || isNaN(r.dh)).length, fonte: 'Histórico' },
    { campo: 'CID carregado', falta: state.cidRaw.length ? 0 : d.length, fonte: 'CID ext.' },
    { campo: 'Triagem carregada', falta: state.triRaw.length ? 0 : d.length, fonte: 'Triagem ext.' },
  ];
  const completude = Math.round(fields.slice(0, 7).reduce((acc, f) => acc + (1 - f.falta / n), 0) / 7 * 100);
  $('quality').innerHTML = `
    <div style="margin-bottom:12px;padding:10px 14px;background:var(--sur2);border-radius:8px;border:1px solid var(--bdr)">
      <div class="section-title-inset" style="margin:0 0 4px">Índice geral de completude</div>
      <div style="font-size:28px;font-weight:800;color:${completude >= 90 ? 'var(--ok)' : completude >= 70 ? 'var(--wn)' : 'var(--er)'};font-family:'IBM Plex Mono',monospace">${completude}%</div>
      <div style="font-size:11px;color:var(--mut)">${fmt(n)} registros no período filtrado</div>
    </div>
    <table class="table" style="font-size:11px">
      <thead><tr><th>Campo</th><th>Fonte</th><th>Preenchidos</th><th>Faltantes</th><th>Completude</th></tr></thead>
      <tbody>${fields.map(f => {
    const ok = n - f.falta, pct_ok = n ? Math.round(ok / n * 100) : 0;
    const color = pct_ok >= 90 ? 'var(--ok)' : pct_ok >= 70 ? 'var(--wn)' : 'var(--er)';
    return `<tr>
              <td style="font-weight:600">${esc(f.campo)}</td>
              <td class="muted mono">${esc(f.fonte)}</td>
              <td>${fmt(ok)}</td>
              <td style="color:${f.falta > 0 ? 'var(--er)' : 'var(--ok)'}">${fmt(f.falta)}</td>
              <td><span style="color:${color};font-weight:700;font-family:'IBM Plex Mono',monospace">${pct_ok}%</span></td>
            </tr>`;
  }).join('')}</tbody>
    </table>
    ${[...state.quality].filter(x => x.invalid > 0).map(x => `
      <div class="quality-item" style="margin-top:8px">
        <span class="dot" style="background:var(--wn)"></span>
        <div><strong>${esc(x.type)}</strong>
        <div class="mono muted">${fmt(x.valid)} válidos de ${fmt(x.total)}. ${esc(x.msg)}</div></div>
      </div>`).join('')}
    <!-- Consistência cruzada -->
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--bdr)">
      <div class="section-title-inset-sm" style="margin-bottom:8px">Consistência cruzada entre bases</div>
      <div id="auditConsistencia" style="font-family:'IBM Plex Mono',monospace;font-size:11px"></div>
    </div>
    `;
  // Consistência cruzada
  (function renderConsistencia() {
    const d = state.raw, tri = state.triRaw, cid = state.cidRaw, proc = state.procRaw;
    const items = [];
    if (tri.length) {
      const triPronts = new Set(tri.map(r => r.pront).filter(Boolean));
      if (!triPronts.size) {
        items.push({ label: 'Histórico ↔ Triagem', status: 'warn', msg: 'planilha de triagem sem coluna de prontuário — cruzamento por paciente indisponível' });
      } else {
        const semMatch = d.filter(r => r.pront && !triPronts.has(r.pront)).length;
        const pctVal = d.length ? (100 - semMatch / d.length * 100).toFixed(1) : 0;
        items.push({ label: 'Histórico ↔ Triagem', status: pctVal >= 95 ? 'ok' : pctVal >= 80 ? 'warn' : 'err', msg: `${pctVal}% dos atendimentos têm triagem correspondente` });
      }
    }
    if (cid.length) {
      const cidDates = new Set(cid.map(r => r.dateKey).filter(Boolean));
      const histDates = new Set(d.map(r => r.dateKey).filter(Boolean));
      const overlap = [...histDates].filter(k => cidDates.has(k)).length;
      const pctVal = histDates.size ? (overlap / histDates.size * 100).toFixed(1) : 0;
      items.push({ label: 'Histórico ↔ CID', status: pctVal >= 90 ? 'ok' : pctVal >= 70 ? 'warn' : 'err', msg: `${pctVal}% dos dias têm CIDs registrados (${fmt(cid.length)} CIDs para ${fmt(d.length)} atend.)` });
    }
    if (proc.length) {
      const procProfs = new Set(proc.map(r => norm(r.prof || '')).filter(Boolean));
      const histProfs = new Set(d.filter(r => r.prof).map(r => norm(r.prof)));
      const matched = [...procProfs].filter(p => histProfs.has(p)).length;
      const pctVal = procProfs.size ? (matched / procProfs.size * 100).toFixed(1) : 0;
      items.push({ label: 'Procedimentos ↔ Histórico', status: pctVal >= 80 ? 'ok' : pctVal >= 60 ? 'warn' : 'err', msg: `${pctVal}% dos profissionais nos procedimentos foram encontrados no histórico` });
    }
    if (!tri.length && !cid.length && !proc.length) {
      items.push({ label: 'Bases secundárias', status: 'warn', msg: 'Nenhuma base secundária carregada. Carregue triagem, CID ou procedimentos para cruzamento.' });
    }
    const el = $('auditConsistencia');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<span style="color:var(--ok)">✓ Não há dados suficientes para cruzamento ainda.</span>'; return; }
    el.innerHTML = items.map(x => {
      const color = x.status === 'ok' ? 'var(--ok)' : x.status === 'warn' ? 'var(--wn)' : 'var(--er)';
      const icon = x.status === 'ok' ? '✓' : x.status === 'warn' ? '⚠' : '✗';
      return `<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:5px"><span style="color:${color};font-weight:700;min-width:16px">${icon}</span><div><span style="color:var(--txt)">${esc(x.label)}</span><span style="color:var(--mut);margin-left:8px">${esc(x.msg)}</span></div></div>`;
    }).join('');
  })();
}
