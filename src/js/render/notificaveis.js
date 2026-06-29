// render/notificaveis.js — Notificaveis CID rendering
import { state } from '../state.js';
import { $, esc, fmt } from '../utils/dom.js';

export const DOENCAS_NOTIFICAVEIS = {
  'Sarampo':                  { cids: ['B05', 'B050', 'B051', 'B052', 'B053', 'B054', 'B058', 'B059'], grupo: 'Imunoprevenível' },
  'Rubéola':                  { cids: ['B06', 'B060', 'B068', 'B069', 'P350'], grupo: 'Imunoprevenível' },
  'Coqueluche':               { cids: ['A37', 'A370', 'A371', 'A378', 'A379'], grupo: 'Imunoprevenível' },
  'Difteria':                 { cids: ['A36', 'A360', 'A361', 'A362', 'A363', 'A368', 'A369'], grupo: 'Imunoprevenível' },
  'Tétano neonatal':          { cids: ['A33'], grupo: 'Imunoprevenível' },
  'Tétano acidental':         { cids: ['A35'], grupo: 'Imunoprevenível' },
  'Poliomielite':             { cids: ['A80', 'A800', 'A801', 'A802', 'A803', 'A809'], grupo: 'Imunoprevenível' },
  'Varíola':                  { cids: ['B03'], grupo: 'Imunoprevenível' },
  'Febre Amarela':            { cids: ['A95', 'A950', 'A951', 'A959'], grupo: 'Imunoprevenível' },
  'Meningite Meningocócica':  { cids: ['A39', 'A390', 'A391', 'A392', 'A393', 'A394', 'A395', 'A398', 'A399'], grupo: 'Neurológica' },
  'Meningite (outras)':       { cids: ['G00', 'G001', 'G002', 'G003', 'G008', 'G009', 'G01', 'G02', 'G03', 'G030', 'G031', 'G032', 'G038', 'G039'], grupo: 'Neurológica' },
  'Dengue':                   { cids: ['A90', 'A91', 'A97', 'A970', 'A971', 'A972'], grupo: 'Arbovirose' },
  'Zika':                     { cids: ['A928'], grupo: 'Arbovirose' },
  'Chikungunya':              { cids: ['A929'], grupo: 'Arbovirose' },
  'Febre do Nilo Ocidental':  { cids: ['A923'], grupo: 'Arbovirose' },
  'Malária':                  { cids: ['B50', 'B51', 'B52', 'B53', 'B54'], grupo: 'Parasitária' },
  'Influenza (grave)':        { cids: ['J09', 'J10', 'J100', 'J101', 'J108', 'J11', 'J110', 'J111', 'J118'], grupo: 'Respiratória' },
  'COVID-19':                 { cids: ['U07', 'U071', 'U072', 'U099', 'U109'], grupo: 'Respiratória' },
  'SRAG':                     { cids: ['J22', 'J80', 'J96', 'J960', 'J961', 'J969'], grupo: 'Respiratória' },
  'Tuberculose':              { cids: ['A15', 'A16', 'A17', 'A18', 'A19'], grupo: 'Respiratória' },
  'Hanseníase':               { cids: ['A30', 'A300', 'A301', 'A302', 'A303', 'A304', 'A305', 'A308', 'A309'], grupo: 'Respiratória' },
  'Cólera':                   { cids: ['A00', 'A000', 'A001', 'A009'], grupo: 'Entérica' },
  'Febre Tifoide':            { cids: ['A01', 'A010', 'A011', 'A012', 'A013', 'A014'], grupo: 'Entérica' },
  'Hepatite A':               { cids: ['B15', 'B150', 'B159'], grupo: 'Hepatite' },
  'Hepatite B':               { cids: ['B16', 'B160', 'B161', 'B162', 'B169', 'B180', 'B181'], grupo: 'Hepatite' },
  'Hepatite C':               { cids: ['B17', 'B171', 'B182'], grupo: 'Hepatite' },
  'Hepatite D':               { cids: ['B172', 'B183'], grupo: 'Hepatite' },
  'Hepatite E':               { cids: ['B172'], grupo: 'Hepatite' },
  'Botulismo':                { cids: ['A05', 'A050'], grupo: 'Entérica' },
  'Intoxicação Exógena':      { cids: ['T36', 'T37', 'T38', 'T39', 'T40', 'T41', 'T42', 'T43', 'T44', 'T45', 'T46', 'T47', 'T48', 'T49', 'T50', 'T51', 'T52', 'T53', 'T54', 'T55', 'T56', 'T57', 'T58', 'T59', 'T60', 'T61', 'T62', 'T63', 'T64', 'T65'], grupo: 'Intoxicação' },
  'Leishmaniose Visceral':    { cids: ['B55', 'B550'], grupo: 'Zoonose' },
  'Leishmaniose Tegumentar':  { cids: ['B55', 'B551', 'B552'], grupo: 'Zoonose' },
  'Esquistossomose':          { cids: ['B65', 'B650', 'B651', 'B652', 'B653', 'B658', 'B659'], grupo: 'Parasitária' },
  'Doença de Chagas (aguda)': { cids: ['B57', 'B570', 'B571'], grupo: 'Parasitária' },
  'Raiva Humana':             { cids: ['A82', 'A820', 'A821', 'A829'], grupo: 'Zoonose' },
  'Leptospirose':             { cids: ['A27', 'A270', 'A278', 'A279'], grupo: 'Zoonose' },
  'Hantavirose':              { cids: ['A98', 'A984'], grupo: 'Zoonose' },
  'HIV/AIDS':                 { cids: ['B20', 'B21', 'B22', 'B23', 'B24', 'Z21'], grupo: 'IST' },
  'Sífilis adquirida':        { cids: ['A51', 'A52', 'A53'], grupo: 'IST' },
  'Sífilis em gestante':      { cids: ['A50', 'A51', 'A52', 'A53'], grupo: 'IST' },
  'Sífilis congênita':        { cids: ['A50', 'A500', 'A501', 'A502', 'A503', 'A504', 'A505', 'A506', 'A507'], grupo: 'IST' },
  'Gonorreia':                { cids: ['A54', 'A540', 'A541', 'A542', 'A543', 'A544', 'A545', 'A546', 'A548', 'A549'], grupo: 'IST' },
  'Acidente por animal peçonhento': { cids: ['T63', 'T630', 'T631', 'T632', 'T633', 'T634', 'T638', 'T639', 'X20', 'X21', 'X22', 'X23', 'X24', 'X25', 'X26', 'X27', 'X28', 'X29'], grupo: 'Acidente' },
  'Violência doméstica/sexual': { cids: ['T74', 'T740', 'T741', 'T742', 'T743', 'T748', 'T749', 'Y05', 'Y06', 'Y07'], grupo: 'Violência' },
  'Tentativa de suicídio':    { cids: ['X60', 'X61', 'X62', 'X63', 'X64', 'X65', 'X66', 'X67', 'X68', 'X69', 'X70', 'X71', 'X72', 'X73', 'X74', 'X75', 'X76', 'X77', 'X78', 'X79', 'X80', 'X81', 'X82', 'X83', 'X84'], grupo: 'Violência' },
};

