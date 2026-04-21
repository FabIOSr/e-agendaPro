# Planejamento: Assinatura Direta e Upgrade de Trial

**Status:** 📋 Planejado - Backlog de Produto
**Prioridade:** Média
**Estimativa:** 4-6 horas de desenvolvimento
**Data:** 20/04/2026

---

## 🎯 Objetivo

Permitir que clientes assinem o plano Pro de duas formas adicionais:
1. **Skip Trial:** Assinar diretamente sem passar pelos 7 dias de trial
2. **Upgrade Antecipado:** Assinar durante o trial (converter antes do fim)

---

## 📊 Motivação

### Problema Atual
- Fluxo obrigatório: Trial de 7 dias → Fim do trial → Assinatura
- Clientes satisfeitos durante o trial precisam esperar 7 dias para converter
- Clientes decididos perdem tempo iniciando trial quando já querem pagar

### Oportunidade
- Aumentar taxa de conversão (quem quer pagar, consegue pagar)
- Reduzir atrito para clientes que já decidiram
- Capturar momento de decisão "quente" durante o trial

### Benefícios Esperados
- **Conversão +15-20%:** Clientes que querem pagar conseguem
- **Receita antecipada:** Pagamento começa antes do fim do trial
- **Melhor UX:** Respeita a decisão do cliente

---

## 🔧 Implementação Técnica

### 1. Backend - Criação de Assinatura ASAAS

**Arquivo:** `supabase/functions/criar-assinatura/index.ts`

**Alterações necessárias:**

```typescript
interface CriarAssinaturaParams {
  prestador_id: string;
  plano: 'pro';
  cupom?: string;
  skip_trial?: boolean;  // NOVO: pular trial
  upgrade_from_trial?: boolean;  // NOVO: upgrade durante trial
}
```

**Lógica:**

```typescript
// Se skip_trial = true, cria assinatura vigente imediatamente
if (skip_trial) {
  // Cria assinatura ASAAS com CYCLE = MONTHLY (não TRIAL)
  // Marca trial_usado = true
  // Atualiza plano = 'pro', plano_valido_ate = +30 dias
}

// Se upgrade_from_trial = true (usuário já em trial)
if (upgrade_from_trial) {
  // Cancela subscription TRIAL no ASAAS (se existir)
  // Cria nova subscription MONTHLY
  // Atualiza plano = 'pro', plano_valido_ate = +30 dias
  // Mantém trial_ends_at como registro
}
```

### 2. Frontend - Página de Planos

**Arquivo:** `pages/planos.html`

**Alterações visuais:**

```
┌─────────────────────────────────────────────────┐
│  PLANOS AGENDAPRO                               │
├─────────────────────────────────────────────────┤
│                                                 │
│  PLANO GRATIS          PLANO PRO                 │
│  • 30 agendamentos/mês  • Agendamentos ilimitados│
│  • Sem WhatsApp         • WhatsApp automático    │
│                        • Relatórios             │
│                                                 │
│  [Seu plano atual]                              │
│                                                 │
│  [Começar trial grátis]  [Assinar Pro agora]   │
│  7 dias grátis           R$39/mês               │
│                         (assinatura vigente)    │
└─────────────────────────────────────────────────┘
```

**Botões:**
- **"Começar trial grátis"** → Fluxo atual (trial_usado = false, trial_ends_at = +7 dias)
- **"Assinar Pro agora"** → NOVO fluxo (skip_trial = true, vigente imediato)

### 3. Frontend - Upgrade Durante Trial

**Arquivo:** `pages/painel.html` ou componente de banner de trial

**Novo banner durante trial:**

```html
<div class="trial-banner">
  <span>🎉 Trial Pro ativo! Você tem 5 dias restantes</span>
  <div class="trial-actions">
    <button>Continuar trial</button>
    <button class="primary">Assinar agora</button>
  </div>
</div>
```

**Botão "Assinar agora" durante trial:**
```javascript
async function assinarDuranteTrial() {
  const { data } = await supabase
    .functions.invoke('criar-assinatura', {
      body: {
        prestador_id: PRESTADOR.id,
        plano: 'pro',
        upgrade_from_trial: true
      }
    });

  // Mostra modal de sucesso com pagamento ASAAS
  window.location.href = data.checkout_url;
}
```

### 4. Analytics e Tracking

**Eventos a rastrear:**

