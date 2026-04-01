// supabase/functions/entrada-lista-espera/index.ts
//
// Permite que um cliente entre na lista de espera para um horário específico
// Notifica quando uma vaga surge por cancelamento

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";

// Inicializa Sentry (se DSN configurado)
const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tracesSampleRate: 0.1,
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Envia WhatsApp via Evolution API (self-hosted)
async function enviarWhatsApp(telefone: string, mensagem: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "agendapro-prod";

  if (!evolutionUrl || !evolutionKey) {
    console.log("Evolution API não configurada, pulando envio de WhatsApp");
    return;
  }

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

    if (!res.ok) {
      console.error("Evolution API erro:", res.status);
      Sentry.captureMessage(`Evolution API erro ${res.status}`, { level: "warning" });
    }
  } catch (e) {
    console.error("Erro ao enviar WhatsApp:", e);
    Sentry.captureException(e);
  }
}

// Envia email via SendGrid
async function enviarEmail(to: string, subject: string, html: string) {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) {
    console.log("SendGrid não configurado, pulando envio de email");
    return;
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sendgridKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: "fabio-s-ramos@hotmail.com", name: "AgendaPro" },
        subject: subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!res.ok) {
      const erro = await res.text();
      console.error("SendGrid erro:", res.status, erro);
    }
  } catch (e) {
    console.error("Erro ao enviar email:", e);
    Sentry.captureException(e);
  }
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // Apenas POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ erro: "Método não permitido" }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Parse do body
    const body = await req.json();
    const {
      prestador_id,
      cliente_nome,
      cliente_telefone,
      cliente_email,
      data_preferida,
      hora_preferida,
      servico_nome,
    } = body;

    // Validações básicas
    if (!prestador_id || !cliente_nome || !cliente_telefone || !data_preferida || !hora_preferida) {
      return new Response(JSON.stringify({ erro: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    // Verificar se já existe entrada na lista de espera
    const { data: existente, error: erroBusca } = await supabase
      .from("lista_espera")
      .select("id")
      .eq("prestador_id", prestador_id)
      .eq("cliente_telefone", cliente_telefone)
      .eq("data_preferida", data_preferida)
      .eq("hora_preferida", hora_preferida)
      .eq("agendado", false)
      .single();

    if (erroBusca && erroBusca.code !== "PGRST116") {
      // PGRST116 = no rows found
      Sentry.captureException(erroBusca);
      return new Response(JSON.stringify({ erro: "Erro ao verificar lista de espera" }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    if (existente) {
      return new Response(JSON.stringify({ 
        erro: "Você já está na lista de espera para este horário",
        id: existente.id 
      }), {
        status: 409,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Inserir na lista de espera
    const { data: novaEntrada, error: erroInsert } = await supabase
      .from("lista_espera")
      .insert({
        prestador_id,
        cliente_nome,
        cliente_telefone,
        cliente_email: cliente_email || null,
        data_preferida,
        hora_preferida,
        servico_nome: servico_nome || null,
      })
      .select()
      .single();

    if (erroInsert) {
      Sentry.captureException(erroInsert);
      return new Response(JSON.stringify({ erro: "Erro ao entrar na lista de espera" }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Buscar dados do prestador para personalizar mensagem
    const { data: prestador } = await supabase
      .from("prestadores")
      .select("nome_fantasia, user_id")
      .eq("id", prestador_id)
      .single();

    const { data: user } = await supabase
      .from("users")
      .select("email")
      .eq("id", prestador?.user_id)
      .single();

    // Mensagem de confirmação para o cliente
    const dataFmt = new Date(data_preferida).toLocaleDateString("pt-BR");
    const mensagemWhatsApp = `🎉 *Lista de Espera - ${prestador?.nome_fantasia || "AgendaPro"}*\n\n` +
      `Oi ${cliente_nome.split(" ")[0]}! Você entrou na lista de espera para:\n\n` +
      `📅 Data: ${dataFmt}\n` +
      `⏰ Horário: ${hora_preferida}\n` +
      `${servico_nome ? `💇 Serviço: ${servico_nome}\n\n` : ""}` +
      `Te avisaremos imediatamente se uma vaga surgir! ⏰\n\n` +
      `Válido por 7 dias.`;

    // Envia WhatsApp (não bloqueante)
    enviarWhatsApp(cliente_telefone, mensagemWhatsApp);

    // Envia email se tiver email
    if (cliente_email) {
      const emailHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#c8f060">🎉 Lista de Espera</h2>
          <p>Você entrou na lista de espera para <strong>${prestador?.nome_fantase || "AgendaPro"}</strong>:</p>
          <ul>
            <li>📅 Data: ${dataFmt}</li>
            <li>⏰ Horário: ${hora_preferida}</li>
            ${servico_nome ? `<li>💇 Serviço: ${servico_nome}</li>` : ""}
          </ul>
          <p style="color:#8a8778;font-size:14px">Te avisaremos imediatamente se uma vaga surgir! Válido por 7 dias.</p>
        </div>
      `;
      enviarEmail(cliente_email, "✅ Você está na Lista de Espera!", emailHtml);
    }

    // Resposta de sucesso
    return new Response(JSON.stringify({
      sucesso: true,
      id: novaEntrada.id,
      mensagem: "Entrada na lista de espera confirmada",
    }), {
      status: 201,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error("Erro na edge function:", error);
    return new Response(JSON.stringify({ erro: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
