# Deploy do Painel Admin — Guia Rápido

## Status Atual (FASE 1+2 implementadas)

✅ **Arquivos criados:**
```
pages/admin/login.html          → /admin/login
pages/admin/dashboard.html      → /admin/dashboard
modules/admin-auth.js           → módulo JS reutilizável
supabase/functions/admin-validate/index.ts  → Edge Function auth
supabase/functions/admin-dashboard/index.ts → Edge Function KPIs
firebase.json                   → rotas atualizadas
.env.example                    → ADMIN_PASSWORD adicionado
```

---

## Passo 1: Setar ADMIN_PASSWORD no Supabase

A Edge Function `admin-validate` precisa da variável `ADMIN_PASSWORD` como secret.

### Via CLI do Supabase:
```bash
# Dentro do diretório do projeto
supabase secrets set ADMIN_PASSWORD="sua_senha_forte_aqui" --project-ref kevqgxmcoxmzbypdjhru
```

### Via Dashboard (browser):
1. Acesse: https://supabase.com/dashboard/project/kevqgxmcoxmzbypdjhru
2. Vá em **Edge Functions** no menu lateral
3. Clique em **Secrets** (aba ou seção)
4. Clique em **Add Secret**
5. Nome: `ADMIN_PASSWORD`
6. Valor: escolha uma senha forte (ex: `AgendaPr0#Admin$2026!Seguro`)
7. Salve

> ⚠️ **Importante**: Use a mesma senha em `.env.local` e como secret no Supabase.

---

## Passo 2: Deploy das Edge Functions

### Opção A: Via CLI do Supabase (recomendado)
```bash
# Deploy admin-validate
supabase functions deploy admin-validate --project-ref kevqgxmcoxmzbypdjhru

# Deploy admin-dashboard
supabase functions deploy admin-dashboard --project-ref kevqgxmcoxmzbypdjhru
```

### Opção B: Via Dashboard (browser)
1. Acesse: https://supabase.com/dashboard/project/kevqgxmcoxmzbypdjhru
2. Vá em **Edge Functions**
3. Clique em **Create new function**
4. Copie o conteúdo de `supabase/functions/admin-validate/index.ts`
5. Nomeie como `admin-validate`
6. Repita para `admin-dashboard`

---

## Passo 3: Deploy do Frontend (Firebase)

```bash
# Build (substitui placeholders pelas variáveis)
npm run build

# Deploy para Firebase Hosting
firebase deploy --only hosting
```

> 📌 O `.env.local` precisa ter `ADMIN_PASSWORD` configurado (mesma senha do Supabase).

---

## Passo 4: Testar Acesso

1. Acesse: `https://SEU_DOMINIO.web.app/admin/login`
2. Digite a senha definida em `ADMIN_PASSWORD`
3. Clique em "Entrar no Painel"
4. Será redirecionado para `/admin/dashboard`

### Se funcionar:
- ✅ 4 KPIs aparecem (Total, MRR, Novos, Agendamentos)
- ✅ Alertas são exibidos
- ✅ Tabela "Novos Usuários" mostra últimos 5 registros

### Se der erro:
- Verifique o console do browser (F12)
- Verifique logs da Edge Function no Supabase Dashboard
- Confirme que `ADMIN_PASSWORD` está setada corretamente

---

## Variáveis Necessárias — Resumo

| Variável | Onde | Obrigatório? | Descrição |
|----------|------|-------------|-----------|
| `ADMIN_PASSWORD` | Supabase Secrets + .env.local | ✅ Sim | Senha de acesso ao admin |

---

## Fluxo de Autenticação (como funciona)

```
1. Admin digita senha em /admin/login
2. Frontend chama POST /functions/v1/admin-validate
   body: { action: 'validate_password', password: '...' }
3. Edge Function compara com ADMIN_PASSWORD
4. Se válida → retorna token JWT simples (24h)
5. Frontend salva em localStorage ('admin_token')
6. Toda request futura envia header: x-admin-token: <token>
7. Edge Functions validam o token antes de retornar dados
```

---

## Próximas Fases (ainda não implementadas)

| Fase | Páginas | Edge Functions | Status |
|------|---------|---------------|--------|
| **FASE 3** | `/admin/profissionais` | `admin-profissionais` | ⏳ Pendente |
| **FASE 4** | `/admin/financeiro` | `admin-financeiro`, `admin-actions` | ⏳ Pendente |

---

## Rollback (se necessário)

Se precisar remover o admin:
```bash
# Remover rotas do firebase.json
# Remover edge functions
supabase functions delete admin-validate --project-ref kevqgxmcoxmzbypdjhru
supabase functions delete admin-dashboard --project-ref kevqgxmcoxmzbypdjhru
# Remover secret
supabase secrets unset ADMIN_PASSWORD --project-ref kevqgxmcoxmzbypdjhru
```
