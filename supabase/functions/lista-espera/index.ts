// supabase/functions/lista-espera/index.ts
//
// Edge Function unificada para Lista de Espera Inteligente 2.5
// Sistema de reserva com timeout: notificado tem 30min para agendar
//
// Ações:
// - entrar: cliente entra na lista
// - sair: cliente sai da lista
// - notificar: notifica clientes quando vaga surge
// - verificar-timeouts: cron job verifica reservas expiradas e notifica próximo
// - validar-reserva: valida token de reserva antes do agendamento
// - cleanup: cleanup diário de entradas antigas

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { getDataAtualBRT, possuiJanelaUtilHoje } from "../../../modules/lista-espera-rules.js";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tracesSampleRate: 0.1,
  });
}

const TIMEOUT_MINUTOS_DEFAULT = 30;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

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

function getDataHoraAtualBRT(): Date {
  const agoraBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return new Date(agoraBRT);
}

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
    const [horaNum, minNum] = horaDisponivel.split(':').map(Number);
    const minutosTotais = horaNum * 60 + minNum;
    
    if (periodoPreferido === 'manha') {
      return minutosTotais >= 480 && minutosTotais <= 779;
    }
    if (periodoPreferido === 'tarde') {
      return minutosTotais >= 780 && minutosTotais <= 1139;
    }
    if (periodoPreferido === 'noite') {
      return minutosTotais >= 1140 && minutosTotais <= 1319;
    }
  }

  return false;
}

function gerarToken(): string {
  return crypto.randomUUID();
}

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

  const hojeBrt = getDataAtualBRT();
  if (data_preferida < hojeBrt) {
    return { status: 400, body: { erro: "NÃ£o Ã© possÃ­vel entrar na lista de espera para uma data passada" } };
  }

  if (!prestador_id || !cliente_nome || !cliente_telefone || !data_preferida) {
    return { status: 400, body: { erro: "Campos obrigatórios faltando" } };
  }

  const { data: prestador } = await supabase
    .from("prestadores")
    .select("nome, whatsapp")
    .eq("id", prestador_id)
    .single();

  const dataObj = new Date(`${data_preferida}T12:00:00-03:00`);
  const diaSemana = dataObj.getUTCDay();
  const { data: disponibilidades } = await supabase
    .from("disponibilidade")
    .select("hora_inicio, hora_fim")
    .eq("prestador_id", prestador_id)
    .eq("dia_semana", diaSemana);

  if (!possuiJanelaUtilHoje({
    dataPreferida: data_preferida,
    tipoPreferencia: tipo_preferencia,
    horaPreferida: hora_preferida,
    disponibilidades: disponibilidades ?? [],
  })) {
    return {
      status: 400,
      body: {
        erro: "NÃ£o Ã© possÃ­vel entrar na lista de espera para hoje apÃ³s o fim do expediente ou para um horÃ¡rio que jÃ¡ passou",
      },
    };
  }

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
    return { status: 409, body: { erro: "Você já está na lista de espera para este horário" } };
  }

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
    return { status: 500, body: { erro: "Erro ao entrar na lista de espera" } };
  }

  const dataFmt = new Date(data_preferida).toLocaleDateString("pt-BR");
  const horaDisplay = tipo_preferencia === 'exato'
    ? (hora_preferida || 'A definir')
    : (tipo_preferencia === 'periodo' ? `Período: ${periodo_preferido}` : 'Qualquer horário');

  const mensagemWhatsApp = `🎉 *Lista de Espera - ${prestador?.nome || "AgendaPro"}*\n\n` +
    `Oi ${cliente_nome.split(" ")[0]}! Você entrou na lista de espera para:\n\n` +
    `📅 Data: ${dataFmt}\n` +
    `⏰ Preferência: ${horaDisplay}\n` +
    `${servico_nome ? `💇 Serviço: ${servico_nome} (${servico_duracao_min} min)\n\n` : ""}` +
    `Te avisaremos se uma vaga surgir! ⏰\n\n` +
    `Você será notificado(a) até 2h antes do horário.`;

  enviarWhatsApp(cliente_telefone, mensagemWhatsApp);

  if (cliente_email) {
    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#c8f060">🎉 Lista de Espera</h2>
        <p>Você entrou na lista de espera para <strong>${prestador?.nome || "AgendaPro"}</strong>:</p>
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

  return { status: 201, body: { sucesso: true, data: nova } };
}

