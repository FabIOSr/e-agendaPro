# 🚀 Plano de Implementação Gradual - Novo Layout AgendaPro

## 📋 Visão Geral

Este documento detalha o plano de implementação gradual do novo layout baseado em Tailwind CSS v4, migrando das páginas atuais para a nova estrutura unificada.

**Status Atual:**
- ✅ Protótipo funcional completo (`new-layout-tailwind.html`)
- ✅ Design system validado
- ✅ FOUC prevention implementado
- ✅ FASE 0 (Infraestrutura) **COMPLETA**
- ✅ FASE 1 (painel.html) **COMPLETA** com correções pós-migração
- ✅ FASE 2 (clientes.html) **COMPLETA** com correções de acessibilidade
- ✅ FASE 3 (relatorio.html) **COMPLETA** com Chart.js dark/light e correções de layout
- ⏳ FASE 4-6: PENDENTE

**Última revisão:** 17/04/2026 — FASE 3 concluída! `relatorio.html` migrado para novo layout unificado com Chart.js adaptável para dark/light mode, layout responsivo e correções de contraste.

---

## 🎯 Estratégia de Migração

### Princípios Orientadores

1. **Non-breaking migration**: Cada página deve funcionar perfeitamente após migração
2. **Incremental value**: Cada migração deve trazer benefício imediato ao usuário
3. **Easy rollback**: Possibilidade de voltar para versão anterior se necessário
4. **Shared infrastructure first**: Criar base compartilhada antes de migrar páginas
5. **Test-driven**: Validar cada migração exaustivamente
6. **Feature flag rollout**: Usar `?layout=novo` para testar em produção antes de rollout total

### Ordem de Prioridade

```
1. Infraestrutura Compartilhada (BASE)
   ↓
2. painel.html (MAIOR IMPACTO - página principal)
   ↓
3. clientes.html (2ª mais usada - CRUD complexo)
   ↓
4. relatorio.html (gráficos - dependência visual)
   ↓
5. configuracoes.html (formulários - menor complexidade)
   ↓
6. planos.html (upgrade - monetização)
   ↓
7. Testes e Validação Final
```

---

## 🔑 Token Mapping (Pré-requisito de todas as fases)

**⚠️ ANTES de migrar qualquer página**, mapear as variáveis CSS antigas → novas:

| Variável Antiga (painel/clientes/relatorio) | Nova Variável (Design System) | Uso |
|---------------------------------------------|-------------------------------|-----|
| `--color-panel-bg` | `rgb(var(--bg-primary))` | Background principal |
| `--color-panel-bg2` | `rgb(var(--bg-secondary))` | Background secundário |
| `--color-panel-bg3` | `rgb(var(--bg-tertiary))` | Background terciário |
| `--color-panel-border` | `rgb(var(--color-bord))` | Bordas |
| `--color-panel-border2` | `rgb(var(--color-bord2))` | Bordas hover |
| `--color-panel-faint` | `rgb(var(--color-faint))` | Texto secundário |
| `--color-panel-accent` | `rgb(var(--color-lime))` | Destaque principal |
| `--color-panel-accent2` | `rgb(var(--color-lime-d))` | Destaque secundário |
| `--color-panel-purple` | `#b060f0` (manter) | Categoria tintura |
| `--color-panel-blue` | `#60a8f0` (manter) | Categoria escova |
| `--color-panel-warn` | `rgb(var(--color-amber))` | Alertas |
| `--color-text` | `rgb(var(--color-text))` | Texto principal |
| `--color-muted` | `rgb(var(--color-faint))` | Texto terciário |
| `--color-lime-t` | `rgba(200,240,96,0.1)` | Tint lime |
| `--color-bg-dark` | `rgb(var(--bg-primary))` (dark) | Background dark |
| `--color-bg-dark2` | `rgb(var(--bg-secondary))` (dark) | Background dark 2 |
| `--color-bg-dark3` | `rgb(var(--bg-tertiary))` (dark) | Background dark 3 |

**Nota:** As variáveis `--color-panel-*` existem no `painel.html` mas não estão definidas inline — vêm de `config.js` ou `style.css`. As variáveis `--color-bg-dark*` vêm do `clientes.html` e `relatorio.html`. Todas devem convergir para o design system RGB.

---

## 📦 FASE 0: Infraestrutura Compartilhada

### Objetivo
Criar a base que será usada por todas as páginas.

### Arquivos a Criar

```
src/
├── css/
│   ├── design-system.css          # Variáveis RGB + Dark theme
│   ├── layout.css                 # Grid, sidebar, topbar
│   └── components.css             # Componentes reutilizáveis
├── js/
│   ├── layout.js                  # Sidebar, theme, FOUC prevention
│   └── components/
│       ├── topbar.js              # Topbar unificada
│       ├── sidebar.js             # Sidebar navigation
│       └── mobile-nav.js          # Bottom navigation mobile
└── templates/
    └── app-shell.html             # Template base (topbar + sidebar)
```

### Tarefas Detalhadas

#### 0.1 Design System (2 horas)
- [x] Extrair variáveis CSS RGB do protótipo
- [x] Criar `src/css/design-system.css`
- [x] Implementar `:root` (light theme)
- [x] Implementar `[data-theme="dark"]`
- [x] Adicionar responsive breakpoints

