// supabase/functions/solicitar-avaliacao-batch/index.ts
//
// Chamada pelo cron job a cada hora.
// Busca agendamentos CONCLUÍDOS entre 1h e 3h atrás que:
//   1. Ainda não têm avaliação registrada
//   2. Ainda não receberam solicitação de avaliação
//
// Envia mensagem WhatsApp com link para a página de avaliação.
//
// Cron: 0 * * * *  (todo início de hora)
//
// Variáveis de ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

async function enviarWhatsApp(telefone: string, mensagem: string): Promise<boolean> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "agendapro-prod";

  if (!evolutionUrl || !evolutionKey) return false;

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
    return res.ok;
  } catch (e) {
    console.error("WhatsApp error:", e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // CORS local antigo (substituído pelo módulo _shared/cors.ts)
  // if (req.method === "OPTIONS") {
  //   return new Response(null, {
  //     headers: {
  //       "Access-Control-Allow-Origin": "*",
  //       "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  //     },
  //   });
  // }

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const agora     = new Date();
  const tresHAtras = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const umaHAtras  = new Date(agora.getTime() - 1 * 60 * 60 * 1000);

  // Busca agendamentos concluídos entre 1h e 3h atrás
  // que ainda não têm avaliação E não têm solicitação enviada
  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select(`
      id,
      cliente_nome,
      cliente_tel,
      cancel_token,
      avaliacao_solicitada,
      prestadores ( nome )
    `)
    .eq("status", "concluido")
    .eq("avaliacao_solicitada", false)  // flag para evitar reenvio
    .gte("data_hora", tresHAtras.toISOString())
    .lte("data_hora", umaHAtras.toISOString());

  if (error) {
    console.error("Erro ao buscar agendamentos:", error);
    return Response.json({ erro: String(error) }, { status: 500 });
  }

  if (!agendamentos?.length) {
    return Response.json({ ok: true, processados: 0, mensagem: "Nenhum agendamento elegível." });
  }

  const BASE = Deno.env.get("SUPABASE_URL");
  let enviados = 0;
  const erros: string[] = [];

  for (const ag of agendamentos) {
    // Verifica se já existe avaliação (double-check além da flag)
    const { count } = await supabase
      .from("avaliacoes")
      .select("id", { count: "exact", head: true })
      .eq("agendamento_id", ag.id);

    if ((count ?? 0) > 0) {
      // Já avaliou — só atualiza a flag
      await supabase
        .from("agendamentos")
        .update({ avaliacao_solicitada: true })
        .eq("id", ag.id);
      continue;
    }

    const linkAvaliacao = `${BASE}/functions/v1/avaliacoes?token=${ag.cancel_token}`;

    const mensagem =
      `Olá, *${ag.cliente_nome}*! 😊\n\n` +
      `Como foi seu atendimento com *${ag.prestadores?.nome}*?\n\n` +
      `Sua avaliação ajuda muito e leva só 10 segundos:\n` +
      `⭐ ${linkAvaliacao}`;

    const ok = await enviarWhatsApp(ag.cliente_tel, mensagem);

    if (ok) {
      // Marca como solicitado para não reenviar
      await supabase
        .from("agendamentos")
        .update({ avaliacao_solicitada: true })
        .eq("id", ag.id);
      enviados++;
    } else {
      erros.push(`agendamento ${ag.id}`);
    }

    // Pausa entre envios para respeitar rate limit
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`Avaliações solicitadas: ${enviados}/${agendamentos.length}`);

  return Response.json({
    ok: true,
    total_elegivel: agendamentos.length,
    enviados,
    erros,
  });
});
