# 🚀 Changelog — AgendaPro

## [2026-04-12] — 🐛 Fix: CORS na Edge Function `avaliacoes` + fallback `cliente_nome`

### Bug 1: CORS bloqueado em respostas HTML

**Problema:** GET `?token=xxx` retornava HTML sem headers `Access-Control-Allow-Origin`, bloqueando fetch cross-origin de `127.0.0.1:5000`.

**Causa:** 3 respostas `Response` (token inválido, já avaliou, página HTML) não incluíam `...cors` nos headers.

**Correção:**
```diff
- { status: 404, headers: { "Content-Type": "text/html" } }
+ { status: 404, headers: { ...cors, "Content-Type": "text/html" } }
```

### Bug 2: `cliente_nome` NULL no fallback direto

**Problema:** Quando Edge Function falhava, fallback Supabase omitia `cliente_nome` (`NOT NULL`).

**Correção:**
```diff
  .insert({
    prestador_id:   AGENDAMENTO.prestadores.id,
    agendamento_id: AGENDAMENTO.id,
+   cliente_nome:   AGENDAMENTO.cliente_nome || 'Cliente',
    nota:           notaSelecionada,
    comentario:     comentario || null
  });
```

| Arquivo | Mudança |
|---|---|
| `supabase/functions/avaliacoes/index.ts` | `...cors` em 3 respostas HTML (GET `?token=`) |
| `pages/avaliar-cliente.html` | `cliente_nome` no fallback `supabase.insert()` |

---

## [2026-04-12] — ⭐ A-2: Moderação de Avaliações

### ⭐ A-2: Moderação de Avaliações — ✅ IMPLEMENTADO

**`migrations/36_moderacao_avaliacoes.sql` — Nova migration:**
- Colunas `status` (pendente/aprovada/rejeitada), `moderada_em`, `motivo_rejeicao`
- Constraint `chk_avaliacoes_status` com `DO $$` idempotente
- Índices: `status` + `prestador_id, status`
- Função `auto_aprovar_avaliacoes()` — auto-aprova após 24h
- **Migração de existentes:** avaliações antigas → `aprovada` (evita sumir da página)

**`supabase/functions/moderar-avaliacao/index.ts` — Nova Edge Function:**
- `POST` { avaliacao_id, acao, motivo } → aprovar/rejeitar
- `GET` → lista avaliações pendentes do prestador
- Auth JWT + ownership check (só modera as suas)
- Idempotência: rejeita se já moderada

**`supabase/functions/avaliacoes/index.ts` — Filtro:**
- GET `?prestador_slug=` agora filtra `.eq("status", "aprovada")`

**`pages/relatorio.html` — Nova aba "Avaliações":**
- Stats: pendentes, aprovadas, rejeitadas (cards com cores semânticas)
- Lista de avaliações pendentes com avatar, estrelas, comentário
- Botões Aprovar ✅ / Rejeitar ❌ por avaliação
- Empty state quando não há pendentes
- Auto-load ao abrir a aba
- Chama edge function via `supabase.functions.invoke()`

| Arquivo | Mudança |
|---|---|
| `migrations/36_moderacao_avaliacoes.sql` | Nova migration completa |
| `supabase/functions/moderar-avaliacao/index.ts` | Nova edge function |
| `supabase/functions/avaliacoes/index.ts` | Filtro `status='aprovada'` no GET público |
| `pages/relatorio.html` | Aba "Avaliações" + UI moderação + `carregarAvaliacoesPendentes()` + `moderarAvaliacao()` |

---

## [2026-04-12] — ⭐ A-1: Multi-canal de Solicitação de Avaliações (WhatsApp + Email)

### ⭐ A-1: Multi-canal de Solicitação (WhatsApp + Email) — ✅ IMPLEMENTADO

**`supabase/functions/solicitar-avaliacao-batch/index.ts` — Função `enviarEmail()` + fallback:**
- Nova função `enviarEmail(destinatario, nome, link, nomePrestador)` via SendGrid
- HTML responsivo com avatar, CTA e nome do profissional
- Se WhatsApp falha **e** tem `cliente_email` → tenta email
- **Marca sempre** `avaliacao_solicitada = true` (evita retry infinito)
- Error tracking com contexto (tel, email)

| Arquivo | Mudança |
|---|---|
| `supabase/functions/solicitar-avaliacao-batch/index.ts` | `enviarEmail()` + fallback + marca sempre flag |
| `ROADMAP-OPORTUNIDADES.md` | Status A-1 → ✅ Implementado |

**Impacto esperado:** +15-30% de avaliações (clientes sem WhatsApp agora são alcançados)

**Variável de ambiente:** `SENDGRID_API_KEY` (opcional — sem ela, email é silently skipped)

---

## [2026-04-12] — ⭐ Planejamento de Melhorias no Sistema de Avaliações

### 📋 5 Oportunidades Identificadas

**`ROADMAP-OPORTUNIDADES.md` — Nova seção "Melhorias no Sistema de Avaliações":**

| # | Feature | Impacto | Esforço | Status |
|---|---------|---------|---------|--------|
| A-1 | Multi-canal (WhatsApp + Email) | 🔴 Alta | 2h | ✅ Implementado |
| A-2 | Moderação de avaliações | 🔴 Alta | 6h | ✅ Implementado |
| A-3 | Resposta do profissional | 🟡 Média | 4h | ⏳ Pendente |
| A-4 | Analytics de taxa de resposta | 🟡 Média | 5h | ⏳ Pendente |
| A-5 | Lembrete de 2ª chance | 🟢 Baixa | 3h | ⏳ Pendente |

**Investimento total:** 20h
**ROI esperado:** +40-60% de avaliações recebidas, controle total de conteúdo

**Detalhes técnicos completos no roadmap:**
- Migrations SQL prontas (36-39)
- Código TypeScript para edge functions
- UI mockups para painel e página pública
- Matriz de priorização

---

## [2026-04-13] — F-1: Tempo Médio por Serviço + F-2: Avaliações Públicas

### ⏱️ F-1: Tempo Médio por Serviço

**`migrations/35_tempo_medio_servicos.sql` — Nova Função RPC:**
- `tempo_medio_servicos(p_prestador_id)` retorna análise por serviço
- Mostra duração configurada, total de agendamentos concluídos
- Ordenado por popularidade (mais agendamentos primeiro)

**`pages/relatorio.html` — Nova Aba "Tempo Médio":**
- Terceira aba ao lado de "Receita" e "Clientes"
- Cards de análise por serviço com visualização clara
- Integração com paywall (Pro only)

| Arquivo | Mudança |
|---|---|
| `migrations/35_tempo_medio_servicos.sql` | Função RPC + permissões |
| `pages/relatorio.html` | Aba "Tempo Médio" + painel + `carregarTempoMedio()` |

---

### ⭐ F-2: Avaliações Públicas (Já existente)

**Status:** ✅ JÁ IMPLEMENTADO — Descoberto durante auditoria

**`supabase/functions/avaliacoes/index.ts`:**
- `GET ?prestador_slug=xx` — retorna avaliações públicas (JSON)
- `GET ?token=xxx` — página HTML de avaliação
- `POST` — salva avaliação (nota 1-5 + comentário)

**`pages/pagina-cliente.html`:**
- Avaliações exibidas no hero (estrelas + média)
- Seção com cards de avaliações
- Função `loadAvaliacoes()` já implementada

---

## [2026-04-11] — Migração relatorio.html para Tailwind CSS v4

### 🎨 relatorio.html: CSS vanilla → Tailwind CSS v4

**Migração da relatorio.html de ~420 linhas de CSS vanilla para ~44 linhas (apenas @keyframes, pseudo-elementos, estados JS), mantendo JS vanilla e Chart.js intactos.**

| Arquivo | Mudança |
|---|---|
| `pages/relatorio.html` | ~420 → ~44 linhas CSS (-90%) |

**Detalhes técnicos:**
- JS vanilla preservado: KPIs, gráficos Chart.js (4 charts), tabs, filtros, export CSV, drawer cliente
- Chart.js não tocado — biblioteca externa com canvas dedicado
- Topbar sticky backdrop-blur, nav-links, badge trial/pro/free
- Tabs Receita/Clientes com fade animation
- KPI cards com barras coloridas (::before pseudo-element), deltas comparativos
- Charts grid: receita mensal (line), por serviço (doughnut), por dia (bar), horários pico (bar)
- Filtros Pro: status, serviço, limpar — queries Supabase dinâmicas
- Top 10 clientes: grid cards com rank (🥇🥈🥉), stats, receita
- Drawer lateral: histórico, observações, ações rápidas (WhatsApp, agenda)
- Paywall dinâmico: Free vê versão simplificada, Pro vê charts completos
- Elementos dinâmicos (renderTopClients, abrirDrawer, carregarTopServicos, setPeriod, abrirTab) geram HTML com classes Tailwind
- Responsividade: KPIs 4→2→1 cols <900px/<500px, charts grid 2→1 col <860px, top-clients <700px, drawer full <500px
- Google Fonts removido do HTML (já importado no style.css)
- Build Vite validado: CSS +3KB (utilities relatorio)