**Arquivo:** `src/css/design-system.css`
```css
/* Copiado de new-layout-tailwind.html linhas 31-61 */
:root {
  /* LIGHT THEME */
  --bg-primary: 245, 242, 235;
  --bg-secondary: 237, 233, 223;
  /* ... */
}

[data-theme="dark"] {
  --bg-primary: 14, 13, 10;
  /* ... */
}
```

#### 0.2 Layout Base (3 horas)
- [x] Criar estrutura grid CSS
- [x] Implementar sidebar colapsável
- [x] Configurar mobile (flexbox vs desktop grid)
- [x] Adicionar regras FOUC prevention

**Arquivo:** `src/css/layout.css`
```css
/* Copiado de new-layout-tailwind.html linhas 75-162 */
.app-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
}

@media (max-width: 768px) {
  .app-layout {
    display: flex;
    flex-direction: column;
  }
}
```

#### 0.3 JavaScript de Layout (3 horas)
- [x] Extrair lógica `toggleSidebar()`
- [x] Extrair lógica `toggleTheme()`
- [x] Implementar FOUC prevention script
- [x] Adicionar persistência localStorage
- [x] Adicionar feature flag `?layout=novo`

**Arquivo:** `src/js/layout.js`
```javascript
// Copiado de new-layout-tailwind.html linhas 608-676
function toggleSidebar() { /* ... */ }
function toggleTheme() { /* ... */ }
// FOUC prevention script inline

// Feature flag: ativar novo layout via query param
if (new URLSearchParams(window.location.search).get('layout') === 'novo') {
  document.documentElement.setAttribute('data-layout', 'novo');
}
```

#### 0.4 Template App Shell (2 horas)
- [x] Criar `src/templates/app-shell.html` como referência
- [x] Incluir: FOUC script, topbar, sidebar, main content slot, bottom nav
- [x] Documentar estrutura para copiar em cada página
- [x] URLs amigáveis Firebase Hosting (/painel, /clientes, etc.)

#### 0.5 Componentes Reutilizáveis (4 horas)
- [x] Criar `topbar.js` (componente topbar com date nav opcional)
- [x] Criar `sidebar.js` (navegação + widgets opcionais)
- [x] Criar `mobile-nav.js` (bottom nav)
- [x] Corrigir URLs para Firebase Hosting (sem .html)

**Entrega:**
- ✅ Design system funcional
- ✅ Layout base responsivo
- ✅ App shell template
- ✅ Componentes JS reutilizáveis
- ✅ FOUC prevention implementado
- ✅ Feature flag `?layout=novo` funcionando
- ✅ URLs Firebase Hosting corretas

**Commit:** `feat: infraestrutura compartilhada para novo layout`

---

## 📄 FASE 1: painel.html

### Análise da Página Atual (LEITO)

**Arquivo:** `pages/painel.html` (913 linhas)
**Complexidade:** ALTA
**Risco:** ALTO (página principal)
**Benefício:** MUITO ALTO (primeira impressão)

### Estrutura Atual Real

```html
<!-- TOPBAR: Logo + Date Navigation + Nav links inline + Botão "+ Novo" + "Sair" + Avatar -->
<div class="topbar flex items-center justify-between">...</div>

<!-- BANNER FREE (condicional para planos free) -->
<div class="banner-free" id="banner-free">...</div>

<!-- BADGE PRO PERIODICIDADE -->
<div id="badge-pro-periodicidade">...</div>

<!-- LAYOUT: Sidebar + Agenda Grid -->
<div class="layout flex flex-1">
  <!-- SIDEBAR (EXISTE! Com widgets completos) -->
  <div class="sidebar w-[240px]">
    ├── Mini-calendar (mês navegável, dias com eventos)
    ├── Stats de hoje (agendamentos, receita, próximo horário)
    ├── Lista de serviços (com cores por categoria)
    └── Botão "Adicionar bloqueio"
  </div>

  <!-- AGENDA GRID (complexo) -->
  <div class="agenda-wrap">
    ├── Time column (08:00 - 19:00, now-line)
    ├── Events column (agendamentos + bloqueios)
    └── Loading states
  </div>
</div>

<!-- DETAIL PANEL (modal de detalhes do agendamento) -->
<div class="detail-panel" id="detail-panel">...</div>
```

### Componentes Únicos e Complexos

1. **Agenda Grid com `time-col` + `events-col`**:
   - Sistema de horas com `now-line` (pseudoelementos `::before`/`::after`)
   - Agendamentos posicionados por hora/duração
   - Bloqueios com pattern diagonal
   - Cores por categoria (corte, tintura, escova, barba)
   - Auto-scroll para horário atual

2. **Supabase Realtime**:
   - `supabase.channel('agendamentos')` para updates em tempo real
   - `buscarDadosDia()` com cache por data

3. **Detail Panel**:
   - Modal centralizado com `fixed top-1/2 left-1/2`
   - Overlay com click-to-close
   - Ações dinâmicas (confirmar, reagendar, cancelar)

4. **Banner Free + Badge Pro**:
   - Lógica de trial com `trial_ends_at`
   - `verifica_plano_ativo` RPC call
   - LocalStorage para "fechar banner"

