// supabase/functions/webhook-asaas/index.ts
//
// Recebe TODOS os eventos do Asaas e:
//   - PAYMENT_RECEIVED   → ativa plano Pro
//   - PAYMENT_OVERDUE    → marca plano como inadimplente (grace period de 3 dias)
//   - PAYMENT_DELETED /
//     SUBSCRIPTION_DELETED → rebaixa para free imediatamente
//
// Configurar no painel do Asaas:
//   Minha Conta → Integrações → Webhooks → URL da Edge Function
//   Eventos: todos (ou pelo menos os 4 acima)
//
// Segurança: o Asaas envia o header "asaas-access-token" com o valor
// que você cadastrou no painel. Validamos antes de processar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Eventos que ATIVAM o plano Pro
const EVENTOS_ATIVAR = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
]);

// Eventos que DESATIVAM (volta ao free)
const EVENTOS_DESATIVAR = new Set([
  "SUBSCRIPTION_DELETED",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
]);

// Eventos de inadimplência (grace period — não desativa imediatamente)
const EVENTOS_INADIMPLENTE = new Set([
  "PAYMENT_OVERDUE",
]);

// ---------------------------------------------------------------------------
// Calcula a data de validade do plano baseado no ciclo
// ---------------------------------------------------------------------------
function calcularValidadeAte(ciclo: string): Date {
  const d = new Date();
  if (ciclo === "MONTHLY") d.setMonth(d.getMonth() + 1);
  else if (ciclo === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // padrão mensal
  return d;
}

// ---------------------------------------------------------------------------
// Handler HTTP
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // Asaas envia POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Validação de segurança: token no header
  const webhookToken = req.headers.get("asaas-access-token");
  const tokenEsperado = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

  if (!tokenEsperado || webhookToken !== tokenEsperado) {
    console.warn("Webhook com token inválido:", webhookToken);
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const evento   = payload.event as string;
  const payment  = payload.payment;
  const sub      = payload.subscription ?? payment?.subscription;

  console.log(`Webhook Asaas: ${evento}`, { paymentId: payment?.id, subId: sub?.id ?? sub });

  // Ignora eventos que não nos interessam
  const importa =
    EVENTOS_ATIVAR.has(evento) ||
    EVENTOS_DESATIVAR.has(evento) ||
    EVENTOS_INADIMPLENTE.has(evento);

  if (!importa) {
    return Response.json({ ok: true, ignorado: true, evento });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Resolve o ID da assinatura (pode vir em formatos diferentes)
  const subId = typeof sub === "string" ? sub : sub?.id;
  if (!subId) {
    console.warn("Webhook sem subscription ID, ignorando.");
    return Response.json({ ok: true, ignorado: true });
  }

  // Busca o prestador pelo ID da assinatura
  const { data: prestador, error: pErr } = await supabase
    .from("prestadores")
    .select("id, plano")
    .eq("asaas_sub_id", subId)
    .single();

  if (pErr || !prestador) {
    // Pode ser uma assinatura de outro produto — ignora silenciosamente
    console.warn("Prestador não encontrado para sub_id:", subId);
    return Response.json({ ok: true, ignorado: true });
  }

  // Registra o evento no histórico de pagamentos
  const { error: logErr } = await supabase.from("pagamentos").insert({
    prestador_id:      prestador.id,
    asaas_payment_id:  payment?.id ?? null,
    evento,
    valor:             payment?.value ?? null,
    billing_type:      payment?.billingType ?? null,
    data_evento:       new Date().toISOString(),
    payload,
  });
  if (logErr) console.error("Erro ao registrar pagamento:", logErr);

  // ── AÇÃO BASEADA NO EVENTO ──────────────────────────────────────────────

  if (EVENTOS_ATIVAR.has(evento)) {
    // Pagamento recebido → ativa Pro até o próximo ciclo
    const ciclo = payment?.subscription?.cycle ?? "MONTHLY";
    const validoAte = calcularValidadeAte(ciclo);

    const { error } = await supabase
      .from("prestadores")
      .update({
        plano:           "pro",
        plano_valido_ate: validoAte.toISOString(),
        trial_usado:     true,
      })
      .eq("id", prestador.id);

    if (error) throw error;

    console.log(`✅ Plano Pro ativado para ${prestador.id} até ${validoAte.toISOString()}`);
    return Response.json({ ok: true, acao: "plano_ativado", valido_ate: validoAte });
  }

  if (EVENTOS_INADIMPLENTE.has(evento)) {
    // Vencido → grace period de 3 dias antes de bloquear
    // (cron job separado verifica plano_valido_ate e faz o downgrade)
    // Aqui apenas logamos — não rebaixamos ainda
    console.log(`⚠️  Pagamento vencido para ${prestador.id}, grace period ativo`);
    return Response.json({ ok: true, acao: "grace_period_iniciado" });
  }

  if (EVENTOS_DESATIVAR.has(evento)) {
    // Cancelamento ou estorno → rebaixa para free imediatamente
    const { error } = await supabase
      .from("prestadores")
      .update({
        plano:            "free",
        plano_valido_ate:  null,
        asaas_sub_id:      null,
      })
      .eq("id", prestador.id);

    if (error) throw error;

    console.log(`🔴 Plano rebaixado para free: ${prestador.id} (evento: ${evento})`);
    return Response.json({ ok: true, acao: "plano_rebaixado" });
  }

  return Response.json({ ok: true });
});
