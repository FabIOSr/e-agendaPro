// supabase/functions/cancelar-agendamento-cliente/index.ts
//
// Cancela um agendamento pelo token unico enviado no WhatsApp.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8";
import { handleCancelarAgendamentoClienteRequest } from "../../../modules/cancelar-agendamento-cliente-handler.js";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";
import { createRateLimiter, RATE_LIMITS, rateLimitHeaders, rateLimitResponse } from "../_shared/rate-limit.ts";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") ?? "production",
  });
}

const limiter = createRateLimiter("cancelar-agendamento-cliente");

async function enviarWhatsApp(telefone: string, mensagem: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "agendapro-prod";

  if (!evolutionUrl || !evolutionKey) return;

  try {
    const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionKey,
      },
      body: JSON.stringify({
        number: telefone.replace(/\D/g, ""),
        textMessage: { text: mensagem },
      }),
    });

    if (!res.ok && SENTRY_DSN) {
      Sentry.captureException(new Error(`Evolution API erro: ${res.status}`), { tags: { function: "cancelar-agendamento-cliente", step: "whatsapp" } });
    }
  } catch (e) {
    if (SENTRY_DSN) Sentry.captureException(e, { tags: { function: "cancelar-agendamento-cliente", step: "whatsapp" } });
  }
}

async function enviarEmail(to: string, subject: string, html: string) {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'nao-responda@agendapro.com.br';

  if (!sendgridKey) {
    console.warn('SENDGRID_API_KEY não configurado');
    return;
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sendgridKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: EMAIL_FROM, name: "AgendaPro" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!res.ok) {
      const erro = await res.text();
      if (SENTRY_DSN) Sentry.captureException(new Error(`SendGrid erro ${res.status}: ${erro}`), { tags: { function: "cancelar-agendamento-cliente", step: "email" } });
    }
  } catch (e) {
    if (SENTRY_DSN) Sentry.captureException(e, { tags: { function: "cancelar-agendamento-cliente", step: "email" } });
  }
}

function paginaConfirmacao(agendamento: any, token: string): string {
  const d = new Date(agendamento.data_hora);
  const dataFmt = d.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
    timeZone: "America/Sao_Paulo",
  });
  const horaFmt = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cancelar agendamento</title>
</head>
<body>
<div>
  <h1>Cancelar agendamento?</h1>
  <p>${agendamento.prestadores?.nome ?? "o prestador"} - ${agendamento.servicos?.nome ?? "—"} - ${dataFmt} ${horaFmt}</p>
  <button onclick="cancelar()">Confirmar cancelamento</button>
</div>
<script>
async function cancelar() {
  const res = await fetch(window.location.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: '${token}' }),
  });
  if (res.ok) document.body.innerHTML = '<h1>Agendamento cancelado</h1>';
}
</script>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'nao-responda@agendapro.com.br';

  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rateResult = limiter.check(ip, RATE_LIMITS.cancelarAgendamento);
  if (!rateResult.allowed) return rateLimitResponse(rateResult);

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = { ...corsHeaders(origin), ...rateLimitHeaders(rateResult) };

  return handleCancelarAgendamentoClienteRequest(req, {
    corsHeaders: () => cors,
    createSupabaseClient: createClient,
    getEnv: (key: string) => Deno.env.get(key),
    fetchImpl: fetch,
    renderPage: paginaConfirmacao,
    enviarWhatsApp,
    enviarEmail,
    onUnexpectedError: (err: unknown, errorContext: Record<string, unknown>) => {
      if (SENTRY_DSN) {
        Sentry.captureException(err, {
          tags: { function: "cancelar-agendamento-cliente", plano: (errorContext.plano as string) ?? "unknown" },
          extra: errorContext,
        });
      }
    },
  });
});
