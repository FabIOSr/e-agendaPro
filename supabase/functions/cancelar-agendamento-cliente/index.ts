// supabase/functions/cancelar-agendamento-cliente/index.ts
//
// Cancela um agendamento pelo token único enviado no WhatsApp.
// Não requer autenticação — o token é a prova de identidade.
//
// GET /cancelar-agendamento-cliente?token=xxxx        → página de confirmação
// POST /cancelar-agendamento-cliente { token: "xxxx" } → executa o cancelamento
//
// O token é gerado no momento do agendamento e salvo na tabela agendamentos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

const ZAPI_URL = `https://api.z-api.io/instances/${Deno.env.get("ZAPI_INSTANCE_ID")}/token/${Deno.env.get("ZAPI_TOKEN")}/send-text`;

async function enviarWhatsApp(telefone: string, mensagem: string) {
  const token = Deno.env.get("ZAPI_TOKEN");
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
  
  if (!token || !instanceId || !clientToken) return;
  
  try {
    const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify({
        phone: telefone.replace(/\D/g, ""),
        message: mensagem,
      }),
    });
    
    if (!res.ok) {
      console.error("Z-API erro:", res.status);
    }
  } catch (e) {
    console.error("Erro ao enviar WhatsApp:", e);
  }
}

async function enviarEmail(to: string, subject: string, html: string) {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) return;

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
  }
}

