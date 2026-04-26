#!/bin/bash
# Teste manual de criação de assinatura Asaas

# Configurações
PRESTADOR_ID="5c7a6f0d-e786-4c37-bcca-b17493a45cb5"
SUPABASE_URL="https://kevqgxmcoxmzbypdjhru.supabase.co"
SUPABASE_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzc3NTgsImV4cCI6MjA4OTcxMzc1OH0.N6szx9ryreGph4DDLoFYhiHecOJg2G80xVnmoH6PkQg"

echo "🧪 Teste 1: Criar assinatura PIX"
echo "================================"

curl -X POST "${SUPABASE_URL}/functions/v1/criar-assinatura" \
  -H "Authorization: Bearer ${SUPABASE_ANON}" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Content-Type: application/json" \
  -d '{
    "prestador_id": "'${PRESTADOR_ID}'",
    "billing_type": "PIX"
  }' | jq '.'

echo ""
echo "📋 Resposta esperada:"
echo "  - checkoutUrl: URL do Asaas sandbox"
echo "  - subscriptionId: ID da assinatura"
echo "  - customerId: ID do cliente"

echo ""
echo "✅ Próximo passo:"
echo "  1. Abra a checkoutUrl no navegador"
echo "  2. Pague com PIX de teste"
echo "  3. Volte aqui e rode: verificar_pagamento.sh"
