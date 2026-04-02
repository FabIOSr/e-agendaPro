// supabase/functions/notificar-lista-espera/index.ts
//
// Envia notificações para clientes na lista de espera quando uma vaga surge
// Disparada por webhook ou trigger após cancelamento de agendamento

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
    return false;
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
      return false;
    }
    return true;
  } catch (e) {
    console.error("Erro ao enviar WhatsApp:", e);
    Sentry.captureException(e);
    return false;
  }
}

// Envia email via SendGrid
async function enviarEmail(to: string, subject: string, html: string) {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) {
    console.log("SendGrid não configurado, pulando envio de email");
    return false;
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
      return false;
    }
    return true;
  } catch (e) {
    console.error("Erro ao enviar email:", e);
    Sentry.captureException(e);
    return false;
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

    const body = await req.json();
    const { prestador_id, data, hora } = body;

    if (!prestador_id || !data || !hora) {
      return new Response(JSON.stringify({ erro: "Dados incompletos" }), {
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

    // Buscar primeiro cliente na lista de espera (FIFO)
    const { data: clienteNaEspera, error: erroBusca } = await supabase
      .from("lista_espera")
      .select("*")
      .eq("prestador_id", prestador_id)
      .eq("data_preferida", data)
      .eq("agendado", false)
      .eq("notificado", false)
      .order("criado_em", { ascending: true })
      .limit(1)
      .single();

    if (erroBusca && erroBusca.code !== "PGRST116") {
      Sentry.captureException(erroBusca);
      return new Response(JSON.stringify({ erro: "Erro ao buscar lista de espera" }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    if (!clienteNaEspera) {
      return new Response(JSON.stringify({ mensagem: "Ninguém na lista de espera" }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Buscar dados do prestador
    const { data: prestador } = await supabase
      .from("prestadores")
      .select("nome_fantasia")
      .eq("id", prestador_id)
      .single();

    // Formatar dados
    const dataFmt = new Date(clienteNaEspera.data_preferida).toLocaleDateString("pt-BR");
    const horaFmt = clienteNaEspera.hora_preferida;
    const nomeCliente = clienteNaEspera.cliente_nome.split(" ")[0];

    // Mensagem WhatsApp
    const mensagemWhatsApp = `🎉 *VAGA LIBEROU - ${prestador?.nome_fantasia || "AgendaPro"}*\n\n` +
      `Oi ${nomeCliente}! Uma vaga surgiu para o horário que você queria:\n\n` +
      `📅 Data: ${dataFmt}\n` +
      `⏰ Horário: ${horaFmt}\n` +
      `${clienteNaEspera.servico_nome ? `💇 Serviço: ${clienteNaEspera.servico_nome}\n\n` : ""}` +
      `⚡ *Corre que é por ordem de chegada!*\n\n` +
      `Reserve agora: ${Deno.env.get("APP_URL") || "https://e-agendapro.web.app"}`;

    // Envia WhatsApp
    const whatsappEnviado = await enviarWhatsApp(clienteNaEspera.cliente_telefone, mensagemWhatsApp);

    // Envia email se tiver email
    let emailEnviado = false;
    if (clienteNaEspera.cliente_email) {
      const emailHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#c8f060">🎉 Vaga Liberou!</h2>
          <p style="font-size:16px">Oi ${nomeCliente}!</p>
          <p>Uma vaga surgiu para o horário que você queria na <strong>${prestador?.nome_fantasia || "AgendaPro"}</strong>:</p>
          <div style="background:#f2f0ea;padding:16px;border-radius:8px;margin:16px 0">
            <ul style="margin:0;padding-left:20px">
              <li>📅 Data: ${dataFmt}</li>
              <li>⏰ Horário: ${horaFmt}</li>
              ${clienteNaEspera.servico_nome ? `<li>💇 Serviço: ${clienteNaEspera.servico_nome}</li>` : ""}
            </ul>
          </div>
          <p style="color:#8a8778;font-size:14px">⚡ <strong>Corre que é por ordem de chegada!</strong> Reserve agora pelo app.</p>
          <a href="${Deno.env.get("APP_URL") || "https://e-agendapro.web.app"}" 
             style="display:inline-block;background:#c8f060;color:#1a2a08;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">
            Reservar Agora
          </a>
        </div>
      `;
      emailEnviado = await enviarEmail(clienteNaEspera.cliente_email, "🎉 Vaga Liberou!", emailHtml);
    }

    // Atualizar status para notificado
    await supabase
      .from("lista_espera")
      .update({
        notificado: true,
        notificado_em: new Date().toISOString(),
      })
      .eq("id", clienteNaEspera.id);

    return new Response(JSON.stringify({
      sucesso: true,
      cliente: clienteNaEspera.cliente_nome,
      whatsapp: whatsappEnviado,
      email: emailEnviado,
    }), {
      status: 200,
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
