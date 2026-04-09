// supabase/functions/reverter-desconto/index.ts
//
// Reverte desconto de retenção expirado.
// Cancela a assinatura com desconto e cria nova com valor original.
//
// Chamada por cron job diário (pg_cron ou HTTP externo).
// Pode ser chamada manualmente via HTTP com service-role key.
//
// GET/POST (sem body necessário quando via cron)
// Header (opcional): Authorization: Bearer <service-role-key>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

const ASAAS_URL = "https://api.asaas.com/v3";

// Valores dos planos (deve bater com criar-assinatura e criar-cupom)
const PLANOS = {
  pro: { MONTHLY: 39.0, YEARLY: 348.0 },
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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  // Via cron, não há origin — permitir sem CORS check
  const isCron = !origin || origin === "null";

  if (!isCron && !validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = isCron ? {} : corsHeaders(origin);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar descontos expirados ainda não revertidos
    // Filtro tipo_desconto = mensal_imediato: plano YEARLY nunca recebe desconto (já tem 25% embutido)
    const { data: descontosExpirados, error: queryErr } = await supabase
      .from("cancelamentos")
      .select("*, prestadores!inner(id, nome, asaas_customer_id, asaas_sub_id, plano, assinatura_periodicidade)")
      .eq("recebeu_desconto", true)
      .eq("cancelamento_efetivado", false)
      .eq("tipo_desconto", "mensal_imediato")
      .lt("desconto_valido_ate", new Date().toISOString())
      .not("desconto_asaas_sub_id", "is", null)
      .not("assinatura_original_sub_id", "is", null);

    if (queryErr) {
      console.error("Erro ao buscar descontos expirados:", queryErr);
      return Response.json({ erro: "Erro na query", detalhe: queryErr }, { status: 500, headers: cors });
    }

    if (!descontosExpirados || descontosExpirados.length === 0) {
      console.log("Nenhum desconto expirado para reverter");
      return Response.json({ ok: true, revertidos: 0, mensagem: "Nenhum desconto expirado" }, { headers: cors });
    }

    console.log(`Encontrados ${descontosExpirados.length} descontos expirados para reverter`);

    const resultados: Array<{ prestador_id: string; status: string; erro?: string }> = [];

    for (const registro of descontosExpirados) {
      const prestador = registro.prestadores;
      const ciclo = prestador.assinatura_periodicidade || "MONTHLY";
      const planoKey = prestador.plano || "pro";
      const valorOriginal = PLANOS[planoKey]?.[ciclo] ?? 39.0;

      try {
        // 2. Buscar detalhes da assinatura com desconto ANTES de cancelar
        const subComDesconto = await asaas("GET", `/subscriptions/${registro.desconto_asaas_sub_id}`);
        const billingType = subComDesconto.billingType;
        const nextDueDate = subComDesconto.nextDueDate;
        console.log(`[REVERTER] Assinatura com desconto: billingType=${billingType}, nextDueDate=${nextDueDate}`);

        // 3. Cancelar assinatura com desconto no Asaas
        await asaas("DELETE", `/subscriptions/${registro.desconto_asaas_sub_id}`);
        console.log(`[REVERTER] Assinatura com desconto cancelada: ${registro.desconto_asaas_sub_id}`);

        // 4. Criar nova assinatura com valor original (mesmo billingType e nextDueDate)
        const nomePlano = planoKey === "pro" ? "Pro" : planoKey;
        const descricaoCiclo = ciclo === "YEARLY" ? "anual" : "mensal";
        const descricao = `AgendaPro ${nomePlano} — ${descricaoCiclo} (valor original)`;

        const novaAssinatura = await asaas("POST", "/subscriptions", {
          customer: prestador.asaas_customer_id,
          billingType: billingType,
          value: valorOriginal,
          nextDueDate: nextDueDate,
          cycle: ciclo,
          description: descricao,
          fine: { value: 2 },
          interest: { value: 1 },
          externalReference: `revertido-${prestador.id}-${Date.now()}`,
        });

        console.log(`Nova assinatura com valor original criada: ${novaAssinatura.id} = R$${valorOriginal}`);

        // 4. Atualizar prestador com novo sub_id
        await supabase
          .from("prestadores")
          .update({ asaas_sub_id: novaAssinatura.id })
          .eq("id", prestador.id);

        // 5. Marcar registro como revertido
        await supabase
          .from("cancelamentos")
          .update({ cancelamento_efetivado: true })
          .eq("id", registro.id);

        // 6. Log para analytics
        await supabase.from("pagamentos").insert({
          prestador_id: prestador.id,
          evento: "RETENTION_DISCOUNT_EXPIRED",
          data_evento: new Date().toISOString(),
          payload: {
            desconto_percentual: registro.desconto_percentual,
            meses_desconto: registro.meses_desconto,
            valor_com_desconto: valorOriginal * (1 - registro.desconto_percentual / 100),
            valor_restaurado: valorOriginal,
            assinatura_anterior: registro.desconto_asaas_sub_id,
            nova_assinatura: novaAssinatura.id,
          },
        });

        resultados.push({ prestador_id: prestador.id, status: "revertido" });

      } catch (err) {
        console.error(`Erro ao reverter desconto para prestador ${prestador.id}:`, err);
        resultados.push({ prestador_id: prestador.id, status: "erro", erro: String(err) });
      }
    }

    const revertidos = resultados.filter(r => r.status === "revertido").length;
    const erros = resultados.filter(r => r.status === "erro").length;

    return Response.json({
      ok: true,
      total_encontrados: descontosExpirados.length,
      revertidos,
      erros,
      detalhes: resultados,
    }, { headers: cors });

  } catch (err) {
    console.error("Erro reverter-desconto:", err);

    return Response.json({
      erro: "Erro interno",
      detalhe: String(err)
    }, { status: 500, headers: cors });
  }
});
