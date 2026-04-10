/**
 * Rate Limiting para Edge Functions (Deno)
 *
 * Uso:
 *   import { createRateLimiter, RATE_LIMITS, rateLimitHeaders, rateLimitResponse } from "../_shared/rate-limit.ts";
 *
 *   const limiter = createRateLimiter("nome-da-funcao");
 *
 *   Deno.serve(async (req) => {
 *     if (req.method === "OPTIONS") return handleCorsPreflight(origin);
 *
 *     const ip = req.headers.get("x-forwarded-for") || "unknown";
 *     const result = limiter.check(ip, RATE_LIMITS.criarAgendamento);
 *     if (!result.allowed) return rateLimitResponse(result);
 *
 *     // ... handler normal com rateLimitHeaders(result) na resposta
 *   });
 *
 * Configs disponiveis:
 *   - adminValidate:        5req / 15min  (brute force)
 *   - criarAgendamento:     10req / 1min  (anti-spam)
 *   - horariosDisponiveis:  30req / 1min  (browsing)
 *   - lembretesWhatsApp:    5req / 1min   (custos)
 *   - criarAssinatura:      3req / 1hora  (abuso)
 *   - webhookAsaas:         50req / 1min  (retries Asaas)
 *   - cancelarAgendamento:  10req / 1min  (anti-abuso)
 *   - reagendarAgendamento: 10req / 1min  (anti-abuso)
 *   - default:              20req / 1min  (generico)
 */

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAtMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  adminValidate:        { max: 5,  windowMs: 15 * 60 * 1000 },
  criarAgendamento:     { max: 10, windowMs: 60 * 1000 },
  horariosDisponiveis:  { max: 30, windowMs: 60 * 1000 },
  lembretesWhatsApp:    { max: 5,  windowMs: 60 * 1000 },
  criarAssinatura:      { max: 3,  windowMs: 60 * 60 * 1000 },
  webhookAsaas:         { max: 50, windowMs: 60 * 1000 },
  cancelarAgendamento:  { max: 10, windowMs: 60 * 1000 },
  reagendarAgendamento: { max: 10, windowMs: 60 * 1000 },
  default:              { max: 20, windowMs: 60 * 1000 },
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Auto-cleanup a cada 5 min
let _cleanupStarted = false;
function _startCleanup() {
  if (_cleanupStarted) return;
  _cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export function createRateLimiter(fnName?: string) {
  _startCleanup();
  return {
    check(identifier: string, config: RateLimitConfig): RateLimitResult {
      const now = Date.now();
      const key = `${fnName || "global"}:${identifier}`;
      const entry = store.get(key);

      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true, remaining: config.max - 1, limit: config.max, resetAtMs: now + config.windowMs };
      }

      if (entry.count >= config.max) {
        return { allowed: false, remaining: 0, limit: config.max, resetAtMs: entry.resetAt };
      }

      entry.count++;
      return { allowed: true, remaining: config.max - entry.count, limit: config.max, resetAtMs: entry.resetAt };
    },
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAtMs / 1000)),
  };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  const retrySecs = Math.max(1, Math.ceil((result.resetAtMs - Date.now()) / 1000));
  return new Response("Muitas tentativas. Tente novamente mais tarde.", {
    status: 429,
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "Retry-After": String(retrySecs),
      ...rateLimitHeaders(result),
    },
  });
}