---

## [2026-04-11] — Migração painel.html para Tailwind CSS v4

### 🎨 painel.html: CSS vanilla → Tailwind CSS v4

**Migração da painel.html de ~570 linhas de CSS vanilla para ~30 linhas (apenas @keyframes, pseudo-elementos, estados JS), mantendo JS vanilla intacto.**

| Arquivo | Mudança |
|---|---|
| `pages/painel.html` | ~570 → ~30 linhas CSS (-95%) |
| `src/style.css` | Tokens painel adicionados (--color-panel-bg, --panel-bg2, --panel-border, --panel-accent, --panel-accent2, --panel-warn, --panel-danger, --panel-blue, --panel-purple, --panel-faint) |

**Detalhes técnicos:**
- JS vanilla preservado: agenda grid, navegação de data, mini-calendário, CRUD agendamentos, bloqueios, modal detalhe
- Topbar sticky com date-nav, nav-links, badge trial/pro/free, botão "+ Novo", avatar
- Sidebar: mini-calendário interativo, stats (agendamentos, receita, próximo), lista de serviços, botão bloqueio
- Agenda grid: coluna de horas, linhas de hora (sólida + tracejada), now-line com pseudo-elementos, cards de agendamento por categoria (corte, tintura, escova, barba), bloqueios com pattern
- Modal de detalhe: painel com overlay, inputs dinâmicos para novo agendamento/bloqueio, botões concluir/cancelar
- Banner free (promo Pro): slide-down animation, link para /planos
- Elementos dinâmicos (renderAgenda, abrirDetalhe, abrirNovoAgendamento, abrirNovoBloqueio, renderMiniCal) geram HTML com classes Tailwind
- Responsividade: layout flex-col <768px, sidebar w-full + order -1 <768px, topbar-center hidden <768px, nav-links hidden <900px, padding reduzido <480px, sidebar max-h <480px
- Google Fonts removido do HTML (já importado no style.css)
- Build Vite validado: CSS +6KB (tokens painel)

---

## [2026-04-11] — Migração clientes.html para Tailwind CSS v4

### 🎨 clientes.html: CSS vanilla → Tailwind CSS v4

**Migração da clientes.html de ~530 linhas de CSS vanilla para utilitários Tailwind CSS v4, mantendo JS vanilla intacto.**

| Arquivo | Mudança |
|---|---|
| `pages/clientes.html` | ~530 → ~28 linhas CSS (-95%) |
| `src/style.css` | Tokens dark theme para painel (bg-dark, bord, teal, amber, faint-dark, etc.) |
| `supabase/functions/_shared/cors.ts` | Dev origins adicionadas ao HARDCODED_ORIGINS (resolve CORS local 127.0.0.1:5000) |

**Detalhes técnicos:**
- JS vanilla preservado: CRUD clientes, busca, filtros, sort, drawer, export CSV
- Topbar sticky com backdrop-blur, badge trial/pro/free
- Stats cards: total, VIP, ticket médio, receita total
- Tabela com sort por coluna, hover states, avatar com cor dinâmica
- Drawer lateral com histórico async, observações, ações (WhatsApp, agenda)
- Elementos dinâmicos (renderTabela, abrirCliente, freqBadge, histórico) geram HTML com classes Tailwind
- Responsividade: nav links hidden <900px, stats 2 colunas <700px, padding reduzido <600px, drawer full-width <500px
- Google Fonts removido do HTML (já importado no style.css) — evita carregamento duplo
- Build Vite validado: CSS +3KB (tokens dark)

### Fix CORS

Dev origins (`localhost:3000/5173`, `127.0.0.1:3000/5000/5173`) movidas de `getAllowedDevOrigins()` para `HARDCODED_ORIGINS` — resolve erro preflight quando `SENTRY_ENVIRONMENT=production` ignorava dev origins. Deploy de todas as Edge Functions necessário.

---

## [2026-04-11] — Migração Auth + Onboarding para Tailwind CSS v4

### 🎨 Auth.html: CSS vanilla → Tailwind CSS v4

**Migração da auth.html de ~336 linhas de CSS vanilla para utilitários Tailwind CSS v4, mantendo JS vanilla intacto (login, cadastro, reset, OAuth).**

| Arquivo | Mudança |
|---|---|
| `pages/auth.html` | ~336 linhas CSS inline → ~50 linhas CSS mínimo (@keyframes, pseudo-elementos, sistema de telas) |
| `src/style.css` | Tokens dark theme adicionados ao `@theme` (--color-bg, --color-bg2, --color-text, etc.) |

**Detalhes técnicos:**
- JS vanilla preservado: `fazerLogin()`, `fazerCadastro()`, `enviarReset()`, `loginGoogle()`, `salvarNovaSenha()`
- Layout split dark com grade de fundo decorativa
- 5 telas: login, cadastro, confirmar, forgot, nova-senha, reset-sent
- Responsividade com `[@media(max-width:800px)]` inline
- Build Vite validado: auth.html com assets injetados

### 🎨 Onboarding.html: CSS vanilla → Tailwind CSS v4

**Migração completa do onboarding.html de ~380 linhas de CSS vanilla para utilitários Tailwind CSS v4, mantendo JS vanilla intacto.**

| Arquivo | Mudança |
|---|---|
| `pages/onboarding.html` | ~380 → ~56 linhas CSS (apenas @keyframes, pseudo-elementos decorativos, estados controlados por JS) |
| `src/style.css` | Tokens light theme adicionados ao `@theme` (--color-bg-light, --color-cream, --color-border-light, etc.) |

**Detalhes técnicos:**
- JS vanilla preservado: steps, slug check com debounce, serviços dinâmicos, disponibilidade, save Supabase
- 4 steps: identidade, serviços, horários, sucesso
- Painel lateral escuro fixo com preview em tempo real
- Elementos dinâmicos (serviços, dias) com classes Tailwind no JS
- Proteção de rota: redirect para `/painel` se `prestador.slug` já existe (evita re-onboarding)
- Responsividade com `[@media(max-width:860px)]` inline
- Correções visuais pós-migração: padding inputs reduzido (py-2.5), slug prefix com separador visual (border-r)
- Build Vite validado: 19 HTMLs com assets injetados

---

## [2026-04-11] — Migração Landing Page para Tailwind CSS v4

### 🎨 Landing Page: CSS vanilla → Tailwind CSS v4

**Migração completa da landing-page.html de ~600 linhas de CSS vanilla para utilitários Tailwind CSS v4, mantendo JS vanilla intacto.**

| Arquivo | Mudança |
|---|---|
| `pages/landing-page.html` | ~600 linhas CSS inline → ~50 linhas CSS mínimo (só @keyframes, pseudo-elementos, estado FAQ) |
| `src/style.css` | Google Fonts + `@import tailwindcss` + `@theme` com 12 cores + 3 fonts + `[x-cloak]` + `scroll-behavior: smooth` |
| `src/app.js` | Simplificado: só Alpine import + `start()` |
| `vite.config.js` | Plugin `copyAndInjectHtml` agora copia `modules/` → `dist/modules/` (corrige erro 404 do sentry.js) |
| `package.json` | Removidos `@alpinejs/collapse` e `@alpinejs/intersect` (não utilizados) |

**Detalhes técnicos:**
- JS vanilla preservado: `smoothScrollTo()`, `toggleFaq()`, `IntersectionObserver` (data-reveal)
- Breakpoints customizados com `@media(min-width:900px)` para navbar e mockup hero
- Grid "Como funciona": `<500px` 1 coluna | `500-900px` 2 colunas | `>900px` 4 colunas
- Navbar mobile: só **AgendaPro** + **Começar grátis →** (links somem até 900px)
- Hero mockup (celular decorativo) some em telas < 900px
- Cards de plano: ticks `✓` via `::before`, itens `off` com tachado + opacidade
- Build: 4 modules transformed, dist/ com 21 módulos copiados

**Correções aplicadas pós-migração:**
- Restaurada classe `.eyebrow` nos títulos de seção (traço `—` antes do texto)
- Restaurada classe `.preco-lista` nos `<ul>` dos planos (ticks verdes)
- `text-decoration: line-through` + `opacity: .5` em itens `.off` do plano grátis
- `whitespace-nowrap` em "Intervalo customizado entre agendamentos" (sem quebra)
- `hidden [@media(min-width:900px)]:block` no mockup hero
- `hidden [@media(min-width:900px)]:flex` nos links da navbar
- Cópia de `modules/` para `dist/modules/` no build (resolve GET 404 sentry.js)

