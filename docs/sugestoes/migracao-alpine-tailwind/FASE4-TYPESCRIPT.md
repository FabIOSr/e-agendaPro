# 🔷 FASE 4: Migrar para TypeScript

> Guia completo para adicionar type safety aos módulos JavaScript

---

## 📋 Objetivos da Fase

1. Criar estrutura de tipos compartilhada
2. Migrar módulos core para TypeScript
3. Migrar handlers para TypeScript
4. Atualizar testes para TypeScript

**Duração estimada:** 5-7 dias

---

## 🚀 Conceitos do TypeScript

### Tipos Básicos

```typescript
// Primitivos
let nome: string = "João";
let idade: number = 30;
let ativo: boolean = true;
let dados: any = { /* qualquer coisa */ };

// Arrays
let numeros: number[] = [1, 2, 3];
let nomes: Array<string> = ["Ana", "Bia"];

// Objetos
let pessoa: { nome: string; idade: number } = {
  nome: "João",
  idade: 30
};

// Union types
let id: string | number = "abc123"; // ou 123

// Nullable
let telefone: string | null = null;

// Enums
enum Plano {
  Free = "free",
  Pro = "pro"
}
```

### Interfaces vs Types

```typescript
// Interface - extensível
interface Prestador {
  id: string;
  nome: string;
  plano: Plano;
}

interface PrestadorComEmail extends Prestador {
  email: string;
}

// Type - mais flexível
type Servico = {
  id: string;
  nome: string;
  duracao: number;
};

type ServicoComPreco = Servico & {
  preco: number;
};

// Utility types
type PrestadorCreate = Omit<Prestador, 'id' | 'created_at'>;
type PrestadorUpdate = Partial<Prestador>;
```

---

## 📦 Estrutura de Tipos

### modules/types/index.ts

```typescript
// ============================================================================
// TIPOS PRINCIPAIS
// ============================================================================

export interface Prestador {
  id: string;
  nome: string;
  slug: string;
  email: string;
  bio?: string;
  foto_url?: string;
  whatsapp?: string;
  cpf_cnpj?: string;
  plano: 'free' | 'pro';
  plano_valido_ate?: string;
  trial_usado: boolean;
  trial_ends_at?: string;
  intervalo_slot: number;
  asaas_customer_id?: string;
  asaas_sub_id?: string;
  assinatura_periodicidade?: 'MONTHLY' | 'YEARLY';
  created_at: string;
  updated_at: string;
}

export interface Servico {
  id: string;
  prestador_id: string;
  nome: string;
  duracao_min: number;
  preco?: number;
  ativo: boolean;
  created_at: string;
}

export interface Agendamento {
  id: string;
  prestador_id: string;
  servico_id: string;
  data_hora: string;
  cliente_nome: string;
  cliente_tel: string;
  cliente_email?: string;
  status: 'confirmado' | 'concluido' | 'cancelado';
  cancel_token: string;
  google_event_id?: string;
  avaliacao_solicitada: boolean;
  created_at: string;
}

export interface Disponibilidade {
  id: string;
  prestador_id: string;
  dia_semana: number; // 0=Dom .. 6=Sáb
  hora_inicio: string; // "HH:MM"
  hora_fim: string;
}

export interface Bloqueio {
  id: string;
  prestador_id: string;
  inicio: string; // ISO 8601
  fim: string; // ISO 8601
  motivo?: string;
}

export interface BloqueioRecorrente {
  id: string;
  prestador_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  motivo?: string;
}

export interface Slot {
  hora: string; // "HH:MM"
  disponivel: boolean;
  motivo_bloqueio?: string;
}

export interface Pagamento {
  id: string;
  prestador_id: string;
  asaas_payment_id: string;
  evento: string;
  valor?: number;
  billing_type?: string;
  data_evento: string;
  payload: Record<string, unknown>;
}

export interface Avaliacao {
  id: string;
  agendamento_id: string;
  prestador_id: string;
  cliente_nome: string;
  nota: number; // 1-5
  comentario?: string;
  created_at: string;
}

// ============================================================================
// TIPOS DE API
// ============================================================================

export interface CreateAgendamentoParams {
  prestador_id: string;
  servico_id: string;
  cliente_nome: string;
  cliente_tel: string;
  cliente_email?: string;
  data_hora: string;
  token_reserva?: string;
}

export interface CreateAgendamentoResultSuccess {
  ok: true;
  agendamento_id: string;
}

export interface CreateAgendamentoResultError {
  ok: false;
  erro: string;
  codigo: string;
}

export type CreateAgendamentoResult =
  | CreateAgendamentoResultSuccess
  | CreateAgendamentoResultError;

export interface ErrorResponse {
  erro: string;
  codigo?: string;
  detalhes?: unknown;
}

export interface SuccessResponse<T = unknown> {
  ok: true;
  data: T;
}

// ============================================================================
// TIPOS DE SUPABASE
// ============================================================================

export type SupabaseResponse<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; code: string } };

export interface SupabaseClient {
  from: (table: string) => SupabaseQueryBuilder;
  auth: {
    signInWithPassword: (params: { email: string; password: string }) => Promise<SupabaseResponse<{ user: { id: string } }>>;
    signOut: () => Promise<void>;
    getSession: () => Promise<SupabaseResponse<{ session: { access_token: string } }>>;
  };
}

export interface SupabaseQueryBuilder {
  select: (columns?: string) => SupabaseQueryBuilder;
  insert: (data: unknown) => Promise<SupabaseResponse<unknown>>;
  update: (data: unknown) => SupabaseQueryBuilder;
  delete: () => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  gte: (column: string, value: unknown) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  single: () => Promise<SupabaseResponse<unknown>>;
  maybeSingle: () => Promise<SupabaseResponse<unknown>>;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isPrestador(data: unknown): data is Prestador {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'nome' in data &&
    'plano' in data &&
    'email' in data
  );
}

export function isAgendamento(data: unknown): data is Agendamento {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'prestador_id' in data &&
    'data_hora' in data &&
    'status' in data
  );
}

export function isSuccessResponse<T>(data: unknown): data is SuccessResponse<T> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'ok' in data &&
    data.ok === true
  );
}

export function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'erro' in data
  );
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// Extrai tipos de uma Promise
export type Awaited<T> = T extends Promise<infer U> ? U : T;

// Extrai o tipo de retorno de uma função
export type ReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;
```

