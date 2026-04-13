# Roadmap de Oportunidades - AgendaPro

**Data de criação:** 2026-03-30
**Objetivo:** Documentar oportunidades de melhoria identificadas além do sprint atual
**Status:** Planejamento Estratégico

---

## 📋 Índice

1. [Resumo Executivo](#resumo-executivo)
2. [Viabilidade Técnica](#viabilidade-técnica)
3. [Oportunidades por Categoria](#oportunidades-por-categoria)
4. [Matriz de Priorização](#matriz-de-priorização)
5. [Quick Wins (1-2h)](#quick-wins)
6. [Features de Impacto](#features-de-impacto)
7. [Roadmap Sugerido](#roadmap-sugerido)
8. [Métricas de Sucesso](#métricas-de-sucesso)

---

## 🎯 Resumo Executivo

Este documento documenta **12 oportunidades** identificadas através de análise do código base, UX e estratégia de produto. As oportunidades estão divididas em:

- **Quick Wins:** Pequenas melhorias com grande impacto (1-2h cada)
- **Features de Impacto:** Funcionalidades novas que movem agulha (4-8h cada)
- **Otimizações Estratégicas:** Melhorias de conversão e retenção
- **Infraestrutura de Qualidade:** Testes automatizados, módulos compartilhados

**Investimento total estimado:** 40-60 horas de desenvolvimento
**ROI potencial:** +30-40% conversão, -20% churn, +15% ARPU

### ✅ Conquistas Recentes (2026-04-03)

**36 testes automatizados passando!**
- Cobertura completa de geração de slots (antecedência, conflitos, bloqueios, cadência)
- Normalização de respostas de agendamento
- Classificação de eventos do webhook Asaas
- Bug corrigido: antecedência mínima agora só aplica no mesmo dia (consistente com SQL)
- ~200 linhas removidas das edge functions (DRY, módulos compartilhados)

---

## 🏗️ Viabilidade Técnica

**Arquitetura atual:**
- **Frontend:** Firebase Hosting (HTML estático)
- **Backend:** Supabase (PostgreSQL + Edge Functions em Deno)
- **Integrações:** Evolution API (WhatsApp self-hosted), Asaas (Pagamentos), Google Calendar, SendGrid (Email)

### ✅ **Totalmente Viáveis (92% das oportunidades)**

| Categoria | Oportunidades | Viabilidade | Justificativa |
|-----------|--------------|-------------|---------------|
| **Quick Wins** | Q-1 a Q-5 | ✅ 100% | JS/CSS puro, funciona em HTML estático |
| **Retenção** | R-1 a R-4 | ✅ 100% | Edge Functions já existem, só adicionar lógica |
| **Monetização** | M-1, M-2, M-3 | ✅ 100% | Asaas API + HTML |
| **Features** | F-1, F-2, F-3 | ✅ 100% | SQL + JS + APIs REST (Zoom, etc) |

**Exemplo - Lista de Espera (R-1):**
```typescript
// Arquitetura: Supabase (tabela) + Edge Function + Webhook
// 100% compatível com setup atual

CREATE TABLE lista_espera (
  prestador_id UUID,
  cliente_tel TEXT,
  data DATE,
  status TEXT
);

// Edge function: /functions/v1/lista-espera
// Webhook existente: /functions/v1/webhook-asaas
```

**Exemplo - Zoom Integration (F-3):**
```typescript
// Arquitetura: Edge Function chama Zoom API REST
// Mesmo padrão que Evolution API, Asaas, Google Calendar

const zoomMeeting = await fetch('https://api.zoom.us/v2/users/me/meetings', {
  headers: { 'Authorization': `Bearer ${ZOOM_JWT_TOKEN}` }
});
```

---

### ⚠️ **Requerem Setup Adicional (8% das oportunidades)**

| Oportunidade | Desafio | Solução | Viabilidade |
|-------------|---------|---------|-------------|
| **Push Notifications (F-4)** | Service Worker precisa de arquivo `sw.js` registrado + Firebase Messaging | Setup PWA: adicionar `sw.js`, manifest.json, FCM config | ⚠️ Viável mas mais complexo |
| **Tema Escuro (F-5)** | Só CSS, mas baixo impacto | CSS media query `prefers-color-scheme` | ⚠️ Viável mas baixa prioridade |

---

### 🎯 **Por que TUDO (ou quase) Funciona?**

**1. Firebase Hosting = HTML Estático**
- Todas as páginas são `.html` puro
- JavaScript inline ou via `<script>`
- **Toda UI/UX é viável**

**2. Supabase Edge Functions = Deno**
- TypeScript/JavaScript full-stack
- Acesso a APIs externas (`fetch`)
- **Toda integração é viável**

**3. Supabase PostgreSQL**
- Funções SQL complexas
- Triggers, RLS
- **Toda analytics é viável**

**4. APIs Externas**
- Evolution API (WhatsApp self-hosted) ✅
- Asaas (Pagamentos) ✅
- Google Calendar ✅
- Zoom API (REST) ✅
- SendGrid (Email) ✅

---

### 📋 **Matriz de Viabilidade**

```
                 │ Simples │ Médio │ Complexo │ Não Viável
─────────────────┼─────────┼───────┼──────────┼────────────
Quick Wins (5)   │    5    │   0   │    0     │      0
Retenção (4)     │    2    │   2   │    0     │      0
Monetização (3)  │    2    │   1   │    0     │      0
Features (5)     │    3    │   1    │    1     │      0
─────────────────┼─────────┼───────┼──────────┼────────────
TOTAL            │   12    │   4   │    1     │      0
                 │  70%    │  24%  │   6%     │     0%
```

**Conclusão:** 94% das oportunidades são simples/médias de implementar na arquitetura atual. Nenhuma é inviável.

---

## 📊 Oportunidades por Categoria

### 💰 Monetização & Conversão

| ID | Oportunidade | Impacto | Esforço | ROI | Status |
|----|-------------|---------|---------|-----|--------|
| M-1 | Plano Anual com desconto | ⭐⭐⭐⭐⭐ | 2h | Alto | ✅ IMPLEMENTADO |
| M-2 | Depósito para agendar | ⭐⭐⭐⭐ | 8h | Médio | ⏳ Pendente |
| M-3 | Upsell em momentos de valor | ⭐⭐⭐⭐ | 3h | Alto | ⏳ Pendente |

### 📈 Retenção & Churn Reduction

| ID | Oportunidade | Impacto | Esforço | ROI |
|----|-------------|---------|---------|-----|
| R-1 | Lista de Espera Inteligente | ⭐⭐⭐⭐⭐ | 6h | Muito Alto |
| R-2 | Cancelamento Survey | ⭐⭐⭐⭐ | 2h | Alto |
| R-3 | Nurturing During Trial | ⭐⭐⭐⭐ | 4h | Alto |
| R-4 | Dunning Inteligente | ⭐⭐⭐ | 4h | ✅ IMPLEMENTADO |
| R-5 | Offboarding ao Downgrade | ⭐⭐⭐ | 2h | Médio |

### 🚀 Features & UX

| ID | Oportunidade | Impacto | Esforço | ROI |
|----|-------------|---------|---------|-----|
| F-3 | Zoom/Google Meet Integration | ⭐⭐⭐ | 6h | Médio |
| F-4 | Notificações Push Web | ⭐⭐⭐ | 2h | Médio |
| F-5 | Tema Escuro | ⭐⭐ | 3h | Baixo |

### ⚡ Quick Wins (Micro-UX)

| ID | Oportunidade | Impacto | Esforço | ROI |
|----|-------------|---------|---------|-----|
| Q-1 | Toast "Salvo" em formulários | ⭐⭐⭐ | 1h | Alto | ✅ IMPLEMENTADO |
| Q-2 | Undo em ações destrutivas | ⭐⭐⭐⭐ | 2h | Alto |
| Q-3 | Atalhos de teclado | ⭐⭐ | 2h | Médio |
| Q-4 | Paginação de agendamentos | ⭐⭐⭐ | 3h | Médio |
| Q-5 | Busca full-text de clientes | ⭐⭐⭐ | 2h | Alto | ✅ IMPLEMENTADO |

---

## 🎯 Matriz de Priorização

```
IMPACTO
   │
 5 │     M-1           R-1    F-1
   │           M-2        R-2    F-2
 4 │     M-3        R-3    Q-2
   │              Q-5    F-4        Q-1
 3 │        R-4  R-5    Q-4    F-3
   │                    Q-3    F-5
 2 │
   │
 1 └────────────────────────────────────
     1h   2h   3h   4h   5h   6h   7h   8h   → ESFORÇO
```

**Legenda:**
- **Quadrante Superior Esquerdo:** Quick Wins (fazer primeiro)
- **Quadrante Superior Direito:** Projetos Estratégicos (planejar)
- **Quadrante Inferior Esquerdo:** Fillers (quando tiver tempo)
- **Quadrante Inferior Direito:** Opcionais (talvez não fazer)

---

## ⚡ Quick Wins (1-2h)

### Q-1: Toast "Salvo" em Formulários ✅ IMPLEMENTADO

**Status:** ✅ IMPLEMENTADO em `modules/ui-helpers.js` — funções `toast()` e `toastWithUndo()` expostas globalmente, usadas em planos.html, configuracoes.html, etc.

**Problema resolvido:** Edições de serviços/bloqueios agora têm feedback visual. Usuário sabe imediatamente se salvou.

**Solução Original (referência):**

```javascript
// modules/ui-helpers.js
export function toast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#8ab830' : '#c84830'};
    color: white;
    border-radius: 8px;
    animation: slidein 0.3s ease;
    z-index: 9999;
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Uso em configurações.html
async function salvarServico() {
  const { error } = await supabase
    .from('servicos')
    .update({ nome, duracao_min, preco, ativo })
    .eq('id', servicoId);

  if (error) {
    toast('Erro ao salvar', 'error');
  } else {
    toast('✓ Salvo!');
  }
}
```

**Arquivos:** `modules/ui-helpers.js`, `pages/configuracoes.html`
**Teste:** Editar serviço e verificar toast

---

### Q-2: Undo em Ações Destrutivas

**Problema:** Usuário pode excluir acidentalmente e não tem como desfazer.

**Solução:**

```javascript
// modules/ui-helpers.js
export function toastWithUndo(message, onUndo) {
  const container = document.createElement('div');
  container.className = 'toast-container';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
    z-index: 9999;
  `;

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.className = 'toast';

  const undoBtn = document.createElement('button');
  undoBtn.textContent = 'Desfazer';
  undoBtn.className = 'toast-undo';
  undoBtn.onclick = () => {
    onUndo();
    container.remove();
  };

  container.appendChild(toast);
  container.appendChild(undoBtn);
  document.body.appendChild(container);

  setTimeout(() => container.remove(), 5000);
}

// Uso em clientes.html
let deletedCliente = null;

async function excluirCliente(telefone) {
  const { data } = await supabase
    .from('agendamentos')
    .select('*')
    .eq('cliente_tel', telefone)
    .single();

  deletedCliente = data;

  await supabase
    .from('agendamentos')
    .delete()
    .eq('cliente_tel', telefone);

  toastWithUndo('Cliente excluído', async () => {
    await supabase.from('agendamentos').insert(deletedCliente);
    loadClientes();
  });
}
```

**Arquivos:** `modules/ui-helpers.js`, `pages/clientes.html`, `pages/configuracoes.html`

---

### Q-3: Atalhos de Teclado

**Problema:** Profissionais fazem as mesmas ações muitas vezes por dia.

**Solução:**

```javascript
// modules/keyboard-shortcuts.js
export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignorar se estiver em input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'n':
        // Ctrl/Cmd + N = Novo agendamento
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          window.location.href = '/painel#novo';
        }
        break;

      case 'c':
        // C = Clientes
        if (!e.ctrlKey && !e.metaKey) {
          window.location.href = '/clientes';
        }
        break;

      case 'r':
        // R = Relatórios
        if (!e.ctrlKey && !e.metaKey) {
          window.location.href = '/relatorio';
        }
        break;

      case '/':
        // / = Busca
        e.preventDefault();
        showSearchModal();
        break;

      case '?':
        // ? = Ajuda
        e.preventDefault();
        showKeyboardShortcutsHelp();
        break;
    }
  });
}

function showKeyboardShortcutsHelp() {
  const modal = document.createElement('div');
  modal.className = 'keyboard-shortcuts-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Atalhos de Teclado</h2>
      <dl>
        <dt><kbd>N</kbd></dt><dd>Novo agendamento</dd>
        <dt><kbd>C</kbd></dt><dd>Clientes</dd>
        <dt><kbd>R</kbd></dt><dd>Relatórios</dd>
        <dt><kbd>/</kbd></dt><dd>Buscar</dd>
        <dt><kbd>?</kbd></dt><dd>Mostrar esta ajuda</dd>
      </dl>
      <button onclick="this.closest('.keyboard-shortcuts-modal').remove()">Fechar</button>
    </div>
  `;
  document.body.appendChild(modal);
}
```

**Arquivos:** `modules/keyboard-shortcuts.js`, `pages/painel.html`

---

### Q-4: Paginação de Agendamentos

**Problema:** Profissionais com 1000+ agendamentos lentam a página.

**Solução:**

```javascript
// Carregar 50 por vez
let currentPage = 0;
const pageSize = 50;

async function loadAgendamentos(page = 0) {
  const start = page * pageSize;
  const end = start + pageSize - 1;

  const { data } = await supabase
    .from('agendamentos')
    .select('*')
    .order('data_hora', { ascending: false })
    .range(start, end);

  return data;
}

// Infinite scroll
window.addEventListener('scroll', async () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
    currentPage++;
    const novosAgendamentos = await loadAgendamentos(currentPage);
    appendAgendamentos(novosAgendamentos);
  }
});
```

**Arquivos:** `pages/painel.html`, `pages/clientes.html`

---

### Q-5: Busca Full-Text de Clientes ✅ IMPLEMENTADO

**Status:** ✅ **IMPLEMENTADO** em 2026-04-01

**Problema:** Encontrar cliente específico em lista longa é difícil.

**Solução Implementada:**
- Busca unificada por nome, telefone e email
- Filtro em tempo real combinando com filtros (VIP/Regular/Novos)
- Mensagem contextual quando nenhum resultado é encontrado
- Placeholder claro: "Buscar por nome, telefone ou email…"

**Código (clientes.html):**
```javascript
const passaBusca = !q ||
  (c.nome || '').toLowerCase().includes(q) ||
  (c.telefone || '').includes(q) ||
  (c.email || '').toLowerCase().includes(q);
```

**Impacto:**
- Localização 3x mais rápida de clientes
- Útil para bases grandes (100+ clientes)
- Reduz tempo de atendimento no salão

---

**Solução Original (referência - backend):**

```sql
-- migrations/19_full_text_search.sql
-- Adicionar índice full-text search

CREATE OR REPLACE FUNCTION public.buscar_clientes(p_prestador_id UUID, p_query TEXT)
RETURNS TABLE (
  telefone TEXT,
  nome TEXT,
  total_visitas BIGINT,
  total_gasto NUMERIC,
  ultimo_agendamento TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.cliente_tel,
    a.cliente_nome,
    COUNT(*) as total_visitas,
    COALESCE(SUM(s.preco), 0) as total_gasto,
    MAX(a.data_hora) as ultimo_agendamento
  FROM public.agendamentos a
  JOIN public.servicos s ON s.id = a.servico_id
  WHERE a.prestador_id = p_prestador_id
    AND (
      unaccent(a.cliente_nome) ILIKE '%' || unaccent(p_query) || '%'
      OR a.cliente_tel LIKE '%' || p_query || '%'
    )
  GROUP BY a.cliente_tel, a.cliente_nome
  ORDER BY MAX(a.data_hora) DESC NULLS LAST
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_clientes TO authenticated;
```

```javascript
// Frontend - clientes.html
let searchTimeout;

async function onSearchChange(query) {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(async () => {
    if (query.length < 2) {
      loadClientes();
      return;
    }

    const { data } = await supabase
      .rpc('buscar_clientes', {
        p_prestador_id: userId,
        p_query: query
      });

    renderClientes(data);
  }, 300);
}
```

**Arquivos:** `migrations/19_full_text_search.sql`, `pages/clientes.html`

---

## 🚀 Features de Impacto

### M-1: Plano Anual com Desconto ✅ IMPLEMENTADO

**Status:** ✅ CONCLUÍDO em 2026-03-31

**Problema:** Preço anual já está definido (R$29/mês = 26% de desconto), mas não tem UI para escolher.

**Solução Implementada:**
- Toggle Mensal/Anual no topo de `planos.html`
- Edge Function `criar-assinatura` atualizada para suportar ciclo `YEARLY`
- Webhook `webhook-asaas` salva periodicidade no banco
- Campo `assinatura_periodicidade` adicionado à tabela `prestadores`
- Badge no `painel.html` mostra periodicidade do plano Pro

**Preços:**
| Plano | Valor | Cobrança | Economia |
|-------|-------|----------|----------|
| Mensal | R$ 39/mês | Todo mês | — |
| Anual | R$ 29/mês | R$ 348/ano | 26% (R$ 120) |

**Arquivos modificados:**
- `pages/planos.html` - Toggle de periodicidade
- `pages/painel.html` - Badge de periodicidade
- `supabase/functions/criar-assinatura/index.ts` - Suporte a ciclo YEARLY
- `supabase/functions/webhook-asaas/index.ts` - Salva periodicidade
- `migrations/22_periodicidade_assinatura.sql` - Novo campo no banco

---

**Solução Original (referência):**

```html
<!-- pages/planos.html -->
<div class="periodo-toggle">
  <button class="toggle-btn" id="btn-mensal" onclick="setPeriodo('mensal')">
    Mensal
  </button>
  <button class="toggle-btn active" id="btn-anual" onclick="setPeriodo('anual')">
    Anual <span class="badge-economy">-26%</span>
  </button>
</div>

<div class="planos-grid">
  <!-- Plano Mensal -->
  <div class="plano-card">
    <h3>Mensal</h3>
    <div class="preco-valor">R$39<span>/mês</span></div>
  </div>

  <!-- Plano Anual -->
  <div class="plano-card featured">
    <div class="badge-mais-popular">Mais econômico</div>
    <h3>Anual</h3>
    <div class="preco-valor">R$29<span>/mês</span></div>
    <div class="preco-total">R$348 cobrados uma vez</div>
    <div class="economia">Você economiza R$120/ano</div>
  </div>
</div>

<script>
let periodoSelecionado = 'anual';

function setPeriodo(periodo) {
  periodoSelecionado = periodo;

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `btn-${periodo}`);
  });

  atualizarPrecios();
}

function atualizarPrecios() {
  const mensal = { preco: 39, ciclo: 'MONTHLY' };
  const anual = { preco: 29, ciclo: 'YEARLY' };

  const plano = periodoSelecionado === 'mensal' ? mensal : anual;

  document.querySelector('.preco-destaque').textContent = `R$${plano.preco}/mês`;

  // Ao assinar, envia ciclo correto
  window.cicloSelecionado = plano.ciclo;
}
</script>
```

```css
.periodo-toggle {
  display: flex;
  background: var(--bg2);
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 24px;
}

.toggle-btn {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: var(--ink);
  color: var(--bg);
}

.badge-economy {
  background: var(--lime);
  color: var(--lime-ink);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  margin-left: 6px;
}

.economia {
  color: var(--lime-d);
  font-weight: 600;
  font-size: 14px;
  margin-top: 8px;
}
```

**Edge Function adjustment:**

```typescript
// supabase/functions/criar-assinatura/index.ts
const billingType = req.body.billing_type; // PIX, CREDIT_CARD, BOLETO
const ciclo = req.body.ciclo || 'MONTHLY'; // MONTHLY ou YEARLY

// Criar assinatura no Asaas
const subscription = await asaas.createSubscription({
  customer: asaasCustomer.id,
  billingType,
  cycle: ciclo, // MONTHLY ou YEARLY
  value: ciclo === 'YEARLY' ? 348 : 39, // Valor base
  // ...
});
```

**Benefícios:**
- Aumentar LTV (Lifetime Value)
- Reduzir churn (menos renovações mensais)
- Melhor previsibilidade de receita

**Arquivos:** `pages/planos.html`, `supabase/functions/criar-assinatura/index.ts`

---

### R-1: Lista de Espera Inteligente

**Problema:** Cliente tenta agendar em horário cheio e não tem alternativa. Profissional perde receita.

**Solução:**

```sql
-- migrations/20_lista_espera.sql
CREATE TABLE IF NOT EXISTS public.lista_espera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_tel TEXT NOT NULL,
  cliente_email TEXT,
  status TEXT DEFAULT 'aguardando', -- 'aguardando', 'notificado', 'confirmado', 'expirado'
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  notificado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  agendamento_id UUID REFERENCES public.agendamentos(id)
);

-- Índices
CREATE INDEX idx_lista_espera_prestador_data ON public.lista_espera(prestador_id, data, status);
CREATE INDEX idx_lista_espera_status ON public.lista_espera(status) WHERE expira_em > NOW();
```

```typescript
// supabase/functions/lista-espera/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { method } = req;

  if (method === 'POST') {
    // Adicionar à lista de espera
    const { prestador_id, servico_id, data, cliente_nome, cliente_tel, cliente_email } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .from('lista_espera')
      .insert({
        prestador_id,
        servico_id,
        data,
        cliente_nome,
        cliente_tel,
        cliente_email
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ success: true, lista: data });
  }

  if (method === 'GET') {
    // Notificar próximos da fila (chamado pelo webhook de cancelamento)
    const url = new URL(req.url);
    const prestador_id = url.searchParams.get('prestador_id');
    const data = url.searchParams.get('data');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar primeiros 5 da fila
    const { data: lista } = await supabase
      .from('lista_espera')
      .select('*')
      .eq('prestador_id', prestador_id)
      .eq('data', data)
      .eq('status', 'aguardando')
      .order('criado_em', { ascending: true })
      .limit(5);

    // Notificar cada um via WhatsApp
    for (const item of lista || []) {
      await enviarWhatsAppListaEspera(item);
    }

    return Response.json({ notificados: lista?.length || 0 });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
});

async function enviarWhatsAppListaEspera(item: any) {
  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
  const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'agendapro-prod';

  const message = `✨ *Vaga aberta!*

Olá, ${item.cliente_nome}!

Uma vaga abriu para ${new Date(item.data).toLocaleDateString('pt-BR')}.
Tem interesse em agendar?

Responda "SIM" nos próximos 15 minutos para garantir seu horário.`;

  await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: {
      'apikey': evolutionKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      number: `55${item.cliente_tel.replace(/\D/g, '')}`,
      textMessage: { text: message }
    })
  });
}
```

```javascript
// pages/pagina-cliente.html
async function onSemSlots(data) {
  const servico = getSelectedServico();

  // Mostrar modal de lista de espera
  const modal = document.getElementById('waitlist-modal');
  modal.style.display = 'flex';

  document.getElementById('waitlist-confirm').onclick = async () => {
    const nome = document.getElementById('waitlist-nome').value;
    const telefone = document.getElementById('waitlist-tel').value;
    const email = document.getElementById('waitlist-email').value;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/lista-espera`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prestador_id: prestadorId,
        servico_id: servico.id,
        data: data.toISOString(),
        cliente_nome: nome,
        cliente_tel: telefone,
        cliente_email: email
      })
    });

    if (response.ok) {
      toast('✓ Você será notificado se uma vaga abrir!');
      modal.style.display = 'none';
    }
  };
}
```

**Benefícios:**
- Reduz no-show (preenche vagas abertas)
- Gera leads qualificados
- Experiência premium

**Arquivos:** `migrations/20_lista_espera.sql`, `supabase/functions/lista-espera/index.ts`, `pages/pagina-cliente.html`

---

### R-3: Nurturing During Trial

**Problema:** Trial de 7 dias está implementado, mas sem follow-up para aumentar conversão.

**Solução:**

```sql
-- migrations/21_email_templates.sql
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT UNIQUE NOT NULL,
  assunto TEXT NOT NULL,
  corpo_html TEXT NOT NULL,
  variaveis TEXT[], -- ['nome', 'dias_restantes', ...]
  ativo BOOLEAN DEFAULT true
);

