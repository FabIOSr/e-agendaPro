# R-2: Cancelamento Survey com Retenção Ativa — Documentação

## 📋 Visão Geral

Sistema de pesquisa de cancelamento com retenção ativa. Quando o prestador tenta cancelar, o modal pergunta o motivo e — para planos **mensais** com motivo "muito caro" — oferece desconto de 20% por 3 meses. Planos **anuais** NÃO recebem oferta de desconto (já têm ~25% embutido).

**Meta:** Reduzir churn em 15-25%.

---

## 🎯 Funcionalidades

### 1. Modal de Pesquisa
- 5 opções de motivo (radio buttons)
- Campo de texto para "Outro motivo" (obrigatório quando selecionado)
- Botão "Confirmar cancelamento" (desabilitado até selecionar motivo)

### 2. Retenção Ativa (apenas plano MENSAL)
Se motivo = `"muito-caro"` **e** `assinatura_periodicidade === "MONTHLY"`:
- Oferta de 20% desconto por 3 meses aparece automaticamente
- Exemplo: R$39/mês → R$31,20/mês
- Botão "Aceitar desconto" → chama edge function `criar-cupom`
- Botão "Não, quero cancelar" → esconde oferta, habilita cancelamento normal

### 3. Plano ANUAL — sem oferta de desconto
Se `assinatura_periodicidade === "YEARLY"`:
- Oferta de desconto **nunca aparece**
- Mensagem informativa: "Você já paga o melhor preço (R$29/mês)"
- Se usuário tentar forçar desconto → erro da edge function
- Segue direto para cancelamento normal

### 4. Reversão Automática de Descontos
Cron job diário (03:00 UTC) reverte descontos expirados:
- Cancela assinatura com desconto
- Cria nova assinatura com valor original
- Preserva `billingType` e `nextDueDate` (sem dupla cobrança)

---

## 📦 Arquivos

### Migrations
| Arquivo | Descrição |
|---------|-----------|
| `migrations/32_cancelamentos.sql` | Tabela `cancelamentos` + colunas `tipo_desconto`, `desconto_aplicado_em`, `desconto_valido_ate`, `assinatura_original_sub_id` |
| `migrations/33_reverter_descontos_cron.sql` | Cron job diário + função `get_descontos_expirados()` |

### Edge Functions
| Função | Descrição |
|--------|-----------|
| `supabase/functions/criar-cupom/index.ts` | Aplica desconto de retenção (mensal apenas) |
| `supabase/functions/registrar-cancelamento/index.ts` | Registra motivo + cancela no Asaas |
| `supabase/functions/reverter-desconto/index.ts` | Cron job: reverte descontos expirados |

### Frontend
| Arquivo | Alteração |
|---------|-----------|
| `pages/configuracoes.html` | Modal survey + listeners + `aceitarDesconto()` + `confirmarCancelamento()` |

### Testes
| Arquivo | Descrição |
|---------|-----------|
| `tests/cancel-survey.test.js` | 24 testes unitários (validação, cálculo, estratégia Asaas, plano anual) |

---

## 🔄 Fluxo Completo

### Plano MENSAL com "muito-caro"

