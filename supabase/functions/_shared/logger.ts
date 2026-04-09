/**
 * Logger Estruturado para Edge Functions (Deno/TypeScript)
 *
 * Uso:
 *   import { logger } from "../_shared/logger.ts";
 *
 *   logger.info("Agendamento criado", { agendamentoId, prestadorId });
 *   await logger.error("Falha ao processar pagamento", error, { paymentId });
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

function getCurrentLevel(): LogLevel {
  return Deno.env.get("SENTRY_ENVIRONMENT") === "production"
    ? LOG_LEVELS.WARN
    : LOG_LEVELS.DEBUG;
}

const CURRENT_LEVEL = getCurrentLevel();

function sanitizeContext(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return obj;

  const sensitiveKeys = new Set([
    "password", "senha", "token", "api_key", "apikey", "secret",
    "authorization", "access_token", "refresh_token", "service_role",
    "service_role_key", "credit_card", "cartao", "cpf", "cnpj",
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

async function sendToSentry(
  error: Error,
  context: LogContext,
  feature?: string
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  try {
    const projectId = dsn.split("/").pop();
    const url = `https://sentry.io/api/${projectId}/envelope/`;

    const envelope = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      platform: "javascript",
      logger: feature || context.feature || "edge-function",
      level: "error",
      exception: {
        values: [{
          type: error.name || "Error",
          value: error.message,
          stacktrace: { frames: [] },
        }],
      },
      tags: {
        feature: feature || context.feature || "unknown",
        environment: Deno.env.get("SENTRY_ENVIRONMENT") || "unknown",
      },
      extra: sanitizeContext(context as Record<string, unknown>),
    };

    const header = `${JSON.stringify({ event_id: envelope.event_id, sent_at: envelope.timestamp, dsn })}\n`;
    const itemHeader = `${JSON.stringify({ type: "event", content_type: "application/json" })}\n`;
    const payload = `${header}${itemHeader}${JSON.stringify(envelope)}`;

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: payload,
    });
  } catch (sentryError) {
    console.error("[ERROR] Sentry falhou:", (sentryError as Error).message);
  }
}

export const logger = {
  debug: (message: string, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
      console.debug("[DEBUG]", message, sanitizeContext(context));
    }
  },

  info: (message: string, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
      console.info("[INFO]", message, sanitizeContext(context));
    }
  },

  warn: (message: string, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
      console.warn("[WARN]", message, sanitizeContext(context));
    }
  },

  /**
   * Erro — aparece no console, NÃO envia para Sentry automaticamente.
   * Use `captureError()` quando quiser que vá para o Sentry.
   */
  error: (message: string, error: unknown, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
      console.error("[ERROR]", message, error, sanitizeContext(context));
    }
  },

  /**
   * Erro crítico — aparece no console E envia para Sentry (produção).
   * Use APENAS para erros inesperados que precisam de investigação.
   * NÃO use para fluxos esperados (ex: auth falhou, redirecionamento).
   */
  captureError: async (message: string, error: unknown, context: LogContext = {}): Promise<void> => {
    if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
      console.error("[ERROR]", message, error, sanitizeContext(context));
    }

    const errorObj = error instanceof Error ? error : new Error(String(error));
    await sendToSentry(errorObj, context, context.feature);
  },

  metric: (eventName: string, context: LogContext = {}): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
      console.info("[METRIC]", eventName, sanitizeContext(context));
    }
  },
};

export default logger;
