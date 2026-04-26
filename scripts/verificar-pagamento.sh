#!/bin/bash
# Verifica se webhook foi processado

PRESTADOR_ID="5c7a6f0d-e786-4c37-bcca-b17493a45cb5"
SUPABASE_URL="https://kevqgxmcoxmzbypdjhru.supabase.co"

echo "🔍 Verificando webhook..."
echo "=========================="

# Via API Supabase
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/get_pagamentos_recentes" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Content-Type: application/json" \
  -d "{
    \"p_prestador_id\": \"${PRESTADOR_ID}\",
    \"p_limit\": 5
  }" 2>/dev/null | jq '.'

echo ""
echo "✅ Verificar no banco:"
echo ""
echo "SELECT evento, data_evento, asaas_payment_id, valor"
echo "FROM pagamentos"
echo "WHERE prestador_id = '${PRESTADOR_ID}'"
echo "ORDER BY data_evento DESC"
echo "LIMIT 5;"
echo ""
echo "Eventos esperados:"
echo "  - SUBSCRIPTION_CREATED: Assinatura criada"
echo "  - PAYMENT_CONFIRMED: Pagamento confirmado"
echo "  - SUBSCRIPTION_ACTIVATED: Assinatura ativada"
