# 🐛 Debug Rápido - Cancel Survey

## ⚠️ Bug Crítico Corrigido

**Problema:** `DOMContentLoaded` não funciona dentro de `<script type="module">`.

**Solução:** Substituído por função `setupCancelSurveyListeners()` que roda diretamente.

---

## 🧪 Como Testar AGORA

### 1. Abra o Console do Navegador
- Pressione `F12`
- Clique na aba **"Console"**

### 2. Acesse `/configuracoes` e faça login

### 3. Vá para a seção **Plano**

### 4. Clique em **"Cancelar →"**

### 5. Observe os Logs no Console

**Sequência esperada:**
```
[Cancel Survey] Listeners configurados com sucesso
[Cancel Survey] abrindoCancelSurvey() chamado
[Cancel Survey] Modal aberto com display:flex
[Cancel Survey] Estado resetado
```

### 6. Selecione um Motivo (ex: "Não estou mais usando")

**Log esperado:**
```
[Cancel Survey] Motivo selecionado: nao-uso
[Cancel Survey] Botão confirmar habilitado
```

### 7. Clique em **"Confirmar cancelamento"**

**Logs esperados:**
```
[Cancel Survey] confirmarCancelamento() foi chamada!
[Cancel Survey] cancelReason = nao-uso
[Cancel Survey] Iniciando cancelamento...
[Cancel Survey] URL: https://xxx.supabase.co/functions/v1/registrar-cancelamento
[Cancel Survey] Response status: 200
[Cancel Survey] Response: { ok: true, mensagem: 'Assinatura cancelada...' }
```

### 8. Resultado Final

**Toast deve aparecer:** "Assinatura cancelada com sucesso!"

---

## 🔍 Se Não Funcionar

### Cenário A: Nada aparece no console

**Causa:** Código não carregou corretamente.

**Solução:**
1. Hard refresh: `Ctrl + Shift + R` (ou `Cmd + Shift + R`)
2. Limpe cache do navegador
3. Verifique se há erros no console (em vermelho)

---

### Cenário B: Erro "Modal NÃO encontrado!"

**Causa:** HTML do modal não existe no DOM.

**Solução:**
1. Verifique se `<div class="modal-overlay" id="modal-cancel-survey">` está no arquivo
2. Procure por erros de digitação no ID

---

### Cenário C: Botão "Confirmar" continua desabilitado

**Causa:** Radio buttons não estão disparando evento `change`.

**Solução:**
1. Verifique no console se aparece: `[Cancel Survey] Listeners configurados com sucesso`
2. Se não aparecer, os elementos não foram encontrados - tente hard refresh
3. Se aparecer mas botão não habilita, verifique se está selecionando um radio button

---

### Cenário D: Erro 401 (Não autenticado)

**Causa:** Sessão expirada.

**Solução:**
1. Faça logout
2. Login novamente
3. Tente cancelar de novo

---

### Cenário E: Erro 500 da Edge Function

**Causa:** Variáveis de ambiente não configuradas no Supabase.

**Solução:**
```bash
# No dashboard do Supabase → Functions → Secrets
# Configure estas variáveis:
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
ASAAS_API_KEY=sua_chave_asaas
```

---

## ✅ Checklist de Verificação Rápida

- [ ] Console do navegador aberto (F12)
- [ ] Aparece: `[Cancel Survey] Listeners configurados com sucesso`
- [ ] Aparece: `[Cancel Survey] abrindoCancelSurvey() chamado`
- [ ] Aparece: `[Cancel Survey] Motivo selecionado: X`
- [ ] Aparece: `[Cancel Survey] Botão confirmar habilitado`
- [ ] Aparece: `[Cancel Survey] confirmarCancelamento() foi chamada!`
- [ ] Aparece: `[Cancel Survey] Response status: 200`
- [ ] Toast aparece com mensagem de sucesso

---

## 📊 Verificar no Banco de Dados (Após Sucesso)

```sql
-- Ver se registro foi criado
SELECT * FROM cancelamentos ORDER BY criado_em DESC LIMIT 1;
```

---

**Última atualização:** 2026-04-08  
**Bug corrigido:** DOMContentLoaded em modules
