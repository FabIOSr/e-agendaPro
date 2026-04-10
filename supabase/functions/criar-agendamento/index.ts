// supabase/functions/criar-agendamento/index.ts
//
// Cria um agendamento com validacao atomica no banco.
// O front-end nao faz mais INSERT direto na tabela agendamentos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { handleCriarAgendamentoRequest } from "../../../modules/criar-agendamento-handler.js";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";
import { createRateLimiter, RATE_LIMITS, rateLimitHeaders, rateLimitResponse } from "../_shared/rate-limit.ts";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tracesSampleRate: 0.1,
  });
}

const limiter = createRateLimiter("criar-agendamento");

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rateResult = limiter.check(ip, RATE_LIMITS.criarAgendamento);
  if (!rateResult.allowed) return rateLimitResponse(rateResult);

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const headers = { ...corsHeaders(origin), ...rateLimitHeaders(rateResult) };

  return handleCriarAgendamentoRequest(req, {
    cors: headers,
    createSupabaseClient: createClient,
    getEnv: (key: string) => Deno.env.get(key),
    fetchImpl: fetch,
    now: () => new Date(),
    onUnexpectedError: (err: unknown, errorContext: Record<string, unknown>) => {
      if (SENTRY_DSN) {
        // Busca plano do prestador para contexto do erro
        if (errorContext.prestador_id) {
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );
          supabase
            .from("prestadores")
            .select("plano")
            .eq("id", errorContext.prestador_id)
            .maybeSingle()
            .then(({ data }) => {
              Sentry.setTag("plano", data?.plano ?? "unknown");
            })
            .catch(() => {});
        }
        Sentry.captureException(err, {
          tags: { function: "criar-agendamento" },
          extra: errorContext,
        });
      }
    },
  });
});