async function sairListaEspera(body: any, supabase: any) {
  const { id } = body;

  if (!id) {
    return { status: 400, body: { erro: "ID da entrada não informado" } };
  }

  const { error: erroUpdate } = await supabase
    .from("lista_espera")
    .update({
      status: 'desistiu',
      status_atualizado_em: new Date().toISOString(),
      token_reserva: null,
      reservado_em: null,
    })
    .eq("id", id)
    .eq("status", "ativa");

  if (erroUpdate) {
    Sentry.captureException(erroUpdate);
    return { status: 500, body: { erro: "Erro ao sair da lista de espera" } };
  }

  return { status: 200, body: { sucesso: true, mensagem: "Você saiu da lista de espera" } };
}

async function notificarListaEspera(body: any, supabase: any) {
  const { prestador_id, data, hora, servico_id, timeout_minutos = TIMEOUT_MINUTOS_DEFAULT } = body;

  if (!prestador_id || !data) {
    return { status: 400, body: { erro: "prestador_id e data são obrigatórios" } };
  }

  const { data: clientes, error: erroBusca } = await supabase
    .from("lista_espera")
    .select("*")
    .eq("prestador_id", prestador_id)
    .eq("data_preferida", data)
    .in("status", ["ativa"])
    .order("criado_em", { ascending: true });

  if (erroBusca) {
    Sentry.captureException(erroBusca);
    return { status: 500, body: { erro: "Erro ao buscar lista de espera" } };
  }

  if (!clientes || clientes.length === 0) {
    return { status: 200, body: { mensagem: "Ninguém na lista de espera para esta data" } };
  }

  const hoje = getDataAtualBRT();
  const agora = getDataHoraAtualBRT();
  let notificados = 0;

  for (const cliente of clientes) {
    if (cliente.data_preferida < hoje) continue;

    if (hora && !prefereHorario(
      cliente.tipo_preferencia,
      cliente.hora_preferida,
      cliente.periodo_preferido,
      hora
    )) {
      continue;
    }

    if (hora) {
      const horarioSlot = new Date(`${data}T${hora}:00-03:00`);
      const diffHoras = (horarioSlot.getTime() - agora.getTime()) / (1000 * 60 * 60);

      if (diffHoras < 2) {
        console.log(`⏰ Pulando ${hora}: apenas ${diffHoras.toFixed(1)}h de antecedência`);
        continue;
      }

      if (horarioSlot <= agora) {
        console.log(`⏰ Pulando ${hora}: horário já passou`);
        continue;
      }
    }

    const tokenReserva = gerarToken();
    const dataFmt = new Date(cliente.data_preferida).toLocaleDateString("pt-BR");
    const nomeCliente = cliente.cliente_nome.split(" ")[0];

    const mensagemWhatsApp = `🎉 *VAGA LIBEROU!*

Oi ${nomeCliente}! Uma vaga surgiu que pode te interessar:

📅 Data: ${dataFmt}
⏰ Horário: ${hora || 'A confirmar'}
${cliente.servico_nome ? `💇 Serviço: ${cliente.servico_nome}\n` : ""}

⚡ *Você tem ${timeout_minutos} minutos para confirmar!*
⏰ Após este tempo, a vaga será oferecida ao próximo da fila.

🔗 ${Deno.env.get("APP_URL")}/confirmar-reserva?token=${tokenReserva}`;

    await enviarWhatsApp(cliente.cliente_telefone, mensagemWhatsApp);

    await supabase
      .from("lista_espera")
      .update({
        status: 'notificada',
        status_atualizado_em: new Date().toISOString(),
        token_reserva: tokenReserva,
        reservado_em: new Date().toISOString(),
        timeout_minutos: timeout_minutos,
        notificado_em: new Date().toISOString(),
      })
      .eq("id", cliente.id);

    notificados++;
    break;
  }

  return { status: 200, body: { sucesso: true, notificados } };
}