---

## 🔄 Migração de Módulos

### scheduling-rules.js → scheduling-rules.ts

**ANTES:**
```javascript
export function getAgoraBRT(now = new Date()) {
  // ...
}

export function generateSlots(params) {
  // params.data, params.disponibilidades, etc
  // ...
}
```

**DEPOIS:**
```typescript
import type { Slot, Disponibilidade, Agendamento, Bloqueio } from './types/index.js';

export function getAgoraBRT(now: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value;

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
}

export interface GenerateSlotsParams {
  data: string;
  disponibilidades: Pick<Disponibilidade, 'hora_inicio' | 'hora_fim'>[];
  duracaoServico: number;
  agendamentos: Array<{
    data_hora: string;
    duracao_min: number;
    intervalo_min?: number;
  }>;
  bloqueios: Array<{
    inicio: string;
    fim: string;
    motivo?: string;
  }>;
  intervaloSlot?: number;
  intervaloMin?: number;
  bloqueiosRecorrentes?: Array<{
    dia_semana: number;
    hora_inicio: string;
    hora_fim: string;
    motivo?: string;
  }>;
  now?: Date;
  antecedenciaMinimaMin?: number;
}

export function generateSlots(params: GenerateSlotsParams): Slot[] {
  const {
    data,
    disponibilidades,
    duracaoServico,
    agendamentos,
    bloqueios,
    intervaloSlot = 30,
    intervaloMin = 0,
    bloqueiosRecorrentes = [],
    now = getAgoraBRT(),
    antecedenciaMinimaMin = 60,
  } = params;

  const slots: Slot[] = [];
  const cadencia = intervaloSlot;
  const duracaoOcupada = duracaoServico + intervaloMin;

  // ... resto da lógica

  return slots;
}
```

### auth-session.js → auth-session.ts

**ANTES:**
```javascript
export async function getPrestador(userId) {
  const { data, error } = await supabase
    .from('prestadores')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw new Error('Perfil não encontrado');
  return data;
}
```

