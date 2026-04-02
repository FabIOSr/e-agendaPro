// supabase/functions/cron-notificar-lista-espera/index.ts
//
// Cron job que roda a cada 5 minutos e notifica clientes na lista de espera
// quando uma vaga surge (por cancelamento)
//
// Cron: */5 * * * * (a cada 5 minutos)

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

// Determina período do dia baseado na hora
function getPeriodo(hora: string): string {
  const h = parseInt(hora.split(":")[0]);
  if (h >= 6 && h < 12) return "manha";
  if (h >= 12 && h < 18) return "tarde";
  return "noite";
}

// Verifica se a preferência do cliente casa com o horário liberado
function prefereHorario(
  tipoPreferencia: string,
  horaPreferida: string | null,
  periodoPreferido: string | null,
  horaLiberada: string
): boolean {
  if (tipoPreferencia === "exato") {
    return horaPreferida === horaLiberada;
  } else if (tipoPreferencia === "periodo") {
    const periodoLiberado = getPeriodo(horaLiberada);
    return periodoPreferido === periodoLiberado;
  } else if (tipoPreferencia === "qualquer") {
    return true;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // Apenas POST (cron job)
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ erro: "Método não permitido" }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Verifica se é chamado pelo cron (Authorization header)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.includes("Bearer")) {
      return new Response(JSON.stringify({ erro: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Criar cliente Supabase com service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader! } },
      }
    );

    // Busca TODOS os clientes na lista de espera que ainda não foram notificados
    // e estão dentro do prazo de validade
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
        criado_em
      `)
      .eq("agendado", false)
      .eq("notificado", false)
      .gt("expira_em", new Date().toISOString())
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

    // Filtra entradas cuja data preferida já passou
    const hoje = new Date().toISOString().split('T')[0];
    const listaValida = listaEspera.filter(item => item.data_preferida >= hoje);

    if (listaValida.length === 0) {
      return new Response(JSON.stringify({ mensagem: "Todas as datas já passaram" }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Agrupa por prestador e data para otimizar chamadas
    const grupos = new Map<string, any[]>();
    for (const item of listaValida) {  // ← Usa listaValida (filtra passado)
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

      // Verifica se data já passou (segurança extra)
      const hoje = new Date().toISOString().split('T')[0];
      if (dataPreferida < hoje) {
        continue; // Data já passou
      }

      // Chama horarios-disponiveis para este prestador/data
      // Precisamos de um servico_id para chamar, usa o primeiro cliente
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

        // ⏰ Verifica antecedência mínima (2 horas)
        const agora = new Date();
        const horarioSlot = new Date(`${dataPreferida}T${horarioCompativel}`);
        const diffHoras = (horarioSlot.getTime() - agora.getTime()) / (1000 * 60 * 60);

        if (diffHoras < 2) {
          console.log(
            `⏰ Pulando ${horarioCompativel}: apenas ${diffHoras.toFixed(1)}h de antecedência`
          );
          continue; // Menos de 2 horas de antecedência
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

Reserve agora: ${Deno.env.get("APP_URL") || "https://e-agendapro.web.app"}`;

        // Envia WhatsApp
        const whatsappEnviado = await enviarWhatsApp(
          cliente.cliente_telefone,
          mensagemWhatsApp
        );

        // Envia email se tiver email
        let emailEnviado = false;
        if (cliente.cliente_email) {
          const emailHtml = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#c8f060">🎉 Vaga Liberou!</h2>
              <p style="font-size:16px">Oi ${nomeCliente}!</p>
              <p>Uma vaga surgiu que pode te interessar:</p>
              <div style="background:#f2f0ea;padding:16px;border-radius:8px;margin:16px 0">
                <ul style="margin:0;padding-left:20px">
                  <li>📅 Data: ${dataFmt}</li>
                  <li>⏰ Horário: ${horarioCompativel}</li>
                  ${cliente.servico_nome ? `<li>💇 Serviço: ${cliente.servico_nome}</li>` : ""}
                </ul>
              </div>
              <p style="color:#8a8778;font-size:14px">⚡ <strong>Corre que é por ordem de chegada!</strong> Reserve agora pelo app.</p>
              <a href="${Deno.env.get("APP_URL") || "https://e-agendapro.web.app"}" 
                 style="display:inline-block;background:#c8f060;color:#1a2a08;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">
                Reservar Agora
              </a>
            </div>
          `;
          emailEnviado = await enviarEmail(
            cliente.cliente_email,
            "🎉 Vaga Liberou!",
            emailHtml
          );
        }

        // Atualiza status para notificado
        const { error: erroUpdate } = await supabase
          .from("lista_espera")
          .update({
            notificado: true,
            notificado_em: new Date().toISOString(),
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