### Plano de Migração

#### Passo 1: Preparação (1 hora)
- [x] Backup do `painel.html` atual
- [x] Criar branch `feature/new-layout-painel`
- [x] Identificar todos os componentes customizados
- [x] Mapear variáveis CSS antigas → novas (Token Mapping)

#### Passo 2: Substituir Topbar (1 hora)
**IMPORTANTE:** A topbar atual tem navegação inline + botão "Sair" explícito.
- [x] Substituir por topbar unificada do protótipo
- [x] Manter date navigation (‹ Hoje ›)
- [x] Mover navegação para sidebar
- [x] Avatar com dropdown para logout (em vez de botão "Sair" explícito)

#### Passo 3: Substituir Sidebar (2 horas)
**IMPORTANTE:** A sidebar JÁ EXISTE e tem widgets completos. Não é "adicionar sidebar" — é **substituir a sidebar existente** pela nova com mesmo conteúdo.
- [x] Copiar mini-calendar existente para nova sidebar
- [x] Copiar stats de hoje (agendamentos, receita, próximo)
- [x] Copiar lista de serviços (com cores por categoria)
- [x] Manter botão "Adicionar bloqueio"
- [x] Adicionar colapsabilidade (240px ↔ 64px)
- [x] Widgets desaparecem quando colapsada

#### Passo 4: Envolver Agenda Grid no App Shell (2 horas)
- [x] Envolver `<div class="agenda-wrap">` com `app-layout` grid
- [x] Garantir que `time-col` sticky funcione com nova largura
- [x] Ajustar `events-col` height dinâmico
- [x] Manter `now-line`, agendamentos, bloqueios intactos
- [x] Testar auto-scroll para horário atual

#### Passo 5: Adaptar Detail Panel (1 hora)
- [x] Ajustar z-index (overlay: 200, topbar: 100, sidebar: 90)
- [x] Testar com sidebar colapsada e expandida
- [x] Testar em mobile (modal deve ser full-width)

#### Passo 6: Adaptar para Mobile (2 horas)
- [x] Sidebar oculta em mobile → bottom nav dedicada
- [x] Adicionar mini-calendar mobile-only (abaixo do header)
- [x] Agenda grid em coluna única
- [x] Detail panel full-width em mobile
- [x] Banner free responsivo

#### Passo 7: Testes Exaustivos (2 horas)
- [x] Desktop: agenda grid funcionando com sidebar expandida
- [x] Desktop: agenda grid funcionando com sidebar colapsada
- [x] Desktop: dark mode toggle sem flash
- [x] Desktop: now-line na hora correta
- [x] Desktop: detail panel abrindo/fechando
- [x] Desktop: realtime updates funcionando
- [x] Mobile: bottom nav funcional
- [x] Mobile: calendar mobile dedicado
- [x] Mobile: detail panel full-width
- [x] Mobile: banner free responsivo
- [x] FOUC: zero flash no reload

**Tempo Estimado:** 10 horas (revisado de 8h — agenda grid é mais complexo que o previsto)
**Risco:** Alto (página principal)
**Rollback:** Git revert, restaurar versão anterior

**Commits:**
- `feat(painel): migrar painel.html para novo layout unificado` — Migração inicial
- `fix(painel): correções pós-migração FASE 1` — Ajustes finais

**Status:** ✅ **COMPLETA** (15/04/2026)

#### Correções Pós-Migração (Commit `fix(painel): correções pós-migração FASE 1`)

Após a migração inicial, foram identificadas e corrigidas as seguintes questões:

1. **Serviços no Sidebar:**
   - ❌ Problema: Serviços hardcoded no HTML
   - ✅ Solução: Implementada função `carregarServicosSidebar()` que busca dinamicamente do Supabase
   - **Campo `cor` removido da query** (não existe na tabela)

2. **KPIs sem Dados:**
   - ❌ Problema: Cards exibiam "—" sem dados reais
   - ✅ Solução: Implementado preenchimento dinâmico de todos os KPIs
     - `kpi-agendamentos`: Total do dia
     - `kpi-receita`: Receita formatada (R$ X)
     - `kpi-proximo`: Próximo horário ou "—"
     - `kpi-ocupacao`: % calculado (minutos ocupados / disponíveis)
     - `agenda-count`: "X agendamento(s)" com plural correto

3. **Mobile Issues:**
   - ❌ Problema: Date navigation mobile não funcionava (botões com hide-mobile)
   - ✅ Solução: Adicionados botões mobile-only para navegação de datas
   - ❌ Problema: Mini calendar mobile não aparecia
   - ✅ Solução: `renderMiniCal()` agora popula ambos `mini-cal` e `mobile-mini-cal`

4. **UI/UX:**
   - ❌ Problema: Loading exibia card de fundo invasivo
   - ✅ Solução: Removido `bg-[var(--color-panel-bg)]` - agora apenas texto/ícone
   - ❌ Problema: Modal não centralizado horizontalmente
   - ✅ Solução: CSS com `!important` força centralização correta
   - ❌ Problema: Botões dos modais com cores ilegíveis (muito claras)
   - ✅ Solução: Substituído para `lime-d` (confirmar) e `rust` (cancelar)

