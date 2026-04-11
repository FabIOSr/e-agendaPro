# Plano de Migração — Alpine.js + Tailwind + Vite

> **Duração estimada:** 2-3 semanas (1 dev)
> **Estratégia:** Página por página, sem big bang, sem parar o produto

---

## 1. Fase 0 — Setup Inicial (1-2 dias)

### Tarefas

| # | Tarefa | Arquivo(s) | Tempo |
|---|---|---|---|
| 0.1 | Instalar dependências | `package.json` | 15 min |
| 0.2 | Criar `vite.config.js` | `vite.config.js` | 30 min |
| 0.3 | Criar `tailwind.config.js` | `tailwind.config.js` | 30 min |
| 0.4 | Criar `src/styles/main.css` | `src/styles/main.css` | 30 min |
| 0.5 | Configurar `.env.local` | `.env.local` | 10 min |
| 0.6 | Adaptar scripts do `package.json` | `package.json` | 10 min |
| 0.7 | Testar `npm run dev` | — | 30 min |
| 0.8 | Testar `npm run build` | — | 30 min |
| 0.9 | Verificar que `dist/` é compatível com Firebase Hosting | — | 30 min |
| 0.10 | Rodar todos os 177 testes | `npm test && npm run test:e2e` | 15 min |

### Critério de conclusão

```bash
npm run dev        # ✅ Server sobe na porta 3000
npm run build      # ✅ dist/ gerado sem erros
firebase deploy --only hosting  # ✅ Deploy funciona
npm test           # ✅ 74 testes passando
npm run test:e2e   # ✅ 102 testes E2E passando
```

---

## 2. Fase 1 — Landing Page ✅ CONCLUÍDA

**Página:** `pages/landing-page.html`
**Complexidade:** Baixa — página estática, sem estado complexo
**Status:** ✅ **MIGRADA** — 2026-04-11

### Tarefas

| # | Tarefa | Status |
|---|---|---|
| 1.1 | Adicionar `<script type="module">` | ✅ Feito — entry point Vite em `src/app.js` |
| 1.2 | Importar `main.css` | ✅ Feito — `src/style.css` com `@import tailwindcss` + `@theme` |
| 1.3 | Converter CSS inline → classes Tailwind | ✅ Feito — ~600 linhas → ~50 linhas CSS mínimo |
| 1.4 | Preservar JS vanilla | ✅ Feito — `smoothScrollTo()`, `toggleFaq()`, `IntersectionObserver` intactos |
| 1.5 | Testar visualmente | ✅ Aprovado — eyebrow, ticks ✓, mockup, navbar mobile |
| 1.6 | Configurar breakpoints responsivos | ✅ Feito — 500px, 900px customizados |
| 1.7 | Copiar `modules/` no build | ✅ Feito — `vite.config.js` copia para `dist/modules/` |
| 1.6 | Rodar E2E da landing page | `npm run test:e2e -- tests/e2e/landing-page.spec.ts` |

### Padrões Alpine nesta página

```html
<!-- FAQ Accordion -->
<div x-data="{ open: null }">
  <template x-for="(faq, i) in faqs" :key="i">
    <div>
      <button @click="open === i ? open = null : open = i">
        <span x-text="faq.pergunta"></span>
      </button>
      <div x-show="open === i" x-collapse>
        <p x-text="faq.resposta"></p>
      </div>
    </div>
  </template>
</div>
```

### Critério de conclusão

- [ ] Visual idêntico à versão atual
- [ ] 13 testes E2E da landing passando
- [ ] CSS purged: apenas classes usadas no bundle final

---

## 3. Fase 2 — Auth + Onboarding ✅ CONCLUÍDA

**Páginas:** `pages/auth.html`, `pages/onboarding.html`
**Complexidade:** Baixa — formulários simples
**Status:** ✅ **MIGRADAS** — 2026-04-11

### Tarefas