-- Templates de nurturing
INSERT INTO public.email_templates (nome, assunto, corpo_html, variaveis) VALUES
(
  'trial_dia_1',
  '🎉 Bem-vindo ao AgendaPro! Vamos começar?',
  '<h1>Olá, {{nome}}!</h1><p>Seu trial de 7 dias começou. Aqui estão 3 dicas rápidas...</p>',
  ARRAY['nome']
),
(
  'trial_dia_3',
  '💡 Dica: configure bloqueios recorrentes',
  '<h1>Dica do dia</h1><p>Configure seu horário de almoço como bloqueio recorrente...</p>',
  ARRAY['nome']
),
(
  'trial_dia_5',
  '⚠️ Seu trial acaba em 2 dias!',
  '<h1>Aproveite ao máximo</h1><p>Faltam apenas 2 dias. Já configurou o Google Calendar?</p>',
  ARRAY['nome', 'dias_restantes']
),
(
  'trial_expirado',
  'Seu trial acabou. Continue com o AgendaPro!',
  '<h1>Obrigado por testar!</h1><p>Continue com Pro por R$39/mês ou faça downgrade para Free.</p>',
  ARRAY['nome']
);
```

```typescript
// supabase/functions/nurturing-trial/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cron: 0 9 * * * (todo dia às 9h)
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Buscar usuários em trial
  const { data: trials } = await supabase
    .from('prestadores')
    .select('id, nome, email, trial_ends_at, trial_usado')
    .not('trial_ends_at', 'is', null)
    .gt('trial_ends_at', new Date().toISOString())
    .eq('plano', 'pro');

  for (const prestador of trials || []) {
    const diasRestantes = Math.ceil(
      (new Date(prestador.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    let template = null;

    // Determinar qual email enviar
    if (diasRestantes === 6) {
      template = 'trial_dia_1';
    } else if (diasRestantes === 4) {
      template = 'trial_dia_3';
    } else if (diasRestantes === 2) {
      template = 'trial_dia_5';
    }

    if (template) {
      await enviarEmailNurturing(prestador, template, { dias_restantes: diasRestantes });
    }
  }

  // Buscar trials que expiraram hoje
  const { data: expirados } = await supabase
    .from('prestadores')
    .select('id, nome, email')
    .lt('trial_ends_at', new Date().toISOString())
    .eq('plano', 'pro')
    .eq('trial_usado', false);

  for (const prestador of expirados || []) {
    await enviarEmailNurturing(prestador, 'trial_expirado', {});
  }

  return Response.json({ processados: (trials?.length || 0) + (expirados?.length || 0) });
});

async function enviarEmailNurturing(prestador: any, templateNome: string, vars: any) {
  // Buscar template
  const template = await getEmailTemplate(templateNome);

  // Substituir variáveis
  let corpo = template.corpo_html;
  let assunto = template.assunto;

  Object.keys(vars).forEach(key => {
    corpo = corpo.replaceAll(`{{${key}}}`, vars[key]);
    assunto = assunto.replaceAll(`{{${key}}}`, vars[key]);
  });

  corpo = corpo.replaceAll('{{nome}}', prestador.nome.split(' ')[0]);

  // Enviar via SendGrid
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: prestador.email }],
        subject: assunto
      }],
      from: {
        email: 'contato@agendapro.com.br',
        name: 'AgendaPro'
      },
      content: [{
        type: 'text/html',
        value: corpo
      }]
    })
  });
}
```

**Benefícios:**
- Aumentar conversão de trial → pago
- Engajar usuário durante o período
- Reduzir "trial esquecido"

**Arquivos:** `migrations/21_email_templates.sql`, `supabase/functions/nurturing-trial/index.ts`

---

### R-2: Cancelamento Survey

**Problema:** Quando usuário clica em cancelar, não capturamos o motivo nem fazemos retenção.

**Solução:**

```html
<!-- pages/configuracoes.html -->
<div id="cancel-survey-modal" style="display:none">
  <div class="modal-content">
    <h2>Podemos ajudar?</h2>
    <p>Conte-nos o motivo do cancelamento:</p>

    <div class="survey-options">
      <label>
        <input type="radio" name="cancel-reason" value="muito-caro">
        <span>Muito caro</span>
      </label>
      <label>
        <input type="radio" name="cancel-reason" value="nao-uso">
        <span>Não uso mais</span>
      </label>
      <label>
        <input type="radio" name="cancel-reason" value="faltou-feature">
        <span>Faltou alguma funcionalidade</span>
      </label>
      <label>
        <input type="radio" name="cancel-reason" value="mudei-ramo">
        <span>Mudei de ramo/atividade</span>
      </label>
      <label>
        <input type="radio" name="cancel-reason" value="outro">
        <span>Outro motivo</span>
      </label>
    </div>

    <!-- Offer de desconto se "muito caro" -->
    <div id="discount-offer" style="display:none">
      <div class="offer-card">
        <h3>🎁 Oferta especial</h3>
        <p>Que tal <strong>20% de desconto</strong> por 3 meses?</p>
        <p class="offer-price">R$31/mês em vez de R$39</p>
        <button class="btn-accept" onclick="aceitarDesconto()">Aceitar oferta</button>
        <button class="btn-decline" onclick="recusarDesconto()">Não, quero cancelar</button>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-secondary" onclick="fecharSurvey()">Voltar</button>
      <button class="btn-danger" onclick="confirmarCancelamento()">Confirmar cancelamento</button>
    </div>
  </div>