5. **Design System:**
   - ✅ Adicionadas variáveis complementares: `teal-ink`, `amber-ink`, `rust-ink`, `lime-t`
   - ✅ Banner free convertido para variáveis RGB (removido `--color-lime-t` hardcoded)

6. **CSS Aliases:**
   - ✅ Mantidas aliases de variáveis antigas para compatibilidade com JS existente
   - `--color-panel-bg` → `rgb(var(--bg-primary))`, etc.

---

## 👥 FASE 2: clientes.html ✅ **COMPLETA**

### Análise da Página Atual (LEITO)

**Arquivo:** `pages/clientes.html` (514 linhas)
**Complexidade:** MÉDIA-ALTA
**Risco:** MÉDIO (CRUD de clientes)
**Benefício:** ALTO (página muito usada)

### Estrutura Atual Real

```html
<!-- TOPBAR: Logo + Nav links inline + Badge Plano + "Sair" + Avatar -->
<div class="topbar h-[54px]">...</div>

<!-- PAGE HEADER -->
<div class="page-header">
  ├── Título "Clientes" + subtítulo dinâmico
  └── Botão "Exportar CSV"
</div>

<!-- FILTROS -->
<div class="filters">
  ├── Search input (busca por nome, telefone, email)
  ├── Botões: Todos, VIP (8+), Regular, Novos, Sem visita +60d
</div>

<!-- STATS ROW (4 cards) -->
<div class="stats-row grid grid-cols-4">
  ├── Total de clientes
  ├── Clientes VIP
  ├── Ticket médio
  └── Receita total
</div>

<!-- TABELA DE CLIENTES -->
<div class="table-card">
  ├── Info bar com contagem
  └── Tabela com: Cliente, Visitas ↕, Último serviço, Última visita ↕, Total gasto ↕, Obs.
</div>

<!-- DRAWER (slide-in lateral) -->
<div class="drawer fixed top-0 right-[-440px]">
  └── Detalhes do cliente + histórico de agendamentos
</div>
```

### Componentes Únicos

1. **Gate Pro com Trial**:
   - `verifica_plano_ativo` RPC — mostra "Disponível no plano Pro" mas **não bloqueia**
   - Trial badge dinâmico: `Trial (X dias)`

2. **Stats Cards**:
   - Usam `--color-lime`, `--color-teal` (cores diretas, não RGB variables)
   - Fonte `Fraunces` para valores

3. **Tabela com Sort**:
   - Colunas clicáveis para ordenar (visitas, última visita, total gasto)
   - Hover states com `--color-bg-dark4`

4. **Drawer de Detalhes**:
   - Slide-in de 420px (`right: [-440px]` → `right: 0`)
   - Carrega histórico de agendamentos assíncrono
   - Gera cor baseada no nome do cliente

### ✅ Implementação Realizada (17/04/2026)

**Status:** COMPLETA com melhorias de acessibilidade

#### O que foi feito:

1. **App Shell Aplicado:**
   - ✅ Topbar unificada com toggle sidebar
   - ✅ Sidebar colapsável (sem widgets - apenas navegação)
   - ✅ Bottom nav mobile fixo
   - ✅ FOUC prevention script

2. **Variáveis CSS Migradas:**
   - ✅ `--color-bg-dark*` → `--color-panel-bg*`
   - ✅ `--color-bord*` → `--color-panel-border*`
   - ✅ `--color-faint-dark` → `--color-panel-faint`
   - ✅ Nova variável `--color-panel-secondary` para melhor legibilidade

3. **Badge Mobile:**
   - ✅ Hidden em mobile (< 768px) para evitar encavalamento
   - ✅ Mostra status do plano (Pro/Grátis/Trial)

4. **Drawer Z-Index:**
   - ✅ Ajustado para `z-[200]` (acima de sidebar/topbar)
   - ✅ Full-width em mobile (< 770px)

5. **Correções de Acessibilidade:**
   - ✅ Dark mode: Textos secundários mais legíveis (`--color-panel-secondary`)
   - ✅ Light mode: Cores lime mais escuras (`--color-lime-d`) para melhor contraste
   - ✅ Filtros: Botão ativo com cor mais visível
   - ✅ `table-info`: Atualizado dinamicamente com contagem de clientes

6. **Funcionalidades Mantidas:**
   - ✅ Filtros (Todos, VIP, Regular, Novos, Sem visita)
   - ✅ Sort por colunas (Visitas, Última visita, Total gasto)
   - ✅ Export CSV
   - ✅ Gate Pro (trial/plano)
   - ✅ Realtime updates
   - ✅ CRUD completo (observações)

**Backup:** `pages/clientes.html.backup`
**Tempo Real:** ~4 horas

---

## 📊 FASE 3: relatorio.html

### Análise da Página Atual (LEITO)

**Arquivo:** `pages/relatorio.html` (1087 linhas)
**Complexidade:** MÉDIA-ALTA
**Risco:** MÉDIO-ALTO (gráficos Chart.js + tabs)
**Benefício:** MÉDIO-ALTO (relatórios são importantes)

### Estrutura Atual Real