| # | Tarefa | Status |
|---|---|---|
| 2.1 | Migrar CSS → Tailwind (auth) | ✅ Feito — ~336 → ~50 linhas |
| 2.2 | Migrar CSS → Tailwind (onboarding) | ✅ Feito — ~380 → ~56 linhas |
| 2.3 | Tokens dark + light no @theme | ✅ Feito — src/style.css |
| 2.4 | Manter `auth-session.js` | ✅ Feito — JS vanilla preservado |
| 2.5 | Proteção de rota (onboarding) | ✅ Feito — redirect para /painel se slug existe |
| 2.6 | Correções visuais pós-migração | ✅ Feito — padding inputs, slug prefix gap |
| 2.7 | Testar fluxo completo | ✅ Cadastro → login → redirect → onboarding |
| 2.8 | Build Vite validado | ✅ 19 HTMLs com assets injetados |

### Notas

- Alpine.js **não** utilizado nestas páginas — JS vanilla é suficiente para formulários simples
- Elementos dinâmicos (serviços, dias) do onboarding gerados com classes Tailwind via JS
- Elementos dinâmicos (serviços, dias) gerados com classes Tailwind no JS (`adicionarServico()`, `renderDias()`)

### Critério de conclusão

- [x] CSS migrado para Tailwind em ambas as páginas
- [x] JS vanilla funcionando sem alterações de comportamento
- [x] Proteção de rota no onboarding (redirect se slug existe)
- [x] Build Vite passando
- [x] Responsividade mantida com breakpoints inline

---

## 4. Fase 3 — Painel do Prestador (3-4 dias)

**Páginas:** `pages/painel.html`, `pages/clientes.html`, `pages/relatorio.html`
**Complexidade:** Alta — estado complexo, listas, gráficos

### 4.1 Painel Principal (`painel.html`)

| # | Tarefa | Detalhe |
|---|---|---|
| 3.1 | Tailwind no layout | Sidebar, header, grid de cards |
| 3.2 | Alpine para dados | `x-data="painelPrestador()"` com `init()` async |
| 3.3 | Lista de agendamentos | `x-for` com paginação |
| 3.4 | Status badges | Classes condicionais (`x-bind:class`) |
| 3.5 | Manter `painel-init.js` | `requireAuth()`, `watchSession()`, `exigirPro()` |

```html
<div x-data="painelData()" x-init="init()">
  <div x-show="loading" class="text-text-muted">Carregando...</div>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="bg-bg-3 border border-bord rounded-card p-6">
      <div class="text-text-muted text-xs uppercase">Hoje</div>
      <div class="text-3xl font-bold text-text" x-text="hojeCount"></div>
    </div>
  </div>
  <template x-for="ag in agendamentos" :key="ag.id">
    <div class="border border-bord rounded-btn p-4"
         :class="ag.status === 'confirmado' ? 'border-l-2 border-lime' : ''">
      <span x-text="ag.cliente_nome"></span>
      <span x-text="formatarHora(ag.data_hora)" class="font-mono text-text-muted"></span>
    </div>
  </template>
</div>
```

### 4.2 Clientes (`clientes.html`)

| # | Tarefa | Detalhe |
|---|---|---|
| 3.6 | Busca com Alpine | `x-model="query"` + getter `filtrados` |
| 3.7 | Filtros de segmento | VIP, Regular, Novos — Alpine reatividade |
| 3.8 | Tailwind nas tabelas/cards | Layout responsivo |

### 4.3 Relatórios (`relatorio.html`)

| # | Tarefa | Detalhe |
|---|---|---|
| 3.9 | Chart.js com Alpine | `x-init` para inicializar gráfico |
| 3.10 | Tailwind no layout | Grid de gráficos |

```html
<div x-data="relatorioData()" x-init="initCharts()">
  <canvas id="chart-receita"></canvas>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script>
function relatorioData() {
  return {
    receitaMensal: [],
    initCharts() {
      // Carregar dados do Supabase
      // Criar Chart.js
    }
  };
}
</script>
```

### Critério de conclusão

- [ ] Todos os testes E2E do painel passando
- [ ] Gráficos renderizando corretamente
- [ ] Busca de clientes funcionando em tempo real
- [ ] Proteção de rotas (`requireAuth`) intacta

---

## 5. Fase 4 — Página Pública do Profissional (3-4 dias)

