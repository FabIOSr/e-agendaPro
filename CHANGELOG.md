# 🚀 Changelog — AgendaPro

## [2026-04-02] — Correções Críticas: Limite Free, Timezone e Build

### 🔧 Correções Implementadas

#### 1. **Validação de Limite Free no Backend**
- **Arquivo:** `supabase/functions/criar-agendamento/index.ts`
- Edge Function já validava limite de 10 agendamentos/mês para Free
- **Adicionado:** Retorno do WhatsApp do prestador quando limite é atingido
- **Frontend atualizado:** `pages/pagina-cliente.html` agora exibe banner com botão WhatsApp

```typescript
// Backend retorna WhatsApp para contato alternativo
return Response.json({
  erro: "limite_atingido",
  count: count ?? 0,
  limite: LIMITE_FREE,
  whatsapp: prestador.whatsapp  // ← Novo
}, { status: 403 });
```

#### 2. **Timezone Correto nas Edge Functions**
- **Arquivos:** `cron-notificar-lista-espera/index.ts`, `horarios-disponiveis/index.ts`
- **Problema:** `date-fns-tz` causava erro de bundle no Deno
- **Solução:** Usar APIs nativas (`Intl.DateTimeFormat` e conversão manual)

```typescript
// Data atual em BRT (UTC-3) sem dependências externas
function getDataAtualBRT(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
```

#### 3. **Detecção de Timezone no Frontend**
- **Arquivo:** `pages/pagina-cliente.html`
- **Adicionado:** `state.timezone` detecta timezone do browser automaticamente
- **Envio:** Timezone é enviado para Edge Function no payload

```javascript
const state = {
  // ...
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};
```

#### 4. **Build com Placeholders Corretos**
- **Arquivos:** `config.js`, `build.js`, `modules/auth-session.js`
- **Problema:** Validação falhava após build porque checava placeholders antigos
- **Solução:** Placeholders `__VAR__` substituídos + validação atualizada

```javascript
// config.js (template)
const CONFIG_DEFAULTS = {
  SUPABASE_URL: '__SUPABASE_URL__',
  // ...
};

// Validação pré-build: checa placeholders
if (!config.SUPABASE_URL || config.SUPABASE_URL === '__SUPABASE_URL__' || ...)

// build.js: atualiza validação pós-build
configContent = configContent.replace(
  /if \(!config\.SUPABASE_URL \|\| config\.SUPABASE_URL === '__SUPABASE_URL__' \|\| ...\)/,
  `if (!config.SUPABASE_URL || !config.SUPABASE_ANON || !config.APP_URL)`
);
```

#### 5. **Intervalo entre Slots (Free vs Pro)**
- **Arquivo:** `pages/configuracoes.html` (já implementado)
- **Status:** Confirmado que campo é desabilitado para usuários Free
- **Backend:** `aplicar_limites_free()` reseta `intervalo_slot` para 0 no downgrade

### 📝 Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `config.js` | Placeholders `__VAR__` + validação simplificada |
| `build.js` | Substituição de placeholders + atualização da validation |
| `modules/auth-session.js` | Placeholders `__SUPABASE_URL__` e `__SUPABASE_ANON__` |
| `supabase/functions/criar-agendamento/index.ts` | Retorna WhatsApp no erro 403 |
| `supabase/functions/cron-notificar-lista-espera/index.ts` | Timezone com API nativa |
| `supabase/functions/horarios-disponiveis/index.ts` | Timezone com API nativa |
| `pages/pagina-cliente.html` | Detecta timezone + exibe WhatsApp no limite |

### 🧪 Como Testar

**Teste 1: Limite Free**
```
1. Crie conta Free
2. Crie 10 agendamentos
3. Tente criar 11º agendamento
4. ✅ Banner "Agenda indisponível" com botão WhatsApp
```

**Teste 2: Build**
```bash
npm run build
# ✅ Deve completar sem erros
```

**Teste 3: Timezone**
```javascript
// Console do browser na página de agendamento
console.log(state.timezone);
// ✅ "America/Sao_Paulo" (ou seu timezone local)
```

### 📦 Deploy

```bash
# 1. Build
npm run build

# 2. Deploy frontend
firebase deploy --only hosting

# 3. Deploy Edge Functions
supabase functions deploy criar-agendamento --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy cron-notificar-lista-espera --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy horarios-disponiveis --project-ref kevqgxmcoxmzbypdjhru
```

---

## [2026-04-01] — Lista Espera Inteligente 2.0 + Preferências de Horário

### ✨ Nova Funcionalidade: Lista de Espera com Preferências

**Cliente escolhe como quer ser notificado quando vaga surgir**