```
Usuário clica "Cancelar" → seleciona "Muito caro"
         │
         ▼
┌──────────────────────────────┐
│ 🎁 Oferta especial           │
│                              │
│ 20% off por 3 meses          │
│ R$31,20/mês (era R$39)       │
│                              │
│ [✓ Aceitar desconto]         │
│ [Não, quero cancelar]        │
└──────────────────────────────┘
         │                          │
         ▼ (aceitou)                ▼ (recusou)
    POST /criar-cupom          Esconde oferta
         │                     Habilita "Confirmar"
         ▼                          │
    Fluxo interno ↓                 ▼
                               POST /registrar-cancelamento

── Fluxo interno de criar-cupom ──

1. Recusa YEARLY com erro claro
2. Captura billingType + nextDueDate da assinatura atual
3. DELETE na assinatura atual (cancela ao fim do período)
4. POST nova assinatura com:
   - value = valorOriginal * (1 - desconto/100)
   - billingType = preservado
   - nextDueDate = preservado (sem dupla cobrança)
   - cycle = MONTHLY
5. Calcula descontoValidoAte = nextDueDate + meses
6. Registra em cancelamentos (tipo_desconto = 'mensal_imediato')
7. Log analytics em pagamentos

── Reversão automática (cron job) ──

Diariamente às 03:00 UTC:
1. Busca cancelamentos com desconto_valido_ate < now()
   WHERE tipo_desconto = 'mensal_imediato'
2. DELETE assinatura com desconto
3. POST nova assinatura com valor original
4. Marca cancelamento_efetivado = true
5. Log analytics
```

### Plano ANUAL (qualquer motivo)

```
Usuário clica "Cancelar" → seleciona motivo
         │
         ▼
Aviso informativo aparece:
"Você já paga o melhor preço (R$29/mês)"
         │
         ▼
Botão "Confirmar cancelamento" habilitado
         │
         ▼
POST /registrar-cancelamento
         │
         ▼
Verifica existência no Asaas (GET)
Se existe → DELETE
Se 404 → ignora (já cancelada)
         │
         ▼
Atualiza prestadores.asaas_sub_id = null
Log analytics
```

---

## 🗄️ Banco de Dados

### Tabela: `cancelamentos`

```sql
CREATE TABLE cancelamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL REFERENCES prestadores(id),
  motivo TEXT CHECK (motivo IN (
    'muito-caro', 'nao-uso', 'faltou-feature', 'mudei-ramo', 'outro'
  )),
  outro_motivo TEXT,
  recebeu_desconto BOOLEAN DEFAULT false,
  desconto_percentual INT,
  meses_desconto INT,
  desconto_asaas_sub_id TEXT,          -- ID da assinatura com desconto no Asaas
  desconto_valido_ate TIMESTAMPTZ,      -- Data limite do desconto (quando reverter)
  assinatura_original_sub_id TEXT,      -- ID da assinatura original (para reverter)
  tipo_desconto TEXT,                   -- 'mensal_imediato' ou 'anual_renovacao'
  desconto_aplicado_em TIMESTAMPTZ,     -- Quando o desconto foi agendado/aplicado
  cancelamento_efetivado BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);
```

### Colunas Importantes

| Coluna | Descrição |
|--------|-----------|
| `tipo_desconto` | `'mensal_imediato'` para planos mensais com desconto. `'anual_renovacao'` reservado para futuro uso. |
| `desconto_valido_ate` | Calculado a partir do `nextDueDate` da assinatura atual + número de meses. **NUNCA** da data de hoje. |
| `desconto_asaas_sub_id` | ID da **nova** assinatura criada com valor reduzido. |
| `assinatura_original_sub_id` | ID da assinatura **antes** do desconto (para rastreamento). |
| `cancelamento_efetivado` | `false` enquanto desconto está ativo. `true` após reversão ou cancelamento sem desconto. |

### Índices

```sql
-- Query frequente
CREATE INDEX idx_cancelamentos_prestador ON cancelamentos(prestador_id);
CREATE INDEX idx_cancelamentos_motivo ON cancelamentos(motivo);
CREATE INDEX idx_cancelamentos_criado_em ON cancelamentos(criado_em DESC);

-- Reversão de descontos (apenas mensal_imediato pendente)
CREATE INDEX idx_cancelamentos_desconto_valido
  ON cancelamentos(desconto_valido_ate)
  WHERE recebeu_desconto = true
    AND cancelamento_efetivado = false
    AND tipo_desconto = 'mensal_imediato';
```

---

## 🚀 Deploy

### 1. Migrations

