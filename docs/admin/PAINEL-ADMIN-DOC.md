# 📋 PAINEL ADMINISTRATIVO — AgendaPro SaaS

**Data:** 2026-04-05  
**Autor:** Análise Técnica  
**Status:** Documentação para Implementação  
**Versão:** 1.0

---

## 📋 Índice

1. [Diagnóstico Atual](#1-diagnóstico-atual)
2. [Impacto de Negócio](#2-impacto-de-negócio)
3. [Requisitos do Painel Admin](#3-requisitos-do-painel-admin)
4. [Arquitetura Proposta](#4-arquitetura-proposta)
5. [Stack Modernizada](#5-stack-modernizada)
6. [Plano de Implementação](#6-plano-de-implementação)
7. [Edge Functions Necessárias](#7-edge-functions-necessárias)
8. [Modelo de Dados Admin](#8-modelo-de-dados-admin)
9. [Segurança do Admin](#9-segurança-do-admin)
10. [Roadmap Sugerido](#10-roadmap-sugerido)

---

## 1. Diagnóstico Atual

### 1.1 O Que Existe Hoje

| Componente | Para o Profissional | Para o Dono do SaaS |
|------------|---------------------|---------------------|
| Landing Page | ✅ | ❌ |
| Auth (Login/Cadastro) | ✅ | ❌ |
| Onboarding | ✅ | ❌ |
| Painel (Agendamentos) | ✅ | ❌ |
| Clientes | ✅ | ❌ |
| Relatórios | ✅ (do profissional) | ❌ |
| Configurações | ✅ | ❌ |
| Planos/Assinatura | ✅ | ❌ |
| **Painel Admin** | — | **❌ NÃO EXISTE** |

### 1.2 O Que Você (Dono) NÃO Consegue Ver

#### 📊 Métricas de Negócio

| Pergunta de Negócio | Como Responder Hoje | Tempo Necessário |
|---------------------|---------------------|------------------|
| Quantos profissionais cadastrados? | Query SQL manual no Supabase | 10 min |
| Quantos estão ativos no último mês? | Query SQL manual | 10 min |
| Quantos estão no trial agora? | Query SQL manual | 5 min |
| Quantos converteram trial → pago? | Cálculo manual | 15 min |
| Qual taxa de churn do mês? | Cálculo manual | 20 min |
| MRR (Monthly Recurring Revenue)? | Somar pagamentos no Asaas | 30 min |
| Faturamento total do SaaS? | Query SQL + Asaas | 30 min |
| Ticket médio por profissional? | Cálculo manual | 15 min |
| LTV (Lifetime Value)? | Não é possível | — |
| CAC (Custo de Aquisição)? | Não é possível | — |

#### 👥 Gestão de Usuários

| Operação | Como Faz Agora | Tempo |
|----------|----------------|-------|
| Ver lista de todos os profissionais | Query SQL manual | 10 min |
| Buscar profissional por nome/email | Query SQL manual | 5 min |
| Filtrar por plano (Free/Pro/Trial) | Query SQL manual | 5 min |
| Ver data de último acesso | Query SQL manual | 5 min |
| Ver agendamentos de um profissional | Query SQL manual | 5 min |
| Estender trial manualmente | UPDATE SQL manual | 5 min |
| Suspender usuário inadimplente | UPDATE SQL manual | 5 min |
| Alterar plano manualmente | UPDATE SQL manual | 5 min |

#### 💰 Gestão Financeira

| Operação | Como Faz Agora | Tempo |
|----------|----------------|-------|
| Ver faturamento do mês | Query SQL + Asaas | 20 min |
| Ver pagamentos pendentes | Query SQL manual | 10 min |
| Ver assinaturas ativas | Query SQL + Asaas | 15 min |
| Ver inadimplência | Query SQL manual | 15 min |
| Aplicar desconto manual | UPDATE SQL + Asaas | 10 min |
| Cobrar usuário manualmente | WhatsApp/Email manual | 5 min |

#### 🛟 Suporte ao Cliente

| Cenário | Como Resolve |
|---------|--------------|
| Profissional reclama de bug | Sem visão → query manual nos logs |
| Esqueci minha senha | Reset manual no Supabase Auth |
| Quero ver atividade de um usuário | Query SQL manual |
| Suspender usuário problemático | Query SQL manual |
| Enviar comunicado para todos | Sem ferramenta → exportar CSV + email manual |
| Ver histórico completo de um profissional | Múltiplas queries SQL |

### 1.3 Riscos de NÃO Ter Admin

#### Cenário 1: Crescimento Silencioso
```
100 users cadastram → 80 ficam free → 20 convertem trial
Você só descobre quando checar manualmente
Perda: R$ 2.000+/mês em upsells não feitos
```

#### Cenário 2: Churn em Massa
```
Bug no WhatsApp afeta 50 users
Nenhum alerta → você descobre em 2 semanas
30 cancelam, 20 reclamam
Danos à reputação + perda de R$ 4.000+/mês
```

#### Cenário 3: Inadimplência Não Cobrada
```
10 users com pagamento vencido
Sem alerta → sem cobrança
Perda: R$ 390/mês recorrente
```

#### Cenário 4: Trial Sem Follow-up
```
50 trials expiram sem conversão
Sem nurturing → sem segunda chance
Perda: 10 conversões potenciais = R$ 3.900/ano
```

---

## 2. Impacto de Negócio

### 2.1 Perda Financeira Estimada

| Problema | Custo Mensal (100 users) | Custo Mensal (500 users) |
|----------|-------------------------|-------------------------|
| 10% churn não detectado | R$ 195 | R$ 975 |
| 20% trials sem follow-up | R$ 780 | R$ 3.900 |
| Tempo em suporte manual (5h/mês) | R$ 250 | R$ 500 |
| Inadimplência não cobrada | R$ 390 | R$ 1.950 |
| Upsells perdidos (sem dados) | R$ 500 | R$ 2.500 |
| **TOTAL** | **~R$ 2.115** | **~R$ 9.825** |

### 2.2 ROI do Painel Admin

| Métrica | Valor |
|---------|-------|
| Esforço estimado (admin básico) | 12-16 horas |
| Receita recuperada/mês (100 users) | ~R$ 2.000 |
| Payback | **Imediato** (1 semana) |
| ROI anual (100 users) | ~R$ 24.000 |
| ROI anual (500 users) | ~R$ 120.000 |

---

## 3. Requisitos do Painel Admin

### 3.1 MVP (Sem Isso Você Está Cego)

| Requisito | Prioridade | Esforço | Descrição |
|-----------|------------|---------|-----------|
| **Dashboard KPIs** | 🔴 CRÍTICO | 4h | Total users, por plano, MRR, churn rate |
| **Lista de Profissionais** | 🔴 CRÍTICO | 3h | Buscar, filtrar, ver detalhes |
| **Gestão Financeira Básica** | 🔴 CRÍTICO | 4h | Faturamento, pagamentos pendentes, inadimplência |
| **Alertas** | 🟡 ALTA | 3h | Trials expirando, pagamentos vencidos, churn |

### 3.2 Fase 2 (Gestão Eficiente)

| Requisito | Prioridade | Esforço | Descrição |
|-----------|------------|---------|-----------|
| **Detalhes do Profissional** | 🟡 ALTA | 2h | Agendamentos, pagamentos, logs |
| **Ações em Massa** | 🟡 ALTA | 3h | Enviar email, estender trial, suspender |
| **Comunicados** | 🟢 MÉDIA | 2h | Enviar para todos ou segmento |
| **Gráficos de Tendência** | 🟢 MÉDIA | 4h | Crescimento, receita, churn ao longo do tempo |

### 3.3 Fase 3 (Operação Avançada)

| Requisito | Prioridade | Esforço | Descrição |
|-----------|------------|---------|-----------|
| **Gestão de Preços** | 🟢 MÉDIA | 2h | Alterar preços de planos sem deploy |
| **Analytics Avançado** | 🔵 BAIXA | 6h | Cohort analysis, funnel de conversão |
| **Auditoria Completa** | 🔵 BAIXA | 4h | Log de todas as ações admin |
| **Export de Dados** | 🔵 BAIXA | 2h | CSV/Excel de usuários, pagamentos |

---

## 4. Arquitetura Proposta

### 4.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    PAINEL ADMIN                             │
│                                                             │
│  /admin                                                     │
│  ├── /dashboard          ← KPIs principais                  │
│  ├── /profissionais      ← Lista + busca + filtros          │
│  ├── /financeiro         ← Faturamento + pagamentos         │
│  ├── /alertas            ← Notificações e ações             │
│  └── /[id]/detalhes      ← Perfil completo do user          │
│                                                             │
│  Auth: Super-Admin (separado de auth de profissionais)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS                           │
│                                                             │
│  admin-dashboard      → KPIs agregados                      │
│  admin-profissionais  → lista, busca, filtros               │
│  admin-financeiro     → receita, pagamentos, inadimplência  │
│  admin-alertas        → trials, churn, pagamentos pendentes │
│  admin-user-detail    → perfil completo de um user          │
│  admin-actions        → estender trial, suspender, etc      │
│                                                             │
│  Todas validam ADMIN_SECRET via header Authorization        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                               │
│                                                             │
│  Tabelas existentes (reutilizadas):                         │
│  • prestadores (dados dos profissionais)                    │
│  • agendamentos (atividade)                                 │
│  • pagamentos (receita)                                     │
│                                                             │
│  Nova tabela (opcional):                                    │
│  • admin_audit_log (log de ações do admin)                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Fluxo de Autenticação Admin

```
┌─────────────────────┐
│   /admin            │
│   (página HTML)     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     NÃO EXISTE AINDA
│   Login Admin       │─────▶ Criar: admin-auth.html
│   (separado)        │      Auth via ADMIN_SECRET
└─────────┬───────────┘      ou Supabase Auth separado
          │
          ▼
┌─────────────────────┐
│   Dashboard         │
│   (KPIs, listas)    │
└─────────────────────┘
```

### 4.3 Estrutura de Arquivos Proposta

```
agendapro/
├── pages/
│   ├── admin/
│   │   ├── admin-auth.html          ← Login do admin
│   │   ├── admin-dashboard.html     ← Dashboard principal
│   │   ├── admin-profissionais.html ← Lista de profissionais
│   │   ├── admin-financeiro.html    ← Gestão financeira
│   │   └── admin-user-detail.html   ← Detalhes de um user
│   └── ... (páginas existentes)
│
├── modules/
│   ├── admin-auth.js                ← Módulo de auth admin
│   ├── admin-api.js                 ← Chamadas às edge functions
│   ├── admin-charts.js              ← Gráficos (Chart.js)
│   └── ... (módulos existentes)
│
├── supabase/functions/
│   ├── admin-dashboard/index.ts     ← KPIs agregados
│   ├── admin-profissionais/index.ts ← Lista/busca users
│   ├── admin-financeiro/index.ts    ← Dados financeiros
│   ├── admin-alertas/index.ts       ← Alertas diversos
│   ├── admin-user-detail/index.ts   ← Perfil completo
│   ├── admin-actions/index.ts       ← Ações admin (trial, suspender)
│   └── ... (funções existentes)
│
└── migrations/
    └── admin-audit-log.sql          ← (opcional) log de ações admin
```

---

## 5. Stack Modernizada

### 5.1 Problemas da Stack Atual

| Problema | Impacto | Exemplo |
|----------|---------|---------|
| **Vanilla JS com DOM manipulation** | Código verboso, difícil manter | `painel.html` = 1423 linhas de HTML+JS |
| **Sem reatividade** | Muitos `document.getElementById`, `innerHTML` | Atualizar UI é manual |
| **Sem componentes reutilizáveis** | Duplicação de código | Cada página recria modais, toasts, etc |
| **Estado global disperso** | Variáveis espalhadas no `window` | Difícil debug |
| **Sem TypeScript no frontend** | Bugs de tipo, sem autocomplete | `prestador.plano` pode ser undefined |
| **Sem build step para JS** | Sem tree-shaking, minificação | Bundle maior que necessário |

### 5.2 Stack Proposta (Equilíbrio: Moderno vs Simples)

```
┌──────────────────────────────────────────────────────┐
│                  STACK PROPOSTA                       │
│                                                      │
│  FRONTEND:                                           │
│  • Alpine.js 3.x        ← Reatividade leve (15kb)   │
│  • Tailwind CSS 3.x     ← Utility-first CSS         │
│  • htmx (opcional)      ← Interações sem JS         │
│  • Chart.js             ← Gráficos                   │
│  • TypeScript 5.x       ← Type safety (opcional)    │
│                                                      │
│  BACKEND:                                            │
│  • TypeScript (Deno)    ← Já usando, manter         │
│  • Supabase JS Client   ← Já usando, manter         │
│  • Edge Functions       ← Já usando, manter         │
│                                                      │
│  BUILD:                                              │
│  • Vite (opcional)      ← Build + dev server        │
│  • ou manter build.js   ← Se preferir simplicidade  │
│                                                      │
│  BANCO:                                              │
│  • PostgreSQL (Supabase) ← Manter                   │
│  • RLS                    ← Manter                   │
└──────────────────────────────────────────────────────┘
```

### 5.3 Por Que Alpine.js?

| Critério | Alpine.js | React | Vue | Vanilla |
|----------|-----------|-------|-----|---------|
| **Curva de aprendizado** | 30 min | 2 semanas | 1 semana | — |
| **Tamanho do bundle** | 15kb | 42kb+ | 33kb | 0kb |
| **Reatividade** | ✅ Sim | ✅ Sim | ✅ Sim | ❌ Não |
| **Compatível com HTML estático** | ✅ Perfeito | ❌ Precisa JSX | ⚠️ Parcial | ✅ |
| **Firebase Hosting** | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim |
| **Migração gradual** | ✅ Linha por linha | ❌ Rewrite total | ⚠️ Parcial | — |
| **Manutenibilidade** | ✅ Alta | ✅ Alta | ✅ Alta | ❌ Baixa |
| **Ideal para painel admin** | ✅ Sim | ⚠️ Exagero | ✅ Sim | ❌ Não |

**Vantagens do Alpine.js para o Admin:**

1. **Migração gradual**: Pode adicionar `x-data`, `x-bind` em páginas existentes
2. **Sem build step**: Funciona com `<script defer src="alpine.js">`
3. **Mesmo padrão mental**: Similar a Vue, mas inline no HTML
4. **Perfeito para dashboards**: Estado local, loops, condicionais
5. **15kb gzipped**: Menor que qualquer framework

### 5.4 Exemplo Comparativo

#### ❌ Antes (Vanilla JS — 50 linhas)

```javascript
// painel.html — Vanilla JS
const state = { agendamentos: [], loading: true, error: null };

async function loadAgendamentos() {
  try {
    state.loading = true;
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';

    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .order('data_hora', { ascending: false })
      .limit(50);

    if (error) throw error;

    state.agendamentos = data;
    state.loading = false;
    renderAgendamentos();
  } catch (err) {
    state.error = err.message;
    state.loading = false;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error-text').textContent = err.message;
  }
}

function renderAgendamentos() {
  const container = document.getElementById('lista');
  container.innerHTML = '';

  for (const ag of state.agendamentos) {
    const el = document.createElement('div');
    el.className = 'agendamento-item';
    el.innerHTML = `
      <div class="nome">${ag.cliente_nome}</div>
      <div class="data">${new Date(ag.data_hora).toLocaleDateString('pt-BR')}</div>
      <span class="status ${ag.status}">${ag.status}</span>
    `;
    container.appendChild(el);
  }

  document.getElementById('loading').style.display = 'none';
  document.getElementById('count').textContent = state.agendamentos.length;
}

document.addEventListener('DOMContentLoaded', loadAgendamentos);
```

#### ✅ Depois (Alpine.js — 15 linhas)

```html
<!-- admin-dashboard.html — Alpine.js -->
<div x-data="adminDashboard()" x-init="loadKPIs()">

  <!-- Loading -->
  <template x-if="loading">
    <div class="loading">Carregando...</div>
  </template>

  <!-- Error -->
  <template x-if="error">
    <div class="error" x-text="error"></div>
  </template>

  <!-- Content -->
  <template x-if="!loading && !error">
    <div>
      <div class="kpi-grid">
        <div class="kpi-card">
          <h3>Total de Profissionais</h3>
          <div class="kpi-value" x-text="kpis.total"></div>
        </div>
        <div class="kpi-card">
          <h3>MRR</h3>
          <div class="kpi-value" x-text="formatBRL(kpis.mrr)"></div>
        </div>
        <div class="kpi-card">
          <h3>Churn Rate</h3>
          <div class="kpi-value" x-text="kpis.churn + '%'"></div>
        </div>
      </div>

      <table>
        <template x-for="prof in profissionais" :key="prof.id">
          <tr>
            <td x-text="prof.nome"></td>
            <td x-text="prof.plano"></td>
            <td x-text="formatDate(prof.ultimo_acesso)"></td>
          </tr>
        </template>
      </table>
    </div>
  </template>
</div>

<script type="module">
import { supabase } from './modules/admin-auth.js';

export function adminDashboard() {
  return {
    kpis: { total: 0, mrr: 0, churn: 0 },
    profissionais: [],
    loading: true,
    error: null,

    async loadKPIs() {
      try {
        const res = await fetch('/functions/v1/admin-dashboard', {
          headers: { 'Authorization': `Bearer ${window.ADMIN_SECRET}` }
        });
        const data = await res.json();
        this.kpis = data.kpis;
        this.profissionais = data.profissionais;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    formatBRL(value) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    },

    formatDate(dateStr) {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    }
  };
}
</script>
```

**Redução:** 50 → 15 linhas (70% menos código)  
**Manutenibilidade:** Estado local, sem `getElementById`, reatividade automática

---

## 6. Plano de Implementação

### Fase 1: Admin MVP (4-6 horas) — SEM ISSOCÊ ESTÁ CEGO

**Objetivo:** Conseguir ver métricas básicas e lista de profissionais

#### Passo 1: Auth Admin (1h)

```html
<!-- pages/admin/admin-auth.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>AgendaPro Admin</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    /* CSS mínimo para login */
    body { font-family: system-ui; background: #0f0f0f; color: #f0f0f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .login-box { background: #1a1a1a; padding: 2rem; border-radius: 12px; max-width: 400px; width: 100%; }
    input { width: 100%; padding: 0.75rem; background: #222; border: 1px solid #333; border-radius: 8px; color: #f0f0f0; font-size: 1rem; }
    button { width: 100%; padding: 0.75rem; background: #c8f060; border: none; border-radius: 8px; color: #0f0f0f; font-weight: 600; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
    .error { color: #f06060; margin-top: 0.5rem; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="login-box" x-data="adminLogin()">
    <h1 style="margin-bottom: 1.5rem;">🔐 AgendaPro Admin</h1>

    <form @submit.prevent="login">
      <label style="display: block; margin-bottom: 0.5rem;">Senha Admin</label>
      <input type="password" x-model="password" placeholder="Senha secreta" required>

      <button type="submit">Entrar</button>

      <p class="error" x-show="error" x-text="error"></p>
    </form>
  </div>

  <script>
    function adminLogin() {
      return {
        password: '',
        error: '',

        async login() {
          // Validar contra ADMIN_SECRET (variável de ambiente)
          const res = await fetch('/functions/v1/admin-validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: this.password })
          });

          if (res.ok) {
            localStorage.setItem('admin_token', this.password);
            window.location.href = '/admin/dashboard';
          } else {
            this.error = 'Senha inválida';
          }
        }
      };
    }
  </script>
</body>
</html>
```

```typescript
// supabase/functions/admin-validate/index.ts
Deno.serve(async (req) => {
  const { password } = await req.json();

  if (password === Deno.env.get('ADMIN_PASSWORD')) {
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Invalid' }, { status: 401 });
});
```

#### Passo 2: Edge Functions Core (2h)

```typescript
// supabase/functions/admin-dashboard/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Validar admin
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${Deno.env.get("ADMIN_PASSWORD")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Queries em paralelo
  const [
    totalResult,
    freeResult,
    trialResult,
    proResult,
    novosResult,
    pagamentosResult,
    trialsExpirandoResult,
    inadimplentesResult
  ] = await Promise.all([
    // Total de profissionais
    supabase.from("prestadores").select("id", { count: "exact", head: true }),

    // Por plano: Free
    supabase.from("prestadores").select("id", { count: "exact", head: true })
      .eq("plano", "free")
      .is("trial_ends_at", null),

    // Por plano: Trial ativo
    supabase.from("prestadores").select("id", { count: "exact", head: true })
      .gt("trial_ends_at", new Date().toISOString()),

    // Por plano: Pro
    supabase.from("prestadores").select("id", { count: "exact", head: true })
      .eq("plano", "pro"),

    // Novos nos últimos 30 dias
    supabase.from("prestadores").select("id, nome, plano, created_at")
      .gte("created_at", new Date(Date.now() - 30*24*60*60*1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10),

    // Faturamento do mês (pagamentos confirmados)
    supabase.from("pagamentos").select("valor, billing_type, data_evento")
      .gte("data_evento", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

    // Trials expirando em 3 dias
    supabase.from("prestadores").select("id, nome, email, trial_ends_at")
      .gt("trial_ends_at", new Date().toISOString())
      .lte("trial_ends_at", new Date(Date.now() + 3*24*60*60*1000).toISOString()),

    // Pagamentos vencidos (plano_valido_ate < hoje)
    supabase.from("prestadores").select("id, nome, email, plano_valido_ate")
      .lt("plano_valido_ate", new Date().toISOString())
      .eq("plano", "pro")
  ]);

  // Calcular MRR simples
  const mrr = pagamentosResult.data?.reduce((sum, p) => sum + (p.valor || 0), 0) || 0;

  return Response.json({
    kpis: {
      total: totalResult.count || 0,
      free: freeResult.count || 0,
      trial: trialResult.count || 0,
      pro: proResult.count || 0,
      mrr: mrr,
      novos_30d: novosResult.data || []
    },
    alertas: {
      trials_expirando: trialsExpirandoResult.data || [],
      inadimplentes: inadimplentesResult.data || []
    }
  });
});
```

```typescript
// supabase/functions/admin-profissionais/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${Deno.env.get("ADMIN_PASSWORD")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const busca = url.searchParams.get("q") || "";
  const plano = url.searchParams.get("plano") || "";
  const page = parseInt(url.searchParams.get("page") || "0");
  const limit = 50;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let query = supabase
    .from("prestadores")
    .select("id, nome, email, slug, plano, trial_ends_at, plano_valido_ate, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);
  }

  if (plano) {
    if (plano === "trial") {
      query = query.gt("trial_ends_at", new Date().toISOString());
    } else {
      query = query.eq("plano", plano);
    }
  }

  const { data, count, error } = await query.range(page * limit, (page + 1) * limit - 1);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    profissionais: data,
    total: count,
    page,
    has_more: (page + 1) * limit < (count || 0)
  });
});
```

#### Passo 3: Dashboard HTML (2h)

```html
<!-- pages/admin/admin-dashboard.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgendaPro Admin — Dashboard</title>

  <!-- Alpine.js -->
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.8/dist/cdn.min.js"></script>

  <!-- Tailwind CSS (CDN para dev) -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            lime: '#c8f060',
            dark: '#0f0f0f',
            dark2: '#1a1a1a',
            dark3: '#222222',
            border: '#2e2e2e'
          }
        }
      }
    }
  </script>

  <style>
    [x-cloak] { display: none !important; }
    body { background: #0f0f0f; color: #f0f0f0; }
  </style>
</head>
<body class="min-h-screen">

  <!-- Topbar -->
  <header class="border-b border-border bg-dark2 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
      <h1 class="text-xl font-semibold">📊 AgendaPro <span class="text-lime">Admin</span></h1>
      <button onclick="localStorage.removeItem('admin_token'); window.location.href='/admin'"
              class="text-sm text-gray-400 hover:text-white">Sair</button>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-6 py-8"
        x-data="adminDashboard()"
        x-init="loadData()">

    <!-- Loading -->
    <div x-show="loading" x-cloak class="text-center py-20">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
      <p class="mt-4 text-gray-400">Carregando dados...</p>
    </div>

    <!-- Error -->
    <div x-show="error" x-cloak class="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
      <p class="text-red-400" x-text="error"></p>
    </div>

    <!-- Content -->
    <div x-show="!loading && !error" x-cloak>

      <!-- KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <!-- Total -->
        <div class="bg-dark2 border border-border rounded-lg p-6">
          <p class="text-gray-400 text-sm">Total de Profissionais</p>
          <p class="text-3xl font-bold mt-1" x-text="kpis.total"></p>
        </div>

        <!-- Free -->
        <div class="bg-dark2 border border-border rounded-lg p-6">
          <p class="text-gray-400 text-sm">Plano Free</p>
          <p class="text-3xl font-bold mt-1" x-text="kpis.free"></p>
        </div>

        <!-- Trial -->
        <div class="bg-dark2 border border-border rounded-lg p-6">
          <p class="text-gray-400 text-sm">Trial Ativo</p>
          <p class="text-3xl font-bold mt-1 text-lime" x-text="kpis.trial"></p>
        </div>

        <!-- Pro -->
        <div class="bg-dark2 border border-border rounded-lg p-6">
          <p class="text-gray-400 text-sm">Plano Pro</p>
          <p class="text-3xl font-bold mt-1 text-lime" x-text="kpis.pro"></p>
        </div>
      </div>

      <!-- Receita -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="bg-dark2 border border-border rounded-lg p-6">
          <p class="text-gray-400 text-sm">Faturamento do Mês</p>
          <p class="text-3xl font-bold mt-1 text-lime" x-text="formatBRL(kpis.mrr)"></p>
        </div>

        <div class="bg-dark2 border border-border rounded-lg p-6">
          <p class="text-gray-400 text-sm">Novos (30 dias)</p>
          <p class="text-3xl font-bold mt-1" x-text="kpis.novos_30d?.length || 0"></p>
        </div>
      </div>

      <!-- Alertas -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <!-- Trials Expirando -->
        <div class="bg-dark2 border border-yellow-500/30 rounded-lg p-6">
          <h3 class="font-semibold text-yellow-400 mb-3">
            ⚠️ Trials Expirando (<span x-text="alertas.trials_expirando?.length || 0"></span>)
          </h3>
          <template x-if="alertas.trials_expirando?.length > 0">
            <ul class="space-y-2">
              <template x-for="t in alertas.trials_expirando" :key="t.id">
                <li class="text-sm">
                  <span x-text="t.nome"></span>
                  <span class="text-gray-400 ml-2" x-text="'Expira: ' + formatDate(t.trial_ends_at)"></span>
                </li>
              </template>
            </ul>
          </template>
          <template x-if="!alertas.trials_expirando?.length">
            <p class="text-gray-400 text-sm">Nenhum trial expirando</p>
          </template>
        </div>

        <!-- Inadimplentes -->
        <div class="bg-dark2 border border-red-500/30 rounded-lg p-6">
          <h3 class="font-semibold text-red-400 mb-3">
            ❌ Pagamentos Vencidos (<span x-text="alertas.inadimplentes?.length || 0"></span>)
          </h3>
          <template x-if="alertas.inadimplentes?.length > 0">
            <ul class="space-y-2">
              <template x-for="i in alertas.inadimplentes" :key="i.id">
                <li class="text-sm">
                  <span x-text="i.nome"></span>
                  <span class="text-gray-400 ml-2" x-text="'Venceu: ' + formatDate(i.plano_valido_ate)"></span>
                </li>
              </template>
            </ul>
          </template>
          <template x-if="!alertas.inadimplentes?.length">
            <p class="text-gray-400 text-sm">Nenhum pagamento vencido</p>
          </template>
        </div>
      </div>

      <!-- Novos Profissionais -->
      <div class="bg-dark2 border border-border rounded-lg p-6">
        <h3 class="font-semibold mb-4">🆕 Novos Profissionais (30 dias)</h3>
        <template x-if="kpis.novos_30d?.length > 0">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-gray-400 border-b border-border">
                <th class="text-left py-2">Nome</th>
                <th class="text-left py-2">Plano</th>
                <th class="text-left py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              <template x-for="n in kpis.novos_30d" :key="n.id">
                <tr class="border-b border-border/50">
                  <td class="py-2" x-text="n.nome"></td>
                  <td class="py-2">
                    <span class="px-2 py-1 rounded text-xs"
                          :class="{
                            'bg-gray-500/20 text-gray-400': n.plano === 'free',
                            'bg-lime/20 text-lime': n.plano === 'pro',
                            'bg-yellow-500/20 text-yellow-400': new Date(n.trial_ends_at) > new Date()
                          }"
                          x-text="n.plano"></span>
                  </td>
                  <td class="py-2 text-gray-400" x-text="formatDate(n.created_at)"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </template>
        <template x-if="!kpis.novos_30d?.length">
          <p class="text-gray-400 text-sm">Nenhum novo profissional</p>
        </template>
      </div>
    </div>
  </main>

  <script>
    function adminDashboard() {
      return {
        kpis: { total: 0, free: 0, trial: 0, pro: 0, mrr: 0, novos_30d: [] },
        alertas: { trials_expirando: [], inadimplentes: [] },
        loading: true,
        error: null,

        async loadData() {
          const token = localStorage.getItem('admin_token');
          if (!token) {
            window.location.href = '/admin';
            return;
          }

          try {
            const res = await fetch(`${window.SUPABASE_URL}/functions/v1/admin-dashboard`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Falha ao carregar dados');

            const data = await res.json();
            this.kpis = data.kpis;
            this.alertas = data.alertas;
          } catch (e) {
            this.error = e.message;
          } finally {
            this.loading = false;
          }
        },

        formatBRL(value) {
          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        },

        formatDate(dateStr) {
          return new Date(dateStr).toLocaleDateString('pt-BR');
        }
      };
    }
  </script>

</body>
</html>
```

### Fase 2: Lista de Profissionais (3-4 horas)

**Objetivo:** Poder buscar, filtrar e ver detalhes de qualquer profissional

#### Passo 1: Página de Profissionais

```html
<!-- pages/admin/admin-profissionais.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>AgendaPro Admin — Profissionais</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.8/dist/cdn.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>[x-cloak] { display: none !important; }</style>
</head>
<body class="min-h-screen bg-dark text-white">

  <header class="border-b border-border bg-dark2 sticky top-0">
    <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
      <div class="flex gap-4 items-center">
        <h1 class="text-xl font-semibold">👥 Profissionais</h1>
        <a href="/admin/dashboard" class="text-sm text-gray-400 hover:text-white">← Dashboard</a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8" x-data="profissionaisList()" x-init="loadProfissionais()">

    <!-- Filtros -->
    <div class="flex gap-4 mb-6">
      <input type="text" x-model="busca" @input.debounce.300ms="loadProfissionais()"
             placeholder="Buscar por nome ou email..."
             class="flex-1 px-4 py-2 bg-dark2 border border-border rounded-lg text-white placeholder-gray-500">

      <select x-model="plano" @change="loadProfissionais()"
              class="px-4 py-2 bg-dark2 border border-border rounded-lg text-white">
        <option value="">Todos os planos</option>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="trial">Trial</option>
      </select>
    </div>

    <!-- Loading -->
    <div x-show="loading" x-cloak class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-lime"></div>
    </div>

    <!-- Lista -->
    <div x-show="!loading" x-cloak>
      <p class="text-gray-400 text-sm mb-4" x-text="total + ' profissionais encontrados'"></p>

      <div class="bg-dark2 border border-border rounded-lg overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-gray-400 border-b border-border">
              <th class="text-left py-3 px-4">Nome</th>
              <th class="text-left py-3 px-4">Email</th>
              <th class="text-left py-3 px-4">Plano</th>
              <th class="text-left py-3 px-4">Cadastro</th>
              <th class="text-left py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            <template x-for="p in profissionais" :key="p.id">
              <tr class="border-b border-border/50 hover:bg-dark3">
                <td class="py-3 px-4" x-text="p.nome"></td>
                <td class="py-3 px-4 text-gray-400" x-text="p.email"></td>
                <td class="py-3 px-4">
                  <span class="px-2 py-1 rounded text-xs"
                        :class="{
                          'bg-gray-500/20 text-gray-400': p.plano === 'free',
                          'bg-lime/20 text-lime': p.plano === 'pro',
                          'bg-yellow-500/20 text-yellow-400': p.trial_ends_at && new Date(p.trial_ends_at) > new Date()
                        }"
                        x-text="getPlanoLabel(p)"></span>
                </td>
                <td class="py-3 px-4 text-gray-400" x-text="formatDate(p.created_at)"></td>
                <td class="py-3 px-4">
                  <a :href="'/admin/profissional/' + p.id" class="text-lime hover:underline">Ver detalhes</a>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Paginação -->
      <div class="flex justify-center gap-2 mt-6">
        <button @click="page--; loadProfissionais()" :disabled="page === 0"
                class="px-4 py-2 bg-dark2 border border-border rounded disabled:opacity-50">Anterior</button>
        <span class="px-4 py-2" x-text="'Página ' + (page + 1)"></span>
        <button @click="page++; loadProfissionais()" :disabled="!has_more"
                class="px-4 py-2 bg-dark2 border border-border rounded disabled:opacity-50">Próxima</button>
      </div>
    </div>
  </main>

  <script>
    function profissionaisList() {
      return {
        profissionais: [],
        busca: '',
        plano: '',
        page: 0,
        total: 0,
        has_more: false,
        loading: true,

        async loadProfissionais() {
          const token = localStorage.getItem('admin_token');
          if (!token) { window.location.href = '/admin'; return; }

          this.loading = true;
          const params = new URLSearchParams({ q: this.busca, plano: this.plano, page: this.page });

          try {
            const res = await fetch(`${window.SUPABASE_URL}/functions/v1/admin-profissionais?${params}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            this.profissionais = data.profissionais;
            this.total = data.total;
            this.has_more = data.has_more;
          } catch (e) {
            console.error(e);
          } finally {
            this.loading = false;
          }
        },

        getPlanoLabel(p) {
          if (p.trial_ends_at && new Date(p.trial_ends_at) > new Date()) return 'Trial';
          return p.plano === 'pro' ? 'Pro' : 'Free';
        },

        formatDate(d) { return new Date(d).toLocaleDateString('pt-BR'); }
      };
    }
  </script>

</body>
</html>
```

### Fase 3: Gestão Financeira (3-4 horas)

**Objetivo:** Ver faturamento, pagamentos pendentes, inadimplência

*(Estrutura similar, usando `admin-financeiro` edge function)*

---

## 7. Edge Functions Necessárias

### 7.1 Lista Completa

| Função | Método | Auth | Descrição | Prioridade |
|--------|--------|------|-----------|------------|
| `admin-validate` | POST | ADMIN_PASSWORD | Valida login admin | 🔴 |
| `admin-dashboard` | GET | ADMIN_PASSWORD | KPIs agregados | 🔴 |
| `admin-profissionais` | GET | ADMIN_PASSWORD | Lista/busca users | 🔴 |
| `admin-financeiro` | GET | ADMIN_PASSWORD | Dados financeiros | 🟡 |
| `admin-alertas` | GET | ADMIN_PASSWORD | Alertas diversos | 🟡 |
| `admin-user-detail` | GET | ADMIN_PASSWORD | Perfil completo | 🟡 |
| `admin-actions` | POST | ADMIN_PASSWORD | Ações admin | 🟡 |

### 7.2 Deploy

```bash
# Deploy de todas as funções admin
for fn in admin-validate admin-dashboard admin-profissionais admin-financeiro admin-alertas admin-user-detail admin-actions; do
  supabase functions deploy $fn --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
done
```

---

## 8. Modelo de Dados Admin

### 8.1 Tabelas Existentes (Reutilizadas)

```sql
-- Todas as tabelas existentes são reutilizadas
-- Nenhuma tabela nova é obrigatória para o MVP

prestadores      → Dados dos profissionais
agendamentos     → Atividade de agendamento
pagamentos       → Histórico financeiro
servicos         → Serviços oferecidos
```

### 8.2 Tabela Opcional: Audit Log

```sql
-- migrations/admin-audit-log.sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID, -- ou admin_email text
  acao TEXT NOT NULL,               -- 'estender_trial', 'suspender_user', etc
  alvo_tipo TEXT NOT NULL,          -- 'prestador', 'pagamento', etc
  alvo_id UUID,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: apenas admins podem ver
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver audit log"
  ON admin_audit_log
  FOR ALL
  TO authenticated
  USING (true);
```

### 8.3 Secrets Necessárias

```bash
# Adicionar ao .env.local e GitHub Secrets
ADMIN_PASSWORD="senha_super_segura_e_longa_aqui"

# Configurar no Supabase
supabase secrets set ADMIN_PASSWORD="senha_super_segura_e_longa_aqui" --project-ref kevqgxmcoxmzbypdjhru
```

---

## 9. Segurança do Admin

### 9.1 Autenticação

```
Opção 1: ADMIN_SECRET (Mais simples, recomendado para MVP)
──────────────────────────────────────────────────────────
• Senha única armazenada em variável de ambiente
• Edge functions validam Authorization: Bearer <senha>
• Frontend armazena em localStorage
• Rápido de implementar (30 min)

Opção 2: Supabase Auth separado (Mais robusto)
─────────────────────────────────────────────────
• Criar usuário admin no Supabase Auth
• Usar sessão real com JWT
• Edge functions validam JWT
• Permite múltiplos admins com permissões diferentes
• Mais tempo para implementar (2h)
```

**Recomendação:** Começar com Opção 1 (MVP), migrar para Opção 2 quando tiver >1 admin

### 9.2 Proteção de Rotas

```javascript
// Todas as páginas admin verificam token antes de renderizar
// admin-auth.js
export function requireAdminAuth() {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    window.location.href = '/admin';
    return null;
  }
  return token;
}

// Uso em cada página
document.addEventListener('DOMContentLoaded', () => {
  const token = requireAdminAuth();
  if (!token) return;
  // ... restante da página
});
```

### 9.3 Proteção de Edge Functions

```typescript
// Todas as edge functions admin validam token
// _shared/admin-auth.ts
export function validateAdmin(req: Request): boolean {
  const auth = req.headers.get("Authorization");
  const expected = `Bearer ${Deno.env.get("ADMIN_PASSWORD")}`;
  return auth === expected;
}

// Uso em cada função
Deno.serve(async (req) => {
  if (!validateAdmin(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... restante da função
});
```

### 9.4 Rate Limiting (Opcional)

```typescript
// Para evitar abuso, adicionar rate limiting simples
// Edge functions podem limitar por IP

const rateLimit = new Map<string, { count: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimit.get(ip);

  if (!limit || now > limit.reset) {
    rateLimit.set(ip, { count: 1, reset: now + 60 * 1000 });
    return true;
  }

  if (limit.count >= 30) return false; // 30 req/min
  limit.count++;
  return true;
}
```

---

## 10. Roadmap Sugerido

### 10.1 Timeline

```
SEMANA 1 (6h) — Admin MVP
────────────────────────────
[ ] 1. Criar ADMIN_PASSWORD (30 min)
[ ] 2. Edge function admin-validate (30 min)
[ ] 3. Edge function admin-dashboard (1h)
[ ] 4. Edge function admin-profissionais (1h)
[ ] 5. Página admin-auth.html (30 min)
[ ] 6. Página admin-dashboard.html com Alpine.js (2h)
[ ] 7. Página admin-profissionais.html com Alpine.js (1h)

SEMANA 2 (6h) — Gestão Financeira
────────────────────────────────────
[ ] 1. Edge function admin-financeiro (2h)
[ ] 2. Página admin-financeiro.html (2h)
[ ] 3. Edge function admin-alertas (1h)
[ ] 4. Edge function admin-user-detail (1h)

SEMANA 3 (4h) — Ações Admin
───────────────────────────────
[ ] 1. Edge function admin-actions (2h)
     • Estender trial
     • Suspender usuário
     • Alterar plano
[ ] 2. Integrar ações na UI (2h)

SEMANA 4 (4h) — Polimento
─────────────────────────────
[ ] 1. Gráficos de tendência (2h)
[ ] 2. Comunicados em massa (1h)
[ ] 3. Audit log (1h)
```

### 10.2 Priorização por Valor

```
VALOR DE NEGÓCIO
    │
  5 │  Dashboard KPIs    Alertas de churn
    │  Lista users       Gestão financeira
  4 │  Ações admin       Gráficos tendência
    │  Comunicados       Audit log
  3 │
    │
  2 └─────────────────────────────────────
      1h    2h    3h    4h    5h    6h   → ESFORÇO

  FAZER PRIMEIRO: Quadrante superior esquerdo
```

### 10.3 Métricas de Sucesso do Admin

| Métrica | Antes do Admin | Depois do Admin | Meta |
|---------|----------------|-----------------|------|
| Tempo para ver KPIs | 30 min (manual) | 5 segundos | <10s |
| Tempo para encontrar user | 10 min (query) | 5 segundos | <10s |
| Detecção de churn | Sem detecção | Imediata (alertas) | <1h |
| Tempo em suporte/mês | 5h | 2h | <3h |
| Receita recuperada/mês | R$ 0 | ~R$ 2.000 | >R$ 1.500 |

---

## 📎 Apêndice A: Comparação de Stack

### Stack Atual vs Proposta

| Aspecto | Atual (Vanilla) | Proposta (Alpine.js + TS) |
|---------|-----------------|---------------------------|
| Frontend Admin | Não existe | Alpine.js + Tailwind |
| Backend | TypeScript (Deno) | TypeScript (Deno) — manter |
| Reatividade | Manual (DOM) | Automática (x-model, x-bind) |
| Type Safety | ❌ No frontend | ✅ TypeScript everywhere |
| Tamanho bundle | ~50kb (manual) | ~65kb (Alpine + Tailwind CDN) |
| Curva aprendizado | — | 30 min (Alpine) |
| Tempo dev admin | 20h+ (vanilla) | 12-16h (Alpine) |

### Por Que NÃO React/Vue/Angular

| Framework | Problema para Este Caso |
|-----------|-------------------------|
| **React** | Precisa JSX, build step, router. Exagero para painel admin simples |
| **Vue** | Precisa build step para SFCs. Parcialmente compatível com HTML estático |
| **Angular** | Framework completo, curva alta. Exagero total |
| **Svelte** | Precisa compilação. Mesmo problema |
| **Alpine.js** | ✅ Funciona inline no HTML. Sem build step. Reatividade imediata |

### Quando Considerar Migração Mais Pesada

| Gatilho | Ação |
|---------|------|
| >500 profissionais ativos | Considerar Astro ou Vite + Preact |
| Funcionalidades complexas de UI | Considerar React + shadcn/ui |
| Equipe >2 devs | Framework com mais estrutura faz sentido |
| App mobile necessário | Considerar React Native ou Flutter |

---

## 📎 Apêndice B: Query SQL para KPIs Manuais (Enquanto Admin Não Existe)

```sql
-- Cole isso no Supabase SQL Editor para ver métricas básicas

-- 1. Total de profissionais por plano
SELECT
  plano,
  COUNT(*) as total,
  COUNT(CASE WHEN trial_ends_at > NOW() THEN 1 END) as trial_ativo,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as novos_30d
FROM prestadores
GROUP BY plano;

-- 2. Faturamento do mês
SELECT
  SUM(valor) as total,
  COUNT(*) as pagamentos,
  billing_type
FROM pagamentos
WHERE data_evento >= DATE_TRUNC('month', NOW())
GROUP BY billing_type;

-- 3. Trials expirando em 3 dias
SELECT nome, email, trial_ends_at
FROM prestadores
WHERE trial_ends_at > NOW()
  AND trial_ends_at <= NOW() + INTERVAL '3 days'
ORDER BY trial_ends_at;

-- 4. Profissionais com plano vencido
SELECT nome, email, plano_valido_ate
FROM prestadores
WHERE plano = 'pro'
  AND plano_valido_ate < NOW()
ORDER BY plano_valido_ate;

-- 5. Novos profissionais (últimos 7 dias)
SELECT nome, email, plano, created_at
FROM prestadores
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 6. Top 10 profissionais por receita
SELECT
  p.nome,
  p.email,
  COUNT(a.id) as total_agendamentos,
  SUM(s.preco) as receita_total
FROM prestadores p
JOIN agendamentos a ON a.prestador_id = p.id
JOIN servicos s ON s.id = a.servico_id
WHERE a.status IN ('confirmado', 'concluido')
GROUP BY p.id, p.nome, p.email
ORDER BY receita_total DESC
LIMIT 10;
```

---

## 📎 Apêndice C: Exemplo Completo — Edge Function + Frontend

*(Já incluído nas seções 6.2 e 6.3 acima)*

---

*Documento criado em 2026-04-05*  
*Próxima revisão: Após implementação do MVP*