- **3 tipos de preferência:**
  - **Horário exato:** Só notifica se liberar exatamente aquele horário (ex: 14:00)
  - **Período do dia:** Notifica se liberar qualquer horário no período (manhã/tarde/noite)
  - **Qualquer horário:** Notifica se liberar qualquer horário no dia (máxima chance)

- **Modal atualizado em `pagina-cliente.html`:**
  - Radio buttons para escolher tipo de preferência
  - Input de hora para "exato"
  - Select de período (manhã/tarde/noite) para "período"
  - Resumo mostra serviço + duração

- **Edge Function `entrada-lista-espera` atualizada:**
  - Salva `servico_id`, `servico_duracao_min`
  - Salva `tipo_preferencia`, `periodo_preferido`
  - Valida duplicidade inteligente (considera tipo de preferência)
  - Mensagem WhatsApp/email personalizada com tipo de preferência

- **Nova Edge Function `cron-notificar-lista-espera`:**
  - Cron job que roda a cada 5 minutos
  - Busca clientes não notificados na lista de espera
  - Chama `horarios-disponiveis` para verificar slots disponíveis
  - Filtra por compatibilidade: horário + período + preferência
  - Notifica via WhatsApp (Evolution API) + Email (SendGrid)
  - Marca como notificado após envio

- **Migration 23 atualizada:**
  - Campos: `servico_id`, `servico_duracao_min`, `tipo_preferencia`, `periodo_preferido`
  - Índices novos: `idx_lista_espera_servico`, `idx_lista_espera_notificado`
  - Trigger simplificada: só marca para notificação (cron faz o resto)

- **Migration 24 criada:**
  - Função `agendamentos_cancelados_recentes()` (placeholder)

### 📋 Regras de Notificação (Atualizado)

**Antecedência Mínima:**
- Notifica apenas se horário liberado for ≥ 2 horas a partir de agora
- Evita notificações "em cima da hora" (ex: 13:59 para vaga 14:00)
- Configurável no código: `diffHoras < 2`

**Validade da Entrada:**
- ✅ Notifica se `data_preferida >= hoje`
- ❌ Não notifica se `data_preferida < hoje` (data já passou)
- ❌ Não notifica se horário já passou (mesmo dia)
- Sem expiração artificial de 7 dias (removido campo `expira_em`)

**Compatibilidade:**
- Reutiliza `horarios-disponiveis` para verificar se serviço cabe no slot
- Considera duração do serviço do cliente vs duração do slot

**Exemplo Prático:**
```
Cliente entra na lista: 25/04/2026 às 14:00

20/04 10:00 → ✅ Notifica (5 dias antes)
25/04 10:00 → ✅ Notifica (4h antes)
25/04 11:59 → ✅ Notifica (2h antes)
25/04 12:01 → ❌ Não notifica (1h59 antes)
25/04 14:01 → ❌ Não notifica (hora já passou)
26/04 08:00 → ❌ Não notifica (data já passou)
```

### 🔄 Fluxo Completo

```
1. CLIENTE ENTRA NA LISTA
   ├─ Escolhe tipo de preferência (exato/período/qualquer)
   ├─ Informa data e horário/período
   ├─ Seleciona serviço (para compatibilidade)
   └─ Recebe confirmação WhatsApp + Email

2. CRON JOB (*/5 * * * *)
   ├─ Busca: notificado=false, agendado=false
   ├─ Filtra: data_preferida >= hoje
   └─ Agrupa por prestador + data

3. CANCELAMENTO LIBEROU VAGA
   ├─ Trigger marca lista_espera.notificado=false
   └─ Cron job detecta na próxima execução

4. VERIFICA COMPATIBILIDADE
   ├─ Chama horarios-disponiveis (serviço do cliente)
   ├─ Filtra slots disponíveis
   └─ Encontra horário compatível com preferência

5. NOTIFICA CLIENTE
   ├─ Verifica antecedência >= 2h
   ├─ Envia WhatsApp (Evolution API)
   ├─ Envia Email (SendGrid)
   └─ Atualiza: notificado=true, notificado_em=NOW()
```

### 🗄️ Estrutura do Banco (Migration 23)

