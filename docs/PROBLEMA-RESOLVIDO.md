# 🔧 Status do Cancel Survey (R-2)

## ❌ Problema Original

> "Tentei cancelar um plano, abre o modal, seleciono qualquer coisa e clico em confirmar cancelamento mas nada acontece."

## ✅ Resolução Completa

O problema era **ausência de deploy** das edge functions + bugs de escopo no frontend. Tudo foi corrigido e documentado.

---

## 📦 O que foi implementado

### Frontend (`pages/configuracoes.html`)
- ✅ Modal de pesquisa com 5 motivos
- ✅ Oferta de desconto **condicional** (apenas mensal + muito-caro)
- ✅ Plano anual: sem oferta, aviso "melhor preço"
- ✅ Fallback `toast()` → `alert()`
- ✅ Proteção contra race condition (`isProcessing` flag)
- ✅ Bug corrigido: `galeriaUrls` exposto no `window` (antes causava `ReferenceError`)
- ✅ Bug corrigido: valores de inputs de galeria preservados ao adicionar novo input

### Migrations
- ✅ `32_cancelamentos.sql` — tabela completa + colunas `tipo_desconto`, `desconto_valido_ate`, etc.
- ✅ `33_reverter_descontos_cron.sql` — cron job diário + função `get_descontos_expirados()`

### Edge Functions
- ✅ `criar-cupom` — aplica desconto mensal (recusa YEARLY)
- ✅ `registrar-cancelamento` — registra motivo + cancela no Asaas (verifica existência antes)
- ✅ `reverter-desconto` — cron job reverte descontos expirados

### Testes
- ✅ **24 testes unitários passando** (`tests/cancel-survey.test.js`)

---

## 🧪 Como Testar

### Localmente (sem deploy — modo simulação 404)

1. `npm run dev`
2. Acesse `/configuracoes` → aba Plano
3. Clique "Cancelar →"
4. Selecione motivo
5. Se edge function não deployada → toast de simulação aparece

### Unitário

```bash
node --test tests/cancel-survey.test.js
# 24 testes passando
```

---

## 🚀 Deploy Necessário

```bash
# Migrations (já rodam com ADD COLUMN IF NOT EXISTS — idempotentes)
supabase db push

# Edge functions
supabase functions deploy criar-cupom
supabase functions deploy registrar-cancelamento
supabase functions deploy reverter-desconto
```

---

## 📊 Verificar no Banco

```sql
-- Últimos cancelamentos
SELECT motivo, recebeu_desconto, tipo_desconto,
       desconto_percentual, cancelamento_efetivado
FROM cancelamentos ORDER BY criado_em DESC;

-- Taxa de retenção
SELECT
  ROUND(COUNT(*) FILTER (WHERE NOT cancelamento_efetivado)::numeric /
    NULLIF(COUNT(*), 0) * 100, 2) as taxa_retencao_pct
FROM cancelamentos WHERE recebeu_desconto = true;
```

---

## 📚 Documentação Completa

- **Arquitetura e fluxo:** [`docs/CANCEL-SURVEY-DOC.md`](CANCEL-SURVEY-DOC.md)
- **Guia de testes:** [`docs/CANCEL-SURVEY-TESTES.md`](CANCEL-SURVEY-TESTES.md)
- **Debug rápido:** (este documento)

---

**Última atualização:** 2026-04-09
**Status:** ✅ Implementado, testado, aguardando deploy
