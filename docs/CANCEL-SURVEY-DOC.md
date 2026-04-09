# R-2: Cancelamento Survey - Documentação

## 📋 Visão Geral

Implementação de sistema de pesquisa de cancelamento com retenção ativa para reduzir churn em 15-25%.

## 🎯 Funcionalidades

### 1. Modal de Pesquisa
Quando usuário clica em "Cancelar" na seção de plano, abre um modal com:
- 5 opções de motivo (radio buttons)
- Campo de texto para "Outro motivo"
- Oferta condicional de desconto (se "muito caro")

### 2. Retenção Ativa
Se usuário seleciona "Muito caro":
- Oferece 20% de desconto por 3 meses
- Botão "Aceitar desconto" aplica desconto via Asaas
- Botão "Não, quero cancelar" permite seguir com cancelamento

### 3. Registro de Dados
Todos os cancelamentos são registrados na tabela `cancelamentos`:
- Motivo do cancelamento
- Se recebeu desconto ou não
- Percentual e duração do desconto (se aplicável)
- Se cancelamento foi efetivado ou revertido

## 📦 Arquivos Criados/Modificados

### Migration
- **`migrations/32_cancelamentos.sql`**
  - Cria tabela `cancelamentos`
  - Políticas RLS para segurança
  - Índices para performance

### Edge Functions
- **`supabase/functions/criar-cupom/index.ts`**
  - Cria desconto no Asaas
  - Registra na tabela `cancelamentos`
  - Log de analytics em `pagamentos`
  
- **`supabase/functions/registrar-cancelamento/index.ts`**
  - Registra motivo do cancelamento
  - Cancela no Asaas
  - Atualiza `prestadores.asaas_sub_id`

### Frontend
- **`pages/configuracoes.html`**
  - Botão "Cancelar" substitui "Gerenciar" (linha ~2705)
  - Modal de Cancel Survey adicionado
  - Funções JavaScript integradas:
    - `abrirCancelSurvey()`
    - `fecharCancelSurvey()`
    - `aceitarDesconto()`
    - `recusarDesconto()`
    - `confirmarCancelamento()`

## 🔄 Fluxo Completo

```
Usuário clica "Cancelar" na seção Plano
         │
         ▼
┌─────────────────────────────────┐
│ MODAL: Podemos ajudar? 😔       │
│                                 │
│ ○ Muito caro para o que uso     │
│ ○ Não estou mais usando         │
│ ○ Faltou alguma funcionalidade  │
│ ○ Mudei de ramo/atividade       │
│ ○ Outro motivo                  │
└─────────────────────────────────┘
         │
         ▼ (se "muito-caro")
┌─────────────────────────────────┐
│ 🎁 Oferta especial              │
│                                 │
│ 20% de desconto por 3 meses    │
│ R$31/mês em vez de R$39        │
│                                 │
│ [✓ Aceitar desconto]            │
│ [Não, quero cancelar]           │
└─────────────────────────────────┘
         │                              │
         ▼ (aceitou)                    ▼ (recusou)
    POST /criar-cupom              POST /registrar-cancelamento
         │                              │
         ▼                              ▼
    Desconto aplicado no Asaas      Cancelamento no Asaas
    registro: recebeu_desconto=true  registro: motivo
         │                              │
         ▼                              ▼
    Toast: "Desconto aplicado!"     Toast: "Assinatura cancelada"
    Modal fecha                     Modal fecha
```

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
  cancelamento_efetivado BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);
```

### Exemplos de Queries

**Motivos mais comuns:**
```sql
SELECT motivo, COUNT(*) as total
FROM cancelamentos
GROUP BY motivo
ORDER BY total DESC;
```

**Taxa de retenção:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE NOT cancelamento_efetivado)::float / 
  COUNT(*) * 100 as taxa_retencao_pct
FROM cancelamentos;
```