**Página:** `pages/pagina-cliente.html`
**Complexidade:** Alta — fluxo de 5 steps, cor dinâmica, galeria

### Tarefas

| # | Tarefa | Detalhe |
|---|---|---|
| 4.1 | Tailwind no layout | Hero, serviços, calendário, slots |
| 4.2 | Alpine para estado do booking | `x-data="bookingState()"` com 5 steps |
| 4.3 | Accent dinâmico | `setProperty('--color-accent', cor_tema)` |
| 4.4 | Galeria de fotos | Grid 3×3 com Alpine `x-for` |
| 4.5 | Lista de espera | Modal com Alpine `x-show` |
| 4.6 | Rating/avaliações | Seção Pro com `x-show="isPro"` |
| 4.7 | Testar fluxo completo | 5 steps → confirmação → WhatsApp |

```html
<div x-data="bookingPage()" x-init="init()">
  <!-- Hero -->
  <div id="hero" class="bg-gradient-to-br from-accent to-accent-m text-white rounded-b-3xl p-8">
    <img :src="prestador?.foto_url" class="w-20 h-20 rounded-full" />
    <h1 x-text="prestador?.nome" class="font-instr-s text-2xl"></h1>
  </div>

  <!-- Steps -->
  <div class="flex gap-2 mb-6">
    <template x-for="(_, i) in 5" :key="i">
      <div class="flex-1 h-1 rounded-full"
           :class="i <= currentStep ? 'bg-accent' : 'bg-border'"></div>
    </template>
  </div>

  <!-- Step 1: Serviços -->
  <div x-show="currentStep === 0">
    <template x-for="s in servicos" :key="s.id">
      <button @click="selectServico(s)"
              class="border rounded-page p-4 w-full text-left transition"
              :class="selectedServico?.id === s.id ? 'border-accent bg-accent-l' : 'border-border'">
        <span x-text="s.nome"></span>
        <span x-show="s.exibir_preco" class="font-mono text-accent" x-text="'R$ ' + s.preco"></span>
      </button>
    </template>
  </div>
</div>
```

### Critério de conclusão

- [ ] 50 testes E2E do booking flow passando
- [ ] Cor de tema custom aplicada corretamente
- [ ] Galeria Pro funcionando
- [ ] Lista de espera funcionando
- [ ] Fluxo de 5 steps completo

---

## 6. Fase 5 — Configurações (2-3 dias)

**Páginas:** `pages/configuracoes.html`, `pages/planos.html`
**Complexidade:** Média — muitos formulários, toggles, upload

### Tarefas

| # | Tarefa | Detalhe |
|---|---|---|
| 5.1 | Tailwind em todos os forms | Inputs, toggles, seleções |
| 5.2 | Alpine para toggles | Exibir preço, serviços ativos |
| 5.3 | Toast com undo | `toastWithUndo` de `ui-helpers.js` |
| 5.4 | Modal de cancelamento (planos) | Survey com Alpine |
| 5.5 | Galeria de fotos | Adicionar/remover URLs com Alpine |

### Critério de conclusão

- [ ] Todos os forms salvando corretamente
- [ ] Toast de feedback funcionando
- [ ] Survey de cancelamento idêntico ao atual
- [ ] Galeria Pro com até 9 URLs

---

## 7. Fase 6 — Páginas de Token (1 dia)

**Páginas:** `pages/cancelar-cliente.html`, `pages/reagendar-cliente.html`, `pages/avaliar-cliente.html`, `pages/confirmar-reserva.html`
**Complexidade:** Baixa — páginas simples com token URL

### Tarefas

| # | Tarefa | Detalhe |
|---|---|---|
| 6.1 | Migrar CSS → Tailwind | Layout simples |
| 6.2 | Manter handlers existentes | `cancelar-agendamento-cliente-handler.ts`, etc. |
| 6.3 | Alpine para feedback visual | Loading, sucesso, erro |

### Critério de conclusão

- [ ] 3 testes E2E de cancelamento/reagendamento passando
- [ ] Token URL funcionando corretamente
- [ ] WhatsApp enviado após ações

---

## 8. Fase 7 — Painel Admin (2-3 dias)

