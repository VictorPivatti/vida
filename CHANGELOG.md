# Changelog — V.I.D.A. Dashboard

Todas as mudanças relevantes são documentadas aqui.  
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Unreleased] — design polish P0–P3

### Alterado

- **P0 — Tipografia:** IBM Plex Mono restrito a números/códigos. Removido de 14 classes (eyebrows, nav, subtítulos, textos de apoio). Adicionado utilitário `.num` com `font-variant-numeric:tabular-nums`. `.k-value` (KPI herói) migrado de Plus Jakarta Sans para Mono.
- **P1 — pt-BR:** `.toFixed()` substituído por `fmtN()` em escala.js, gargalos.js, triagem.js. Operadores `<=`/`>=` trocados por `≤`/`≥` tipográficos em fluxo.js e indicadores.js. Títulos de página em sentence case (`Evasão mensal (%)`, `Auditoria de dados`, `Qualidade dos dados`, `Anotações por período`).
- **P2 — Linhas de meta:** `targetLinePlugin` usa sempre `#9aa6b6` (neutro). Labels de meta em caixa alta (`META ESPERA`, `META VOLUME`, `META TOTAL`, etc.). Label dinâmica de evasão usa `fmtN` para formatação pt-BR.
- **P3 — Emoji:** `🚨⚠️✅` substituídos por SVGs inline (Lucide alert-circle, triangle-alert, circle-check) em gargalos.js. Símbolo `⚠` removido de escala.js (célula já sinalizada por CSS).

---

## [v3.5.1] — 2026-06-29

### Corrigido — Alta prioridade

- **`$` não exposto em `window` (8 handlers quebrados)** — No bundle IIFE, `$` ficava no closure do módulo e não em `window`, causando `ReferenceError` nos botões CTA de empty-state (carregar procedimentos, exames, metas) e no botão de metas. Adicionado `$` ao `Object.assign(window, ...)` em `initGlobals()`
- **`deletarAnotacao` apagava a anotação errada** — A lista renderizava ordenada por data decrescente (`b.k - a.k`) mas `deletarAnotacao(i)` usava o índice da lista não ordenada, causando perda de dado do usuário. Corrigido: ordenação aplicada antes do `splice`
- **Qualidade do Histórico e CID nunca populada** — `workerRun` retornava apenas `{ rows }`, descartando `total`/`invalid` do parser; `state.quality` permanecia vazio. O worker agora propaga os contadores; o path de fallback acumula `total`/`invalid` de `parseHistLegacy`; `loadHist` e `loadCid` fazem `state.quality.push(...)` na main thread. A mensagem "(X de Y válidos)" no toast de carregamento, o chip de qualidade na topbar e o painel Qualidade passam a exibir dados de Histórico e CID

### Corrigido — Prioridade média

- **`triOk` sempre 0 nos agregados mensais** — `monthlyStats` não tinha acesso à meta de triagem e deixava `triOk` zerado. Corrigido: lê `metaTri` do DOM e incrementa por linha, igualando a lógica dos KPIs-card. Gráfico mensal de triagem, tabela de Indicadores e coluna "Triagem na meta (%)" do export Resumo Mensal deixam de exibir 0%
- **Deltas "vs período anterior" desativados em Indicadores, Fluxo e Retornos** — `prev` estava hardcoded como `[]` nos três módulos. Adicionado helper `previousRows()` em cada um (mesmo algoritmo de `geral.js`): filtra `state.raw` pelo período de mesma duração imediatamente anterior, respeitando o filtro de turno ativo
- **`exportXLSX` travava o botão indefinidamente em caso de erro** — O `try/catch` envolvia o `setTimeout` mas não o callback; erros assíncronos (XLSX ausente, arquivo inválido) não eram capturados, `hideLoading()` não era chamado e `#exportBtn` ficava `disabled` permanentemente. `try/catch` e reset do botão movidos para dentro do callback
- **Toast com tipo `'wn'` inexistente** — `loaders/hist.js`, `tri.js` e `proc.js` usavam `'wn'` em vez de `'warn'`; avisos de "layout diferente do esperado" renderizavam sem cor de alerta. Corrigido para `'warn'`
- **Export de médicos — colunas "Atend./plantão D/N" sempre vazias** — `export.js` lia `r.mediaPlantaoD`/`r.mediaPlantaoN`, mas `metrics/med.js` expõe `mediaD`/`mediaN`. Nomes alinhados

### Corrigido — Robustez e LGPD