async function verificarTimeouts(supabase: any) {
  const agora = new Date();

  const { data: reservasAtivas, error: erroBusca } = await supabase
    .from("lista_espera")
    .select("*")
    .in("status", ["notificada", "agendada"])  // Inclui agendada para verificar
    .not("token_reserva", "is", null);

  if (erroBusca) {
    Sentry.captureException(erroBusca);
    return { status: 500, body: { erro: "Erro ao buscar reservas ativas" } };
  }

  let notificadosProximo = 0;
  let liberados = 0;

  for (const reserva of reservasAtivas) {
    // Pula se já foi agendada (cliente confirmou)
    if (reserva.status === 'agendada') {
      continue;
    }

    if (!reserva.reservado_em || !reserva.timeout_minutos) continue;

    const dtReserva = new Date(reserva.reservado_em);
    const timeoutMs = reserva.timeout_minutos * 60 * 1000;
    const expiraEm = new Date(dtReserva.getTime() + timeoutMs);

    if (agora >= expiraEm) {
      console.log(`⏱️ Reserva ${reserva.id} expirou (${reserva.timeout_minutos} min)`);

      const { data: prestador } = await supabase
        .from("prestadores")
        .select("nome")
        .eq("id", reserva.prestador_id)
        .single();

      const nomeCliente = reserva.cliente_nome.split(" ")[0];
      const dataFmt = new Date(reserva.data_preferida).toLocaleDateString("pt-BR");

      await enviarWhatsApp(
        reserva.cliente_telefone,
        `⏰ *Tempo Esgotado*\n\n` +
        `Oi ${nomeCliente}! O prazo de ${reserva.timeout_minutos} minutos para confirmar o horário de ${dataFmt} às ${reserva.hora_preferida || reserva.periodo_preferido || 'livre'} expirou.\n\n` +
        `A vaga foi oferecida ao próximo da fila. Você pode entrar novamente na lista de espera!`
      );

      await supabase
        .from("lista_espera")
        .update({
          status: 'ativa',
          status_atualizado_em: new Date().toISOString(),
          token_reserva: null,
          reservado_em: null,
        })
        .eq("id", reserva.id);

      const { data: proximo, error: erroProx } = await supabase
        .from("lista_espera")
        .select("*")
        .eq("prestador_id", reserva.prestador_id)
        .eq("data_preferida", reserva.data_preferida)
        .eq("status", "ativa")
        .order("criado_em", { ascending: true })
        .limit(1)
        .single();

      if (proximo && reserva.hora_preferida) {
        const tokenProx = gerarToken();
        const dataFmtProx = new Date(proximo.data_preferida).toLocaleDateString("pt-BR");
        const nomeProx = proximo.cliente_nome.split(" ")[0];

        const msgProx = `🎉 *VAGA LIBEROU!*

Oi ${nomeProx}! Uma vaga surgiu que pode te interessar:

📅 Data: ${dataFmtProx}
⏰ Horário: ${reserva.hora_preferida}
${proximo.servico_nome ? `💇 Serviço: ${proximo.servico_nome}\n` : ""}

⚡ *Você tem ${TIMEOUT_MINUTOS_DEFAULT} minutos para confirmar!*
⏰ Após este tempo, a vaga será oferecida ao próximo da fila.

🔗 ${Deno.env.get("APP_URL")}/confirmar-reserva?token=${tokenProx}`;

        await enviarWhatsApp(proximo.cliente_telefone, msgProx);

        await supabase
          .from("lista_espera")
          .update({
            status: 'notificada',
            status_atualizado_em: new Date().toISOString(),
            token_reserva: tokenProx,
            reservado_em: new Date().toISOString(),
            timeout_minutos: TIMEOUT_MINUTOS_DEFAULT,
            notificado_em: new Date().toISOString(),
          })
          .eq("id", proximo.id);

        notificadosProximo++;
      }

      liberados++;
    }
  }

  return {
    status: 200,
    body: {
      sucesso: true,
      reservas_expiradas: liberados,
      proximos_notificados: notificadosProximo,
      timestamp: agora.toISOString()
    }
  };
}

