// supabase/functions/lembrete-avaliacao-2a-chance/index.ts
//
// Chamada pelo cron job a cada 6h.
// Busca agendamentos CONCLUÍDOS que:
//   1. Já receberam solicitação de avaliação (avaliacao_solicitada = true)
//   2. Ainda não têm avaliação registrada
//   3. Não receberam segunda chance ainda
//   4. DATA entre 24h e 72h atrás
//
// Envia mensagem de "lembrete" solicitando avaliação.
//
// Cron: 0 */6 * * *  (a cada 6 horas)
//

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

async function enviarEmail(destinatario: string, nome: string, link: string, nomePrestador: string): Promise<boolean> {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) return false;

  const html = `
    <div style="font-family:sans-serif;max-width:400px;margin:auto;text-align:center;padding:20px">
      <div style="background:#f5f2eb;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;font-weight:700;color:#8ab830">
        ${nome.charAt(0)}
      </div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:6px">Passando rapidinho... 😊</h2>
      <p style="font-size:14px;color:#6b6860;margin-bottom:24px;line-height:1.6">
        Oi, ${nome}! Você esqueceu de avaliar seu atendimento com ${nomePrestador}.<br>Leva 10 segundos e ajuda muito!
      </p>
      <a href="${link}" style="
        display:inline-block;background:#0e0d0a;color:#f0ede6;
        padding:14px 32px;border-radius:10px;text-decoration:none;
        font-size:15px;font-weight:600;
      ">⭐ Avaliar agora</a>
      <p style="font-size:12px;color:#999;margin-top:20px">
        Com ${nomePrestador}
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: destinatario }] }],
        from: { email: "nao-responda@agendapro.com.br", name: "AgendaPro" },
        subject: "Lembrete: Como foi seu atendimento? ⭐",
        content: [{ type: "text/html", value: html }],
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("Email error:", e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const agora = new Date();
  const setentaDuasHAtras = new Date(agora.getTime() - 72 * 60 * 60 * 1000);
  const vinteQuatroHAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

  // Busca agendamentos elegíveis para segunda chance
  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select(`
      id,
      cliente_nome,
      cliente_tel,
      cliente_email,
      cancel_token,
      avaliacao_segunda_chance,
      prestadores ( nome )
    `)
    .eq("status", "concluido")
    .eq("avaliacao_solicitada", true)
    .eq("avaliacao_segunda_chance", false)
    .gte("data_hora", setentaDuasHAtras.toISOString())
    .lte("data_hora", vinteQuatroHAtras.toISOString());

  if (error) {
    console.error("Erro ao buscar agendamentos:", error);
    return Response.json({ erro: String(error) }, { status: 500 });
  }

  if (!agendamentos?.length) {
    return Response.json({ ok: true, processados: 0, mensagem: "Nenhum agendamento elegível para segunda chance." });
  }

  const BASE = Deno.env.get("SUPABASE_URL");
  let enviados = 0;
  const erros: string[] = [];

  for (const ag of agendamentos) {
    // Double-check: ainda não tem avaliação?
    const { count } = await supabase
      .from("avaliacoes")
      .select("id", { count: "exact", head: true })
      .eq("agendamento_id", ag.id);

    if ((count ?? 0) > 0) {
      // Já avaliou — marca segunda chance como true para não tentar novamente
      await supabase
        .from("agendamentos")
        .update({ avaliacao_segunda_chance: true })
        .eq("id", ag.id);
      continue;
    }

    const linkAvaliacao = `${BASE}/functions/v1/avaliacoes?token=${ag.cancel_token}`;

    const mensagem =
      `Oi, *${ag.cliente_nome}*! 😊 Passando rapidinho...\n\n` +
      `Você esqueceu de avaliar seu atendimento com *${ag.prestadores?.nome}*.\n` +
      `Leva 10 segundos e ajuda muito a gente:\n` +
      `⭐ ${linkAvaliacao}`;

    // Tenta WhatsApp primeiro, depois email
    let ok = await enviarWhatsApp(ag.cliente_tel, mensagem);

    if (!ok && ag.cliente_email) {
      ok = await enviarEmail(ag.cliente_email, ag.cliente_nome, linkAvaliacao, ag.prestadores?.nome);
    }

    // Sempre marca como enviado (evita retry infinito)
    await supabase
      .from("agendamentos")
      .update({ avaliacao_segunda_chance: true })
      .eq("id", ag.id);

    if (ok) {
      enviados++;
    } else {
      erros.push(`agendamento ${ag.id}`);
    }

    // Pausa entre envios
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`Segunda chance: ${enviados}/${agendamentos.length}`);

  return Response.json({
    ok: true,
    total_elegivel: agendamentos.length,
    enviados,
    erros,
  });
});