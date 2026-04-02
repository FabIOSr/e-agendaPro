// supabase/functions/lista-espera/index.ts
//
// Edge Function unificada para Lista de Espera Inteligente 2.1
// Ações: entrar, sair, notificar, cleanup
//
// POST { action: 'entrar', ...dados }
// POST { action: 'sair', id }
// POST { action: 'notificar', prestador_id, data, hora }
// POST { action: 'cleanup' } // cron job diário

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";

// Inicializa Sentry
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

// Envia WhatsApp via Evolution API
async function enviarWhatsApp(telefone: string, mensagem: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "agendapro-prod";

  if (!evolutionUrl || !evolutionKey) {
    console.log("Evolution API não configurada");
    return false;
  }

  try {
    const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": evolutionKey },
      body: JSON.stringify({
        number: telefone.replace(/\D/g, ""),
        textMessage: { text: mensagem },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("Erro WhatsApp:", e);
    Sentry.captureException(e);
    return false;
  }
}

// Envia email via SendGrid
async function enviarEmail(to: string, subject: string, html: string) {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) return false;

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
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("Erro Email:", e);
    return false;
  }
}

// Verifica preferência de horário
function prefereHorario(
  tipo: string,
  horaPreferida: string | null,
  periodoPreferido: string | null,
  horaDisponivel: string
): boolean {
  if (tipo === 'qualquer') return true;

  if (tipo === 'exato' && horaPreferida) {
    return horaDisponivel === horaPreferida;
  }

  if (tipo === 'periodo' && periodoPreferido) {
    const horaNum = parseInt(horaDisponivel.split(':')[0]);
    if (periodoPreferido === 'manha') return horaNum >= 8 && horaNum <= 12;
    if (periodoPreferido === 'tarde') return horaNum >= 13 && horaNum <= 18;
    if (periodoPreferido === 'noite') return horaNum >= 19 && horaNum <= 21;
  }

  return false;
}

