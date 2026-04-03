import test from 'node:test';
import assert from 'node:assert/strict';

import { handleWebhookAsaasRequest } from '../modules/webhook-asaas-handler.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
};

function createRequest(payload, overrides = {}) {
  return new Request('http://localhost/webhook-asaas', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'asaas-access-token': 'token-correto',
      ...(overrides.headers ?? {}),
    },
    body: JSON.stringify(payload),
    ...overrides,
  });
}

function createQueryBuilder(result) {
  return {
    select() {
      return this;
    },
    eq(column, value) {
      this.lastEq = { column, value };
      return this;
    },
    async maybeSingle() {
      return result(this.lastEq);
    },
  };
}

function createSupabaseMock(options = {}) {
  const state = {
    pagamentos: [],
    prestadorUpdates: [],
    rpcCalls: [],
  };

  const prestadorBySub = options.prestadorBySub ?? (() => ({ data: null }));
  const prestadorByCustomer = options.prestadorByCustomer ?? (() => ({ data: null }));

  return {
    state,
    client: {
      from(table) {
        if (table === 'prestadores') {
          return {
            ...createQueryBuilder(({ column, value }) => {
              if (column === 'asaas_sub_id') return prestadorBySub(value);
              if (column === 'asaas_customer_id') return prestadorByCustomer(value);
              return { data: null };
            }),
            update(payload) {
              return {
                async eq(column, value) {
                  state.prestadorUpdates.push({ payload, column, value });
                  return { error: options.prestadorUpdateError ?? null };
                },
              };
            },
          };
        }

        if (table === 'pagamentos') {
          return {
            async upsert(payload, config) {
              state.pagamentos.push({ payload, config });
              return options.pagamentoResult ?? { error: null };
            },
          };
        }

        throw new Error(`Tabela nao mockada: ${table}`);
      },
      async rpc(name, payload) {
        state.rpcCalls.push({ name, payload });
        return options.rpcResult ?? { error: null, data: { ok: true } };
      },
    },
  };
}

function createDeps(overrides = {}) {
  const supabaseMock = overrides.supabaseMock ?? createSupabaseMock();

  return {
    supabaseMock,
    deps: {
      cors: CORS,
      createSupabaseClient: () => supabaseMock.client,
      getEnv: (key) => ({
        ASAAS_WEBHOOK_TOKEN: 'token-correto',
        SUPABASE_URL: 'https://demo.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      })[key],
      now: overrides.now ?? (() => new Date('2026-04-03T10:00:00.000Z')),
      onUnexpectedError: overrides.onUnexpectedError,
    },
  };
}

test('webhook-asaas retorna 401 para token invalido', async () => {
  const { deps } = createDeps();
  const response = await handleWebhookAsaasRequest(createRequest({}, {
    headers: { 'asaas-access-token': 'token-errado' },
  }), deps);

  assert.equal(response.status, 401);
  assert.equal(await response.text(), 'Unauthorized');
});

test('webhook-asaas ignora evento nao mapeado sem tocar no banco', async () => {
  const { deps, supabaseMock } = createDeps();
  const response = await handleWebhookAsaasRequest(createRequest({ event: 'PAYMENT_CREATED' }), deps);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ignorado: true, evento: 'PAYMENT_CREATED' });
  assert.equal(supabaseMock.state.pagamentos.length, 0);
});

test('webhook-asaas ativa plano quando encontra prestador pela assinatura', async () => {
  const supabaseMock = createSupabaseMock({
    prestadorBySub: () => ({ data: { id: 'prest_1', plano: 'free', asaas_customer_id: 'cus_1' } }),
  });
  const { deps } = createDeps({ supabaseMock });

  const response = await handleWebhookAsaasRequest(createRequest({
    event: 'PAYMENT_CONFIRMED',
    payment: { id: 'pay_1', value: 99.9, billingType: 'CREDIT_CARD' },
    subscription: { id: 'sub_1', cycle: 'YEARLY' },
  }), deps);

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.acao, 'plano_ativado');
  assert.equal(supabaseMock.state.pagamentos.length, 1);
  assert.equal(supabaseMock.state.prestadorUpdates[0].payload.plano, 'pro');
  assert.equal(supabaseMock.state.prestadorUpdates[0].payload.assinatura_periodicidade, 'YEARLY');
});

test('webhook-asaas usa fallback por customer e salva subId', async () => {
  const supabaseMock = createSupabaseMock({
    prestadorBySub: () => ({ data: null }),
    prestadorByCustomer: () => ({ data: { id: 'prest_2', plano: 'free', asaas_customer_id: 'cus_2' } }),
  });
  const { deps } = createDeps({ supabaseMock });

  const response = await handleWebhookAsaasRequest(createRequest({
    event: 'PAYMENT_OVERDUE',
    payment: { id: 'pay_2', customer: 'cus_2', subscription: 'sub_2' },
  }), deps);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, acao: 'grace_period_iniciado' });
  assert.equal(supabaseMock.state.prestadorUpdates[0].payload.asaas_sub_id, 'sub_2');
});

test('webhook-asaas chama downgrade no evento de desativacao', async () => {
  const supabaseMock = createSupabaseMock({
    prestadorBySub: () => ({ data: { id: 'prest_3', plano: 'pro', asaas_customer_id: 'cus_3' } }),
  });
  const { deps } = createDeps({ supabaseMock });

  const response = await handleWebhookAsaasRequest(createRequest({
    event: 'PAYMENT_REFUNDED',
    payment: { id: 'pay_3' },
    subscription: { id: 'sub_3', cycle: 'MONTHLY' },
  }), deps);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, acao: 'plano_rebaixado_limites_aplicados' });
  assert.equal(supabaseMock.state.rpcCalls[0].name, 'downgrade_pro');
});

test('webhook-asaas retorna 500 e captura contexto em falha inesperada', async () => {
  let captured = null;
  const { deps } = createDeps({
    supabaseMock: {
      client: {
        from() {
          throw new Error('falha banco');
        },
      },
    },
    onUnexpectedError: (err, context) => {
      captured = { err: String(err), context };
    },
  });

  const response = await handleWebhookAsaasRequest(createRequest({
    event: 'PAYMENT_CONFIRMED',
    payment: { id: 'pay_9' },
    subscription: { id: 'sub_9', cycle: 'MONTHLY' },
  }), deps);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { erro: 'Erro interno no webhook' });
  assert.equal(captured.context.evento, 'PAYMENT_CONFIRMED');
});
