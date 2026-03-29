// supabase/functions/cancelar-assinatura/index.ts
//
// Cancela a assinatura no Asaas e registra no Supabase.
// O plano continua Pro até o fim do período já pago (plano_valido_ate).
// O downgrade para free acontece via cron job quando a data vence.
//
// POST {} (sem body — usa o JWT para identificar o prestador)
// Header: Authorization: Bearer <supabase-jwt>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_URL = "https://api.asaas.com/v3";

async function asaas(method: string, path: string): Promise<any> {
  const res = await fetch(`${ASAAS_URL}${path}`, {
    method,
    headers: { "access_token": Deno.env.get("ASAAS_API_KEY")! },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Asaas ${res.status}: ${err}`);
  }
  return res.status !== 204 ? res.json() : null;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return Response.json({ erro: "Não autenticado" }, { status: 401, headers: CORS_HEADERS });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return Response.json({ erro: "Token inválido" }, { status: 401, headers: CORS_HEADERS });

    const { data: prestador } = await supabase
      .from("prestadores")
      .select("id, plano, asaas_sub_id, plano_valido_ate")
      .eq("id", user.id)
      .single();

    if (!prestador?.asaas_sub_id) {
      return Response.json({ erro: "Nenhuma assinatura ativa encontrada." }, { status: 400, headers: CORS_HEADERS });
    }

    // Cancela no Asaas (DELETE = cancela ao fim do período)
    await asaas("DELETE", `/subscriptions/${prestador.asaas_sub_id}`);

    // Marca como "cancelando" — permanece Pro até plano_valido_ate
    // O webhook SUBSCRIPTION_DELETED pode demorar; garantimos o estado aqui
    await supabase
      .from("prestadores")
      .update({ asaas_sub_id: null }) // remove o sub_id para não renovar
      .eq("id", prestador.id);

    // Registra o evento
    await supabase.from("pagamentos").insert({
      prestador_id:     prestador.id,
      evento:           "SUBSCRIPTION_CANCELLED_BY_USER",
      data_evento:      new Date().toISOString(),
      payload:          { cancelado_por: "usuario", plano_valido_ate: prestador.plano_valido_ate },
    });

    const validoAte = prestador.plano_valido_ate
      ? new Date(prestador.plano_valido_ate).toLocaleDateString("pt-BR")
      : "data atual";

    return Response.json(
      {
        ok: true,
        mensagem: `Assinatura cancelada. Seu plano Pro permanece ativo até ${validoAte}.`,
        plano_valido_ate: prestador.plano_valido_ate,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Erro cancelar-assinatura:", err);
    return Response.json({ erro: "Erro interno", detalhe: String(err) }, { status: 500, headers: CORS_HEADERS });
  }
});
