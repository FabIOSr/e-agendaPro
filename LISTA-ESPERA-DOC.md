# 📋 Lista de Espera Inteligente 2.6 — Documentação Completa

**Versão:** 2.6 (Atualizado em 2026-04-03)

**Mudanças na 2.6:**
- ❌ Bloqueio de entrada para o dia atual (não permite lista de espera para hoje)
- ✅ Validação de período na entrada (`podeEntrarNaListaEspera` com `periodoPreferido`)
- ✅ Módulo compartilhado `lista-espera-rules.js` centraliza todas as regras

**Mudanças na 2.5:**
- ✅ Sistema de reserva com timeout (30 min)
- ✅ Token de reserva por notificação
- ✅ Notificação em cascata (próximo da fila)
- ✅ Front bloqueia horários reservados
- ✅ Mensagem atualizada com tempo limite
- ✅ Verificação de timeout no cron (a cada 30 min)
- ✅ Ação "validar-reserva" para agendamento

---

## Visão Geral

A **Lista de Espera Inteligente** permite que clientes entrem em uma lista de espera para horários específicos e sejam notificados automaticamente quando uma vaga é liberada por cancelamento.

**Diferencial 2.0:** Cliente escolhe **como** quer ser notificado:
- **Horário exato:** Só notifica se liberar exatamente aquele horário
- **Período do dia:** Notifica se liberar qualquer horário no período (manhã/tarde/noite)
- **Qualquer horário:** Notifica se liberar qualquer horário no dia

---

## 🏗️ Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│ 1. CLIENTE ENTRA NA LISTA                                    │
│    └─ Escolhe: serviço + data + preferência                  │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. CRON JOB (*/30 * * * *)                                    │
│    ├─ Verifica reservas expiradas                             │
│    └─ Se expirou: notifica próximo da fila                    │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. VAGA LIBERADA (sem reserva ativa)                         │
│    ├─ Busca: status = 'ativa'                                │
│    ├─ Chama: horarios-disponiveis                             │
│    └─ Filtra: compatível com preferência                      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. NOTIFICA CLIENTE + RESERVA                                │
│    ├─ Gera token_reserva UUID                                │
│    ├─ Marca reservado_em = NOW()                             │
│    ├─ timeout_minutos = 30                                   │
│    └─ Mensagem: "Você tem 30 min para confirmar!"            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. CLIENTE AGENDA (via link com token)                       │
│    ├─ Front envia token + data + hora                        │
│    ├─ criar-agendamento valida token                         │
│    └─ Se válido: cria agendamento + marca status='agendada' │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. TIMEOUT (30 min)                                           │
│    ├─ Cron verifica reservas expiradas                      │
│    ├─ Se NÃO agendou: libera reserva (token=null)            │
│    └─ Notifica próximo da fila (se houver)                   │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. SE NINGUÉM DA LISTA AGENDAR                               │
│    └─ Horário liberado para agendamento comum (front)        │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Estrutura do Banco

### Tabela `lista_espera`

```sql
CREATE TABLE public.lista_espera (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculo com prestador
  prestador_id UUID NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  
  -- Dados do cliente
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_email TEXT,
  
  -- Preferência de horário/data
  data_preferida DATE NOT NULL,
  hora_preferida TIME,
  
  -- Serviço (para compatibilidade)
  servico_id UUID REFERENCES servicos(id) ON DELETE CASCADE,
  servico_nome TEXT,
  servico_duracao_min INT,
  
  -- Tipo de preferência
  tipo_preferencia TEXT DEFAULT 'exato',  -- 'exato' | 'periodo' | 'qualquer'
  periodo_preferido TEXT,                 -- 'manha' | 'tarde' | 'noite'
  
  -- Controle de status (2.1)
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'ativa',            -- 'ativa' | 'notificada' | 'agendada' | 'desistiu' | 'expirada'
  status_atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  
  -- Sistema de reserva (2.5)
  token_reserva UUID,                    -- Token para validar reserva
  reservado_em TIMESTAMPTZ,              -- Quando a reserva foi criada
  timeout_minutos INT DEFAULT 30,         -- Tempo para confirmar (padrão 30 min)
  notificado_em TIMESTAMPTZ,             -- Quando foi notificado
  
  -- Único por cliente/data/hora/serviço
  UNIQUE(cliente_telefone, data_preferida, hora_preferida, servico_id)
);
```

