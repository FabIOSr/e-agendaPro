# 🚀 Changelog — AgendaPro

## [2026-04-06] — Fix: package.json, login.html e smoke test do banco

### 🔧 Correções de Manutenção

#### 1. `package.json` — Script `dev` duplicado removido
- **Problema:** Duas entradas `"dev"` no mesmo arquivo — a segunda sobrescrevia a primeira silenciosamente
- **Antes:** `"dev": "npm run build && npx serve -l 3000 dist"` (perdido) + `"dev": "node server.js"` (ativo)
- **Depois:** `"dev": "node server.js"` + `"dev:preview": "npm run build && npx serve -l 3000 dist"`

#### 2. `pages/admin/login.html` — Brace extra removido
- **Problema:** `}` duplicado no final da função `setLoading()` causava erro de sintaxe silencioso
- **Correção:** Removido brace de fechamento extra

#### 3. `tests/sql/db-smoke.sql` — Datas hard-coded substituídas por cálculos relativos
- **Problema:** Datas `2026-04-04` ficaram no passado (hoje = 2026-04-06), RPC rejeitava com "Nao e possivel agendar no passado"
- **Solução:** Todas as datas agora usam `(now() at time zone 'America/Sao_Paulo' + interval '7 days')::date`
- Disponibilidade do dia da semana agora é calculada dinamicamente com `extract(dow from ...)`
- **Resultado:** Smoke test roda corretamente em qualquer momento, sem precisar ajustes manuais

### 📊 Testes

| Tipo | Antes | Depois |
|------|-------|--------|
| Unitários | 74 passing | 74 passing |
| Smoke DB | ❌ Falhava (datas passadas) | ✅ Passando |

---

## [2026-04-05] — Painel Admin Completo (FASE 1-4)

### 🎯 Painel Administrativo do SaaS

**6 páginas + 6 Edge Functions + módulo de auth** para gerenciamento completo do SaaS.

#### Páginas Criadas

| Página | Rota | Funcionalidade |
|--------|------|----------------|
| `pages/admin/login.html` | `/admin/login` | Login por senha com token JWT 24h |
| `pages/admin/dashboard.html` | `/admin/dashboard` | 4 KPIs + alertas + tabela prestadores |
| `pages/admin/profissionais.html` | `/admin/profissionais` | Grid com busca, filtros de plano, paginação |
| `pages/admin/financeiro.html` | `/admin/financeiro` | MRR, receita 30d, churn, distribuição de planos, pagamentos recentes |
| `pages/admin/acoes.html` | `/admin/acoes` | Suspender, ativar, estender trial, detalhes do prestador |
| `pages/admin/configuracoes.html` | `/admin/configuracoes` | Status do sistema, segredos, comandos de deploy, tabelas |

#### Edge Functions Criadas

| Função | Descrição |
|--------|-----------|
| `admin-validate` | Auth por senha + token JWT 24h |
| `admin-dashboard` | KPIs agregados (totais, novos, trials, alertas) |
| `admin-profissionais` | Busca + filtro plano + paginação |
| `admin-financeiro` | KPIs financeiros, pagamentos recentes, distribuição por plano |
| `admin-actions` | Listar, suspender, ativar, estender trial, detalhes |
| `admin-configuracoes` | Status do sistema, listar tabelas/funções, segredos |

#### Módulo Compartilhado

| Arquivo | Funções |
|---------|---------|
| `modules/admin-auth.js` | `requireAdminAuth`, `logoutAdmin`, `adminHeaders` |

#### Detalhes Técnicos

- **Auth:** Senha única → Edge Function → JWT 24h → `sessionStorage`
- **CORS:** Adicionado header `x-admin-token` ao `_shared/cors.ts`
- **Layout:** Dark theme consistente com sidebar em todas as páginas
- **Deploy:** Firebase Hosting + Supabase Edge Functions
- **Segredos:** `ADMIN_PASSWORD` + `SUPABASE_SERVICE_ROLE_KEY` (RLS bypass)

#### Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `DEPLOY-ADMIN.md` | Guia completo de deploy + segredos + URLs |
| `docs/admin/IMPLEMENTACAO-ADMIN.md` | Plano de implementação (FASE 1-4 concluídas) |
| `docs/admin/RESUMO-EXECUTIVO.md` | Resumo executivo (atualizado: CONCLUÍDO) |