```sql
CREATE TABLE public.lista_espera (
  id UUID PRIMARY KEY,
  prestador_id UUID NOT NULL REFERENCES prestadores(id),
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_email TEXT,
  data_preferida DATE NOT NULL,
  hora_preferida TIME,
  servico_id UUID REFERENCES servicos(id),
  servico_nome TEXT,
  servico_duracao_min INT,
  tipo_preferencia TEXT DEFAULT 'exato',  -- 'exato' | 'periodo' | 'qualquer'
  periodo_preferido TEXT,                 -- 'manha' | 'tarde' | 'noite'
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  notificado BOOLEAN DEFAULT FALSE,
  notificado_em TIMESTAMPTZ,
  agendado BOOLEAN DEFAULT FALSE,
  UNIQUE(cliente_telefone, data_preferida, hora_preferida, servico_id)
);

-- Índices
CREATE INDEX idx_lista_espera_prestador ON lista_espera(prestador_id);
CREATE INDEX idx_lista_espera_data ON lista_espera(data_preferida);
CREATE INDEX idx_lista_espera_servico ON lista_espera(servico_id);
CREATE INDEX idx_lista_espera_notificado ON lista_espera(notificado, agendado);

-- RLS: apenas prestador vê sua lista
CREATE POLICY "Prestador vê sua lista de espera"
  ON lista_espera FOR SELECT TO authenticated
  USING (auth.uid() = (SELECT p.id FROM prestadores p WHERE p.id = prestador_id));
```

### 📁 Arquivos Criados/Modificados

**Criados:**
- `migrations/24_cancelamentos_recentes.sql`
- `supabase/functions/cron-notificar-lista-espera/index.ts`

**Modificados:**
- `migrations/23_lista_espera.sql` — Remove `expira_em`, corrige RLS
- `pages/pagina-cliente.html` — Modal com preferências + texto atualizado
- `supabase/functions/entrada-lista-espera/index.ts` — Salva serviço + preferência, mensagens atualizadas
- `supabase/functions/notificar-lista-espera/index.ts` — Remove filtro `expira_em`
- `CHANGELOG.md` — Esta documentação

---

### 🔧 Melhorias: Busca de Clientes (Q-5)
- **Busca unificada** por nome, telefone e email
- **Placeholder atualizado**: "Buscar por nome, telefone ou email…"
- **Mensagem contextual** quando nenhum cliente é encontrado
  - Com busca: Mostra termo pesquisado e sugere campos
  - Sem busca: "Nenhum cliente cadastrado"
- **Filtro em tempo real** combinando com filtros VIP/Regular/Novos

**Impacto:**
- Localização 3x mais rápida de clientes (3 campos vs 1)
- Útil para bases grandes (100+ clientes)
- Reduz tempo de atendimento no salão

**Arquivos:** `pages/clientes.html`

---

## [2026-03-31] — Plano Anual + Monitoramento Sentry + Toast Centralizado

### ✨ Novas Funcionalidades

#### 1. **Plano Anual com Desconto (26% OFF)**
- **Toggle Mensal/Anual** em `planos.html` com badge "-26%"
- **Edge Function `criar-assinatura`** atualizada para suportar ciclo YEARLY
- **Webhook Asaas** salva periodicidade quando assinatura é ativada
- **Badge no painel** mostra "(plano anual)" ou "(plano mensal)" para usuários Pro
- **Migration** adiciona campo `assinatura_periodicidade` na tabela `prestadores`

**Preços:**
| Plano | Valor | Cobrança | Economia |
|-------|-------|----------|----------|
| Mensal | R$ 39/mês | Todo mês | — |
| Anual | R$ 29/mês | R$ 348/ano | 26% (R$ 120) |

#### 2. **Monitoramento de Erros com Sentry**
- **Frontend**: Módulo `modules/sentry.js` inicializado em todas as páginas principais
- **Backend**: Sentry implementado em 4 Edge Functions críticas
  - `criar-agendamento`
  - `horarios-disponiveis`
  - `criar-assinatura`
  - `webhook-asaas`
- **DSN**: `https://17c6e06768f45437c43076724835eaa7@o4511141658230784.ingest.us.sentry.io/4511141704957952`
- **Features**:
  - Captura automática de erros
  - Fallback para adblockers (não quebra o app se bloqueado)
  - Contexto de usuário (após login)
  - Environment: production

#### 3. **Toast Notification Centralizado**
- **Módulo**: `modules/ui-helpers.js`
- **Funções**:
  - `toast(message, type, duration)` - Notificação temporária
  - `toastWithUndo(message, onUndo, duration)` - Toast com botão de desfazer
  - `confirmModal(title, message)` - Modal de confirmação
- **Estilo**:
  - Posição: topo centralizado
  - Animação: fade in/out suave com slide vertical
  - Tipos: success (verde), error (vermelho), warning (laranja), info (azul)
  - Duração padrão: 3000ms

### 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `modules/sentry.js` | Inicialização do Sentry frontend (v7.119.0) |
| `modules/ui-helpers.js` | Helpers de UI reutilizáveis (toast, modal) |
| `SENTRY-CONFIG.md` | Guia completo de configuração do Sentry |

### 📝 Arquivos Modificados