### Novos Campos (v2.5)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `token_reserva` | UUID | Token único gerado na notificação |
| `reservado_em` | TIMESTAMPTZ | Timestamp de quando a reserva foi criada |
| `timeout_minutos` | INT | Tempo em minutos para confirmar (padrão 30) |
| `notificado_em` | TIMESTAMPTZ | Quando o cliente foi notificado |

### Status da Entrada

| Status | Descrição | Quando usa |
|--------|-----------|------------|
| `ativa` | Aguardando vaga disponível | Cliente entrou na lista |
| `notificada` | Recebeu notificação | Vaga liberou, cliente avisado |
| `agendada` | Convertem em agendamento | Cliente agendou a vaga |
| `desistiu` | Cliente desistiu | Remoção manual (cliente ou prestador) |
| `expirada` | Data passou | Cleanup automático (> 30 dias) |

### Índices

```sql
-- Índices para busca rápida
CREATE INDEX idx_lista_espera_prestador ON lista_espera(prestador_id);
CREATE INDEX idx_lista_espera_data ON lista_espera(data_preferida);
CREATE INDEX idx_lista_espera_servico ON lista_espera(servico_id);
CREATE INDEX idx_lista_espera_status ON lista_espera(status) WHERE status IN ('ativa', 'notificada');
CREATE INDEX idx_lista_espera_cleanup ON lista_espera(data_preferida) WHERE status NOT IN ('desistiu', 'expirada');
```

### RLS (Row Level Security)

```sql
ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prestador vê sua lista de espera"
  ON lista_espera FOR SELECT TO authenticated
  USING (
    auth.uid() = (SELECT p.id FROM prestadores p WHERE p.id = prestador_id)
  );
```

**Nota:** `prestadores.id` = `auth.users.id` (mesma UUID)

---

## ⚙️ Regras de Negócio

### 1. Entrada na Lista

| Campo | Obrigatório | Validação |
|-------|-------------|-----------|
| `prestador_id` | Sim | Deve existir em `prestadores` |
| `cliente_nome` | Sim | - |
| `cliente_telefone` | Sim | Formato WhatsApp (DD + número) |
| `cliente_email` | Não | Formato email válido |
| `data_preferida` | Sim | **Apenas data futura** (bloqueado para hoje) |
| `hora_preferida` | Depende | Obrigatório se `tipo='exato'` |
| `servico_id` | Sim | Deve existir em `servicos` |
| `tipo_preferencia` | Sim | `'exato'` (padrão), `'periodo'`, `'qualquer'` |
| `periodo_preferido` | Depende | Obrigatório se `tipo='periodo'` |

> **⚠️ Regra v2.6 — Bloqueio do dia atual:** Não é permitido entrar na lista de espera para o dia de hoje (`dataPreferida === hojeBrt → false`). Isso evita notificações em cima da hora e garante antecedência mínima.

**Validação de Duplicidade:**
```sql
UNIQUE(cliente_telefone, data_preferida, hora_preferida, servico_id)
```

Um cliente **pode** entrar múltiplas vezes se:
- Data diferente
- Serviço diferente
- Horário diferente

Um cliente **não pode** entrar duas vezes para o **mesmo** serviço/data/horário.

---

### 2. Tipos de Preferência

#### **Tipo: `exato`**
Cliente quer horário específico.

```
Exemplo:
- Data: 25/04/2026
- Hora: 14:00
- Tipo: 'exato'

Notifica apenas se:
✅ Liberar exatamente 14:00
❌ Liberar 13:00 ou 15:00
```

#### **Tipo: `periodo`**
Cliente aceita qualquer horário no período.

```
Exemplo:
- Data: 25/04/2026
- Período: 'tarde' (13:00-18:00)
- Tipo: 'periodo'

Notifica se:
✅ Liberar 13:00, 14:00, 15:00, 16:00, 17:00, 18:00
❌ Liberar 09:00 (manhã)
❌ Liberar 19:00 (noite)
```

**Períodos definidos (com validação precisa de minutos):**
- `manha`: 08:00-12:59 (480-779 minutos)
- `tarde`: 13:00-18:59 (780-1139 minutos)
- `noite`: 19:00-21:59 (1140-1319 minutos)