</div>

<script>
let cancelReason = null;

document.querySelectorAll('input[name="cancel-reason"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    cancelReason = e.target.value;

    // Mostrar offer se "muito caro"
    const offer = document.getElementById('discount-offer');
    offer.style.display = cancelReason === 'muito-caro' ? 'block' : 'none';
  });
});

async function aceitarDesconto() {
  // Criar cupom de desconto no Asaas
  const response = await fetch(`${SUPABASE_URL}/functions/v1/criar-cupom`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      desconto_percentual: 20,
      meses: 3,
      prestador_id: userId
    })
  });

  if (response.ok) {
    toast('✓ Desconto aplicado! Você foi redirecionado para o Asaas.');
    fecharSurvey();
    // Redirecionar para Asaas com cupom
  }
}
</script>
```

```css
.survey-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 20px 0;
}

.survey-options label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.survey-options label:hover {
  border-color: var(--lime-d);
  background: var(--lime-l);
}

.survey-options input[type="radio"]:checked + span {
  font-weight: 600;
}

.offer-card {
  background: var(--lime-l);
  border: 1.5px solid var(--lime);
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  text-align: center;
}

.offer-price {
  font-size: 24px;
  font-weight: 600;
  color: var(--lime-d);
  margin: 10px 0;
}

.btn-accept {
  background: var(--lime-d);
  color: var(--lime-ink);
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin: 0 8px;
}

