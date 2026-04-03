// supabase/functions/criar-agendamento/index.ts
//
// Cria um agendamento com validacao atomica no banco.
// O front-end nao faz mais INSERT direto na tabela agendamentos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { normalizarResultadoCriacaoAgendamento } from "../../../modules/agendamento-response.js";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const errorContext: Record<string, unknown> = {
    method: req.method,
    content_type: req.headers.get("content-type"),
    url: req.url,
  };

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ erro: "Body invalido" }, { status: 400, headers: CORS });
    }

    const {
      prestador_id,
      servico_id,
      cliente_nome,
      cliente_tel,
      cliente_email,
      data_hora,
      token_reserva,
    } = body;

    errorContext.prestador_id = prestador_id;
    errorContext.servico_id = servico_id;
    errorContext.cliente_nome = cliente_nome;
    errorContext.cliente_tel = cliente_tel;
    errorContext.cliente_email = cliente_email;
    errorContext.data_hora = data_hora;
    errorContext.token_reserva = Boolean(token_reserva);

    if (!prestador_id || !servico_id || !cliente_nome || !cliente_tel || !data_hora) {
      return Response.json(
        { erro: "Campos obrigatorios: prestador_id, servico_id, cliente_nome, cliente_tel, data_hora" },
        { status: 400, headers: CORS },
      );
    }

    const dataHoraDate = new Date(data_hora);
    if (Number.isNaN(dataHoraDate.getTime())) {
      return Response.json(
        { erro: "data_hora invalido. Use ISO 8601 (ex: 2026-04-10T09:00:00-03:00)" },
        { status: 400, headers: CORS },
      );
    }

    if (dataHoraDate < new Date()) {
      return Response.json(
        { erro: "Nao e possivel agendar no passado" },
        { status: 400, headers: CORS },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: resultadoCriacao, error: errCriacao } = await supabase.rpc(
      "criar_agendamento_atomic",
      {
        p_prestador_id: prestador_id,
        p_servico_id: servico_id,
        p_cliente_nome: cliente_nome,
        p_cliente_tel: cliente_tel,
        p_cliente_email: cliente_email?.trim() || null,
        p_data_hora: dataHoraDate.toISOString(),
        p_token_reserva: token_reserva ?? null,
      },
    );

    if (errCriacao) {
      console.error("Erro ao executar criar_agendamento_atomic:", errCriacao);
      return Response.json({ erro: "Erro ao criar agendamento" }, { status: 500, headers: CORS });
    }

    const resultadoNormalizado = normalizarResultadoCriacaoAgendamento(resultadoCriacao);
    if (!resultadoNormalizado.ok) {
      return Response.json(resultadoNormalizado.body, {
        status: resultadoNormalizado.status,
        headers: CORS,
      });
    }

    const agendamentoId = resultadoNormalizado.body.agendamento_id as string;

    const { error: errCliente } = await supabase
      .from("clientes")
      .upsert(
        {
          prestador_id,
          nome: cliente_nome.trim(),
          telefone: cliente_tel.trim(),
        },
        { onConflict: "prestador_id,telefone", ignoreDuplicates: true },
      );

    if (errCliente) {
      console.warn("Erro ao upsert cliente (nao critico):", errCliente.message);
    }

    try {
      const gcalUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync`;
      const gcalResp = await fetch(gcalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        },
        body: JSON.stringify({
          action: "criar",
          agendamento_id: agendamentoId,
        }),
      });

      const gcalData = await gcalResp.json();
      if (gcalData.sincronizado) {
        console.log(`Google Calendar sincronizado: evento ${gcalData.evento_id}`);
      } else {
        console.log(`Google Calendar nao sincronizado: ${gcalData.motivo ?? "sem motivo"}`);
      }
    } catch (errGcal) {
      console.warn("Erro ao sincronizar Google Calendar (nao critico):", String(errGcal));
    }

    console.log(`Agendamento criado: ${agendamentoId} - prestador: ${prestador_id}`);

    return Response.json(
      { ok: true, agendamento_id: agendamentoId },
      { status: 200, headers: CORS },
    );
  } catch (err) {
    if (SENTRY_DSN) {
      Sentry.captureException(err, {
        tags: { function: "criar-agendamento" },
        extra: errorContext,
      });
    }

    console.error("Erro inesperado:", err);
    return Response.json(
      { erro: "Erro interno no servidor" },
      { status: 500, headers: CORS },
    );
  }
});