```html
<!-- TOPBAR (DIFERENTE das outras! Sem date nav, com links inline) -->
<div class="h-[54px] flex items-center justify-between">...</div>

<!-- TABS (inline, abaixo da topbar) -->
<div class="flex items-center justify-between">
  ├── Tabs: 📈 Receita, 👥 Clientes, ⏱️ Tempo Médio, ⭐ Avaliações
  └── Export buttons: CSV, PDF
</div>

<!-- CONTEÚDO PRO (gate com verifica_plano_ativo) -->
<div id="conteudo-pro">
  <!-- PAINEL RECEITA -->
  <div class="panel-active" id="panel-receita">
    ├── Filtros Pro (status, serviço, limpar)
    ├── KPIs (4 cards com barras coloridas via ::before)
    ├── Top serviços (free-only)
    ├── Charts Pro-only:
    │   ├── Receita mensal (6m/12m toggle)
    │   ├── Por serviço (doughnut)
    │   ├── Por dia da semana
    │   └── Horários de pico
  </div>

  <!-- PAINEL TOP CLIENTES -->
  <div class="panel-hidden" id="panel-clientes">
    └── Grid de cards com top 10 clientes
  </div>

  <!-- PAINEL TEMPO MÉDIO -->
  <div class="panel-hidden" id="panel-tempo-medio">
    └── Cards de análise tempo configurado vs real
  </div>

  <!-- PAINEL AVALIAÇÕES -->
  <div class="panel-hidden" id="panel-avaliacoes">
    ├── Stats (pendentes, aprovadas, rejeitadas)
    ├── Analytics grid
    └── Lista de avaliações pendentes com approve/reject
  </div>
</div>

<!-- DRAWER DE DETALHE DO CLIENTE -->
<div class="drawer" id="drawer">...</div>
```

### Componentes Únicos

1. **Tabs System**:
   - 4 tabs com `panel-active`/`panel-hidden` states
   - `abrirTab()` muda visibilidade + classe de animação

2. **Chart.js Integration**:
   - `chart-receita-mensal` (bar chart, 6-12 meses)
   - `chart-servicos` (doughnut)
   - `chart-dias` (bar chart, dias da semana)
   - `chart-horas` (bar chart, horas do dia)
   - **Cores hardcoded**: `#c8f060`, `#5DCAA5`, `#EF9F27`, `#60a8f0`

3. **Filtros Pro**:
   - Selects para status e serviço
   - `aplicarFiltros()` recarrega todos os charts
   - `limparFiltros()` reseta

4. **Gate Pro com `pro-only`/`free-only` classes**:
   - `.pro-only { display: none; }` para free
   - `.free-only { display: block; }` para free
   - JS toggle baseado em `verifica_plano_ativo`

5. **KPIs com `::before` colorido**:
   - `.kpi-bar.lime::before { background: #c8f060; }`
   - Mesma abordagem do design system proposto

### Plano de Migração

#### Passo 1: Preparação (30 min)
- [x] Backup do `relatorio.html`
- [x] Mapear variáveis CSS antigas → novas

#### Passo 2: Padronizar Topbar (1 hora)
**⚠️ IMPORTANTE:** Esta página tem topbar DIFERENTE — sem date nav, com navegação inline.
- [x] Substituir por topbar unificada do protótipo
- [x] Mover tabs para o conteúdo principal (abaixo do header)
- [x] Remover navegação inline da topbar

```html
<!-- ANTES: Topbar com navegação inline -->
<div class="topbar">Logo + [Agenda, Clientes, Relatórios...] + Avatar</div>

<!-- DEPOIS: Topbar unificada + tabs no conteúdo -->
<div class="topbar-unificada">Logo + Theme + Plan + Avatar</div>
<main>
  <div class="tabs-row">[Receita, Clientes, Tempo Médio, Avaliações]</div>
  <!-- Resto do conteúdo -->
</main>
```

#### Passo 3: Padronizar KPIs (1 hora)
- [x] Converter `::before` de hardcoded → `rgb(var(--color-lime))`
- [x] Usar KPI cards do design system (mesmo estilo)
- [x] Manter deltas (`↑ +12%`)

```css
/* ANTES */
.kpi-bar.lime::before { background: #c8f060; }

/* DEPOIS */
.kpi-card::before { background-color: rgb(var(--color-lime)); }
```

#### Passo 4: Adaptar Tabs System (30 min)
- [x] Manter lógica `abrirTab()` existente
- [x] Garantir que tabs funcionam com novo layout

#### Passo 5: Adaptar Gráficos Chart.js (2 horas)
**⚠️ CRÍTICO:** Chart.js usa cores hardcoded que podem não contrastar bem no dark mode.
- [x] Mapear cores atuais dos charts:
  - Receita: `#c8f060` (lime)
  - Serviços: `['#c8f060', '#5DCAA5', '#EF9F27', '#60a8f0', '#b060f0', '#f06048']`
  - Dias: `#5DCAA5`
  - Horas: `#EF9F27`
- [x] Criar função `getChartColors()` que retorna cores corretas para dark/light
- [x] Ajustar grid lines, labels, tooltips para dark mode
- [x] Testar responsividade (charts em container flexível)

