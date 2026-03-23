// supabase/functions/check-inadimplencia/index.ts
//
// Verifica prestadores inadimplentes e rebaixa para plano free.
// Deve ser executado diariamente por um cron job externo.
//
// Responsável por:
//   - Verificar pagamentos atrasados (grace period de 3 dias)
//   - Rebaixar para free os planos vencidos há mais de 3 dias

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const tresDiasAtras = new Date();
  tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
  const limite = tresDiasAtras.toISOString();

  const { data: prestadoresInadimplentes, error } = await supabase
    .from("prestadores")
    .select("id, nome, email, plano, plano_valido_ate, asaas_sub_id")
    .eq("plano", "pro")
    .lt("plano_valido_ate", limite);

  if (error) {
    console.error("Erro ao buscar inadimplentes:", error);
    return Response.json({ erro: "Erro interno" }, { status: 500, headers: CORS });
  }

  if (!prestadoresInadimplentes || prestadoresInadimplentes.length === 0) {
    console.log("Nenhum prestador inadimplente encontrado");
    return Response.json({ ok: true, processados: 0 }, { headers: CORS });
  }

  console.log(`Encontrados ${prestadoresInadimplentes.length} prestadores inadimplentes`);

  for (const p of prestadoresInadimplentes) {
    const { error: updateError } = await supabase
      .from("prestadores")
      .update({
        plano: "free",
        plano_valido_ate: null,
        asaas_sub_id: null,
      })
      .eq("id", p.id);

    if (updateError) {
      console.error(`Erro ao rebaixar ${p.id}:`, updateError);
    } else {
      console.log(`🔴 Rebaixado para free: ${p.id} (${p.email})`);
    }
  }

  return Response.json(
    { ok: true, processados: prestadoresInadimplentes.length },
    { headers: CORS }
  );
});