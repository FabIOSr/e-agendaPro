# 🧪 Guia de Testes — AgendaPro

## Resumo

| Tipo | Quantidade | Runner | Arquivos |
|------|-----------|--------|----------|
| **Unitários** | 74 | Node.js `node:test` | `tests/*.test.js` (10 arquivos) |
| **E2E (Playwright)** | 102 | Playwright | `tests/e2e/*.spec.ts` (7 arquivos) |
| **Smoke DB** | 1 assert | psql via Docker | `tests/sql/db-smoke.sql` |
| **Total** | **177** | — | — |

---

## 1. Testes Unitários

### Como rodar

```bash
npm test
```

**O que faz:** executa `tests/run-tests.js`, que importa todos os 10 arquivos `.test.js` usando `node:test` (runner nativo do Node 20+). Sem dependências externas.

### Arquivos cobertos

| Arquivo | Tests | O que testa |
|---------|-------|-------------|
| `scheduling-rules.test.js` | 24 | Geração de slots, disponibilidade, conflitos de horário |
| `lista-espera-rules.test.js` | 9 | Regras de entrada, timeout de reserva, preferências |
| `asaas-webhook-rules.test.js` | 8 | Classificação de eventos Asaas (pagamento, ciclo, trial) |
| `migrations-contract.test.js` | 9 | Contratos de migração de banco (colunas, tipos, constraints) |
| `criar-agendamento-handler.test.js` | 6 | Handler de criação: validação, Supabase mock, CORS, erros |
| `webhook-asaas-handler.test.js` | 6 | Webhook de pagamento: ativação, downgrade, plano inválido |
| `reagendar-cliente-handler.test.js` | 4 | Reagendamento por token: validação, conflito, sucesso |
| `cancelar-agendamento-cliente-handler.test.js` | 4 | Cancelamento por token: GET (render) + POST (confirmar) |
| `agendamento-response.test.js` | 4 | Normalização de resposta de criação de agendamento |
| `cancel-survey.test.js` | — | Testes de survey de cancelamento (validação) |

### Padrão de escrita

Usa o runner nativo do Node.js (`node:test`) com assertions estritas:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('deve criar agendamento e retornar id', async () => {
  const req = createRequest({ prestador_id: 'p1', servico_id: 's1', ... });
  const res = await handleCriarAgendamentoRequest(req, depsMock);
  const body = await res.json();
  assert.equal(body.ok, true);
});
```

### Como adicionar um teste unitário

1. Crie ou edite um arquivo `tests/nome-do-modulo.test.js`
2. Use `test('descrição', async () => { ... })`
3. Use `assert.equal()`, `assert.ok()`, `assert.throws()` para assertions
4. Importe o módulo alvo com caminho relativo (`../modules/...`)
5. Mocke dependências externas (Supabase, fetch, etc.) com objetos simples
6. Adicione o import em `tests/run-tests.js` se for um arquivo novo:

```js
// tests/run-tests.js
import './nome-do-modulo.test.js';  // ← adicionar aqui
```

---

## 2. Testes E2E (Playwright)

### Como rodar

```bash
# Headless (CI / terminal)
npm run test:e2e

# Com UI interativa (Playwright Test Runner)
npm run test:e2e:ui

# Abre navegador para debug visual
npm run test:e2e:headed
```

### Configuração (`playwright.config.ts`)

| Setting | Valor |
|---------|-------|
| `testDir` | `./tests/e2e` |
| `baseURL` | `http://localhost:3000` |
| `webServer` | `node server.js` (sobe automaticamente) |
| `projects` | Chromium Desktop + Pixel 5 (Mobile) |
| `retries` | 0 |
| `screenshot` | `only-on-failure` |
| `video` | `retain-on-failure` |
| `reporter` | HTML (`playwright-report/`) + List |

### Arquivos cobertos

| Arquivo | Tests | O que testa |
|---------|-------|-------------|
| `booking-flow.spec.ts` | 25 | Fluxo completo de agendamento na página pública (5 steps) |
| `dashboard.spec.ts` | 38 | Painel admin: agenda, clientes, horários, filtros |
| `landing-page.spec.ts` | 13 | Landing page: hero, features, CTA, responsividade |
| `auth.spec.ts` | 12 | Login, logout, sessão, redirecionamentos |
| `internal-pages.spec.ts` | 9 | Páginas internas: configuracoes, planos, relatórios |
| `cancelamento-reagendamento.spec.ts` | 3 | Cancelamento e reagendamento por token |
| `onboarding.spec.ts` | 2 | Fluxo de onboarding de novo usuário |

### Padrão de escrita

```ts
import { test, expect } from '@playwright/test';

test('deve exibir step 1 (Serviço) como ativo', async ({ page }) => {
  await page.goto('/ana-cabelos');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#sc-1')).toHaveClass(/active/);
});
```

### Como adicionar um teste E2E

