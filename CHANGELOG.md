# Changelog — V.I.D.A. Dashboard

Todas as mudanças relevantes são documentadas aqui.  
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [v3.2.1] — 2026-06-10

### Adicionado
- **Identificação nominal nas Doenças de Notificação Compulsória**: os parsers de CID (posicional e por cabeçalho) agora extraem o nome do paciente (`nome_paciente`, campo 11 do layout Vivver). Cada card de doença lista os casos com data, horário, nome do paciente, prontuário e CID, do mais recente para o mais antigo (até 4 visíveis; "ver todos" expansível). O checklist de notificação também lista os pacientes nominalmente, viabilizando busca ativa
- **Horário do atendimento enriquecido por cruzamento**: o arquivo de CID do Vivver traz apenas a data; o horário é obtido cruzando prontuário+data com o `dh_atendimento` do histórico carregado. Casos sem correspondência exibem somente a data

### Observação de privacidade
- Os cards e o checklist de notificáveis passam a exibir nomes de pacientes em massa, inclusive nas exportações em PDF. Tratar exportações deste painel com a mesma cautela de fichas SINAN físicas

---

## [v3.2] — 2026-06-10

### Segurança e LGPD
- **Expiração automática de dados (TTL 12h)**: dados de pacientes no IndexedDB expiram 12 horas após a gravação e são removidos na abertura seguinte, com aviso ao usuário. Dados legados sem timestamp são tratados como expirados
- **Aviso de privacidade** exibido no primeiro uso, informando armazenamento local, expiração e recomendação de máquina de acesso restrito
- **Correção XSS** no painel de fórmula dos KPIs (`formula.expr` e linhas de cálculo agora passam por `esc()`)
- **Checagem de dependências CDN**: banner claro quando XLSX.js/Chart.js não carregam (sem internet), em vez de falha silenciosa

### Corrigido
- **Consistência cruzada Histórico ↔ Triagem sempre exibia 0,0%**: os parsers de triagem (posicional e por cabeçalho) não extraíam o prontuário, tornando o cruzamento vazio por construção. Ambos os parsers e `deriveTriFromHist` agora propagam `pront`; validado com bases reais de jan-mai/2026 (resultado: 100,0% de correspondência). Mensagem defensiva quando a planilha não tem coluna de prontuário
- **Crash no painel Auditoria** quando um indicador tinha diferença exata de zero entre "com todos" e "sem suspeitos" (`diffPct` nulo com `diff=0`)
- **Constantes Manchester** (`MANCHESTER_META_IDS`/`MANCHESTER_METAS`) restauradas após remoção acidental durante o enxugamento de painéis

### Adicionado
- **Cruzamento entre fontes** (painel Qualidade): comparação mensal histórico × planilha de triagem × CID, distribuição por cor entre fontes, com limiares de severidade (±2% / ±8%) e detecção de comparação tautológica
- **harness.js**: smoke test headless (jsdom) que executa as 22 funções de render com dados sintéticos — `node harness.js index.html`

### Removido / Reorganizado
- Painéis removidos por redundância ou baixa decisão associada: Capacidade, Comparativo de Períodos (Ano a Ano preservado e movido para Evolução), Correlações, Funil/Sazonalidade, Perfil do Paciente; tabelas de dia da semana em Gargalos (redundantes com o heatmap)
- Retornos: cards de retornos críticos e mesmo-CID movidos para o topo (severidade primeiro); Qualidade: cruzamento em 2ª posição; Procedimentos: rankings BPA com títulos desambiguados por categoria

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