- **"Continuar de onde parou" não revalidava TTL** — `VidaDB.dataExpired()` era checado apenas na abertura da aba; aba aberta > 12h e clique posterior em "Continuar" restaurava dados já expirados. Re-checagem adicionada no `onclick` do banner com limpeza automática e aviso antes de qualquer carregamento
- **Painel Retornos ≤72h exportado em PDF sem marca d'água** — O painel exibe prontuários de pacientes mas não tinha `confidencial: true`; era exportado sem o banner `⚠ CONFIDENCIAL`. Corrigido (CID já estava marcado desde v3.4.0)
- **`new Chart()` sem guarda de CDN** — `ReferenceError` quando Chart.js não carregava offline; guard `typeof Chart === 'undefined'` adicionado com aviso de console
- **`XLSX.utils.book_new()` sem guarda de CDN** — `ReferenceError` quando XLSX.js não carregava offline; substituído por exceção legível ("Biblioteca XLSX não carregada. Verifique a conexão e recarregue a página.")
- **Race condition no IndexedDB em troca rápida de arquivo** — `VidaDB.clear('atendimentos')` era aguardado na thread principal mas o `bulkPut` era fire-and-forget; dois carregamentos em sequência rápida podiam intercalar `clear`/`bulkPut` do primeiro com o segundo. `clear` movido para dentro do IIFE de persistência — `clear + bulkPut` agora sempre atômicos por chamada
- **`metaManchester(null)` — TypeError** — `cor.charAt(0)` lançava exceção quando `cor` era `null`/`undefined` com `tEspMed` presente. Guard `if (!cor) return 60` adicionado na entrada da função

### Cosmético

- **`state.charts[id]` retinha referência à instância destruída** — `chart()` chamava `destroy()` mas não deletava a chave antes do `return` no caminho `allEmpty`; `destroy()` em instância já destruída é no-op, sem impacto funcional. `delete state.charts[id]` adicionado logo após o `destroy()`

---

## [v3.5.0] — 2026-06-29

### Arquitetura modular (esbuild)

- Monolito `<script>` de ~6000 linhas removido de `src/index.template.html`
- App migrado para ES6 modules em `src/js/` compilados via esbuild
- `npm run build` gera `index.html` bundle-only (366 KB, era 708 KB — −48%)
- Template HTML reduzido de ~7000 para 1092 linhas

### Módulos adicionados

- `src/js/loaders/` — carregadores de arquivo (hist, tri, cid, proc, exames)
- `src/js/filters.js` — `applyFilters`, `setupDates`, `dateRange`
- `src/js/storage/dbstats.js`, `src/js/ui/ttl.js`, `src/js/ui/export.js`

### Testes

- Suite de testes unitários ESM (`.mjs`) para utils, parsers e metrics
- CI: build obrigatório + `git diff --exit-code index.html` para garantir sincronismo

### CI/CD

- `"type": "module"` em `package.json` — sem warnings `MODULE_TYPELESS_PACKAGE_JSON`
- Arquivos CJS renomeados para `.cjs`
- esbuild fixado em versão exata (`0.28.1`)
- Deploy via GitHub Actions para GitHub Pages

---

## [v3.4.0] — 2026-06-28

### Adicionado

- **TTL countdown na topbar** — badge `⏳ Xh YYm` aparece após o carregamento de dados; muda para âmbar (< 2h) e vermelho (< 30min). Clicável: botão "Renovar TTL" redefine o contador por mais 12h; "Apagar agora" abre confirmação de limpeza imediata
- **Sidebar mobile** — botão hamburguer visível em telas ≤ 640px converte a sidebar em overlay fixo com backdrop semitransparente; fecha ao tocar em item de menu ou no backdrop
- **PDF — aba CID / Notificáveis** incluída no export; página marcada com banner `⚠ CONFIDENCIAL — Contém dados nominais de pacientes`
- **PDF — rodapé de privacidade** em todas as páginas: `V.I.D.A. · Uso interno · Não substitui notificação SINAN · Gerado em …`
- **Chips de fonte na topbar** — indicadores visuais `Hist`, `Tri`, `CID`, `Proc`, `Exam` mostram quais arquivos estão carregados (`loaded` = verde, `derived` = âmbar)
- **Wizard de 3 passos** no primeiro carregamento (quando só o histórico está presente): toasts sequenciais sugerindo Triagem → CID → explicando o painel Qualidade
- **Feedback de qualidade no toast de carregamento** — exibe `(X de Y válidos)` quando há linhas ignoradas pelo parser
- **"Continuar de onde parou"** — banner separado do carregamento automático; dados só são restaurados após clique explícito do usuário; banner exibe contagem de registros salvos
- **Testes de parsers** (fase 2) — `tests/parsers.test.js` com 9 casos cobrindo `parseHistLegacy`, `parseTriLegacy`, `parseCidLegacy`, `parseProcedimentosText` e `chooseParsed`; fixtures anonimizadas em `fixtures/`
- **Testes de métricas** (fase 1) — `tests/metrics.test.js` com 11 casos cobrindo `tEspMed`, `returns72`, `monthlyStats`, `dateKey`, `prevVal`, `evasaoDisponivel`

### Corrigido

