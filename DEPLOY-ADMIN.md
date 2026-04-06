# Deploy do Painel Admin — Guia Rápido

## Status Atual (FASE 1-4 implementadas)

✅ **Arquivos criados:**
```
pages/admin/login.html          → /admin/login
pages/admin/dashboard.html      → /admin/dashboard
pages/admin/profissionais.html  → /admin/profissionais
pages/admin/financeiro.html     → /admin/financeiro
pages/admin/acoes.html          → /admin/acoes
pages/admin/configuracoes.html  → /admin/configuracoes
modules/admin-auth.js           → módulo JS reutilizável
supabase/functions/admin-validate/index.ts      → Edge Function auth
supabase/functions/admin-dashboard/index.ts     → Edge Function KPIs
supabase/functions/admin-profissionais/index.ts → Edge Function listagem
supabase/functions/admin-financeiro/index.ts    → Edge Function financeiro
supabase/functions/admin-actions/index.ts       → Edge Function ações admin
supabase/functions/admin-configuracoes/index.ts → Edge Function configurações
firebase.json                   → rotas atualizadas
.env.example                    → ADMIN_PASSWORD adicionada
```

### Edge Functions para deploy:
```bash
supabase functions deploy admin-validate admin-dashboard admin-profissionais admin-financeiro admin-actions admin-configuracoes --project-ref kevqgxmcoxmzbypdjhru
```

---

## Passo 1: Setar ADMIN_PASSWORD no Supabase

A Edge Function `admin-validate` precisa da variável `ADMIN_PASSWORD` como secret.

> ✅ **Nota:** A `SUPABASE_SERVICE_ROLE_KEY` já está configurada no Supabase (usada pela Edge Function `criar-assinatura`). Não precisa criar de novo.

### Via CLI do Supabase:
```bash
supabase secrets set ADMIN_PASSWORD="sua_senha_forte_aqui" --project-ref kevqgxmcoxmzbypdjhru
```

### Via Dashboard (browser):
1. Acesse: https://supabase.com/dashboard/project/kevqgxmcoxmzbypdjhru
2. Vá em **Edge Functions** no menu lateral
3. Clique em **Secrets**
4. Clique em **Add Secret**
   - Nome: `ADMIN_PASSWORD`
   - Valor: escolha uma senha forte
5. Salve

### Verificar segredos configurados:
```bash
supabase secrets list --project-ref kevqgxmcoxmzbypdjhru
```

### Segredos utilizados:
| Segredo | Uso |
|---|---|
| `ADMIN_PASSWORD` | Autenticação do painel admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso total ao banco (RLS bypass) |
| `ASAAS_API_KEY` | Integração de pagamentos Asaas |
| `ASAAS_WEBHOOK_TOKEN` | Validação de webhooks Asaas |

> ⚠️ **Importante**: A `SUPABASE_SERVICE_ROLE_KEY` é necessária porque as Edge Functions admin leem **todos os prestadores**. As políticas RLS bloqueiam isso para usuários normais, então usamos a service_role key que tem permissão total. **Nunca exponha essa chave no frontend.**

---

## Passo 2: Deploy das Edge Functions

### Via CLI do Supabase:
```bash
supabase functions deploy admin-validate --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy admin-dashboard --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy admin-profissionais --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy admin-financeiro --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy admin-actions --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy admin-configuracoes --project-ref kevqgxmcoxmzbypdjhru
```

---

## Passo 3: Deploy do Frontend

```bash
node build.js && firebase deploy --only hosting
```

---

## URLs do Painel

| Página | URL |
|---|---|
| Login | https://e-agendapro.web.app/admin/login |
| Dashboard | https://e-agendapro.web.app/admin/dashboard |
| Profissionais | https://e-agendapro.web.app/admin/profissionais |
| Financeiro | https://e-agendapro.web.app/admin/financeiro |
| Ações Admin | https://e-agendapro.web.app/admin/acoes |
| Configurações | https://e-agendapro.web.app/admin/configuracoes |

---

## Notas Técnicas

- Edge Functions exigem header `Authorization: Bearer <anon_key>` (não `apikey`)
- `config.js` expõe `window.*` globais, não ES module exports
- Sentry usa `modules/sentry.js` auto-carregado no `<head>`, sem imports manuais
- O CORS (_shared/cors.ts) permite headers: `authorization`, `content-type`, `apikey`, `asaas-access-token`, `x-admin-token`