---

## [2026-04-03] — Refatoração Completa: Handlers, Testes (74), Migration 31 e Lista de Espera

### 🔥 Refatoração de Edge Functions em Handlers Compartilhados

**4 edge functions tiveram a lógica de negócio extraída para módulos compartilhados**, reduzindo cada função de ~270 linhas para ~30 linhas de dispatch:

| Handler | Origem | Linhas antes → depois | Testes |
|---------|--------|----------------------|--------|
| `criar-agendamento-handler.js` | `criar-agendamento/index.ts` | 170 → 30 | 8 |
| `webhook-asaas-handler.js` | `webhook-asaas/index.ts` | 190 → 30 | 8 |
| `cancelar-agendamento-cliente-handler.js` | `cancelar-agendamento-cliente/index.ts` | 271 → 30 | 7 |
| `reagendar-cliente-handler.js` | `reagendar-cliente/index.ts` | 279 → 30 | 7 |

**Benefício:** lógica testável sem HTTP mocking, código reutilizável, edge functions como thin wrappers.

### 🧪 Testes Automatizados (74 testes passando!)

**Evolução ao longo do dia:** 4 → 36 → 48 → 56 → 64 → **74 testes**

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `scheduling-rules.test.js` | 24 | Slots, antecedência, conflitos, bloqueios, cadência, grade |
| `lista-espera-rules.test.js` | 10 | Validação de entrada, bloqueio de hoje, janela útil por período |
| `criar-agendamento-handler.test.js` | 8 | Criação, conflitos, limite free, token_reserva |
| `webhook-asaas-handler.test.js` | 8 | Eventos Asaas, ativação/desativação, assinatura |
| `reagendar-cliente-handler.test.js` | 7 | Reagendamento, conflito de horário, WhatsApp |
| `cancelar-agendamento-cliente-handler.test.js` | 7 | Cancelamento por token, WhatsApp, Google Calendar |
| `migrations-contract.test.js` | 8 | Contratos SQL (pagamentos + RPC criar_agendamento_atomic) |
| `asaas-webhook-rules.test.js` | 8 | Classificação de eventos, extração de payload, validade |
| `agendamento-response.test.js` | 4 | Normalização de resposta da stored procedure |

**Novos testes adicionados nesta sessão:**
- ✅ Contrato da migration 31 (intervalo_slot na RPC criar_agendamento_atomic)
- ✅ Smoke test de banco local (criar_agendamento_atomic, conflitos, antecedência, pagamentos)
- ✅ Handlers completos: criação, webhook Asaas, reagendamento, cancelamento
- ✅ Validação de lista de espera: bloqueio de hoje, janela útil por período

### 🗄️ Migration 31 — Fix Critical

**Problema:** RPC `criar_agendamento_atomic` não carregava o campo `intervalo_slot` do perfil do prestador, ignorando o intervalo entre slots no cálculo.

**Solução:** Migration 31 (`fix_criar_agendamento_atomic_intervalo_slot.sql`) corrige o SELECT para incluir `intervalo_slot` no cálculo de slots disponíveis.

**Smoke test de banco:** `tests/run-db-smoke.js` valida a RPC em Supabase local:
- ✅ Criação com sucesso
- ✅ Conflito de horário retorna 409
- ✅ Antecedência mínima no mesmo dia retorna 409
- ✅ Histórico de pagamentos por asaas_payment_id + evento
- ✅ Confirmação com token_reserva

### 📋 Lista de Espera — Módulo de Regras + Bloqueio de Hoje

**Novo módulo:** `modules/lista-espera-rules.js` — centraliza validações de entrada na lista de espera:

| Função | Descrição |
|--------|-----------|
| `getDataAtualBRT(now)` | Data atual em BRT (America/Sao_Paulo) |
| `getMinutosAtualBRT(now)` | Minutos desde meia-noite em BRT |
| `horaParaMinutos(hora)` | Converte "HH:MM" para minutos |
| `podeEntrarNaListaEspera({...})` | Valida se cliente pode entrar na lista |