---

## [2026-04-10] — Decisão Oficial da Stack Frontend

### 🎨 Stack Frontend Decidida: Alpine.js + Tailwind CSS v4 + Vite

**Decisão oficial documentada em `docs/stack/STACK-DECISION.md`.**

| Camada | Tecnologia | Motivo |
|---|---|---|
| Reatividade | Alpine.js 3.x | Leve (15kb), reativo direto no HTML, migração incremental |
| CSS | Tailwind CSS v4 | Tokens centralizados, purge automático, consistência de design |
| Build | Vite 6.x | Minificação, tree-shaking, HMR, Tailwind com purge |
| Type Safety | JSDoc + `@ts-check` | Type safety gradual sem migrar para TypeScript puro |
| Gráficos | Chart.js 4.x | Relatórios e dashboard admin |

**Rejeitados:** Next.js (muda hosting), React (overkill), Vue (sem vantagem), Astro (SEO não é prioridade), Svelte (requer compilação), Angular (exagero).

**Documentação completa criada:**
- `docs/stack/README.md` — Índice
- `docs/stack/STACK-DECISION.md` — Decisão oficial + alternativas rejeitadas
- `docs/stack/ALPINE-GUIDE.md` — Guia prático de Alpine.js
- `docs/stack/VITE-CONFIG.md` — Configuração do Vite
- `docs/stack/TAILWIND-TOKENS.md` — Tokens de design mapeados do ColorSchema
- `docs/stack/BIBLIOTECAS-LOCAIS.md` — Bibliotecas aprovadas e rejeitadas
- `docs/stack/MIGRACAO-PLANO.md` — Plano de migração página por página (8 fases, 2-3 semanas)

**Documentos arquivados (referência histórica, não seguir):**
- `docs/sugestoes/migracao-astro/*`
- `docs/sugestoes/migracao-alpine-tailwind/*`
- `docs/admin/STACK-MODERNIZACAO.md`

---

## [2026-04-10] — Cancel Survey em Planos.html + Documentação do projeto

### 📄 Documentação de Referência

**`AgendaPro_PRD.md` — Product Requirements Document:**
- Visão do produto, stack técnica, modelo de planos
- Páginas e funcionalidades documentadas
- Modelo de dados (principais tabelas)
- Edge Functions listadas
- Regras de negócio críticas (timezone, limite free, grace period)
- Roadmap e pendências organizadas por prioridade

**`AgendaPro_ColorSchema.html` — Color Schema & Typography:**
- Painel dark: 13 tokens (--bg a --lime-t)
- Página pública light: 12 tokens (--bg a --warn-l)
- Tipografia: Syne, Fraunces, DM Sans, Instrument Serif, DM Mono
- Border radius: 4px a 100px com contexto de uso
- Cores por contexto (painel vs página)
- Accent dinâmico sobrescrito via JS no :root

### 🔄 Cancel Survey em Planos.html

**`pages/planos.html` — Modal de cancelamento agora idêntico ao de `configuracoes.html`:**
- Survey com 5 motivos + campo "outro"
- Oferta de 20% desconto por 3 meses (mensal + "muito-caro")
- Aviso para plano anual (sem oferta de desconto)
- Chama `registrar-cancelamento` (salva motivo + cancela no Asaas)
- Campo `assinatura_periodicidade` adicionado ao estado PRESTADOR
- Variável CSS `--rust-t` adicionada para hover do botão cancelar

---

## [2026-04-10] — R-4: Dunning Inteligente

### 💰 Recuperação de Pagamentos Falhados

**`supabase/functions/dunning/index.ts` — Edge Function:**
- Busca pagamentos com `PAYMENT_FAILED` nos últimos 3 dias
- 3 tentativas progressivas:
  - **Tentativa 0:** Email de aviso
  - **Tentativa 1:** WhatsApp + Email de lembrete
  - **Tentativa 2:** Email com oferta de desconto (15%)
- Integração com Evolution API (WhatsApp) e SendGrid (email)
- Templates HTML responsivos e personalizados por etapa
- Logger estruturado + Analytics (`dunning_tentativa`)
- Resposta JSON com estatísticas: processados, emails, WhatsApp, erros

**`migrations/34_dunning_tentativas.sql` — Nova tabela:**
- `dunning_tentativas` — rastreia cada tentativa por pagamento
- Índice por `pagamento_id` e `prestador_id`
- Constraint única: máximo 3 tentativas por pagamento

**Cron job embutido na migration:** `0 12,18,0 * * *` (3x ao dia — 9h, 15h, 21h Brasília)

**Impacto esperado:** Recuperar 15-25% de pagamentos falhados

---

## [2026-04-10] — Q-1: Toast "Salvo" em Formulários

### ✅ Feedback Visual em Ações de Save

**`modules/ui-helpers.js` — Implementado:**
- Função `toast(message, type)` — toast genérico (success/error/warn)
- Função `toastWithUndo(message, onUndo)` — toast com botão desfazer
- Expostas globalmente via `window.toast` e `window.toastWithUndo`
- Usadas em: `planos.html`, `configuracoes.html`, `clientes.html`, etc.
- Auto-dismiss com 3s (success/error) ou 5s (com undo)
- Posição fixa bottom-right, z-index 9999

**Impacto:** Usuário agora sabe imediatamente se uma ação foi salva com sucesso ou falhou.

---

---

## [2026-04-10] — INF-5: Guia de Execução de Testes

### 📝 Documentação de Testes

**`docs/tests/TESTS-GUIDE.md`:**
- Como rodar testes unitários (`npm test`) — 74 testes em 10 arquivos
- Como rodar E2E (`npm run test:e2e`, `--ui`, `--headed`) — 102 testes em 7 arquivos
- Como rodar smoke tests de DB (`npm run test:db:local`)
- Como adicionar novos testes (padrões e exemplos)
- Cobertura atual e gaps identificados (7 módulos sem testes)
- CI/CD: pipeline completo e o que bloqueia deploy

**Contagem atualizada: 177 testes** (74 unitários + 102 E2E + 1 smoke DB)

---

## [2026-04-10] — INF-4: Analytics Plausible (Privacy-First)

### 📊 Integração Plausible

**`pages/painel.html` + `pages/landing-page.html`:**
- Script Plausible adicionado no `<head>` com snippet `plausible()` (async, não-bloqueante)
- Privacy-first: sem cookies, sem banner LGPD

**`modules/analytics.js` — Frontend:**
- Módulo `analytics` com eventos tipados por domínio de negócio
- `sendServerEvent()` para chamadas server-side

**`supabase/functions/_shared/analytics.ts` — Edge Functions:**
- `sendServerEvent()` para Deno (mesma interface, TypeScript)

### 🎯 Eventos Rastreados

| Evento | Origem | Propriedades |
|--------|--------|--------------|
| `agendamento_criado` | criar-agendamento-handler | prestador_id, servico_id |
| `agendamento_cancelado` | cancelar-agendamento-cliente-handler | prestador_id, cliente_nome |
| `agendamento_reagendado` | reagendar-cliente-handler | prestador_id |
| `upgrade_concluido` | webhook-asaas-handler | prestador_id, ciclo |
| `downgrade_efetuado` | webhook-asaas-handler | prestador_id, evento |
| `trial_iniciado` | ativar-trial/index.ts | prestador_id |
| `lista_espera_entrada` | lista-espera/index.ts | servico, preferencia |

**Nova variável de ambiente (opcional):**
```
PLAUSIBLE_DOMAIN=e-agendapro.web.app
```

---

## [2026-04-09] — INF-3: Validação de Origem com Variáveis de Ambiente

### 🔒 Melhorias no CORS

**`supabase/functions/_shared/cors.ts`:**
- Variáveis `ALLOWED_ORIGINS` e `ALLOWED_ORIGINS_DEV` para customizar origins via env
- Localhost habilitado automaticamente em dev (`SENTRY_ENVIRONMENT !== "production"`)
- Fallback para hardcode se variáveis não definidas
- Todas as 22 Edge Functions já validam origem com `validateOrigin()`

**Novas variáveis de ambiente (opcionais):**
```
ALLOWED_ORIGINS=https://e-agendapro.web.app,https://agendapro.com.br
ALLOWED_ORIGINS_DEV=http://localhost:3000,http://localhost:5173
```

---

## [2026-04-09] — INF-2: Rate Limiting nas Edge Functions Críticas

### ✨ Novo Módulo

**`supabase/functions/_shared/rate-limit.ts`:**
- Baseado em IP (`x-forwarded-for`)
- Janela deslizante com auto-cleanup (5 min)
- Headers `X-RateLimit-*` em todas as respostas
- Resposta `429` com `Retry-After` quando excedido