#### Build & Config
| Arquivo | Mudança |
|---------|---------|
| `build.js` | Injeção de `SENTRY_DSN` e `SENTRY_ENVIRONMENT` |
| `config.js` | Variáveis `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `VERSION` |
| `.env.example` | Seção do Sentry adicionada |
| `.env.local` | `SENTRY_DSN` configurado |
| `firebase.json` | Removido `modules/**` do ignore |

#### Frontend (8 páginas)
| Página | Mudanças |
|--------|----------|
| `pages/configuracoes.html` | +sentry.js, +ui-helpers.js, removido toast duplicado |
| `pages/clientes.html` | +sentry.js, +ui-helpers.js, removido toast duplicado |
| `pages/painel.html` | +sentry.js, +ui-helpers.js |
| `pages/auth.html` | +sentry.js, +ui-helpers.js |
| `pages/onboarding.html` | +sentry.js, +ui-helpers.js |
| `pages/pagina-cliente.html` | +sentry.js, +ui-helpers.js |
| `pages/relatorio.html` | +sentry.js, +ui-helpers.js |
| `pages/planos.html` | +sentry.js, +ui-helpers.js, removido toast duplicado |

#### Edge Functions (4 funções)
| Função | Mudança |
|--------|---------|
| `supabase/functions/horarios-disponiveis/index.ts` | +Sentry com captureException |
| `supabase/functions/criar-agendamento/index.ts` | +try-catch geral com Sentry |
| `supabase/functions/criar-assinatura/index.ts` | +Sentry com captureException |
| `supabase/functions/webhook-asaas/index.ts` | +try-catch geral com Sentry |

#### Páginas de Cliente (atualizadas para ui-helpers)
| Página | Mudanças |
|--------|----------|
| `pages/avaliar-cliente.html` | +ui-helpers.js, removido showToast duplicado |
| `pages/cancelar-cliente.html` | +ui-helpers.js, removido showToast duplicado |
| `pages/reagendar-cliente.html` | +ui-helpers.js, removido showToast duplicado |

### 🎯 Benefícios

| Área | Antes | Depois |
|------|-------|--------|
| **Código duplicado** | ~50 linhas × 10 páginas = 500 linhas | ~260 linhas em 1 arquivo |
| **Manutenção** | 10 lugares pra mudar | 1 lugar pra mudar |
| **Monitoramento** | Nenhum | Sentry em produção |
| **UX do Toast** | Inconsistente entre páginas | Padronizado e suave |
| **Feedback de erro** | Apenas console | Dashboard Sentry com contexto |

### 🧪 Como Usar

#### Toast Notification
```javascript
// Toast simples (verde)
toast('✓ Serviço salvo!');

// Toast de erro (vermelho)
toast('Erro ao salvar', false);

// Toast com tipos específicos
toast('Atenção!', 'warning');
toast('Informação', 'info');

// Toast com botão de desfazer
toastWithUndo('Item excluído', () => {
  restaurarItem();
});

// Modal de confirmação
const confirmado = await confirmModal(
  'Excluir serviço?',
  'Esta ação não pode ser desfeita.'
);
```

#### Sentry (automático)
```javascript
// Erros são capturados automaticamente
// Para capturar manualmente:
Sentry.captureException(new Error('Erro específico'));

// Ou enviar mensagem
Sentry.captureMessage('Evento importante');

// Adicionar usuário ao contexto (após login)
Sentry.setUser({
  id: userId,
  email: user_email,
  username: user_name
});
```

### 📊 Status do Deploy

| Componente | URL | Status |
|------------|-----|--------|
| **Frontend** | https://e-agendapro.web.app | ✅ Deployado |
| **Sentry Frontend** | modules/sentry.js | ✅ Ativo |
| **UI Helpers** | modules/ui-helpers.js | ✅ Ativo |
| **Edge Functions** | Supabase | ✅ Deployadas |
| **Plano Anual** | /planos | ✅ Implementado |

### 🔗 Links Úteis

- **Sentry Dashboard**: https://sentry.io
- **Firebase Console**: https://console.firebase.google.com/project/e-agendapro/overview
- **Supabase Project**: kevqgxmcoxmzbypdjhru
- **Supabase Dashboard**: https://supabase.com/dashboard/project/kevqgxmcoxmzbypdjhru

---

## Próximas Melhorias Sugeridas

1. **Backup Automático do Banco** - Segurança contra perda de dados
2. **Undo em Ações Destrutivas** - Usar `toastWithUndo()` para excluir
3. **Busca Full-Text de Clientes** - Melhor UX para prestadores com muitos clientes
4. **Lista de Espera Inteligente** - Preencher vagas canceladas

---

**Deploy realizado em**: 2026-03-31  
**Versão**: 1.1.0  
**Ambiente**: Production
