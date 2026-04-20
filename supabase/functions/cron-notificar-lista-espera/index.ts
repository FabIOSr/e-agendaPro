// supabase/functions/cron-notificar-lista-espera/index.ts
//
// Cron job que processa a lista de espera
// Roda a cada 30 minutos (sincronizado com timeout de 30 min)
//
// Schedule: */30 * * * *
//
// 1. Verificar reservas expiradas e notificar próximo da fila
// 2. Notificar novos clientes quando vaga surgir

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tracesSampleRate: 0.1,
  });
}

const TIMEOUT_MINUTOS_DEFAULT = 30;
const TIMEZONE_BRT = 'America/Sao_Paulo';

// CORS local antigo (substituído pelo módulo _shared/cors.ts)
// function corsHeaders_local() {
//   return {
//     "Access-Control-Allow-Origin": "*",
//     "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
//     "Access-Control-Allow-Methods": "POST, OPTIONS",
//   };
// }

/**
 * Retorna data atual no fuso BRT como string YYYY-MM-DD
 * Usa Intl.DateTimeFormat para conversão correta de timezone
 */
function getDataAtualBRT(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE_BRT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Retorna data/hora atual no fuso BRT como Date
 * Usa Intl.DateTimeFormat para considerar regras oficiais de timezone
 */
function getDataHoraAtualBRT(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE_BRT,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
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
        from: { email: Deno.env.get('EMAIL_FROM') || 'nao-responda@agendapro.com.br', name: "AgendaPro" },
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
    
    if (periodoPreferido === 'manha') return minutosTotais >= 480 && minutosTotais <= 779;
    if (periodoPreferido === 'tarde') return minutosTotais >= 780 && minutosTotais <= 1139;
    if (periodoPreferido === 'noite') return minutosTotais >= 1140 && minutosTotais <= 1319;
  }

  return false;
}