.btn-decline {
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--border);
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
}
```

**Benefícios:**
- Recuperar 10-20% de cancelamentos
- Capturar feedback para melhorar produto
- Entender principais motivos de churn

**Arquivos:** `pages/configuracoes.html`

---

## 📅 Roadmap Sugerido

### Fase 1: Quick Wins (Semana 1)
**Objetivo:** Melhoriasrápidas com alto impacto

| Tarefa | Esforço | Prioridade | Status |
|--------|---------|------------|--------|
| Q-1: Toast "Salvo" | 1h | Alta | ✅ IMPLEMENTADO |
| Q-2: Undo ações | 2h | Alta | ⏳ Pendente |
| Q-5: Busca clientes | 2h | Alta | ✅ IMPLEMENTADO |
| M-1: Plano Anual | 2h | Alta | ✅ IMPLEMENTADO |
| R-2: Cancel Survey | 2h | Alta | ⏳ Pendente |
| T-1: Testes automatizados | 4h | Alta | ✅ IMPLEMENTADO |

**Total:** 13h (2-3 dias) — 9h concluídas
RETURNS TABLE (
  servico_id UUID,
  servico_nome TEXT,
  duracao_configurada INT,
  duracao_media NUMERIC,
  total_agendamentos BIGINT,
  diferenca_minutos INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as servico_id,
    s.nome as servico_nome,
    s.duracao_min as duracao_configurada,
    COALESCE(
      AVG(
        EXTRACT(EPOCH FROM (
          CASE
            WHEN a.data_hora_fim IS NOT NULL
            THEN a.data_hora_fim
            ELSE a.data_hora + (s.duracao_min || ' minutes')::INTERVAL
          END - a.data_hora
        )) / 60
      ),
      s.duracao_min
    ) as duracao_media,
    COUNT(*) as total_agendamentos,
    COALESCE(
      AVG(
        EXTRACT(EPOCH FROM (
          CASE
            WHEN a.data_hora_fim IS NOT NULL
            THEN a.data_hora_fim
            ELSE a.data_hora + (s.duracao_min || ' minutes')::INTERVAL
          END - a.data_hora
        )) / 60
      ),
      s.duracao_min
    )::INT - s.duracao_min as diferenca_minutos
  FROM public.servicos s
  LEFT JOIN public.agendamentos a ON a.servico_id = s.id
    AND a.prestador_id = p_prestador_id
    AND a.status = 'concluido'
  WHERE s.prestador_id = p_prestador_id
  GROUP BY s.id, s.nome, s.duracao_min
  ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tempo_medio_servicos TO authenticated;
```