```javascript
function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    lime: isDark ? 'rgb(200, 240, 96)' : 'rgb(138, 184, 48)',
    teal: 'rgb(93, 202, 165)',
    amber: 'rgb(239, 159, 39)',
    blue: 'rgb(96, 168, 240)',
    grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    text: isDark ? 'rgb(240, 237, 230)' : 'rgb(14, 13, 10)',
  };
}
```

#### Passo 6: Adaptar Gate Pro (30 min)
- [x] Manter classes `pro-only`/`free-only`
- [x] Ajustar backgrounds para `rgb(var(--bg-tertiary))`

#### Passo 7: Testes (1.5 horas)
- [x] Tabs alternando corretamente
- [x] Charts renderizando em dark mode
- [x] Charts renderizando em light mode
- [x] Charts responsivos (resize)
- [x] Filtros funcionando (status, serviço)
- [x] Export CSV/PDF funcionando
- [x] Gate Pro (free vs pro) funcionando
- [x] Mobile: tabs em wrap, charts em coluna

**Tempo Estimado:** 7 horas (revisado de 5h — Chart.js dark mode requer trabalho extra)
**Risco:** Médio-Alto (Chart.js + cores)

**Commit:** `feat(relatorio): migrar relatorio.html para novo layout unificado`

---

### ✅ Implementação Realizada (17/04/2026)

**Status:** COMPLETA com melhorias de acessibilidade e layout responsivo

#### O que foi feito:

1. **App Shell Aplicado:**
   - ✅ Topbar unificada (sem date nav, navegação inline removida)
   - ✅ Sidebar colapsável (apenas navegação, sem widgets)
   - ✅ Bottom nav mobile fixo
   - ✅ FOUC prevention script

2. **Variáveis CSS Migradas:**
   - ✅ `--color-bg-dark*` → `--color-panel-bg*`
   - ✅ `--color-bord*` → `--color-panel-border*`
   - ✅ `--color-muted` → `--color-panel-faint`
   - ✅ `--color-text` → `--color-panel-text`

3. **Chart.js com Cores Adaptáveis:**
   - ✅ Função `getChartColors()` que detecta tema e retorna cores apropriadas
   - ✅ Função `updateChartsColors()` para atualizar gráficos quando tema muda
   - ✅ Lime claro (`#c8f060`) em dark, lime escuro (`#8ab830`) em light
   - ✅ Grid lines, tooltips e labels adaptados para dark/light

4. **Layout Responsivo:**
   - ✅ KPIs: 4 cards em linha (desktop), 2 cards (tablet), 1 card (mobile)
   - ✅ Charts: Receita mensal + Por serviço (mesma linha), Por dia + Horários (linha abaixo)
   - ✅ Clientes: Auto-fill com minmax (desktop), 2 cards (tablet), 1 card (mobile)
   - ✅ Tempo Médio: Auto-fill com minmax (desktop), 2 cards (tablet), 1 card (mobile)
   - ✅ Avaliações: KPIs em linha (3 cards), Desempenho em grid responsivo

5. **Z-Index Ajustado:**
   - ✅ Drawer: z-[200] (acima da sidebar)
   - ✅ Overlay: z-[200]
   - ✅ Bottom nav: z-[150]

6. **Correções de Contraste (Modo Light):**
   - ✅ KPI Receita do mês: `--color-lime` → `--color-lime-d`
   - ✅ Link "Ver todos no CRM →": `--color-lime` → `--color-lime-d`
   - ✅ Top serviços valores: `--color-lime` → `--color-lime-d`
   - ✅ Tempo médio economiza: `--color-lime` → `--color-lime-d`
   - ✅ Delta de tempo: `--color-lime` → `--color-lime-d`
   - ✅ Total gasto: `--color-lime` → `--color-lime-d`
   - ✅ Taxa de resposta: `--color-lime` → `--color-lime-d`
   - ✅ NPS: `--color-lime` → `--color-lime-d`

7. **Funcionalidades Preservadas:**
   - ✅ Sistema de tabs (4 abas: Receita, Clientes, Tempo Médio, Avaliações)
   - ✅ KPIs com deltas (Pro)
   - ✅ 4 gráficos Chart.js (Receita mensal, Por serviço, Por dia, Horários de pico)
   - ✅ Top 10 clientes com drawer
   - ✅ Tempo médio por serviço
   - ✅ Moderação de avaliações
   - ✅ Gate Pro/Free mantido
   - ✅ Exportar CSV

#### Arquivos Modificados:
- `pages/relatorio.html` (1087 → 1365 linhas)
- `pages/relatorio.html.backup` (backup criado)

#### Próxima FASE:
`configuracoes.html` (formulários, menor complexidade)

---

## ⚙️ FASE 4: configuracoes.html

### Análise da Página Atual

**Arquivo:** `pages/configuracoes.html`
**Complexidade:** BAIXA-MÉDIA
**Risco:** BAIXO (formulários)
**Benefício:** MÉDIO (usabilidade)

**⚠️ NOTA:** Esta página não foi lida em detalhe na análise inicial. Assumir estrutura padrão de formulários com:
- Profile form (foto, nome, bio)
- Serviços CRUD
- Notificações toggles
- Integrações (WhatsApp, Google Calendar)

### Plano de Migração

#### Passo 1: Leitura Inicial (30 min)
- [ ] Ler `configuracoes.html` completamente
- [ ] Identificar componentes únicos
- [ ] Mapear variáveis CSS