#### **Tipo: `qualquer`**
Cliente aceita qualquer horário no dia.

```
Exemplo:
- Data: 25/04/2026
- Tipo: 'qualquer'

Notifica se:
✅ Liberar 09:00, 14:00, 18:00, etc.
```

---

### 3. Notificação (Regras Críticas)

#### **Regra 1: Data não pode estar no passado**

```typescript
const hoje = new Date().toISOString().split('T')[0]; // "2026-04-01"

if (data_preferida < hoje) {
  // ❌ Não notifica (data já passou)
  continue;
}
```

**Exemplo:**
```
Entrou para: 25/04/2026
Hoje: 26/04/2026
Status: ❌ Não notifica (data já passou)
```

---

#### **Regra 2: Antecedência mínima de 2 horas**

```typescript
const agora = new Date();
const horarioSlot = new Date(`${dataPreferida}T${horarioCompativel}`);
const diffHoras = (horarioSlot.getTime() - agora.getTime()) / (1000 * 60 * 60);

if (diffHoras < 2) {
  // ❌ Não notifica (menos de 2 horas)
  continue;
}
```

**Exemplos:**
```
Horário liberado: 25/04/2026 14:00

20/04 10:00 → ✅ Notifica (5 dias antes, 4h > 2h)
25/04 10:00 → ✅ Notifica (4h antes)
25/04 11:59 → ✅ Notifica (2h antes)
25/04 12:01 → ❌ Não notifica (1h59 antes)
25/04 13:55 → ❌ Não notifica (5 min antes)
25/04 14:05 → ❌ Não notifica (hora já passou)
```

**Por que 2 horas?**
- Tempo de deslocamento (profissionais de beleza)
- Margem para cliente se organizar
- Evita notificações inúteis ("já era")

**Como mudar:**
```typescript
// No cron-notificar-lista-espera/index.ts
if (diffHoras < 4) continue;  // 4 horas
if (diffHoras < 1) continue;  // 1 hora
```

---

#### **Regra 3: Horário não pode estar no passado (mesmo dia)**

```typescript
const agora = new Date();
const horarioSlot = new Date(`${dataPreferida}T${horarioCompativel}`);

if (horarioSlot <= agora) {
  // ❌ Não notifica (horário já passou)
  continue;
}
```

**Exemplo:**
```
Data: 25/04/2026
Horário liberado: 14:00

25/04 13:55 → ✅ Notifica (ainda dá tempo)
25/04 14:05 → ❌ Não notifica (já passou)
```

---

#### **Regra 4: Serviço deve caber no slot**

```typescript
// Chama horarios-disponiveis com servico_id do cliente
const slotsResponse = await fetch('/horarios-disponiveis', {
  body: JSON.stringify({
    prestador_id,
    data: dataPreferida,
    servico_id: cliente.servico_id  // ← Importante!
  })
});

// Filtra apenas slots que comportam o serviço
const horariosLiberados = slotsDisponiveis
  .filter(s => s.disponivel === true)
  .map(s => s.hora);
```

**Exemplo:**
```
Cliente quer: Coloração (120 min)

Slot liberado: 14:00-15:00 (60 min)
❌ Não notifica (não cabe)

Slot liberado: 14:00-16:00 (120 min)
✅ Notifica (cabe)
```

---

### 4. Trigger de Cancelamento

**Importante:** O trigger usa `AFTER UPDATE` (não `DELETE`) porque o sistema utiliza **soft delete** via status.

```sql
CREATE TRIGGER trg_marcar_lista_espera
  AFTER UPDATE ON agendamentos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelado')
  EXECUTE FUNCTION marcar_lista_espera_para_notificacao();
```

**Função:**
```sql
-- Atualiza timestamp para forçar reprocessamento pelo cron job
-- Mantém o status atual (não reseta para não perder estado)
UPDATE lista_espera
SET status_atualizado_em = NOW()
WHERE prestador_id = OLD.prestador_id
  AND data_preferida = (OLD.data_hora)::DATE
  AND status IN ('ativa', 'notificada');
```

**Quando dispara:**
- Quando um agendamento é **cancelado** (UPDATE status = 'cancelado')
- Atualiza `status_atualizado_em` para o cron job detectar
- Filtra por **mesmo prestador** e **mesma data**
- Mantém o status atual (ativa ou notificada)