**DEPOIS:**
```typescript
import type { Prestador, PlanoBadge, TrialStatus } from './types/index.js';
import { supabase } from './config/supabase.js';

export async function getPrestador(userId: string): Promise<Prestador> {
  const { data, error } = await supabase
    .from('prestadores')
    .select(`
      id, nome, slug, bio, foto_url, whatsapp, email,
      plano, plano_valido_ate, trial_usado, trial_ends_at,
      asaas_customer_id, asaas_sub_id,
      created_at
    `)
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error('Perfil não encontrado: ' + error.message);
  }

  if (!data) {
    throw new Error('Prestador não encontrado');
  }

  return data as Prestador;
}

export async function requireAuth(redirectTo?: string): Promise<{
  user: { id: string; email: string };
  prestador: Prestador;
  session: { access_token: string };
}> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const dest = redirectTo || window.location.pathname;
    window.location.href = `/auth?next=${encodeURIComponent(dest)}`;
    throw new Error('Não autenticado');
  }

  const prestador = await getPrestador(session.user.id);
  return {
    user: session.user,
    prestador,
    session
  };
}

export function checkPlano(prestador: Prestador, planoNecessario: 'free' | 'pro'): boolean {
  if (planoNecessario === 'free') return true;

  if (prestador.trial_ends_at) {
    const trialEnd = new Date(prestador.trial_ends_at);
    if (trialEnd > new Date()) return true;
  }

  if (prestador.plano !== 'pro') return false;

  if (prestador.plano_valido_ate) {
    const expira = new Date(prestador.plano_valido_ate);
    const gracePeriod = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() > expira.getTime() + gracePeriod) return false;
  }

  return true;
}

export function getTrialStatus(prestador: Prestador): TrialStatus | null {
  if (!prestador.trial_ends_at) return null;

  const trialEnd = new Date(prestador.trial_ends_at);
  const now = new Date();

  if (trialEnd <= now) return null;

  const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return {
    active: true,
    ends_at: trialEnd,
    days_remaining: daysRemaining,
  };
}

export function getPlanoBadge(prestador: Prestador): PlanoBadge {
  const trial = getTrialStatus(prestador);

  if (trial && trial.active) {
    return {
      texto: trial.days_remaining === 1 ? 'Trial (1 dia)' : `Trial (${trial.days_remaining} dias)`,
      classe: 'trial',
      is_pro: true,
      is_trial: true,
      days_remaining: trial.days_remaining,
      ends_at: trial.ends_at,
    };
  }

  const isPro = checkPlano(prestador, 'pro');

  return {
    texto: isPro ? 'Pro' : 'Grátis',
    classe: isPro ? 'pro' : 'free',
    is_pro: isPro,
    is_trial: false,
  };
}
```

### Handlers Tipados

**criar-agendamento-handler.ts:**
```typescript
import type { CreateAgendamentoParams, CreateAgendamentoResult, ErrorResponse } from '../types/index.js';

export interface HandlerDeps {
  cors: Record<string, string>;
  createSupabaseClient: (url: string, key: string) => SupabaseClient;
  getEnv: (key: string) => string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  onUnexpectedError?: (error: unknown, context: Record<string, unknown>) => void;
}

export async function handleCriarAgendamentoRequest(
  req: Request,
  deps: HandlerDeps
): Promise<Response> {
  const { cors, createSupabaseClient, getEnv, fetchImpl = fetch, now = () => new Date(), onUnexpectedError } = deps;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const errorContext: Record<string, unknown> = {
    method: req.method,
    content_type: req.headers.get('content-type'),
    url: req.url,
  };

  try {
    let body: Partial<CreateAgendamentoParams>;
    try {
      body = await req.json() as Partial<CreateAgendamentoParams>;
    } catch {
      return Response.json({ erro: 'Body inválido' } as ErrorResponse, { status: 400, headers: cors });
    }

    const {
      prestador_id,
      servico_id,
      cliente_nome,
      cliente_tel,
      cliente_email,
      data_hora,
      token_reserva,
    } = body;

    // Validação
    if (!prestador_id || !servico_id || !cliente_nome || !cliente_tel || !data_hora) {
      return Response.json(
        { erro: 'Campos obrigatórios: prestador_id, servico_id, cliente_nome, cliente_tel, data_hora' },
        { status: 400, headers: cors }
      );
    }

    const dataHoraDate = new Date(data_hora);
    if (Number.isNaN(dataHoraDate.getTime())) {
      return Response.json(
        { erro: 'data_hora inválido. Use ISO 8601' },
        { status: 400, headers: cors }
      );
    }

    if (dataHoraDate < now()) {
      return Response.json(
        { erro: 'Não é possível agendar no passado' },
        { status: 400, headers: cors }
      );
    }

    // ... resto da lógica

    return Response.json(
      { ok: true, agendamento_id: agendamentoId } as CreateAgendamentoResult,
      { status: 200, headers: cors }
    );

  } catch (err) {
    onUnexpectedError?.(err, errorContext);
    console.error('Erro inesperado:', err);
    return Response.json(
      { erro: 'Erro interno no servidor' } as ErrorResponse,
      { status: 500, headers: cors }
    );
  }
}
```

