import test from 'node:test';
import assert from 'node:assert/strict';

import { handleCancelarAgendamentoClienteRequest } from '../modules/cancelar-agendamento-cliente-handler.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

function createSupabaseMock(options = {}) {
  const agendamento = options.agendamento ?? {
    id: 'ag_1',
    prestador_id: 'prest_1',
    status: 'confirmado',
    cliente_nome: 'Maria',
    cliente_tel: '5511999999999',
    cliente_email: 'maria@teste.com',
    data_hora: '2026-04-10T12:00:00.000Z',
    servicos: { nome: 'Corte' },
    prestadores: { nome: 'Fabio', whatsapp: '5511888888888', email: 'fabio@teste.com' },
  };

  const state = { cancelled: false };

  return {
    state,
    client: {
      from(table) {
        if (table === 'agendamentos') {
          return {
            select() { return this; },
            eq() { return this; },
            neq() { return this; },
            update(payload) {
              state.cancelled = payload.status === 'cancelado';
              return this;
            },
            async single() {
              if (options.notFound) return { data: null, error: new Error('nao encontrado') };
              return { data: agendamento, error: null };
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
  const sent = [];
  const fetchCalls = [];
  return {
    supabaseMock,
    sent,
    fetchCalls,
    deps: {
      corsHeaders,
      createSupabaseClient: () => supabaseMock.client,
      getEnv: (key) => ({
        SUPABASE_URL: 'https://demo.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      })[key],
      fetchImpl: async (...args) => {
        fetchCalls.push(args);
        return { ok: true };
      },
      renderPage: () => '<html>confirmar</html>',
      enviarWhatsApp: async (...args) => { sent.push({ type: 'whatsapp', args }); },
      enviarEmail: async (...args) => { sent.push({ type: 'email', args }); },
      onUnexpectedError: overrides.onUnexpectedError,
    },
  };
}

test('cancelar-agendamento-cliente GET retorna 400 sem token', async () => {
  const { deps } = createDeps();
  const response = await handleCancelarAgendamentoClienteRequest(new Request('http://localhost/cancelar', { method: 'GET' }), deps);
  assert.equal(response.status, 400);
});

test('cancelar-agendamento-cliente POST valida token ausente', async () => {
  const { deps } = createDeps();
  const response = await handleCancelarAgendamentoClienteRequest(new Request('http://localhost/cancelar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  }), deps);
  assert.equal(response.status, 400);
});

test('cancelar-agendamento-cliente retorna 404 quando nao encontra agendamento', async () => {
  const { deps } = createDeps({ supabaseMock: createSupabaseMock({ notFound: true }) });
  const response = await handleCancelarAgendamentoClienteRequest(new Request('http://localhost/cancelar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'tok_1' }),
  }), deps);
  assert.equal(response.status, 404);
});

test('cancelar-agendamento-cliente cancela e notifica', async () => {
  const { deps, sent, fetchCalls, supabaseMock } = createDeps();
  const response = await handleCancelarAgendamentoClienteRequest(new Request('http://localhost/cancelar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'tok_1' }),
  }), deps);
  assert.equal(response.status, 200);
  assert.equal(supabaseMock.state.cancelled, true);
  assert.equal(fetchCalls.length, 1);
  assert.ok(sent.length >= 2);
});
