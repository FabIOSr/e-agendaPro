# 🛡️ Guia de Configuração do Sentry — AgendaPro

**Última atualização:** 2026-03-31  
**Tempo estimado:** 15-20 minutos

---

## 📋 O Que É Sentry?

Sentry é um serviço de **monitoramento de erros em tempo real**. Com ele, você:

- ✅ Recebe alertas de erros **antes dos usuários reclamarem**
- ✅ Vê **exatamente** onde o erro ocorreu (arquivo, linha, stack trace)
- ✅ Sabe **quantos usuários** foram afetados
- ✅ Acompanha o **impacto de cada bug** no seu negócio

---

## 🚀 Passo a Passo — Configuração Completa

### Passo 1: Criar Conta no Sentry (3 min)

1. Acesse **https://sentry.io**
2. Clique em **"Sign Up"**
3. Escolha uma das opções:
   - GitHub (recomendado)
   - Google
   - Email

4. Complete o onboarding (perguntas sobre seu time)

---

### Passo 2: Criar Projeto JavaScript (5 min)

1. No dashboard, clique em **"Create Project"**

2. Escolha a plataforma:
   ```
   📌 JavaScript
   ```

3. Configure o projeto:
   ```
   Project Name: AgendaPro Frontend
   (opcional) Team: AgendaPro
   ```

4. Anote o **DSN** que será exibido:
   ```
   https://xxx@sentry.io/123456
   ```
   **Guarde este valor!** Você vai usar nos próximos passos.

---

### Passo 3: Adicionar DSN no `.env.local` (2 min)

Edite o arquivo `.env.local` na raiz do projeto:

```bash
# .env.local

# ... outras configs ...

# ============================================
# SENTRY - Monitoramento de Erros
# ============================================
SENTRY_DSN=https://SEU_DSN_AQUI@sentry.io/SEU_PROJETO_ID
SENTRY_ENVIRONMENT=production
```

**Importante:**
- Em **desenvolvimento**, deixe `SENTRY_DSN=` vazio ou use `SENTRY_ENVIRONMENT=development`
- Em **produção**, use o DSN real e `SENTRY_ENVIRONMENT=production`

---

### Passo 4: Adicionar Secret no Supabase (3 min)

Para capturar erros das **Edge Functions**, adicione o DSN nos secrets do Supabase:

```bash
supabase secrets set SENTRY_DSN="https://SEU_DSN_AQUI@sentry.io/SEU_PROJETO_ID"
supabase secrets set SENTRY_ENVIRONMENT="production"
```

Ou pelo painel do Supabase:
1. Acesse https://app.supabase.com
2. Selecione seu projeto (`agendapro`)
3. Vá em **Edge Functions** → **Secrets**
4. Clique em **"New Secret"**
5. Adicione:
   - Nome: `SENTRY_DSN`
   - Valor: `https://SEU_DSN_AQUI@sentry.io/SEU_PROJETO_ID`
6. Repita para `SENTRY_ENVIRONMENT`

---

### Passo 5: Rodar Build e Fazer Deploy (5 min)

```bash
# 1. Rodar build (injeta variáveis no frontend)
npm run build

# 2. Deploy do frontend (Firebase Hosting)
firebase deploy --only hosting

# 3. Deploy das Edge Functions (Supabase)
supabase functions deploy horarios-disponiveis
supabase functions deploy criar-agendamento
supabase functions deploy criar-assinatura
supabase functions deploy webhook-asaas
```

---

## ✅ Verificando Funcionamento

### Teste 1: Erro no Frontend

1. Abra o console do navegador (F12)
2. Acesse uma página qualquer, ex: `https://e-agendapro.web.app/painel`
3. No console, digite:
   ```javascript
   Sentry.captureMessage('Teste de monitoramento - ' + new Date().toISOString());
   ```
4. Acesse o dashboard do Sentry
5. Em **Issues**, você deve ver uma nova issue com a mensagem de teste

### Teste 2: Erro nas Edge Functions

1. Faça uma requisição inválida para testar:
   ```bash
   curl -X POST https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/horarios-disponiveis \
     -H "Content-Type: application/json" \
     -H "apikey: SUA_CHAVE_ANON" \
     -d '{"invalid": "data"}'
   ```
2. Acesse o dashboard do Sentry
3. Em **Issues**, procure por erros da função `horarios-disponiveis`

---

## 📊 Dashboard do Sentry — O Que Esperar

### Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│  Sentry Dashboard — AgendaPro Frontend                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📊 Últimas 24h                                         │
│  ─────────────────────────────────────────────────────  │
│  🛑 3 issues novas                                      │
│  ⚠️  12 usuários afetados                              │
│  📈 1.2K eventos                                       │
│                                                         │
│  ISSUES MAIS FREQUENTES:                                │
│                                                         │
│  1. ❌ Cannot read property 'id' of undefined           │
│     📄 pagina-cliente.html:247                          │
│     👥 5 usuários afetados                             │
│     🕐 2 horas atrás                                   │
│     [Ver detalhes]                                      │
│                                                         │
│  2. ❌ Network timeout                                  │
│     📄 criar-agendamento.ts:45                         │
│     👥 3 usuários afetados                             │
│     🕐 5 horas atrás                                   │
│     [Ver detalhes]                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Detalhes de uma Issue