### 🔒 Edge Functions Protegidas

| Função | Limite | Janela |
|--------|--------|--------|
| `criar-agendamento` | 10 req | 1 min |
| `cancelar-agendamento-cliente` | 10 req | 1 min |
| `reagendar-cliente` | 10 req | 1 min |

### 🧪 Testes

- ✅ 74 testes passando

---

## [2026-04-09] — INF-1: Logger Estruturado com Níveis e TypeScript

### ✨ Novos Módulos

**`modules/logger.ts` — Logger estruturado para frontend:**
- Níveis: DEBUG, INFO, WARN, ERROR
- Auto-detecção de ambiente (development vs production)
- Production: apenas WARN + ERROR visíveis
- **`logger.error()`** — Mostra no console, **NÃO envia para Sentry**
- **`logger.captureError()`** — Mostra no console **E envia para Sentry** (apenas erros reais inesperados)
- Sanitização de dados sensíveis (senha, token, API keys → `[REDACTED]`)
- Métricas via `logger.metric()` com breadcrumbs no Sentry

**`supabase/functions/_shared/logger.ts` — Logger para Edge Functions (Deno):**
- Mesmos recursos do frontend
- Envio de erros para Sentry via Envelope API
- Tipagem TypeScript completa

### 🔒 Separação: Error vs CaptureError

**Problema resolvido:** `logger.error()` NÃO envia mais para Sentry automaticamente.

**Antes:**
```typescript
logger.error('Admin não autenticado', { redirectTo: '/admin/login' });
// ❌ Enviava para Sentry (não é erro real, é fluxo esperado)
```

**Depois:**
```typescript
logger.error('Admin não autenticado', { redirectTo: '/admin/login' });
// ✅ Apenas console, não vai para Sentry

logger.captureError('Erro inesperado ao criar agendamento', err, { feature: 'agendamento' });
// ✅ Envia para Sentry (erro real que precisa investigação)
```

**Quando usar cada um:**

| Método | Quando | Vai para Sentry? |
|--------|--------|------------------|
| `logger.debug()` | Debug de desenvolvimento | ❌ Não |
| `logger.info()` | Info de fluxo normal | ❌ Não |
| `logger.warn()` | Aviso (ex: token inválido, fallback) | ❌ Não |
| `logger.error()` | Erro esperado (ex: validação, auth) | ❌ Não |
| `logger.captureError()` | **Erro inesperado** (ex: crash, bug) | ✅ Sim |
| `logger.metric()` | Métricas de negócio | ✅ Breadcrumb |

### 🔄 Migração para TypeScript

**Handlers migrados de JS → TS:**
- `criar-agendamento-handler.ts` — Criação de agendamentos
- `webhook-asaas-handler.ts` — Webhook de pagamentos Asaas
- `cancelar-agendamento-cliente-handler.ts` — Cancelamento por token
- `reagendar-cliente-handler.ts` — Reagendamento por token

**Tipagens adicionadas:**
- Interfaces para Deps, Body, Agendamento, Prestador, ErrorContext
- Retornos de funções tipados
- Zero `any` nos novos arquivos

### 📊 Substituição de Console Logs

**221 `console.log/error/warn` → `logger.*`:**

| Handler | Antes | Depois |
|---------|-------|--------|
| `criar-agendamento` | 6 console.* | 6 logger.* |
| `webhook-asaas` | 9 console.* | 9 logger.* |
| `cancelar-cliente` | 5 console.* | 5 logger.* |
| `reagendar-cliente` | 5 console.* | 5 logger.* |

**Exemplos de métricas agora rastreadas:**
- `agendamento_criado` — Quando agendamento é criado
- `plano_ativado` — Quando Pro é ativado via Asaas
- `plano_rebaixado` — Quando downgrade para Free
- `agendamento_cancelado` — Cancelamento por token
- `agendamento_reagendado` — Reagendamento por token
- `pagamento_registrado` — Evento do Asaas registrado

### 🧪 Testes

- ✅ 74 testes unitários passando (0 falhas)
- ✅ Handlers TypeScript funcionam com testes existentes
- ✅ Arquivos JS originais mantidos (serão removidos após validação completa)

### 📁 Arquivos Criados

```
modules/logger.ts                                  — Logger frontend
modules/criar-agendamento-handler.ts               — Handler TS
modules/webhook-asaas-handler.ts                   — Handler TS
modules/cancelar-agendamento-cliente-handler.ts    — Handler TS
modules/reagendar-cliente-handler.ts               — Handler TS
supabase/functions/_shared/logger.ts               — Logger Edge Functions
```

---

## [2026-04-08] — R-2: Cancelamento Survey com Retenção Ativa (v2 — correção de arquitetura)

### 🐛 Correções Críticas

**Bug de duplicação corrigido na função `criar-cupom`:**
- Removido `insert` duplicado na tabela `cancelamentos`
- Cada desconto agora gera **um único registro** correto

**Aplicação de desconto REAL no Asaas:**
- Antes: apenas estendia `plano_valido_ate` (gambiarra, sem efeito no valor cobrado)
- Agora: cancela assinatura atual → cria nova com valor reduzido → agenda reversão
- Exemplo: 20% de desconto → R$39 → R$31,20/mês por 3 meses reais

### 🗄️ Migrações

**`migrations/32_cancelamentos.sql` — campos novos:**
- `desconto_asaas_sub_id TEXT` — ID da assinatura com desconto
- `desconto_valido_ate TIMESTAMPTZ` — quando reverter para valor original
- `assinatura_original_sub_id TEXT` — ID da assinatura original
- Índice parcial para queries de reversão: `idx_cancelamentos_desconto_valido`

**`migrations/33_reverter_descontos_cron.sql` — nova migration:**
- Cron job diário (03:00 UTC) via `pg_cron` + `pg_net`
- Função `get_descontos_expirados()` para script externo
- Reverte descontos expirados automaticamente

### 🔄 Nova Edge Function: `reverter-desconto`
- Cancela assinatura com desconto e cria nova com valor original
- Chamada automaticamente pelo cron job
- Também pode ser chamada manualmente via HTTP
- Registra evento `RETENTION_DISCOUNT_EXPIRED` em `pagamentos`

### 🛡️ Melhoria em `registrar-cancelamento`
- Verifica se assinatura existe no Asaas antes de deletar
- Se já cancelada (404), prossegue sem erro
- Evita inconsistência: cancelado no banco, ativo no Asaas

### 🎨 Frontend
- Fallback de `toast()` → `alert()` em `aceitarDesconto`
- Garantia de feedback visual mesmo se módulo não carregou

### 📊 Fluxo Completo de Retenção (agora funcional)
```
1. Usuário clica "Cancelar →" → abre survey
2. Motivo "muito-caro" → oferta de 20% por 3 meses
3. Aceita → cancelar assinatura atual (R$39)
           → criar nova (R$31,20)
           → registrar com desconto_valido_ate = +3 meses
4. Cron job diário verifica descontos expirados
5. Ao expirar → cancelar com desconto → criar nova (R$39)
```

---

## [2026-04-07] — Serviços: descrição, exibição de preço, galeria Pro e horários no hero

### ✂️ Serviços — descrição e exibição de preço

**Novos campos na tabela `servicos`:**
- `descricao` (TEXT, máx. 120 chars) — descrição curta exibida na página pública
- `exibir_preco` (BOOLEAN, default TRUE) — quando `false`, exibe "Sob consulta" em vez do valor

**`pages/configuracoes.html`:**
- Cada serviço agora tem `<textarea>` para descrição + checkbox "Exibir preço"
- Layout reorganizado: inputs numa linha, descrição + checkbox abaixo
- Save inclui os novos campos (INSERT e UPDATE)

**`pages/pagina-cliente.html`:**
- Cards de serviço exibem a descrição quando disponível
- Preço mostra "Sob consulta" quando `exibir_preco = false`
- Step 5 (resumo) respeita `exibir_preco` → exibe "Sob consulta"
- Cores dinâmicas do tema aplicadas em mais elementos (rating, seção, hero-next-slot)

### 🖼️ Galeria de fotos (Plano Pro)

**`pages/configuracoes.html`:**
- Nova seção "Galeria" no painel (badge Pro)
- Adicionar/remover até 9 fotos via URL
- Salva em `prestadores.galeria_urls` (array JSONB)

**`pages/pagina-cliente.html`:**
- Galeria exibida na página pública (até 9 fotos, era 6)
- `onerror` oculta itens com imagem quebrada

### 🕐 Horário de funcionamento no hero