---

## 🔄 Cron Job

### Configuração

**Nome:** `cron-notificar-lista-espera`

**Schedule:** `*/30 * * * *` (a cada 30 minutos)

**Por que 30 minutos?**
- Reduz custo de Edge Function (48 execuções/dia vs 288)
- **Sincronizado com timeout de 30 min**: quando cron roda, reserva expira exatamente
- Suficiente para notificar em tempo hábil
- Complementado com webhook no cancelamento (notificação imediata)

**Fluxo otimizado v2.5:**
```
14:00 → Vaga cancelou → notifica Cliente A (timeout 30 min)
14:30 → Cron roda → verifica expirações
       → Se A não confirmou: libera e notifica Cliente B
       → B tem novos 30 min (expira 15:00)
15:00 → Cron roda → verifica expirações
       → Se B não confirmou: libera e notifica Cliente C
```

**Deploy:**
```bash
supabase functions deploy cron-notificar-lista-espera --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru
```

**Configurar no Supabase:**
1. Dashboard → Edge Functions → `cron-notificar-lista-espera`
2. Settings → Schedules
3. Add Schedule → `*/30 * * * *`

---

### Cleanup Automático (Diário)

**Função:** `cleanup_lista_espera()` (na migration 23)

**Schedule:** `0 3 * * *` (3:00 AM diariamente)

**O que faz:**
```sql
-- Marca como expirada entradas > 30 dias
UPDATE lista_espera
SET status = 'expirada',
    status_atualizado_em = NOW()
WHERE data_preferida < CURRENT_DATE - INTERVAL '30 days'
  AND status IN ('ativa', 'notificada');
```

**Executar via cron:**
```bash
# Usar a função unificada lista-espera com action: cleanup
supabase functions deploy lista-espera --no-verify-jwt --project-ref kevqgxmcoxmzbypdjhru

# Agendar no Supabase:
# Edge Function: lista-espera
# Body: { action: "cleanup" }
# Schedule: 0 3 * * *
```

---

### Fluxo Interno

```typescript
// 1. Busca clientes na lista (status: ativa ou notificada)
const { data: listaEspera } = await supabase
  .from("lista_espera")
  .select("*")
  .in("status", ["ativa", "notificada"])
  .order("criado_em", { ascending: true });

// 2. Filtra data >= hoje (fuso BRT)
const hoje = getDataAtualBRT(); // Função helper com timeZone: 'America/Sao_Paulo'
const listaValida = listaEspera.filter(
  item => item.data_preferida >= hoje
);

// 3. Agrupa por prestador + data
const grupos = new Map();
for (const item of listaValida) {
  const key = `${item.prestador_id}|${item.data_preferida}`;
  grupos.get(key).push(item);
}

// 4. Para cada grupo, chama horarios-disponiveis
for (const [key, clientes] of grupos.entries()) {
  const slots = await fetch('/horarios-disponiveis', {...});

  // 5. Filtra slots disponíveis
  const horariosLiberados = slots
    .filter(s => s.disponivel)
    .map(s => s.hora);

  // 6. Obtém hora atual BRT para validações
  const agora = getDataHoraAtualBRT();

  // 7. Para cada cliente, encontra horário compatível
  for (const cliente of clientes) {
    const horarioCompativel = horariosLiberados.find(hora =>
      prefereHorario(
        cliente.tipo_preferencia,
        cliente.hora_preferida,
        cliente.periodo_preferido,
        hora
      )
    );

    if (!horarioCompativel) continue;

    // 8. Verifica antecedência >= 2h (fuso BRT)
    const horarioSlot = new Date(`${dataPreferida}T${horarioCompativel}:00-03:00`);
    const diffHoras = (horarioSlot.getTime() - agora.getTime()) / (1000 * 60 * 60);
    if (diffHoras < 2) continue;

    // 9. Verifica se horário não está no passado (BRT)
    if (horarioSlot <= agora) continue;

    // 10. Notifica!
    await enviarWhatsApp(cliente.telefone, mensagem);
    await supabase
      .from("lista_espera")
      .update({
        status: 'notificada',
        status_atualizado_em: new Date().toISOString()
      })
      .eq("id", cliente.id);
  }
}
```

