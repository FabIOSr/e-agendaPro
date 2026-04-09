/**
 * Logger Estruturado com Níveis e Integração Sentry
 *
 * Uso:
 *   import { logger } from '../modules/logger.js';  // frontend
 *   import { logger } from '../_shared/logger.ts';  // edge functions
 *
 *   logger.info('Usuário autenticado', { userId, plano });
 *   logger.error('Falha ao criar agendamento', error, { feature: 'agendamento' });
 *
 * Comportamento:
 *   - Development: mostra DEBUG, INFO, WARN, ERROR
 *   - Production: mostra apenas WARN, ERROR (e envia para Sentry)
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

export interface LogContext {
  feature?: string;
  [key: string]: unknown;
}

// Determinar nível baseado no ambiente
function getCurrentLevel(): LogLevel {
  // Frontend: verifica variável global injetada pelo build
  if (typeof window !== 'undefined' && window.ENV) {
    return window.ENV.SENTRY_ENVIRONMENT === 'production'
      ? LOG_LEVELS.WARN
      : LOG_LEVELS.DEBUG;
  }

  // Edge Functions: verifica Deno.env
  if (typeof Deno !== 'undefined') {
    return Deno.env.get('SENTRY_ENVIRONMENT') === 'production'
      ? LOG_LEVELS.WARN
      : LOG_LEVELS.DEBUG;
  }

  // Node.js (testes): verifica env
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'production'
      ? LOG_LEVELS.WARN
      : LOG_LEVELS.DEBUG;
  }

  // Fallback: development
  return LOG_LEVELS.DEBUG;
}

const CURRENT_LEVEL = getCurrentLevel();

/**
 * Extrai dados sensíveis de um objeto para não logar acidentalmente
 */
function sanitizeContext(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = new Set([
    'password',
    'senha',
    'token',
    'api_key',
    'apikey',
    'secret',
    'authorization',
    'access_token',
    'refresh_token',
    'service_role',
    'service_role_key',
    'credit_card',
    'cartao',
    'cpf',
    'cnpj',
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Envia erro para Sentry se DSN estiver configurado (frontend)
 */
function sendToSentryFrontend(
  error: Error,
  context: LogContext,
  feature?: string
): void {
  if (typeof window === 'undefined' || !window.Sentry) return;

  try {
    window.Sentry.captureException(error, {
      tags: {
        feature: feature || context.feature || 'unknown',
        environment: window.ENV?.SENTRY_ENVIRONMENT || 'unknown',
      },
      context: {
        data: sanitizeContext(context as Record<string, unknown>),
        message: error.message,
      },
    });
  } catch (sentryError) {
    // Se Sentry falhar, não quebrar a aplicação
    console.error('[ERROR] Sentry falhou:', sentryError);
  }
}

/**
 * Envia erro para Sentry via API (Edge Functions)
 */
async function sendToSentryEdge(
  error: Error,
  context: LogContext,
  feature?: string
): Promise<void> {
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) return;

  try {
    const projectId = dsn.split('/').pop();
    const url = `https://sentry.io/api/${projectId}/envelope/`;

    const envelope = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      logger: feature || context.feature || 'edge-function',
      level: 'error',
      exception: {
        values: [
          {
            type: error.name || 'Error',
            value: error.message,
            stacktrace: { frames: [] },
          },
        ],
      },
      tags: {
        feature: feature || context.feature || 'unknown',
        environment: Deno.env.get('SENTRY_ENVIRONMENT') || 'unknown',
      },
      extra: sanitizeContext(context as Record<string, unknown>),
    };

    const header = `${JSON.stringify({ event_id: envelope.event_id, sent_at: envelope.timestamp, dsn })}\n`;
    const itemHeader = `${JSON.stringify({ type: 'event', content_type: 'application/json' })}\n`;
    const payload = `${header}${itemHeader}${JSON.stringify(envelope)}`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: payload,
    });
  } catch (sentryError) {
    console.error('[ERROR] Sentry falhou:', (sentryError as Error).message);
  }
}

export const logger = {
  /**
   * Log de debug (apenas development)
   */
  debug: (message: string, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
      console.debug('[DEBUG]', message, sanitizeContext(context as Record<string, unknown>));
    }
  },

  /**
   * Log informativo (desenvolvimento e staging)
   */
  info: (message: string, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
      console.info('[INFO]', message, sanitizeContext(context as Record<string, unknown>));
    }
  },

  /**
   * Aviso de algo que pode ser um problema (sempre aparece, NÃO envia para Sentry)
   */
  warn: (message: string, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', message, sanitizeContext(context as Record<string, unknown>));
    }
  },

  /**
   * Erro — aparece no console, NÃO envia para Sentry automaticamente.
   * Use `captureError()` quando quiser que vá para o Sentry.
   */
  error: (message: string, error: unknown, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
      console.error(
        '[ERROR]',
        message,
        error,
        sanitizeContext(context as Record<string, unknown>)
      );
    }
  },

  /**
   * Erro crítico — aparece no console E envia para Sentry (produção).
   * Use APENAS para erros inesperados que precisam de investigação.
   * NÃO use para fluxos esperados (ex: auth falhou, redirecionamento).
   */
  captureError: async (
    message: string,
    error: unknown,
    context: LogContext = {}
  ): Promise<void> => {
    if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
      console.error(
        '[ERROR]',
        message,
        error,
        sanitizeContext(context as Record<string, unknown>)
      );
    }

    // Enviar para Sentry
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const feature = context.feature;

    if (typeof Deno !== 'undefined') {
      await sendToSentryEdge(errorObj, context, feature);
    } else {
      sendToSentryFrontend(errorObj, context, feature);
    }
  },

  /**
   * Métrica simples — conta evento sem stack trace
   */
  metric: (eventName: string, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
      console.info('[METRIC]', eventName, sanitizeContext(context as Record<string, unknown>));
    }

    // Registrar no Sentry como breadcrumb (frontend)
    if (typeof window !== 'undefined' && window.Sentry) {
      try {
        window.Sentry.addBreadcrumb({
          category: 'metric',
          message: eventName,
          level: 'info',
          data: sanitizeContext(context as Record<string, unknown>),
        });
      } catch (_) {
        // Ignorar se Sentry não disponível
      }
    }
  },
};

export default logger;