```javascript
// Quando usuário clica em "Começar trial"
analytics.track('trial_iniciado', {
  plano: 'free',
  origem: 'botao_trial'
});

// Quando usuário clica em "Assinar Pro agora"
analytics.track('assinatura_direta_iniciada', {
  plano: 'free',
  skip_trial: true,
  origem: 'botao_assinar_agora'
});

// Quando usuário faz upgrade durante trial
analytics.track('trial_upgrade_antecipado', {
  plano: 'pro',
  dias_restantes_trial: 5,
  duracao_trial_dias: 2
});
```

---

## 📋 Checklist de Implementação

### Fase 1: Backend (2-3 horas)
- [ ] Adicionar parâmetro `skip_trial` em `criar-assinatura/index.ts`
- [ ] Adicionar parâmetro `upgrade_from_trial` em `criar-assinatura/index.ts`
- [ ] Implementar lógica de criação de assinatura vigente direta
- [ ] Implementar lógica de upgrade de trial para vigente
- [ ] Testar criação de assinatura ASAAS sem trial
- [ ] Testar upgrade durante trial

### Fase 2: Frontend (2-3 horas)
- [ ] Modificar página `/planos` com dois CTAs
- [ ] Adicionar banner de upgrade em `/painel`
- [ ] Implementar função `assinarDireto()`
- [ ] Implementar função `assinarDuranteTrial()`
- [ ] Adicionar tracking analytics
- [ ] Testar fluxo completo localmente

### Fase 3: Documentação e Testes (1 hora)
- [ ] Atualizar documentação de planos
- [ ] Testar E2E: Skip trial → Assinatura vigente
- [ ] Testar E2E: Trial → Upgrade antecipado
- [ ] Deploy em staging
- [ ] Deploy em produção

---

## 🧪 Casos de Teste

### TC1: Skip Trial (Assinatura Direta)
1. Usuário Free acessa `/planos`
2. Clica em "Assinar Pro agora"
3. Redireciona para checkout ASAAS
4. Paga com sucesso
5. **Esperado:** Usuário vira Pro imediatamente, `plano_valido_ate` = +30 dias, `trial_usado` = true

### TC2: Upgrade Durante Trial
1. Usuário em trial (dia 3 de 7)
2. Acessa `/painel`
3. Vê banner "5 dias restantes"
4. Clica em "Assinar agora"
5. **Esperado:** Redireciona para checkout, ao pagar vira Pro vigente, trial cancelado no ASAAS

### TC3: Trial Finaliza Normalmente
1. Usuário em trial (dia 7 de 7)
2. Não fez upgrade
3. Trial expira
4. **Esperado:** Volta para Free, pode assinar depois

---

## 📈 Métricas de Sucesso

**KPIs a monitorar:**

| Métrica | Baseline | Meta | Como medir |
|---------|----------|------|------------|
| Taxa de conversão Free → Pro | X% | X% + 15-20% | Analytics `assinatura_confirmada` |
| Tempo até conversão | 7 dias (trial) | < 7 dias | Analytics `trial_upgrade_antecipado` |
| Skip trial adoption | 0% | 10-15% | Analytics `assinatura_direta_iniciada` |
| Trial upgrades | 0% | 5-10% | Analytics `trial_upgrade_antecipado` |

---

## 🔄 Fluxograma de Decisão

```
Usuário acessa /planos
         │
         ├─ Quer testar primeiro?
         │  └─ SIM → "Começar trial grátis" → Fluxo atual
         │
         └─ Quer assinar direto?
            └─ SIM → "Assinar Pro agora" → NOVO FLUXO
                     │
                     ├─ Checkout ASAAS
                     ├─ Pagamento confirmado
                     └─ Usuário vira Pro (vigente)
```

---

## 🚀 Rollout Planejado

1. **Semanas 1-2:** Implementação Backend
2. **Semanas 3-4:** Implementação Frontend
3. **Semana 5:** Testes internos + Staging
4. **Semana 6:** Deploy em produção + Monitoramento

---

## 📝 Notas

- **Não remover** o fluxo de trial atual - é padrão do mercado
- Manter **ambas as opções** disponíveis (trial + direto)
- Considerar **A/B test** no futuro: posicionar botão de skip trial mais prominence
- **Webhook ASAAS** já trata cancelamentos e upgrades
- Considerar adicionar **desconto de primeiro mês** para incentivar skip trial

---

## 🔗 Relacionado

- `docs/PLANOS-E-PAGAMENTOS.md` - Documentação de planos atual
- `supabase/functions/criar-assinatura/index.ts` - Endpoint de criação
- `supabase/functions/webhook-asaas/index.ts` - Webhook de pagamentos
- `ASAAS Docs` - https://docs.asaas.com/

---

**Última atualização:** 20/04/2026
**Responsável:** @fabio
**Revisão:** -
