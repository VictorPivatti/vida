// ui/export.js — exportXLSX and exportMedXlsx: export filtered data to Excel
// XLSX is a CDN global — not imported, used directly as window.XLSX

import { state } from '../state.js';
import { fmt, norm } from '../utils/dom.js';
import { showToast } from './toast.js';
import { showLoading, hideLoading } from './progress.js';
import { medRows } from '../metrics/med.js';
import { monthlyStats } from '../metrics/monthly.js';
import { monthLabel } from '../utils/dates.js';
import { dateRange } from '../filters.js';

export function exportMedXlsx() {
  const rows = medRows();
  if (!rows.length) { showToast('Nenhum dado de médicos para exportar.', 'warn'); return; }
  try {
    const searchEl = document.getElementById('searchMed');
    const q = norm(searchEl ? searchEl.value : '');
    const data = (q ? rows.filter(r => norm(r.prof).includes(q)) : rows)
      .slice().sort((a, b) => (b.pontos ?? 0) - (a.pontos ?? 0));
    const sheet = data.map((r, i) => {
      const amCount = r.risks['AMARELO'] || 0;
      const lvCount = (r.risks['LARANJA'] || 0) + (r.risks['VERMELHO'] || 0);
      return {
        '#': i + 1,
        'Médico': r.prof || '',
        'Total atend.': r.total,
        'Pacientes ≤2 anos': r.le2 ?? 0,
        'Pacientes ≤12 anos': r.le12 ?? 0,
        'Pacientes ≥60 anos': r.ge60 ?? 0,
        'Pacientes ≥80 anos': r.ge80 ?? 0,
        'Amarelo': amCount,
        'Laranja+Vermelho': lvCount,
        'Pontos': r.pontos ?? 0,
        'Plantões diurnos': r.plantD,
        'Plantões noturnos': r.plantN,
        'Plantões total': r.plantTotal,
        'Atend./plantão': r.mediaPlantao ?? '',
        'Atend./plantão D': r.mediaPlantaoD ?? '',
        'Atend./plantão N': r.mediaPlantaoN ?? '',
        'Espera médico (min)': r.medAvg != null ? Math.round(r.medAvg) : '',
        'Espera triagem (min)': r.triAvg != null ? Math.round(r.triAvg) : '',
        'Tempo total (min)': r.totAvg != null ? Math.round(r.totAvg) : '',
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), 'Médicos');
    const dr = dateRange();
    const sStr = dr.s ? dr.s.toLocaleDateString('pt-BR').replace(/\//g, '-') : 'inicio';
    const eStr = dr.e ? dr.e.toLocaleDateString('pt-BR').replace(/\//g, '-') : 'fim';
    XLSX.writeFile(wb, `VIDA_medicos_${sStr}_a_${eStr}.xlsx`);
    showToast(`Ranking exportado: ${data.length} médico(s).`, 'ok');
  } catch (err) { showToast('Erro ao exportar: ' + err.message, 'err'); }
}

export function exportXLSX() {
  if (!state.filt.length) { showToast('Nenhum dado filtrado para exportar.', 'warn'); return; }
  const _expBtn = document.getElementById('exportBtn');
  if (_expBtn) { _expBtn.disabled = true; _expBtn.style.opacity = '.5'; _expBtn.style.cursor = 'wait'; }
  try {
    showLoading('Gerando planilha...');
    setTimeout(() => {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Atendimentos filtrados
      const histData = state.filt.map(r => ({
        'Data/Hora': r.dh ? r.dh.toLocaleString('pt-BR') : '',
        'Prontuário': r.pront || '',
        'Classificação': r.cor || '',
        'Médico': r.prof || '',
        'Tipo Entrada': r.tipo || '',
        'Idade': r.idade != null ? r.idade : '',
        'Turno': r.turno || '',
        'Espera Triagem (min)': r.tEspTri != null ? Math.round(r.tEspTri) : '',
        'Espera Médico (min)': r.tEspMed != null ? Math.round(r.tEspMed) : '',
        'Tempo Consulta (min)': r.tConsulta != null ? Math.round(r.tConsulta) : '',
        'Tempo Total (min)': r.tTotal != null ? Math.round(r.tTotal) : '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histData), 'Atendimentos');

      // Sheet 2: CID se disponível
      if (state.cidFilt.length) {
        const cidData = state.cidFilt.map(r => ({
          'Data': r.dh ? r.dh.toLocaleDateString('pt-BR') : '',
          'CID': r.cid || '',
          'Descrição': r.desc || '',
          'Médico': r.medico || '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cidData), 'CID');
      }

      // Sheet 3: Resumo mensal
      {
        const ms = monthlyStats(state.filt);
        const resumo = ms.map(m => ({
          'Mês': monthLabel(m.k),
          'Volume': m.vol,
          'Triagem média (min)': m.triAvg != null ? Math.round(m.triAvg) : '',
          'Triagem na meta (%)': m.triN ? +(m.triOk / m.triN * 100).toFixed(1) : '',
          'Espera médico média (min)': m.medAvg != null ? Math.round(m.medAvg) : '',
          'Tempo total médio (min)': m.totAvg != null ? Math.round(m.totAvg) : '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo Mensal');
      }

      const dr = dateRange();
      const fileName = `UPA_dados_${dr.s ? dr.s.toLocaleDateString('pt-BR').replace(/\//g, '-') : 'inicio'}_a_${dr.e ? dr.e.toLocaleDateString('pt-BR').replace(/\//g, '-') : 'fim'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      hideLoading();
      if (_expBtn) { _expBtn.disabled = false; _expBtn.style.opacity = ''; _expBtn.style.cursor = ''; }
      showToast(`Planilha exportada com ${state.filt.length.toLocaleString('pt-BR')} atendimentos.`, 'ok');
    }, 50);
  } catch (err) {
    hideLoading();
    if (_expBtn) { _expBtn.disabled = false; _expBtn.style.opacity = ''; _expBtn.style.cursor = ''; }
    showToast('Erro ao exportar: ' + err.message, 'err');
  }
}