#### Passo 2: Aplicar App Shell (1 hora)
- [ ] Topbar unificada
- [ ] Sidebar colapsável
- [ ] Bottom nav mobile

#### Passo 3: Adaptar Formulários (2 horas)
- [ ] Garantir que todos os inputs funcionam com novo design system
- [ ] Testar validation states
- [ ] Testar file upload (foto de perfil)
- [ ] Ajustar toggles/switches

#### Passo 4: Testes (30 min)
- [ ] Formulários submetendo
- [ ] Validações funcionando
- [ ] Upload de foto funcionando
- [ ] Mobile: formulários usáveis

**Tempo Estimado:** 4 horas (pode variar conforme complexidade real)
**Risco:** Baixo

**Commit:** `feat(configuracoes): migrar configuracoes.html para novo layout unificado`

---

## 💳 FASE 5: planos.html

### Análise da Página Atual

**Arquivo:** `pages/planos.html`
**Complexidade:** BAIXA-MÉDIA
**Risco:** BAIXO (página de upgrade)
**Benefício:** MÉDIO (monetização)

### Estrutura Esperada

```html
<!-- Topbar simples (estilo landing page) -->
<div class="topbar">Logo + Sair</div>

<main>
  <!-- Pricing Cards -->
  <div class="pricing-cards">
    <div class="card free">Free</div>
    <div class="card pro">Pro</div>
  </div>

  <!-- Formulário de pagamento -->
  <div class="payment-form">
    <!-- ASAAS integration -->
  </div>

  <!-- Modal de cancelamento -->
  <div class="cancel-modal">Confirmar cancelamento</div>
</main>
```

### Componentes Únicos

1. **Pricing Cards**: Comparação Free vs Pro
2. **Payment Form**: Integração ASAAS (gateway de pagamento)
3. **Cancel Modal**: Confirmação de cancelamento com survey
4. **Light theme**: Usa light theme do design system para parecer landing page

### Plano de Migração

#### Passo 1: Preparação (30 min)
- [ ] Ler `planos.html` completamente
- [ ] Mapear variáveis CSS

#### Passo 2: Aplicar App Shell — SEM SIDEBAR (1 hora)
**IMPORTANTE:** Esta página deve ter **topbar mas SEM sidebar** para manter aparência de landing page.
- [ ] Usar topbar unificada
- [ ] **NÃO incluir sidebar** — usar `app-layout` com coluna única
- [ ] Manter light theme (`data-theme` não setado = light por padrão)

```html
<!-- ANTES -->
<body class="bg-[--color-paper]">  <!-- Light theme -->

<!-- DEPOIS -->
<body class="bg-[rgb(var(--bg-primary))]">  <!-- Light theme do design system -->

<!-- App shell sem sidebar -->
<div class="app-layout no-sidebar">
  <main class="main-content">
    <!-- Pricing cards, payment form, etc -->
  </main>
</div>
```

#### Passo 3: Adaptar Pricing Cards (30 min)
- [ ] Usar styling do design system
- [ ] Manter funcionalidade ASAAS

#### Passo 4: Testar ASAAS Integration (1 hora)
- [ ] Upgrade funcionando
- [ ] Pagamento ASAAS funcionando
- [ ] Cancelamento funcionando
- [ ] Survey de cancelamento funcionando

#### Passo 5: Testes (30 min)
- [ ] Mobile: cards responsivos
- [ ] Light theme consistente
- [ ] Modal de cancelamento

**Tempo Estimado:** 4 horas (revisado de 3h — ASAAS integration precisa de cuidado)
**Risco:** Baixo

**Commit:** `feat(planos): migrar planos.html para novo layout unificado`

---

## ✅ FASE 6: Testes e Validação Final

### Checklist de Validação

#### Cross-Page Consistency
- [ ] Todas as páginas têm mesma topbar
- [ ] Sidebar funciona igual em todas (exceto planos.html)
- [ ] Dark mode funciona em todas
- [ ] Mobile bottom nav funciona em todas
- [ ] Transições entre páginas são suaves
- [ ] Logout funciona em todas as páginas (via avatar dropdown)

#### Performance
- [ ] LCP < 2.5s em todas as páginas
- [ ] Zero FOUC em todas as páginas
- [ ] Sidebar collapse instantâneo
- [ ] Theme toggle instantâneo
- [ ] Chart.js não bloqueia renderização

#### Responsividade
- [ ] Desktop (>1024px): Perfeito
- [ ] Tablet (768-1024px): Perfeito
- [ ] Mobile (<768px): Perfeito

#### Acessibilidade
- [ ] Contraste WCAG AA em todas
- [ ] Navegação por teclado funciona
- [ ] Screen readers funcionam

#### Funcionalidade
- [ ] Sem regressões de funcionalidade
- [ ] Sem breaking changes
- [ ] Sem console errors
- [ ] Supabase Realtime funcionando (painel)
- [ ] Chart.js renderizando (relatorio)
- [ ] Drawer abrindo (clientes)
- [ ] ASAAS integration funcionando (planos)

#### Feature Flag Rollout
- [ ] `?layout=novo` ativa novo layout
- [ ] Sem `?layout=novo` mantém layout atual (durante transição)
- [ ] Rollout gradual: 10% → 50% → 100%