**`pages/pagina-cliente.html`:**
- Exibe horários abaixo do nome/bio do prestador
- Agrupa dias consecutivos com mesmo horário (`Seg–Sex 8h–18h`)
- Auto-quebra em linhas quando > 3 faixas para evitar poluição visual

### 🐛 Correções

- **Lista de espera:** resumo do modal usava `state.servico?.nome` (era string) → corrigido para `state.servico`
- **Lista de espera:** payload enviava `servico_id: null`, `servico_nome: null`, `servico_duracao_min: 60` → corrigido para `state.servicoId`, `state.servico`, `state.duracaoMin`

### 📦 Migração

- `migrations/29_descricao_servicos.sql` — adiciona colunas `descricao` e `exibir_preco`

---

## [2026-04-06] — Fix: package.json, login.html, smoke test e E2E de agendamento

### 🧪 Testes E2E: Fluxo Completo de Agendamento (50 testes)

**`tests/e2e/booking-flow.spec.ts`** expandido de 4 → 50 testes, cobrindo os 5 steps:

| Step | Testes | O que valida |
|------|--------|-------------|
| Estrutura | 4 | Hero (`#hero`, `#hero-avatar`), barra de 5 steps, step 1 ativo |
| 1 — Serviço | 3 | Título, carregamento dinâmico, avanço ao clicar |
| 2 — Data | 3 | Calendário `#cal-grid`/`#cal-month`, botão voltar, navegação |
| 3 — Horário | 3 | Grid `#slots-grid`, voltar, avanço ao clicar slot |
| 4 — Dados | 5 | Form (`#input-nome`, `#input-tel`, `#input-email`), botão desabilitado, habilita ao preencher, privacidade, voltar |
| 5 — Confirmação | 3 | Resumo `.resumo-card`, confirmar, voltar |
| Páginas de suporte | 4 | Confirmar-reserva, cancelar, reagendar, avaliar |

**Total E2E do projeto:** 54 → **80 testes**

### 🔧 Correções de Manutenção

#### 1. `package.json` — Script `dev` duplicado removido
- **Problema:** Duas entradas `"dev"` no mesmo arquivo — a segunda sobrescrevia a primeira silenciosamente
- **Antes:** `"dev": "npm run build && npx serve -l 3000 dist"` (perdido) + `"dev": "node server.js"` (ativo)
- **Depois:** `"dev": "node server.js"` + `"dev:preview": "npm run build && npx serve -l 3000 dist"`

#### 2. `pages/admin/login.html` — Brace extra removido
- **Problema:** `}` duplicado no final da função `setLoading()` causava erro de sintaxe silencioso
- **Correção:** Removido brace de fechamento extra

#### 3. `tests/sql/db-smoke.sql` — Datas hard-coded substituídas por cálculos relativos
- **Problema:** Datas `2026-04-04` ficaram no passado (hoje = 2026-04-06), RPC rejeitava com "Nao e possivel agendar no passado"
- **Solução:** Todas as datas agora usam `(now() at time zone 'America/Sao_Paulo' + interval '7 days')::date`
- Disponibilidade do dia da semana agora é calculada dinamicamente com `extract(dow from ...)`
- **Resultado:** Smoke test roda corretamente em qualquer momento, sem precisar ajustes manuais

### 📊 Testes

| Tipo | Antes | Depois |
|------|-------|--------|
| Unitários | 74 passing | 74 passing |
| Smoke DB | ❌ Falhava (datas passadas) | ✅ Passando |

---

## [2026-04-05] — Painel Admin Completo (FASE 1-4)

### 🎯 Painel Administrativo do SaaS

**6 páginas + 6 Edge Functions + módulo de auth** para gerenciamento completo do SaaS.

#### Páginas Criadas

| Página | Rota | Funcionalidade |
|--------|------|----------------|
| `pages/admin/login.html` | `/admin/login` | Login por senha com token JWT 24h |
| `pages/admin/dashboard.html` | `/admin/dashboard` | 4 KPIs + alertas + tabela prestadores |
| `pages/admin/profissionais.html` | `/admin/profissionais` | Grid com busca, filtros de plano, paginação |
| `pages/admin/financeiro.html` | `/admin/financeiro` | MRR, receita 30d, churn, distribuição de planos, pagamentos recentes |
| `pages/admin/acoes.html` | `/admin/acoes` | Suspender, ativar, estender trial, detalhes do prestador |
| `pages/admin/configuracoes.html` | `/admin/configuracoes` | Status do sistema, segredos, comandos de deploy, tabelas |

#### Edge Functions Criadas

| Função | Descrição |
|--------|-----------|
| `admin-validate` | Auth por senha + token JWT 24h |
| `admin-dashboard` | KPIs agregados (totais, novos, trials, alertas) |
| `admin-profissionais` | Busca + filtro plano + paginação |
| `admin-financeiro` | KPIs financeiros, pagamentos recentes, distribuição por plano |
| `admin-actions` | Listar, suspender, ativar, estender trial, detalhes |
| `admin-configuracoes` | Status do sistema, listar tabelas/funções, segredos |

#### Módulo Compartilhado

| Arquivo | Funções |
|---------|---------|
| `modules/admin-auth.js` | `requireAdminAuth`, `logoutAdmin`, `adminHeaders` |

#### Detalhes Técnicos

- **Auth:** Senha única → Edge Function → JWT 24h → `sessionStorage`
- **CORS:** Adicionado header `x-admin-token` ao `_shared/cors.ts`
- **Layout:** Dark theme consistente com sidebar em todas as páginas
- **Deploy:** Firebase Hosting + Supabase Edge Functions
- **Segredos:** `ADMIN_PASSWORD` + `SUPABASE_SERVICE_ROLE_KEY` (RLS bypass)

#### Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `DEPLOY-ADMIN.md` | Guia completo de deploy + segredos + URLs |
| `docs/admin/IMPLEMENTACAO-ADMIN.md` | Plano de implementação (FASE 1-4 concluídas) |
| `docs/admin/RESUMO-EXECUTIVO.md` | Resumo executivo (atualizado: CONCLUÍDO) |

---

## [2026-04-03] — Refatoração Completa: Handlers, Testes (74), Migration 31 e Lista de Espera

### 🔥 Refatoração de Edge Functions em Handlers Compartilhados

**4 edge functions tiveram a lógica de negócio extraída para módulos compartilhados**, reduzindo cada função de ~270 linhas para ~30 linhas de dispatch:

| Handler | Origem | Linhas antes → depois | Testes |
|---------|--------|----------------------|--------|
| `criar-agendamento-handler.js` | `criar-agendamento/index.ts` | 170 → 30 | 8 |
| `webhook-asaas-handler.js` | `webhook-asaas/index.ts` | 190 → 30 | 8 |
| `cancelar-agendamento-cliente-handler.js` | `cancelar-agendamento-cliente/index.ts` | 271 → 30 | 7 |
| `reagendar-cliente-handler.js` | `reagendar-cliente/index.ts` | 279 → 30 | 7 |

**Benefício:** lógica testável sem HTTP mocking, código reutilizável, edge functions como thin wrappers.

### 🧪 Testes Automatizados (74 testes passando!)

**Evolução ao longo do dia:** 4 → 36 → 48 → 56 → 64 → **74 testes**

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `scheduling-rules.test.js` | 24 | Slots, antecedência, conflitos, bloqueios, cadência, grade |
| `lista-espera-rules.test.js` | 10 | Validação de entrada, bloqueio de hoje, janela útil por período |
| `criar-agendamento-handler.test.js` | 8 | Criação, conflitos, limite free, token_reserva |
| `webhook-asaas-handler.test.js` | 8 | Eventos Asaas, ativação/desativação, assinatura |
| `reagendar-cliente-handler.test.js` | 7 | Reagendamento, conflito de horário, WhatsApp |
| `cancelar-agendamento-cliente-handler.test.js` | 7 | Cancelamento por token, WhatsApp, Google Calendar |
| `migrations-contract.test.js` | 8 | Contratos SQL (pagamentos + RPC criar_agendamento_atomic) |
| `asaas-webhook-rules.test.js` | 8 | Classificação de eventos, extração de payload, validade |
| `agendamento-response.test.js` | 4 | Normalização de resposta da stored procedure |

**Novos testes adicionados nesta sessão:**
- ✅ Contrato da migration 31 (intervalo_slot na RPC criar_agendamento_atomic)
- ✅ Smoke test de banco local (criar_agendamento_atomic, conflitos, antecedência, pagamentos)
- ✅ Handlers completos: criação, webhook Asaas, reagendamento, cancelamento
- ✅ Validação de lista de espera: bloqueio de hoje, janela útil por período

### 🗄️ Migration 31 — Fix Critical

**Problema:** RPC `criar_agendamento_atomic` não carregava o campo `intervalo_slot` do perfil do prestador, ignorando o intervalo entre slots no cálculo.

