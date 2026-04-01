# 🚀 Changelog — AgendaPro

## [2026-04-01] — Lista Espera Inteligente + Busca de Clientes

### ✨ Nova Funcionalidade: Lista Espera Inteligente (R-1)

**Permite que clientes entrem na lista de espera quando não há horários disponíveis**

- **Modal de lista de espera** em `pagina-cliente.html`
  - Acionado quando não há horários no dia selecionado
  - Formulário com nome, telefone e email (opcional)
  - Resumo da preferência (data/hora/serviço)
- **Edge Function `entrada-lista-espera`**
  - Valida e salva entrada na lista
  - Envia confirmação por WhatsApp e email
  - Previne duplicidade (mesmo cliente/horário)
- **Edge Function `notificar-lista-espera`**
  - Disparada automaticamente quando vaga surge (cancelamento)
  - Notifica primeiro cliente da fila (FIFO)
  - Envia WhatsApp + email com link para agendar
- **Migration 23**
  - Tabela `lista_espera` com RLS
  - Trigger `trg_notificar_lista_espera` no cancelamento
  - Índice para busca rápida

**Validade:** 7 dias (configurável)  
**Notificação:** WhatsApp (Evolution API self-hosted) + Email (SendGrid)  
**Privacidade:** RLS — apenas prestador vê sua lista

**Arquivos criados:**
- `migrations/23_lista_espera.sql`
- `supabase/functions/entrada-lista-espera/index.ts`
- `supabase/functions/notificar-lista-espera/index.ts`

**Arquivos modificados:**
- `pages/pagina-cliente.html` — Modal + botão + funções

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
