import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularValidadeAte,
  classificarEventoAsaas,
  extrairAssinaturaAsaas,
} from '../modules/asaas-webhook-rules.js';

test('classificarEventoAsaas identifica eventos de ativacao', () => {
  assert.equal(classificarEventoAsaas('PAYMENT_RECEIVED'), 'ativar');
  assert.equal(classificarEventoAsaas('PAYMENT_CONFIRMED'), 'ativar');
});

test('classificarEventoAsaas identifica inadimplencia e desativacao', () => {
  assert.equal(classificarEventoAsaas('PAYMENT_OVERDUE'), 'inadimplente');
  assert.equal(classificarEventoAsaas('PAYMENT_REFUNDED'), 'desativar');
  assert.equal(classificarEventoAsaas('SUBSCRIPTION_DELETED'), 'desativar');
});

test('classificarEventoAsaas ignora eventos nao mapeados', () => {
  assert.equal(classificarEventoAsaas('PAYMENT_CREATED'), 'ignorar');
  assert.equal(classificarEventoAsaas(undefined), 'ignorar');
});

test('extrairAssinaturaAsaas aceita subscription como objeto', () => {
  const resultado = extrairAssinaturaAsaas({
    event: 'PAYMENT_CONFIRMED',
    payment: { id: 'pay_1', customer: 'cus_1' },
    subscription: { id: 'sub_1', cycle: 'MONTHLY' },
  });

  assert.equal(resultado.evento, 'PAYMENT_CONFIRMED');
  assert.equal(resultado.subId, 'sub_1');
  assert.equal(resultado.paymentId, 'pay_1');
  assert.equal(resultado.customerId, 'cus_1');
});

test('extrairAssinaturaAsaas aceita subscription como string dentro de payment', () => {
  const resultado = extrairAssinaturaAsaas({
    event: 'PAYMENT_RECEIVED',
    payment: { id: 'pay_2', customer: 'cus_2', subscription: 'sub_2' },
  });

  assert.equal(resultado.subId, 'sub_2');
  assert.equal(resultado.paymentId, 'pay_2');
  assert.equal(resultado.customerId, 'cus_2');
});

test('calcularValidadeAte soma um mes no plano mensal', () => {
  const base = new Date('2026-04-03T10:00:00.000Z');
  const resultado = calcularValidadeAte('MONTHLY', base);

  assert.equal(resultado.getUTCFullYear(), 2026);
  assert.equal(resultado.getUTCMonth(), 4);
});

test('calcularValidadeAte soma um ano no plano anual', () => {
  const base = new Date('2026-04-03T10:00:00.000Z');
  const resultado = calcularValidadeAte('YEARLY', base);

  assert.equal(resultado.getUTCFullYear(), 2027);
  assert.equal(resultado.getUTCMonth(), 3);
});

test('extrairAssinaturaAsaas com payload vazio retorna valores nulos', () => {
  const resultado = extrairAssinaturaAsaas({});

  assert.equal(resultado.evento, null);
  assert.equal(resultado.subId, null);
  assert.equal(resultado.paymentId, null);
  assert.equal(resultado.customerId, null);
  // payment e subscription são undefined (não null) para payload vazio
  assert.equal(resultado.payment, undefined);
  assert.equal(resultado.subscription, undefined);
});
