# 🔒 Segurança de Acesso — Guia Rápido

**Última atualização:** 2026-04-05

---

## ⚠️ CORS no Supabase — Não é necessário configurar

**O Supabase já permite CORS de qualquer origem por padrão.** Não existe um campo "Allowed CORS Origins" no painel. Isso é intencional — a segurança vem de outras camadas.

---

## 🛡️ Como o AgendaPro está protegido

### Camada 1: RLS (Row Level Security) ✅ Já configurado

Cada tabela do banco tem políticas RLS que garantem que:

```sql
-- Exemplo: prestador só vê seus próprios dados
CREATE POLICY "Prestador vê seus agendamentos"
  ON agendamentos FOR SELECT TO authenticated
  USING (auth.uid() = prestador_id);
```

Mesmo que alguém copie sua `SUPABASE_ANON` (chave pública), **só consegue acessar dados do próprio usuário autenticado**.

### Camada 2: API Keys

| Chave | Tipo | Onde usar | Risco se vazada |
|-------|------|-----------|-----------------|
| `anon` (pública) | Client-side | Frontend (HTML/JS) | **Baixo** — limitada por RLS |
| `service_role` (secreta) | Server-side | Edge Functions apenas | **ALTO** — bypassa RLS |

**Nenhuma `service_role` está exposta no código fonte.** ✅

### Camada 3: CORS nas Edge Functions

As Edge Functions usam `Access-Control-Allow-Origin: "*"`, o que é **intencional e seguro** porque:
- A validação real é feita pelo **JWT do usuário** (Supabase Auth)
- Sem JWT válido, a função não retorna dados sensíveis
- Webhooks (Asaas) validam token próprio (`asaas-access-token`)

---

## ✅ Checklist de Segurança Atual

```
[x] RLS habilitado em todas as tabelas
[x] Chave service_role nunca exposta no frontend
[x] Webhook Asaas valida token próprio
[x] Variáveis sensíveis apenas via Deno.env.get() (server-side)
[x] .env.local no .gitignore
[x] Nenhuma credencial hardcoded no código
```

---

## 🔍 Se quiser adicionar proteção extra

### Opção A: Rate Limiting no Supabase

No painel do Supabase → Settings → API → **Rate Limiting** (se disponível no seu plano).

### Opção B: Validar origem nas Edge Functions

Se quiser restringir quais domínios podem chamar suas Edge Functions, adicione em cada função:

```typescript
const ALLOWED_ORIGINS = [
  "https://e-agendapro.web.app",
  "https://agendapro.com.br",
];

const origin = req.headers.get("origin");
if (origin && !ALLOWED_ORIGINS.includes(origin)) {
  return new Response("Forbidden", { status: 403 });
}
```

⚠️ **Cuidado:** isso pode quebrar o desenvolvimento local (`localhost:3000`).

---

**Resumo:** O projeto já está seguro com as configurações atuais. Não é necessária nenhuma ação manual no painel do Supabase para CORS.