**Mudanças na validação de entrada:**
- ❌ **Bloqueia hoje:** `dataPreferida === hojeBrt → false` — não permite entrar na lista para o dia atual
- ✅ **Permite futuro:** `dataPreferida > hojeBrt → true` — dias futuros sempre OK
- ✅ **Valida período:** para `tipoPreferencia === 'periodo'`, verifica se o período preferido (manhã/tarde/noite) tem cobertura nas disponibilidades do prestador

**Front-end:** Troca de `alert()` por `toast()` em `pagina-cliente.html` para feedback consistente.

### 📁 Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `modules/criar-agendamento-handler.js` | Novo | Handler completo de criação |
| `modules/webhook-asaas-handler.js` | Novo | Handler completo do webhook Asaas |
| `modules/cancelar-agendamento-cliente-handler.js` | Novo | Handler de cancelamento por token |
| `modules/reagendar-cliente-handler.js` | Novo | Handler de reagendamento por token |
| `modules/lista-espera-rules.js` | Novo | Regras de validação da lista de espera |
| `tests/criar-agendamento-handler.test.js` | Novo | 8 testes de criação |
| `tests/webhook-asaas-handler.test.js` | Novo | 8 testes de webhook |
| `tests/reagendar-cliente-handler.test.js` | Novo | 7 testes de reagendamento |
| `tests/cancelar-agendamento-cliente-handler.test.js` | Novo | 7 testes de cancelamento |
| `tests/lista-espera-rules.test.js` | Novo | 10 testes de validação |
| `tests/migrations-contract.test.js` | Novo | 8 testes de contratos SQL |
| `tests/run-db-smoke.js` | Novo | Smoke test de banco local |
| `tests/sql/db-smoke.sql` | Novo | SQL do smoke test |
| `migrations/fix_criar_agendamento_atomic_intervalo_slot.sql` | Novo | Migration 31 |
| `supabase/functions/criar-agendamento/index.ts` | Modificado | Usa handler compartilhado (~30 linhas) |
| `supabase/functions/webhook-asaas/index.ts` | Modificado | Usa handler compartilhado (~30 linhas) |
| `supabase/functions/cancelar-agendamento-cliente/index.ts` | Modificado | Usa handler compartilhado (~30 linhas) |
| `supabase/functions/reagendar-cliente/index.ts` | Modificado | Usa handler compartilhado (~30 linhas) |
| `pages/pagina-cliente.html` | Modificado | Toast no lugar de alert + bloqueio de hoje |

---

## [2026-04-03] — Refatoração de Testes + Módulos Compartilhados

### 🧪 Testes Automatizados (36 testes passando!)

**Antes:** 4 testes básicos de geração de slots
**Depois:** 36 testes cobrindo todas as regras de negócio críticas

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `tests/scheduling-rules.test.js` | 24 | Slots, antecedência, conflitos, bloqueios, cadência, grade |
| `tests/agendamento-response.test.js` | 4 | Normalização de resposta da SP |
| `tests/asaas-webhook-rules.test.js` | 8 | Classificação de eventos, extração de payload, validade |

**Novos testes adicionados:**
- ✅ Antecedência mínima: só no mesmo dia (bug corrigido)
- ✅ Antecedência: dias futuros ignoram regra
- ✅ Conflitos com agendamentos (mesma duração, duração diferente, com buffer)
- ✅ Bloqueios manuais (single e multi-slot)
- ✅ Bloqueios recorrentes (dia correto vs outros dias)
- ✅ Cadência e grade de horários (30 min, 15 min)
- ✅ Serviço que não cabe no expediente
- ✅ Múltiplos períodos (manhã + tarde)
- ✅ Combinação: agendamento + bloqueio manual + recorrente
- ✅ Ordenação e consistência de motivo_bloqueio
- ✅ Classificação de eventos Asaas (ativar, desativar, inadimplente, ignorar)
- ✅ Extração de assinatura (objeto, string, payload vazio)
- ✅ Validade mensual e anual

### 📦 Módulos Compartilhados

**`modules/scheduling-rules.js`** (refatorado)
- Bug corrigido: antecedência mínima agora só aplica no mesmo dia
- Antes: bloqueava slots < 60 min SEMPRE (incorreto)
- Depois: só bloqueia < 60 min se slot for no mesmo dia (consistente com SQL)
- Comentários e JSDoc traduzidos para pt-BR
- Exporta: `generateSlots`, `horaParaDate`, `dateParaHora`, `conflita`, `getAgoraBRT`