- **`parseHist` (parser por cabeçalho) ignorava `triagem_atendimento`** — o campo era calculado como `dhAtend − dhAcol` com teto 200 min, descartando silenciosamente esperas entre 200–719 min. Adicionado `tEspMed` ao `ALIAS.hist` e `FALLBACK.hist[18]`; teto corrigido para `CONFIG.MAX_MINUTES` (720), igual ao `parseHistLegacy`

---

## [v3.3.0] — 2026-06-13

### Corrigido — Crítico (afetavam números exibidos)

- **Parser CID: médico e paciente trocados** — o export atual do Vivver traz `nome_paciente` em `p[8]` e `nome_medico` em `p[14]`. O código assumia o inverso (`p[8]`=médico, `p[11]`=paciente), causando nomes de pacientes no ranking de médicos e painel de Notificáveis. Corrigido em `parseCidFromText`, `parseCidLegacy` e `FIELDS.cid`; `parseCidFromText` agora também extrai o campo `paciente`
- **`tEspMed` calculado sobre o campo errado** — o Vivver exporta `triagem_atendimento` (`p[18]`), que mede a espera do fim da triagem até o médico. O código ignorava esse campo e calculava `dhAtend − dhAcol` (acolhimento → médico), incluindo a duração da triagem e inflando a espera em todos os painéis (Indicadores, Fluxo, Gargalos, Manchester, Score executivo, Relatório gerencial, Ano a Ano). Corrigido para usar `p[18]` como fonte primária, com fallback `(dhAtend − dhAcol) − tDurTri`
- **Teto de 200 min em `tEspMed` descartava casos reais** — esperas ≥ 200 min viravam `null` e saíam das médias, subestimando gargalos graves. Teto aumentado para `CONFIG.MAX_MINUTES` (720 min), alinhado com `tTotal`

### Corrigido — Médio (interpretação e consistência)

- **Regras de auditoria Manchester inconsistentes** — c01 (VERMELHO) disparava em `> 30 min` enquanto todo o restante do app usa `> 10 min`; c02 (LARANJA) disparava em `> 60 min` mas a mensagem dizia `≤ 15 min`. Corrigido: c01 → `> 10 min`, c02 → `> 15 min` (alinhados com `MANCHESTER_METAS` e indicadores)
- **"Médico na meta" com duas metas diferentes** — o KPI usava a meta global (`metaMed` = 60 min) enquanto a tabela Manchester e `monthlyStats` usavam `metaManchester(r.cor)` por cor de risco. Um usuário podia ver 78% no KPI e 45% no Manchester para o mesmo período. KPI e período anterior agora usam `metaManchester(r.cor)` em todos os contextos; label atualizado para "meta Manchester por cor"
- **Taxa de retorno ≤72h: metodologia não estava explícita** — a taxa conta eventos de retorno ÷ total de atendimentos (um paciente com 3 retornos conta 3×), mas o texto dizia "dos atendimentos retornaram", sugerindo contagem de pacientes únicos. Alerta e KPI agora explicitam "eventos de retorno ÷ atendimentos"
- **Taxa mensal de retorno ignorava cruzamentos de virada de mês** — `monthReturnRate` filtrava as rows pelo mês antes de buscar retornos, tornando invisível casos como visita 31/mai → retorno 02/jun. Corrigido para usar o cache global `returns72()` (que vê todos os meses) e filtrar apenas os eventos de retorno pelo mês da visita de volta
- **Filtro de data inconsistente entre histórico e triagem** — o histórico filtra por `dateKey` ajustada para plantão noturno (madrugada 00h–06h → dia anterior), mas a triagem filtrava por `dh` real. Na virada do plantão, o mesmo atendimento podia aparecer na triagem mas não no histórico (ou vice-versa), quebrando cruzamentos. Ambos os parsers de triagem (posicional e por cabeçalho) agora calculam `dateKey`/`anoMes`/`diaSem` com a mesma lógica de ajuste; `applyFilters` usa `dateKey` para `triFilt`

### Corrigido — Menor

- **Typo no alias `ipo_entrada`** — listado antes do correto `tipo_entrada` no array de sinônimos; ordem invertida para que o campo correto seja tentado primeiro (fallback posicional preservado)
- **Cache de `returns72()` com chave fraca** — a chave anterior (`length + primeiro_dateKey + último_dateKey`) colide quando dois filtros diferentes produzem o mesmo comprimento e intervalo de datas. Substituída por `_filtVersion`, um contador inteiro incrementado a cada `applyFilters()`

### Melhorado

- **`harness.js` — validações de valores calculados** — o smoke test verificava apenas se os painéis renderizavam sem exceção. Adicionadas 4 asserções de valor: `returns72()` (estrutura e taxa no intervalo 0–100%), `monthlyStats()` (presença dos campos `k`/`vol`/`medOk`/`medN`), thresholds c01/c02 da auditoria Manchester, e valores padrão de `metaManchester` por cor

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
