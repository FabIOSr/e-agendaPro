// supabase/functions/lembretes-whatsapp/index.ts
//
// Dois modos de uso:
//
//   1. CONFIRMAÇÃO IMEDIATA — chamada pelo app logo após o agendamento ser criado.
//      POST { tipo: "confirmacao", agendamento_id: "uuid" }
//
//   2. LEMBRETE D-1 — chamada por um cron job todo dia às 18h.
//      POST { tipo: "lembrete_d1" }
//      Busca todos os agendamentos confirmados para amanhã e envia um lembrete
//      tanto para o cliente quanto para o prestador.
//
// Variáveis de ambiente necessárias (configurar em Supabase > Edge Functions > Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ZAPI_INSTANCE_ID      — ID da instância no Z-API
//   ZAPI_TOKEN            — token de segurança do Z-API
//   ZAPI_CLIENT_TOKEN     — client token do Z-API (header Client-Token)
//   APP_URL               — URL base do app (ex: https://seuapp.com)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Agendamento {
  id: string;
  data_hora: string;
  cliente_nome: string;
  cliente_tel: string;  // formato: "5511999998888" (sem + ou espaços)
  cancel_token: string; // token único para cancelamento/reagendamento
  status: string;
  servicos: {
    nome: string;
    duracao_min: number;
    preco: number | null;
  };
  prestadores: {
    nome: string;
    whatsapp: string;   // mesmo formato: "5511999997777"
    slug: string;
  };
}

// Gera as URLs de ação do cliente a partir do cancel_token
function linksCliente(cancelToken: string): { cancelar: string; reagendar: string } {
  const base = Deno.env.get("APP_URL") ?? Deno.env.get("SUPABASE_URL");
  // Se APP_URL aponta para o domínio próprio, usa Edge Functions do Supabase como fallback
  const baseEf = Deno.env.get("SUPABASE_URL");
  return {
    cancelar:   `${baseEf}/functions/v1/cancelar-agendamento-cliente?token=${cancelToken}`,
    reagendar:  `${baseEf}/functions/v1/reagendar-cliente?token=${cancelToken}`,
  };
}

// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  const dia  = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${dia} às ${hora}`;
}

function formatarPreco(preco: number | null): string {
  if (!preco) return "";
  return ` — R$${preco.toFixed(2).replace(".", ",")}`;
}

// Garante que o número está no formato E.164 sem o "+" (Z-API usa assim)
function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, "");
}

// ---------------------------------------------------------------------------
// Montagem das mensagens
// ---------------------------------------------------------------------------

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
    `Acesse seu painel para gerenciar: ${Deno.env.get("APP_URL")}/${ag.prestadores.slug}`
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

// ---------------------------------------------------------------------------
// Envio via Z-API
// ---------------------------------------------------------------------------

async function enviarWhatsApp(telefone: string, mensagem: string): Promise<void> {
  const instanceId   = Deno.env.get("ZAPI_INSTANCE_ID")!;
  const token        = Deno.env.get("ZAPI_TOKEN")!;
  const clientToken  = Deno.env.get("ZAPI_CLIENT_TOKEN")!;

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": clientToken,
    },
    body: JSON.stringify({
      phone: normalizarTelefone(telefone),
      message: mensagem,
    }),
  });

  if (!res.ok) {
    const erro = await res.text();
    throw new Error(`Z-API erro ${res.status}: ${erro}`);
  }
}

// ---------------------------------------------------------------------------
// Modo 1 — Confirmação imediata após agendamento
// ---------------------------------------------------------------------------

async function handleConfirmacao(
  supabase: ReturnType<typeof createClient>,
  agendamentoId: string
): Promise<{ enviados: string[] }> {
  const { data: ag, error } = await supabase
    .from("agendamentos")
    .select(`
      id, data_hora, cliente_nome, cliente_tel, cancel_token, status,
      servicos ( nome, duracao_min, preco ),
      prestadores ( nome, whatsapp, slug )
    `)
    .eq("id", agendamentoId)
    .single();

  if (error || !ag) throw new Error("Agendamento não encontrado");

  const enviados: string[] = [];

  // Mensagem para o cliente
  await enviarWhatsApp(ag.cliente_tel, mensagemConfirmacaoCliente(ag as Agendamento));
  enviados.push(`cliente:${ag.cliente_tel}`);

  // Mensagem para o prestador
  if (ag.prestadores?.whatsapp) {
    await enviarWhatsApp(ag.prestadores.whatsapp, mensagemConfirmacaoPrestador(ag as Agendamento));
    enviados.push(`prestador:${ag.prestadores.whatsapp}`);
  }

  return { enviados };
}

// ---------------------------------------------------------------------------
// Modo 2 — Lembrete D-1 (cron job)
// ---------------------------------------------------------------------------

async function handleLembreteD1(
  supabase: ReturnType<typeof createClient>
): Promise<{ processados: number; erros: string[] }> {
  // Intervalo: amanhã 00:00 até amanhã 23:59 (fuso Brasília = UTC-3)
  const agora       = new Date();
  const amanha      = new Date(agora);
  amanha.setUTCDate(agora.getUTCDate() + 1);

  const inicioDia = new Date(amanha);
  inicioDia.setUTCHours(3, 0, 0, 0);   // 00:00 Brasília = 03:00 UTC

  const fimDia = new Date(amanha);
  fimDia.setUTCHours(26, 59, 59, 999); // 23:59 Brasília = 02:59 UTC (+1 dia)
  // Simplificado: pegamos 27h depois do início do dia UTC-3
  fimDia.setTime(inicioDia.getTime() + 24 * 60 * 60 * 1000 - 1);

  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select(`
      id, data_hora, cliente_nome, cliente_tel, cancel_token, status,
      servicos ( nome, duracao_min, preco ),
      prestadores ( nome, whatsapp, slug )
    `)
    .eq("status", "confirmado")
    .gte("data_hora", inicioDia.toISOString())
    .lte("data_hora", fimDia.toISOString());

  if (error) throw error;

  let processados = 0;
  const erros: string[] = [];

  for (const ag of agendamentos ?? []) {
    try {
      // Lembrete para o cliente
      await enviarWhatsApp(
        ag.cliente_tel,
        mensagemLembreteCliente(ag as Agendamento)
      );

      // Lembrete para o prestador
      if (ag.prestadores?.whatsapp) {
        await enviarWhatsApp(
          ag.prestadores.whatsapp,
          mensagemLembretePrestador(ag as Agendamento)
        );
      }

      processados++;

      // Pausa de 1.5s entre envios para respeitar rate limit do Z-API
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      erros.push(`agendamento ${ag.id}: ${String(err)}`);
    }
  }

  return { processados, erros };
}

// ---------------------------------------------------------------------------
// Handler HTTP principal
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const { tipo, agendamento_id } = body;

    if (!tipo) {
      return Response.json(
        { erro: "Campo obrigatório: tipo ('confirmacao' | 'lembrete_d1')" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (tipo === "confirmacao") {
      if (!agendamento_id) {
        return Response.json(
          { erro: "agendamento_id é obrigatório para tipo 'confirmacao'" },
          { status: 400 }
        );
      }
      const resultado = await handleConfirmacao(supabase, agendamento_id);
      return Response.json({ ok: true, ...resultado });
    }

    if (tipo === "lembrete_d1") {
      const resultado = await handleLembreteD1(supabase);
      return Response.json({ ok: true, ...resultado });
    }

    return Response.json(
      { erro: `Tipo inválido: ${tipo}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("Erro:", err);
    return Response.json(
      { erro: "Erro interno", detalhe: String(err) },
      { status: 500 }
    );
  }
});
