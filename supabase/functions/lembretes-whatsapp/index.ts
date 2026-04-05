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
//   Evolution API (WhatsApp):
//   EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME
//
//   SendGrid (Email):
//   SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

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
  const apiUrl = Deno.env.get("EVOLUTION_API_URL");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!apiUrl || !apiKey || !instanceName) {
    throw new Error("Evolution API não configurado (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME)");
  }

  // Evolution API usa formato internacional (55 + DDD + número)
  const numero = normalizarTelefone(telefone);
  const numeroInternacional = numero.startsWith("55") ? numero : `55${numero}`;

  const url = `${apiUrl}/message/sendText/${instanceName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      number: numeroInternacional,
      text: mensagem,
    }),
  });

  if (!res.ok) {
    const erro = await res.text();
    throw new Error(`Evolution API erro ${res.status}: ${erro}`);
  }
}

async function enviarEmail(to: string, subject: string, html: string): Promise<void> {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) {
    throw new Error("SENDGRID_API_KEY não configurada");
  }

  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@agendapro.com.br";
  const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "AgendaPro";

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sendgridKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject: subject,
      content: [{ type: "text/html", value: html }],
    }),
  });

  // SendGrid retorna 202Accepted
  if (!res.ok && res.status !== 202) {
    const erro = await res.text();
    throw new Error(`SendGrid erro ${res.status}: ${erro}`);
  }
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

async function notificarCliente(ag: Agendamento, tipo: "confirmacao" | "lembrete", planoPrestador: string): Promise<string[]> {
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

  // WhatsApp apenas para prestadores Pro (diferencial do plano pago)
  if (planoPrestador === 'pro') {
    try {
      const evolutionApi = Deno.env.get("EVOLUTION_API_URL");
      if (evolutionApi) {
        await enviarWhatsApp(ag.cliente_tel, mensagem);
        enviados.push(`whatsapp:${ag.cliente_tel}`);
      }
    } catch (err) {
      console.error("Erro WhatsApp cliente:", err);
    }
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
      const evolutionApi = Deno.env.get("EVOLUTION_API_URL");
      if (evolutionApi && ag.prestadores.whatsapp) {
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
    .select(`id, prestador_id, data_hora, cliente_nome, cliente_tel, cliente_email, cancel_token, status, servicos(nome,duracao_min,preco), prestadores(nome,whatsapp,slug,email,plano)`)
    .eq("id", agendamentoId)
    .single();

  if (error || !ag) throw new Error("Agendamento não encontrado");

  const prefs = await getPreferencias(supabase, ag.prestador_id);
  const enviados = await notificarCliente(ag as Agendamento, "confirmacao", ag.prestadores.plano);
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
    .select(`id, prestador_id, data_hora, cliente_nome, cliente_tel, cliente_email, cancel_token, status, servicos(nome,duracao_min,preco), prestadores(nome,whatsapp,slug,email,plano)`)
    .eq("status", "confirmado")
    .gte("data_hora", inicioDia.toISOString())
    .lte("data_hora", fimDia.toISOString());

  if (error) throw error;

  let processados = 0;
  for (const ag of agendamentos ?? []) {
    try {
      const prefs = await getPreferencias(supabase, ag.prestador_id);
      await notificarCliente(ag as Agendamento, "lembrete", ag.prestadores.plano);
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
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

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
