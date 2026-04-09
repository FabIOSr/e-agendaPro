// supabase/functions/registrar-cancelamento/index.ts
//
// Registra o motivo do cancelamento antes de efetivar o cancelamento no Asaas.
// 
// POST {
//   motivo: string,               // 'muito-caro', 'nao-uso', etc.
//   outro_motivo?: string         // se motivo = 'outro'
// }
// Header: Authorization: Bearer <supabase-jwt>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

const ASAAS_URL = "https://api.asaas.com/v3";

async function asaas(method: string, path: string, body?: any): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: {
      "access_token": Deno.env.get("ASAAS_API_KEY")!,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${ASAAS_URL}${path}`, opts);
  
  // Para GET, permitir 404 (verificação de existência)
  if (method === "GET" && res.status === 404) {
    throw new Error("NOT_FOUND");
  }
  
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Asaas ${res.status}: ${err}`);
  }
  return res.status !== 204 ? res.json() : null;
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
      .select("id, nome, asaas_customer_id, asaas_sub_id, plano, plano_valido_ate")
      .eq("id", user.id)
      .single();

    if (dbErr || !prestador) {
      return Response.json({ erro: "Prestador não encontrado" }, { status: 404, headers: cors });
    }

    if (!prestador.asaas_sub_id) {
      return Response.json({ erro: "Nenhuma assinatura ativa" }, { status: 400, headers: cors });
    }

    // 3. Validar body
    const body = await req.json();
    const { motivo, outro_motivo } = body;

    if (!motivo) {
      return Response.json({ 
        erro: "Motivo é obrigatório" 
      }, { status: 400, headers: cors });
    }

    // 4. Registrar cancelamento no banco (ANTES de chamar Asaas)
    const { error: insertErr } = await supabase.from("cancelamentos").insert({
      prestador_id: prestador.id,
      motivo,
      outro_motivo: motivo === "outro" ? (outro_motivo || null) : null,
      recebeu_desconto: false,
      cancelamento_efetivado: true,
    });

    if (insertErr) {
      console.error("Erro ao registrar cancelamento no banco:", insertErr);
      return Response.json({
        erro: "Erro ao registrar cancelamento",
        detalhe: insertErr.message
      }, { status: 500, headers: cors });
    }

    // 5. Cancelar no Asaas (DELETE = cancela ao fim do período)
    // Verificar se assinatura existe antes de deletar
    let assinaturaExiste = true;
    try {
      await asaas("GET", `/subscriptions/${prestador.asaas_sub_id}`);
    } catch (err) {
      // Se retornou 404, assinatura já foi cancelada/removida
      assinaturaExiste = false;
      console.warn(`Assinatura ${prestador.asaas_sub_id} não encontrada no Asaas (já cancelada?)`);
    }

    if (assinaturaExiste) {
      await asaas("DELETE", `/subscriptions/${prestador.asaas_sub_id}`);
      console.log(`Assinatura ${prestador.asaas_sub_id} cancelada no Asaas`);
    }

    // 6. Atualizar prestador (remove sub_id para não renovar)
    await supabase
      .from("prestadores")
      .update({ asaas_sub_id: null })
      .eq("id", prestador.id);

    // 7. Registrar evento de pagamento
    await supabase.from("pagamentos").insert({
      prestador_id: prestador.id,
      evento: "SUBSCRIPTION_CANCELLED_BY_USER",
      data_evento: new Date().toISOString(),
      payload: {
        cancelado_por: "usuario",
        motivo_cancelamento: motivo,
        plano_valido_ate: prestador.plano_valido_ate,
      },
    });

    const validoAte = prestador.plano_valido_ate
      ? new Date(prestador.plano_valido_ate).toLocaleDateString("pt-BR")
      : "data atual";

    return Response.json({
      ok: true,
      mensagem: `Assinatura cancelada. Seu plano Pro permanece ativo até ${validoAte}.`,
      motivo_registrado: motivo,
      plano_valido_ate: prestador.plano_valido_ate,
    }, { headers: cors });

  } catch (err) {
    console.error("Erro registrar-cancelamento:", err);
    
    return Response.json({ 
      erro: "Erro interno", 
      detalhe: String(err) 
    }, { status: 500, headers: cors });
  }
});
