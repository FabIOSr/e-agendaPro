#!/bin/bash
# Teste Completo: Assinatura Asaas + Webhook
# Execute: bash teste-completo-assinatura.sh SUA_ASAAS_API_KEY

ASAAS_KEY="$1"
PRESTADOR_ID="543e63c2-0975-4821-b0c5-614d008414c5"
WEBHOOK_URL="https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/webhook-asaas"
ASAAS_URL="https://sandbox.asaas.com/api/v3"

if [ -z "$ASAAS_KEY" ]; then
  echo "❌ Uso: bash teste-completo-assinatura.sh SUA_ASAAS_API_KEY"
  echo ""
  echo "Para pegar sua API key do Asaas Sandbox:"
  echo "  1. Acesse: https://sandbox.asaas.com/"
  echo "  2. Perfil > Integracoes > API Key"
  echo "  3. Copie a key"
  exit 1
fi

echo "🧪 TESTE COMPLETO: Assinatura Asaas + Webhook"
echo "============================================="
echo ""

# ── PASSO 1: Criar Cliente ────────────────────────────────────
echo "📝 Passo 1: Criar cliente no Asaas..."
echo "---------------------------------------"

CUSTOMER_RESPONSE=$(curl -s -X POST "${ASAAS_URL}/customers" \
  -H "access_token: ${ASAAS_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fábio Ramos",
    "email": "fabio-s-ramos@hotmail.com",
    "mobilePhone": "11999999999",
    "cpfCnpj": "12345678909",
    "notificationDisabled": false
  }')

CUSTOMER_ID=$(echo $CUSTOMER_RESPONSE | jq -r '.id // empty')

if [ "$CUSTOMER_ID" = "null" ] || [ "$CUSTOMER_ID" = "empty" ]; then
  echo "❌ Erro ao criar cliente:"
  echo $CUSTOMER_RESPONSE | jq '.'
  exit 1
fi

echo "✅ Cliente criado: $CUSTOMER_ID"
echo ""

# ── PASSO 2: Criar Assinatura ──────────────────────────────────
echo "💳 Passo 2: Criar assinatura PIX..."
echo "--------------------------------------"

NEXT_DUE_DATE=$(date -d tomorrow +%Y-%m-%d)

SUBSCRIPTION_RESPONSE=$(curl -s -X POST "${ASAAS_URL}/subscriptions" \
  -H "access_token: ${ASAAS_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer\": \"${CUSTOMER_ID}\",
    \"billingType\": \"PIX\",
    \"value\": 39.00,
    \"nextDueDate\": \"${NEXT_DUE_DATE}\",
    \"cycle\": \"MONTHLY\",
    \"description\": \"AgendaPro Pro — mensal\",
    \"fine\": { \"value\": 2 },
    \"interest\": { \"value\": 1 }
  }")

SUBSCRIPTION_ID=$(echo $SUBSCRIPTION_RESPONSE | jq -r '.id // empty')

if [ "$SUBSCRIPTION_ID" = "null" ] || [ "$SUBSCRIPTION_ID" = "empty" ]; then
  echo "❌ Erro ao criar assinatura:"
  echo $SUBSCRIPTION_RESPONSE | jq '.'
  exit 1
fi

echo "✅ Assinatura criada: $SUBSCRIPTION_ID"
echo ""

# ── PASSO 3: Buscar primeiro pagamento (para pegar URL PIX) ────
echo "🔍 Passo 3: Buscando pagamento PIX..."
echo "--------------------------------------------"

PAYMENTS_RESPONSE=$(curl -s -X GET "${ASAAS_URL}/payments?subscription=${SUBSCRIPTION_ID}" \
  -H "access_token: ${ASAAS_KEY}")

PAYMENT_URL=$(echo $PAYMENTS_RESPONSE | jq -r '.data[0].invoiceUrl // empty')

