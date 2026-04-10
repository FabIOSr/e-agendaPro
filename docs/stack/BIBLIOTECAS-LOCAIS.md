# Bibliotecas Locais Aprovadas

> **Política:** Adicionar novas bibliotecas requer justificativa técnica documentada. Esta é a lista definitiva.

---

## 1. Lista de Bibliotecas Aprovadas

### 1.1 Core (sempre disponíveis)

| Biblioteca | Versão | Tamanho (gz) | Uso | Import |
|---|---|---|---|---|
| **Alpine.js** | 3.x | 15 KB | Reatividade declarativa em componentes de UI | `npm install alpinejs` → `import Alpine from 'alpinejs'` |
| **Tailwind CSS** | 4.x | ~12 KB (purged) | Sistema de design unificado | Via Vite (`@tailwindcss/vite`) |
| **Supabase JS** | 2.x | 50 KB | Cliente do banco de dados | `import { createClient } from '@supabase/supabase-js'` |

### 1.2 Funcionalidades Específicas

| Biblioteca | Versão | Tamanho (gz) | Uso | Onde |
|---|---|---|---|---|
| **Chart.js** | 4.x | 60 KB | Gráficos de relatórios e dashboard admin | `pages/relatorio.html`, `pages/admin/financeiro.html` |
| **Sentry Browser** | 8.x | 30 KB | Monitoramento de erros | Carregamento dinâmico via CDN (já implementado) |
| **Plausible** | — | <1 KB | Analytics privacy-first | Snippet inline no `<head>` |

### 1.3 Módulos Internos (código próprio)

Estes são módulos do próprio projeto, reutilizáveis entre páginas:

| Módulo | Caminho | Responsabilidade |
|---|---|---|
| `auth-session.js` | `modules/auth-session.js` | Sessão Supabase Auth, `requireAuth()`, `watchSession()` |
| `painel-init.js` | `modules/painel-init.js` | Proteção de rotas, gate de plano Pro, `exigirPro()` |
| `admin-auth.js` | `modules/admin-auth.js` | Auth do painel admin, `requireAdminAuth()`, `adminHeaders()` |
| `scheduling-rules.js` | `modules/scheduling-rules.js` | Geração de slots (espelha SQL `criar_agendamento_atomic`) |
| `agendamento-response.js` | `modules/agendamento-response.js` | Normalização de resposta da stored procedure |
| `asaas-webhook-rules.js` | `modules/asaas-webhook-rules.js` | Regras de classificação de eventos Asaas |
| `criar-agendamento-handler.ts` | `modules/criar-agendamento-handler.ts` | Handler de criação de agendamento |
| `webhook-asaas-handler.ts` | `modules/webhook-asaas-handler.ts` | Handler do webhook Asaas |
| `cancelar-agendamento-cliente-handler.ts` | `modules/cancelar-agendamento-cliente-handler.ts` | Handler de cancelamento por token |
| `reagendar-cliente-handler.ts` | `modules/reagendar-cliente-handler.ts` | Handler de reagendamento por token |
| `lista-espera-rules.js` | `modules/lista-espera-rules.js` | Regras de validação da lista de espera |
| `ui-helpers.js` | `modules/ui-helpers.js` | Toast, modais, helpers de UI |
| `sentry.js` | `modules/sentry.js` | Inicialização do Sentry (fallback gracioso) |
| `logger.ts` | `modules/logger.ts` | Logger estruturado com níveis |
| `analytics.js` | `modules/analytics.js` | Eventos Plausible tipados |
| `relatorio-pdf.js` | `modules/relatorio-pdf.js` | Geração de relatório PDF |

---

## 2. Bibliotecas Expressamente Não Aprovadas

Estas bibliotecas **não devem ser adicionadas** ao projeto sem aprovação explícita via RFC.