**`modules/agendamento-response.js`** (novo)
- Centraliza normalização do resultado da stored procedure `criar_agendamento_atomic`
- Elimina ~15 linhas duplicadas na edge function `criar-agendamento`
- Testes: sucesso, erro simples, payload de limite, fallback null

**`modules/asaas-webhook-rules.js`** (novo)
- Centraliza regras do webhook Asaas
- Remove ~30 linhas hard-coded da edge function
- Funções: `classificarEventoAsaas`, `extrairAssinaturaAsaas`, `calcularValidadeAte`
- Testes: todos os eventos, extração payload (objeto/string), validade, payload vazio

### 🔧 Edge Functions Simplificadas

| Função | Linhas removidas | Mudança |
|--------|-----------------|---------|
| `horarios-disponiveis` | ~170 | Usa `generateSlots` do módulo compartilhado |
| `webhook-asaas` | ~30 | Usa `classificarEventoAsaas` e `extrairAssinaturaAsaas` |
| `criar-agendamento` | ~5 | Usa `normalizarResultadoCriacaoAgendamento` |

### 📋 Infra de testes

```bash
# Executar todos os testes
npm test

# Runner: tests/run-tests.js (Node.js native test runner)
# Convenção: arquivos *.test.js importam node:test + assert/strict
```

### 📁 Arquivos Modificados/Criados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `modules/scheduling-rules.js` | Modificado | Bug fix de antecedência + JSDoc pt-BR |
| `modules/agendamento-response.js` | Novo | Normalização de resposta |
| `modules/asaas-webhook-rules.js` | Novo | Regras do webhook Asaas |
| `tests/scheduling-rules.test.js` | Reescrito | 24 testes em pt-BR |
| `tests/agendamento-response.test.js` | Novo | 4 testes |
| `tests/asaas-webhook-rules.test.js` | Novo | 8 testes |
| `tests/run-tests.js` | Novo | Runner |
| `package.json` | Modificado | Script `test` adicionado |
| `supabase/functions/horarios-disponiveis/index.ts` | Modificado | Usa módulo compartilhado |
| `supabase/functions/webhook-asaas/index.ts` | Modificado | Usa módulo compartilhado |
| `supabase/functions/criar-agendamento/index.ts` | Modificado | Usa módulo compartilhado |

---

## [2026-04-02] — Correções Críticas: Limite Free, Timezone e Build

### 🔧 Correções Implementadas

#### 1. **Validação de Limite Free no Backend**
- **Arquivo:** `supabase/functions/criar-agendamento/index.ts`
- Edge Function já validava limite de 10 agendamentos/mês para Free
- **Adicionado:** Retorno do WhatsApp do prestador quando limite é atingido
- **Frontend atualizado:** `pages/pagina-cliente.html` agora exibe banner com botão WhatsApp

```typescript
// Backend retorna WhatsApp para contato alternativo
return Response.json({
  erro: "limite_atingido",
  count: count ?? 0,
  limite: LIMITE_FREE,
  whatsapp: prestador.whatsapp  // ← Novo
}, { status: 403 });
```

#### 2. **Timezone Correto nas Edge Functions**
- **Arquivos:** `cron-notificar-lista-espera/index.ts`, `horarios-disponiveis/index.ts`
- **Problema:** `date-fns-tz` causava erro de bundle no Deno
- **Solução:** Usar APIs nativas (`Intl.DateTimeFormat` e conversão manual)

```typescript
// Data atual em BRT (UTC-3) sem dependências externas
function getDataAtualBRT(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
```

#### 3. **Detecção de Timezone no Frontend**
- **Arquivo:** `pages/pagina-cliente.html`
- **Adicionado:** `state.timezone` detecta timezone do browser automaticamente
- **Envio:** Timezone é enviado para Edge Function no payload

```javascript
const state = {
  // ...
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};
```

#### 4. **Build com Placeholders Corretos**
- **Arquivos:** `config.js`, `build.js`, `modules/auth-session.js`
- **Problema:** Validação falhava após build porque checava placeholders antigos
- **Solução:** Placeholders `__VAR__` substituídos + validação atualizada

