// supabase/functions/lembretes-whatsapp/index.ts
//
// Dois modos de uso:
//
//   1. CONFIRMAÇÃO IMEDIATA — chamada pelo app logo após o agendamento ser criado.
//      POST { tipo: "confirmacao", agendamento_id: "uuid" }
//
//   2. LEMBRETE D-1 — chamada por um cron job todo dia às 18h.
//      POST { tipo: "lembrete_d1" }
//
// Variáveis de ambiente necessárias:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   APP_URL
//
//   Z-API (opcional):
//   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN
//
//   RESEND (opcional):
//   RESEND_API_KEY, EMAIL_FROM

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Agendamento {
  id: string;
  data_hora: string;
  cliente_nome: string;
  cliente_tel: string;
  cliente_email: string;
  cancel_token: string;
  status: string;
  prestador_id: string;
  servicos: { nome: string; duracao_min: number; preco: number | null };
  prestadores: { nome: string; whatsapp: string; slug: string; email: string };
}

interface PreferenciasNotificacao {
  prestador_id: string;
  whatsapp_novo_agendamento: boolean;
  whatsapp_lembrete_d1: boolean;
  whatsapp_cancelamento: boolean;
  whatsapp_agenda_vazia: boolean;
  email_novo_agendamento: boolean;
  email_lembrete_d1: boolean;
  email_cancelamento: boolean;
}

