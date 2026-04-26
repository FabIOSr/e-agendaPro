#!/bin/bash
# Simula webhook do Asaas para testar se o sistema funciona

# Configurações
WEBHOOK_URL="https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/webhook-asaas"
WEBHOOK_TOKEN="SEU_ASAAS_WEBHOOK_TOKEN"  # Pega no Supabase: ASAAS_WEBHOOK_TOKEN
PRESTADOR_ID="543e63c2-0975-4821-b0c5-614d008414c5"

echo "🧪 Teste 1: Pagamento Confirmado (atualiza para Pro)"
echo "========================================================"

PAYLOAD_PAYMENT='{
  "event": "PAYMENT_CONFIRMED",
  "payment": {
    "id": "pay_teste_$(date +%s)",
    "customer": "cus_000007702097",
    "subscription": "sub_teste_$(date +%s)",
    "value": 39.00,
    "billingType": "PIX",
    "status": "CONFIRMED",
    "dueDate": "'$(date -d tomorrow +%Y-%m-%d)'",
    "paymentDate": "'$(date +%Y-%m-%d)'",
    "invoiceUrl": "https://sandbox.asaas.com/i/teste"
  }
}'

curl -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: ${WEBHOOK_TOKEN}" \
  -d "${PAYLOAD_PAYMENT}"

echo ""
echo ""
echo "✅ Verifique se o plano foi atualizado:"
echo ""
echo "SELECT plano, plano_valido_ate, asaas_sub_id"
echo "FROM prestadores"
echo "WHERE id = '${PRESTADOR_ID}';"
echo ""
echo "Deveria mostrar:"
echo "  plano: pro"
echo "  plano_valido_ate: +30 dias a partir de hoje"
echo "  asaas_sub_id: sub_teste_XXXXX"

echo ""
echo "🧪 Teste 2: Assinatura Criada"
echo "================================"

PAYLOAD_SUBSCRIPTION='{
  "event": "SUBSCRIPTION_CREATED",
  "subscription": {
    "id": "sub_teste_$(date +%s)",
    "customer": "cus_000007702097",
    "status": "ACTIVE",
    "value": 39.00,
    "billingType": "PIX",
    "cycle": "MONTHLY",
    "description": "AgendaPro Pro — mensal"
  }
}'

curl -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: ${WEBHOOK_TOKEN}" \
  -d "${PAYLOAD_SUBSCRIPTION}"

echo ""
echo "✅ Verifique se criou registro em pagamentos:"
echo ""
echo "SELECT evento, data_evento, asaas_payment_id"
echo "FROM pagamentos"
echo "WHERE prestador_id = '${PRESTADOR_ID}'"
echo "ORDER BY data_evento DESC"
echo "LIMIT 5;"