```javascript
// config.js (template)
const CONFIG_DEFAULTS = {
  SUPABASE_URL: '__SUPABASE_URL__',
  // ...
};

// Validação pré-build: checa placeholders
if (!config.SUPABASE_URL || config.SUPABASE_URL === '__SUPABASE_URL__' || ...)

// build.js: atualiza validação pós-build
configContent = configContent.replace(
  /if \(!config\.SUPABASE_URL \|\| config\.SUPABASE_URL === '__SUPABASE_URL__' \|\| ...\)/,
  `if (!config.SUPABASE_URL || !config.SUPABASE_ANON || !config.APP_URL)`
);
```

#### 5. **Intervalo entre Slots (Free vs Pro)**
- **Arquivo:** `pages/configuracoes.html` (já implementado)
- **Status:** Confirmado que campo é desabilitado para usuários Free
- **Backend:** `aplicar_limites_free()` reseta `intervalo_slot` para 0 no downgrade

### 📝 Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `config.js` | Placeholders `__VAR__` + validação simplificada |
| `build.js` | Substituição de placeholders + atualização da validation |
| `modules/auth-session.js` | Placeholders `__SUPABASE_URL__` e `__SUPABASE_ANON__` |
| `supabase/functions/criar-agendamento/index.ts` | Retorna WhatsApp no erro 403 |
| `supabase/functions/cron-notificar-lista-espera/index.ts` | Timezone com API nativa |
| `supabase/functions/horarios-disponiveis/index.ts` | Timezone com API nativa |
| `pages/pagina-cliente.html` | Detecta timezone + exibe WhatsApp no limite |

### 🧪 Como Testar

**Teste 1: Limite Free**
```
1. Crie conta Free
2. Crie 10 agendamentos
3. Tente criar 11º agendamento
4. ✅ Banner "Agenda indisponível" com botão WhatsApp
```

**Teste 2: Build**
```bash
npm run build
# ✅ Deve completar sem erros
```

**Teste 3: Timezone**
```javascript
// Console do browser na página de agendamento
console.log(state.timezone);
// ✅ "America/Sao_Paulo" (ou seu timezone local)
```

### 📦 Deploy

```bash
# 1. Build
npm run build

# 2. Deploy frontend
firebase deploy --only hosting

# 3. Deploy Edge Functions
supabase functions deploy criar-agendamento --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy cron-notificar-lista-espera --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
supabase functions deploy horarios-disponiveis --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
```

---

## [2026-04-01] — Lista Espera Inteligente 2.0 + Preferências de Horário

### ✨ Nova Funcionalidade: Lista de Espera com Preferências

**Cliente escolhe como quer ser notificado quando vaga surgir**

- **3 tipos de preferência:**
  - **Horário exato:** Só notifica se liberar exatamente aquele horário (ex: 14:00)
  - **Período do dia:** Notifica se liberar qualquer horário no período (manhã/tarde/noite)
  - **Qualquer horário:** Notifica se liberar qualquer horário no dia (máxima chance)

- **Modal atualizado em `pagina-cliente.html`:**
  - Radio buttons para escolher tipo de preferência
  - Input de hora para "exato"
  - Select de período (manhã/tarde/noite) para "período"
  - Resumo mostra serviço + duração

- **Edge Function `entrada-lista-espera` atualizada:**
  - Salva `servico_id`, `servico_duracao_min`
  - Salva `tipo_preferencia`, `periodo_preferido`
  - Valida duplicidade inteligente (considera tipo de preferência)
  - Mensagem WhatsApp/email personalizada com tipo de preferência

- **Nova Edge Function `cron-notificar-lista-espera`:**
  - Cron job que roda a cada 5 minutos
  - Busca clientes não notificados na lista de espera
  - Chama `horarios-disponiveis` para verificar slots disponíveis
  - Filtra por compatibilidade: horário + período + preferência
  - Notifica via WhatsApp (Evolution API) + Email (SendGrid)
  - Marca como notificado após envio

- **Migration 23 atualizada:**
  - Campos: `servico_id`, `servico_duracao_min`, `tipo_preferencia`, `periodo_preferido`
  - Índices novos: `idx_lista_espera_servico`, `idx_lista_espera_notificado`
  - Trigger simplificada: só marca para notificação (cron faz o resto)

