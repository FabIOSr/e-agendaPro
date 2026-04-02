// supabase/functions/cron-notificar-lista-espera/index.ts
//
// Cron job que notifica clientes na lista de espera quando vaga surge
// Roda a cada 30 minutos (otimizado para reduzir custo)
//
// Cron: */30 * * * *

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

// Obtém data atual no fuso BRT (America/Sao_Paulo)
function getDataAtualBRT(): string {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/')
    .reverse()
    .join('-');
}

// Obtém data/hora atual no fuso BRT como Date
function getDataHoraAtualBRT(): Date {
  const agoraBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return new Date(agoraBRT);
}

// Verifica preferência de horário com validação precisa de minutos
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
    
    // Definição precisa dos períodos com minutos
    if (periodoPreferido === 'manha') {
      // 08:00 (480 min) até 12:59 (779 min)
      return minutosTotais >= 480 && minutosTotais <= 779;
    }
    if (periodoPreferido === 'tarde') {
      // 13:00 (780 min) até 18:59 (1139 min)
      return minutosTotais >= 780 && minutosTotais <= 1139;
    }
    if (periodoPreferido === 'noite') {
      // 19:00 (1140 min) até 21:59 (1319 min)
      return minutosTotais >= 1140 && minutosTotais <= 1319;
    }
  }

  return false;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // Cria cliente Supabase com service role
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader! } },
      }
    );

    // Busca clientes na lista de espera (status: ativa ou notificada)
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
      .in("status", ["ativa", "notificada"])
      .order("criado_em", { ascending: true });

    if (erroBusca) {
      Sentry.captureException(erroBusca);
      return new Response(JSON.stringify({ erro: "Erro ao buscar lista de espera" }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    if (!listaEspera || listaEspera.length === 0) {
      return new Response(JSON.stringify({ mensagem: "Ninguém na lista de espera" }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Filtra entradas cuja data preferida já passou (fuso BRT)
    const hoje = getDataAtualBRT();
    const listaValida = listaEspera.filter(item => item.data_preferida >= hoje);

    if (listaValida.length === 0) {
      return new Response(JSON.stringify({ mensagem: "Todas as datas já passaram" }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Agrupa por prestador e data para otimizar chamadas
    const grupos = new Map<string, any[]>();
    for (const item of listaValida) {
      const key = `${item.prestador_id}|${item.data_preferida}`;
      if (!grupos.has(key)) {
        grupos.set(key, []);
      }
      grupos.get(key)!.push(item);
    }

    let notificados = 0;
    let falhas = 0;

    // Processa cada grupo (prestador + data)
    for (const [key, clientes] of grupos.entries()) {
      const [prestadorId, dataPreferida] = key.split("|");

      // Verifica se data já passou (segurança extra, fuso BRT)
      const hoje = getDataAtualBRT();
      if (dataPreferida < hoje) {
        continue; // Data já passou
      }

      // Chama horarios-disponiveis para este prestador/data
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
            prestador_id: prestadorId,
            data: dataPreferida,
            servico_id: primeiroServicoId,
          }),
        }
      );

      const slotsData = await slotsResponse.json();
      const slotsDisponiveis = slotsData.slots || [];

      // Filtra slots disponíveis
      const horariosLiberados = slotsDisponiveis
        .filter((s: any) => s.disponivel === true)
        .map((s: any) => s.hora);

      if (horariosLiberados.length === 0) {
        continue; // Nenhum horário disponível neste dia
      }

      // Obtém hora atual no fuso BRT para validações
      const agora = getDataHoraAtualBRT();

      // Para cada cliente, verifica se há horário compatível
      for (const cliente of clientes) {
        // Encontra horário que casa com a preferência do cliente
        const horarioCompativel = horariosLiberados.find((hora: string) =>
          prefereHorario(
            cliente.tipo_preferencia,
            cliente.hora_preferida,
            cliente.periodo_preferido,
            hora
          )
        );

        if (!horarioCompativel) {
          continue; // Nenhum horário compatível com preferência
        }

        // ⏰ Verifica antecedência mínima (2 horas) - fuso BRT
        const horarioSlot = new Date(`${dataPreferida}T${horarioCompativel}:00-03:00`);
        const diffHoras = (horarioSlot.getTime() - agora.getTime()) / (1000 * 60 * 60);

        if (diffHoras < 2) {
          console.log(
            `⏰ Pulando ${horarioCompativel}: apenas ${diffHoras.toFixed(1)}h de antecedência`
          );
          continue; // Menos de 2 horas de antecedência
        }

        // Regra: Horário não pode estar no passado (mesmo dia, fuso BRT)
        if (horarioSlot <= agora) {
          console.log(`⏰ Pulando ${horarioCompativel}: horário já passou`);
          continue;
        }

        // ✅ Horário compatível encontrado! Notifica o cliente.
        const dataFmt = new Date(cliente.data_preferida).toLocaleDateString("pt-BR");
        const nomeCliente = cliente.cliente_nome.split(" ")[0];

        // Mensagem WhatsApp
        const mensagemWhatsApp = `🎉 *VAGA LIBEROU!*

Oi ${nomeCliente}! Uma vaga surgiu que pode te interessar:

📅 Data: ${dataFmt}
⏰ Horário: ${horarioCompativel}
💇 Serviço: ${cliente.servico_nome || "A definir"}

⚡ *Corre que é por ordem de chegada!*

👉 Agende agora: ${Deno.env.get("APP_URL")}/agenda/${prestadorId}`;

        // Envia WhatsApp
        const enviadoWhatsApp = await enviarWhatsApp(
          cliente.cliente_telefone,
          mensagemWhatsApp
        );

        // Envia email se tiver email
        if (cliente.cliente_email) {
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
                ⚡ Vagas da lista de espera são por ordem de chegada!
              </p>
              <a href="${Deno.env.get("APP_URL")}/agenda/${prestadorId}" 
                 style="display:inline-block;background:#c8f060;color:#000;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;margin-top:8px">
                Agendar Agora
              </a>
            </div>
          `;
          await enviarEmail(
            cliente.cliente_email,
            `🎉 Vaga liberou para ${dataFmt}!`,
            emailHtml
          );
        }

        // Atualiza status para notificada
        const { error: erroUpdate } = await supabase
          .from("lista_espera")
          .update({
            status: 'notificada',
            status_atualizado_em: new Date().toISOString(),
          })
          .eq("id", cliente.id);

        if (erroUpdate) {
          Sentry.captureException(erroUpdate);
          falhas++;
        } else {
          notificados++;
          console.log(
            `✅ Notificado: ${cliente.cliente_nome} para ${dataFmt} às ${horarioCompativel}`
          );
        }
      }
    }

    return new Response(JSON.stringify({
      sucesso: true,
      notificados,
      falhas,
      total_processados: listaEspera.length,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (e) {
    Sentry.captureException(e);
    return new Response(JSON.stringify({ erro: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