```javascript
// pages/relatorio.html - Aba Serviços
async function loadTempoMedio() {
  const { data } = await supabase
    .rpc('tempo_medio_servicos', {
      p_prestador_id: userId
    });

  const container = document.getElementById('tempo-medio-container');

  container.innerHTML = data.map(s => `
    <div class="tempo-medio-card ${s.diferenca_minutos < -5 ? 'abaixo' : s.diferenca_minutos > 5 ? 'acima' : ''}">
      <div class="servico-nome">${s.servico_nome}</div>
      <div class="tempo-comparacao">
        <span class="configurado">${s.duracao_configurada}min</span>
        <span class="seta">→</span>
        <span class="media ${s.diferenca_minutos < 0 ? 'menor' : 'maior'}">${Math.round(s.duracao_media)}min</span>
        ${s.diferenca_minutos !== 0 ? `
          <span class="diferenca ${s.diferenca_minutos < 0 ? 'positiva' : 'negativa'}">
            ${s.diferenca_minutos > 0 ? '+' : ''}${s.diferenca_minutos}min
          </span>
        ` : ''}
      </div>
      <div class="agendamentos-count">${s.total_agendamentos} agendamentos</div>

      ${s.diferenca_minutos < -5 ? `
        <div class="sugestao">
          💡 Você poderia reduzir para ${Math.round(s.duracao_media)}min e ganhar mais slots!
        </div>
      ` : ''}
    </div>
  `).join('');
}
```

```css
.tempo-medio-card {
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}

.tempo-medio-card.abaixo {
  border-color: var(--lime-d);
  background: var(--lime-l);
}

.tempo-medio-card.acima {
  border-color: var(--rust);
  background: var(--rust-l);
}

.tempo-comparacao {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  font-family: 'DM Mono', monospace;
}

.media.menor { color: var(--lime-d); }
.media.maior { color: var(--rust); }

.diferenca {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.diferenca.positiva {
  background: var(--lime-d);
  color: var(--lime-ink);
}

.diferenca.negativa {
  background: var(--rust);
  color: white;
}

.sugestao {
  margin-top: 12px;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
  font-size: 13px;
}
```

**Benefícios:**
- Profissional otimiza agenda
- Identifica serviços que precisam ajuste
- Pode aumentar número de slots por dia

**Arquivos:** `migrations/22_tempo_medio.sql`, `pages/relatorio.html`

---

### F-2: Avaliações Públicas na Landing Page

**Problema:** Página do profissional não tem prova social. Perde conversão.

**Solução:**

```javascript
// pages/pagina-cliente.html
async function loadAvaliacoesPublicas() {
  const { data } = await supabase
    .rpc('avaliacoes_publicas', {
      p_prestador_slug: prestadorSlug
    });

  if (!data || data.length === 0) return;

  // Calcular média
  const media = data.reduce((sum, a) => sum + a.nota, 0) / data.length;

  // Renderizar seção
  const section = document.createElement('section');
  section.className = 'reviews-section';
  section.innerHTML = `
    <div class="reviews-header">
      <h2>O que clients dizem</h2>
      <div class="rating-stars">
        ${renderStars(media)}
        <span class="rating-score">${media.toFixed(1)}</span>
        <span class="rating-count">(${data.length} avaliações)</span>
      </div>
    </div>

    <div class="reviews-grid">
      ${data.slice(0, 3).map(avaliacao => `
        <div class="review-card">
          <div class="review-header">
            <div class="review-avatar">${avaliacao.cliente_nome.charAt(0)}</div>
            <div class="review-info">
              <div class="review-name">${avaliacao.cliente_nome}</div>
              <div class="review-date">${formatarData(avaliacao.created_at)}</div>
            </div>
          </div>
          <div class="review-stars">${renderStars(avaliacao.nota)}</div>
          ${avaliacao.comentario ? `<div class="review-comment">${avaliacao.comentario}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  // Inserir antes do footer
  document.querySelector('.booking-container').before(section);
}

function renderStars(nota) {
  return Array(5).fill(0).map((_, i) =>
    i < nota ? '⭐' : '☆'
  ).join('');
}
```

```sql
-- migrations/23_avaliacoes_publicas.sql
CREATE OR REPLACE FUNCTION public.avaliacoes_publicas(p_prestador_slug TEXT)
RETURNS TABLE (
  cliente_nome TEXT,
  nota INT,
  comentario TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUBSTRING(a.cliente_nome FROM '^[^ ]+') as cliente_nome,
    av.nota,
    av.comentario,
    av.created_at
  FROM public.avaliacoes av
  JOIN public.agendamentos a ON a.id = av.agendamento_id
  JOIN public.prestadores p ON p.id = av.prestador_id
  WHERE p.slug = p_prestador_slug
    AND av.comentario IS NOT NULL
  ORDER BY av.created_at DESC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.avaliacoes_publicas TO anon;
```

```css
.reviews-section {
  padding: 40px 20px;
  background: var(--cream);
  margin: 40px 0;
  border-radius: var(--radius);
}

.reviews-header {
  text-align: center;
  margin-bottom: 32px;
}

.rating-stars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 24px;
}

.rating-score {
  font-weight: 700;
  font-size: 28px;
}

.rating-count {
  font-size: 14px;
  color: var(--muted);
}

.reviews-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.review-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--border);
}

.review-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.review-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--lime);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--lime-ink);
}

.review-name {
  font-weight: 600;
}

.review-date {
  font-size: 12px;
  color: var(--muted);
}