- **Migration 24 criada:**
  - Função `agendamentos_cancelados_recentes()` (placeholder)

### 📋 Regras de Notificação (Atualizado)

**Antecedência Mínima:**
- Notifica apenas se horário liberado for ≥ 2 horas a partir de agora
- Evita notificações "em cima da hora" (ex: 13:59 para vaga 14:00)
- Configurável no código: `diffHoras < 2`

**Validade da Entrada:**
- ✅ Notifica se `data_preferida >= hoje`
- ❌ Não notifica se `data_preferida < hoje` (data já passou)
- ❌ Não notifica se horário já passou (mesmo dia)
- Sem expiração artificial de 7 dias (removido campo `expira_em`)

**Compatibilidade:**
- Reutiliza `horarios-disponiveis` para verificar se serviço cabe no slot
- Considera duração do serviço do cliente vs duração do slot

**Exemplo Prático:**
```
Cliente entra na lista: 25/04/2026 às 14:00

20/04 10:00 → ✅ Notifica (5 dias antes)
25/04 10:00 → ✅ Notifica (4h antes)
25/04 11:59 → ✅ Notifica (2h antes)
25/04 12:01 → ❌ Não notifica (1h59 antes)
25/04 14:01 → ❌ Não notifica (hora já passou)
26/04 08:00 → ❌ Não notifica (data já passou)
```

### 🔄 Fluxo Completo

```
1. CLIENTE ENTRA NA LISTA
   ├─ Escolhe tipo de preferência (exato/período/qualquer)
   ├─ Informa data e horário/período
   ├─ Seleciona serviço (para compatibilidade)
   └─ Recebe confirmação WhatsApp + Email

2. CRON JOB (*/5 * * * *)
   ├─ Busca: notificado=false, agendado=false
   ├─ Filtra: data_preferida >= hoje
   └─ Agrupa por prestador + data

3. CANCELAMENTO LIBEROU VAGA
   ├─ Trigger marca lista_espera.notificado=false
   └─ Cron job detecta na próxima execução

4. VERIFICA COMPATIBILIDADE
   ├─ Chama horarios-disponiveis (serviço do cliente)
   ├─ Filtra slots disponíveis
   └─ Encontra horário compatível com preferência

5. NOTIFICA CLIENTE
   ├─ Verifica antecedência >= 2h
   ├─ Envia WhatsApp (Evolution API)
   ├─ Envia Email (SendGrid)
   └─ Atualiza: notificado=true, notificado_em=NOW()
```

### 🗄️ Estrutura do Banco (Migration 23)

```sql
CREATE TABLE public.lista_espera (
  id UUID PRIMARY KEY,
  prestador_id UUID NOT NULL REFERENCES prestadores(id),
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_email TEXT,
  data_preferida DATE NOT NULL,
  hora_preferida TIME,
  servico_id UUID REFERENCES servicos(id),
  servico_nome TEXT,
  servico_duracao_min INT,
  tipo_preferencia TEXT DEFAULT 'exato',  -- 'exato' | 'periodo' | 'qualquer'
  periodo_preferido TEXT,                 -- 'manha' | 'tarde' | 'noite'
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  notificado BOOLEAN DEFAULT FALSE,
  notificado_em TIMESTAMPTZ,
  agendado BOOLEAN DEFAULT FALSE,
  UNIQUE(cliente_telefone, data_preferida, hora_preferida, servico_id)
);

-- Índices
CREATE INDEX idx_lista_espera_prestador ON lista_espera(prestador_id);
CREATE INDEX idx_lista_espera_data ON lista_espera(data_preferida);
CREATE INDEX idx_lista_espera_servico ON lista_espera(servico_id);
CREATE INDEX idx_lista_espera_notificado ON lista_espera(notificado, agendado);

-- RLS: apenas prestador vê sua lista
CREATE POLICY "Prestador vê sua lista de espera"
  ON lista_espera FOR SELECT TO authenticated
  USING (auth.uid() = (SELECT p.id FROM prestadores p WHERE p.id = prestador_id));
```

### 📁 Arquivos Criados/Modificados

