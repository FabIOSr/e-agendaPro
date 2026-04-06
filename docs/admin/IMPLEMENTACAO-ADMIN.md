# ⚡ PLANO DE IMPLEMENTAÇÃO — Painel Admin + Stack Modernizada

**Data:** 2026-04-05
**Status:** FASE 1+2 implementadas | FASE 3+4 pendentes
**Versão:** 1.1

---

## ✅ Progresso Atual

### FASE 1+2 — CONCLUÍDAS (commit 4e23de4)
- [x] `pages/admin/login.html` → Página de login com senha
- [x] `pages/admin/dashboard.html` → Dashboard com 4 KPIs + alertas + tabela
- [x] `modules/admin-auth.js` → Módulo JS reutilizável (requireAdminAuth, logout, adminHeaders)
- [x] `supabase/functions/admin-validate/index.ts` → Auth por senha + token 24h
- [x] `supabase/functions/admin-dashboard/index.ts` → KPIs agregados (total, MRR, novos, agendamentos)
- [x] `firebase.json` → Rotas `/admin/login` e `/admin/dashboard` adicionadas
- [x] `.env.example` → `ADMIN_PASSWORD` adicionada

### PRÓXIMO: FASE 3
- [ ] `pages/admin/profissionais.html` → Listagem completa com busca/filtros
- [ ] `supabase/functions/admin-profissionais/index.ts` → Query com paginação

---

---

