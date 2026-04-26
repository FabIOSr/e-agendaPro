# Guia de Teste: Assinatura Asaas + Webhook

## Pré-requisitos

1. **Conta Sandbox Asaas**
   - Acesse: https://sandbox.asaas.com/
   - Crie conta (grátis, sem cartão)
   - Copie API Key em: Perfil > Integracoes

2. **Configurar Supabase**
   ```bash
   # Dashboard > Edge Functions > Secrets
   ASAAS_SANDBOX = "true"
   ASAAS_API_KEY = "$SUA_API_KEY_SANDBOX"
   ```

## Teste 1: Criar Assinatura (Frontend)

### Passos
1. Acesse: `http://localhost:5173/painel`
2. Clique em "Assinar Pro"
3. Selecione PIX (mais rápido)
4. Copie QR Code ou use APP sandbox

### Verificar
```bash
# Lista assinaturas no Asaas Sandbox
curl -X GET "https://sandbox.asaas.com/api/v3/subscriptions" \
  -H "access_token: $ASAAS_API_KEY"
```

## Teste 2: Webhook de Pagamento

### 2.1 Simular pagamento aprovado (Asaas)

```bash
# No painel sandbox Asaas:
# 1. Ache a assinatura criada
# 2. Clique em "Cobranças"
# 3. Altere status para "RECEBIDO" manualmente
```

### 2.2 Verificar webhook processado

```javascript
// No browser console (painel):
supabase
  .from('prestadores')
  .select('plano, plano_valido_ate, asaas_sub_id')
  .eq('id', 'SEU_ID')

// Deveria mostrar:
// plano: "pro"
// plano_valido_ate: "2026-XX-XX" (30 dias a partir de agora)
```

## Teste 3: Cancelar Assinatura

```bash
# Via painel local: /planos > Cancelar
# Ou API direta:

curl -X DELETE "https://sandbox.asaas.com/api/v3/subscriptions/$SUB_ID" \
  -H "access_token: $ASAAS_API_KEY"
```

## Teste 4: Webhook de Cancelamento

```bash
# Após cancelar, verificar:

supabase
  .from('pagamentos')
  .select('*')
  .eq('evento', 'SUBSCRIPTION_CANCELLED')
  .order('data_evento', { ascending: false })
  .limit(5)

# Deveria mostrar registro de cancelamento
```

## Troubleshooting

### Webhook não foi chamado?
```bash
# Verificar logs da edge function
npx supabase functions logs webhook-asaas --project-ref kevqgxmcoxmzbypdjhru

# Verificar se webhook está configurado no Asaas
curl -X GET "https://sandbox.asaas.com/api/v3/webhooks" \
  -H "access_token: $ASAAS_API_KEY"
```

### Plano não atualizou?
```bash
# Verificar pagamentos table
supabase
  .from('pagamentos')
  .select('*')
  .eq('prestador_id', 'SEU_ID')
  .order('data_evento', { ascending: false })

# Deveria ver:
# - SUBSCRIPTION_CREATED (assinatura criada)
# - PAYMENT_CONFIRMED (pagamento confirmado)
```

### URL do webhook?
```bash
# Deve ser:
https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/webhook-asaas

# Configurar em:
# Asaas > Desenvolvedores > Webhooks > Nova webhook
```

## Checklist de Teste

- [ ] Assinatura criada no Asaas
- [ ] Checkout PIX/Boleto funciona
- [ ] Pagamento confirmado (manual no sandbox)
- [ ] Webhook chamado automaticamente
- [ ] Plano atualizado para "pro"
- [ ] `plano_valido_ate` = +30 dias
- [ ] Registro em `pagamentos` table
- [ ] Cancelamento funciona
- [ ] Plano volta para "free"
- [ ] Webhook de cancelamento registrado

## Limpeza (pós-teste)

```bash
# Deletar assinaturas de teste
curl -X GET "https://sandbox.asaas.com/api/v3/subscriptions" \
  -H "access_token: $ASAAS_API_KEY" | jq '.data[].id'

# Deletar uma por uma:
curl -X DELETE "https://sandbox.asaas.com/api/v3/subscriptions/$ID" \
  -H "access_token: $ASAAS_API_KEY"
```

## Dicas

1. **Usar PIX** é mais rápido (não espera boleto compensar)
2. **Cartão de teste sandbox:** 4111 1111 1111 1111
3. **Sempre verifique logs** se algo falhar
4. **Webhook pode demorar 1-2 min** para ser chamado