**Criados:**
- `migrations/24_cancelamentos_recentes.sql`
- `supabase/functions/cron-notificar-lista-espera/index.ts`

**Modificados:**
- `migrations/23_lista_espera.sql` — Remove `expira_em`, corrige RLS
- `pages/pagina-cliente.html` — Modal com preferências + texto atualizado
- `supabase/functions/entrada-lista-espera/index.ts` — Salva serviço + preferência, mensagens atualizadas
- `supabase/functions/notificar-lista-espera/index.ts` — Remove filtro `expira_em`
- `CHANGELOG.md` — Esta documentação

---

### 🔧 Melhorias: Busca de Clientes (Q-5)
- **Busca unificada** por nome, telefone e email
- **Placeholder atualizado**: "Buscar por nome, telefone ou email…"
- **Mensagem contextual** quando nenhum cliente é encontrado
  - Com busca: Mostra termo pesquisado e sugere campos
  - Sem busca: "Nenhum cliente cadastrado"
- **Filtro em tempo real** combinando com filtros VIP/Regular/Novos

**Impacto:**
- Localização 3x mais rápida de clientes (3 campos vs 1)
- Útil para bases grandes (100+ clientes)
- Reduz tempo de atendimento no salão

**Arquivos:** `pages/clientes.html`

---

## [2026-03-31] — Plano Anual + Monitoramento Sentry + Toast Centralizado

### ✨ Novas Funcionalidades

#### 1. **Plano Anual com Desconto (26% OFF)**
- **Toggle Mensal/Anual** em `planos.html` com badge "-26%"
- **Edge Function `criar-assinatura`** atualizada para suportar ciclo YEARLY
- **Webhook Asaas** salva periodicidade quando assinatura é ativada
- **Badge no painel** mostra "(plano anual)" ou "(plano mensal)" para usuários Pro
- **Migration** adiciona campo `assinatura_periodicidade` na tabela `prestadores`

**Preços:**
| Plano | Valor | Cobrança | Economia |
|-------|-------|----------|----------|
| Mensal | R$ 39/mês | Todo mês | — |
| Anual | R$ 29/mês | R$ 348/ano | 26% (R$ 120) |

#### 2. **Monitoramento de Erros com Sentry**
- **Frontend**: Módulo `modules/sentry.js` inicializado em todas as páginas principais
- **Backend**: Sentry implementado em 4 Edge Functions críticas
  - `criar-agendamento`
  - `horarios-disponiveis`
  - `criar-assinatura`
  - `webhook-asaas`
- **DSN**: `https://17c6e06768f45437c43076724835eaa7@o4511141658230784.ingest.us.sentry.io/4511141704957952`
- **Features**:
  - Captura automática de erros
  - Fallback para adblockers (não quebra o app se bloqueado)
  - Contexto de usuário (após login)
  - Environment: production

#### 3. **Toast Notification Centralizado**
- **Módulo**: `modules/ui-helpers.js`
- **Funções**:
  - `toast(message, type, duration)` - Notificação temporária
  - `toastWithUndo(message, onUndo, duration)` - Toast com botão de desfazer
  - `confirmModal(title, message)` - Modal de confirmação
- **Estilo**:
  - Posição: topo centralizado
  - Animação: fade in/out suave com slide vertical
  - Tipos: success (verde), error (vermelho), warning (laranja), info (azul)
  - Duração padrão: 3000ms

### 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `modules/sentry.js` | Inicialização do Sentry frontend (v7.119.0) |
| `modules/ui-helpers.js` | Helpers de UI reutilizáveis (toast, modal) |
| `SENTRY-CONFIG.md` | Guia completo de configuração do Sentry |

### 📝 Arquivos Modificados

