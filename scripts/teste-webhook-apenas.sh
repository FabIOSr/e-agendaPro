#!/bin/bash
# Teste APENAS do webhook (simula Asaas chamando)

WEBHOOK_URL="https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/webhook-asaas"
PRESTADOR_ID="543e63c2-0975-4821-b0c5-614d008414c5"
WEBHOOK_TOKEN="PEGUE_NO_DASHBOARD_SUPABASE"  # ASAAS_WEBHOOK_TOKEN

echo "🔔 Teste: Simular webhook de pagamento confirmado"
echo "===================================================="
echo ""
echo "⚠️  Você PRECISA do ASAAS_WEBHOOK_TOKEN:"
echo "   1. Acesse: https://supabase.com/dashboard/project/kevqgxmcoxmzbypdjhru/functions/secrets"
echo "   2. Clique no eye 👁️ ao lado de ASAAS_WEBHOOK_TOKEN"
echo "   3. Copie e cole abaixo"
echo ""
echo "Digite o token (ou pressione ENTER para pular):"
read -r WEBHOOK_TOKEN

if [ -z "$WEBHOOK_TOKEN" ]; then
  echo "❌ Token não fornecido. Teste cancelado."
  exit 1
fi

echo ""
echo "📤 Enviando webhook..."
echo ""

WEBHOOK_PAYLOAD="{
  \"event\": \"PAYMENT_CONFIRMED\",
  \"payment\": {
    \"id\": \"pay_test_$(date +%s)\",
    \"customer\": \"cus_000007702097\",
    \"subscription\": \"sub_teste_$(date +%s)\",
    \"value\": 39.00,
    \"billingType\": \"PIX\",
    \"status\": \"CONFIRMED\",
    \"dueDate\": \"$(date -d tomorrow +%Y-%m-%d)\",
    \"paymentDate\": \"$(date +%Y-%m-%d)\"
  }
}"

curl -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: ${WEBHOOK_TOKEN}" \
  -d "$WEBHOOK_PAYLOAD"

echo ""
echo ""
echo "✅ Webhook enviado!"
echo ""
echo "🔍 Verifique no Supabase SQL Editor:"
echo "   SELECT plano, plano_valido_ate FROM prestadores WHERE id = '${PRESTADOR_ID}';"
echo ""
echo "   Deveria mostrar:"
echo "   - plano: pro"
echo "   - plano_valido_ate: $(date -d '+30 days' +%Y-%m-%d)"