### Testes E2E (Playwright)

```typescript
// tests/layout.spec.ts

test('sidebar toggle funciona', async ({ page }) => {
  await page.goto('/painel?layout=novo');
  const sidebar = page.locator('#sidebar');
  const initialWidth = await sidebar.evaluate(el => el.offsetWidth);

  await page.locator('.sidebar-toggle').click();
  const collapsedWidth = await sidebar.evaluate(el => el.offsetWidth);

  expect(collapsedWidth).toBeLessThan(initialWidth);
});

test('dark mode sem FOUC', async ({ page }) => {
  // Set dark mode
  await page.goto('/painel?layout=novo');
  await page.locator('.theme-toggle').click();

  // Reload e verificar tema persiste
  await page.reload();
  const theme = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme')
  );
  expect(theme).toBe('dark');
});

test('bottom nav aparece em mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/painel?layout=novo');

  const bottomNav = page.locator('.bottom-nav');
  await expect(bottomNav).toBeVisible();
});

test('consistência de topbar entre páginas', async ({ page }) => {
  const pages = ['/painel', '/clientes', '/relatorio', '/configuracoes'];
  const logos = [];

  for (const p of pages) {
    await page.goto(`${p}?layout=novo`);
    const logo = await page.locator('.logo').textContent();
    logos.push(logo);
  }

  // Todas devem ter mesmo logo
  expect(new Set(logos).size).toBe(1);
});
```

### Tempo Estimado: 5 horas (revisado de 4h)

**Commit Final:** `chore: finalizar migração para novo layout unificado`

---

## 📊 Resumo de Investimento

| Fase | Página | Tempo Original | Tempo Revisado | Risco | Benefício |
|------|--------|----------------|----------------|-------|-----------|
| 0 | Infraestrutura | 11h | **14h** | Baixo | Base para tudo |
| 1 | painel.html | 8h | **10h** | Alto | Muito Alto |
| 2 | clientes.html | 5h | **6h** | Médio | Alto |
| 3 | relatorio.html | 5h | **7h** | Médio-Alto | Médio-Alto |
| 4 | configuracoes.html | 4h | **4h** | Baixo | Médio |
| 5 | planos.html | 3h | **4h** | Baixo | Médio |
| 6 | Testes Finais | 4h | **5h** | - | - |
| **TOTAL** | | **40h** | **50h** | | |

**Acréscimo:** +25% (10h) — Justificativa: complexidade real das páginas lidas, Chart.js dark mode, drawer z-index, feature flag.

---

## 🎯 Critérios de Sucesso

### Técnico
- ✅ Zero FOUC (Flash of Unstyled Content)
- ✅ LCP < 2.5s em todas as páginas
- ✅ 100% responsivo (mobile, tablet, desktop)
- ✅ Dark/Light mode funcionando perfeitamente
- ✅ Sem regressões de funcionalidade
- ✅ Chart.js com cores adaptativas dark/light
- ✅ Drawer z-index correto acima da sidebar

### Negócio
- ✅ UX mais consistente (mesma topbar/sidebar em todas as páginas)
- ✅ Manutenção 50% mais rápida (CSS compartilhado vs duplicado)
- ✅ Profissionais conseguem usar calendar no mobile (bottom nav + calendar dedicado)
- ✅ Navegação mais intuitiva (sidebar persistente vs links inline)
- ✅ Rollout seguro com feature flag `?layout=novo`

---

## 🚀 Começando a Implementação

### Passo 1: Criar Branch de Trabalho
```bash
git checkout -b feature/new-layout-implementation
```

### Passo 2: Começar pela Fase 0
```bash
# Criar diretórios
mkdir -p src/css src/js/components src/templates

# Começar pela infraestrutura
# (seguir tarefas da FASE 0)
```

### Passo 3: Executar Fases em Ordem
- Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6

### Passo 4: Commit por Fase
```bash
git add .
git commit -m "feat(fase X): descrição da implementação"
```

### Passo 5: Feature Flag Rollout
```bash
# Durante transição, testar com ?layout=novo
# Após validação, remover feature flag gradualmente
```

---

## 📝 Notas Importantes

1. **Sempre testar exaustivamente antes de commitar**
2. **Manter backups das versões anteriores**
3. **Documentar qualquer desvio do plano**
4. **Comunicar com stakeholders antes de cada migração**
5. **Testar em dispositivos reais (não só devtools)**
6. **Feature flag é essencial para rollout seguro — não pular**
7. **Token mapping deve ser feito ANTES de cada migração de página**
8. **Chart.js requer atenção especial para dark mode (cores hardcoded)**
9. **Drawer z-index deve ser > sidebar z-index (200 > 90)**
10. **planos.html NÃO deve ter sidebar — manter aparência de landing page**

---

**Status do Planejamento:** ✅ REVISADO (14/04/2026)
**Revisão baseada em:** Análise completa de `painel.html`, `clientes.html`, `relatorio.html`
**Próximo Passo:** Começar FASE 0 (Infraestrutura Compartilhada)

**Data de Início:** A definir
**Estimativa de Conclusão:** 50 horas (aprox 1.5 semanas de trabalho dedicado)
