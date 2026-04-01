# Sprint: Limites e Features - Planejamento Estratégico

**Data de criação:** 2026-03-29
**Última atualização:** 2026-03-30 (P2-3 Trial de 7 dias implementado)
**Objetivo:** Ajustar limites Free/Pro para otimizar conversão e reduzir churn
**Duração estimada:** 2-3 semanas

---

## 📌 Tecnologias Definidas

| Serviço | Tecnologia | Custo |
|---------|-----------|-------|
| **WhatsApp** | Evolution API (self-hosted) | VPS já existe = ~R$0 por msg |
| **Email** | SendGrid | ~R$0,006 por email |
| **Preço Pro** | R$39/mês (R$29/mês anual) | Definido ✅ |

---

## 📋 Índice

1. [Decisões Estratégicas Pendentes](#decisões-estratégicas-pendentes)
2. [Backlog por Prioridade](#backlog-por-prioridade)
3. [Sprint 1 - Fundação](#sprint-1---fundação)
4. [Sprint 2 - Features Pro](#sprint-2---features-pro)
5. [Sprint 3 - Polimento](#sprint-3---polimento)
6. [Métricas de Sucesso](#métricas-de-sucesso)

---

## 🔴 Decisões Estratégicas

**EVOLUÇÃO API SELF-HOSTED = CUSTO ZERO POR MENSAGEM!**

Isso MUDA completamente a análise de WhatsApp Free. Como o custo marginal é ~R$0, podemos ser mais generosos.

---

### Decisão 1: WhatsApp para cliente Free

**Status:** ✅ **DEFINIDO - Opção C**

```
Free: Confirmação por EMAIL
Pro:  Confirmação por WHATSAPP
```

**Justificativa:** Mesmo com Evolution API self-hosted, VPS boa para muitos disparos custa dinheiro.

**Implementação:**
- Email já funcional (SendGrid)
- Evolution API será configurada para Pro
- Mensagem educativa no painel Free sobre upgrade

---

### Decisão 2: Relatórios para Free

**Status:** ✅ **DEFINIDO - Opção B (simplificada)**

```
Free: Faturamento do mês, total agendamentos, taxa no-show
Pro:  Gráficos, exportar CSV, comparativo mensal, por serviço
```

**Implementação:**
- Free vê cards simples + top 3 serviços
- Pro vê gráficos completos + exportação
- CTA visível para upgrade no topo

---

### Decisão 3: Preço Pro

**Status:** ✅ **IMPLEMENTADO** (2026-03-31)

- **Mensal:** R$39/mês
- **Anual:** R$29/mês (R$348/ano) = 26% de desconto
- **Análise:** Preço competitivo, margem saudável, ROI claro para cliente

**Implementação:**
- Toggle Mensal/Anual em `planos.html`
- Edge Function `criar-assinatura` com suporte a ciclo YEARLY
- Campo `assinatura_periodicidade` no banco
- Badge de periodicidade no `painel.html`

---

## 📊 Backlog por Prioridade

### 🔥 P0 - Crítico (bloqueia lançamento)

| ID | Tarefa | Status |
|----|--------|--------|
| P0-1 | Decisão WhatsApp Free | [✅] Opção C definida |
| P0-2 | Decisão Relatórios Free | [✅] Opção B definida |
| P0-3 | Preço Pro | [✅] R$39 definido |
| P0-4 | Atualizar lembretes para Evolution API | [✅] Código atualizado |

### ⚡ P1 - Alta Prioridade (PRÓXIMA TAREFA)

| ID | Tarefa | Dependências | Estimativa | Status |
|----|--------|--------------|------------|--------|
| P1-1 | Implementar relatórios básicos Free | P0-2 | 4h | [✅] FEITO |
| P1-2 | Ajustar landing page (promessa real) | - | 3h | [✅] FEITO |
| P1-3 | Mensagem educativa no painel Free | - | 2h | [✅] FEITO |
| P1-4 | Configurar Evolution API na VPS | - | 4h | [ ] |

### ✅ P1 - Concluído Recentemente

| ID | Tarefa | Data | Notas |
|----|--------|------|-------|
| P1-2 | Ajustar landing page (promessa real) | 2026-03-30 | Botão Entrar, scroll smooth, features atualizadas |
| P1-3 | Mensagem educativa no painel Free | 2026-03-30 | Banner em painel e configurações, centralizado com container-main |
| P1-5 | Atualizar drawer clientes.html | 2026-03-30 | Avatar, badge, stats cards, toast |
| P1-6 | Transformar aba Clientes em Top 10 | 2026-03-30 | Ranking por receita, sem duplicação |
| P1-7 | Corrigir filtros e stats clientes.html | 2026-03-30 | Bugs corrigidos |

### 🎯 P2 - Média Prioridade

| ID | Tarefa | Dependências | Estimativa | Status |
|----|--------|--------------|------------|--------|
| P2-1 | Implementar relatórios avançados Pro | P1-1 | 6h | [✅] FEITO |
| P2-2 | Exportar relatórios (CSV/PDF) | P2-1 | 4h | [✅] FEITO |
| P2-3 | Trial de 7 dias para Pro (opcional) | P0-1 | 8h | [✅] FEITO |
| P2-4 | Domínio customizado (feature nova) | - | 12h | [ ] |

### ✅ P2 - Concluído Recentemente

| ID | Tarefa | Data | Notas |
|----|--------|------|-------|
| P2-1 | Relatórios avançados Pro | 2026-03-30 | setPeriod(6m/12m), filtros de serviço e status |
| P2-2 | Exportar relatórios CSV/PDF | 2026-03-30 | CSV implementado, PDF via window.print() |
| P2-3 | Trial de 7 dias para Pro | 2026-03-30 | trial_ends_at, ativar_trial, badges com dias restantes |

### 💎 P3 - Baixa Prioridade (futuro)

| ID | Tarefa | Dependências | Estimativa |
|----|--------|--------------|------------|
| P3-1 | API de integração | - | 16h |
| P3-2 | Múltiplos calendários | - | 10h |
| P3-3 | Remoção de marca d'água | - | 2h |

---

## ⚙️ Configuração de Tecnologias

### Evolution API (WhatsApp)

**Status:** Self-hosted em VPS

**Variáveis de ambiente necessárias:**
```bash
EVOLUTION_API_URL="https://SEU_DOMINIO.com"  # URL da VPS
EVOLUTION_API_KEY="SEU_TOKEN_AQUI"           # Token de autenticação
EVOLUTION_INSTANCE="agenda-pro"              # Nome da instância
```

**Endpoints principais:**
```typescript
// Enviar mensagem
POST https://SEU_DOMINIO/message/sendText
{
  "number": "5511999999999",
  "text": "Olá! Seu agendamento foi confirmado."
}

// Status da instância
GET https://SEU_DOMINIO/instance/connectionState/INSTANCE_NAME
```

**Mudanças no código:**
- Substituir chamadas Z-API por Evolution API
- Atualizar formato de número (Evolution usa formato internacional)
- Adicionar tratamento de erros específico

---

### SendGrid (Email)

**Status:** Em testes

**Variáveis de ambiente necessárias:**
```bash
SENDGRID_API_KEY="SG.SUA_CHVE_AQUI"
SENDGRID_FROM_EMAIL="noreply@agendapro.com.br"
SENDGRID_FROM_NAME="AgendaPro"
```

**Endpoint:**
```typescript
POST https://api.sendgrid.com/v3/mail/send
Headers:
  Authorization: Bearer SENDGRID_API_KEY
  Content-Type: application/json

Body:
{
  "personalizations": [{
    "to": [{"email": "cliente@email.com"}],
    "subject": "Agendamento confirmado"
  }],
  "from": {
    "email": "noreply@agendapro.com.br",
    "name": "AgendaPro"
  },
  "content": [{
    "type": "text/html",
    "value": "<h1>Olá, cliente!</h1>..."
  }]
}
```

**Mudanças no código:**
- Substituir Resend por SendGrid em `lembretes-whatsapp/index.ts`
- Atualizar templates para formato SendGrid

---

## 🎯 Decisões Estratégicas Adicionais

### Decisão 4: CRM / Clientes

**Status:** ✅ **DEFINIDO - Opção 3 (Top Clients em relatórios)**

```
Free: Estrutura vazia (sem dados)
Pro:  Top 10 Clientes por receita + drawer completo
```

**Arquitetura definida:**

| Tela | Propósito | Plano |
|------|-----------|-------|
| **clientes.html** | CRM completo para gestão | Pro-only |
| **relatorio.html (aba Clientes)** | Top 10 por receita (ranking) | Pro-only (estrutura vazia para Free) |

**Justificativa:**
- Evita duplicidade de funcionalidades
- Cada tela tem propósito claro e diferente
- Top Clients complementa os relatórios (visão analítica)
- Link "Ver todos no CRM →" direciona para página certa

**Implementação (P1-5, P1-6):**
- ✅ Drawer atualizado com avatar colorido, badge de frequência, 3 cards de estatísticas
- ✅ Async history loading com "Carregando…"
- ✅ Botões de ação (WhatsApp, Ver na agenda)
- ✅ Toast notifications
- ✅ Filtros corrigidos (VIP, Regular, Novo, Sem visita)
- ✅ Stats cards corrigidos
- ✅ Aba Clientes transformada em Top 10 com ranking, medalhas (🥇🥈🥉)

---

## 🏃 Sprint 1 - Fundação

**Objetivo:** Implementar base para novos limites e features

### Semana 1, Dia 1-2: Decisões e Planejamento

**Tarefas:**

- [ ] **Tarefa 1.1:** Definir estratégia WhatsApp Free (2h)
  - Reunião com stakeholders
  - Documentar decisão
  - Atualizar este sprint plan

- [ ] **Tarefa 1.2:** Definir estratégia Relatórios Free (1h)
  - Definir campos disponíveis para Free
  - Definir campos exclusivos Pro

- [ ] **Tarefa 1.3:** Definir preço Pro (1h)
  - Analisar competidores
  - Definir valor mensal/anual

**Entregáveis:**
- [ ] Decisões documentadas
- [ ] Backlog atualizado

---

### Semana 1, Dia 3-5: Relatórios Básicos Free

**Tarefa P1-1:** Implementar relatórios básicos para Free (4h)

**Objetivo:** Usuário Free tem visibilidade mínima para saber se está funcionando

**Campos para Free:**
- Faturamento total do mês atual
- Total de agendamentos do mês
- Taxa de no-show (%)
- Top 3 serviços mais agendados

**Implementação:**

**Arquivo:** `pages/relatorio.html`

```javascript
// Verificar plano e mostrar versão apropriada
function renderRelatorio() {
  const isPro = window.PRESTADOR_IS_PRO;

  if (!isPro) {
    renderRelatorioFree();
  } else {
    renderRelatorioPro();
  }
}

function renderRelatorioFree() {
  // Mostrar apenas:
  // - Cards simples (faturamento, agendamentos, no-show)
  // - Top 3 serviços (lista simples)
  // - Badge "Free" com CTA para upgrade
  // - Mensagem: "Atualize para Pro para ver gráficos e exportar dados"
}

function renderRelatorioPro() {
  // Manter implementação atual com gráficos
  // Adicionar botão exportar (P2-2)
}
```

**Critérios de aceitação:**
- [ ] Usuário Free vê cards com faturamento, agendamentos, no-show
- [ ] Layout limpo, sem parecer "quebrado"
- [ ] CTA visível para upgrade no topo
- [ ] Top 3 serviços exibidos como lista simples

**Teste:**
- [ ] Criar conta Free
- [ ] Fazer 5+ agendamentos
- [ ] Verificar se relatório mostra dados corretamente
- [ ] Verificar CTA para upgrade

---

### Semana 1, Dia 6-7: Notificações por Email (Cliente)

**Tarefa P1-3:** Implementar notificações por email para cliente (6h)

**Objetivo:** Cliente Free recebe confirmação/lembrete por email em vez de WhatsApp

**Arquivo:** `supabase/functions/lembretes-whatsapp/index.ts`

**Implementação:**

```typescript
// Verificar plano do prestador antes de enviar
async function notificarCliente(ag: Agendamento, prefs: PreferenciasNotificacao) {
  const plano = ag.prestadores.plano || 'free';

  // Free: email | Pro: verifica preferência (whatsapp ou email)
  if (plano === 'free') {
    // SEMPRE envia email para Free
    await enviarEmailCliente(ag);
  } else {
    // Pro: respeita preferência configurada
    if (prefs.whatsapp_novo_agendamento) {
      await enviarWhatsAppCliente(ag);
    } else if (prefs.email_novo_agendamento) {
      await enviarEmailCliente(ag);
    }
  }
}
```

**Templates de email:**

```typescript
function emailConfirmacaoCliente(ag: Agendamento): { subject: string; html: string } {
  const appUrl = Deno.env.get("APP_URL") || "https://e-agendapro.web.app";
  const { cancelar, reagendar } = linksCliente(ag.cancel_token);

  return {
    subject: `Agendamento confirmado com ${ag.prestadores.nome}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Olá, ${ag.cliente_nome}! 👋</h2>
        <p>Seu agendamento foi confirmado.</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Serviço:</strong> ${ag.servicos.nome}${formatarPreco(ag.servicos.preco)}</p>
          <p><strong>Duração:</strong> ${ag.servicos.duracao_min} minutos</p>
          <p><strong>Data/hora:</strong> ${formatarDataHora(ag.data_hora)}</p>
        </div>

        <p>Precisa alterar?</p>
        <p>
          <a href="${reagendar}" style="display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px;">Reagendar</a>
          <a href="${cancelar}" style="display: inline-block; padding: 12px 24px; background: #f44336; color: white; text-decoration: none; border-radius: 6px;">Cancelar</a>
        </p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #888;">
          Agendado via <a href="${appUrl}/${ag.prestadores.slug}">AgendaPro</a>
        </p>
      </div>
    `
  };
}

function emailLembreteCliente(ag: Agendamento): { subject: string; html: string } {
  const { cancelar, reagendar } = linksCliente(ag.cancel_token);

  return {
    subject: `Lembrete: seu agendamento amanhã com ${ag.prestadores.nome}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Oi, ${ag.cliente_nome}! 😊</h2>
        <p>Só lembrar que você tem um agendamento <strong>amanhã</strong>.</p>

        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p><strong>Serviço:</strong> ${ag.servicos.nome}</p>
          <p><strong>Data/hora:</strong> ${formatarDataHora(ag.data_hora)}</p>
        </div>

        <p>Precisa alterar?</p>
        <p>
          <a href="${reagendar}" style="display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px;">Reagendar</a>
          <a href="${cancelar}" style="display: inline-block; padding: 12px 24px; background: #f44336; color: white; text-decoration: none; border-radius: 6px;">Cancelar</a>
        </p>

        <p style="font-size: 12px; color: #888;">Até lá!</p>
      </div>
    `
  };
}
```

**Edge Function atualizada:**

```typescript
// Adicionar função enviarEmailCliente
async function enviarEmailCliente(ag: Agendamento, tipo: "confirmacao" | "lembrete") {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY não configurada");
    return;
  }

  const template = tipo === "confirmacao"
    ? emailConfirmacaoCliente(ag)
    : emailLembreteCliente(ag);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("EMAIL_FROM") || "nao-responder@agendapro.com.br",
      to: ag.cliente_email,
      ...template,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Erro ao enviar email:", error);
    throw new Error(`Falha ao enviar email: ${error}`);
  }

  console.log(`Email ${tipo} enviado para ${ag.cliente_email}`);
}
```

**Critérios de aceitação:**
- [ ] Cliente Free recebe email de confirmação
- [ ] Cliente Free recebe email de lembrete D-1
- [ ] Cliente Pro respeita preferência configurada
- [ ] Templates de email estão bonitos e funcionais
- [ ] Links de cancelar/reagendar funcionam

**Teste:**
- [ ] Criar conta Free
- [ ] Fazer agendamento com email válido
- [ ] Verificar email recebido (caixa de entrada/spam)
- [ ] Clicar nos links e verificar funcionamento

---

## 🚀 Sprint 2 - Features Pro

### Semana 2, Dia 1-3: Relatórios Avançados Pro

**Tarefa P2-1:** Implementar relatórios avançados Pro (6h)

**Objetivo:** Dar aos usuários Pro insights valiosos para o negócio

**Features exclusivas Pro:**

1. **Gráficos visuais**
   - Faturamento mensal (linha/barras)
   - Agendamentos por dia da semana
   - Distribuição por serviço

2. **Comparativos**
   - Este mês vs mês anterior
   - Mesmo mês do ano anterior (se houver dados)

3. **Detalhamentos**
   - Todos os serviços ordenados por receita
   - Clientes que mais agendaram (top 10)
   - Horários mais agendados

4. **Filtros**
   - Período customizado
   - Por serviço
   - Por status

**Arquivo:** `pages/relatorio.html`

```javascript
function renderRelatorioPro() {
  // Obter dados filtrados
  const dados = carregarDadosRelatorio();

  // Gráfico de faturamento mensal
  renderGraficoFaturamento(dados.faturamentoMensal);

  // Gráfico de agendamentos por dia da semana
  renderGraficoDiaSemana(dados.porDiaSemana);

  // Gráfico de distribuição por serviço
  renderGraficoServicos(dados.porServico);

  // Tabela comparativa
  renderTabelaComparativa(dados.comparativo);

  // Tabela todos serviços
  renderTabelaServicos(dados.servicos);

  // Tabela top clientes
  renderTabelaClientes(dados.topClientes);

  // Filtros
  initFiltros();
}
```

**Bibliotecas sugeridas:**
- Chart.js (gráficos)
- Ou implementar com CSS puro (mais leve)

**Critérios de aceitação:**
- [ ] Gráficos funcionam e são responsivos
- [ ] Comparativos mostram variação (%)
- [ ] Filtros funcionam corretamente
- [ ] Exportação funciona (P2-2)

---

### Semana 2, Dia 4-5: Exportar Relatórios

**Tarefa P2-2:** Exportar relatórios (CSV/PDF) (4h)

**Objetivo:** Usuário Pro pode exportar dados para análise externa

**Implementação:**

```javascript
// Botão de exportar no relatório
<div class="relatorio-actions">
  <button class="btn-export" onclick="exportarCSV()">
    📄 Exportar CSV
  </button>
  <button class="btn-export" onclick="exportarPDF()">
    📋 Exportar PDF
  </button>
</div>

// Exportar CSV
function exportarCSV() {
  const dados = obterDadosRelatorio();

  const cabecalho = ['Data', 'Cliente', 'Serviço', 'Valor', 'Status'];
  const linhas = dados.agendamentos.map(a => [
    formatarData(a.data_hora),
    a.cliente_nome,
    a.servico_nome,
    a.valor || '',
    a.status
  ]);

  const csv = [cabecalho, ...linhas]
    .map(l => l.join(','))
    .join('\n');

  downloadFile(csv, 'agendapro-relatorio.csv', 'text/csv');
  toast('✓ Relatório exportado!');
}

// Exportar PDF (usando jsPDF ou window.print())
function exportarPDF() {
  // Opção 1: usar jsPDF
  // Opção 2: simplesmente window.print() com CSS @media print
  window.print();
}
```

**CSS para impressão:**

```css
@media print {
  .no-print { display: none !important; }
  .sidebar, .topbar, .btn-export { display: none !important; }
  .relatorio-container { box-shadow: none; border: none; }
  body { background: white; }
}
```

**Critérios de aceitação:**
- [ ] CSV exporta com dados corretos
- [ ] PDF/impressão mostra layout limpo
- [ ] Arquivo tem nome com data

---

### Semana 2, Dia 6-7: Mensagem Educativa no Painel

**Tarefa P1-4:** Mensagem educativa no painel Free (2h)

**Objetivo:** Explicar claramente o que cada plano oferece, reduzir suporte

**Locais:**
- [ ] Painel principal (dashboard.html)
- [ ] Página de agendamentos
- [ ] Configurações

**Implementação:**

```html
<!-- Banner no topo do painel Free -->
<div class="banner-free" id="banner-free" style="display: none;">
  <div class="banner-content">
    <div class="banner-text">
      <strong>📱 Ative o WhatsApp para seus clientes!</strong>
      <p>No plano Pro, seus clientes recebem confirmação automática por WhatsApp. Reduza o no-show em até 70%.</p>
    </div>
    <div class="banner-actions">
      <a href="/planos" class="btn-banner">Ver planos</a>
      <button class="btn-banner-close" onclick="fecharBanner()">×</button>
    </div>
  </div>
</div>

<script>
// Mostrar banner apenas para Free
async function initBanner() {
  const isPro = window.PRESTADOR_IS_PRO;
  if (!isPro && !localStorage.getItem('banner-fechado')) {
    document.getElementById('banner-free').style.display = 'block';
  }
}

function fecharBanner() {
  document.getElementById('banner-free').style.display = 'none';
  localStorage.setItem('banner-fechado', 'true');
}
</script>

<style>
.banner-free {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  margin-bottom: 20px;
  border-radius: 12px;
}

.banner-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.banner-text p {
  margin: 4px 0 0 0;
  opacity: 0.9;
  font-size: 14px;
}

.banner-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-banner {
  background: white;
  color: #667eea;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.btn-banner-close {
  background: transparent;
  color: white;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
}

@media (max-width: 600px) {
  .banner-content {
    flex-direction: column;
    text-align: center;
  }
}
</style>
```

**Badge nos cards:**

```html
<!-- Em cada feature Pro, mostrar badge -->
<div class="feature-card">
  <div class="badge-pro">Pro</div>
  <div class="card-content">...</div>
</div>

<style>
.feature-card {
  position: relative;
  opacity: 0.6;
  pointer-events: none;
}

.badge-pro {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
</style>
```

**Critérios de aceitação:**
- [ ] Banner aparece apenas para Free
- [ ] Banner pode ser fechado
- [ ] Banner não aparece novamente após fechar
- [ ] Badges "Pro" visíveis nas features bloqueadas
- [ ] Cards bloqueados têm visual desabilitado

---

## ✨ Sprint 3 - Polimento

### Semana 3, Dia 1-2: Landing Page

**Tarefa P1-2:** Ajustar landing page (3h)

**Objetivo:** Alinhar promessa com realidade, aumentar conversão

**Arquivo:** `pages/landing-page.html`

**Mudanças:**

**1. Seção de preços - atualizar features**

```html
<!-- Plano Free -->
<div class="preco-card">
  <div class="preco-header">
    <h3>Grátis</h3>
    <div class="preco-valor">R$0<span>/mês</span></div>
  </div>
  <ul class="preco-lista">
    <li>✓ Até 10 agendamentos por mês</li>
    <li>✓ Página personalizada</li>
    <li>✓ Confirmação por <strong>email</strong></li>
    <li>✓ Histórico de clientes</li>
    <li>✓ Relatório básico</li>
    <li class="off">WhatsApp para clientes</li>
    <li class="off">Google Calendar</li>
    <li class="off">Relatórios avançados</li>
    <li class="off">Bloqueios ilimitados</li>
  </ul>
  <a href="/auth" class="btn-preco">Criar grátis</a>
</div>

<!-- Plano Pro -->
<div class="preco-card featured">
  <div class="badge-mais-popular">Mais popular</div>
  <div class="preco-header">
    <h3>Pro</h3>
    <div class="preco-valor">R$XX<span>/mês</span></div>
  </div>
  <ul class="preco-lista">
    <li>✓ <strong>Agendamentos ilimitados</strong></li>
    <li>✓ <strong>WhatsApp automático</strong></li>
    <li>✓ <strong>Google Calendar sync</strong></li>
    <li>✓ Lembrete D-1 automático</li>
    <li>✓ Histórico completo de clientes</li>
    <li>✓ Relatórios com gráficos</li>
    <li>✓ Exportar relatórios (CSV/PDF)</li>
    <li>✓ Bloqueios ilimitados</li>
    <li>✓ Intervalo customizado entre slots</li>
  </ul>
  <a href="/planos" class="btn-preco primary">Começar trial grátis</a>
</div>
```

**2. Seção FAQ - adicionar pergunta sobre WhatsApp**

```html
<div class="faq-item">
  <div class="faq-q">O plano gratuito tem WhatsApp?<div class="faq-icon">+</div></div>
  <div class="faq-a">
    O plano gratuito envia confirmações por <strong>email</strong>. Para enviar mensagens por WhatsApp (que reduzem o no-show em até 70%), você precisa do plano Pro.
  </div>
</div>
```

**3. Hero section - ajustar promessa**

```html
<h1>
  Seu link de agendamento<br>
  <em>em <span class="accent-word">5 minutos</span></em>
</h1>
<p class="hero-sub">
  Cabeleireiros, manicures e profissionais autônomos usam o AgendaPro para organizar a agenda e reduzir no-show.
</p>
```

**Critérios de aceitação:**
- [ ] Features Free/Pro estão claras
- [ ] WhatsApp não é prometido no Free
- [ ] CTA para Pro é claro ("Começar trial" ou "Ver planos")
- [ ] Email é mencionado como confirmação no Free

---

### Semana 3, Dia 3-4: Testes e QA

**Tarefa QA:** Testar todos os fluxos (4h)

**Checklist de testes:**

**Fluxo Free:**
- [ ] Criar conta Free
- [ ] Completar onboarding
- [ ] Configurar 1 serviço
- [ ] Fazer agendamento de teste
- [ ] Verificar email de confirmação recebido
- [ ] Verificar email de lembrete (aguardar D-1 ou simular)
- [ ] Acessar relatório (ver versão Free)
- [ ] Verificar banner de upgrade visível
- [ ] Tentar acessar Google Calendar (deve mostrar CTA Pro)
- [ ] Verificar bloqueios recorrentes (limitado a 1)
- [ ] Verificar intervalo entre slots (bloqueado)

**Fluxo Pro:**
- [ ] Fazer upgrade para Pro
- [ ] Verificar todas features Pro liberadas
- [ ] Fazer agendamento
- [ ] Verificar WhatsApp recebido (cliente)
- [ ] Verificar relatórios avançados
- [ ] Exportar relatório CSV
- [ ] Conectar Google Calendar
- [ ] Criar múltiplos bloqueios recorrentes
- [ ] Configurar intervalo entre slots

**Limites:**
- [ ] Free: após 10 agendamentos, mostrar alerta
- [ ] Free: tentar criar 2º bloqueio recorrente (deve bloquear)
- [ ] Free: tentar configurar intervalo slot (deve bloquear)
- [ ] Pro: verificar que não há limites

**Email/WhatsApp:**
- [ ] Free: recebe email
- [ ] Free: NÃO recebe WhatsApp
- [ ] Pro: recebe WhatsApp (se configurado)
- [ ] Pro: pode escolher entre email/WhatsApp

**Cross-browser:**
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Mobile (iOS/Android)

---

### Semana 3, Dia 5: Documentação e Deploy

**Tarefas finais:**

**Documentação:**
- [ ] Atualizar README com novos limites
- [ ] Documentar variáveis de ambiente (RESEND_API_KEY, EMAIL_FROM)
- [ ] Criar guia de migração para usuários existentes

**Deploy:**
- [ ] Deploy das Edge Functions atualizadas
- [ ] Deploy das páginas HTML
- [ ] Deploy das migrations (se necessário)
- [ ] Testes em produção

**Comunicação:**
- [ ] Email para usuários existentes sobre mudanças
- [ ] Post/blog sobre novas features
- [ ] Atualizar help center/artigos de suporte

---

## 📈 Métricas de Sucesso

**Acompanhar após 30 dias:**

### Conversão
- [ ] Taxa de conversão Free → Pro (objetivo: +20%)
- [ ] Tempo até conversão (objetivo: < 7 dias)

### Engajamento
- [ ] % de usuários Free que usam relatórios
- [ ] % de usuários Free que fazem >5 agendamentos
- [ ] Churn Free (objetivo: -15%)

### Satisfação
- [ ] NPS (Net Promoter Score)
- [ ] Tickets de suporte sobre limites
- [ ] Feedback qualitative

### Técnico
- [ ] Taxa de entrega de emails
- [ ] Custo por usuário Free (objetivo: < R$0,10/mês)
- [ ] Performance das novas features

---

## 🎯 Checklist Final

**Antes de considerar completo:**

Decisões de Negócio:
- [ ] Estratégia WhatsApp Free definida
- [ ] Estratégia Relatórios Free definida
- [ ] Preço Pro definido

Implementação:
- [ ] Relatórios básicos Free implementados
- [ ] Notificações por email (cliente) funcionando
- [ ] Relatórios avançados Pro implementados
- [ ] Exportação CSV/PDF funcionando
- [ ] Mensagem educativa no painel
- [ ] Landing page atualizada

QA:
- [ ] Todos os fluxos testados
- [ ] Cross-browser testado
- [ ] Mobile testado
- [ ] Email/WhatsApp testados

Deploy:
- [ ] Produção atualizada
- [ ] Usuários notificados
- [ ] Documentação atualizada

---

## 📝 Notas

- **Custo estimado de desenvolvimento:** 40-50 horas
- **Timeline sugerida:** 2-3 semanas
- **Risco principal:** Usuários Free existentes ficarem insatisfeitos com mudanças
- **Mitigação:** Comunicar com antecedência, oferecer desconto no primeiro mês Pro

**Próximos passos após este sprint:**
1. Analisar métricas após 30 dias
2. Iterar baseado em feedback
3. Considerar features do backlog P3 (API, múltiplos calendários, etc.)

---

**Documento mantido em:** `SPRINT-LIMITES-FEATURES.md`
**Última atualização:** 2026-03-29