**Solução:** Migration 31 (`fix_criar_agendamento_atomic_intervalo_slot.sql`) corrige o SELECT para incluir `intervalo_slot` no cálculo de slots disponíveis.

**Smoke test de banco:** `tests/run-db-smoke.js` valida a RPC em Supabase local:
- ✅ Criação com sucesso
- ✅ Conflito de horário retorna 409
- ✅ Antecedência mínima no mesmo dia retorna 409
- ✅ Histórico de pagamentos por asaas_payment_id + evento
- ✅ Confirmação com token_reserva

### 📋 Lista de Espera — Módulo de Regras + Bloqueio de Hoje

**Novo módulo:** `modules/lista-espera-rules.js` — centraliza validações de entrada na lista de espera:

| Função | Descrição |
|--------|-----------|
| `getDataAtualBRT(now)` | Data atual em BRT (America/Sao_Paulo) |
| `getMinutosAtualBRT(now)` | Minutos desde meia-noite em BRT |
| `horaParaMinutos(hora)` | Converte "HH:MM" para minutos |
| `podeEntrarNaListaEspera({...})` | Valida se cliente pode entrar na lista |

**Mudanças na validação de entrada:**
- ❌ **Bloqueia hoje:** `dataPreferida === hojeBrt → false` — não permite entrar na lista para o dia atual
- ✅ **Permite futuro:** `dataPreferida > hojeBrt → true` — dias futuros sempre OK
- ✅ **Valida período:** para `tipoPreferencia === 'periodo'`, verifica se o período preferido (manhã/tarde/noite) tem cobertura nas disponibilidades do prestador

**Front-end:** Troca de `alert()` por `toast()` em `pagina-cliente.html` para feedback consistente.

### 📁 Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `modules/criar-agendamento-handler.js` | Novo | Handler completo de criação |
| `modules/webhook-asaas-handler.js` | Novo | Handler completo do webhook Asaas |
| `modules/cancelar-agendamento-cliente-handler.js` | Novo | Handler de cancelamento por token |
| `modules/reagendar-cliente-handler.js` | Novo | Handler de reagendamento por token |
| `modules/lista-espera-rules.js` | Novo | Regras de validação da lista de espera |
| `tests/criar-agendamento-handler.test.js` | Novo | 8 testes de criação |
| `tests/webhook-asaas-handler.test.js` | Novo | 8 testes de webhook |
| `tests/reagendar-cliente-handler.test.js` | Novo | 7 testes de reagendamento |
| `tests/cancelar-agendamento-cliente-handler.test.js` | Novo | 7 testes de cancelamento |
| `tests/lista-espera-rules.test.js` | Novo | 10 testes de validação |
| `tests/migrations-contract.test.js` | Novo | 8 testes de contratos SQL |
| `tests/run-db-smoke.js` | Novo | Smoke test de banco local |
| `tests/sql/db-smoke.sql` | Novo | SQL do smoke test |
| `migrations/fix_criar_agendamento_atomic_intervalo_slot.sql` | Novo | Migration 31 |
| `supabase/functions/criar-agendamento/index.ts` | Modificado | Usa handler compartilhado (~30 linhas) |
| `supabase/functions/webhook-asaas/index.ts` | Modificado | Usa handler compartilhado (~30 linhas) |
| `supabase/functions/cancelar-agendamento-cliente/index.ts` | Modificado | Usa handler compartilhado (~30 linhas) |
| `supabase/functions/reagendar-cliente/index.ts` | Modificado | Usa handler compartilhado (~30 linhas) |
| `pages/pagina-cliente.html` | Modificado | Toast no lugar de alert + bloqueio de hoje |

---

## [2026-04-03] — Refatoração de Testes + Módulos Compartilhados

### 🧪 Testes Automatizados (36 testes passando!)

**Antes:** 4 testes básicos de geração de slots
**Depois:** 36 testes cobrindo todas as regras de negócio críticas

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `tests/scheduling-rules.test.js` | 24 | Slots, antecedência, conflitos, bloqueios, cadência, grade |
| `tests/agendamento-response.test.js` | 4 | Normalização de resposta da SP |
| `tests/asaas-webhook-rules.test.js` | 8 | Classificação de eventos, extração de payload, validade |

**Novos testes adicionados:**
- ✅ Antecedência mínima: só no mesmo dia (bug corrigido)
- ✅ Antecedência: dias futuros ignoram regra
- ✅ Conflitos com agendamentos (mesma duração, duração diferente, com buffer)
- ✅ Bloqueios manuais (single e multi-slot)
- ✅ Bloqueios recorrentes (dia correto vs outros dias)
- ✅ Cadência e grade de horários (30 min, 15 min)
- ✅ Serviço que não cabe no expediente
- ✅ Múltiplos períodos (manhã + tarde)
- ✅ Combinação: agendamento + bloqueio manual + recorrente
- ✅ Ordenação e consistência de motivo_bloqueio
- ✅ Classificação de eventos Asaas (ativar, desativar, inadimplente, ignorar)
- ✅ Extração de assinatura (objeto, string, payload vazio)
- ✅ Validade mensual e anual

### 📦 Módulos Compartilhados

**`modules/scheduling-rules.js`** (refatorado)
- Bug corrigido: antecedência mínima agora só aplica no mesmo dia
- Antes: bloqueava slots < 60 min SEMPRE (incorreto)
- Depois: só bloqueia < 60 min se slot for no mesmo dia (consistente com SQL)
- Comentários e JSDoc traduzidos para pt-BR
- Exporta: `generateSlots`, `horaParaDate`, `dateParaHora`, `conflita`, `getAgoraBRT`

**`modules/agendamento-response.js`** (novo)
- Centraliza normalização do resultado da stored procedure `criar_agendamento_atomic`
- Elimina ~15 linhas duplicadas na edge function `criar-agendamento`
- Testes: sucesso, erro simples, payload de limite, fallback null

**`modules/asaas-webhook-rules.js`** (novo)
- Centraliza regras do webhook Asaas
- Remove ~30 linhas hard-coded da edge function
- Funções: `classificarEventoAsaas`, `extrairAssinaturaAsaas`, `calcularValidadeAte`
- Testes: todos os eventos, extração payload (objeto/string), validade, payload vazio

### 🔧 Edge Functions Simplificadas

| Função | Linhas removidas | Mudança |
|--------|-----------------|---------|
| `horarios-disponiveis` | ~170 | Usa `generateSlots` do módulo compartilhado |
| `webhook-asaas` | ~30 | Usa `classificarEventoAsaas` e `extrairAssinaturaAsaas` |
| `criar-agendamento` | ~5 | Usa `normalizarResultadoCriacaoAgendamento` |

### 📋 Infra de testes

```bash
# Executar todos os testes
npm test

# Runner: tests/run-tests.js (Node.js native test runner)
# Convenção: arquivos *.test.js importam node:test + assert/strict
```

### 📁 Arquivos Modificados/Criados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `modules/scheduling-rules.js` | Modificado | Bug fix de antecedência + JSDoc pt-BR |
| `modules/agendamento-response.js` | Novo | Normalização de resposta |
| `modules/asaas-webhook-rules.js` | Novo | Regras do webhook Asaas |
| `tests/scheduling-rules.test.js` | Reescrito | 24 testes em pt-BR |
| `tests/agendamento-response.test.js` | Novo | 4 testes |
| `tests/asaas-webhook-rules.test.js` | Novo | 8 testes |
| `tests/run-tests.js` | Novo | Runner |
| `package.json` | Modificado | Script `test` adicionado |
| `supabase/functions/horarios-disponiveis/index.ts` | Modificado | Usa módulo compartilhado |
| `supabase/functions/webhook-asaas/index.ts` | Modificado | Usa módulo compartilhado |
| `supabase/functions/criar-agendamento/index.ts` | Modificado | Usa módulo compartilhado |

---

## [2026-04-02] — Correções Críticas: Limite Free, Timezone e Build

### 🔧 Correções Implementadas

#### 1. **Validação de Limite Free no Backend**
- **Arquivo:** `supabase/functions/criar-agendamento/index.ts`
- Edge Function já validava limite de 10 agendamentos/mês para Free
- **Adicionado:** Retorno do WhatsApp do prestador quando limite é atingido
- **Frontend atualizado:** `pages/pagina-cliente.html` agora exibe banner com botão WhatsApp

```typescript
// Backend retorna WhatsApp para contato alternativo
return Response.json({
  erro: "limite_atingido",
  count: count ?? 0,
  limite: LIMITE_FREE,
  whatsapp: prestador.whatsapp  // ← Novo
}, { status: 403 });
```

