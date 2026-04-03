/**
 * Regras de negócio para o webhook do Asaas.
 * Centraliza classificação de eventos, cálculo de validade
 * e extração de dados do payload.
 */

/** Eventos que ativam o plano Pro */
export const EVENTOS_ATIVAR = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
]);

/** Eventos que desativam o plano Pro (downgrade imediato para Free) */
export const EVENTOS_DESATIVAR = new Set([
  'SUBSCRIPTION_DELETED',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
]);

/** Eventos de inadimplência (grace period — cron cuida do downgrade) */
export const EVENTOS_INADIMPLENTE = new Set([
  'PAYMENT_OVERDUE',
]);

/**
 * Calcula a data de validade do plano com base no ciclo de cobrança.
 *
 * @param {'MONTHLY' | 'YEARLY'} ciclo - Ciclo de cobrança
 * @param {Date} now - Data base (para testes; usa Date.now por padrão)
 * @returns {Date}
 */
export function calcularValidadeAte(ciclo, now = new Date()) {
  const data = new Date(now);
  if (ciclo === 'YEARLY') data.setFullYear(data.getFullYear() + 1);
  else data.setMonth(data.getMonth() + 1);
  return data;
}

/**
 * Classifica o tipo de ação para um evento do Asaas.
 *
 * @param {string} evento - Nome do evento (ex: 'PAYMENT_RECEIVED')
 * @returns {'ativar' | 'inadimplente' | 'desativar' | 'ignorar'}
 */
export function classificarEventoAsaas(evento) {
  if (EVENTOS_ATIVAR.has(evento)) return 'ativar';
  if (EVENTOS_INADIMPLENTE.has(evento)) return 'inadimplente';
  if (EVENTOS_DESATIVAR.has(evento)) return 'desativar';
  return 'ignorar';
}

/**
 * Extrai dados relevantes do payload do webhook do Asaas.
 *
 * @param {Object} payload - Corpo da requisição do webhook
 * @returns {{ evento: string|null, payment: Object|null, subscription: Object|null, subId: string|null, paymentId: string|null, customerId: string|null }}
 */
export function extrairAssinaturaAsaas(payload) {
  const payment = payload?.payment;
  const subscription = payload?.subscription ?? payment?.subscription;
  const subId = typeof subscription === 'string' ? subscription : subscription?.id;

  return {
    evento: payload?.event ?? null,
    payment,
    subscription,
    subId: subId ?? null,
    paymentId: payment?.id ?? null,
    customerId: payment?.customer ?? null,
  };
}
