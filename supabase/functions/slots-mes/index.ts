// supabase/functions/slots-mes/index.ts
//
// Retorna slots disponíveis para todos os dias de um mês.
// Reaproveita a lógica existente de generateSlots() mas com batch queries
// para evitar fazer 30 requisições (uma por dia).
//
// Uso: POST /slots-mes
// Body: { prestador_slug, servico_id, mes: "2024-04", data_inicio?: "2024-04-15" }
// Retorno: { "2024-04-15": { total_disponiveis: 5, primeiro_slot: "10:00" }, ... }
//
// Parâmetros:
// - mes: YYYY-MM (obrigatório)
// - data_inicio: YYYY-MM-DD (opcional) - Só retorna dias a partir desta data

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
import { generateSlots, getAgoraBRT } from "../../../modules/scheduling-rules.js";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

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
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

interface Agendamento {
  data_hora: string;
  duracao_min: number;
  intervalo_min: number;
}

interface Bloqueio {
  inicio: string;
  fim: string;
  motivo?: string;
}

interface BloqueioRecorrente {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  motivo?: string;
}

interface SlotsDia {
  total_disponiveis: number;
  primeiro_slot?: string;
  todos_cheios?: boolean;
}

// ---------------------------------------------------------------------------
// Helper: verifica se bloqueio toca um dia específico
// ---------------------------------------------------------------------------

function tocaDia(bloqueio: Bloqueio, dataISO: string): boolean {
  const inicio = new Date(bloqueio.inicio);
  const fim = new Date(bloqueio.fim);
  const dia = new Date(`${dataISO}T12:00:00Z`);

  // Bloqueio toca o dia se:
  // - Começa antes do fim do dia E
  // - Termina depois do início do dia
  const fimDoDia = new Date(`${dataISO}T23:59:59Z`);
  const inicioDoDia = new Date(`${dataISO}T00:00:00Z`);

  return inicio < fimDoDia && fim > inicioDoDia;
}

// ---------------------------------------------------------------------------
// Helper: formata data ISO (YYYY-MM-DD)
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Helper: calcula dias no mês
// ---------------------------------------------------------------------------

