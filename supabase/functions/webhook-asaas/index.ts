// supabase/functions/webhook-asaas/index.ts
//
// Recebe eventos do Asaas e atualiza o plano do prestador.
//
// Seguranca: valida o header "asaas-access-token" contra ASAAS_WEBHOOK_TOKEN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { handleWebhookAsaasRequest } from "../../../modules/webhook-asaas-handler.js";
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
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
// };

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  return handleWebhookAsaasRequest(req, {
    cors: corsHeaders(origin),
    createSupabaseClient: createClient,
    getEnv: (key: string) => Deno.env.get(key),
    now: () => new Date(),
    onUnexpectedError: (err: unknown, errorContext: Record<string, unknown>) => {
      if (SENTRY_DSN) {
        Sentry.setTag("plano", (errorContext.plano as string) ?? "unknown");
        Sentry.captureException(err, {
          tags: { function: "webhook-asaas" },
          extra: errorContext,
        });
      }
    },
  });
});