---

## 📱 Mensagens

### WhatsApp (Entrada na Lista)

```
🎉 *Lista de Espera - {Prestador}*

Oi {Nome}! Você entrou na lista de espera para:

📅 Data: {dataFmt}
⏰ Preferência: {horaDisplay}
💇 Serviço: {servico_nome} ({duracao} min)

Te avisaremos se uma vaga surgir! ⏰

Você será notificado(a) até 2h antes do horário.
```

### WhatsApp (Vaga Liberou)

```
🎉 *VAGA LIBEROU!*

Oi {Nome}! Uma vaga surgiu que pode te interessar:

📅 Data: {dataFmt}
⏰ Horário: {hora}
💇 Serviço: {servico_nome}

⚡ *Corre que é por ordem de chegada!*

{link_agendamento}
```

### Email (Entrada na Lista)

```html
<div style="font-family:sans-serif;max-width:600px">
  <h2 style="color:#c8f060">🎉 Lista de Espera</h2>
  <p>Você entrou na lista de espera para <strong>{Prestador}</strong>:</p>
  <div style="background:#f2f0ea;padding:16px;border-radius:8px">
    <ul>
      <li>📅 Data: {dataFmt}</li>
      <li>⏰ Preferência: {horaDisplay}</li>
      <li>💇 Serviço: {servico_nome}</li>
    </ul>
  </div>
  <p style="color:#8a8778">
    Te avisaremos se uma vaga surgir! Notificações até 2h antes do horário.
  </p>
</div>
```

---

## 🧪 Testes

### Cenário 1: Notificação Funciona

```
1. Cliente entra na lista para 25/04 às 14:00 (tipo: exato)
2. Agendamento existente para 25/04 às 14:00 é cancelado
3. Cron job roda (até 5 min)
4. ✅ Cliente recebe WhatsApp "Vaga Liberou"
5. ✅ notificado = true, notificado_em = NOW()
```

### Cenário 2: Data Já Passou

```
1. Cliente entra na lista para 01/04 às 14:00
2. Hoje é 02/04
3. Vaga libera para 01/04 às 14:00
4. ❌ Cliente NÃO é notificado (data < hoje)
```

### Cenário 3: Menos de 2h de Antecedência

```
1. Cliente entra na lista para 25/04 às 14:00
2. Hoje é 25/04, agora são 12:30
3. Vaga libera para 25/04 às 14:00
4. ❌ Cliente NÃO é notificado (1.5h < 2h)
```

### Cenário 4: Serviço Incompatível

```
1. Cliente quer Coloração (120 min)
2. Vaga libera: 14:00-15:00 (60 min)
3. ❌ Cliente NÃO é notificado (serviço não cabe)
```

### Cenário 5: Preferência de Período

```
1. Cliente quer "tarde" (13-18h)
2. Vaga libera: 09:00 (manhã)
3. ❌ Cliente NÃO é notificado
4. Vaga libera: 15:00 (tarde)
5. ✅ Cliente É notificado
```

### Cenário 6: Bloqueio do Dia Atual (v2.6)

```
1. Cliente tenta entrar na lista para hoje (25/04)
2. Hoje é 25/04
3. ❌ Entrada bloqueada — não permite lista de espera para o dia atual
4. Mensagem: "Não é possível entrar na lista de espera para hoje."
```

---

## 📊 Métricas e Conversão

### Dashboard do Prestador

**Métricas principais:**

