# 🧪 Guia de Testes - Cancel Survey (R-2)

## ⚠️ Problema Identificado

**Relato:** "Abre o modal, seleciono qualquer coisa e clico em confirmar cancelamento mas nada acontece"

**Causa provável:** As edge functions `criar-cupom` e `registrar-cancelamento` ainda não foram **deployadas** no Supabase. Elas existem apenas localmente.

---

## 🔍 Como Testar Agora (Antes do Deploy)

### Opção 1: Teste com Console do Navegador (Recomendado)

1. **Acesse sua aplicação:**
   ```bash
   npm run dev
   ```
   Ou abra o Firebase Hosting local.

2. **Faça login** em `/configuracoes`

3. **Abra o Console do Navegador:**
   - Chrome/Edge: `F12` → aba "Console"
   - Firefox: `F12` → aba "Console"

4. **Vá para a seção Plano** e clique em **"Cancelar →"**

5. **Selecione um motivo** (ex: "Não estou mais usando")

6. **Clique em "Confirmar cancelamento"**

7. **Observe o Console:**
   ```
   [Cancel Survey] confirmarCancelamento() foi chamada!
   [Cancel Survey] cancelReason = nao-uso
   [Cancel Survey] Iniciando cancelamento...
   [Cancel Survey] URL: https://xxx.supabase.co/functions/v1/registrar-cancelamento
   [Cancel Survey] Response status: 404
   [Cancel Survey] Edge function não encontrada. Modo simulação ativado.
   [Cancel Survey] Dados que seriam enviados: { motivo: 'nao-uso', ... }
   ```

8. **Resultado esperado:** 
   - ✅ Toast aparece: "✓ SIMULAÇÃO: Cancelamento registrado! Motivo: Não uso mais (Edge function não deployada)"
   - ✅ Modal fecha
   - ✅ Plano recarrega

### Opção 2: Executar Testes Unitários

```bash
# Na raiz do projeto
node --test tests/cancel-survey.test.js
```

**Resultado esperado:**
```
✔ Cancel Survey - Lógica de Validação (15ms)
  ✔ deve validar quando motivo é selecionado (2ms)
  ✔ não deve validar quando motivo não é selecionado (1ms)
  ...

tests 15 passed
```

---

## 🚀 Deploy para Produção

### Passo 1: Aplicar Migration

```bash
# Via Supabase CLI
supabase db push

# OU via Dashboard do Supabase:
# 1. Acesse: https://app.supabase.com/project/YOUR_PROJECT/sql
# 2. Copie o conteúdo de: migrations/32_cancelamentos.sql
# 3. Execute o SQL
```

### Passo 2: Deploy Edge Functions

```bash
# Deploy criar-cupom
supabase functions deploy criar-cupom

# Deploy registrar-cancelamento
supabase functions deploy registrar-cancelamento
```

**Ou via Dashboard:**
1. Acesse: `https://app.supabase.com/project/YOUR_PROJECT/functions`
2. Clique em "Create new function"
3. Copie o conteúdo de:
   - `supabase/functions/criar-cupom/index.ts`
   - `supabase/functions/registrar-cancelamento/index.ts`

### Passo 3: Testar com Edge Functions Reais

1. Após deploy, repita os passos da **Opção 1** acima
2. Agora o response será `200` em vez de `404`
3. Toast mostrará: "✓ Desconto aplicado!" ou "✓ Assinatura cancelada..."
4. Registro será salvo na tabela `cancelamentos`

---

## 🐛 Debug de Problemas Comuns

### Problema: Modal não abre

**Causa:** Função `abrirCancelSurvey()` não está definida.

**Solução:**
1. Verifique no console do navegador se há erro: `abrirCancelSurvey is not defined`
2. Confirme que `configuracoes.html` tem o script atualizado
3. Hard refresh: `Ctrl + Shift + R` (Windows) ou `Cmd + Shift + R` (Mac)

---

### Problema: Toast não aparece

**Causa:** Função `toast()` não está acessível no escopo do módulo.

