// supabase/functions/webhook-asaas/index.ts
//
// Recebe eventos do Asaas e atualiza o plano do prestador.
//
// Segurança: valida o header "asaas-access-token" contra ASAAS_WEBHOOK_TOKEN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

// Eventos que ATIVAM o plano Pro
const EVENTOS_ATIVAR = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
]);

// Eventos que DESATIVAM (volta ao free imediatamente)
const EVENTOS_DESATIVAR = new Set([
  "SUBSCRIPTION_DELETED",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
]);

// Eventos de inadimplência (grace period — cron cuida do downgrade)
const EVENTOS_INADIMPLENTE = new Set([
  "PAYMENT_OVERDUE",
]);

function calcularValidadeAte(ciclo: string): Date {
  const d = new Date();
  if (ciclo === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // MONTHLY e padrão
  return d;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  // ── Debug: log todos os headers ───────────────────────────────────────
  console.log("Headers recebidos:");
  for (const [k, v] of req.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }

  // ── Validação do token ──────────────────────────────────────────────────
  const webhookToken  = req.headers.get("asaas-access-token");
  const tokenEsperado = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

  console.log("Token esperado:", tokenEsperado ? "setado" : "NULO");
  console.log("Token recebido:", webhookToken);

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

  const evento  = payload.event as string;
  const payment = payload.payment;
  // subscription pode vir como objeto ou como string ID dentro de payment
  const sub     = payload.subscription ?? payment?.subscription;
  const subId   = typeof sub === "string" ? sub : sub?.id;

  console.log(`Webhook Asaas: ${evento}`, { paymentId: payment?.id, subId });

  // Ignora eventos não mapeados
  const importa =
    EVENTOS_ATIVAR.has(evento) ||
    EVENTOS_DESATIVAR.has(evento) ||
    EVENTOS_INADIMPLENTE.has(evento);

  if (!importa) {
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
  const { error: erroPagamento } = await supabase.from("pagamentos").insert({
    prestador_id:     prestador.id,
    asaas_payment_id: payment?.id ?? null,
    evento,
    valor:            payment?.value ?? null,
    billing_type:     payment?.billingType ?? null,
    data_evento:      new Date().toISOString(),
    payload:          payload,
  });

  if (erroPagamento) {
    console.error("Erro ao salvar pagamento:", erroPagamento.message);
  } else {
    console.log("Pagamento registrado:", payment?.id);
  }

  // ── Ação por evento ────────────────────────────────────────────────────

  if (EVENTOS_ATIVAR.has(evento)) {
    const ciclo     = payment?.subscription?.cycle ?? sub?.cycle ?? "MONTHLY";
    const validoAte = calcularValidadeAte(ciclo);

    const { error } = await supabase
      .from("prestadores")
      .update({
        plano:            "pro",
        plano_valido_ate:  validoAte.toISOString(),
        trial_usado:      true,
      })
      .eq("id", prestador.id);

    if (error) {
      console.error("Erro ao ativar Pro:", error);
      return Response.json({ erro: "Erro ao ativar plano" }, { status: 500, headers: CORS });
    }

    console.log(`✅ Pro ativado para ${prestador.id} até ${validoAte.toISOString()}`);
    return Response.json({ ok: true, acao: "plano_ativado", valido_ate: validoAte }, { headers: CORS });
  }

  if (EVENTOS_INADIMPLENTE.has(evento)) {
    // Não desativa agora — cron verifica plano_valido_ate com grace period de 3 dias
    console.log(`⚠️ Inadimplente: ${prestador.id} — aguarda cron`);
    return Response.json({ ok: true, acao: "grace_period_iniciado" }, { headers: CORS });
  }

  if (EVENTOS_DESATIVAR.has(evento)) {
    const { error } = await supabase
      .from("prestadores")
      .update({
        plano:            "free",
        plano_valido_ate:  null,
        asaas_sub_id:     null,
      })
      .eq("id", prestador.id);

    if (error) {
      console.error("Erro ao rebaixar plano:", error);
      return Response.json({ erro: "Erro ao rebaixar plano" }, { status: 500, headers: CORS });
    }

    console.log(`🔴 Rebaixado para free: ${prestador.id} (${evento})`);
    return Response.json({ ok: true, acao: "plano_rebaixado" }, { headers: CORS });
  }

  return Response.json({ ok: true }, { headers: CORS });
});