let _notifGrupoAtivo = 'Todos';
export function setNotifGrupo(grupo) { _notifGrupoAtivo = grupo; }

export function renderNotificaveis() {
  const d = state.cidFilt;
  if (!d || !d.length) {
    const note = document.getElementById('notifPrazoNote');
    if (note) note.innerHTML = 'Carregue dados de CID para verificar doenças notificáveis.';
    return;
  }
  const periodo = document.getElementById('notifPeriodo')?.value || 'all';
  let dados = d;
  if (periodo === 'last') {
    const meses = [...new Set(d.map(r => r.anoMes).filter(Boolean))].sort();
    const ultimo = meses[meses.length - 1];
    dados = d.filter(r => r.anoMes === ultimo);
  }
  const hoje = new Date();
  const seteDias = new Date(hoje); seteDias.setDate(seteDias.getDate() - 7);
  const horaIdx = {};
  (state.raw || []).forEach(r => {
    if (!r.pront || !r.dateKey) return;
    const k = r.pront + '|' + r.dateKey;
    const dt = r.dhAtend || r.dh;
    if (dt && !(k in horaIdx)) horaIdx[k] = ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2);
  });
  const resultados = [];
  let totalCasos = 0, totalPacientes = new Set(), totalUltSemana = 0;
  Object.entries(DOENCAS_NOTIFICAVEIS).forEach(([nome, { cids, grupo }]) => {
    const matches = dados.filter(r => { const c = (r.cid || '').toUpperCase(); return cids.some(prefix => c === prefix || c.startsWith(prefix)); });
    if (!matches.length) { resultados.push({ nome, grupo, cids, count: 0, pacientes: [], ultSemana: 0, meses: {} }); return; }
    const meses = {};
    matches.forEach(r => { const m = r.anoMes || r.dateKey?.substring(0, 7) || '?'; meses[m] = (meses[m] || 0) + 1; if (r.idAtend) totalPacientes.add(r.idAtend); });
    const ultSemana = matches.filter(r => { if (!r.dh && !r.dateKey) return false; const dt = r.dh || (r.dateKey ? new Date(r.dateKey) : null); return dt && dt >= seteDias; }).length;
    const cidsEncontrados = [...new Set(matches.map(r => r.cid))];
    const medicos = [...new Set(matches.map(r => r.medico).filter(Boolean))];
    resultados.push({
      nome, grupo, cids, cidsEncontrados,
      count: matches.length, pacientes: [...new Set(matches.map(r => r.idAtend || r.desc))],
      ultSemana, meses, medicos,
      detalhes: matches.slice().sort((a, b) => (b.dh || 0) - (a.dh || 0)).map(r => {
        let hora = '';
        if (r.dh && (r.dh.getHours() || r.dh.getMinutes())) hora = ('0' + r.dh.getHours()).slice(-2) + ':' + ('0' + r.dh.getMinutes()).slice(-2);
        else if (r.idAtend && r.dateKey) hora = horaIdx[r.idAtend + '|' + r.dateKey] || '';
        return { cid: r.cid, desc: r.desc, data: r.dateKey || r.anoMes || '?', hora, medico: r.medico || '?', pront: r.idAtend || '', paciente: r.paciente || '' };
      })
    });
    totalCasos += matches.length;
    totalUltSemana += ultSemana;
  });
  const comCasos = resultados.filter(r => r.count > 0);
  const summaryBar = document.getElementById('notifSummaryBar');
  if (summaryBar) summaryBar.style.display = 'flex';
  const el1 = document.getElementById('notifTotalCasos'); if (el1) el1.textContent = fmt(totalCasos);
  const el2 = document.getElementById('notifTotalDoencas'); if (el2) el2.textContent = fmt(comCasos.length);
  const el3 = document.getElementById('notifTotalPacientes'); if (el3) el3.textContent = fmt(totalPacientes.size);
  const el4 = document.getElementById('notifUltimaSemana'); if (el4) el4.textContent = fmt(totalUltSemana);
  const note = document.getElementById('notifPrazoNote');
  if (note) {
    if (totalCasos === 0) {
      note.innerHTML = 'Nenhum diagnóstico compatível com doenças notificáveis encontrado no período. Verifique se os dados de CID estão carregados.';
    } else {
      note.innerHTML = `<strong>Prazo padrão da UPA: 24h</strong> para envio à Secretaria Municipal de Saúde. Os diagnósticos abaixo são <strong>suspeitos</strong> — confirme com o médico se a ficha foi preenchida. O sistema não acessa fichas SINAN nem confirma notificação realizada.`;
    }
  }
  const grupos = ['Todos', ...new Set(Object.values(DOENCAS_NOTIFICAVEIS).map(d => d.grupo))];
  const filtersEl = document.getElementById('notifGrupoFilters');
  if (filtersEl) {
    filtersEl.innerHTML = grupos.map(g => {
      const countG = g === 'Todos' ? comCasos.length : comCasos.filter(r => r.grupo === g).length;
      const badge = countG > 0 ? ` <span style="font-size:10px;font-weight:700;background:var(--wn);color:#fff;border-radius:99px;padding:1px 5px;margin-left:3px">${countG}</span>` : '';
      return `<button type="button" class="notif-filter-btn${g === _notifGrupoAtivo ? ' active' : ''}" onclick="filterNotifGrupo('${g}',this)">${esc(g)}${badge}</button>`;
    }).join('');
  }
  window._lastNotifResultados = resultados;
  renderNotifGrid(resultados);
}

