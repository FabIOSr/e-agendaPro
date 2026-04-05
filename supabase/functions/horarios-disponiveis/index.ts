// supabase/functions/horarios-disponiveis/index.ts
//
// Retorna os slots de horário disponíveis para um prestador em uma data,
// descartando tudo que conflita com:
//   1. Agendamentos já confirmados (com a duração real de cada serviço)
//   2. Bloqueios manuais (almoço, férias, reunião, compromisso pessoal…)
//   3. Horário fora da disponibilidade semanal do prestador
//   4. Slots que "transbordam" para fora do expediente
//   5. Slots no passado (data/hora já passou)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { generateSlots } from "../../../modules/scheduling-rules.js";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";


// CORS local antigo (substituído pelo módulo _shared/cors.ts)
// const cors = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// };

// Inicializa Sentry (se DSN configurado)
const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tracesSampleRate: 0.1,
  });
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Disponibilidade {
  hora_inicio: string; // "09:00"
  hora_fim: string;    // "18:00"
}

interface Agendamento {
  data_hora: string;   // ISO 8601
  duracao_min: number; // duração do serviço já agendado
  intervalo_min: number; // buffer após o agendamento
}

interface Bloqueio {
  inicio: string;   // ISO 8601
  fim: string;      // ISO 8601
  motivo?: string;
}

interface BloqueioRecorrente {
  dia_semana: number; // 0=Dom … 6=Sáb
  hora_inicio: string; // "12:00"
  hora_fim: string;    // "13:00"
  motivo?: string;
}

interface Slot {
  hora: string;             // "10:00"
  disponivel: boolean;
  motivo_bloqueio?: string; // preenchido quando disponivel = false (útil para debug)
}

// ---------------------------------------------------------------------------
// Handler HTTP
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const errorContext: Record<string, unknown> = {
    method: req.method,
    content_type: req.headers.get("content-type"),
    url: req.url,
  };

  try {
    const {
      prestador_slug,
      servico_id,
      data,            // "2026-03-21"
      intervalo_slot,  // opcional, padrão 30 min
    } = await req.json();
    errorContext.prestador_slug = prestador_slug;
    errorContext.servico_id = servico_id;
    errorContext.data = data;
    errorContext.intervalo_slot = intervalo_slot;

    if (!prestador_slug || !servico_id || !data) {
      return Response.json(
        { erro: "Campos obrigatórios: prestador_slug, servico_id, data" },
        { status: 400, headers: cors }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return Response.json(
        { erro: "Formato de data inválido. Use YYYY-MM-DD" },
        { status: 400, headers: cors }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Resolve o prestador pelo slug
    const { data: prestador, error: errP } = await supabase
      .from("prestadores")
      .select("id, intervalo_min, intervalo_slot, plano, plano_valido_ate")
      .eq("slug", prestador_slug)
      .single();

    if (errP || !prestador) {
      return Response.json({ erro: "Prestador não encontrado" }, { status: 404, headers: cors });
    }

    const prestadorId = prestador.id;
    const intervaloMin = prestador.intervalo_min ?? 0;

    // Verifica se é Pro (usa intervalo_slot configurado)
    const isPro = prestador.plano === "pro"
      && prestador.plano_valido_ate
      && new Date(prestador.plano_valido_ate) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Para usuários free, ignora intervalo_slot e usa sempre duração do serviço
    const intervaloSlotConfig = isPro ? prestador.intervalo_slot : null;

    // 2. Serviço e sua duração
    const { data: servico, error: errS } = await supabase
      .from("servicos")
      .select("duracao_min, nome")
      .eq("id", servico_id)
      .eq("prestador_id", prestadorId)
      .eq("ativo", true)
      .single();

    if (errS || !servico) {
      return Response.json(
        { erro: "Serviço não encontrado ou inativo" },
        { status: 404, headers: cors }
      );
    }

    // 3. Disponibilidade semanal do dia solicitado
    const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay(); // 0=Dom … 6=Sáb

    const { data: disponibilidades, error: errD } = await supabase
      .from("disponibilidade")
      .select("hora_inicio, hora_fim")
      .eq("prestador_id", prestadorId)
      .eq("dia_semana", diaSemana);

    if (errD) throw errD;

    if (!disponibilidades || disponibilidades.length === 0) {
      return Response.json({
        data,
        servico: servico.nome,
        slots: [],
        mensagem: "Prestador não atende neste dia da semana",
      }, { headers: cors });
    }

    // 4. Agendamentos confirmados ou reservados no dia (reservado = bloqueado para lista de espera)
    const { data: agendamentos, error: errA } = await supabase
      .from("agendamentos")
      .select("data_hora, servicos(duracao_min)")
      .eq("prestador_id", prestadorId)
      .in("status", ["confirmado", "reservado"])
      .gte("data_hora", `${data}T00:00:00Z`)
      .lte("data_hora", `${data}T23:59:59Z`);

    if (errA) throw errA;

    const agendamentosNorm: Agendamento[] = (agendamentos ?? []).map(
      (ag: any) => ({
        data_hora: ag.data_hora,
        duracao_min: ag.servicos?.duracao_min ?? 60,
        intervalo_min: intervaloMin,
      })
    );

    // 5. Bloqueios pontuais que tocam o dia
    //    (inclui bloqueios longos — ex: férias de vários dias)
    const { data: bloqueios, error: errB } = await supabase
      .from("bloqueios")
      .select("inicio, fim, motivo")
      .eq("prestador_id", prestadorId)
      .lt("inicio", `${data}T23:59:59Z`)
      .gt("fim", `${data}T00:00:00Z`);

    if (errB) throw errB;

    // 6. Bloqueios recorrentes (dia da semana + horário)
    //    Ex: almoço toda segunda a sexta das 12:00 às 13:00
    const { data: bloqueiosRecorrentes, error: errBR } = await supabase
      .from("bloqueios_recorrentes")
      .select("dia_semana, hora_inicio, hora_fim, motivo")
      .eq("prestador_id", prestadorId)
      .eq("dia_semana", diaSemana)
      .eq("ativo", true);

    if (errBR) {
      console.warn("Erro ao buscar bloqueios recorrentes:", errBR.message);
    }

    // 7. Gera os slots e retorna
    // Cadência: usa intervaloSlot (Pro) ou duração do serviço + buffer (Free)
    const cadenciaSlots = intervaloSlotConfig || (servico.duracao_min + intervaloMin);

    const slots = generateSlots({
      data,
      disponibilidades,
      duracaoServico: servico.duracao_min,
      agendamentos: agendamentosNorm,
      bloqueios: bloqueios ?? [],
      intervaloSlot: cadenciaSlots,
      intervaloMin,
      bloqueiosRecorrentes: bloqueiosRecorrentes ?? [],
    });

    return Response.json(
      {
        data,
        servico: servico.nome,
        duracao_min: servico.duracao_min,
        total_slots: slots.length,
        total_disponiveis: slots.filter((s) => s.disponivel).length,
        slots,
      },
      {
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    // Captura erro no Sentry
    if (SENTRY_DSN) {
      Sentry.captureException(err, {
        tags: { function: "horarios-disponiveis" },
        extra: errorContext,
      });
    }
    
    console.error("Erro:", err);
    return Response.json(
      { erro: "Erro interno", detalhe: String(err) },
      { status: 500, headers: cors }
    );
  }
});