```sql
-- Total na lista de espera (ativas)
SELECT COUNT(*) as total_ativas
FROM lista_espera
WHERE prestador_id = 'UUID'
  AND status = 'ativa';

-- Taxa de conversão (últimos 30 dias)
SELECT 
  COUNT(*) FILTER (WHERE status = 'agendada')::NUMERIC / 
  NULLIF(COUNT(*) FILTER (WHERE status IN ('notificada', 'agendada')), 0) * 100 
  as taxa_conversao_percent
FROM lista_espera
WHERE prestador_id = 'UUID'
  AND criado_em > NOW() - INTERVAL '30 days';

-- Notificações por dia (últimos 7 dias)
SELECT 
  DATE(criado_em) as data,
  COUNT(*) FILTER (WHERE status = 'notificada') as notificadas,
  COUNT(*) FILTER (WHERE status = 'agendada') as agendadas
FROM lista_espera
WHERE prestador_id = 'UUID'
  AND criado_em > NOW() - INTERVAL '7 days'
GROUP BY DATE(criado_em)
ORDER BY data DESC;

-- Tempo médio na lista (antes de conversão)
SELECT 
  AVG(EXTRACT(EPOCH FROM (status_atualizado_em - criado_em)) / 3600) as horas_medias
FROM lista_espera
WHERE prestador_id = 'UUID'
  AND status = 'agendada';

-- Top horários de conversão
SELECT 
  hora_preferida,
  COUNT(*) FILTER (WHERE status = 'agendada') as conversoes
FROM lista_espera
WHERE prestador_id = 'UUID'
GROUP BY hora_preferida
ORDER BY conversoes DESC
LIMIT 5;
```

### KPIs Sugeridos

| Métrica | Fórmula | Objetivo |
|---------|---------|----------|
| **Taxa de Conversão** | `(agendadas / notificadas) * 100` | > 25% |
| **Tempo Médio de Resposta** | `AVG(status_atualizado_em - criado_em)` | < 24 horas |
| **Vagas Preenchidas/mês** | `COUNT(status = 'agendada')` | Crescente |
| **Churn na Lista** | `(desistiu + expirada) / total` | < 30% |

### Queries para Dashboard

```typescript
// Edge function para métricas (futuro: lista-espera-metricas)
const metrics = await supabase
  .from('lista_espera')
  .select(`
    status,
    count:status
  `)
  .eq('prestador_id', userId)
  .group('status');

// Resultado:
// { ativa: 15, notificada: 8, agendada: 23, desistiu: 5, expirada: 2 }
```

---

## 📦 Módulo `lista-espera-rules.js`

Todas as validações de entrada na lista de espera foram centralizadas no módulo compartilhado `modules/lista-espera-rules.js`.

### Funções Exportadas

| Função | Descrição | Retorna |
|--------|-----------|---------|
| `getDataAtualBRT(now)` | Data atual no fuso BRT (`America/Sao_Paulo`) | `"2026-04-03"` |
| `getMinutosAtualBRT(now)` | Minutos desde meia-noite em BRT | `1020` (17:00) |
| `horaParaMinutos(hora)` | Converte `"HH:MM"` para minutos | `840` (14:00) |
| `podeEntrarNaListaEspera({...})` | Valida entrada na lista de espera | `true` / `false` |

### Parâmetros de `podeEntrarNaListaEspera`

```javascript
const resultado = podeEntrarNaListaEspera({
  dataPreferida,        // "2026-04-05"
  tipoPreferencia,      // "exato" | "periodo" | "qualquer"
  horaPreferida,        // "14:00" (obrigatório se tipo="exato")
  periodoPreferido,     // "manha" | "tarde" | "noite" (obrigatório se tipo="periodo")
  disponibilidades,     // [{ hora_inicio: "08:00", hora_fim: "18:00" }]
  now,                  // Date() opcional para testes
});
```

### Regras de Validação (v2.6)

| Regra | Condição | Resultado |
|-------|----------|-----------|
| Data ausente | `!dataPreferida` | ❌ `false` |
| **Dia atual** | `dataPreferida === hojeBrt` | ❌ `false` (bloqueado) |
| Data passada | `dataPreferida < hojeBrt` | ❌ `false` |
| Dia futuro | `dataPreferida > hojeBrt` | ✅ `true` |
| **Exato hoje** | `tipo="exato"` + hoje + hora dentro da disponibilidade e > agora | ❌ `false` (bloqueado pelo dia) |
| **Período hoje** | `tipo="periodo"` + hoje | ❌ `false` (bloqueado pelo dia) |
| **Qualquer hoje** | `tipo="qualquer"` + hoje | ❌ `false` (bloqueado pelo dia) |
| Período futuro sem disponibilidade | `tipo="periodo"` + futuro + sem cobertura | ❌ `false` |
| Período futuro com disponibilidade | `tipo="periodo"` + futuro + com cobertura | ✅ `true` |

### Períodos e Faixas Horárias

