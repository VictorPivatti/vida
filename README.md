# V.I.D.A. — Visualização Integrada de Dados Assistenciais

**v2.5** · UPA 24h Tiago Cardoso dos Santos · CNES 7061838 · Mateus Leme – MG

> Dashboard assistencial de arquivo único para análise de produção, qualidade e gestão de UPA 24h. Desenvolvido e mantido pelo Coordenador Assistencial / ENF RT Victor Matheus Sanches Pivatti (COREN-MG 708057).

🔗 **[Acessar o dashboard](https://victorpivatti.github.io/vidadashboard/Pivatti_Dashboard.html)**

---

## Sumário

1. [O que é](#1-o-que-é)
2. [Como acessar](#2-como-acessar)
3. [Bases de dados](#3-bases-de-dados)
4. [Painéis disponíveis](#4-painéis-disponíveis)
5. [Manual de uso passo a passo](#5-manual-de-uso-passo-a-passo)
6. [Dicas e atalhos](#6-dicas-e-atalhos)
7. [Perguntas frequentes](#7-perguntas-frequentes)
8. [Versões](#8-versões)

---

## 1. O que é

O V.I.D.A. é uma ferramenta de análise assistencial de **arquivo único** (HTML) que roda diretamente no navegador, sem instalação, sem servidor e sem envio de dados para a internet. Todo o processamento é feito localmente.

**Principais capacidades:**

- Análise de tempo de espera (triagem, médico, total)
- Ranking e produtividade por médico e equipe de enfermagem
- Conformidade com o Protocolo Manchester por classificação de risco
- Retornos precoces ≤72h com identificação de casos críticos
- Capacidade instalada vs. demanda por hora
- CID / diagnósticos mais frequentes e com maior recidiva
- Procedimentos realizados por profissional (BPA individualizado)
- Auditoria e qualidade dos dados
- Relatório exportável em PDF e XLSX

---

## 2. Como acessar

### Opção A — GitHub Pages (recomendado)

Acesse diretamente pelo navegador:

```
https://victorpivatti.github.io/vidadashboard/Pivatti_Dashboard.html
```

Funciona em qualquer dispositivo com Chrome, Edge, Firefox ou Safari atualizado.

### Opção B — Arquivo local

1. Baixe o arquivo `Pivatti_Dashboard.html` deste repositório
2. Abra diretamente no navegador (duplo clique ou arrastar para o Chrome)
3. Nenhuma instalação necessária

> **Atenção Safari / iOS:** o Safari bloqueia leitura de arquivos locais por segurança. Use a versão online (GitHub Pages) ou Chrome/Edge.

---

## 3. Bases de dados

O dashboard aceita até **4 arquivos de dados**. Todos são carregados na sessão e processados localmente.

### 3.1 Histórico de atendimentos *(obrigatório)*

**Formato:** `.xlsx` ou `.xls` exportado pelo Vivver  
**Relatório no sistema:** *Tempo Médio de Atendimento* ou equivalente  
**Campos utilizados:** prontuário, data/hora de recepção, triagem, atendimento, alta, profissional, classificação de risco, idade, tipo de entrada

```
Exemplo de nome: tempo_medio_2026.xlsx
```

Este é o arquivo principal. Sem ele, o dashboard não exibe dados.

---

### 3.2 Planilha de triagem *(opcional, recomendado)*

**Formato:** `.xlsx` exportado pelo Vivver  
**Relatório no sistema:** *Tempo Médio de Triagem* ou *Acolhimento com Classificação de Risco*  
**Campos extras:** nome do triador, duração da triagem

```
Exemplo de nome: TEMPO_MEDIO_TRIAGEM_2026.xlsx
```

Sem este arquivo, os dados de triagem são derivados do histórico (menos precisos). O painel **Triagem** mostra um aviso quando está operando em modo derivado.

---

### 3.3 CID / Diagnósticos *(opcional)*

**Formato:** `.xls` exportado pelo Vivver  
**Relatório no sistema:** *Atendimento por CID*  
**Campos utilizados:** código CID, descrição, prontuário, data

```
Exemplo de nome: ATENDIMENTOPORCID_23_05_2026.xls
```

Habilita o painel **CID / Diagnósticos** e o cruzamento de retornos com diagnósticos nas **Correlações**.

---

### 3.4 Procedimentos por profissional *(opcional)*

**Formato:** `.xls` exportado pelo Vivver  
**Relatório no sistema:** *Procedimentos Realizados por Profissional*  
**Campos utilizados:** profissional, especialidade, procedimento, código, quantidade

```
Exemplo de nome: PROCEDIMENTOSREALIZADOSPORPROFISSIONAL_29_05_2026.xls
```

Habilita o painel **Produtividade Assistencial** com breakdown por médicos, enfermeiros e técnicos.

> **Nota:** Este relatório é exportado pelo Vivver com uma coluna sequencial extra antes do cabeçalho. O dashboard detecta e corrige esse deslocamento automaticamente.

---

## 4. Painéis disponíveis

### Operação

| Painel | O que mostra | Dados necessários |
|--------|-------------|-------------------|
| **Visão geral** | Score executivo, KPIs principais, volume mensal, mapa de calor | Histórico |
| **Indicadores** | Conformidade com metas de tempo, gráficos mensais, Manchester por risco | Histórico |
| **Fluxo** | Tempos médios por etapa, distribuição de risco, turno | Histórico |
| **Gargalos** | Horários críticos, pico de espera, ranking por dia/hora, comparativo semanal | Histórico |

### Equipe

| Painel | O que mostra | Dados necessários |
|--------|-------------|-------------------|
| **Médicos** | Ranking de produção, pontos, perfil de risco por médico | Histórico |
| **Triagem** | Produtividade por triador, distribuição de risco, taxa de evasão | Histórico + Triagem |
| **Procedimentos** | Produtividade BPA por categoria (médicos / enfermeiros / técnicos) | Procedimentos |
| **Retornos ≤72h** | Taxa de retorno, casos críticos, pacientes frequentes, médicos | Histórico |

### Análise

| Painel | O que mostra | Dados necessários |
|--------|-------------|-------------------|
| **Capacidade** | Pressão por hora vs. capacidade instalada, pico por data | Histórico |
| **Evolução** | Tendência mensal de indicadores, projeção | Histórico |
| **CID / Diagnósticos** | Ranking de diagnósticos, capítulos CID | CID |
| **Relatório** | Texto gerencial exportável | Histórico |
| **Comparativo** | Período A vs. Período B | Histórico |
| **Correlações** | Espera × risco, volume × espera, CID × retorno | Histórico + CID |
| **Funil** | Completude do fluxo, sazonalidade, evasão estimada | Histórico |

### Pacientes & Escala

| Painel | O que mostra | Dados necessários |
|--------|-------------|-------------------|
| **Perfil do Paciente** | Faixa etária, sexo, tipo de entrada | Histórico |
| **Pacientes** | Busca por prontuário, histórico individual | Histórico |
| **Escala / Dimensionamento** | Déficit/superávit por hora, base COFEN 543/2017 | Histórico |
| **Anotações** | Registro de observações por período | — |

### Sistema

| Painel | O que mostra |
|--------|-------------|
| **Auditoria** | Inconsistências nos dados, campos faltantes, regras de negócio |
| **Qualidade** | Score de qualidade dos dados, cobertura de campos |

---

## 5. Manual de uso passo a passo

### Passo 1 — Exportar os arquivos do Vivver

No sistema Vivver, exporte os relatórios desejados para a pasta de downloads. Os arquivos geralmente têm extensão `.xls` mesmo sendo CSVs com separador `;` — o dashboard lida com isso automaticamente.

### Passo 2 — Abrir o dashboard

Acesse `https://victorpivatti.github.io/vidadashboard/Pivatti_Dashboard.html` no Chrome ou Edge.

### Passo 3 — Carregar o histórico principal

Na tela inicial, clique em **"Selecionar arquivo de histórico"** e carregue o arquivo de tempo médio de atendimento. O dashboard processa os dados e exibe a tela principal automaticamente.

> O processamento de 16.000+ registros leva entre 2–5 segundos.

### Passo 4 — Carregar bases complementares

Na barra superior, use os botões:
- **+ Triagem** → carrega a planilha de triagem
- **+ CID** → carrega o relatório de CID
- **+ Procedimentos** → carrega o BPA por profissional

### Passo 5 — Filtrar o período

Use os campos de **data** na barra de filtros para selecionar o período de análise. Atalhos rápidos: **7d**, **30d**, **3m**, **Ano**, **Tudo**.

Outros filtros disponíveis: **Turno** (Diurno/Noturno/Todos), **Médico** (filtro por nome), **Risco** (por classificação Manchester).

### Passo 6 — Navegar pelos painéis

Use o menu lateral esquerdo para alternar entre os painéis. Cada painel é carregado sob demanda (lazy loading) — o primeiro acesso pode ter um leve delay.

### Passo 7 — Exportar resultados

- **PDF:** botão `↓ PDF` no canto superior direito — exporta o painel atual com cabeçalho da unidade
- **XLSX:** botão `XLSX` — exporta os dados filtrados em planilha
- **Relatório:** painel *Relatório* → texto gerencial pronto para copiar ou exportar

### Passo 8 — Configurar metas e unidade

- **⚙ (engrenagem):** configura o nome da unidade, CNES, RT e endereço (aparecem no cabeçalho do PDF)
- **🎯 (alvo):** configura as metas de tempo e os limiares do Protocolo Manchester

---

## 6. Dicas e atalhos

### Edição de layout

Clique no botão **⊞** (grade) na topbar para entrar no modo de edição de layout:
- **Arrastar** os cards para reordenar dentro de cada painel
- **½ / ▬ / ▬▬ / ━** para ajustar a largura de cada card
- O layout é salvo automaticamente no navegador entre sessões
- Para resetar ao padrão: abra o console do navegador (F12) e execute `resetLayout()`

### Tema claro / escuro

Botão 🌙 na topbar. A preferência é salva e aplicada automaticamente nas próximas visitas.

### Banco de dados local

O dashboard mantém os últimos dados carregados em memória durante a sessão. Ao fechar e reabrir, é necessário carregar os arquivos novamente.

Para trocar a base de dados: botão **↺** (seta circular) no canto superior direito.

### Score executivo

O score (0–100) no painel Visão Geral é calculado automaticamente com base em penalidades por:
- Alertas críticos (−24 pts cada)
- Alertas de atenção (−9 pts cada)
- Taxa de retorno acima da meta
- Espera médica, triagem e total acima das metas
- % de casos amarelo+ acima de 35%

Clique em **"ℹ Metodologia do score"** para ver o detalhamento das penalidades do período atual.

---

## 7. Perguntas frequentes

**O dashboard envia meus dados para algum servidor?**  
Não. Todo processamento é local no navegador. Nenhum dado é transmitido.

**Posso usar em computadores diferentes?**  
Sim, mas cada dispositivo precisa carregar os arquivos separadamente (os dados não sincronizam entre dispositivos).

**O layout que configurei vai ser perdido?**  
O layout de cards é salvo no `localStorage` do navegador. Ele persiste entre sessões no mesmo navegador/dispositivo. Limpar os dados do navegador apaga o layout.

**O arquivo ficou muito lento após muitos dados?**  
O dashboard é otimizado para até ~25.000 registros. Acima disso, o carregamento pode ser mais lento, mas a análise permanece funcional.

**Como atualizo para uma versão nova?**  
Se estiver usando a versão online (GitHub Pages), basta recarregar a página — ela sempre serve a versão mais recente. Se usar o arquivo local, baixe novamente o `Pivatti_Dashboard.html`.

**O filtro de médico não está encontrando o nome corretamente.**  
Digite apenas parte do nome (ex: `NINOMIYA`). O filtro usa busca parcial normalizada (ignora acentos e maiúsculas/minúsculas).

---

## 8. Versões

| Versão | Data | Principais mudanças |
|--------|------|---------------------|
| **v2.5** | Mai 2026 | Aba Produtividade redesenhada (breakdown por categoria), modo edição de layout, sazonalidade reescrita, escala/dimensionamento corrigida, 30+ bugs corrigidos em múltiplas rodadas de auditoria |
| **v2.0** | Mai 2026 | Redesign visual completo (Inter + IBM Plex Mono), novos painéis (Funil, Comparativo, Correlações, Escala, Perfil), score executivo com metodologia, conformidade Manchester D/N |
| **v1.0** | Mai 2026 | Versão inicial — histórico de atendimentos, KPIs, gargalos, médicos, retornos, capacidade |

---

## Contato e manutenção

**Victor Matheus Sanches Pivatti**  
Email: vsanchespivatti@gmail.com
Tel.: (37) 98812-0269
