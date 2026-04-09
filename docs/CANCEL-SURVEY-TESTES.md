# 🧪 Guia de Testes — Cancel Survey (R-2)

## ⚠️ Problema Identificado

**Relato:** "Abre o modal, seleciono qualquer coisa e clico em confirmar cancelamento mas nada acontece"

**Causa provável:** Edge functions `criar-cupom`, `registrar-cancelamento` ou `reverter-desconto` não deployadas no Supabase.

---

## 🔍 Como Testar Localmente

### 1. Iniciar aplicação

```bash
npm run dev
```

### 2. Abrir Console do Navegador (F12)

### 3. Testar fluxo mensal com desconto

1. Vá para `/configuracoes` → aba Plano
2. Clique em "Cancelar →"
3. Selecione "Muito caro para o que uso"
4. Oferta de desconto aparece automaticamente
5. Clique em "Aceitar desconto"

**Console esperado (sem deploy):**
```
[Cancel Survey] Response status: 404
[Cancel Survey] Edge function não encontrada. Modo simulação ativado.
```

### 4. Testar plano anual (sem desconto)

1. Verifique no console: `ASSINATURA_PERICIODICIDADE = "YEARLY"`
2. Clique em "Cancelar →"
3. Selecione qualquer motivo
4. **Oferta de desconto NÃO aparece**
5. Aviso informativo aparece: "Você já paga o melhor preço..."
6. Clique em "Confirmar cancelamento"

---

## 🧪 Testes Unitários

```bash
node --test tests/cancel-survey.test.js
```

**24 testes cobrindo:**

| Categoria | Testes |
|-----------|--------|
| Validação de motivo | 3 |
| Lógica de desconto (mostrar apenas para muito-caro) | 1 |
| Payloads para edge functions | 3 |
| Mapeamento de motivos | 1 |
| Validação de percentual e meses | 2 |
| Estado do botão | 2 |
| Cálculo de desconto | 3 |
| Estratégia Asaas (DELETE → POST) | 2 |
| **Plano anual sem desconto** | 3 |
| **Cálculo correto de descontoValidoAte (nextDueDate)** | 2 |

---

## ✅ Checklist de Testes (pós-deploy)

### Teste 1: Cancelamento sem desconto
- [ ] Modal abre ao clicar "Cancelar →"
- [ ] Selecionar "Não estou mais usando"
- [ ] Botão "Confirmar" habilita
- [ ] Clicar → toast "Assinatura cancelada"
- [ ] Registro em `cancelamentos` com `cancelamento_efetivado=true`

### Teste 2: Cancelamento com desconto (mensal)
- [ ] Selecionar "Muito caro"
- [ ] Oferta de desconto aparece
- [ ] Clicar "Aceitar desconto"
- [ ] Toast: "Desconto aplicado! A partir de..."
- [ ] Nova assinatura no Asaas com valor reduzido
- [ ] `cancelamentos.recebeu_desconto = true`
- [ ] `cancelamentos.tipo_desconto = 'mensal_imediato'`
- [ ] `cancelamentos.desconto_valido_ate` calculado a partir de `nextDueDate`

### Teste 3: Plano anual — sem oferta
- [ ] Plano com `assinatura_periodicidade = 'YEARLY'`
- [ ] Selecionar "Muito caro"
- [ ] Oferta de desconto **NÃO aparece**
- [ ] Aviso "melhor preço" aparece
- [ ] Clicar "Confirmar" → cancelamento normal

### Teste 4: Campo "Outro motivo"
- [ ] Selecionar "Outro motivo"
- [ ] Campo de texto aparece
- [ ] Tentar confirmar sem preencher → erro
- [ ] Preencher → salva com sucesso

### Teste 5: Reversão de desconto (manual)
```bash
# Chamar edge function diretamente
curl -X POST https://SEU_PROJETO.supabase.co/functions/v1/reverter-desconto \
  -H "Content-Type: application/json"
```
- [ ] Busca descontos expirados (`tipo_desconto = 'mensal_imediato'`)
- [ ] DELETE assinatura com desconto no Asaas
- [ ] POST nova com valor original
- [ ] `cancelamentos.cancelamento_efetivado = true`

---

## 🐛 Debug

| Problema | Causa | Solução |
|----------|-------|---------|
| Modal não abre | Função não definida | Hard refresh: `Ctrl+Shift+R` |
| Toast não aparece | `toast()` não importado | Fallback para `alert()` |
| Erro 401 | Sessão expirada | Relogar |
| Erro 500 | Variáveis de ambiente faltando | Configurar `ASAAS_API_KEY` no Supabase |
| `galeriaUrls is not defined` | Bug de escopo | Corrigido — `window.galeriaUrls` |
| Valores da galeria somem ao adicionar input | Re-render sem preservar DOM | Corrigido — `valoresAtuais` preservados |

---

## 📊 Verificar no Banco

```sql
-- Todos os cancelamentos
SELECT motivo, recebeu_desconto, tipo_desconto,
       desconto_percentual, meses_desconto,
       desconto_valido_ate, cancelamento_efetivado
FROM cancelamentos ORDER BY criado_em DESC;

-- Contar por motivo
SELECT motivo, COUNT(*),
  COUNT(*) FILTER (WHERE recebeu_desconto) as com_desconto,
  COUNT(*) FILTER (WHERE NOT cancelamento_efetivado) as revertidos
FROM cancelamentos GROUP BY motivo;

-- Descontos pendentes de reversão
SELECT id, prestador_id, desconto_percentual, desconto_valido_ate
FROM cancelamentos
WHERE recebeu_desconto = true
  AND cancelamento_efetivado = false
  AND tipo_desconto = 'mensal_imediato'
  AND desconto_valido_ate < now();
```

---

**Última atualização:** 2026-04-09
**Status:** ✅ 24 testes passando