#### 2. **Timezone Correto nas Edge Functions**
- **Arquivos:** `cron-notificar-lista-espera/index.ts`, `horarios-disponiveis/index.ts`
- **Problema:** `date-fns-tz` causava erro de bundle no Deno
- **Solução:** Usar APIs nativas (`Intl.DateTimeFormat` e conversão manual)

```typescript
// Data atual em BRT (UTC-3) sem dependências externas
function getDataAtualBRT(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
```

#### 3. **Detecção de Timezone no Frontend**
- **Arquivo:** `pages/pagina-cliente.html`
- **Adicionado:** `state.timezone` detecta timezone do browser automaticamente
- **Envio:** Timezone é enviado para Edge Function no payload

```javascript
const state = {
  // ...
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};
```

#### 4. **Build com Placeholders Corretos**
- **Arquivos:** `config.js`, `build.js`, `modules/auth-session.js`
- **Problema:** Validação falhava após build porque checava placeholders antigos
- **Solução:** Placeholders `__VAR__` substituídos + validação atualizada

```javascript
// config.js (template)
const CONFIG_DEFAULTS = {
  SUPABASE_URL: '__SUPABASE_URL__',
  // ...
};

// Validação pré-build: checa placeholders
if (!config.SUPABASE_URL || config.SUPABASE_URL === '__SUPABASE_URL__' || ...)

// build.js: atualiza validação pós-build
configContent = configContent.replace(
  /if \(!config\.SUPABASE_URL \|\| config\.SUPABASE_URL === '__SUPABASE_URL__' \|\| ...\)/,
  `if (!config.SUPABASE_URL || !config.SUPABASE_ANON || !config.APP_URL)`
);
```

#### 5. **Intervalo entre Slots (Free vs Pro)**
- **Arquivo:** `pages/configuracoes.html` (já implementado)
- **Status:** Confirmado que campo é desabilitado para usuários Free
- **Backend:** `aplicar_limites_free()` reseta `intervalo_slot` para 0 no downgrade

### 📝 Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `config.js` | Placeholders `__VAR__` + validação simplificada |
| `build.js` | Substituição de placeholders + atualização da validation |
| `modules/auth-session.js` | Placeholders `__SUPABASE_URL__` e `__SUPABASE_ANON__` |
| `supabase/functions/criar-agendamento/index.ts` | Retorna WhatsApp no erro 403 |
| `supabase/functions/cron-notificar-lista-espera/index.ts` | Timezone com API nativa |
| `supabase/functions/horarios-disponiveis/index.ts` | Timezone com API nativa |
| `pages/pagina-cliente.html` | Detecta timezone + exibe WhatsApp no limite |

### 🧪 Como Testar

**Teste 1: Limite Free**
```
1. Crie conta Free
2. Crie 10 agendamentos
3. Tente criar 11º agendamento
4. ✅ Banner "Agenda indisponível" com botão WhatsApp
```

**Teste 2: Build**
```bash
npm run build
# ✅ Deve completar sem erros
```

**Teste 3: Timezone**
```javascript
// Console do browser na página de agendamento
console.log(state.timezone);
// ✅ "America/Sao_Paulo" (ou seu timezone local)
```

### 📦 Deploy

```bash
# 1. Build
npm run build

# 2. Deploy frontend
firebase deploy --only hosting

# 3. Deploy Edge Functions
supabase functions deploy criar-agendamento --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy cron-notificar-lista-espera --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy horarios-disponiveis --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
```

---

## [2026-04-01] — Lista Espera Inteligente 2.0 + Preferências de Horário

### ✨ Nova Funcionalidade: Lista de Espera com Preferências

**Cliente escolhe como quer ser notificado quando vaga surgir**

- **3 tipos de preferência:**
  - **Horário exato:** Só notifica se liberar exatamente aquele horário (ex: 14:00)
  - **Período do dia:** Notifica se liberar qualquer horário no período (manhã/tarde/noite)
  - **Qualquer horário:** Notifica se liberar qualquer horário no dia (máxima chance)

- **Modal atualizado em `pagina-cliente.html`:**
  - Radio buttons para escolher tipo de preferência
  - Input de hora para "exato"
  - Select de período (manhã/tarde/noite) para "período"
  - Resumo mostra serviço + duração

- **Edge Function `entrada-lista-espera` atualizada:**
  - Salva `servico_id`, `servico_duracao_min`
  - Salva `tipo_preferencia`, `periodo_preferido`
  - Valida duplicidade inteligente (considera tipo de preferência)
  - Mensagem WhatsApp/email personalizada com tipo de preferência

- **Nova Edge Function `cron-notificar-lista-espera`:**
  - Cron job que roda a cada 5 minutos
  - Busca clientes não notificados na lista de espera
  - Chama `horarios-disponiveis` para verificar slots disponíveis
  - Filtra por compatibilidade: horário + período + preferência
  - Notifica via WhatsApp (Evolution API) + Email (SendGrid)
  - Marca como notificado após envio

- **Migration 23 atualizada:**
  - Campos: `servico_id`, `servico_duracao_min`, `tipo_preferencia`, `periodo_preferido`
  - Índices novos: `idx_lista_espera_servico`, `idx_lista_espera_notificado`
  - Trigger simplificada: só marca para notificação (cron faz o resto)

- **Migration 24 criada:**
  - Função `agendamentos_cancelados_recentes()` (placeholder)

### 📋 Regras de Notificação (Atualizado)

**Antecedência Mínima:**
- Notifica apenas se horário liberado for ≥ 2 horas a partir de agora
- Evita notificações "em cima da hora" (ex: 13:59 para vaga 14:00)
- Configurável no código: `diffHoras < 2`

**Validade da Entrada:**
- ✅ Notifica se `data_preferida >= hoje`
- ❌ Não notifica se `data_preferida < hoje` (data já passou)
- ❌ Não notifica se horário já passou (mesmo dia)
- Sem expiração artificial de 7 dias (removido campo `expira_em`)

**Compatibilidade:**
- Reutiliza `horarios-disponiveis` para verificar se serviço cabe no slot
- Considera duração do serviço do cliente vs duração do slot

**Exemplo Prático:**
```
Cliente entra na lista: 25/04/2026 às 14:00

20/04 10:00 → ✅ Notifica (5 dias antes)
25/04 10:00 → ✅ Notifica (4h antes)
25/04 11:59 → ✅ Notifica (2h antes)
25/04 12:01 → ❌ Não notifica (1h59 antes)
25/04 14:01 → ❌ Não notifica (hora já passou)
26/04 08:00 → ❌ Não notifica (data já passou)
```

### 🔄 Fluxo Completo

```
1. CLIENTE ENTRA NA LISTA
   ├─ Escolhe tipo de preferência (exato/período/qualquer)
   ├─ Informa data e horário/período
   ├─ Seleciona serviço (para compatibilidade)
   └─ Recebe confirmação WhatsApp + Email

2. CRON JOB (*/5 * * * *)
   ├─ Busca: notificado=false, agendado=false
   ├─ Filtra: data_preferida >= hoje
   └─ Agrupa por prestador + data

3. CANCELAMENTO LIBEROU VAGA
   ├─ Trigger marca lista_espera.notificado=false
   └─ Cron job detecta na próxima execução

4. VERIFICA COMPATIBILIDADE
   ├─ Chama horarios-disponiveis (serviço do cliente)
   ├─ Filtra slots disponíveis
   └─ Encontra horário compatível com preferência

5. NOTIFICA CLIENTE
   ├─ Verifica antecedência >= 2h
   ├─ Envia WhatsApp (Evolution API)
   ├─ Envia Email (SendGrid)
   └─ Atualiza: notificado=true, notificado_em=NOW()
```

### 🗄️ Estrutura do Banco (Migration 23)

```sql
CREATE TABLE public.lista_espera (
  id UUID PRIMARY KEY,
  prestador_id UUID NOT NULL REFERENCES prestadores(id),
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_email TEXT,
  data_preferida DATE NOT NULL,
  hora_preferida TIME,
  servico_id UUID REFERENCES servicos(id),
  servico_nome TEXT,
  servico_duracao_min INT,
  tipo_preferencia TEXT DEFAULT 'exato',  -- 'exato' | 'periodo' | 'qualquer'
  periodo_preferido TEXT,                 -- 'manha' | 'tarde' | 'noite'
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  notificado BOOLEAN DEFAULT FALSE,
  notificado_em TIMESTAMPTZ,
  agendado BOOLEAN DEFAULT FALSE,
  UNIQUE(cliente_telefone, data_preferida, hora_preferida, servico_id)
);

-- Índices
CREATE INDEX idx_lista_espera_prestador ON lista_espera(prestador_id);
CREATE INDEX idx_lista_espera_data ON lista_espera(data_preferida);
CREATE INDEX idx_lista_espera_servico ON lista_espera(servico_id);
CREATE INDEX idx_lista_espera_notificado ON lista_espera(notificado, agendado);

-- RLS: apenas prestador vê sua lista
CREATE POLICY "Prestador vê sua lista de espera"
  ON lista_espera FOR SELECT TO authenticated
  USING (auth.uid() = (SELECT p.id FROM prestadores p WHERE p.id = prestador_id));
```