**Receita recuperada:**
```sql
SELECT 
  SUM(39 * 0.20 * meses_desconto) as receita_retida,
  COUNT(*) as cancelamentos_retidos
FROM cancelamentos
WHERE recebeu_desconto = true;
```

## 🚀 Deploy

### 1. Aplicar Migration
```bash
# Via Supabase CLI
supabase db push

# Ou manualmente no dashboard do Supabase
# Copiar conteúdo de migrations/32_cancelamentos.sql
```

### 2. Deploy Edge Functions
```bash
# Deploy criar-cupom
supabase functions deploy criar-cupom

# Deploy registrar-cancelamento
supabase functions deploy registrar-cancelamento
```

### 3. Variáveis de Ambiente
Nenhuma variável adicional necessária (usa as existentes):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ASAAS_API_KEY`

## 📊 Métricas de Sucesso

### KPIs para Monitorar

| Métrica | Meta Atual | Como Medir |
|---------|------------|------------|
| % cancelamentos revertidos | 15-25% | `SELECT COUNT(*) WHERE NOT cancelamento_efetivado / COUNT(*)` |
| Motivo mais comum | Descobrir | Group by `motivo` |
| Receita recuperada | R$/mês | SUM de descontos aplicados |
| Tempo médio até cancelar | Dias | AVG(created_at - ultimo_agendamento) |

### Dashboard Sugerido
```sql
-- Weekly churn report
SELECT 
  DATE_TRUNC('week', criado_em) as semana,
  COUNT(*) as total_cancelamentos,
  COUNT(*) FILTER (WHERE NOT cancelamento_efetivado) as retidos,
  COUNT(*) FILTER (WHERE recebeu_desconto) as com_desconto,
  ROUND(
    COUNT(*) FILTER (WHERE NOT cancelamento_efetivado)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as taxa_retencao_pct
FROM cancelamentos
GROUP BY semana
ORDER BY semana DESC;
```

## 🧪 Testes Manuais

### Teste 1: Cancelamento com Desconto
1. Acesse `/configuracoes` → aba Plano
2. Clique em "Cancelar →"
3. Selecione "Muito caro para o que uso"
4. Verifique que oferta de desconto aparece
5. Clique em "Aceitar desconto"
6. Verifique toast: "Desconto aplicado!"
7. Verifique no banco: registro em `cancelamentos` com `recebeu_desconto=true`

### Teste 2: Cancelamento sem Desconto
1. Acesse `/configuracoes` → aba Plano
2. Clique em "Cancelar →"
3. Selecione "Não estou mais usando"
4. Verifique que oferta NÃO aparece
5. Clique em "Confirmar cancelamento"
6. Verifique toast: "Assinatura cancelada..."
7. Verifique no banco: registro em `cancelamentos` com `cancelamento_efetivado=true`

### Teste 3: Campo "Outro Motivo"
1. Selecione "Outro motivo"
2. Verifique que campo de texto aparece
3. Tente confirmar sem preencher → deve mostrar erro
4. Preencha e confirme → deve salvar com sucesso

## ⚠️ Notas Importantes

1. **Asaas API**: A função `criar-cupom` usa endpoint `/subscriptions/{id}/discounts`. Verifique se sua conta Asaas suporta esta API.

2. **Segurança**: Ambas edge functions validam JWT e usam Row Level Security.

3. **Idempotência**: Cada clique em "Aceitar desconto" cria um novo desconto no Asaas. Evite cliques múltiplos.

4. **Grace Period**: Após cancelar, usuário mantém acesso até `plano_valido_ate` (já implementado na edge function).

## 🔮 Próximos Passos Sugeridos

1. **Email de follow-up** para quem cancelou perguntando se quer voltar
2. **Dashboard admin** para visualizar motivos de churn em tempo real
3. **A/B testing** com diferentes percentuais de desconto (15%, 25%, 30%)
4. **Integração com WhatsApp** para retenção ativa via Evolution API

---

**Data de implementação:** 2026-04-08
**Status:** ✅ Implementado - Aguardando deploy e testes