| Biblioteca | Motivo da Rejeição |
|---|---|
| **React / ReactDOM** | 150 KB+, requer JSX, overkill para o escopo atual |
| **Vue.js** | 100 KB+, requer SFCs, meio-termo sem vantagem real |
| **Next.js** | Muda stack para Node.js, incompatível com Firebase Hosting |
| **Astro** | SEO não é prioridade, migração de 6-8 semanas sem benefício tangível |
| **Svelte** | Requer compilação, comunidade menor |
| **Angular** | Framework completo, exagero total para o projeto |
| **jQuery** | Antipadrão, Alpine.js já resolve manipulação de DOM |
| **Lodash** | Tree-shaking do Vite + vanilla JS resolvem |
| **Moment.js** | 300 KB — usar `Intl.DateTimeFormat` nativo do browser |
| **Day.js** | Desnecessário — `Intl` + funções utilitárias locais bastam |
| **Bootstrap** | Conflito com Tailwind, CSS pesado |
| **FontAwesome** | 100 KB+ — usar SVG inline ou Heroicons via CDN |
| **Axios** | `fetch` nativo resolve, Supabase client já abstrai |

---

## 3. Guia de Adição de Nova Biblioteca

Para adicionar uma biblioteca não-listada:

1. **Justificar por escrito** — criar RFC em `docs/stack/RFC-nome-da-lib.md`
2. **Avaliar alternativas** — existe solução com vanilla JS ou biblioteca já aprovada?
3. **Medir impacto** — tamanho gz, dependências transitivas, compatibilidade com Firebase Hosting
4. **Aprovação** — discussão e aprovação antes do `npm install`

### Template de RFC

```markdown
# RFC — Adicionar [Nome da Biblioteca]

## Problema
[Descrever o problema que a biblioteca resolve]

## Alternativas Avaliadas
[O que já foi tentado com as libs atuais?]

## Impacto
- Tamanho gz: X KB
- Dependências transitivas: Y
- Compatível com Firebase Hosting: sim/não

## Uso Proposto
[Exemplo de código]

## Alternativa Rejeitada
[Por que não usar solução existente?]
```

---

## 4. Versões Atuais no Projeto

```json
{
  "dependencies": {},
  "devDependencies": {
    "@playwright/test": "^1.59.1",
    "dotenv": "^16.3.1",
    "vite": "^6.x",
    "@tailwindcss/vite": "^4.x",
    "tailwindcss": "^4.x",
    "chart.js": "^4.x"
  }
}
```

**Nota:** `alpinejs`, `@supabase/supabase-js` e `@sentry/browser` são carregados via CDN nos HTML files — não precisam estar no `package.json`.

---

## 5. CDN vs npm — Quando Usar Cada Um

| Via npm (Vite) | Via CDN |
|---|---|
| Alpine.js (15 KB, versionado) | Sentry (carregamento dinâmico com fallback) |
| Tailwind CSS (precisa purge no build) | Plausible (snippet <1 KB) |
| Chart.js (bundle com tree-shaking) | |
| Supabase JS (import type-safe) | |
| Módulos internos (tree-shaking) | |

**Regra geral:** Se a biblioteca participa do build (precisa purge, tree-shaking ou minificação) → npm. Se é carregada dinamicamente com fallback gracioso → CDN.

---

## 6. Ícones

O projeto **não usa** biblioteca de ícones no momento. Recomenda-se:

### ✅ Aprovado
- **Heroicons** — SVG inline, 1.5 KB por ícone, mesmo criador do Tailwind
- **Lucide Icons** — SVG inline, consistente com o design system

### ❌ Não aprovado
- FontAwesome (100 KB+ de CSS/JS)
- Material Icons (requer fonte, FOUT)

### Como usar Heroicons

```html
<!-- Ícone inline (sem dependência) -->
<svg class="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
</svg>
```

---

## 7. Histórico de Decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-04-10 | Alpine.js aprovado | Reatividade leve para HTML estático |
| 2026-04-10 | Tailwind CSS v4 aprovado | Centralização de tokens de design |
| 2026-04-10 | Vite aprovado | Build step mínimo (minify + purge) |
| 2026-04-10 | Chart.js aprovado | Gráficos nos relatórios |
| 2026-04-10 | React/Vue/Angular rejeitados | Overkill para escopo atual |
| 2026-04-10 | Next.js rejeitado | Incompatível com Firebase Hosting |
| 2026-04-10 | Astro rejeitado | SEO não é prioridade |