// Ação: ENTRAR na lista de espera
async function entrarListaEspera(body: any, supabase: any) {
  const {
    prestador_id,
    cliente_nome,
    cliente_telefone,
    cliente_email,
    data_preferida,
    hora_preferida,
    servico_id,
    servico_nome,
    servico_duracao_min,
    tipo_preferencia = 'exato',
    periodo_preferido,
  } = body;

  // Validações básicas
  if (!prestador_id || !cliente_nome || !cliente_telefone || !data_preferida) {
    return {
      status: 400,
      body: { erro: "Campos obrigatórios faltando" },
    };
  }

  // Busca dados do prestador para mensagem
  const { data: prestador } = await supabase
    .from("prestadores")
    .select("nome_fantasia, whatsapp")
    .eq("id", prestador_id)
    .single();

  // Verifica duplicidade
  const { data: existente } = await supabase
    .from("lista_espera")
    .select("id")
    .eq("cliente_telefone", cliente_telefone)
    .eq("data_preferida", data_preferida)
    .eq("hora_preferida", hora_preferida || null)
    .eq("servico_id", servico_id || null)
    .eq("status", "ativa")
    .single();

  if (existente) {
    return {
      status: 409,
      body: { erro: "Você já está na lista de espera para este horário" },
    };
  }

  // Insere na lista
  const { data: nova, error: erroInsert } = await supabase
    .from("lista_espera")
    .insert({
      prestador_id,
      cliente_nome,
      cliente_telefone,
      cliente_email,
      data_preferida,
      hora_preferida,
      servico_id,
      servico_nome,
      servico_duracao_min,
      tipo_preferencia,
      periodo_preferido,
      status: 'ativa',
    })
    .select()
    .single();

  if (erroInsert) {
    Sentry.captureException(erroInsert);
    return {
      status: 500,
      body: { erro: "Erro ao entrar na lista de espera" },
    };
  }

  // Mensagem WhatsApp
  const dataFmt = new Date(data_preferida).toLocaleDateString("pt-BR");
  const horaDisplay = tipo_preferencia === 'exato'
    ? (hora_preferida || 'A definir')
    : (tipo_preferencia === 'periodo' ? `Período: ${periodo_preferido}` : 'Qualquer horário');

  const mensagemWhatsApp = `🎉 *Lista de Espera - ${prestador?.nome_fantasia || "AgendaPro"}*\n\n` +
    `Oi ${cliente_nome.split(" ")[0]}! Você entrou na lista de espera para:\n\n` +
    `📅 Data: ${dataFmt}\n` +
    `⏰ Preferência: ${horaDisplay}\n` +
    `${servico_nome ? `💇 Serviço: ${servico_nome} (${servico_duracao_min} min)\n\n` : ""}` +
    `Te avisaremos se uma vaga surgir! ⏰\n\n` +
    `Você será notificado(a) até 2h antes do horário.`;

  // Envia WhatsApp (não bloqueante)
  enviarWhatsApp(cliente_telefone, mensagemWhatsApp);

  // Envia email se tiver email
  if (cliente_email) {
    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#c8f060">🎉 Lista de Espera</h2>
        <p>Você entrou na lista de espera para <strong>${prestador?.nome_fantasia || "AgendaPro"}</strong>:</p>
        <div style="background:#f2f0ea;padding:16px;border-radius:8px;margin:16px 0">
          <ul style="margin:0;padding-left:20px">
            <li>📅 Data: ${dataFmt}</li>
            <li>⏰ Preferência: ${horaDisplay}</li>
            ${servico_nome ? `<li>💇 Serviço: ${servico_nome} (${servico_duracao_min} min)</li>` : ""}
          </ul>
        </div>
        <p style="color:#8a8778;font-size:14px">Te avisaremos se uma vaga surgir! Notificações até 2h antes do horário.</p>
      </div>
    `;
    enviarEmail(cliente_email, "✅ Você está na Lista de Espera!", emailHtml);
  }

  return {
    status: 201,
    body: { sucesso: true, data: nova },
  };
}

// Ação: SAIR da lista de espera
async function sairListaEspera(body: any, supabase: any, userId: string) {
  const { id } = body;

  if (!id) {
    return {
      status: 400,
      body: { erro: "ID da entrada não informado" },
    };
  }

  // Atualiza status para 'desistiu'
  const { error: erroUpdate } = await supabase
    .from("lista_espera")
    .update({
      status: 'desistiu',
      status_atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "ativa");

  if (erroUpdate) {
    Sentry.captureException(erroUpdate);
    return {
      status: 500,
      body: { erro: "Erro ao sair da lista de espera" },
    };
  }

  return {
    status: 200,
    body: { sucesso: true, mensagem: "Você saiu da lista de espera" },
  };
}

// Ação: NOTIFICAR clientes (usado por webhook de cancelamento)
async function notificarListaEspera(body: any, supabase: any) {
  const { prestador_id, data, hora, servico_id } = body;

  if (!prestador_id || !data) {
    return {
      status: 400,
      body: { erro: "prestador_id e data são obrigatórios" },
    };
  }

  // Busca clientes na lista para este prestador/data
  const { data: clientes, error: erroBusca } = await supabase
    .from("lista_espera")
    .select("*")
    .eq("prestador_id", prestador_id)
    .eq("data_preferida", data)
    .in("status", ["ativa", "notificada"])
    .order("criado_em", { ascending: true });

  if (erroBusca) {
    Sentry.captureException(erroBusca);
    return {
      status: 500,
      body: { erro: "Erro ao buscar lista de espera" },
    };
  }

  if (!clientes || clientes.length === 0) {
    return {
      status: 200,
      body: { mensagem: "Ninguém na lista de espera para esta data" },
    };
  }

  let notificados = 0;

  // Notifica cada cliente compatível
  for (const cliente of clientes) {
    // Verifica compatibilidade de horário
    if (hora && !prefereHorario(
      cliente.tipo_preferencia,
      cliente.hora_preferida,
      cliente.periodo_preferido,
      hora
    )) {
      continue;
    }

    // Verifica antecedência mínima (2 horas)
    if (hora) {
      const agora = new Date();
      const horarioSlot = new Date(`${data}T${hora}`);
      const diffHoras = (horarioSlot.getTime() - agora.getTime()) / (1000 * 60 * 60);
      
      if (diffHoras < 2) {
        console.log(`⏰ Pulando ${hora}: apenas ${diffHoras.toFixed(1)}h de antecedência`);
        continue;
      }
    }

    // Envia notificação
    const dataFmt = new Date(cliente.data_preferida).toLocaleDateString("pt-BR");
    const nomeCliente = cliente.cliente_nome.split(" ")[0];

    const mensagemWhatsApp = `🎉 *VAGA LIBEROU!*

Oi ${nomeCliente}! Uma vaga surgiu que pode te interessar:

📅 Data: ${dataFmt}
⏰ Horário: ${hora || 'A confirmar'}
${cliente.servico_nome ? `💇 Serviço: ${cliente.servico_nome}\n` : ""}
⚡ *Corre que é por ordem de chegada!*`;

    enviarWhatsApp(cliente.cliente_telefone, mensagemWhatsApp);

    // Atualiza status
    await supabase
      .from("lista_espera")
      .update({
        status: 'notificada',
        status_atualizado_em: new Date().toISOString(),
      })
      .eq("id", cliente.id);

    notificados++;
  }

  return {
    status: 200,
    body: { sucesso: true, notificados },
  };
}

// Ação: CLEANUP (cron job diário)
async function cleanupListaEspera(supabase: any) {
  // Marca como expirada entradas > 30 dias
  const { error: erroUpdate } = await supabase
    .from("lista_espera")
    .update({
      status: 'expirada',
      status_atualizado_em: new Date().toISOString(),
    })
    .in("status", ["ativa", "notificada"])
    .lt("data_preferida", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  if (erroUpdate) {
    Sentry.captureException(erroUpdate);
    return {
      status: 500,
      body: { erro: "Erro ao fazer cleanup" },
    };
  }

  return {
    status: 200,
    body: { sucesso: true, mensagem: "Cleanup realizado" },
  };
}

// Handler principal
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // Cria cliente Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ erro: "Authorization header missing" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Parse body
    const body = await req.json();
    const { action } = body;

    // Roteamento por ação
    switch (action) {
      case "entrar":
        const resultadoEntrar = await entrarListaEspera(body, supabase);
        return new Response(JSON.stringify(resultadoEntrar.body), {
          status: resultadoEntrar.status,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });

      case "sair":
        const userId = authHeader.replace("Bearer ", "");
        const resultadoSair = await sairListaEspera(body, supabase, userId);
        return new Response(JSON.stringify(resultadoSair.body), {
          status: resultadoSair.status,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });

      case "notificar":
        const resultadoNotificar = await notificarListaEspera(body, supabase);
        return new Response(JSON.stringify(resultadoNotificar.body), {
          status: resultadoNotificar.status,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });

      case "cleanup":
        const resultadoCleanup = await cleanupListaEspera(supabase);
        return new Response(JSON.stringify(resultadoCleanup.body), {
          status: resultadoCleanup.status,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });

      default:
        return new Response(JSON.stringify({ erro: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    Sentry.captureException(e);
    return new Response(JSON.stringify({ erro: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
