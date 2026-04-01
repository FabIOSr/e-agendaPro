// supabase/functions/criar-agendamento/index.ts
//
// Cria um agendamento com validação de limite free no backend.
// O front-end NÃO faz mais INSERT direto na tabela agendamentos.
//
// POST body esperado:
// {
//   prestador_id: string (uuid)
//   servico_id:   string (uuid)
//   cliente_nome: string
//   cliente_tel:  string
//   data_hora:    string (ISO 8601, ex: "2026-04-10T09:00:00-03:00")
// }
//
// Retorna:
//   200 { ok: true, agendamento_id: string }
//   400 { erro: string }
//   403 { erro: "limite_atingido", count: number }
//   500 { erro: string }

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LIMITE_FREE = 10;
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  try {
    // ── Parse do body ──────────────────────────────────────────────────────
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ erro: "Body inválido" }, { status: 400, headers: CORS });
    }

    const { prestador_id, servico_id, cliente_nome, cliente_tel, cliente_email, data_hora } = body;

    if (!prestador_id || !servico_id || !cliente_nome || !cliente_tel || !data_hora) {
      return Response.json(
        { erro: "Campos obrigatórios: prestador_id, servico_id, cliente_nome, cliente_tel, data_hora" },
        { status: 400, headers: CORS }
      );
    }

    // Validação básica de data_hora
    const dataHoraDate = new Date(data_hora);
    if (isNaN(dataHoraDate.getTime())) {
      return Response.json(
        { erro: "data_hora inválido. Use ISO 8601 (ex: 2026-04-10T09:00:00-03:00)" },
        { status: 400, headers: CORS }
      );
    }

    if (dataHoraDate < new Date()) {
      return Response.json(
        { erro: "Não é possível agendar no passado" },
        { status: 400, headers: CORS }
      );
    }

    // ── Supabase (service role para bypassar RLS) ──────────────────────────
    // Usamos service role pois a tabela agendamentos tem RLS que exige auth.
    // A validação de negócio (limite free, serviço ativo, prestador existe)
    // é feita aqui antes de qualquer escrita.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Valida que o prestador existe ───────────────────────────────────
  const { data: prestador, error: errPrest } = await supabase
    .from("prestadores")
    .select("id, plano, plano_valido_ate")
    .eq("id", prestador_id)
    .maybeSingle();

  if (errPrest || !prestador) {
    return Response.json({ erro: "Prestador não encontrado" }, { status: 400, headers: CORS });
  }

  // ── 2. Valida que o serviço existe, pertence ao prestador e está ativo ─
  const { data: servico, error: errServ } = await supabase
    .from("servicos")
    .select("id, duracao_min")
    .eq("id", servico_id)
    .eq("prestador_id", prestador_id)
    .eq("ativo", true)
    .maybeSingle();

  if (errServ || !servico) {
    return Response.json(
      { erro: "Serviço não encontrado ou inativo" },
      { status: 400, headers: CORS }
    );
  }

  // ── 3. Verifica limite free ────────────────────────────────────────────
  const isPro =
    prestador.plano === "pro" &&
    prestador.plano_valido_ate &&
    new Date(prestador.plano_valido_ate) > new Date(Date.now() - GRACE_PERIOD_MS);

  if (!isPro) {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const fimMes = new Date(
      agora.getFullYear(),
      agora.getMonth() + 1,
      0,
      23,
      59,
      59
    ).toISOString();

    const { count, error: errCount } = await supabase
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("prestador_id", prestador_id)
      .gte("data_hora", inicioMes)
      .lte("data_hora", fimMes)
      .neq("status", "cancelado");

    if (errCount) {
      console.error("Erro ao contar agendamentos:", errCount);
      return Response.json({ erro: "Erro interno" }, { status: 500, headers: CORS });
    }

    if ((count ?? 0) >= LIMITE_FREE) {
      console.log(`Limite free atingido para prestador ${prestador_id}: ${count} agendamentos`);
      return Response.json(
        { erro: "limite_atingido", count: count ?? 0, limite: LIMITE_FREE },
        { status: 403, headers: CORS }
      );
    }
  }

  // ── 4. Verifica conflito de horário e bloqueios ───────────────────────
  // Garante que o slot ainda está livre no momento do INSERT
  const inicioMs     = dataHoraDate.getTime();
  const fimMs        = inicioMs + servico.duracao_min * 60_000;
  const fimAgendamento = new Date(fimMs).toISOString();
  const inicioMenos  = new Date(inicioMs - servico.duracao_min * 60_000).toISOString();

  // 4a. Double-booking — agendamentos confirmados que se sobrepõem
  const { data: conflitos } = await supabase
    .from("agendamentos")
    .select("id")
    .eq("prestador_id", prestador_id)
    .eq("status", "confirmado")
    .lt("data_hora", fimAgendamento)
    .gt("data_hora", inicioMenos);

  if (conflitos && conflitos.length > 0) {
    return Response.json(
      { erro: "Horário não disponível. Por favor, escolha outro horário." },
      { status: 409, headers: CORS }
    );
  }

  // 4b. Bloqueios manuais que se sobrepõem ao novo agendamento
  // Intervalo do agendamento: [dataHoraDate, fimAgendamento)
  // Conflito se: bloqueio.inicio < fimAgendamento E bloqueio.fim > dataHoraDate
  const { data: bloqueiosConflito } = await supabase
    .from("bloqueios")
    .select("id, motivo, inicio, fim")
    .eq("prestador_id", prestador_id)
    .lt("inicio", fimAgendamento)
    .gt("fim",    dataHoraDate.toISOString());

  if (bloqueiosConflito && bloqueiosConflito.length > 0) {
    const b = bloqueiosConflito[0];
    const motivo = b.motivo || "bloqueio";
    console.log(`Bloqueio impediu: ${motivo} — prestador: ${prestador_id} — slot: ${dataHoraDate.toISOString()}`);
    return Response.json(
      { erro: "Horário indisponível: " + motivo + ". Por favor, escolha outro horário." },
      { status: 409, headers: CORS }
    );
  }

  // ── 5. INSERT em agendamentos ──────────────────────────────────────────
  const { data: agendamento, error: errInsert } = await supabase
    .from("agendamentos")
    .insert({
      prestador_id,
      servico_id,
      cliente_nome:  cliente_nome.trim(),
      cliente_tel:   cliente_tel.trim(),
      cliente_email: cliente_email?.trim() || null,
      data_hora:     dataHoraDate.toISOString(),
      status:       "confirmado",
      cancel_token: crypto.randomUUID(),
    })
    .select("id")
    .single();

  if (errInsert || !agendamento) {
    console.error("Erro ao inserir agendamento:", errInsert);
    return Response.json({ erro: "Erro ao criar agendamento" }, { status: 500, headers: CORS });
  }

  // ── 6. Upsert em clientes (CRM) ────────────────────────────────────────
  // Não bloqueia a resposta em caso de erro aqui — o agendamento já foi criado
  const { error: errCliente } = await supabase
    .from("clientes")
    .upsert(
      {
        prestador_id,
        nome:      cliente_nome.trim(),
        telefone:  cliente_tel.trim(),
      },
      { onConflict: "prestador_id,telefone", ignoreDuplicates: true }
    );

  if (errCliente) {
    console.warn("Erro ao upsert cliente (não crítico):", errCliente.message);
  }

  // ── 7. Sincronizar com Google Calendar (não crítico) ───────────────────
  // Chamada fire-and-forget — falha silenciosa para não bloquear o agendamento
  try {
    const gcalUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync`;
    const gcalResp = await fetch(gcalUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "apikey":        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify({
        action:         "criar",
        agendamento_id: agendamento.id,
      }),
    });
    const gcalData = await gcalResp.json();
    if (gcalData.sincronizado) {
      console.log(`📅 Google Calendar sincronizado: evento ${gcalData.evento_id}`);
    } else {
      console.log(`📅 Google Calendar não sincronizado: ${gcalData.motivo ?? "sem motivo"}`);
    }
  } catch (errGcal) {
    // Nunca falha o agendamento por causa do Calendar
    console.warn("Erro ao sincronizar Google Calendar (não crítico):", String(errGcal));
  }

  console.log(`✅ Agendamento criado: ${agendamento.id} — prestador: ${prestador_id}`);

  return Response.json(
    { ok: true, agendamento_id: agendamento.id },
    { status: 200, headers: CORS }
  );
} catch (err) {
  // Captura erro no Sentry
  if (SENTRY_DSN) {
    Sentry.captureException(err, {
      tags: { function: "criar-agendamento" },
      extra: { prestador_id, servico_id, cliente_nome, cliente_tel },
    });
  }
  
  console.error("Erro inesperado:", err);
  return Response.json(
    { erro: "Erro interno no servidor" },
    { status: 500, headers: CORS }
  );
}
});