Ao clicar em uma issue, você vê:

```
┌─────────────────────────────────────────────────────────┐
│  Cannot read property 'id' of undefined                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📍 Local: pagina-cliente.html:247:15                   │
│  👥 5 usuários afetados                                 │
│  📊 47 eventos                                          │
│  🕐 Primeira vez: 2 dias atrás                          │
│                                                         │
│  STACK TRACE:                                           │
│  ─────────────────────────────────────────────────────  │
│  at selecionarHorario (pagina-cliente.html:247:15)      │
│  at HTMLButtonElement.onclick (pagina-cliente.html:189) │
│                                                         │
│  CONTEXTO:                                              │
│  ─────────────────────────────────────────────────────  │
│  User: ramos.fsilva@gmail.com                           │
│  URL: https://e-agendapro.web.app/ana-cabelos           │
│  Browser: Chrome 122 on Windows                         │
│  Service: servico_id: null                              │
│                                                         │
│  AÇÕES:                                                 │
│  ─────────────────────────────────────────────────────  │
│  [Assign] [Resolve] [Ignore] [Share]                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Melhores Práticas

### 1. **Não capture dados sensíveis**

O Sentry **NÃO** deve capturar:
- ❌ Senhas
- ❌ Tokens de API
- ❌ Dados de cartão de crédito
- ❌ CPF/CNPJ completos

**Como evitar:**
```javascript
// ❌ ERRADO - captura dados sensíveis
Sentry.setUser({
  id: usuario.id,
  email: usuario.email,
  senha: usuario.senha  // NUNCA FAÇA ISSO!
});

// ✅ CERTO - apenas dados públicos
Sentry.setUser({
  id: usuario.id,
  email: usuario.email
});
```

### 2. **Use tags para filtrar**

```javascript
// Adiciona tags para facilitar busca
Sentry.setTag('plano', 'pro');
Sentry.setTag('feature', 'agendamento');
```

### 3. **Adicione contexto útil**

```javascript
// Antes de uma operação crítica
Sentry.setContext('agendamento', {
  servico_id: servico.id,
  data_hora: dataHora,
  cliente_nome: clienteNome
});

try {
  await criarAgendamento();
} catch (erro) {
  Sentry.captureException(erro);
}
```

### 4. **Configure alertas**

No dashboard do Sentry:
1. Vá em **Settings** → **Alerts**
2. Clique em **"Create Alert"**
3. Configure:
   ```
   When: 100 errors in 5 minutes
   Notify: Email, Slack (opcional)
   ```

---

## 💰 Plano Gratuito

O plano **Developer** (grátis) inclui:

| Recurso | Limite |
|---------|--------|
| Eventos/mês | 5.000 |
| Usuários | 1 |
| Retenção de dados | 30 dias |
| Replays de sessão | 1.000/mês |

**Para AgendaPro:** Suficiente para começar! Se passar de 5K erros/mês, avalie upgrade.

---

## 🔧 Troubleshooting

### "Sentry não está capturando erros"

**Verifique:**

1. DSN está correto no `.env.local`?
   ```bash
   # Rode o build novamente
   npm run build
   ```

2. Secret está configurado no Supabase?
   ```bash
   supabase secrets list
   ```

3. Sentry SDK está carregado no frontend?
   ```javascript
   // No console do navegador:
   console.log(typeof Sentry);  // Deve retornar "function" ou "object"
   ```

### "Muitos eventos sendo enviados"

**Solução:** Reduza a taxa de amostragem:

```javascript
// modules/sentry.js
const SENTRY_CONFIG = {
  // ...
  tracesSampleRate: 0.01, // 1% das transações (era 0.1 = 10%)
};
```

---

## 📚 Links Úteis

- **Dashboard:** https://sentry.io
- **Docs JavaScript:** https://docs.sentry.io/platforms/javascript/
- **Docs Deno:** https://docs.sentry.io/platforms/deno/
- **Preços:** https://sentry.io/pricing/

---

## ✅ Checklist de Configuração

```
[ ] Conta criada no Sentry.io
[ ] Projeto "AgendaPro Frontend" criado
[ ] DSN anotado e guardado
[ ] .env.local atualizado com SENTRY_DSN
[ ] Secret SENTRY_DSN adicionado no Supabase
[ ] Build rodado (npm run build)
[ ] Frontend deployado (firebase deploy)
[ ] Edge Functions deployadas
[ ] Teste de erro no frontend funcionou
[ ] Teste de erro na Edge Function funcionou
```

---

**Pronto!** 🎉 Agora você tem monitoramento completo de erros no AgendaPro.

Sempre que um erro ocorrer, você receberá um alerta e poderá investigar antes que seus usuários sejam muito afetados.