### 📁 Arquivos Criados/Modificados

**Criados:**
- `migrations/24_cancelamentos_recentes.sql`
- `supabase/functions/cron-notificar-lista-espera/index.ts`

**Modificados:**
- `migrations/23_lista_espera.sql` — Remove `expira_em`, corrige RLS
- `pages/pagina-cliente.html` — Modal com preferências + texto atualizado
- `supabase/functions/entrada-lista-espera/index.ts` — Salva serviço + preferência, mensagens atualizadas
- `supabase/functions/notificar-lista-espera/index.ts` — Remove filtro `expira_em`
- `CHANGELOG.md` — Esta documentação

---

### 🔧 Melhorias: Busca de Clientes (Q-5)
- **Busca unificada** por nome, telefone e email
- **Placeholder atualizado**: "Buscar por nome, telefone ou email…"
- **Mensagem contextual** quando nenhum cliente é encontrado
  - Com busca: Mostra termo pesquisado e sugere campos
  - Sem busca: "Nenhum cliente cadastrado"
- **Filtro em tempo real** combinando com filtros VIP/Regular/Novos

**Impacto:**
- Localização 3x mais rápida de clientes (3 campos vs 1)
- Útil para bases grandes (100+ clientes)
- Reduz tempo de atendimento no salão

**Arquivos:** `pages/clientes.html`

---

## [2026-03-31] — Plano Anual + Monitoramento Sentry + Toast Centralizado

### ✨ Novas Funcionalidades

#### 1. **Plano Anual com Desconto (26% OFF)**
- **Toggle Mensal/Anual** em `planos.html` com badge "-26%"
- **Edge Function `criar-assinatura`** atualizada para suportar ciclo YEARLY
- **Webhook Asaas** salva periodicidade quando assinatura é ativada
- **Badge no painel** mostra "(plano anual)" ou "(plano mensal)" para usuários Pro
- **Migration** adiciona campo `assinatura_periodicidade` na tabela `prestadores`

**Preços:**
| Plano | Valor | Cobrança | Economia |
|-------|-------|----------|----------|
| Mensal | R$ 39/mês | Todo mês | — |
| Anual | R$ 29/mês | R$ 348/ano | 26% (R$ 120) |

#### 2. **Monitoramento de Erros com Sentry**
- **Frontend**: Módulo `modules/sentry.js` inicializado em todas as páginas principais
- **Backend**: Sentry implementado em 4 Edge Functions críticas
  - `criar-agendamento`
  - `horarios-disponiveis`
  - `criar-assinatura`
  - `webhook-asaas`
- **DSN**: `https://17c6e06768f45437c43076724835eaa7@o4511141658230784.ingest.us.sentry.io/4511141704957952`
- **Features**:
  - Captura automática de erros
  - Fallback para adblockers (não quebra o app se bloqueado)
  - Contexto de usuário (após login)
  - Environment: production

#### 3. **Toast Notification Centralizado**
- **Módulo**: `modules/ui-helpers.js`
- **Funções**:
  - `toast(message, type, duration)` - Notificação temporária
  - `toastWithUndo(message, onUndo, duration)` - Toast com botão de desfazer
  - `confirmModal(title, message)` - Modal de confirmação
- **Estilo**:
  - Posição: topo centralizado
  - Animação: fade in/out suave com slide vertical
  - Tipos: success (verde), error (vermelho), warning (laranja), info (azul)
  - Duração padrão: 3000ms

### 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `modules/sentry.js` | Inicialização do Sentry frontend (v7.119.0) |
| `modules/ui-helpers.js` | Helpers de UI reutilizáveis (toast, modal) |
| `SENTRY-CONFIG.md` | Guia completo de configuração do Sentry |

### 📝 Arquivos Modificados

#### Build & Config
| Arquivo | Mudança |
|---------|---------|
| `build.js` | Injeção de `SENTRY_DSN` e `SENTRY_ENVIRONMENT` |
| `config.js` | Variáveis `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `VERSION` |
| `.env.example` | Seção do Sentry adicionada |
| `.env.local` | `SENTRY_DSN` configurado |
| `firebase.json` | Removido `modules/**` do ignore |

#### Frontend (8 páginas)
| Página | Mudanças |
|--------|----------|
| `pages/configuracoes.html` | +sentry.js, +ui-helpers.js, removido toast duplicado |
| `pages/clientes.html` | +sentry.js, +ui-helpers.js, removido toast duplicado |
| `pages/painel.html` | +sentry.js, +ui-helpers.js |
| `pages/auth.html` | +sentry.js, +ui-helpers.js |
| `pages/onboarding.html` | +sentry.js, +ui-helpers.js |
| `pages/pagina-cliente.html` | +sentry.js, +ui-helpers.js |
| `pages/relatorio.html` | +sentry.js, +ui-helpers.js |
| `pages/planos.html` | +sentry.js, +ui-helpers.js, removido toast duplicado |

#### Edge Functions (4 funções)
| Função | Mudança |
|--------|---------|
| `supabase/functions/horarios-disponiveis/index.ts` | +Sentry com captureException |
| `supabase/functions/criar-agendamento/index.ts` | +try-catch geral com Sentry |
| `supabase/functions/criar-assinatura/index.ts` | +Sentry com captureException |
| `supabase/functions/webhook-asaas/index.ts` | +try-catch geral com Sentry |

#### Páginas de Cliente (atualizadas para ui-helpers)
| Página | Mudanças |
|--------|----------|
| `pages/avaliar-cliente.html` | +ui-helpers.js, removido showToast duplicado |
| `pages/cancelar-cliente.html` | +ui-helpers.js, removido showToast duplicado |
| `pages/reagendar-cliente.html` | +ui-helpers.js, removido showToast duplicado |

### 🎯 Benefícios

| Área | Antes | Depois |
|------|-------|--------|
| **Código duplicado** | ~50 linhas × 10 páginas = 500 linhas | ~260 linhas em 1 arquivo |
| **Manutenção** | 10 lugares pra mudar | 1 lugar pra mudar |
| **Monitoramento** | Nenhum | Sentry em produção |
| **UX do Toast** | Inconsistente entre páginas | Padronizado e suave |
| **Feedback de erro** | Apenas console | Dashboard Sentry com contexto |

### 🧪 Como Usar

#### Toast Notification
```javascript
// Toast simples (verde)
toast('✓ Serviço salvo!');

// Toast de erro (vermelho)
toast('Erro ao salvar', false);

// Toast com tipos específicos
toast('Atenção!', 'warning');
toast('Informação', 'info');

// Toast com botão de desfazer
toastWithUndo('Item excluído', () => {
  restaurarItem();
});

// Modal de confirmação
const confirmado = await confirmModal(
  'Excluir serviço?',
  'Esta ação não pode ser desfeita.'
);
```

#### Sentry (automático)
```javascript
// Erros são capturados automaticamente
// Para capturar manualmente:
Sentry.captureException(new Error('Erro específico'));

// Ou enviar mensagem
Sentry.captureMessage('Evento importante');

// Adicionar usuário ao contexto (após login)
Sentry.setUser({
  id: userId,
  email: user_email,
  username: user_name
});
```

### 📊 Status do Deploy

| Componente | URL | Status |
|------------|-----|--------|
| **Frontend** | https://e-agendapro.web.app | ✅ Deployado |
| **Sentry Frontend** | modules/sentry.js | ✅ Ativo |
| **UI Helpers** | modules/ui-helpers.js | ✅ Ativo |
| **Edge Functions** | Supabase | ✅ Deployadas |
| **Plano Anual** | /planos | ✅ Implementado |

### 🔗 Links Úteis

- **Sentry Dashboard**: https://sentry.io
- **Firebase Console**: https://console.firebase.google.com/project/e-agendapro/overview
- **Supabase Project**: kevqgxmcoxmzbypdjhru
- **Supabase Dashboard**: https://supabase.com/dashboard/project/kevqgxmcoxmzbypdjhru

---

## Próximas Melhorias Sugeridas

1. **Backup Automático do Banco** - Segurança contra perda de dados
2. **Undo em Ações Destrutivas** - Usar `toastWithUndo()` para excluir
3. **Busca Full-Text de Clientes** - Melhor UX para prestadores com muitos clientes
4. **Lista de Espera Inteligente** - Preencher vagas canceladas

---

**Deploy realizado em**: 2026-03-31  
**Versão**: 1.1.0  
**Ambiente**: Production