async function validarReserva(body: any, supabase: any) {
  const { token } = body;

  if (!token) {
    return { status: 400, body: { erro: "token é obrigatório" } };
  }

  const { data: reserva, error: erroBusca } = await supabase
    .from("lista_espera")
    .select("*")
    .eq("token_reserva", token)
    .eq("status", "notificada")
    .single();

  if (erroBusca || !reserva) {
    return { status: 404, body: { erro: "Reserva não encontrada ou expirada", valida: false } };
  }

  if (!reserva.reservado_em || !reserva.timeout_minutos) {
    return { status: 400, body: { erro: "Reserva sem timestamp", valida: false } };
  }

  const agora = new Date();
  const dtReserva = new Date(reserva.reservado_em);
  const timeoutMs = reserva.timeout_minutos * 60 * 1000;
  const expiraEm = new Date(dtReserva.getTime() + timeoutMs);

  if (agora >= expiraEm) {
    await supabase
      .from("lista_espera")
      .update({
        status: 'ativa',
        token_reserva: null,
        reservado_em: null,
      })
      .eq("id", reserva.id);

    return { status: 410, body: { erro: "Tempo para confirmar expirou", valida: false } };
  }

  return {
    status: 200,
    body: {
      valida: true,
      cliente_id: reserva.id,
      prestador_id: reserva.prestador_id,
      data_preferida: reserva.data_preferida,
      cliente_nome: reserva.cliente_nome,
      cliente_telefone: reserva.cliente_telefone,
      cliente_email: reserva.cliente_email,
      hora_preferida: reserva.hora_preferida,
      servico_id: reserva.servico_id,
      servico_nome: reserva.servico_nome,
      reservado_em: reserva.reservado_em,
      timeout_minutos: reserva.timeout_minutos
    }
  };
}

async function confirmarReserva(body: any, supabase: any) {
  const { token, prestador_id, data } = body;

  if (!token || !prestador_id || !data) {
    return { status: 400, body: { erro: "token, prestador_id e data são obrigatórios" } };
  }

  const { data: reserva, error: erroBusca } = await supabase
    .from("lista_espera")
    .select("*")
    .eq("token_reserva", token)
    .eq("prestador_id", prestador_id)
    .eq("data_preferida", data)
    .eq("status", "notificada")
    .single();

  if (erroBusca || !reserva) {
    return { status: 404, body: { erro: "Reserva não encontrada ou expirada" } };
  }

  await supabase
    .from("lista_espera")
    .update({
      status: 'agendada',
      status_atualizado_em: new Date().toISOString(),
    })
    .eq("id", reserva.id);

  return { status: 200, body: { sucesso: true, mensagem: "Reserva confirmada" } };
}

async function cleanupListaEspera(supabase: any) {
  const hojeBRT = getDataAtualBRT();
  const dataLimite = new Date(hojeBRT);
  dataLimite.setDate(dataLimite.getDate() - 30);
  const dataLimiteStr = dataLimite.toISOString().split('T')[0];
  
  const { error: erroUpdate } = await supabase
    .from("lista_espera")
    .update({
      status: 'expirada',
      status_atualizado_em: new Date().toISOString(),
    })
    .in("status", ["ativa", "notificada"])
    .lt("data_preferida", dataLimiteStr);

  if (erroUpdate) {
    Sentry.captureException(erroUpdate);
    return { status: 500, body: { erro: "Erro ao fazer cleanup" } };
  }

  return { status: 200, body: { sucesso: true, mensagem: "Cleanup realizado" } };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "entrar":
        const resultadoEntrar = await entrarListaEspera(body, supabase);
        return new Response(JSON.stringify(resultadoEntrar.body), {
          status: resultadoEntrar.status,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });

      case "sair":
        const resultadoSair = await sairListaEspera(body, supabase);
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

      case "verificar-timeouts":
        const resultadoTimeouts = await verificarTimeouts(supabase);
        return new Response(JSON.stringify(resultadoTimeouts.body), {
          status: resultadoTimeouts.status,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });

      case "validar-reserva":
        const resultadoValidar = await validarReserva(body, supabase);
        return new Response(JSON.stringify(resultadoValidar.body), {
          status: resultadoValidar.status,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });

      case "confirmar-reserva":
        const resultadoConfirmar = await confirmarReserva(body, supabase);
        return new Response(JSON.stringify(resultadoConfirmar.body), {
          status: resultadoConfirmar.status,
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