| Período | Faixa | Minutos |
|---------|-------|---------|
| `manha` | 08:00–12:59 | 480–779 |
| `tarde` | 13:00–18:59 | 780–1139 |
| `noite` | 19:00–21:59 | 1140–1319 |

### Exemplo de Uso

```javascript
import { podeEntrarNaListaEspera, getDataAtualBRT } from './modules/lista-espera-rules.js';

// Futuro com período válido → ✅
podeEntrarNaListaEspera({
  dataPreferida: '2026-04-05',
  tipoPreferencia: 'tarde',
  periodoPreferido: 'tarde',
  disponibilidades: [{ hora_inicio: '08:00', hora_fim: '18:00' }],
}); // true

// Hoje → ❌ (bloqueado)
podeEntrarNaListaEspera({
  dataPreferida: getDataAtualBRT(),
  tipoPreferencia: 'exato',
  horaPreferida: '14:00',
  disponibilidades: [{ hora_inicio: '08:00', hora_fim: '18:00' }],
}); // false
```

---

## 🛠️ Troubleshooting

### Problema: Cliente não está sendo notificado

**Verificar:**
1. `status IN ('ativa', 'notificada')` no banco?
2. `data_preferida >= hoje` (fuso BRT)?
3. Horário tem >= 2h de antecedência?
4. Serviço cabe no slot disponível?
5. Preferência de horário é compatível?
6. Horário não está no passado (BRT)?

**Debug:**
```bash
# Logs do cron job
supabase functions logs cron-notificar-lista-espera
```

---

### Problema: Notificação chegando em cima da hora

**Causa:** Antecedência mínima configurada errada ou fuso horário incorreto.

**Solução:**
```typescript
// Verificar no cron-notificar-lista-espera/index.ts
const agora = getDataHoraAtualBRT(); // Usar fuso BRT
const horarioSlot = new Date(`${dataPreferida}T${horarioCompativel}:00-03:00`);
const diffHoras = (horarioSlot.getTime() - agora.getTime()) / (1000 * 60 * 60);
if (diffHoras < 2) continue;  // Deve ser 2 (horas)
```

---

### Problema: Cliente notificado para data passada

**Causa:** Filtro de data usando UTC em vez de BRT.

**Solução:**
```typescript
// Verificar filtro
const hoje = getDataAtualBRT(); // Usar fuso BRT
const listaValida = listaEspera.filter(
  item => item.data_preferida >= hoje  // Deve ser >=
);
```

---

## 📊 Métricas (Futuro)

**Dashboard do Prestador:**
- Total na lista de espera
- Notificados hoje
- Agendados da lista (conversão)
- Taxa de conversão (%)

**Alertas:**
- Cliente na lista há > 7 dias sem notificação
- Taxa de conversão < 10%

---

## 🔐 Segurança

### RLS (Row Level Security)

```sql
-- Apenas o prestador pode ver sua própria lista
CREATE POLICY "Prestador vê sua lista de espera"
  ON lista_espera FOR SELECT TO authenticated
  USING (
    auth.uid() = (SELECT p.id FROM prestadores p WHERE p.id = prestador_id)
  );
```

### Grants

```sql
GRANT INSERT ON lista_espera TO authenticated;
GRANT UPDATE ON lista_espera TO authenticated;
```

**Nota:** Cliente pode entrar na lista, mas não pode ver/editar outros registros.

---

## 📝 Migration 23 Completa (Atualizada 2.1.1)