function getDiasNoMes(ano: number, mes: number): Date[] {
  const dias: Date[] = [];
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)); // Último dia do mês anterior

  for (let d = 1; d <= ultimoDia.getUTCDate(); d++) {
    dias.push(new Date(Date.UTC(ano, mes - 1, d)));
  }

  return dias;
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
      mes,             // "2024-04"
      data_inicio,     // "2024-04-15" (opcional)
    } = await req.json();

    errorContext.prestador_slug = prestador_slug;
    errorContext.servico_id = servico_id;
    errorContext.mes = mes;
    errorContext.data_inicio = data_inicio;

    if (!prestador_slug || !servico_id || !mes) {
      return Response.json(
        { erro: "Campos obrigatórios: prestador_slug, servico_id, mes" },
        { status: 400, headers: cors }
      );
    }

    // Valida data_inicio se fornecida
    let dataInicioMin: Date | null = null;
    if (data_inicio) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) {
        return Response.json(
          { erro: "Formato de data_inicio inválido. Use YYYY-MM-DD" },
          { status: 400, headers: cors }
        );
      }
      dataInicioMin = new Date(`${data_inicio}T00:00:00Z`);
    }

    // Parse mes (YYYY-MM)
    const mesMatch = mes.match(/^(\d{4})-(\d{2})$/);
    if (!mesMatch) {
      return Response.json(
        { erro: "Formato de mês inválido. Use YYYY-MM" },
        { status: 400, headers: cors }
      );
    }

    const [, anoStr, mesStr] = mesMatch;
    const ano = parseInt(anoStr, 10);
    const mesNum = parseInt(mesStr, 10);

    if (mesNum < 1 || mesNum > 12) {
      return Response.json(
        { erro: "Mês inválido. Use 01-12" },
        { status: 400, headers: cors }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---------------------------------------------------------------------
    // BATCH QUERIES - buscar tudo do mês de uma vez
    // ---------------------------------------------------------------------

    // 1. Prestador
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

    // Verifica se é Pro
    const isPro = prestador.plano === "pro"
      && prestador.plano_valido_ate
      && new Date(prestador.plano_valido_ate) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const intervaloSlotConfig = isPro ? prestador.intervalo_slot : null;

    // 2. Serviço
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

    // 3. Disponibilidade semanal (todos os dias da semana)
    const { data: disponibilidades, error: errD } = await supabase
      .from("disponibilidade")
      .select("dia_semana, hora_inicio, hora_fim")
      .eq("prestador_id", prestadorId);

    if (errD) throw errD;

    // Agrupa por dia da semana
    const dispPorDia: Record<number, Disponibilidade[]> = {};
    for (let i = 0; i < 7; i++) {
      dispPorDia[i] = (disponibilidades ?? []).filter(d => d.dia_semana === i);
    }

    // 4. Agendamentos do mês todo
    const inicioMes = `${mes}-01T00:00:00Z`;
    const ultimoDiaMes = new Date(Date.UTC(ano, mesNum, 0)).getUTCDate();
    const fimMes = `${mes}-${String(ultimoDiaMes).padStart(2, '0')}T23:59:59Z`;

    const { data: agendamentos, error: errA } = await supabase
      .from("agendamentos")
      .select("data_hora, servicos(duracao_min)")
      .eq("prestador_id", prestadorId)
      .in("status", ["confirmado", "reservado"])
      .gte("data_hora", inicioMes)
      .lte("data_hora", fimMes);

    if (errA) throw errA;

    const agendamentosNorm: Agendamento[] = (agendamentos ?? []).map((ag: any) => ({
      data_hora: ag.data_hora,
      duracao_min: ag.servicos?.duracao_min ?? 60,
      intervalo_min: intervaloMin,
    }));

    // 5. Bloqueios do mês todo
    const { data: bloqueios, error: errB } = await supabase
      .from("bloqueios")
      .select("inicio, fim, motivo")
      .eq("prestador_id", prestadorId)
      .lt("inicio", fimMes)
      .gt("fim", inicioMes);

    if (errB) throw errB;

    // 6. Bloqueios recorrentes (todos os dias da semana)
    const { data: bloqueiosRecorrentes, error: errBR } = await supabase
      .from("bloqueios_recorrentes")
      .select("dia_semana, hora_inicio, hora_fim, motivo")
      .eq("prestador_id", prestadorId)
      .eq("ativo", true);

    if (errBR) {
      console.warn("Erro ao buscar bloqueios recorrentes:", errBR.message);
    }

    // Agrupa por dia da semana
    const bloqueiosRecPorDia: Record<number, BloqueioRecorrente[]> = {};
    for (let i = 0; i < 7; i++) {
      bloqueiosRecPorDia[i] = (bloqueiosRecorrentes ?? []).filter(b => b.dia_semana === i);
    }

    // ---------------------------------------------------------------------
    // GERAR SLOTS PARA CADA DIA DO MÊS
    // ---------------------------------------------------------------------

    const cadenciaSlots = intervaloSlotConfig || (servico.duracao_min + intervaloMin);
    const dias = getDiasNoMes(ano, mesNum);
    const resultado: Record<string, SlotsDia> = {};
    const agora = getAgoraBRT();

    for (const dia of dias) {
      const dataISO = formatDate(dia);
      const diaSemana = dia.getUTCDay();

      // Pula dias passados (ou antes de data_inicio se fornecida)
      const diaMeiaNoite = new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate()));
      const dataLimite = dataInicioMin || new Date(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
      if (diaMeiaNoite < dataLimite) {
        continue;
      }

      // Filtra agendamentos e bloqueios deste dia
      const agendamentosDia = agendamentosNorm.filter(ag =>
        ag.data_hora.startsWith(dataISO)
      );

      const bloqueiosDia = (bloqueios ?? []).filter(b =>
        tocaDia(b, dataISO)
      );

      // Gera slots usando a lógica existente
      const slots = generateSlots({
        data: dataISO,
        disponibilidades: dispPorDia[diaSemana] || [],
        duracaoServico: servico.duracao_min,
        agendamentos: agendamentosDia,
        bloqueios: bloqueiosDia,
        intervaloSlot: cadenciaSlots,
        intervaloMin,
        bloqueiosRecorrentes: bloqueiosRecPorDia[diaSemana] || [],
        now: agora,
      });

      // Conta slots disponíveis
      const disponiveis = slots.filter(s => s.disponivel);

      // Só inclui no resultado se TEM disponibilidade ou se o dia é útil
      // (para não poluir com dias que o prestador não atende)
      const temDisponibilidade = dispPorDia[diaSemana]?.length > 0;

      if (temDisponibilidade) {
        resultado[dataISO] = {
          total_disponiveis: disponiveis.length,
          primeiro_slot: disponiveis[0]?.hora,
          todos_cheios: slots.length > 0 && disponiveis.length === 0,
        };
      }
    }

    // ---------------------------------------------------------------------
    // RETORNO
    // ---------------------------------------------------------------------

    return Response.json(
      {
        mes,
        prestador_id: prestadorId,
        servico_id,
        servico: servico.nome,
        duracao_min: servico.duracao_min,
        dias_com_slots: Object.keys(resultado).length,
        dias: resultado,
      },
      {
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    // Captura erro no Sentry
    if (SENTRY_DSN) {
      Sentry.captureException(err, {
        tags: { function: "slots-mes" },
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