// HTML da página de confirmação de cancelamento
function paginaConfirmacao(agendamento: any, token: string): string {
  const d = new Date(agendamento.data_hora);
  const dataFmt = d.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
    timeZone: "America/Sao_Paulo",
  });
  const horaFmt = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cancelar agendamento</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: system-ui, sans-serif; background: #f5f2eb; color: #0e0d0a;
         min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .card { background:#fff; border-radius:16px; padding:32px 28px; max-width:380px; width:100%;
          box-shadow:0 4px 24px rgba(0,0,0,.08); text-align:center; }
  .icon { font-size:40px; margin-bottom:16px; }
  h1 { font-size:22px; font-weight:600; margin-bottom:8px; }
  .info { background:#f5f2eb; border-radius:10px; padding:16px; margin:20px 0; text-align:left; }
  .info-row { display:flex; justify-content:space-between; font-size:14px; padding:5px 0;
              border-bottom:1px solid #e4dfd2; }
  .info-row:last-child { border-bottom:none; }
  .info-row span:first-child { color:#6b6860; }
  .info-row span:last-child  { font-weight:500; }
  p { font-size:14px; color:#6b6860; line-height:1.65; margin-bottom:20px; }
  .btn-cancel { width:100%; background:#c84830; color:#fff; border:none; border-radius:10px;
                padding:14px; font-size:15px; font-weight:600; cursor:pointer; margin-bottom:10px; }
  .btn-cancel:hover { background:#a83820; }
  .btn-voltar { width:100%; background:#f5f2eb; color:#6b6860; border:1px solid #d8d4c8;
                border-radius:10px; padding:13px; font-size:14px; cursor:pointer; }
  .btn-voltar:hover { background:#e4dfd2; }
  .cancelado { display:none; }
  .cancelado.show { display:block; }
  .original { }
  .original.hide { display:none; }
</style>
</head>
<body>
<div class="card">
  <div class="original" id="original">
    <div class="icon">📅</div>
    <h1>Cancelar agendamento?</h1>
    <p>Você está prestes a cancelar o seguinte agendamento com <strong>${agendamento.prestadores?.nome ?? "o prestador"}</strong>.</p>
    <div class="info">
      <div class="info-row"><span>Serviço</span><span>${agendamento.servicos?.nome ?? "—"}</span></div>
      <div class="info-row"><span>Data</span><span>${dataFmt}</span></div>
      <div class="info-row"><span>Horário</span><span>${horaFmt}</span></div>
      <div class="info-row"><span>Cliente</span><span>${agendamento.cliente_nome}</span></div>
    </div>
    <button class="btn-cancel" onclick="cancelar()">Confirmar cancelamento</button>
    <button class="btn-voltar" onclick="history.back()">Não, manter agendamento</button>
  </div>

  <div class="cancelado" id="cancelado">
    <div class="icon">✅</div>
    <h1>Agendamento cancelado</h1>
    <p>Seu agendamento foi cancelado com sucesso. O horário foi liberado automaticamente.</p>
    <p style="margin-top:8px">Se mudar de ideia, acesse novamente o link de agendamento.</p>
  </div>
</div>
<script>
async function cancelar() {
  document.querySelector('.btn-cancel').textContent = 'Cancelando…';
  document.querySelector('.btn-cancel').disabled = true;
  const res = await fetch(window.location.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: '${token}' }),
  });
  if (res.ok) {
    document.getElementById('original').classList.add('hide');
    document.getElementById('cancelado').classList.add('show');
  } else {
    document.querySelector('.btn-cancel').textContent = 'Erro — tente novamente';
    document.querySelector('.btn-cancel').disabled = false;
  }
}
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // GET → mostra página de confirmação
  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) return new Response("Token inválido", { status: 400 });

    const { data: ag, error } = await supabase
      .from("agendamentos")
      .select("*, servicos(nome, duracao_min), prestadores(nome, whatsapp)")
      .eq("cancel_token", token)
      .single();

    if (error || !ag) {
      return new Response(
        `<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
          <h2>Link inválido ou expirado</h2>
          <p style="color:#888;margin-top:8px">Este link de cancelamento não é mais válido.</p>
        </body></html>`,
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    if (ag.status === "cancelado") {
      return new Response(
        `<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
          <h2>✅ Agendamento já cancelado</h2>
          <p style="color:#888;margin-top:8px">Este agendamento já foi cancelado anteriormente.</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response(paginaConfirmacao(ag, token), {
      headers: { "Content-Type": "text/html", ...corsHeaders() },
    });
  }

  // POST → executa o cancelamento
  if (req.method === "POST") {
    const { token } = await req.json();
    if (!token) return Response.json({ erro: "Token ausente" }, { status: 400, headers: corsHeaders() });

    console.log("Tentando cancelar com token:", token);

    // Busca e cancela atomicamente
    const { data: ag, error } = await supabase
      .from("agendamentos")
      .update({ status: "cancelado" })
      .eq("cancel_token", token)
      .neq("status", "cancelado")   // idempotente
      .select("*, servicos(nome), prestadores(nome, whatsapp, email)")
      .single();

    console.log("Resultado cancelamento:", { ag, error });

    if (error || !ag) {
      return Response.json({ erro: "Agendamento não encontrado ou já cancelado" }, { status: 404, headers: corsHeaders() });
    }

    const d = new Date(ag.data_hora);
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

    // Notifica o prestador via WhatsApp
    if (ag.prestadores?.whatsapp) {
      try {
        await enviarWhatsApp(
          ag.prestadores.whatsapp,
          `❌ *Agendamento cancelado*\n\n` +
          `👤 *Cliente:* ${ag.cliente_nome}\n` +
          `📋 *Serviço:* ${ag.servicos?.nome}\n` +
          `📅 *Horário:* ${data} às ${hora}\n\n` +
          `O horário foi liberado automaticamente.`
        );
      } catch (e) {
        console.error("Erro ao notificar prestador:", e);
      }
    }

    // Notifica o prestador via email
    if (ag.prestadores?.email) {
      try {
        await enviarEmail(
          ag.prestadores.email,
          `❌ Agendamento cancelado por ${ag.cliente_nome}`,
          `<div style="font-family: sans-serif;">
            <h2>❌ Agendamento cancelado</h2>
            <p><strong>Cliente:</strong> ${ag.cliente_nome}</p>
            <p><strong>Serviço:</strong> ${ag.servicos?.nome}</p>
            <p><strong>Horário:</strong> ${data} às ${hora}</p>
            <p>O horário foi liberado automaticamente.</p>
          </div>`
        );
      } catch (e) {
        console.error("Erro ao enviar email para prestador:", e);
      }
    }

    return Response.json({ ok: true, mensagem: "Agendamento cancelado com sucesso." }, { headers: corsHeaders() });
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
});
