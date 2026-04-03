import test from 'node:test';
import assert from 'node:assert/strict';

import { handleReagendarClienteRequest } from '../modules/reagendar-cliente-handler.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
};

function createSupabaseMock(options = {}) {
  const state = {
    updates: [],
    notifications: [],
  };

  const agendamento = options.agendamento ?? {
    id: 'ag_1',
    prestador_id: 'prest_1',
    servico_id: 'srv_1',
    cancel_token: 'tok_1',
    cliente_nome: 'Maria',
    cliente_tel: '5511999999999',
    cliente_email: 'maria@teste.com',
    servicos: { nome: 'Corte', duracao_min: 60 },
    prestadores: { nome: 'Fabio', slug: 'fabio', whatsapp: '5511888888888', email: 'fabio@teste.com' },
  };

  return {
    state,
    client: {
      from(table) {
        if (table === 'agendamentos') {
          return {
            select() { return this; },
            eq(column, value) {
              this.lastEq = { column, value };
              return this;
            },
            neq() { return this; },
            gte() { return this; },
            lt() { return Promise.resolve({ count: options.conflictCount ?? 0 }); },
            async single() {
              if (this.lastEq?.column === 'cancel_token') return { data: options.agendamentoFound === false ? null : agendamento };
              if (this.lastEq?.column === 'id') return { data: { ...agendamento, data_hora: options.updatedDate ?? '2026-04-10T12:00:00.000Z' } };
              return { data: agendamento };
            },
            update(payload) {
              state.updates.push(payload);
              return {
                eq() {
                  return Promise.resolve({ data: { ...agendamento, ...payload }, error: null });
                },
              };
            },
          };
        }

        if (table === 'preferencias_notificacao') {
          return {
            select() { return this; },
            eq() { return this; },
            async single() { return { data: options.prefs ?? null }; },
          };
        }

        throw new Error(`Tabela nao mockada: ${table}`);
      },
    },
  };
}

function createDeps(overrides = {}) {
  const supabaseMock = overrides.supabaseMock ?? createSupabaseMock();
  const fetchCalls = [];
  const sent = [];

  return {
    supabaseMock,
    sent,
    fetchCalls,
    deps: {
      appUrl: 'https://app.test',
      corsHeaders: CORS,
      createSupabaseClient: () => supabaseMock.client,
      getEnv: (key) => ({
        SUPABASE_URL: 'https://demo.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      })[key],
      fetchImpl: overrides.fetchImpl ?? (async (...args) => {
        fetchCalls.push(args);
        return { async json() { return { slots: [] }; } };
      }),
      renderPage: overrides.renderPage ?? (() => '<html>ok</html>'),
      enviarWhatsApp: async (...args) => { sent.push({ type: 'whatsapp', args }); },
      enviarEmail: async (...args) => { sent.push({ type: 'email', args }); },
      onUnexpectedError: overrides.onUnexpectedError,
      getToday: () => '2026-04-03',
    },
  };
}

test('reagendar-cliente GET retorna 400 sem token', async () => {
  const { deps } = createDeps();
  const response = await handleReagendarClienteRequest(new Request('http://localhost/reagendar', { method: 'GET' }), deps);
  assert.equal(response.status, 400);
});

test('reagendar-cliente POST valida campos obrigatorios', async () => {
  const { deps } = createDeps();
  const response = await handleReagendarClienteRequest(new Request('http://localhost/reagendar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'tok_1' }),
  }), deps);
  assert.equal(response.status, 400);
});

test('reagendar-cliente bloqueia horario em conflito', async () => {
  const { deps } = createDeps({ supabaseMock: createSupabaseMock({ conflictCount: 1 }) });
  const response = await handleReagendarClienteRequest(new Request('http://localhost/reagendar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'tok_1', data: '2026-04-10', hora: '09:00' }),
  }), deps);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { erro: 'Horario nao disponivel. Escolha outro.' });
});

test('reagendar-cliente atualiza agendamento e notifica', async () => {
  const { deps, sent, fetchCalls, supabaseMock } = createDeps();
  const response = await handleReagendarClienteRequest(new Request('http://localhost/reagendar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'tok_1', data: '2026-04-10', hora: '09:00' }),
  }), deps);
  assert.equal(response.status, 200);
  assert.equal(fetchCalls.length, 1);
  assert.equal(supabaseMock.state.updates.length, 1);
  assert.ok(sent.length >= 2);
});