if [ "$PAYMENT_URL" != "null" ] && [ "$PAYMENT_URL" != "empty" ]; then
  echo "✅ URL Pagamento PIX: $PAYMENT_URL"
  echo "   (abra no navegador para simular pagamento)"
else
  echo "⚠️  URL de pagamento não encontrada (normal para cartão)"
fi
echo ""

# ── PASSO 4: Simular Webhook de Pagamento Confirmado ─────────
echo "🔔 Passo 4: Simulando webhook PAYMENT_CONFIRMED..."
echo "--------------------------------------------------------"

WEBHOOK_TOKEN=$($HOME/.config/supabase/asaas_webhook_token.txt 2>/dev/null || echo "")
if [ -z "$WEBHOOK_TOKEN" ]; then
  echo "⚠️  ASAAS_WEBHOOK_TOKEN não encontrado"
  echo "   Pegue em: Supabase Dashboard > Edge Functions > Secrets"
  echo "   Ou teste sem webhook (abaixo)"
else
  WEBHOOK_PAYLOAD="{
    \"event\": \"PAYMENT_CONFIRMED\",
    \"payment\": {
      \"id\": \"pay_test_$(date +%s)\",
      \"customer\": \"${CUSTOMER_ID}\",
      \"subscription\": \"${SUBSCRIPTION_ID}\",
      \"value\": 39.00,
      \"billingType\": \"PIX\",
      \"status\": \"CONFIRMED\",
      \"dueDate\": \"${NEXT_DUE_DATE}\",
      \"paymentDate\": \"$(date +%Y-%m-%d)\",
      \"invoiceUrl\": \"https://sandbox.asaas.com/i/teste\"
    }
  }"

  WEBHOOK_RESPONSE=$(curl -s -X POST "${WEBHOOK_URL}" \
    -H "Content-Type: application/json" \
    -H "asaas-access-token: ${WEBHOOK_TOKEN}" \
    -d "$WEBHOOK_PAYLOAD")

  echo "Webhook response: $WEBHOOK_RESPONSE"
fi
echo ""

# ── PASSO 5: Atualizar prestador com customer_id ─────────────────
echo "🔄 Passo 5: Atualizando prestador..."
echo "--------------------------------------"

cat > update_prestador.sql <<EOF
-- Atualiza prestador com dados do Asaas
UPDATE prestadores
SET
  asaas_customer_id = '${CUSTOMER_ID}',
  asaas_sub_id = '${SUBSCRIPTION_ID}',
  plano = 'pro',
  plano_valido_ate = NOW() + INTERVAL '30 days'
WHERE id = '${PRESTADOR_ID}';

-- Mostrar resultado
SELECT
  plano,
  plano_valido_ate,
  asaas_customer_id,
  asaas_sub_id
FROM prestadores
WHERE id = '${PRESTADOR_ID}';
EOF

echo "📄 SQL gerado: update_prestador.sql"
echo ""
echo "⚠️  Para atualizar o banco, rode no Supabase SQL Editor:"
cat update_prestador.sql
echo ""
echo ""

# ── RESUMO ────────────────────────────────────────────────────────
echo "✅ TESTE CONCLUÍDO!"
echo "==================="
echo ""
echo "Dados criados:"
echo "  • Cliente ID:     $CUSTOMER_ID"
echo "  • Assinatura ID:  $SUBSCRIPTION_ID"
echo "  • Vencimento:     $NEXT_DUE_DATE"
echo "  • Valor:          R$ 39,00/mês"
echo ""
echo "URL PIX (se gerada):"
echo "  $PAYMENT_URL"
echo ""
echo "Próximos passos:"
echo "  1. Abra a URL PIX no navegador (se disponível)"
echo "  2. Pague com PIX de teste"
echo "  3. Webhook automático vai atualizar o plano"
echo "  4. OU rode o SQL acima para atualizar manualmente"
echo ""
echo "Para limpar depois:"
echo "  • Delete a assinatura no Asaas Sandbox"
echo "  • Delete o cliente no Asaas Sandbox"