.review-comment {
  margin-top: 12px;
  line-height: 1.6;
  color: var(--ink);
}
```

**Benefícios:**
- Prova social aumenta conversão em 20-30%
- SEO (conteúdo gerado por usuário)
- Diferencial competitivo

**Arquivos:** `migrations/23_avaliacoes_publicas.sql`, `pages/pagina-cliente.html`

---

## 📅 Roadmap Sugerido

### Fase 1: Quick Wins (Semana 1)
**Objetivo:** Melhorias rápidas com alto impacto

| Tarefa | Esforço | Prioridade | Status |
|--------|---------|------------|--------|
| Q-1: Toast "Salvo" | 1h | Alta | ✅ IMPLEMENTADO |
| Q-2: Undo ações | 2h | Alta | ⏳ Pendente |
| Q-5: Busca clientes | 2h | Alta | ✅ IMPLEMENTADO |
| M-1: Plano Anual | 2h | Alta | ✅ IMPLEMENTADO |
| R-2: Cancel Survey | 2h | Alta | ⏳ Pendente |
| T-1: Testes automatizados | 4h | Alta | ✅ IMPLEMENTADO |

**Total:** 13h (2-3 dias) — 9h concluídas

---

### Fase 2: Retenção (Semana 2)
**Objetivo:** Reduzir churn e aumentar conversão

| Tarefa | Esforço | Prioridade | Status |
|--------|---------|------------|--------|
| R-1: Lista Espera | 6h | Muito Alta | ✅ IMPLEMENTADO |
| R-3: Nurturing Trial | 4h | Alta | ⏳ Pendente |
| F-2: Avaliações Públicas | 4h | Alta | ⏳ Pendente |

**Total:** 14h (3-4 dias) — 6h concluídas

---

### Fase 3: Analytics & Features (Semana 3)
**Objetivo:** Insights e features de valor

| Tarefa | Esforço | Prioridade |
|--------|---------|------------|
| F-1: Tempo Médio | 3h | Alta |
| M-2: Depósito | 8h | Média |
| R-4: Dunning | ✅ | ✅ |

**Total:** 15h (3-4 dias)

---

### Fase 4: Polimento (Semana 4)
**Objetivo:** Melhorias de UX

| Tarefa | Esforço | Prioridade |
|--------|---------|------------|
| Q-3: Atalhos | 2h | Média |
| Q-4: Paginação | 3h | Média |
| F-4: Push Notifications | 2h | Média |
| F-5: Tema Escuro | 3h | Baixa |

**Total:** 10h (2-3 dias)

---

---

## 🛠️ Infraestrutura & Qualidade de Código

---

### INF-2: Rate Limiting nas Edge Functions

**Problema:** Sem proteção contra abuso de APIs. Risco de brute force em admin, spam de agendamentos, abuso de WhatsApp/email.

**Solução Proposta:** Middleware reutilizável `_shared/rate-limit.ts` com configs pré-definidas por função.

**Status:** ✅ **IMPLEMENTADO** — `supabase/functions/_shared/rate-limit.ts`

**Limites aplicados:**

| Edge Function | Limite | Janela |
|---------------|--------|--------|
| `criar-agendamento` | 10 req | 1 min |
| `cancelar-agendamento-cliente` | 10 req | 1 min |
| `reagendar-cliente` | 10 req | 1 min |

**Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` + `429` com `Retry-After`

---

### INF-3: Validação de Origem nas Edge Functions

**Status:** ✅ **IMPLEMENTADO** — `supabase/functions/_shared/cors.ts` já valida origem em todas as 22 Edge Functions.

**Melhoria adicionada:**
- Variáveis de ambiente `ALLOWED_ORIGINS` e `ALLOWED_ORIGINS_DEV` para customizar origins sem redeploys
- Localhost habilitado automaticamente em ambientes não-prod (`SENTRY_ENVIRONMENT !== "production"`)
- Fallback para hardcode se variáveis não definidas

---

### INF-6: Migração Gradual para TypeScript

**Problema:** Edge Functions já em TypeScript, mas módulos compartilhados (`modules/*.js`) em JavaScript. Inconsistência, risco de erros de tipo em runtime.

**Solução Proposta:**

Migração em 3 fases por ordem de criticidade:

**Fase 1: Handlers Críticos (4h)**

| Arquivo | Motivo |
|---------|--------|
| `criar-agendamento-handler.js` | Lógica de criação de agendamento |
| `webhook-asaas-handler.js` | Processamento de pagamentos |
| `cancelar-agendamento-cliente-handler.js` | Cancelamento por token |
| `reagendar-cliente-handler.js` | Reagendamento por token |

**Fase 2: Módulos de Negócio (3h)**

| Arquivo | Motivo |
|---------|--------|
| `scheduling-rules.js` | Geração de slots (complexo) |
| `asaas-webhook-rules.js` | Classificação de eventos Asaas |
| `lista-espera-rules.js` | Regras de lista de espera |
| `agendamento-response.js` | Normalização de resposta |

**Fase 3: Auth e UI (3h)**

| Arquivo | Motivo |
|---------|--------|
| `auth-session.js` | Sessão e autenticação |
| `admin-auth.js` | Auth de admin |
| `painel-init.js` | Proteção de rotas |
| `ui-helpers.js` | Helpers de UI |

**Referência:** `AUDITORIA-TECNICA.md` recomenda "Adicionar TypeScript gradualmente"

**Impacto:** ✅ Type safety, ✅ Autocomplete, ✅ Menos bugs em runtime
**Esforço:** ~10h (4h + 3h + 3h)
**Prioridade:** 🟢 Baixa

---

## 📈 Métricas de Sucesso

### Conversão
- **Taxa trial → pago:** Atual: X% → Meta: 2X (+100%)
- **Taxa Free → Pro:** Atual: Y% → Meta: Y+20%
- **Plano Anual:** % de assinaturas anuais vs mensais

### Retenção
- **Churn mensal:** Atual: Z% → Meta: Z-20%
- **Recuperação de dunning:** % de pagamentos recuperados
- **Recuperação de cancelamento:** % de cancelamentos revertidos

### Engajamento
- **Lista de espera:** % de vagas preenchidas
- **Tempo médio utilizado:** % de serviços com tempo ajustado
- **Avaliações:** % de agendamentos com avaliação

### Receita
- **ARPU:** Atual: R$X → Meta: R$X+15%
- **LTV:** Atual: R$Y → Meta: R$Y+20%
- **Depósitos:** Receita adicional de depósitos

---

## ⭐ Melhorias no Sistema de Avaliações

**Data de identificação:** 2026-04-12
**Status:** Planejamento — 5 oportunidades identificadas

### Contexto Atual

O sistema de avaliações funciona assim:
1. **Cron job** (`solicitar-avaliacao-batch`) roda a cada hora
2. Busca agendamentos `concluidos` entre 1h e 3h atrás
3. Envia **WhatsApp** com link único (`cancel_token`) para avaliação
4. Cliente acessa página HTML com **5 estrelas + comentário opcional**
5. Avaliação é salva na tabela `avaliacoes` (uma por agendamento)
6. **Exibição na página pública:** hero (média + total) + últimas 3 com comentário

**Proteções atuais:**
- `agendamento_id UNIQUE` (1 avaliação por atendimento)
- Só avalia se `status = 'concluido'`
- Flag `avaliacao_solicitada` evita reenvio de WhatsApp
- RLS público para leitura (`FOR SELECT USING (true)`)

---

### Limitações Identificadas

| # | Limitação | Impacto | Severidade |
|---|-----------|---------|------------|
| A-1 | Só WhatsApp — clientes sem WhatsApp não recebem | Perda de 15-30% de avaliações | 🔴 Alta |
| A-2 | Sem moderação — avaliações entram direto, sem aprovação | Risco de avaliações ofensivas/spam | 🔴 Alta |
| A-3 | Sem resposta do profissional | Perda de engajamento e reputação | 🟡 Média |
| A-4 | Sem analytics de taxa de resposta | Profissional não sabe performance | 🟡 Média |
| A-5 | Sem lembrete de segunda chance | Clientes que ignoram não são recontatados | 🟢 Baixa |

---

### A-1: Multi-canal de Solicitação (WhatsApp + Email)

**Problema:**
- Apenas clientes com WhatsApp recebem solicitação
- SendGrid está configurado mas não é usado para avaliações
- Clientes que não usam WhatsApp ficam excluídos

**Solução:**

```typescript
// supabase/functions/solicitar-avaliacao-batch/index.ts
// Adicionar envio por email como fallback

async function enviarEmail(destinatario: string, nome: string, link: string): Promise<boolean> {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) return false;

  const html = `
    <div style="font-family:sans-serif;max-width:400px;margin:auto;text-align:center">
      <h2>Como foi seu atendimento?</h2>
      <p>Olá, ${nome}! Sua avaliação leva só 10 segundos.</p>
      <a href="${link}" style="
        display:inline-block;background:#0e0d0a;color:#fff;
        padding:12px 32px;border-radius:8px;text-decoration:none;
        font-weight:600;margin-top:16px
      ">⭐ Avaliar agora</a>
    </div>
  `;

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sendgridKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: destinatario }] }],
      from: { email: "nao-responda@agendapro.com.br", name: "AgendaPro" },
      subject: "Como foi seu atendimento? ⭐",
      content: [{ type: "text/html", value: html }],
    }),
  });

  return res.ok;
}

// No loop de envio:
// Se WhatsApp falhou E tem email → envia email
if (!ok && ag.cliente_email) {
  const emailOk = await enviarEmail(ag.cliente_email, ag.cliente_nome, linkAvaliacao);
  if (emailOk) enviados++;
  else erros.push(`email ${ag.cliente_email}`);
}
```

