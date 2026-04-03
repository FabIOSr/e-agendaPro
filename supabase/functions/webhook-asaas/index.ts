// supabase/functions/webhook-asaas/index.ts
//
// Recebe eventos do Asaas e atualiza o plano do prestador.
//
// Seguranca: valida o header "asaas-access-token" contra ASAAS_WEBHOOK_TOKEN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { handleWebhookAsaasRequest } from "../../../modules/webhook-asaas-handler.js";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tracesSampleRate: 0.1,
  });
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

Deno.serve(async (req: Request) => {
  return handleWebhookAsaasRequest(req, {
    cors: CORS,
    createSupabaseClient: createClient,
    getEnv: (key: string) => Deno.env.get(key),
    now: () => new Date(),
    onUnexpectedError: (err: unknown, errorContext: Record<string, unknown>) => {
      if (SENTRY_DSN) {
        Sentry.captureException(err, {
          tags: { function: "webhook-asaas" },
          extra: errorContext,
        });
      }
    },
  });
});
