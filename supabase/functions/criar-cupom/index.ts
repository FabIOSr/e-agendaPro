// supabase/functions/criar-cupom/index.ts
//
// Aplica desconto de retenção no Asaas para evitar cancelamento.
//
// ESTRATÉGIA:
//
// MENSAL:
//   1. Capturar billingType e nextDueDate da assinatura atual
//   2. Cancelar assinatura atual (DELETE ao fim do período)
//   3. Criar nova com valor reduzido no MESMO nextDueDate (sem dupla cobrança)
//   4. Agendar reversão automática via cron
//
// ANUAL:
//   → NÃO oferecer desconto (já tem 25% embutido = 2 meses grátis)
//   → O cancelamento é tratado pela função registrar-cancelamento
//   → Esta função retorna erro se tentar aplicar desconto em anual
//
// POST {
//   desconto_percentual: number,  // 10-50
//   meses: number,                // 1-12
//   motivo: string,               // motivo do cancelamento
//   outro_motivo?: string         // se motivo = 'outro'
// }
// Header: Authorization: Bearer <supabase-jwt>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

const ASAAS_URL = "https://api.asaas.com/v3";

// Valores dos planos (deve bater com criar-assinatura)
const PLANOS = {
  pro: { MONTHLY: 39.0, YEARLY: 348.0 }, // 29x12 = 348
};

