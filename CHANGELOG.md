# Changelog — V.I.D.A. Dashboard

Todas as mudanças relevantes são documentadas aqui.  
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [v3.0] — 2026-06-01

### Corrigido
- **Tela inicial reformulada (v3.0 rebranding)**: layout split removido; nova tela centralizada fullscreen com marca V.I.D.A. no topo, título em gradiente violeta, zona de drop única (histórico de atendimentos), toggle de tema compacto, versão discreta no canto inferior direito e botão "configurar unidade" no canto inferior esquerdo. Inputs secundários de Triagem e CID preservados ocultos para JS funcionar normalmente
- **[B1] Indicador "Retorno ≤72h × mesmo CID"** agora usa `state.cidFilt` (respeitando filtros de data e turno ativos) em vez de `state.cidRaw` bruto. Fallback automático para `cidRaw` quando nenhum filtro de período está aplicado
- **[B2] Sort redundante em `renderMedTable`** removido — `medRows()` já entrega os dados ordenados por volume; o segundo `.sort()` idêntico era desnecessário e levemente custoso com muitos médicos
- **[B3] Badge de versão** atualizado de `v2.5` para `v3.0`
- **[M5] Typos de acentuação** na nota de projeção da aba Evolução: `"mes decorrido - projecao linear simples, nao considera"` corrigido para `"mês decorrido — projeção linear simples, não considera"`

### Auditoria completa realizada
- 7.437 linhas analisadas; 57 pares `chart()` ↔ `<canvas>` verificados — sem discrepâncias
- Todos os 22 tabs cobertos em `renderActivePane` — sem tab órfão
- Todas as funções utilitárias core confirmadas: `norm`, `fmt`, `pct`, `avg`, `percentile`, `esc`, `meta`, `ymd`, `shortName`, `monthLabel`
- `state` inicializado corretamente; guards em `renderProcedimentos` e `renderExames` validados
- `renderConsistencia` como IIFE dentro de `renderQuality` — intencional e correto

---

## [v2.5] — 2026-05-30

### Adicionado
- **Aba Produtividade Assistencial** completamente redesenhada com estrutura baseada no Relatório de Produtividade Assistencial:
  - Resumo executivo por categoria (médicos, enfermeiros, técnicos) com tabela comparativa
  - Seção Equipe Médica: ranking BPA, gráfico de perfil por tipo (consulta/ECG/radiologia), tabela com breakdown por procedimento e barra visual
  - Seção Enfermeiros: ranking, triagens destacadas, perfil EV/IM/VO
  - Seção Técnicos de Enfermagem: ranking, vias de administração (EV/IM/VO/SC/nebulização)
  - Classificação automática de profissionais (`catOf`) e procedimentos (`procTipo`) por palavras-chave
- **Modo de edição de layout**: botão ⊞ na topbar permite arrastar cards para reordenar e redimensionar (4 tamanhos: ½, ▬, ▬▬, ━). Layout salvo no localStorage
- **Sazonalidade redesenhada**: gráfico de linhas (volume médio por dia da semana, uma linha por mês) + heatmap compacto com células de tamanho fixo e cor normalizada por mês
- **Detalhamento de penalidades no score executivo**: seção expansível `<details>` com cada penalidade aplicada, valor em pontos e fórmula
- **Badge de contagem no filtro de médico**: mostra "X reg." ao lado do campo quando filtro está ativo

### Corrigido
- `renderEscala`: variável `rows` trocada por `byH` (ReferenceError silencioso deixava gráficos e tabela em branco)
- Retornos ≤72h: `allByMed` usava `r.prof` raw enquanto `retByMed` usava `norm(r.prof)` → taxa sempre nula
- `returnsFor`: adicionado filtro de prontuários vazios/zeros (paridade com `returnsWithin`)
- `medRows`: chave do mapa sem `norm()` → médicos com variação de encoding geravam duplicatas no ranking
- `renderPacientes`: função chamava `renderAnotLista()` em vez de `renderTopRetornos()`
- `renderGeral`: contagem de médicos sem `norm()` podia inflar o número
- `manchesterConformidade`: `colspan=8` mas tabela com 7 colunas
- `_rows` em `medRows`: usava `shortName()` em vez de `norm()` → inconsistência com chave do mapa
- `populateMedicoFilter`: dedup com `norm()` restaurado após regressão
- Header topbar: `V. I. D. A.v2.0` com espaços substituído por `V.I.D.A.` limpo com badge `v2.5`
- Sidebar: logo e nome removidos (redundantes com topbar), largura reduzida 244→204px, gradiente removido
- `vMesesKeys` no `chartVermelhoMes`: `monthLabel()` recebia string ISO `"2026-01"` em vez de número `202601` → exibia `undefined/N`
- CSS `nth-child` nos retornos atualizado para refletir novo layout com `tableRetMed` full-width
- `parseProc`/`parseProcedimentosText`: detecção automática de offset de coluna extra no export do Vivver
- `retByMed`: chave inconsistente entre criação (`retProfKey`) e acesso (`r.prof`)

### Removido
- `renderAll_FULL_UNUSED`: dead code removido
- `r7 = ret.concat([])`: variável inútil (cópia idêntica de `ret`)

---

## [v2.0] — 2026-05-29

### Adicionado
- **Novos painéis**: Funil e Sazonalidade, Comparativo de Períodos, Correlações, Escala/Dimensionamento, Perfil do Paciente, Pacientes, Anotações
- **Score executivo** com gauge visual, zonas (Crítico/Atenção/Excelente) e metodologia de penalidades
- **Conformidade Manchester**: tabela com cobertura do dado, breakdown Diurno/Noturno, % conformidade por classificação
- **Comparativo por dia da semana** no painel Gargalos (gráfico de barras duplas + tabela)
- **Data do pico** na tabela de Capacidade (ex: "340% em 28/04")
- **Cache** em `returnsWithin` para evitar recalculo desnecessário
- **Auditoria cruzada** entre bases (histórico × triagem × CID × procedimentos) no painel Qualidade
- Botão de tema na tela de upload com persistência entre sessões

### Corrigido
- KPIs de Gargalos: usavam média de slot (diluída) em vez de pico real individual
- `renderCapacidade`: acumulava todos os médicos históricos de um horário num único Set → pressão subavaliada em períodos longos. Corrigido para slots diários reais
- `buildReportText`: descrevia gargalo com média de slot em vez de pico real
- `manchesterConformidade`: `semDado` não era rastreado → cobertura sempre 100%
- `populateMedicoFilter`: adicionado dedup por `norm(r.prof)` antes de gerar datalist
- `returnsFor`: adicionado filtro de prontuários vazios/zeros
- Aba Procedimentos: parser com offset automático para coluna sequencial do Vivver
- Tabela Manchester: preenchida (função `manchesterConformidade` existia mas nunca era chamada)

---

## [v1.0] — 2026-05-23

### Adicionado
- Dashboard single-file HTML com processamento local
- Painéis: Visão Geral, Indicadores, Fluxo, Gargalos, Médicos, Triagem, Retornos ≤72h, Capacidade, Evolução, CID/Diagnósticos, Relatório, Auditoria, Qualidade
- Parsing automático de arquivos `.xlsx`/`.xls`/`.csv` do sistema Vivver
- Suporte a múltiplas bases de dados (histórico + triagem + CID)
- Score executivo, filtros de período/turno/médico/risco
- Exportação PDF e XLSX
- Modo claro/escuro

---