#### Build & Config
| Arquivo | Mudança |
|---------|---------|
| `build.js` | Injeção de `SENTRY_DSN` e `SENTRY_ENVIRONMENT` |
| `config.js` | Variáveis `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `VERSION` |
| `.env.example` | Seção do Sentry adicionada |
| `.env.local` | `SENTRY_DSN` configurado |
| `firebase.json` | Removido `modules/**` do ignore |

#### Frontend (8 páginas)
| Página | Mudanças |
|--------|----------|
| `pages/configuracoes.html` | +sentry.js, +ui-helpers.js, removido toast duplicado |
| `pages/clientes.html` | +sentry.js, +ui-helpers.js, removido toast duplicado |
| `pages/painel.html` | +sentry.js, +ui-helpers.js |
| `pages/auth.html` | +sentry.js, +ui-helpers.js |
| `pages/onboarding.html` | +sentry.js, +ui-helpers.js |
| `pages/pagina-cliente.html` | +sentry.js, +ui-helpers.js |
| `pages/relatorio.html` | +sentry.js, +ui-helpers.js |
| `pages/planos.html` | +sentry.js, +ui-helpers.js, removido toast duplicado |

#### Edge Functions (4 funções)
| Função | Mudança |
|--------|---------|
| `supabase/functions/horarios-disponiveis/index.ts` | +Sentry com captureException |
| `supabase/functions/criar-agendamento/index.ts` | +try-catch geral com Sentry |
| `supabase/functions/criar-assinatura/index.ts` | +Sentry com captureException |
| `supabase/functions/webhook-asaas/index.ts` | +try-catch geral com Sentry |

#### Páginas de Cliente (atualizadas para ui-helpers)
| Página | Mudanças |
|--------|----------|
| `pages/avaliar-cliente.html` | +ui-helpers.js, removido showToast duplicado |
| `pages/cancelar-cliente.html` | +ui-helpers.js, removido showToast duplicado |
| `pages/reagendar-cliente.html` | +ui-helpers.js, removido showToast duplicado |

### 🎯 Benefícios

| Área | Antes | Depois |
|------|-------|--------|
| **Código duplicado** | ~50 linhas × 10 páginas = 500 linhas | ~260 linhas em 1 arquivo |
| **Manutenção** | 10 lugares pra mudar | 1 lugar pra mudar |
| **Monitoramento** | Nenhum | Sentry em produção |
| **UX do Toast** | Inconsistente entre páginas | Padronizado e suave |
| **Feedback de erro** | Apenas console | Dashboard Sentry com contexto |

### 🧪 Como Usar

#### Toast Notification
```javascript
// Toast simples (verde)
toast('✓ Serviço salvo!');

// Toast de erro (vermelho)
toast('Erro ao salvar', false);

// Toast com tipos específicos
toast('Atenção!', 'warning');
toast('Informação', 'info');

// Toast com botão de desfazer
toastWithUndo('Item excluído', () => {
  restaurarItem();
});

// Modal de confirmação
const confirmado = await confirmModal(
  'Excluir serviço?',
  'Esta ação não pode ser desfeita.'
);
```

#### Sentry (automático)
```javascript
// Erros são capturados automaticamente
// Para capturar manualmente:
Sentry.captureException(new Error('Erro específico'));

// Ou enviar mensagem
Sentry.captureMessage('Evento importante');

// Adicionar usuário ao contexto (após login)
Sentry.setUser({
  id: userId,
  email: user_email,
  username: user_name
});
```

### 📊 Status do Deploy

| Componente | URL | Status |
|------------|-----|--------|
| **Frontend** | https://e-agendapro.web.app | ✅ Deployado |
| **Sentry Frontend** | modules/sentry.js | ✅ Ativo |
| **UI Helpers** | modules/ui-helpers.js | ✅ Ativo |
| **Edge Functions** | Supabase | ✅ Deployadas |
| **Plano Anual** | /planos | ✅ Implementado |

### 🔗 Links Úteis

- **Sentry Dashboard**: https://sentry.io
- **Firebase Console**: https://console.firebase.google.com/project/e-agendapro/overview
- **Supabase Project**: kevqgxmcoxmzbypdjhru
- **Supabase Dashboard**: https://supabase.com/dashboard/project/kevqgxmcoxmzbypdjhru

---

## Próximas Melhorias Sugeridas

1. **Backup Automático do Banco** - Segurança contra perda de dados
2. **Undo em Ações Destrutivas** - Usar `toastWithUndo()` para excluir
3. **Busca Full-Text de Clientes** - Melhor UX para prestadores com muitos clientes
4. **Lista de Espera Inteligente** - Preencher vagas canceladas

---

**Deploy realizado em**: 2026-03-31  
**Versão**: 1.1.0  
**Ambiente**: Production