export function renderNotifGrid(resultados) {
  const el = document.getElementById('notifGrid');
  if (!el) return;
  const filtered = _notifGrupoAtivo === 'Todos' ? resultados : resultados.filter(r => r.grupo === _notifGrupoAtivo);
  const comCasos = filtered.filter(r => r.count > 0).sort((a, b) => b.count - a.count);
  if (!comCasos.length) { el.innerHTML = '<div class="trend-empty-alert">Nenhum diagnóstico notificável encontrado no período selecionado.</div>'; return; }
  const cards = comCasos.map(r => {
    const mKeys = Object.keys(r.meses).sort().slice(-6);
    const mVals = mKeys.map(k => r.meses[k] || 0);
    const mMax = Math.max(...mVals, 1);
    const sparkBars = mVals.map((v, i) => { const h = Math.round((v / mMax) * 24) + 3; const isLast = i === mVals.length - 1; return `<div style="flex:1;height:${h}px;background:${isLast ? 'var(--wn)' : 'var(--bdr2)'};border-radius:2px 2px 0 0;min-height:3px"></div>`; }).join('');
    let trendHtml = '';
    if (mVals.length >= 2) { const prev = mVals[mVals.length - 2], last = mVals[mVals.length - 1]; if (last > prev) trendHtml = `<span class="notif-trend up">↑ ${last - prev} em relação ao mês anterior</span>`; else if (last < prev) trendHtml = `<span class="notif-trend down">↓ ${prev - last} em relação ao mês anterior</span>`; else trendHtml = `<span class="notif-trend stable">estável no mês anterior</span>`; }
    const cidsShow = (r.cidsEncontrados || []).slice(0, 5);
    const cidsHtml = cidsShow.map(c => `<span title="${esc(c)}">${esc(c)}</span>`).join('') + (r.cidsEncontrados?.length > 5 ? `<span style="color:var(--mut)">+${r.cidsEncontrados.length - 5}</span>` : '');
    return `<div class="notif-card" role="article" aria-label="${esc(r.nome)}: ${r.count} casos">
      <div class="notif-card-header">
        <div class="notif-count">${r.count}</div>
        <div class="notif-name">${esc(r.nome)}</div>
        <div class="notif-grupo">${esc(r.grupo)}</div>
      </div>
      ${cidsHtml ? `<div class="notif-cids">${cidsHtml}</div>` : ''}
      <div style="display:flex;align-items:flex-end;gap:2px;height:28px">${sparkBars}</div>
      ${trendHtml}
      ${r.ultSemana > 0 ? `<div class="notif-patients" style="color:var(--wn)">⚠ ${r.ultSemana} caso${r.ultSemana > 1 ? 's' : ''} nos últimos 7 dias</div>` : ''}
      ${r.medicos?.length ? `<div class="notif-patients">Médico${r.medicos.length > 1 ? 's' : ''}: ${r.medicos.slice(0, 2).map(m => esc(m.split(' ')[0])).join(', ')}${r.medicos.length > 2 ? ` +${r.medicos.length - 2}` : ''}</div>` : ''}
      ${r.detalhes?.length ? `<div class="notif-casos" style="margin-top:8px;border-top:1px solid var(--bdr);padding-top:6px">
        ${r.detalhes.slice(0, 4).map(c => `<div class="mono" style="font-size:10px;line-height:1.7;color:var(--txt2)">${esc(c.data)}${c.hora ? ` ${esc(c.hora)}` : ''} · <strong style="color:var(--txt)">${esc(c.paciente || '(sem nome no arquivo)')}</strong>${c.pront ? ` · pront. ${esc(c.pront)}` : ''} · ${esc(c.cid)}</div>`).join('')}
        ${r.detalhes.length > 4 ? `<details style="margin-top:2px"><summary class="mono" style="font-size:10px;color:var(--ac);cursor:pointer">ver todos os ${r.detalhes.length} casos</summary>${r.detalhes.slice(4).map(c => `<div class="mono" style="font-size:10px;line-height:1.7;color:var(--txt2)">${esc(c.data)}${c.hora ? ` ${esc(c.hora)}` : ''} · <strong style="color:var(--txt)">${esc(c.paciente || '(sem nome no arquivo)')}</strong>${c.pront ? ` · pront. ${esc(c.pront)}` : ''} · ${esc(c.cid)}</div>`).join('')}</details>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');
  el.innerHTML = cards || '<div class="trend-empty-alert">Nenhum diagnóstico notificável encontrado no período selecionado.</div>';
}