## 📋 Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Arquitetura Final](#2-arquitetura-final)
3. [Plano em 4 Fases](#3-plano-em-4-fases)
4. [Checklist Detalhado](#4-checklist-detalhado)
5. [Arquivos a Criar](#5-arquivos-a-criar)
6. [Edge Functions a Criar](#6-edge-functions-a-criar)
7. [Variáveis de Ambiente](#7-variáveis-de-ambiente)
8. [Queries SQL Úteis](#8-queries-sql-úteis)
9. [Riscos e Mitigações](#9-riscos-e-mitigações)

---

## 1. Resumo Executivo

### O Que Vamos Construir

```
PAINEL ADMIN (Alpine.js + Tailwind + TypeScript Edge Functions)
├── Dashboard KPIs (total users, MRR, churn, trials, alertas)
├── Lista de Profissionais (busca, filtros, paginação)
├── Gestão Financeira (faturamento, pagamentos, inadimplência)
└── Ações Admin (estender trial, suspender, alterar plano)

STACK
├── Frontend: Alpine.js 3.x + Tailwind CSS 3.x + JSDoc types
├── Backend: TypeScript (Deno) — manter
├── Build: build.js — manter (com adições mínimas)
└── Deploy: Firebase Hosting — manter
```

### Tempo Estimado: 12-16 horas

| Fase | Horas | Entregável |
|------|-------|------------|
| 1. Setup | 1h | Secrets, auth admin, estrutura |
| 2. Dashboard | 4h | KPIs, alertas, lista de novos users |
| 3. Profissionais | 3h | Lista, busca, filtros, detalhes |
| 4. Financeiro | 4h | Faturamento, pagamentos, ações |
| 5. Polimento | 2-4h | Gráficos, audit log, testes |

---

## 2. Arquitetura Final

```
┌─────────────────────────────────────────────────────────────┐
│                     PAINEL ADMIN                            │
│                                                             │
│  /admin                  ← Login (senha única)              │
│  /admin/dashboard        ← KPIs principais                  │
│  /admin/profissionais    ← Lista + busca + filtros          │
│  /admin/financeiro       ← Faturamento + pagamentos         │
│  /admin/profissional/:id ← Detalhes completos               │
│                                                             │
│  Stack: Alpine.js + Tailwind + JSDoc types                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  EDGE FUNCTIONS (Deno/TS)                   │
│                                                             │
│  admin-validate       ← Valida senha admin                  │
│  admin-dashboard      ← KPIs agregados                      │
│  admin-profissionais  ← Lista/busca com paginação           │
│  admin-financeiro     ← Dados financeiros                   │
│  admin-user-detail    ← Perfil completo de um user          │
│  admin-actions        ← Estender trial, suspender, etc      │
│                                                             │
│  Auth: ADMIN_SECRET (variável de ambiente)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                               │
│                                                             │
│  Tabelas existentes (reutilizadas, sem mudanças):           │
│  • prestadores      • agendamentos      • pagamentos        │
│  • servicos         • disponibilidade   • bloqueios         │
│                                                             │
│  Opcional: admin_audit_log (log de ações admin)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Plano em 4 Fases

### FASE 1: Setup (1 hora)

**Objetivo:** Ter auth admin funcionando e estrutura de arquivos

#### Passo 1.1: Criar ADMIN_SECRET (5 min)

```bash
# Gerar senha segura
openssl rand -base64 32
# Copiar o resultado

# Adicionar ao .env.local
echo 'ADMIN_PASSWORD="cole_a_senha_gerada_aqui"' >> .env.local

# Adicionar ao Supabase
supabase secrets set ADMIN_PASSWORD="cole_a_senha_gerada_aqui" --project-ref kevqgxmcoxmzbypdjhru
```

#### Passo 1.2: Criar Estrutura de Arquivos (10 min)

```bash
# Criar diretórios
mkdir -p pages/admin
mkdir -p modules/admin
```

**Arquivos vazios a criar:**
```
pages/admin/
├── admin-auth.html
├── admin-dashboard.html
├── admin-profissionais.html
├── admin-financeiro.html
└── admin-user-detail.html

modules/
├── admin-auth.js
├── admin-api.js
└── admin-components.js
```

#### Passo 1.3: Edge Function admin-validate (15 min)

```typescript
// supabase/functions/admin-validate/index.ts
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  try {
    const { password } = await req.json();

    if (password === Deno.env.get("ADMIN_PASSWORD")) {
      return Response.json({ ok: true }, { headers: cors });
    }

    return Response.json({ error: "Senha inválida" }, { status: 401, headers: cors });
  } catch (err) {
    return Response.json({ error: "Erro interno" }, { status: 500, headers: cors });
  }
});
```

**Deploy:**
```bash
supabase functions deploy admin-validate --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
```

#### Passo 1.4: Módulo admin-auth.js (15 min)

```javascript
// modules/admin-auth.js

/**
 * Verifica se usuário está autenticado como admin
 * @returns {string|null} Token ou null
 */
export function getAdminToken() {
  return localStorage.getItem('admin_token');
}

/**
 * Salva token de admin
 * @param {string} token
 */
export function setAdminToken(token) {
  localStorage.setItem('admin_token', token);
}

/**
 * Remove token de admin
 */
export function clearAdminToken() {
  localStorage.removeItem('admin_token');
}

/**
 * Redireciona para login se não autenticado
 * @returns {boolean} Tem token?
 */
export function requireAdminAuth() {
  const token = getAdminToken();
  if (!token) {
    window.location.href = '/admin';
    return false;
  }
  return true;
}

/**
 * Faz login como admin
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function adminLogin(password) {
  try {
    const res = await fetch(`${window.SUPABASE_URL}/functions/v1/admin-validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (res.ok) {
      setAdminToken(password);
      window.location.href = '/admin/dashboard';
      return true;
    }

    return false;
  } catch (e) {
    console.error('Erro no login admin:', e);
    return false;
  }
}

/**
 * Faz logout
 */
export function adminLogout() {
  clearAdminToken();
  window.location.href = '/admin';
}
```

#### Passo 1.5: Página de Login (15 min)

```html
<!-- pages/admin/admin-auth.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgendaPro Admin</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.8/dist/cdn.min.js"></script>
  <script src="/config.js"></script>
  <style>
    body { font-family: system-ui; background: #0f0f0f; color: #f0f0f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .login-box { background: #1a1a1a; padding: 2rem; border-radius: 12px; max-width: 400px; width: 100%; border: 1px solid #2e2e2e; }
    input { width: 100%; padding: 0.75rem; background: #222; border: 1px solid #333; border-radius: 8px; color: #f0f0f0; font-size: 1rem; }
    input:focus { outline: none; border-color: #c8f060; }
    button { width: 100%; padding: 0.75rem; background: #c8f060; border: none; border-radius: 8px; color: #0f0f0f; font-weight: 600; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
    button:hover { opacity: 0.9; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #f06060; margin-top: 0.5rem; font-size: 0.875rem; }
    .logo { font-size: 1.5rem; margin-bottom: 1.5rem; text-align: center; }
  </style>
</head>
<body>
  <div class="login-box" x-data="adminLogin()">
    <div class="logo">🔐 AgendaPro <strong>Admin</strong></div>

    <form @submit.prevent="login">
      <label style="display: block; margin-bottom: 0.5rem;">Senha Admin</label>
      <input type="password" x-model="password" placeholder="Digite a senha secreta" required autocomplete="current-password">

      <button type="submit" :disabled="loading">
        <span x-show="!loading">Entrar</span>
        <span x-show="loading">Entrando...</span>
      </button>

      <p class="error" x-show="error" x-text="error"></p>
    </form>
  </div>

  <script type="module">
    import { adminLogin } from '/modules/admin-auth.js';

    window.adminLogin = function() {
      return {
        password: '',
        error: '',
        loading: false,

        async login() {
          this.error = '';
          this.loading = true;
          try {
            const success = await adminLogin(this.password);
            if (!success) {
              this.error = 'Senha inválida';
            }
          } catch (e) {
            this.error = 'Erro de conexão. Tente novamente.';
          } finally {
            this.loading = false;
          }
        }
      };
    };
  </script>
</body>
</html>
```

### FASE 2: Dashboard (4 horas)

**Objetivo:** Ver KPIs principais e alertas

#### Passo 2.1: Edge Function admin-dashboard (2h)

```typescript
// supabase/functions/admin-dashboard/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  // Validar admin
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${Deno.env.get("ADMIN_PASSWORD")}`) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Queries em paralelo
    const [
      totalResult,
      freeResult,
      trialResult,
      proResult,
      novosResult,
      pagamentosResult,
      trialsExpirandoResult,
      inadimplentesResult,
      agendamentosMesResult
    ] = await Promise.all([
      // Total de profissionais
      supabase.from("prestadores").select("id", { count: "exact", head: true }),

      // Free (sem trial)
      supabase.from("prestadores").select("id", { count: "exact", head: true })
        .eq("plano", "free")
        .is("trial_ends_at", null),

      // Trial ativo
      supabase.from("prestadores").select("id", { count: "exact", head: true })
        .gt("trial_ends_at", new Date().toISOString()),

      // Pro
      supabase.from("prestadores").select("id", { count: "exact", head: true })
        .eq("plano", "pro"),

      // Novos nos últimos 30 dias
      supabase.from("prestadores").select("id, nome, email, slug, plano, trial_ends_at, created_at")
        .gte("created_at", new Date(Date.now() - 30*24*60*60*1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(10),

      // Faturamento do mês (pagamentos)
      supabase.from("pagamentos").select("valor, billing_type, data_evento")
        .gte("data_evento", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

      // Trials expirando em 3 dias
      supabase.from("prestadores").select("id, nome, email, trial_ends_at")
        .gt("trial_ends_at", new Date().toISOString())
        .lte("trial_ends_at", new Date(Date.now() + 3*24*60*60*1000).toISOString())
        .order("trial_ends_at", { ascending: true }),

      // Inadimplentes (plano_valido_ate < hoje)
      supabase.from("prestadores").select("id, nome, email, plano_valido_ate")
        .lt("plano_valido_ate", new Date().toISOString())
        .eq("plano", "pro")
        .order("plano_valido_ate", { ascending: true }),

      // Agendamentos do mês (todos)
      supabase.from("agendamentos").select("id", { count: "exact", head: true })
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    ]);

    // Calcular MRR
    const mrr = pagamentosResult.data?.reduce((sum, p) => sum + (p.valor || 0), 0) || 0;

    return Response.json({
      kpis: {
        total: totalResult.count || 0,
        free: freeResult.count || 0,
        trial: trialResult.count || 0,
        pro: proResult.count || 0,
        mrr: mrr,
        agendamentos_mes: agendamentosMesResult.count || 0,
        novos_30d: novosResult.data || []
      },
      alertas: {
        trials_expirando: trialsExpirandoResult.data || [],
        inadimplentes: inadimplentesResult.data || []
      }
    }, { headers: cors });

  } catch (err) {
    console.error("Erro no admin-dashboard:", err);
    return Response.json({ error: "Erro interno ao carregar dashboard" }, { status: 500, headers: cors });
  }
});
```

**Deploy:**
```bash
supabase functions deploy admin-dashboard --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
```

#### Passo 2.2: Módulo admin-api.js (30 min)

```javascript
// modules/admin-api.js

/**
 * @typedef {Object} Prestador
 * @property {string} id
 * @property {string} nome
 * @property {string} email
 * @property {string} slug
 * @property {'free'|'pro'} plano
 * @property {string|null} trial_ends_at
 * @property {string|null} plano_valido_ate
 * @property {string} created_at
 */

/**
 * @typedef {Object} AdminDashboardResponse
 * @property {Object} kpis
 * @property {number} kpis.total
 * @property {number} kpis.free
 * @property {number} kpis.trial
 * @property {number} kpis.pro
 * @property {number} kpis.mrr
 * @property {number} kpis.agendamentos_mes
 * @property {Prestador[]} kpis.novos_30d
 * @property {Object} alertas
 * @property {Prestador[]} alertas.trials_expirando
 * @property {Prestador[]} alertas.inadimplentes
 */

/**
 * Header de autorização admin
 * @returns {Record<string, string>}
 */
function adminHeaders() {
  const token = localStorage.getItem('admin_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Carrega dados do dashboard admin
 * @returns {Promise<AdminDashboardResponse>}
 */
export async function fetchDashboard() {
  const res = await fetch(`${window.SUPABASE_URL}/functions/v1/admin-dashboard`, {
    headers: adminHeaders()
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Lista profissionais com filtros e paginação
 * @param {Object} params
 * @param {string} [params.busca]
 * @param {string} [params.plano]
 * @param {number} [params.page=0]
 * @returns {Promise<{profissionais: Prestador[], total: number, has_more: boolean}>}
 */
export async function fetchProfissionais({ busca = '', plano = '', page = 0 } = {}) {
  const params = new URLSearchParams({
    busca,
    plano,
    page: String(page)
  });

  const res = await fetch(`${window.SUPABASE_URL}/functions/v1/admin-profissionais?${params}`, {
    headers: adminHeaders()
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Formata valor em BRL
 * @param {number} value
 * @returns {string}
 */
export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Formata data para pt-BR
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

/**
 * Formata data e hora para pt-BR
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('pt-BR');
}
```

#### Passo 2.3: Dashboard HTML (1.5h)

*(Ver documento STACK-MODERNIZACAO.md para o código completo — Seção 6.3)*

### FASE 3: Profissionais (3 horas)

**Objetivo:** Lista, busca, filtros, paginação

#### Passo 3.1: Edge Function admin-profissionais (1.5h)

*(Ver documento PAINEL-ADMIN-DOC.md para o código completo — Seção 6.2)*

#### Passo 3.2: Página de Profissionais (1.5h)

*(Ver documento PAINEL-ADMIN-DOC.md para o código completo — Fase 2)*

### FASE 4: Financeiro + Ações (4 horas)

**Objetivo:** Gestão financeira e ações admin

#### Passo 4.1: Edge Function admin-financeiro (1.5h)

```typescript
// supabase/functions/admin-financeiro/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${Deno.env.get("ADMIN_PASSWORD")}`) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const [
      pagamentosMes,
      assinaturasAtivas,
      inadimplentes,
      receitaPorPlano
    ] = await Promise.all([
      // Pagamentos do mês
      supabase.from("pagamentos")
        .select("id, prestador_id, valor, billing_type, evento, data_evento")
        .gte("data_evento", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .order("data_evento", { ascending: false }),

      // Assinaturas ativas (plano_valido_ate > hoje)
      supabase.from("prestadores")
        .select("id, nome, email, plano, plano_valido_ate, asaas_sub_id")
        .eq("plano", "pro")
        .gt("plano_valido_ate", new Date().toISOString()),

      // Inadimplentes
      supabase.from("prestadores")
        .select("id, nome, email, plano_valido_ate, asaas_customer_id")
        .eq("plano", "pro")
        .lt("plano_valido_ate", new Date().toISOString())
        .order("plano_valido_ate", { ascending: true }),

      // Receita por tipo de plano
      supabase.from("prestadores")
        .select("plano, id")
        .then(async (result) => {
          const byPlano = result.data?.reduce((acc: Record<string, number>, p: any) => {
            acc[p.plano] = (acc[p.plano] || 0) + 1;
            return acc;
          }, {});
          return { data: byPlano };
        })
    ]);

    const totalMes = pagamentosMes.data?.reduce((sum, p) => sum + (p.valor || 0), 0) || 0;

    return Response.json({
      faturamento: {
        total_mes: totalMes,
        pagamentos_count: pagamentosMes.data?.length || 0,
        pagamentos: pagamentosMes.data || []
      },
      assinaturas: {
        ativas: assinaturasAtivas.data || [],
        inadimplentes: inadimplentes.data || []
      },
      por_plano: receitaPorPlano.data || {}
    }, { headers: cors });

  } catch (err) {
    console.error("Erro no admin-financeiro:", err);
    return Response.json({ error: "Erro interno" }, { status: 500, headers: cors });
  }
});
```

#### Passo 4.2: Edge Function admin-actions (1.5h)

```typescript
// supabase/functions/admin-actions/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${Deno.env.get("ADMIN_PASSWORD")}`) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, prestador_id, ...params } = await req.json();

    if (!action || !prestador_id) {
      return Response.json(
        { error: "Campos obrigatórios: action, prestador_id" },
        { status: 400, headers: cors }
      );
    }

    let result: any;

    switch (action) {
      case "estender_trial": {
        const dias = params.dias || 7;
        const novaData = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

        result = await supabase
          .from("prestadores")
          .update({
            plano: "pro",
            trial_ends_at: novaData.toISOString()
          })
          .eq("id", prestador_id);
        break;
      }

      case "suspender_usuario": {
        result = await supabase
          .from("prestadores")
          .update({ plano: "free", plano_valido_ate: new Date().toISOString() })
          .eq("id", prestador_id);
        break;
      }

      case "ativar_pro": {
        const dias = params.dias || 30;
        const novaData = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

        result = await supabase
          .from("prestadores")
          .update({
            plano: "pro",
            plano_valido_ate: novaData.toISOString()
          })
          .eq("id", prestador_id);
        break;
      }

      case "downgrade_free": {
        result = await supabase
          .from("prestadores")
          .update({ plano: "free" })
          .eq("id", prestador_id);
        break;
      }

      default:
        return Response.json(
          { error: `Ação desconhecida: ${action}` },
          { status: 400, headers: cors }
        );
    }

    if (result?.error) {
      return Response.json(
        { error: result.error.message },
        { status: 500, headers: cors }
      );
    }

    // Log da ação (opcional)
    await supabase.from("admin_audit_log").insert({
      admin_id: "admin",
      acao: action,
      alvo_tipo: "prestador",
      alvo_id: prestador_id,
      detalhes: params
    }).catch(() => {}); // Ignora se tabela não existe

    return Response.json({ ok: true, action, prestador_id }, { headers: cors });

  } catch (err) {
    console.error("Erro no admin-actions:", err);
    return Response.json({ error: "Erro interno" }, { status: 500, headers: cors });
  }
});
```

**Deploy:**
```bash
supabase functions deploy admin-financeiro admin-actions --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
```

---

## 4. Checklist Detalhado

### Setup Inicial
```
[ ] 1. Gerar ADMIN_PASSWORD (openssl rand -base64 32)
[ ] 2. Adicionar ADMIN_PASSWORD ao .env.local
[ ] 3. Adicionar ADMIN_PASSWORD ao Supabase (supabase secrets set)
[ ] 4. Criar diretório pages/admin/
[ ] 5. Criar diretório modules/admin/ (se quiser separar)
[ ] 6. Adicionar ADMIN_PASSWORD ao GitHub Secrets (se usar CI/CD)
```

### Edge Functions
```
[ ] 1. Criar supabase/functions/admin-validate/index.ts
[ ] 2. Criar supabase/functions/admin-dashboard/index.ts
[ ] 3. Criar supabase/functions/admin-profissionais/index.ts
[ ] 4. Criar supabase/functions/admin-financeiro/index.ts
[ ] 5. Criar supabase/functions/admin-actions/index.ts
[ ] 6. Deploy de todas as funções (--no-verify-jwt)
[ ] 7. Testar cada função via curl/Postman
```

### Frontend
```
[ ] 1. Criar pages/admin/admin-auth.html
[ ] 2. Criar pages/admin/admin-dashboard.html
[ ] 3. Criar pages/admin/admin-profissionais.html
[ ] 4. Criar pages/admin/admin-financeiro.html
[ ] 5. Criar modules/admin-auth.js
[ ] 6. Criar modules/admin-api.js
[ ] 7. Criar modules/admin-components.js (opcional)
[ ] 8. Testar login admin
[ ] 9. Testar dashboard
[ ] 10. Testar lista de profissionais
```

### Firebase Hosting
```
[ ] 1. Adicionar rotas admin ao firebase.json (rewrites)
[ ] 2. Testar build (npm run build)
[ ] 3. Deploy (firebase deploy --only hosting)
[ ] 4. Testar rotas no ar
```

### Testes
```
[ ] 1. Login admin funciona?
[ ] 2. Dashboard carrega KPIs?
[ ] 3. Lista de profissionais funciona?
[ ] 4. Busca funciona?
[ ] 5. Filtros funcionam?
[ ] 6. Paginação funciona?
[ ] 7. Alertas aparecem?
```

---

## 5. Arquivos a Criar

### Frontend (6 arquivos)

| Arquivo | Tamanho Estimado | Tempo | Descrição |
|---------|-----------------|-------|-----------|
| `pages/admin/admin-auth.html` | ~60 linhas | 15 min | Login do admin |
| `pages/admin/admin-dashboard.html` | ~250 linhas | 1.5h | Dashboard principal |
| `pages/admin/admin-profissionais.html` | ~200 linhas | 1h | Lista de profissionais |
| `pages/admin/admin-financeiro.html` | ~200 linhas | 1h | Gestão financeira |
| `modules/admin-auth.js` | ~80 linhas | 15 min | Auth module |
| `modules/admin-api.js` | ~120 linhas | 30 min | API client |

### Backend (5 arquivos)

| Arquivo | Tamanho Estimado | Tempo | Descrição |
|---------|-----------------|-------|-----------|
| `supabase/functions/admin-validate/index.ts` | ~30 linhas | 15 min | Valida senha |
| `supabase/functions/admin-dashboard/index.ts` | ~120 linhas | 1h | KPIs |
| `supabase/functions/admin-profissionais/index.ts` | ~80 linhas | 45 min | Lista/busca |
| `supabase/functions/admin-financeiro/index.ts` | ~100 linhas | 1h | Financeiro |
| `supabase/functions/admin-actions/index.ts` | ~120 linhas | 1h | Ações admin |

---

## 6. Edge Functions a Criar

### Resumo

| Função | Auth | Método | Descrição | Deploy |
|--------|------|--------|-----------|--------|
| `admin-validate` | ADMIN_PASSWORD | POST | Valida login | `--no-verify-jwt` |
| `admin-dashboard` | ADMIN_PASSWORD | GET | KPIs | `--no-verify-jwt` |
| `admin-profissionais` | ADMIN_PASSWORD | GET | Lista/users | `--no-verify-jwt` |
| `admin-financeiro` | ADMIN_PASSWORD | GET | Financeiro | `--no-verify-jwt` |
| `admin-actions` | ADMIN_PASSWORD | POST | Ações | `--no-verify-jwt` |

### Comando de Deploy Único

```bash
for fn in admin-validate admin-dashboard admin-profissionais admin-financeiro admin-actions; do
  supabase functions deploy $fn --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
done
```

---

## 7. Variáveis de Ambiente

### Adicionar ao `.env.local`

```bash
# Admin
ADMIN_PASSWORD="senha_super_segura_gerada_aqui"
```

### Adicionar ao Supabase

```bash
supabase secrets set \
  ADMIN_PASSWORD="senha_super_segura_gerada_aqui" \
  --project-ref kevqgxmcoxmzbypdjhru
```

### Adicionar ao GitHub Secrets (se usar CI/CD)

```
Settings → Secrets and variables → Actions → New repository secret
Name: ADMIN_PASSWORD
Value: senha_super_segura_gerada_aqui
```

---

## 8. Queries SQL Úteis

### Migration Opcional: Audit Log

```sql
-- migrations/admin-audit-log.sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT NOT NULL DEFAULT 'admin',
  acao TEXT NOT NULL,
  alvo_tipo TEXT NOT NULL,
  alvo_id UUID,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo em audit_log"
  ON admin_audit_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

### Queries Manuais (Enquanto Admin Não Existe)

*(Ver Apêndice B do documento PAINEL-ADMIN-DOC.md)*

---

## 9. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| ADMIN_PASSWORD vaza | Baixa | **CRÍTICO** | Rotação imediata, usar senha forte |
| Edge function com erro | Média | Alto | Testar localmente antes de deploy |
| CORS bloqueia admin | Baixa | Médio | Usar _shared/cors.ts existente |
| Performance ruim (muitos users) | Média | Médio | Adicionar paginação, índices |
| Dados incorretos no dashboard | Baixa | Médio | Validar queries com dados reais |

---

## 🚀 Pronto para Começar

**Próximo passo:** Executar Fase 1 (Setup — 1 hora)

```bash
# 1. Gerar senha
openssl rand -base64 32

# 2. Criar estrutura
mkdir -p pages/admin supabase/functions/admin-validate

# 3. Criar arquivos (seguir checklist acima)

# 4. Deploy
supabase functions deploy admin-validate --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru

# 5. Testar
curl -X POST http://localhost:54321/functions/v1/admin-validate \
  -H "Content-Type: application/json" \
  -d '{"password":"SUA_SENHA"}'
```

---

*Documento criado em 2026-04-05*  
*Pronto para execução imediata*
