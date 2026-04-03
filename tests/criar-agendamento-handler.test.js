import test from 'node:test';
import assert from 'node:assert/strict';

import { handleCriarAgendamentoRequest } from '../modules/criar-agendamento-handler.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
};

function createRequest(body, overrides = {}) {
  return new Request('http://localhost/criar-agendamento', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(overrides.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...overrides,
  });
}

function createSupabaseMock(options = {}) {
  const state = {
    rpcCalls: [],
    upserts: [],
  };

  return {
    state,
    client: {
      async rpc(name, payload) {
        state.rpcCalls.push({ name, payload });
        return options.rpcResult ?? { data: { ok: true, agendamento_id: 'ag_1' }, error: null };
      },
      from(table) {
        assert.equal(table, 'clientes');
        return {
          async upsert(payload, config) {
            state.upserts.push({ payload, config });
            return options.upsertResult ?? { error: null };
          },
        };
      },
    },
  };
}

function createDeps(overrides = {}) {
  const supabaseMock = overrides.supabaseMock ?? createSupabaseMock();
  const fetchCalls = [];

  return {
    supabaseMock,
    fetchCalls,
    deps: {
      cors: CORS,
      createSupabaseClient: () => supabaseMock.client,
      getEnv: (key) => ({
        SUPABASE_URL: 'https://demo.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        SUPABASE_ANON_KEY: 'anon-key',
      })[key],
      fetchImpl: overrides.fetchImpl ?? (async (...args) => {
        fetchCalls.push(args);
        return {
          async json() {
            return { sincronizado: true, evento_id: 'evt_1' };
          },
        };
      }),
      now: overrides.now ?? (() => new Date('2026-04-03T12:00:00.000Z')),
      onUnexpectedError: overrides.onUnexpectedError,
    },
  };
}

test('criar-agendamento retorna 400 para body invalido', async () => {
  const { deps } = createDeps();
  const req = new Request('http://localhost/criar-agendamento', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{invalido',
  });

  const response = await handleCriarAgendamentoRequest(req, deps);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { erro: 'Body invalido' });
});

test('criar-agendamento retorna 400 para campos obrigatorios ausentes', async () => {
  const { deps } = createDeps();
  const response = await handleCriarAgendamentoRequest(createRequest({ prestador_id: 'p1' }), deps);

  assert.equal(response.status, 400);
  assert.match((await response.json()).erro, /Campos obrigatorios/);
});

test('criar-agendamento retorna 400 para data no passado', async () => {
  const { deps } = createDeps();
  const response = await handleCriarAgendamentoRequest(createRequest({
    prestador_id: 'p1',
    servico_id: 's1',
    cliente_nome: 'Maria',
    cliente_tel: '5511999999999',
    data_hora: '2026-04-03T08:00:00.000Z',
  }), deps);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { erro: 'Nao e possivel agendar no passado' });
});

test('criar-agendamento retorna erro normalizado da RPC', async () => {
  const supabaseMock = createSupabaseMock({
    rpcResult: {
      data: { ok: false, erro: 'limite_atingido', http_status: 403, limite: 3, count: 3 },
      error: null,
    },
  });
  const { deps, fetchCalls } = createDeps({ supabaseMock });

  const response = await handleCriarAgendamentoRequest(createRequest({
    prestador_id: 'p1',
    servico_id: 's1',
    cliente_nome: 'Maria',
    cliente_tel: '5511999999999',
    data_hora: '2026-04-03T15:00:00.000Z',
  }), deps);

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { erro: 'limite_atingido', limite: 3, count: 3 });
  assert.equal(fetchCalls.length, 0);
});

test('criar-agendamento retorna sucesso e dispara sync do Google Calendar', async () => {
  const supabaseMock = createSupabaseMock();
  const { deps, fetchCalls } = createDeps({ supabaseMock });

  const response = await handleCriarAgendamentoRequest(createRequest({
    prestador_id: 'p1',
    servico_id: 's1',
    cliente_nome: ' Maria ',
    cliente_tel: ' 5511999999999 ',
    cliente_email: '  teste@exemplo.com ',
    data_hora: '2026-04-03T15:00:00.000Z',
  }), deps);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, agendamento_id: 'ag_1' });
  assert.equal(fetchCalls.length, 1);
  assert.equal(supabaseMock.state.rpcCalls[0].name, 'criar_agendamento_atomic');
  assert.equal(supabaseMock.state.upserts[0].payload.nome, 'Maria');
  assert.equal(supabaseMock.state.upserts[0].payload.telefone, '5511999999999');
});

test('criar-agendamento trata falha inesperada como 500 e captura contexto', async () => {
  let captured = null;
  const { deps } = createDeps({
    supabaseMock: {
      client: {
        async rpc() {
          throw new Error('falha inesperada');
        },
      },
    },
    onUnexpectedError: (err, context) => {
      captured = { err: String(err), context };
    },
  });

  const response = await handleCriarAgendamentoRequest(createRequest({
    prestador_id: 'p1',
    servico_id: 's1',
    cliente_nome: 'Maria',
    cliente_tel: '5511999999999',
    data_hora: '2026-04-03T15:00:00.000Z',
  }), deps);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { erro: 'Erro interno no servidor' });
  assert.equal(captured.context.prestador_id, 'p1');
});
