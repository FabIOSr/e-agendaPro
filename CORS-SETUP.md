# 🔒 Configurando CORS no Supabase — Guia Rápido

**Tempo:** 5 minutos  
**Por quê:** Impede que outros sites/domínios usem sua chave SUPABASE_ANON para acessar seus dados.

---

## Passo a Passo

### 1. Acesse o Painel do Supabase

Vá para: **https://app.supabase.com**

Selecione seu projeto: `agendapro` (ref: `kevqgxmcoxmzbypdjhru`)

---

### 2. Vá para Settings → API

No menu lateral esquerdo:

```
⚙️ Settings
   └── API
```

---

### 3. Configure "Allowed CORS Origins"

Na seção **API Configuration**, localize o campo:

```
Allowed CORS Origins (Origens Permitidas)
```

**Adicione os seguintes domínios:**

```
https://e-agendapro.web.app
https://agendapro.com.br
https://*.agendapro.com.br
```

**NÃO adicione:**
- ❌ `http://localhost:3000` (use apenas em desenvolvimento, remova antes de ir para produção)
- ❌ `*` (coringa universal — permite QUALQUER site)

---

### 4. Salve

Clique em **Save Changes**.

---

### 5. Verifique

Agora abra o console do navegador (F12) e rode:

```javascript
fetch('https://kevqgxmcoxmzbypdjhru.supabase.co/rest/v1/', {
  headers: { 'apikey': 'SUA_CHAVE_ANON_AQUI' }
})
```

- ✅ **De um domínio permitido:** funciona (200)
- ❌ **De outro domínio qualquer:** bloqueado (CORS error)

---

## ⚠️ Importante

- O CORS é uma camada **adicional** de proteção. Sua chave SUPABASE_ANON ainda é pública por natureza.
- A proteção real vem do **RLS (Row Level Security)** que já está configurado no banco.
- O CORS impede que sites maliciosos façam requisições **diretamente do navegador** do usuário.

---

## 📸 Screenshot Esperado

```
┌─────────────────────────────────────────────────────┐
│  API Settings                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Project URL                                        │
│  https://kevqgxmcoxmzbypdjhru.supabase.co           │
│                                                     │
│  Project API keys                                   │
│  anon (public)  eyJhbG...                           │
│  service_role   eyJhbG... (secreta)                 │
│                                                     │
│  Allowed CORS Origins                               │
│  ┌───────────────────────────────────────────────┐  │
│  │ https://e-agendapro.web.app                   │  │
│  │ https://agendapro.com.br                      │  │
│  │ https://*.agendapro.com.br                    │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [Save Changes]                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

**Feito!** ✅ Quando concluir, pode marcar o item como concluído e vamos para o próximo.