**Solução:**
1. Verifique no console: `toast is not defined`
2. Se erro existir, código agora usa `alert()` como fallback
3. Para corrigir permanentemente, importe `ui-helpers.js`:
   ```html
   <script src="/modules/ui-helpers.js"></script>
   ```

---

### Problema: Erro 500 da Edge Function

**Causa:** Variáveis de ambiente não configuradas.

**Solução:**
```bash
# No dashboard do Supabase → Functions → Secrets
# Configure:
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ASAAS_API_KEY=your_asaas_api_key
```

---

### Problema: Erro 401 (Não autenticado)

**Causa:** Sessão expirada ou token inválido.

**Solução:**
1. Faça logout e login novamente
2. Verifique se `session.access_token` está sendo enviado
3. No console, execute:
   ```javascript
   const { data } = await supabase.auth.getSession();
   console.log('Session:', data.session);
   ```

---

## ✅ Checklist de Testes

### Teste 1: Cancelamento sem desconto
- [ ] Modal abre ao clicar "Cancelar →"
- [ ] Selecionar "Não estou mais usando"
- [ ] Botão "Confirmar" habilita
- [ ] Clicar em "Confirmar cancelamento"
- [ ] Toast aparece com mensagem de sucesso
- [ ] Modal fecha
- [ ] Registro na tabela `cancelamentos` (verificar no Supabase)

### Teste 2: Cancelamento com desconto (retenção)
- [ ] Modal abre ao clicar "Cancelar →"
- [ ] Selecionar "Muito caro para o que uso"
- [ ] Oferta de desconto aparece automaticamente
- [ ] Clicar em "Aceitar desconto"
- [ ] Toast: "Desconto aplicado!"
- [ ] Desconto criado no Asaas (verificar dashboard)
- [ ] Registro em `cancelamentos` com `recebeu_desconto=true`

### Teste 3: Cancelamento recusando desconto
- [ ] Selecionar "Muito caro"
- [ ] Oferta aparece
- [ ] Clicar em "Não, quero cancelar"
- [ ] Oferta desaparece
- [ ] Botão "Confirmar" habilita
- [ ] Clicar em "Confirmar cancelamento"
- [ ] Cancelamento processado normalmente

### Teste 4: Campo "Outro motivo"
- [ ] Selecionar "Outro motivo"
- [ ] Campo de texto aparece
- [ ] Tentar confirmar sem preencher → deve mostrar erro
- [ ] Preencher e confirmar → deve salvar com sucesso

### Teste 5: Validações
- [ ] Tentar confirmar sem selecionar motivo → erro
- [ ] Voltar para o modal → estado resetado
- [ ] Fechar modal e abrir novamente → limpo

---

## 📊 Verificar no Banco de Dados

```sql
-- Ver todos os cancelamentos
SELECT 
  motivo,
  recebeu_desconto,
  desconto_percentual,
  meses_desconto,
  cancelamento_efetivado,
  criado_em
FROM cancelamentos
ORDER BY criado_em DESC;

-- Contar por motivo
SELECT 
  motivo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE recebeu_desconto) as com_desconto,
  COUNT(*) FILTER (WHERE NOT cancelamento_efetivado) as revertidos
FROM cancelamentos
GROUP BY motivo;

-- Taxa de retenção
SELECT 
  ROUND(
    COUNT(*) FILTER (WHERE NOT cancelamento_efetivado)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as taxa_retencao_pct,
  COUNT(*) as total_cancelamentos,
  COUNT(*) FILTER (WHERE NOT cancelamento_efetivado) as revertidos
FROM cancelamentos;
```

---

## 🎯 Próximos Passos

1. **Testar localmente** com modo de simulação (404 fallback) ✅
2. **Deploy das edge functions** no Supabase
3. **Testar com dados reais** e verificar no banco
4. **Monitorar métricas** de retenção após 1-2 semanas

---

**Última atualização:** 2026-04-08
**Status:** ✅ Modo simulação funcional para testes locais