```bash
# Via Supabase CLI
supabase db push

# Ou via Dashboard → SQL Editor → cole o conteúdo de:
# migrations/32_cancelamentos.sql
# migrations/33_reverter_descontos_cron.sql
```

> **Nota:** Se a tabela `cancelamentos` já existir, a migration 32 adiciona automaticamente as colunas faltantes via `ADD COLUMN IF NOT EXISTS`.

### 2. Edge Functions

```bash
supabase functions deploy criar-cupom
supabase functions deploy registrar-cancelamento
supabase functions deploy reverter-desconto
```

### 3. Variáveis de Ambiente

Nenhuma adicional — usam as existentes:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ASAAS_API_KEY`

### 4. Cron Job (pg_cron + pg_net)

A migration 33 cria o job automaticamente. Se pg_net não estiver disponível:
- Use um script externo que chama `public.get_descontos_expirados()` e processe via HTTP
- Ou configure um webhook externo que chame a edge function `reverter-desconto`

---

## 🧪 Testes

### Unitários

```bash
node --test tests/cancel-survey.test.js
```

**24 testes passando** cobrindo:
- Validação de motivo
- Validação de "outro motivo"
- Cálculo de desconto (R$39 → R$31,20)
- Estratégia Asaas (DELETE → POST)
- Plano anual sem desconto
- Cálculo correto de `descontoValidoAte` a partir de `nextDueDate`

### Manuais

| Teste | Passos | Resultado Esperado |
|-------|--------|-------------------|
| Mensal + muito-caro | Selecionar motivo → aceitar desconto | Toast "Desconto aplicado!", nova assinatura no Asaas |
| Mensal + outro motivo | Selecionar motivo → confirmar cancelamento | Cancelamento normal, registro em `cancelamentos` |
| Anual + qualquer motivo | Selecionar motivo | Sem oferta de desconto, aviso "melhor preço" |
| Reversão de desconto | Aguardar `desconto_valido_ate` ou simular | Cron reverte, valor volta a R$39/mês |

---

## ⚠️ Notas Importantes

1. **Asaas NÃO suporta desconto temporário nativo.** A estratégia correta é: DELETE na assinatura atual → POST nova com valor reduzido, preservando `nextDueDate`.

2. **`descontoValidoAte` é calculado a partir do `nextDueDate`**, nunca da data de hoje. Isso garante que o desconto cubra exatamente N ciclos futuros.

3. **Plano anual NÃO recebe desconto adicional** — já tem ~25% embutido (R$348/ano = R$29/mês vs R$39/mês).

4. **Sem dupla cobrança:** A nova assinatura usa o **mesmo** `billingType` e `nextDueDate` da anterior.

5. **Idempotência do cron:** O filtro `tipo_desconto = 'mensal_imediato'` + `cancelamento_efetivado = false` garante que cada desconto só é revertido uma vez.

6. **Race condition no frontend:** Flag `isProcessing` impede double-click em "Aceitar desconto".

---

## 📊 Métricas

```sql
-- Taxa de retenção
SELECT
  ROUND(
    COUNT(*) FILTER (WHERE NOT cancelamento_efetivado)::numeric /
    NULLIF(COUNT(*), 0) * 100, 2
  ) as taxa_retencao_pct
FROM cancelamentos
WHERE recebeu_desconto = true;

-- Receita recuperada
SELECT
  SUM(39 * (desconto_percentual/100.0) * meses_desconto) as receita_retida
FROM cancelamentos
WHERE recebeu_desconto = true;

-- Weekly churn report
SELECT
  DATE_TRUNC('week', criado_em) as semana,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE NOT cancelamento_efetivado) as retidos,
  COUNT(*) FILTER (WHERE recebeu_desconto) as com_desconto
FROM cancelamentos
GROUP BY semana
ORDER BY semana DESC;
```

---

**Última atualização:** 2026-04-09
**Status:** ✅ Implementado e testado (24 testes passando)