1. Crie `tests/e2e/nome-do-teste.spec.ts`
2. Use `test('descrição', async ({ page }) => { ... })`
3. Navegue com `page.goto('/rota')`
4. Assert com `expect(locator).toBeVisible()`, `toHaveText()`, etc.
5. O `webServer` sobe automaticamente via `node server.js`

---

## 3. Smoke Tests do Banco (DB)

### Como rodar

```bash
npm run test:db:local
```

**O que faz:** executa `tests/sql/db-smoke.sql` via `psql` dentro do container Docker do Supabase local. Valida:

- ✅ Criação de usuário e prestador
- ✅ `criar_agendamento_atomic()` — criação válida
- ✅ Conflito de horário (espera 409)
- ✅ Antecedência mínima (espera 409)
- ✅ Idempotência de eventos de pagamento (unique constraint)
- ✅ Fluxo de lista de espera com `token_reserva`
- ✅ Rollback no final (não deixa lixo)

### Pré-requisitos

- Docker rodando
- Supabase local ativo: `supabase start`
- Container do DB acessível (default: `supabase_db_agendapro`)

Se o container tiver nome diferente:

```bash
SUPABASE_DB_CONTAINER=meu_container npm run test:db:local
```

---

## 4. CI/CD — Pipeline Automatizado

Arquivo: `.github/workflows/ci-cd.yml`

### Fluxo

```
push / PR → main
    │
    ├─ test ─────── npm ci → npm test
    │
    ├─ build ────── (após test passar)
    │                npm ci → npm run build → upload dist/
    │
    └─ deploy ───── (apenas em main, não em PRs)
                     download dist/ → firebase deploy
```

### O que bloqueia deploy

| Etapa | Bloqueia? |
|-------|-----------|
| **Tests falharem** | ✅ Build nem roda |
| **Build falhar** | ✅ Deploy nem roda |
| **PR (não-main)** | ✅ Deploy não executa |

### Secrets necessários no GitHub

| Secret | Onde configurar |
|--------|----------------|
| `SUPABASE_URL` | Settings → Secrets → Actions |
| `SUPABASE_ANON` | Settings → Secrets → Actions |
| `APP_URL` | Settings → Secrets → Actions |
| `SENTRY_DSN` | Settings → Secrets → Actions |
| `FIREBASE_SERVICE_ACCOUNT` | Settings → Secrets → Actions |
| `FIREBASE_PROJECT_ID` | Settings → Secrets → Actions |

---

## 5. Cobertura Atual e Gaps

### ✅ O que está testado

| Área | Cobertura |
|------|-----------|
| Geração de slots / disponibilidade | ✅ 24 testes |
| Lista de espera (regras) | ✅ 9 testes |
| Webhook Asaas (classificação) | ✅ 8 testes |
| Criação de agendamento (handler) | ✅ 6 testes |
| Webhook Asaas (handler) | ✅ 6 testes |
| Reagendamento por token | ✅ 4 testes |
| Cancelamento por token | ✅ 4 testes |
| Migrações de banco | ✅ 9 testes |
| Booking flow completo (E2E) | ✅ 25 testes |
| Dashboard (E2E) | ✅ 38 testes |
| Landing page (E2E) | ✅ 13 testes |
| Auth / Sessão (E2E) | ✅ 12 testes |

### ⚠️ Gaps identificados

| Área | Status | Prioridade |
|------|--------|-----------|
| Módulo `analytics.js` | ❌ Sem testes unitários | Média |
| Módulo `logger.ts` (frontend) | ❌ Sem testes unitários | Baixa |
| Módulo `auth-session.js` | ❌ Sem testes unitários | Média |
| Módulo `ui-helpers.js` | ❌ Sem testes unitários | Baixa |
| Módulo `admin-auth.js` | ❌ Sem testes unitários | Baixa |
| Edge Functions (TypeScript) | ❌ Sem testes isolados | Média |
| Módulo `sentry.js` | ❌ Sem testes unitários | Baixa |
| Módulo `agendamento-response.js` (handler) | ✅ 4 testes | — |
| Módulo `cancel-survey.test.js` | ⚠️ 0 testes detectados (arquivo existe) | Verificar |

### Sugestão de expansão

1. **`analytics.js`** — Mock de `fetch` e `plausible()`, validar que eventos são disparados
2. **`auth-session.js`** — Testar criação/validação de sessão, expiração
3. **Edge Functions** — Testar `_shared/cors.ts`, `_shared/rate-limit.ts` isoladamente
4. **`cancel-survey.test.js`** — Verificar se o arquivo tem testes com sintaxe diferente

---

## 6. Referência Rápida de Comandos

| Comando | O que faz |
|---------|-----------|
| `npm test` | Roda todos os testes unitários (74) |
| `npm run test:e2e` | Roda todos os testes E2E headless (102) |
| `npm run test:e2e:ui` | Abre Playwright UI interativa |
| `npm run test:e2e:headed` | Roda E2E com navegador visível |
| `npm run test:db:local` | Smoke test do banco via Docker |
| `npx playwright test --reporter=html` | Gera relatório HTML em `playwright-report/` |
| `npx playwright show-report` | Abre o relatório HTML no navegador |