function gerarToken(): string {
  return crypto.randomUUID();
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
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader! } },
      }
    );

    const agora = new Date();
    const hoje = getDataAtualBRT();
    const agoraBRT = getDataHoraAtualBRT();

    console.log("🔄 Iniciando processamento da lista de espera...");

    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Verificar reservas expiradas e notificar próximo
    // ═══════════════════════════════════════════════════════════════
    const { data: reservasAtivas, error: erroReservas } = await supabase
      .from("lista_espera")
      .select("*")
      .in("status", ["notificada", "agendada"])  // Inclui agendada para verificar
      .not("token_reserva", "is", null);

    if (erroReservas) {
      Sentry.captureException(erroReservas);
    }

    let reservasExpiradas = 0;
    let proximosNotificados = 0;

    if (reservasAtivas) {
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
          console.log(`⏱️ Reserva ${reserva.id} expirou`);

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

          // Se tinha agendamento original, voltar para cancelado (não foi confirmado)
          if (reserva.agendamento_original_id) {
            await supabase
              .from("agendamentos")
              .update({ status: "cancelado" })
              .eq("id", reserva.agendamento_original_id);
            
            console.log(`⏱️ Agendamento original ${reserva.agendamento_original_id} voltou para cancelado`);
          }

          reservasExpiradas++;

          // Buscar próximo da fila para notificar
          const { data: proximo } = await supabase
            .from("lista_espera")
            .select("*")
            .eq("prestador_id", reserva.prestador_id)
            .eq("data_preferida", reserva.data_preferida)
            .eq("status", "ativa")
            .order("criado_em", { ascending: true })
            .limit(1)
            .single();

          if (proximo && reserva.hora_preferida) {
            // Verificar se o horário ainda está disponível
            const horariosResponse = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/horarios-disponiveis`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": authHeader! },
                body: JSON.stringify({
                  prestador_id: reserva.prestador_id,
                  data: reserva.data_preferida,
                  servico_id: reserva.servico_id,
                }),
              }
            );

            const horariosData = await horariosResponse.json();
            const horariosDisponiveis = horariosData.slots || [];
            const horarioOcupado = horariosDisponiveis.find((h: any) => h.hora === reserva.hora_preferida && !h.disponivel);

            if (!horarioOcupado) {
              const { data: prestador } = await supabase
                .from("prestadores")
                .select("nome")
                .eq("id", reserva.prestador_id)
                .single();

              const tokenProx = crypto.randomUUID();
              const dataFmtProx = new Date(proximo.data_preferida).toLocaleDateString("pt-BR");
              const nomeProx = proximo.cliente_nome.split(" ")[0];

              const msgProx = `🎉 *VAGA LIBEROU!*\n\n` +
                `Oi ${nomeProx}! Uma vaga surgiu que pode te interessar:\n\n` +
                `📅 Data: ${dataFmtProx}\n` +
                `⏰ Horário: ${reserva.hora_preferida}\n` +
                `${proximo.servico_nome ? `💇 Serviço: ${proximo.servico_nome}\n` : ""}\n` +
                `⚡ *Você tem ${TIMEOUT_MINUTOS_DEFAULT} minutos para confirmar!*\n` +
                `⏰ Após este tempo, a vaga será oferecida ao próximo da fila.\n\n` +
                `🔗 ${Deno.env.get("APP_URL")}/confirmar-reserva?token=${tokenProx}`;

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

              proximosNotificados++;
            } else {
              console.log(`⏰ Horário ${reserva.hora_preferida} já foi ocupado, não notifica próximo`);
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Notificar clientes quando nova vaga surge (via trigger)
    // ═══════════════════════════════════════════════════════════════
    const { data: listaEspera, error: erroBusca } = await supabase
      .from("lista_espera")
      .select(`
        id,
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
        criado_em,
        status
      `)
      .eq("status", "ativa")
      .order("criado_em", { ascending: true });

    if (erroBusca) {
      Sentry.captureException(erroBusca);
      return new Response(JSON.stringify({ erro: "Erro ao buscar lista de espera" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!listaEspera || listaEspera.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: "Ninguém na lista de espera",
        reservas_expiradas: reservasExpiradas,
        proximos_notificados: proximosNotificados
      }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const listaValida = listaEspera.filter((item: any) => item.data_preferida >= hoje);

    if (listaValida.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: "Todas as datas já passaram",
        reservas_expiradas: reservasExpiradas,
        proximos_notificados: proximosNotificados
      }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const grupos = new Map<string, any[]>();
    for (const item of listaValida) {
      const key = `${item.prestador_id}|${item.data_preferida}`;
      if (!grupos.has(key)) {
        grupos.set(key, []);
      }
      grupos.get(key)!.push(item);
    }

    let notificados = 0;

    for (const [key, clientes] of grupos.entries()) {
      const [prestadorId, dataPreferida] = key.split("|");

      if (dataPreferida < hoje) continue;

      // Buscar slug do prestador para chamar horarios-disponiveis
      const { data: prestador } = await supabase
        .from("prestadores")
        .select("slug")
        .eq("id", prestadorId)
        .single();

      if (!prestador?.slug) {
        console.log(`⚠️ Prestador ${prestadorId} sem slug`);
        continue;
      }

      const primeiroServicoId = clientes[0].servico_id;

      const slotsResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/horarios-disponiveis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader!,
          },
          body: JSON.stringify({
            prestador_slug: prestador.slug,
            data: dataPreferida,
            servico_id: primeiroServicoId,
          }),
        }
      );

      const slotsData = await slotsResponse.json();
      const slotsDisponiveis = slotsData.slots || [];

      const horariosLiberados = slotsDisponiveis
        .filter((s: any) => s.disponivel === true)
        .map((s: any) => s.hora);

      if (horariosLiberados.length === 0) continue;

      for (const cliente of clientes) {
        const horarioCompativel = horariosLiberados.find((hora: string) =>
          prefereHorario(
            cliente.tipo_preferencia,
            cliente.hora_preferida,
            cliente.periodo_preferido,
            hora
          )
        );

        if (!horarioCompativel) continue;

        const horarioSlot = new Date(`${dataPreferida}T${horarioCompativel}`);
        const diffHoras = (horarioSlot.getTime() - agoraBRT.getTime()) / (1000 * 60 * 60);

        if (diffHoras < 2) {
          console.log(`⏰ Pulando ${horarioCompativel}: apenas ${diffHoras.toFixed(1)}h de antecedência`);
          continue;
        }

        const tokenReserva = gerarToken();
        const dataFmt = new Date(cliente.data_preferida).toLocaleDateString("pt-BR");
        const nomeCliente = cliente.cliente_nome.split(" ")[0];

        const mensagemWhatsApp = `🎉 *VAGA LIBEROU!*\n\n` +
          `Oi ${nomeCliente}! Uma vaga surgiu que pode te interessar:\n\n` +
          `📅 Data: ${dataFmt}\n` +
          `⏰ Horário: ${horarioCompativel}\n` +
          `${cliente.servico_nome ? `💇 Serviço: ${cliente.servico_nome}\n` : ""}\n` +
          `⚡ *Você tem ${TIMEOUT_MINUTOS_DEFAULT} minutos para confirmar!*\n` +
          `⏰ Após este tempo, a vaga será oferecida ao próximo da fila.\n\n` +
          `🔗 ${Deno.env.get("APP_URL")}/confirmar-reserva?token=${tokenReserva}`;

        // Tenta WhatsApp primeiro, com fallback para email
        const sucessoWhatsApp = await enviarWhatsApp(cliente.cliente_telefone, mensagemWhatsApp);

        if (!sucessoWhatsApp && cliente.cliente_email) {
          // Fallback: se WhatsApp falhar, envia email
          const emailHtml = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#c8f060">🎉 Vaga Liberou!</h2>
              <p>Olá ${nomeCliente}! Uma vaga compatível com sua preferência surgiu:</p>
              <div style="background:#f2f0ea;padding:16px;border-radius:8px;margin:16px 0">
                <p><strong>📅 Data:</strong> ${dataFmt}</p>
                <p><strong>⏰ Horário:</strong> ${horarioCompativel}</p>
                ${cliente.servico_nome ? `<p><strong>💇 Serviço:</strong> ${cliente.servico_nome}</p>` : ""}
              </div>
              <p style="color:#8a8778;font-size:14px">
                ⚡ Você tem <strong>${TIMEOUT_MINUTOS_DEFAULT} minutos</strong> para confirmar!<br>
                Após este tempo, a vaga será oferecida ao próximo da fila.
              </p>
              <a href="${Deno.env.get("APP_URL")}/confirmar-reserva?token=${tokenReserva}"
                 style="display:inline-block;background:#c8f060;color:#000;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;margin-top:8px">
                Agendar Agora
              </a>
            </div>
          `;
          await enviarEmail(cliente.cliente_email, `🎉 Vaga liberou para ${dataFmt}!`, emailHtml);
        } else if (cliente.cliente_email) {
          // Envia email mesmo com WhatsApp sucesso (reforço)
          const emailHtml = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#c8f060">🎉 Vaga Liberou!</h2>
              <p>Olá ${nomeCliente}! Uma vaga compatível com sua preferência surgiu:</p>
              <div style="background:#f2f0ea;padding:16px;border-radius:8px;margin:16px 0">
                <p><strong>📅 Data:</strong> ${dataFmt}</p>
                <p><strong>⏰ Horário:</strong> ${horarioCompativel}</p>
                ${cliente.servico_nome ? `<p><strong>💇 Serviço:</strong> ${cliente.servico_nome}</p>` : ""}
              </div>
              <p style="color:#8a8778;font-size:14px">
                ⚡ Você tem <strong>${TIMEOUT_MINUTOS_DEFAULT} minutos</strong> para confirmar!<br>
                Após este tempo, a vaga será oferecida ao próximo da fila.
              </p>
              <a href="${Deno.env.get("APP_URL")}/confirmar-reserva?token=${tokenReserva}"
                 style="display:inline-block;background:#c8f060;color:#000;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;margin-top:8px">
                Agendar Agora
              </a>
            </div>
          `;
          await enviarEmail(cliente.cliente_email, `🎉 Vaga liberou para ${dataFmt}!`, emailHtml);
        }

        // Buscar agendamento original que foi cancelado para este horário
        const dataHoraInicio = `${dataPreferida}T${horarioCompativel}:00-03:00`;
        
        const { data: agendamentoOriginal } = await supabase
          .from("agendamentos")
          .select("id")
          .eq("prestador_id", prestadorId)
          .eq("status", "cancelado")
          .gte("data_hora", dataHoraInicio)
          .lt("data_hora", new Date(new Date(dataHoraInicio).getTime() + 60 * 60 * 1000).toISOString())
          .limit(1)
          .single();

        // Atualizar status do agendamento original para reservado (bloqueado para lista)
        if (agendamentoOriginal) {
          await supabase
            .from("agendamentos")
            .update({ status: "reservado" })
            .eq("id", agendamentoOriginal.id);
          
          console.log(`🔒 Agendamento original ${agendamentoOriginal.id} marcado como reservado`);
        }

        await supabase
          .from("lista_espera")
          .update({
            status: 'notificada',
            status_atualizado_em: new Date().toISOString(),
            token_reserva: tokenReserva,
            reservado_em: new Date().toISOString(),
            timeout_minutos: TIMEOUT_MINUTOS_DEFAULT,
            notificado_em: new Date().toISOString(),
            agendamento_original_id: agendamentoOriginal?.id || null,
          })
          .eq("id", cliente.id);

        notificados++;
        console.log(`✅ Notificado: ${cliente.cliente_nome} para ${dataFmt} às ${horarioCompativel} (token: ${tokenReserva})`);

        break;
      }
    }

    return new Response(JSON.stringify({
      sucesso: true,
      notificados,
      reservas_expiradas: reservasExpiradas,
      proximos_notificados: proximosNotificados,
      total_processados: listaEspera.length,
      timestamp: agora.toISOString(),
    }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    Sentry.captureException(e);
    console.error("Erro geral:", e);
    return new Response(JSON.stringify({ erro: "Erro interno" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});