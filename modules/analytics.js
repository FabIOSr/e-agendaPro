/**
 * Analytics — Plausible (privacy-first, sem cookies, sem banner LGPD)
 *
 * Uso no frontend:
 *   import { analytics } from './modules/analytics.js';
 *   analytics.agendamentoCriado({ plano: 'pro', servico: 'corte' });
 *
 * Uso nas Edge Functions (server-side):
 *   import { sendServerEvent } from './modules/analytics.js';
 *   await sendServerEvent('upgrade_concluido', { prestador_id, plano }, getEnv);
 *
 * Setup:
 *   1. Adicionar script no <head>: <script defer data-domain="SEU_DOMINIO" src="https://plausible.io/js/script.js"></script>
 *   2. Definir PLAUSIBLE_DOMAIN no .env.local (opcional, fallback para window.location)
 */

/**
 * Enviar evento para Plausible (frontend)
 */
function sendPlausibleEvent(name, props = {}) {
  if (typeof plausible === 'function') {
    plausible(name, { props });
  }
}

export const analytics = {
  /**
   * Page view manual (Plausible já track automaticamente, mas isso permite override)
   */
  pageView(url) {
    sendPlausibleEvent('pageview', { url });
  },

  /**
   * Agendamento criado (preview/agendar)
   */
  agendamentoCriado({ plano, servico, horario }) {
    sendPlausibleEvent('agendamento_criado', { plano, servico, horario });
  },

  /**
   * Trial iniciado (frontend apos ativar)
   */
  trialIniciado() {
    sendPlausibleEvent('trial_iniciado');
  },

  /**
   * Trial expirou (frontend ao ver trial expirado)
   */
  trialExpirado({ diasUsados }) {
    sendPlausibleEvent('trial_expirado', { dias_usados: diasUsados });
  },

  /**
   * Upgrade concluido (frontend apos webhook ativar Pro)
   */
  upgradeConcluido({ periodicidade }) {
    sendPlausibleEvent('upgrade_concluido', { periodicidade });
  },

  /**
   * Downgrade / rebaixamento para Free
   */
  downgradeEfetuado({ motivo }) {
    sendPlausibleEvent('downgrade_efetuado', { motivo });
  },

  /**
   * Cancelamento com survey
   */
  cancelamentoSurvey({ motivo }) {
    sendPlausibleEvent('cancelamento_survey', { motivo });
  },

  /**
   * Entrada na lista de espera
   */
  listaEsperaEntrada({ servico, preferencia }) {
    sendPlausibleEvent('lista_espera_entrada', { servico, preferencia });
  },

  /**
   * Reagendamento
   */
  agendamentoReagendado() {
    sendPlausibleEvent('agendamento_reagendado');
  },

  /**
   * Agendamento cancelado pelo cliente
   */
  agendamentoCancelado() {
    sendPlausibleEvent('agendamento_cancelado');
  },
};

/**
 * Enviar evento server-side para Plausible via Events API.
 * Usado nas Edge Functions onde `plausible()` nao esta disponivel.
 *
 * Docs: https://plausible.io/docs/events-api
 *
 * Uso:
 *   await sendServerEvent('upgrade_concluido', { prestador_id: 'x', plano: 'pro' }, getEnv);
 */
export async function sendServerEvent(name, props, getEnv) {
  const domain = getEnv?.('PLAUSIBLE_DOMAIN') || getEnv?.('APP_URL')?.replace('https://', '').replace('http://', '');
  if (!domain) return; // Plausible nao configurado, silenciar

  try {
    const url = `https://plausible.io/api/event`;
    const payload = {
      name,
      url: `${getEnv?.('APP_URL') || 'https://e-agendapro.web.app'}/server-event`,
      domain,
      props: props || {},
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // Silenciar — analytics nao deve quebrar a funcao
  }
}

export default analytics;