**Tabela `agendamentos`:** já possui campo `cliente_email` (TEXT, opcional)

**Arquivos a modificar:**
- `supabase/functions/solicitar-avaliacao-batch/index.ts` — adicionar `enviarEmail()` + fallback
- `.env.example` — documentar `SENDGRID_API_KEY`

**Esforço estimado:** 2h

---

### A-2: Moderação de Avaliações

**Problema:**
- Avaliações entram direto, sem filtro
- Risco de conteúdo ofensivo, spam ou avaliações falsas
- Profissional não tem controle sobre o que é exibido

**Solução:**

```sql
-- migrations/36_moderacao_avaliacoes.sql

-- Adicionar campo de status
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS moderada_em TIMESTAMPTZ;

-- Status possíveis: 'pendente', 'aprovada', 'rejeitada'
ALTER TABLE public.avaliacoes
  ADD CONSTRAINT chk_avaliacoes_status
  CHECK (status IN ('pendente', 'aprovada', 'rejeitada'));

-- Índice para queries de moderação
CREATE INDEX IF NOT EXISTS idx_avaliacoes_status
  ON public.avaliacoes(status, created_at DESC);

-- Auto-aprovação após 24h sem ação
-- (pode ser ajustado conforme volume)
```

**Edge Function — `solicitar-avaliacao-batch`:**
- Já salva com `status = 'pendente'` (default)

**Edge Function — `avaliacoes` (GET `prestador_slug`):**
```typescript
// Só retorna avaliações aprovadas
const { data: avs } = await supabase
  .from("avaliacoes")
  .select("nota, comentario, cliente_nome, created_at")
  .eq("prestador_id", prestador.id)
  .eq("status", "aprovada")  // ← novo filtro
  .order("created_at", { ascending: false })
  .limit(20);
```

**Painel do Profissional (`configuracoes.html` ou `relatorio.html`):**
- Nova aba "Avaliações Pendentes"
- Lista com: nota, comentário, cliente, data
- Botões: ✅ Aprovar | ❌ Rejeitar
- Auto-aprovação após 24h (cron job ou trigger)

```html
<!-- Exemplo de UI no painel -->
<div id="avaliacoes-pendentes">
  <h3>Avaliações Pendentes (3)</h3>
  <div class="av-pendente-card" data-id="xxx">
    <span class="av-stars">★★★★★</span>
    <span class="av-cliente">Maria S.</span>
    <p class="av-comentario">"Atendimento excelente, super recomendo!"</p>
    <div class="av-actions">
      <button onclick="aprovarAvaliacao('xxx')">✅ Aprovar</button>
      <button onclick="rejeitarAvaliacao('xxx')">❌ Rejeitar</button>
    </div>
  </div>
</div>
```

```javascript
// JS do painel
async function aprovarAvaliacao(avId) {
  const { error } = await supabase
    .from('avaliacoes')
    .update({ status: 'aprovada', moderada_em: new Date().toISOString() })
    .eq('id', avId);

  if (error) toast('Erro ao aprovar', 'error');
  else {
    toast('Avaliação aprovada ✓');
    carregarAvaliacoesPendentes();
  }
}

async function rejeitarAvaliacao(avId) {
  const motivo = prompt('Motivo da rejeição (opcional):');
  const { error } = await supabase
    .from('avaliacoes')
    .update({ status: 'rejeitada', moderada_em: new Date().toISOString() })
    .eq('id', avId);

  if (error) toast('Erro ao rejeitar', 'error');
  else {
    toast('Avaliação rejeitada');
    carregarAvaliacoesPendentes();
  }
}
```

**Edge Function — `moderar-avaliacao` (nova):**
```typescript
// supabase/functions/moderar-avaliacao/index.ts
// POST { avaliacao_id, acao: 'aprovar' | 'rejeitar', motivo? }
// Valida JWT do prestador → atualiza status
```

**Arquivos a criar/modificar:**
- `migrations/36_moderacao_avaliacoes.sql` — coluna `status` + constraint + índice
- `supabase/functions/moderar-avaliacao/index.ts` — nova edge function
- `supabase/functions/avaliacoes/index.ts` — filtro `status = 'aprovada'` no GET público
- `pages/relatorio.html` ou `pages/configuracoes.html` — aba de moderação
- `supabase/functions/deploy.sh` — adicionar nova função

**Esforço estimado:** 6h

---

### A-3: Resposta do Profissional

**Problema:**
- Profissional não pode responder avaliações
- Perde oportunidade de engajamento e gestão de reputação
- Clientes que deixam feedback negativo não recebem atenção

**Solução:**

```sql
-- migrations/37_respostas_avaliacoes.sql

CREATE TABLE IF NOT EXISTS public.respostas_avaliacoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id   UUID UNIQUE NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  prestador_id   UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  resposta       TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_respostas_avaliacao
  ON public.respostas_avaliacoes(avaliacao_id);
```

**UI na página pública (`pagina-cliente.html`):**
```html
<!-- Avaliação com resposta -->
<div class="av-card">
  <div class="av-card-header">...</div>
  <div class="av-comentario">"Ótimo serviço, recomendo!"</div>
  <div class="av-resposta">
    <span class="av-resposta-label">💬 Resposta do profissional:</span>
    <p>Obrigado pelo carinho! Volte sempre 💚</p>
  </div>
</div>
```

**UI no painel do profissional:**
```html
<!-- Botão de responder em cada avaliação -->
<div class="av-card">
  ...
  <button class="av-responder-btn" onclick="abrirResposta('xxx')">
    💬 Responder
  </button>
  <div class="av-resposta-form" id="resposta-xxx" style="display:none">
    <textarea placeholder="Escreva sua resposta..." maxlength="300"></textarea>
    <button onclick="salvarResposta('xxx')">Enviar</button>
  </div>
</div>
```

```javascript
async function salvarResposta(avId) {
  const texto = document.querySelector(`#resposta-${avId} textarea`).value.trim();
  if (!texto) return toast('Escreva uma resposta', 'warn');

  const { error } = await supabase.from('respostas_avaliacoes').insert({
    avaliacao_id: avId,
    prestador_id: userId,
    resposta: texto,
  });

  if (error) toast('Erro ao enviar resposta', 'error');
  else {
    toast('Resposta enviada ✓');
    carregarAvaliacoes();
  }
}
```

**Arquivos a criar/modificar:**
- `migrations/37_respostas_avaliacoes.sql` — nova tabela
- `pages/pagina-cliente.html` — exibir resposta nas avaliações
- `pages/relatorio.html` ou `configuracoes.html` — formulário de resposta
- `supabase/functions/avaliacoes/index.ts` — incluir resposta no GET público

**Esforço estimado:** 4h

---

### A-4: Analytics de Taxa de Resposta

**Problema:**
- Profissional não sabe quantos clientes avaliaram
- Sem métrica de satisfação no painel
- Difícil identificar tendências de qualidade

**Solução:**

```sql
-- migrations/38_kpis_avaliacoes.sql

