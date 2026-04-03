// supabase/functions/criar-agendamento/index.ts
//
// Cria um agendamento com validacao atomica no banco.
// O front-end nao faz mais INSERT direto na tabela agendamentos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { handleCriarAgendamentoRequest } from "../../../modules/criar-agendamento-handler.js";

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
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  return handleCriarAgendamentoRequest(req, {
    cors: CORS,
    createSupabaseClient: createClient,
    getEnv: (key: string) => Deno.env.get(key),
    fetchImpl: fetch,
    now: () => new Date(),
    onUnexpectedError: (err: unknown, errorContext: Record<string, unknown>) => {
      if (SENTRY_DSN) {
        Sentry.captureException(err, {
          tags: { function: "criar-agendamento" },
          extra: errorContext,
        });
      }
    },
  });
});