---

## 🧪 Tipagem de Testes

### Antes (JavaScript)

```javascript
test('slots no mesmo dia respeitam antecedência mínima', () => {
  const slots = generateSlots({
    data: '2026-04-03',
    disponibilidades: [{ hora_inicio: '11:00', hora_fim: '14:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 3, 11, 28),
  });

  const disponiveis = slots.filter((s) => s.disponivel).map((s) => s.hora);
  assert.deepEqual(disponiveis, ['12:30', '13:00', '13:30']);
});
```

### Depois (TypeScript)

```typescript
import { generateSlots } from '../modules/scheduling-rules.js';
import type { Slot } from '../modules/types/index.js';
import assert from 'node:assert/strict';

function brt(ano: number, mes: number, dia: number, hora: number, minuto: number = 0): Date {
  return new Date(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-03:00`);
}

test('slots no mesmo dia respeitam antecedência mínima', () => {
  const slots: Slot[] = generateSlots({
    data: '2026-04-03',
    disponibilidades: [{ hora_inicio: '11:00', hora_fim: '14:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 3, 11, 28),
  });

  const disponiveis = slots.filter((s) => s.disponivel).map((s) => s.hora);
  assert.deepEqual(disponiveis, ['12:30', '13:00', '13:30']);
});
```

---

## 📝 Padrões TypeScript Recomendados

### 1. Strict Types

```typescript
// ❌ Evitar
function processar(data: any) { }

// ✅ Usar
function processar(data: Agendamento) { }

// ✅ Ou genérico
function processar<T extends Agendamento>(data: T): T {
  return data;
}
```

### 2. Type Guards

```typescript
// Validar tipos em runtime
function isValidSlot(data: unknown): data is Slot {
  return (
    typeof data === 'object' &&
    data !== null &&
    'hora' in data &&
    'disponivel' in data &&
    typeof data.hora === 'string' &&
    typeof data.disponivel === 'boolean'
  );
}

// Usar
if (isValidSlot(data)) {
  // TypeScript sabe que data é Slot
  console.log(data.hora);
}
```

### 3. Utility Types

```typescript
// Partial - todas as propriedades opcionais
type UpdatePrestador = Partial<Prestador>;

// Pick - apenas algumas propriedades
type PrestadorPublic = Pick<Prestador, 'id' | 'nome' | 'slug'>;

// Omit - exclui propriedades
type PrestadorCreate = Omit<Prestador, 'id' | 'created_at'>;

// Required - torna obrigatórias
type PrestadorRequired = Required<Nullable<Prestador>>;

// Readonly - não pode modificar
type ReadonlyPrestador = Readonly<Prestador>;
```

### 4. Generic Types

```typescript
// Resposta de API
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  erro?: string;
}

// Usar
type PrestadorResponse = ApiResponse<Prestador>;
type AgendamentosResponse = ApiResponse<Agendamento[]>;

// Função genérica
async function fetchApi<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url);
  const data = await response.json();
  return data as ApiResponse<T>;
}
```

---

## ✅ Checklist

### Tipos

- [ ] `modules/types/index.ts` criado
- [ ] Interfaces principais definidas
- [ ] Type guards criados
- [ ] Utility types exportados

### Módulos

- [ ] `scheduling-rules.ts` migrado
- [ ] `auth-session.ts` migrado
- [ ] `agendamento-response.ts` migrado
- [ ] `asaas-webhook-rules.ts` migrado
- [ ] `lista-espera-rules.ts` migrado

### Handlers

- [ ] `criar-agendamento-handler.ts` migrado
- [ ] `webhook-asaas-handler.ts` migrado
- [ ] `cancelar-handler.ts` migrado
- [ ] `reagendar-handler.ts` migrado

### Testes

- [ ] Renomeados para `.ts`
- [ ] Imports atualizados
- [ ] Tipos adicionados
- [ ] `npm test` passando

### Validação

- [ ] `tsc --noEmit` sem erros
- [ ] IntelliSense funcionando
- [ ] Build de produção funcionando

---

## 📚 Próximos Passos

Após completar esta fase, você está pronto para:

1. **FASE 5:** Migrar painel admin
2. Completar migração de frontend
3. Deploy para produção

Veja [FASE5-ADMIN.md](./FASE5-ADMIN.md)

---

**Tempo estimado:** 40-56 horas (5-7 dias)
**Dificuldade:** Média-Alta
**Pré-requisitos:** FASE 3 completada

**Finalizado em:** ___/___/___
**Por:** ____________