function linksCliente(cancelToken: string) {
  const appUrl = Deno.env.get("APP_URL") || "https://e-agendapro.web.app";
  return {
    cancelar: `${appUrl}/cancelar?token=${cancelToken}`,
    reagendar: `${appUrl}/reagendar?token=${cancelToken}`,
  };
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${dia} às ${hora}`;
}

function formatarPreco(preco: number | null): string {
  if (!preco) return "";
  return ` — R$${preco.toFixed(2).replace(".", ",")}`;
}

function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, "");
}

function mensagemConfirmacaoCliente(ag: Agendamento): string {
  const { cancelar, reagendar } = linksCliente(ag.cancel_token);
  return (
    `Olá, *${ag.cliente_nome}*! 👋\n\n` +
    `Seu agendamento foi confirmado com *${ag.prestadores.nome}*.\n\n` +
    `📋 *Serviço:* ${ag.servicos.nome}${formatarPreco(ag.servicos.preco)}\n` +
    `⏱️ *Duração:* ${ag.servicos.duracao_min} minutos\n` +
    `📅 *Data/hora:* ${formatarDataHora(ag.data_hora)}\n\n` +
    `🔄 *Precisa remarcar?*\n${reagendar}\n\n` +
    `❌ *Precisa cancelar?*\n${cancelar}\n\n` +
    `Até lá! 😊`
  );
}

function mensagemConfirmacaoPrestador(ag: Agendamento): string {
  return (
    `📬 *Novo agendamento recebido!*\n\n` +
    `👤 *Cliente:* ${ag.cliente_nome}\n` +
    `📞 *Telefone:* ${ag.cliente_tel}\n` +
    `📋 *Serviço:* ${ag.servicos.nome}\n` +
    `📅 *Data/hora:* ${formatarDataHora(ag.data_hora)}\n\n` +
    `Acesse seu painel: ${Deno.env.get("APP_URL")}/${ag.prestadores.slug}`
  );
}

function mensagemLembreteCliente(ag: Agendamento): string {
  const { cancelar, reagendar } = linksCliente(ag.cancel_token);
  return (
    `Oi, *${ag.cliente_nome}*! 😊\n\n` +
    `Só passando pra lembrar do seu agendamento *amanhã* com *${ag.prestadores.nome}*.\n\n` +
    `📋 *Serviço:* ${ag.servicos.nome}\n` +
    `📅 *Horário:* ${formatarDataHora(ag.data_hora)}\n\n` +
    `🔄 Remarcar: ${reagendar}\n` +
    `❌ Cancelar: ${cancelar}\n\n` +
    `Até amanhã! ✂️`
  );
}

function mensagemLembretePrestador(ag: Agendamento): string {
  return (
    `🔔 *Lembrete — agendamento amanhã*\n\n` +
    `👤 *Cliente:* ${ag.cliente_nome}\n` +
    `📞 ${ag.cliente_tel}\n` +
    `📋 *Serviço:* ${ag.servicos.nome}\n` +
    `📅 *Horário:* ${formatarDataHora(ag.data_hora)}`
  );
}

async function enviarWhatsApp(telefone: string, mensagem: string): Promise<void> {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const token = Deno.env.get("ZAPI_TOKEN");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

  if (!instanceId || !token || !clientToken) {
    throw new Error("Z-API não configurado");
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    body: JSON.stringify({ phone: normalizarTelefone(telefone), message: mensagem }),
  });

  if (!res.ok) {
    const erro = await res.text();
    throw new Error(`Z-API erro ${res.status}: ${erro}`);
  }
}

async function enviarEmail(to: string, subject: string, html: string): Promise<void> {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  
  // SendGrid API
  if (sendgridKey) {
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
    
    // SendGrid retorna 202Accepted ou 400 para erro
    if (!res.ok && res.status !== 202) {
      const erro = await res.text();
      throw new Error(`SendGrid erro ${res.status}: ${erro}`);
    }
    return;
  }
  
  // Mailjet API (alternativa)
  const mailjetKey = Deno.env.get("MAILJET_API_KEY");
  const mailjetSecret = Deno.env.get("MAILJET_SECRET_KEY");
  
  if (mailjetKey && mailjetSecret) {
    const credentials = btoa(`${mailjetKey}:${mailjetSecret}`);
    
    const res = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: "noreply@agendapro.dev", Name: "AgendaPro" },
          To: [{ Email: to, Name: to }],
          Subject: subject,
          HTMLPart: html,
        }]
      }),
    });
    
    if (!res.ok) {
      const erro = await res.text();
      throw new Error(`Mailjet erro ${res.status}: ${erro}`);
    }
    return;
  }
  
  throw new Error("Nenhum provedor de email configurado");
}

// Busca preferências de notificação do prestador (retorna defaults se não existir)
async function getPreferencias(supabase: ReturnType<typeof createClient>, prestadorId: string): Promise<PreferenciasNotificacao> {
  const { data } = await supabase
    .from("preferencias_notificacao")
    .select("*")
    .eq("prestador_id", prestadorId)
    .single();

  // Se não tiver registro ou der erro, retorna defaults (tudo true exceto agenda_vazia)
  if (!data) {
    return {
      prestador_id: prestadorId,
      whatsapp_novo_agendamento: true,
      whatsapp_lembrete_d1: true,
      whatsapp_cancelamento: true,
      whatsapp_agenda_vazia: false,
      email_novo_agendamento: true,
      email_lembrete_d1: true,
      email_cancelamento: true,
    };
  }

  return data as PreferenciasNotificacao;
}

async function notificarCliente(ag: Agendamento, tipo: "confirmacao" | "lembrete"): Promise<string[]> {
  const enviados: string[] = [];
  const mensagem = tipo === "confirmacao" ? mensagemConfirmacaoCliente(ag) : mensagemLembreteCliente(ag);

  // Sempre tenta email (cliente sempre recebe)
  if (ag.cliente_email) {
    try {
      await enviarEmail(
        ag.cliente_email,
        tipo === "confirmacao" ? `✅ Agendamento confirmado com ${ag.prestadores.nome}` : `⏰ Lembrete: amanhã com ${ag.prestadores.nome}`,
        `<div style="font-family: sans-serif;"><h2>Olá, ${ag.cliente_nome}!</h2><p>${mensagem.replace(/\n/g, "<br>")}</p></div>`
      );
      enviados.push(`email:${ag.cliente_email}`);
    } catch (err) {
      console.error("Erro email cliente:", err);
    }
  }

  // WhatsApp se configurado (cliente sempre recebe)
  try {
    const zapi = Deno.env.get("ZAPI_INSTANCE_ID");
    if (zapi) {
      await enviarWhatsApp(ag.cliente_tel, mensagem);
      enviados.push(`whatsapp:${ag.cliente_tel}`);
    }
  } catch (err) {
    console.error("Erro WhatsApp cliente:", err);
  }

  return enviados;
}

async function notificarPrestador(ag: Agendamento, tipo: "confirmacao" | "lembrete", prefs: PreferenciasNotificacao): Promise<string[]> {
  const enviados: string[] = [];
  const mensagem = tipo === "confirmacao" ? mensagemConfirmacaoPrestador(ag) : mensagemLembretePrestador(ag);

  if (!ag.prestadores?.whatsapp && !ag.prestadores?.email) {
    return [];
  }

  // Verifica preferências antes de enviar email
  const deveEnviarEmail = tipo === "confirmacao" ? prefs.email_novo_agendamento : prefs.email_lembrete_d1;
  if (deveEnviarEmail && ag.prestadores.email) {
    try {
      await enviarEmail(
        ag.prestadores.email,
        tipo === "confirmacao" ? `📬 Novo agendamento de ${ag.cliente_nome}` : `🔔 Lembrete: ${ag.cliente_nome} amanhã`,
        `<div style="font-family: sans-serif;"><h2>${tipo === "confirmacao" ? "📬 Novo agendamento!" : "🔔 Lembrete"}</h2><p>${mensagem.replace(/\n/g, "<br>")}</p></div>`
      );
      enviados.push(`email:${ag.prestadores.email}`);
    } catch (err) {
      console.error("Erro email prestador:", err);
    }
  }

  // Verifica preferências antes de enviar WhatsApp
  const deveEnviarWhatsApp = tipo === "confirmacao" ? prefs.whatsapp_novo_agendamento : prefs.whatsapp_lembrete_d1;
  if (deveEnviarWhatsApp) {
    try {
      const zapi = Deno.env.get("ZAPI_INSTANCE_ID");
      if (zapi && ag.prestadores.whatsapp) {
        await enviarWhatsApp(ag.prestadores.whatsapp, mensagem);
        enviados.push(`whatsapp:${ag.prestadores.whatsapp}`);
      }
    } catch (err) {
      console.error("Erro WhatsApp prestador:", err);
    }
  }

  return enviados;
}

async function handleConfirmacao(supabase: ReturnType<typeof createClient>, agendamentoId: string) {
  const { data: ag, error } = await supabase
    .from("agendamentos")
    .select(`id, prestador_id, data_hora, cliente_nome, cliente_tel, cliente_email, cancel_token, status, servicos(nome,duracao_min,preco), prestadores(nome,whatsapp,slug,email)`)
    .eq("id", agendamentoId)
    .single();

  if (error || !ag) throw new Error("Agendamento não encontrado");

  const prefs = await getPreferencias(supabase, ag.prestador_id);
  const enviados = await notificarCliente(ag as Agendamento, "confirmacao");
  const enviadosPrestador = await notificarPrestador(ag as Agendamento, "confirmacao", prefs);

  return { enviados: [...enviados, ...enviadosPrestador] };
}

async function handleLembreteD1(supabase: ReturnType<typeof createClient>) {
  const amanha = new Date();
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  const inicioDia = new Date(amanha);
  inicioDia.setUTCHours(3, 0, 0, 0);
  const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000 - 1);

  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select(`id, prestador_id, data_hora, cliente_nome, cliente_tel, cliente_email, cancel_token, status, servicos(nome,duracao_min,preco), prestadores(nome,whatsapp,slug,email)`)
    .eq("status", "confirmado")
    .gte("data_hora", inicioDia.toISOString())
    .lte("data_hora", fimDia.toISOString());

  if (error) throw error;

  let processados = 0;
  for (const ag of agendamentos ?? []) {
    try {
      const prefs = await getPreferencias(supabase, ag.prestador_id);
      await notificarCliente(ag as Agendamento, "lembrete");
      await notificarPrestador(ag as Agendamento, "lembrete", prefs);
      processados++;
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`Erro lembrete ${ag.id}:`, err);
    }
  }

  return { processados };
}

Deno.serve(async (req: Request) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const { tipo, agendamento_id } = body;

    if (!tipo) return Response.json({ erro: "Campo obrigatório: tipo" }, { status: 400, headers: cors });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (tipo === "confirmacao") {
      if (!agendamento_id) return Response.json({ erro: "agendamento_id obrigatório" }, { status: 400, headers: cors });
      const resultado = await handleConfirmacao(supabase, agendamento_id);
      return Response.json({ ok: true, ...resultado }, { headers: cors });
    }

    if (tipo === "lembrete_d1") {
      const resultado = await handleLembreteD1(supabase);
      return Response.json({ ok: true, ...resultado }, { headers: cors });
    }

    return Response.json({ erro: `Tipo inválido: ${tipo}` }, { status: 400, headers: cors });
  } catch (err) {
    console.error("Erro:", err);
    return Response.json({ erro: "Erro interno", detalhe: String(err) }, { status: 500, headers: cors });
  }
});
