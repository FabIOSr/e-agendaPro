#!/bin/bash

# API Key do Asaas (sandbox)
ASAAS_KEY="SUA_ASAAS_API_KEY_AQUI"  # Você precisa colocar a key real
ASAAS_URL="https://sandbox.asaas.com/api/v3"

echo "🧪 Teste 1: Criar cliente no Asaas"
echo "======================================"

curl -X POST "${ASAAS_URL}/customers" \
  -H "access_token: ${ASAAS_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fábio Ramos Teste",
    "email": "fabio-teste@example.com",
    "mobilePhone": "11999999999",
    "cpfCnpj": "12345678909",
    "notificationDisabled": false
  }' | jq '.'

echo ""
echo "✅ Se funcionou, copie o 'id' retornado (cus_XXXXX)"
echo ""
echo "🧪 Teste 2: Criar assinatura (substitua CUSTOMER_ID)"
echo "====================================================="

CUSTOMER_ID="cus_000007702097"  # Já existe no banco

curl -X POST "${ASAAS_URL}/subscriptions" \
  -H "access_token: ${ASAAS_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "'${CUSTOMER_ID}'",
    "billingType": "PIX",
    "value": 39.00,
    "nextDueDate": "'$(date -d tomorrow +%Y-%m-%d)'",
    "cycle": "MONTHLY",
    "description": "AgendaPro Pro — mensal",
    "fine": { "value": 2 },
    "interest": { "value": 1 }
  }' | jq '.'

echo ""
echo "✅ Se funcionou, você recebeu:"
echo "  - subscription.id (sub_XXXXX)"
echo "  - Para PIX: paymentUrl gerado automaticamente"