```sql
-- migration 23: Lista Espera Inteligente 2.1.1
-- Atualizações: status, trigger UPDATE, cleanup automático, correção BRT

DROP TABLE IF EXISTS public.lista_espera CASCADE;

CREATE TABLE public.lista_espera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_email TEXT,
  data_preferida DATE NOT NULL,
  hora_preferida TIME,
  servico_id UUID REFERENCES servicos(id) ON DELETE CASCADE,
  servico_nome TEXT,
  servico_duracao_min INT,
  tipo_preferencia TEXT DEFAULT 'exato',
  periodo_preferido TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'ativa',            -- 'ativa' | 'notificada' | 'agendada' | 'desistiu' | 'expirada'
  status_atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_telefone, data_preferida, hora_preferida, servico_id)
);

COMMENT ON COLUMN lista_espera.data_preferida IS
'Data de interesse. Notificações só ocorrem até esta data (com min. 2h antecedência).';

COMMENT ON COLUMN lista_espera.status IS
'Status da entrada: ativa (aguardando vaga), notificada (recebeu WhatsApp), agendada (convertida), desistiu (cliente cancelou), expirada (data passou)';

-- Índices
CREATE INDEX idx_lista_espera_prestador ON lista_espera(prestador_id);
CREATE INDEX idx_lista_espera_data ON lista_espera(data_preferida);
CREATE INDEX idx_lista_espera_servico ON lista_espera(servico_id);
CREATE INDEX idx_lista_espera_status ON lista_espera(status) WHERE status IN ('ativa', 'notificada');
CREATE INDEX idx_lista_espera_cleanup ON lista_espera(data_preferida) WHERE status NOT IN ('desistiu', 'expirada');

-- RLS
ALTER TABLE lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prestador vê sua lista de espera"
  ON lista_espera FOR SELECT TO authenticated
  USING (auth.uid() = (SELECT p.id FROM prestadores p WHERE p.id = prestador_id));

CREATE POLICY "Prestador gerencia sua lista de espera"
  ON lista_espera FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT p.id FROM prestadores p WHERE p.id = prestador_id));

CREATE POLICY "Cliente entra na lista de espera"
  ON lista_espera FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Trigger: marca após cancelamento de agendamento (UPDATE status)
CREATE OR REPLACE FUNCTION marcar_lista_espera_para_notificacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Dispara apenas em cancelamento via UPDATE de status
  IF TG_OP = 'UPDATE' AND OLD.status != 'cancelado' AND NEW.status = 'cancelado' THEN
    -- Atualiza timestamp para forçar reprocessamento pelo cron job
    UPDATE lista_espera
    SET status_atualizado_em = NOW()
    WHERE prestador_id = OLD.prestador_id
      AND data_preferida = (OLD.data_hora)::DATE
      AND status IN ('ativa', 'notificada');
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_marcar_lista_espera ON agendamentos;
CREATE TRIGGER trg_marcar_lista_espera
  AFTER UPDATE ON agendamentos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelado')
  EXECUTE FUNCTION marcar_lista_espera_para_notificacao();

-- Cleanup automático (diário)
CREATE OR REPLACE FUNCTION cleanup_lista_espera()
RETURNS void AS $$
BEGIN
  -- Marca como expirada entradas com data > 30 dias no passado
  UPDATE lista_espera
  SET status = 'expirada',
      status_atualizado_em = NOW()
  WHERE data_preferida < CURRENT_DATE - INTERVAL '30 days'
    AND status IN ('ativa', 'notificada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT INSERT ON lista_espera TO authenticated;
GRANT UPDATE ON lista_espera TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_lista_espera TO service_role;
```

---

## 🚀 Deploy Checklist

- [ ] Migration 23 aplicada no Supabase (com status e trigger UPDATE)
- [ ] Função cleanup_lista_espera() criada
- [ ] Edge function `lista-espera` deployada (unificada)
- [ ] Edge function `cron-notificar-lista-espera` deployada
- [ ] Functions legadas removidas (`notificar-lista-espera`, `entrada-lista-espera`)
- [ ] Cron job configurado: `*/30 * * * *` (30 min)
- [ ] Cron job cleanup configurado: `0 3 * * *` (diário 3 AM)
- [ ] Teste de entrada na lista (3 tipos de preferência)
- [ ] Teste de cancelamento → trigger dispara
- [ ] Teste de notificação (antecedência mínima 2h, fuso BRT)
- [ ] Teste de data passada (não notifica, fuso BRT)
- [ ] Teste de horário passado (não notifica, fuso BRT)
- [ ] Teste de período (manhã/tarde/noite com minutos)
- [ ] Teste de saída da lista (status = desistiu)
- [ ] WhatsApp Evolution API configurado
- [ ] Email SendGrid configurado
- [ ] Métricas de conversão validadas

---

**Última atualização:** 2026-04-02
**Versão:** 2.1.1
**Status:** ✅ Implementado
**Mudanças 2.1.1:** correção fuso BRT, validação precisa de períodos, trigger otimizado, remoção de legado
**Mudanças 2.1:** status, trigger UPDATE, cleanup, função unificada, cron 30min, métricas