**Páginas:** `pages/admin/*.html` (6 páginas)
**Complexidade:** Média — dashboards, tabelas, ações

### Tarefas

| # | Tarefa | Detalhe |
|---|---|---|
| 7.1 | Tailwind no layout admin | Sidebar, header, tabelas |
| 7.2 | Alpine para dashboard | KPIs com reatividade |
| 7.3 | Chart.js no financeiro | Gráficos de receita, churn |
| 7.4 | Manter `admin-auth.js` | `requireAdminAuth()`, `adminHeaders()` |
| 7.5 | Busca de profissionais | Alpine `x-model` + debounce |

### Critério de conclusão

- [ ] 6 páginas admin funcionando
- [ ] Gráficos financeiros renderizando
- [ ] Ações admin (suspender, ativar, estender trial) funcionando
- [ ] Auth admin intacta

---

## 9. Fase 8 — Limpeza Final (1-2 dias)

### Tarefas

| # | Tarefa | Detalhe |
|---|---|---|
| 8.1 | Remover `build.js` | Substituído pelo Vite |
| 8.2 | Remover `config.js` placeholders | Usar `import.meta.env` |
| 8.3 | Remover `:root` variáveis CSS | Apenas onde ainda necessário |
| 8.4 | Remover `.js` duplicados pelos `.ts` | Handlers migrados |
| 8.5 | Verificar bundle final | `npm run build -- --mode production` |
| 8.6 | Rodar TODOS os testes | `npm test && npm run test:e2e` |
| 8.7 | Deploy de validação | `firebase deploy --only hosting` |
| 8.8 | Testar em produção | Fluxo completo no app real |

### Métricas de Sucesso

| Métrica | Antes | Depois (meta) |
|---|---|---|
| Bundle JS total | ~500 KB (sem minificar) | ~200 KB (minificado + tree-shaken) |
| Bundle CSS total | ~150 KB (sem purge) | ~25 KB (purged) |
| Tempo de dev | Sem HMR | HMR < 100ms |
| 177 testes | ✅ Passando | ✅ Passando |
| Lighthouse Performance | ~70 | ~85+ |

---

## 10. Riscos e Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Break em algum teste E2E | Média | Médio | Rodar testes após cada fase, reverter se falhar |
| Tailwind purge remove classe usada via JS | Baixa | Alto | Audit de classes com `safelist` no config |
| Alpine conflita com JS vanilla existente | Baixa | Médio | Usar `x-cloak` e testar página por página |
| Vite muda estrutura de paths | Baixa | Alto | Manter `output.fileNames` compatível com estrutura atual |
| Cor de tema custom (accent) não funciona | Baixa | Médio | Manter `setProperty` como hoje, Tailwind só define default |

---

## 11. Cronograma Sugerido

```
Semana 1:
  Seg-Ter → Fase 0 + Fase 1 (Setup + Landing)
  Qua     → Fase 2 (Auth + Onboarding)
  Qui-Sex → Fase 3.1-3.5 (Painel: layout + agendamentos)

Semana 2:
  Seg-Ter → Fase 3.6-3.10 (Painel: clientes + relatórios)
  Qua-Qui → Fase 4 (Página pública: 5 steps)
  Sex     → Fase 5 (Configurações + Planos)

Semana 3:
  Seg     → Fase 6 (Páginas de token)
  Ter-Qua → Fase 7 (Painel Admin)
  Qui-Sex → Fase 8 (Limpeza + Deploy final)
```

---

## 12. Checklist Geral

- [x] Fase 0: Setup completo, testes passando
- [x] Fase 1: Landing page migrada
- [x] Fase 2: Auth + Onboarding migrados
- [ ] Fase 3: Painel (painel + clientes + relatorio) migrado
- [ ] Fase 4: Página pública migrada
- [ ] Fase 5: Configurações + Planos migrados
- [ ] Fase 6: Páginas de token migradas
- [ ] Fase 7: Painel Admin migrado
- [ ] Fase 8: Limpeza final, build otimizado, deploy validado
- [ ] 177 testes passando
- [ ] Lighthouse > 85 em todas as páginas principais
