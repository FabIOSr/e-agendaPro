import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarResultadoCriacaoAgendamento } from '../modules/agendamento-response.js';

test('normalizarResultadoCriacaoAgendamento retorna sucesso padronizado', () => {
  const resultado = normalizarResultadoCriacaoAgendamento({
    ok: true,
    agendamento_id: 'ag_123',
  });

  assert.deepEqual(resultado, {
    ok: true,
    status: 200,
    body: {
      ok: true,
      agendamento_id: 'ag_123',
    },
  });
});

test('normalizarResultadoCriacaoAgendamento preserva erro simples', () => {
  const resultado = normalizarResultadoCriacaoAgendamento({
    ok: false,
    erro: 'Prestador não encontrado',
    http_status: 400,
  });

  assert.deepEqual(resultado, {
    ok: false,
    status: 400,
    body: {
      erro: 'Prestador não encontrado',
    },
  });
});

test('normalizarResultadoCriacaoAgendamento preserva payload de limite', () => {
  const resultado = normalizarResultadoCriacaoAgendamento({
    ok: false,
    erro: 'limite_atingido',
    http_status: 403,
    count: 10,
    limite: 10,
    whatsapp: '5511999999999',
  });

  assert.deepEqual(resultado, {
    ok: false,
    status: 403,
    body: {
      erro: 'limite_atingido',
      count: 10,
      limite: 10,
      whatsapp: '5511999999999',
    },
  });
});

test('normalizarResultadoCriacaoAgendamento usa fallback seguro', () => {
  const resultado = normalizarResultadoCriacaoAgendamento(null);

  assert.deepEqual(resultado, {
    ok: false,
    status: 400,
    body: {
      erro: 'Erro ao criar agendamento',
    },
  });
});