CREATE OR REPLACE FUNCTION public.kpis_avaliacoes(p_prestador_id UUID, p_mes INT DEFAULT NULL)
RETURNS TABLE (
  total_agendamentos      BIGINT,
  total_avaliacoes        BIGINT,
  taxa_resposta           NUMERIC,    -- avaliacoes / agendamentos
  media_geral             NUMERIC,
  notas_1                 BIGINT,
  notas_2                 BIGINT,
  notas_3                 BIGINT,
  notas_4                 BIGINT,
  notas_5                 BIGINT,
  media_ultimos_30_dias   NUMERIC,
  tendencia               TEXT        -- 'subindo' | 'caindo' | 'estavel'
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mes_inicio DATE;
  v_mes_fim DATE;
BEGIN
  IF p_mes IS NOT NULL THEN
    v_mes_inicio := DATE_TRUNC('month', NOW()) - (p_mes * INTERVAL '1 month');
    v_mes_fim := v_mes_inicio + INTERVAL '1 month';
  ELSE
    v_mes_inicio := DATE_TRUNC('month', NOW());
    v_mes_fim := v_mes_inicio + INTERVAL '1 month';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(a.id),
    COUNT(DISTINCT av.id),
    ROUND(COUNT(DISTINCT av.id)::NUMERIC / NULLIF(COUNT(a.id), 0) * 100, 1),
    ROUND(AVG(av.nota)::NUMERIC, 1),
    COUNT(DISTINCT CASE WHEN av.nota = 1 THEN a.id END),
    COUNT(DISTINCT CASE WHEN av.nota = 2 THEN a.id END),
    COUNT(DISTINCT CASE WHEN av.nota = 3 THEN a.id END),
    COUNT(DISTINCT CASE WHEN av.nota = 4 THEN a.id END),
    COUNT(DISTINCT CASE WHEN av.nota = 5 THEN a.id END),
    (
      SELECT ROUND(AVG(nota)::NUMERIC, 1)
      FROM avaliacoes
      WHERE prestador_id = p_prestador_id
        AND created_at >= NOW() - INTERVAL '30 days'
    ),
    (
      SELECT CASE
        WHEN (SELECT AVG(nota) FROM avaliacoes WHERE prestador_id = p_prestador_id
              AND created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days')
          < (SELECT AVG(nota) FROM avaliacoes WHERE prestador_id = p_prestador_id
             AND created_at >= NOW() - INTERVAL '30 days')
        THEN 'subindo'
        WHEN (SELECT AVG(nota) FROM avaliacoes WHERE prestador_id = p_prestador_id
              AND created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days')
          > (SELECT AVG(nota) FROM avaliacoes WHERE prestador_id = p_prestador_id
             AND created_at >= NOW() - INTERVAL '30 days')
        THEN 'caindo'
        ELSE 'estavel'
      END
    )
  FROM agendamentos a
  LEFT JOIN avaliacoes av ON av.agendamento_id = a.id
  WHERE a.prestador_id = p_prestador_id
    AND a.status = 'concluido'
    AND a.data_hora >= v_mes_inicio
    AND a.data_hora < v_mes_fim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kpis_avaliacoes TO authenticated;
```

**Painel do Profissional (`relatorio.html`):**
- Nova aba "Avaliações" ao lado de "Receita", "Clientes", "Tempo Médio"
- Cards:
  - **Taxa de resposta:** "23% dos clientes avaliaram este mês"
  - **Média geral:** "4.8 ★"
  - **Tendência:** "📈 Subindo" ou "📉 Caindo"
  - **Distribuição de notas:** gráfico de barras (1-5)
  - **Comparativo:** média últimos 30 dias vs mês anterior

```html
<!-- Exemplo de UI -->
<div class="kpi-avaliacoes-grid">
  <div class="kpi-card">
    <div class="kpi-label">Taxa de Resposta</div>
    <div class="kpi-valor">23%</div>
    <div class="kpi-delta">dos agendamentos concluídos</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Média Geral</div>
    <div class="kpi-valor">4.8 ★</div>
    <div class="kpi-delta kpi-tendencia-subindo">📈 Subindo</div>
  </div>
  ...
</div>
```

**Arquivos a criar/modificar:**
- `migrations/38_kpis_avaliacoes.sql` — função RPC
- `pages/relatorio.html` — aba "Avaliações" + gráficos
- `supabase/functions/avaliacoes/index.ts` — endpoint para KPIs

**Esforço estimado:** 5h

---

### A-5: Lembrete de Segunda Chance

**Problema:**
- Clientes que ignoram o primeiro WhatsApp nunca são recontatados
- Perda de avaliações valiosas
- Sem follow-up automático

**Solução:**

```typescript
// Nova Edge Function: lembrete-avaliacao-2a-chance
// Cron: 0 14 * * * (todo dia às 14h)

// Busca agendamentos concluídos entre 3 e 7 dias atrás
// Que: avaliacao_solicitada = true MAS não têm avaliação
// E: avaliacao_segunda_chance = false

const { data: esquecidos } = await supabase
  .from("agendamentos")
  .select("id, cliente_nome, cliente_tel, cliente_email, cancel_token, prestadores(nome)")
  .eq("status", "concluido")
  .eq("avaliacao_solicitada", true)
  .eq("avaliacao_segunda_chance", false)
  .is("avaliacoes.id", null)  // LEFT JOIN + IS NULL
  .gte("data_hora", seteDiasAtras.toISOString())
  .lte("data_hora", tresDiasAtras.toISOString());

// Envia mensagem mais suave:
const mensagem =
  `Oi, ${nome}! 😊 Passando rapidinho...\n\n` +
  `Você esqueceu de avaliar seu atendimento com ${prestador}.\n` +
  `Leva 10 segundos e ajuda muito a gente:\n` +
  `⭐ ${link}`;

// Marca como segunda chance enviada
await supabase
  .from("agendamentos")
  .update({ avaliacao_segunda_chance: true })
  .eq("id", ag.id);
```

**Migration:**
```sql
-- migrations/39_segunda_chance_avaliacao.sql

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS avaliacao_segunda_chance BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agendamentos_segunda_chance
  ON public.agendamentos(status, avaliacao_solicitada, avaliacao_segunda_chance, data_hora)
  WHERE status = 'concluido'
    AND avaliacao_solicitada = true
    AND avaliacao_segunda_chance = false;
```

**Arquivos a criar/modificar:**
- `migrations/39_segunda_chance_avaliacao.sql` — nova coluna + índice
- `supabase/functions/lembrete-avaliacao-2a-chance/index.ts` — nova edge function
- `supabase/functions/deploy.sh` — adicionar função + cron

**Esforço estimado:** 3h

---

### Matriz de Priorização

```
IMPACTO
   │
 5 │  A-1 (Multi-canal)    A-2 (Moderação)
   │
 4 │  A-4 (Analytics)           A-3 (Resposta)
   │
 3 │                            A-5 (2ª chance)
   │
 2 └────────────────────────────────────────────
     2h    3h    4h    5h    6h    7h    8h   → ESFORÇO
```

**Ordem sugerida de implementação:**

| Prioridade | Feature | Impacto | Esforço | Justificativa |
|------------|---------|---------|---------|---------------|
| 🥇 1 | **A-1: Multi-canal** | 🔴 Alta | 2h | Quick win — mais avaliações sem custo |
| 🥈 2 | **A-2: Moderação** | 🔴 Alta | 6h | Segurança e controle de conteúdo |
| 🥉 3 | **A-4: Analytics** | 🟡 Média | 5h | Visibilidade para o profissional |
| 4 | **A-3: Resposta** | 🟡 Média | 4h | Engajamento e reputação |
| 5 | **A-5: 2ª chance** | 🟢 Baixa | 3h | Incremental, bom ter |

**Investimento total:** 20h
**ROI esperado:** +40-60% de avaliações recebidas, controle total de conteúdo

---

## 🎯 Checklist de Implementação

### Antes de Começar
- [ ] Priorizar oportunidades com base em ROI
- [ ] Definir sprint backlog (4 semanas)
- [ ] Compartilhar com time/stakeholders

### Durante Implementação
- [ ] Seguir roadmap sugerido
- [ ] Testar cada feature antes de deploy
- [ ] Documentar mudanças

### Após Implementação
- [ ] Monitorar métricas de sucesso
- [ ] Coletar feedback de usuários
- [ ] Iterar baseado em dados

---

**Documento mantido em:** `ROADMAP-OPORTUNIDADES.md`
**Última atualização:** 2026-03-30
**Próxima revisão:** Após Fase 1 (Semana 2)
