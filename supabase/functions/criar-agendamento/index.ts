// supabase/functions/criar-agendamento/index.ts
//
// Cria um agendamento com validacao atomica no banco.
// O front-end nao faz mais INSERT direto na tabela agendamentos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { handleCriarAgendamentoRequest } from "../../../modules/criar-agendamento-handler.js";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tracesSampleRate: 0.1,
  });
}

// CORS local antigo (substituído pelo módulo _shared/cors.ts)
// const CORS = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers":
//     "authorization, x-client-info, apikey, content-type",
// };

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // Preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  // Validação de origem
  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  return handleCriarAgendamentoRequest(req, {
    cors: corsHeaders(origin),
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