async function asaas(method: string, path: string, body?: any): Promise<any> {
  const url = `${ASAAS_URL}${path}`;
  console.log(`Asaas request: ${method} ${url}`);

  const opts: RequestInit = {
    method,
    headers: {
      "access_token": Deno.env.get("ASAAS_API_KEY")!,
      "Content-Type": "application/json",
    },
  };
  if (body) {
    opts.body = JSON.stringify(body);
    console.log(`Asaas body:`, JSON.stringify(body));
  }

  const res = await fetch(url, opts);
  const responseText = await res.text();
  console.log(`Asaas response status: ${res.status}`);
  console.log(`Asaas response:`, responseText.substring(0, 500));

  if (!res.ok) {
    throw new Error(`Asaas ${res.status}: ${responseText}`);
  }

  if (!responseText || responseText.startsWith('<')) {
    throw new Error(`Asaas retornou HTML em vez de JSON. Status: ${res.status}`);
  }

  try {
    return JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Erro ao parsear JSON do Asaas: ${responseText.substring(0, 200)}`);
  }
}

async function getSubscription(subId: string): Promise<any> {
  return asaas("GET", `/subscriptions/${subId}`);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  try {
    // 1. Autenticação
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) {
      return Response.json({ erro: "Não autenticado" }, { status: 401, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) {
      return Response.json({ erro: "Token inválido" }, { status: 401, headers: cors });
    }

    // 2. Buscar dados do prestador
    const { data: prestador, error: dbErr } = await supabase
      .from("prestadores")
      .select("id, nome, asaas_customer_id, asaas_sub_id, plano, plano_valido_ate, assinatura_periodicidade")
      .eq("id", user.id)
      .single();

    if (dbErr || !prestador) {
      return Response.json({ erro: "Prestador não encontrado" }, { status: 404, headers: cors });
    }

    if (!prestador.asaas_sub_id) {
      return Response.json({ erro: "Nenhuma assinatura ativa" }, { status: 400, headers: cors });
    }

    // 3. VALIDAR CICLO — desconto apenas para mensal
    const ciclo = prestador.assinatura_periodicidade || "MONTHLY";

    if (ciclo === "YEARLY") {
      return Response.json({
        erro: "Desconto de retenção disponível apenas para plano mensal. Seu plano anual já inclui o melhor preço (R$29/mês).",
        ciclo: "YEARLY",
        sugestao: "Prossiga com o cancelamento normal se desejar."
      }, { status: 400, headers: cors });
    }

    if (ciclo !== "MONTHLY") {
      return Response.json({
        erro: `Ciclo "${ciclo}" não suportado para desconto.`
      }, { status: 400, headers: cors });
    }

    // 4. Validar body
    const body = await req.json();
    const { desconto_percentual, meses, motivo, outro_motivo } = body;

    if (!desconto_percentual || !meses || !motivo) {
      return Response.json({
        erro: "Dados incompletos. Envie: desconto_percentual, meses, motivo"
      }, { status: 400, headers: cors });
    }

    if (desconto_percentual < 10 || desconto_percentual > 50) {
      return Response.json({
        erro: "Desconto deve ser entre 10% e 50%"
      }, { status: 400, headers: cors });
    }

    if (meses < 1 || meses > 12) {
      return Response.json({
        erro: "Meses deve ser entre 1 e 12"
      }, { status: 400, headers: cors });
    }

    // 5. Calcular valores
    const planoKey = prestador.plano || "pro";
    const valorOriginal = PLANOS[planoKey]?.[ciclo] ?? 39.0;
    const valorComDesconto = parseFloat((valorOriginal * (1 - desconto_percentual / 100)).toFixed(2));

    // 6. Buscar detalhes da assinatura atual ANTES de cancelar
    const subAtual = await getSubscription(prestador.asaas_sub_id);
    const billingType = subAtual.billingType;
    const nextDueDate = subAtual.nextDueDate;

    console.log(`[CUPOM] MENSAL — R$${valorOriginal} → R$${valorComDesconto} por ${meses} meses`);
    console.log(`[CUPOM] Assinatura atual: billingType=${billingType}, nextDueDate=${nextDueDate}`);

    if (!nextDueDate) {
      return Response.json({
        erro: "Não foi possível determinar a próxima data de cobrança."
      }, { status: 500, headers: cors });
    }

    // Desconto válido a partir do PRÓXIMO ciclo (nextDueDate), não de hoje
    const descontoValidoAte = new Date(nextDueDate);
    descontoValidoAte.setMonth(descontoValidoAte.getMonth() + meses);

    // 7. Cancelar assinatura atual no Asaas (DELETE = cancela ao fim do período)
    await asaas("DELETE", `/subscriptions/${prestador.asaas_sub_id}`);
    console.log(`[CUPOM] Assinatura antiga cancelada: ${prestador.asaas_sub_id}`);

    // 8. Criar nova assinatura com valor reduzido (mesmo billingType e nextDueDate)
    const nomePlano = planoKey === "pro" ? "Pro" : planoKey;
    const descricao = `AgendaPro ${nomePlano} — mensal (desconto ${desconto_percentual}%)`;
    const externalRef = `desconto-${prestador.id}-${Date.now()}`;

    const novaAssinatura = await asaas("POST", "/subscriptions", {
      customer: prestador.asaas_customer_id,
      billingType: billingType,
      value: valorComDesconto,
      nextDueDate: nextDueDate, // MESMO dia — sem dupla cobrança
      cycle: "MONTHLY",
      description: descricao,
      fine: { value: 2 },
      interest: { value: 1 },
      externalReference: externalRef,
    });

    console.log(`[CUPOM] Nova assinatura: ${novaAssinatura.id} = R$${valorComDesconto}/mês, nextDueDate=${nextDueDate}`);

    // 9. Atualizar prestador com novo sub_id
    await supabase
      .from("prestadores")
      .update({ asaas_sub_id: novaAssinatura.id })
      .eq("id", prestador.id);

    // 10. Registrar na tabela cancelamentos
    await supabase.from("cancelamentos").insert({
      prestador_id: prestador.id,
      motivo,
      outro_motivo: motivo === "outro" ? (outro_motivo || null) : null,
      recebeu_desconto: true,
      desconto_percentual,
      meses_desconto: meses,
      desconto_asaas_sub_id: novaAssinatura.id,
      desconto_valido_ate: descontoValidoAte.toISOString(),
      assinatura_original_sub_id: prestador.asaas_sub_id,
      cancelamento_efetivado: false,
      tipo_desconto: "mensal_imediato",
    });

    // 11. Log analytics
    await supabase.from("pagamentos").insert({
      prestador_id: prestador.id,
      evento: "RETENTION_OFFER_ACCEPTED",
      data_evento: new Date().toISOString(),
      payload: {
        ciclo: "MONTHLY",
        motivo_cancelamento: motivo,
        desconto_oferecido: desconto_percentual,
        meses_desconto: meses,
        valor_original: valorOriginal,
        valor_com_desconto: valorComDesconto,
        proximo_ciclo_em: nextDueDate,
        desconto_valido_ate: descontoValidoAte.toISOString(),
        nova_assinatura_id: novaAssinatura.id,
      },
    });

    const validoAteBR = descontoValidoAte.toLocaleDateString("pt-BR");
    const proximoCicloBR = new Date(nextDueDate).toLocaleDateString("pt-BR");
    const economiaMensal = ((valorOriginal - valorComDesconto) * meses).toFixed(2);

    return Response.json({
      ok: true,
      mensagem: `Desconto de ${desconto_percentual}% aplicado! A partir de ${proximoCicloBR}, você pagará R$${valorComDesconto}/mês até ${validoAteBR}. Economia total: R$${economiaMensal}`,
      ciclo: "MONTHLY",
      valor_original: valorOriginal,
      valor_com_desconto: valorComDesconto,
      proximo_ciclo_em: nextDueDate,
      desconto_valido_ate: descontoValidoAte.toISOString(),
    }, { headers: cors });

  } catch (err) {
    console.error("Erro criar-cupom:", err);

    return Response.json({
      erro: "Erro ao aplicar desconto",
      detalhe: String(err)
    }, { status: 500, headers: cors });
  }
});
