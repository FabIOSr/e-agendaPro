// supabase/functions/webhook-asaas/index.ts
//
// Recebe eventos do Asaas e atualiza o plano do prestador.
//
// Segurança: valida o header "asaas-access-token" contra ASAAS_WEBHOOK_TOKEN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import {
  calcularValidadeAte,
  classificarEventoAsaas,
  extrairAssinaturaAsaas,
} from "../../../modules/asaas-webhook-rules.js";

// Inicializa Sentry (se DSN configurado)
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
  const errorContext: Record<string, unknown> = {
    method: req.method,
    content_type: req.headers.get("content-type"),
    url: req.url,
  };

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: CORS });
    }

  // ── Validação do token ──────────────────────────────────────────────────
  const webhookToken  = req.headers.get("asaas-access-token");
  const tokenEsperado = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  errorContext.token_presente = Boolean(webhookToken);

  if (!tokenEsperado || webhookToken !== tokenEsperado) {
    console.warn("Webhook token inválido");
    return new Response("Unauthorized", { status: 401, headers: CORS });
  }

  // ── Parse do payload ────────────────────────────────────────────────────
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400, headers: CORS });
  }

  const { evento, payment, subscription: sub, subId } = extrairAssinaturaAsaas(payload);
  errorContext.evento = evento;
  errorContext.asaas_payment_id = payment?.id ?? null;
  errorContext.asaas_sub_id = subId ?? null;

  console.log(`Webhook Asaas: ${evento}`, { paymentId: payment?.id, subId });

  // Ignora eventos não mapeados
  const acaoEvento = classificarEventoAsaas(evento);
  if (acaoEvento === "ignorar") {
    return Response.json({ ok: true, ignorado: true, evento }, { headers: CORS });
  }

  // ── Supabase (service role para bypassar RLS) ───────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Localiza o prestador ────────────────────────────────────────────────
  // Tenta pelo asaas_sub_id primeiro
  let prestador: any = null;

  if (subId) {
    const { data } = await supabase
      .from("prestadores")
      .select("id, plano, asaas_customer_id")
      .eq("asaas_sub_id", subId)
      .maybeSingle();
    prestador = data;
  }

  // Fallback: tenta pelo asaas_customer_id (útil no primeiro evento da assinatura)
  if (!prestador && payment?.customer) {
    const { data } = await supabase
      .from("prestadores")
      .select("id, plano, asaas_customer_id")
      .eq("asaas_customer_id", payment.customer)
      .maybeSingle();
    prestador = data;

    // Se achou pelo customer, salva o subId para próximos eventos
    if (prestador && subId) {
      await supabase
        .from("prestadores")
        .update({ asaas_sub_id: subId })
        .eq("id", prestador.id);
    }
  }

  if (!prestador) {
    console.warn("Prestador não encontrado — subId:", subId, "customer:", payment?.customer);
    return Response.json({ ok: true, ignorado: true }, { headers: CORS });
  }

  // ── Registra no histórico de pagamentos ────────────────────────────────
  const { error: erroPagamento } = await supabase.from("pagamentos").upsert({
    prestador_id:     prestador.id,
    asaas_payment_id: payment?.id ?? null,
    evento,
    valor:            payment?.value ?? null,
    billing_type:     payment?.billingType ?? null,
    data_evento:      new Date().toISOString(),
    payload:          payload,
  }, {
    onConflict: "asaas_payment_id,evento",
  });

  if (erroPagamento) {
    console.error("Erro ao salvar pagamento:", erroPagamento.message);
  } else {
    console.log("Pagamento registrado:", payment?.id);
  }

  // ── Ação por evento ────────────────────────────────────────────────────

  if (acaoEvento === "ativar") {
    const ciclo     = payment?.subscription?.cycle ?? sub?.cycle ?? "MONTHLY";
    const validoAte = calcularValidadeAte(ciclo);

    const { error } = await supabase
      .from("prestadores")
      .update({
        plano:                   "pro",
        plano_valido_ate:        validoAte.toISOString(),
        trial_usado:             true,
        assinatura_periodicidade: ciclo,  // Salva a periodicidade (MONTHLY ou YEARLY)
      })
      .eq("id", prestador.id);

    if (error) {
      console.error("Erro ao ativar Pro:", error);
      return Response.json({ erro: "Erro ao ativar plano" }, { status: 500, headers: CORS });
    }

    console.log(`✅ Pro ativado para ${prestador.id} até ${validoAte.toISOString()} (${ciclo})`);
    return Response.json({ ok: true, acao: "plano_ativado", valido_ate: validoAte }, { headers: CORS });
  }

  if (acaoEvento === "inadimplente") {
    // Não desativa agora — cron verifica plano_valido_ate com grace period de 3 dias
    console.log(`⚠️ Inadimplente: ${prestador.id} — aguarda cron`);
    return Response.json({ ok: true, acao: "grace_period_iniciado" }, { headers: CORS });
  }

  if (acaoEvento === "desativar") {
    // Usa função RPC para aplicar downgrade + limites Free
    const { error, data } = await supabase.rpc("downgrade_pro", {
      p_prestador_id: prestador.id,
    });

    if (error) {
      console.error("Erro ao rebaixar plano:", error);
      return Response.json({ erro: "Erro ao rebaixar plano" }, { status: 500, headers: CORS });
    }

    console.log(`🔴 Rebaixado para free + limites aplicados: ${prestador.id} (${evento})`);
    return Response.json({ ok: true, acao: "plano_rebaixado_limites_aplicados" }, { headers: CORS });
  }

  return Response.json({ ok: true }, { headers: CORS });
} catch (err) {
  // Captura erro no Sentry
  if (SENTRY_DSN) {
    Sentry.captureException(err, {
      tags: { function: "webhook-asaas" },
      extra: errorContext,
    });
  }
  
  console.error("Erro webhook-asaas:", err);
  return Response.json(
    { erro: "Erro interno no webhook" },
    { status: 500, headers: CORS }
  );
}
});
