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

## Passo 1: Setar Secrets no Supabase

São necessárias **2 variáveis** como secrets nas Edge Functions:

### Via CLI do Supabase:
```bash
# Senha de acesso ao painel admin
supabase secrets set ADMIN_PASSWORD="sua_senha_forte_aqui" --project-ref kevqgxmcoxmzbypdjhru

# Service Role Key (necessária para admin-dashboard ler todos os usuários, bypass RLS)
# Pegar em: Supabase Dashboard → Settings → API → service_role key (secret)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." --project-ref kevqgxmcoxmzbypdjhru
```

### Via Dashboard (browser):
1. Acesse: https://supabase.com/dashboard/project/kevqgxmcoxmzbypdjhru
2. Vá em **Edge Functions** no menu lateral
3. Clique em **Secrets** (aba ou seção)
4. Clique em **Add Secret** para cada variável:

| Nome | Valor | Obrigatório? |
|------|-------|-------------|
| `ADMIN_PASSWORD` | Senha forte (min 16 chars) | ✅ Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (Supabase → Settings → API) | ✅ Sim |

> ⚠️ **Importante**: A `SUPABASE_SERVICE_ROLE_KEY` é necessária porque a Edge Function `admin-dashboard` precisa ler **todos os prestadores**, não apenas o logado. As políticas RLS do Supabase bloqueiam isso para usuários normais, então usamos a service_role key que tem permissão total. **Nunca exponha essa chave no frontend.**

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

## 🔒 Segurança — Quem pode acessar?

### Cenário: Profissional logado tenta acessar `/admin/dashboard`

| Situação | Resultado |
|----------|-----------|
| Profissional logado, **sem** token admin | ❌ **Redirecionado** para `/admin/login` |
| Profissional logado, **com** token admin (de sessão anterior) | ✅ Acessa (token válido) |
| Profissional logado, **sabe a senha admin** | ✅ Acessa (senha correta) |

**Conclusão:** A segurança depende **apenas** da `ADMIN_PASSWORD`. Qualquer pessoa com a senha tem acesso total.

### Mitigações atuais:
- ✅ Token expira em 24h
- ✅ Senha **nunca** é enviada para o Supabase (comparação server-side na Edge Function)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` **nunca** chega ao frontend

### Mitigações futuras (Fase 2+):
- [ ] Limitar por IP (bloquear faixas desconhecidas)
- [ ] Adicionar 2FA (TOTP)
- [ ] Log de acessos admin (quem, quando, de onde)
- [ ] Trocar token simples por JWT assinado
- [ ] Adicionar rate limit na Edge Function de login

---

## Variáveis Necessárias — Resumo

| Variável | Onde | Obrigatória? | Descrição |
|----------|------|-------------|-----------|
| `ADMIN_PASSWORD` | Supabase Secrets + .env.local | ✅ Sim | Senha de acesso ao admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secrets apenas | ✅ Sim | Chave service_role (bypass RLS) |

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
