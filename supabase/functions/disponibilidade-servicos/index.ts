// supabase/functions/disponibilidade-servicos/index.ts
//
// Retorna indicadores de disponibilidade para todos os serviços de um prestador.
// Útil para exibir "Disponível hoje" / "Disponível amanhã" nos cards de serviço.
//
// Uso: POST /disponibilidade-servicos
// Body: { prestador_slug, data_inicio?: "2024-04-19" }
// Retorno: { servicos: [{ id, tem_hoje, tem_amanha, dia_label, cor }, ...] }
//
// Cache recomendado: 5 minutos no frontend

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
}

interface BloqueioRecorrente {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

interface ServicoInfo {
  id: string;
  tem_hoje: boolean;
  tem_amanha: boolean;
  tem_semana: boolean;
  dia_label: string;
  cor: "green" | "yellow" | "gray";
}

// ---------------------------------------------------------------------------
// Helper: verifica se bloqueio toca um dia específico
// ---------------------------------------------------------------------------

function tocaDia(bloqueio: Bloqueio, dataISO: string): boolean {
  const inicio = new Date(bloqueio.inicio);
  const fim = new Date(bloqueio.fim);
  const dia = new Date(`${dataISO}T12:00:00Z`);

  const fimDoDia = new Date(`${dataISO}T23:59:59Z`);
  const inicioDoDia = new Date(`${dataISO}T00:00:00Z`);

  return inicio < fimDoDia && fim > inicioDoDia;
}

// ---------------------------------------------------------------------------
// Helper: formata data ISO (YYYY-MM-DD)
// Para datas BRT, extrai diretamente da string ISO criada por getAgoraBRT()
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  // getAgoraBRT() cria: new Date("2024-04-19T22:08:00-03:00")
  // toISOString() retorna UTC: "2024-04-20T01:08:00.000Z"
  // Precisamos da data BRT original: "2024-04-19"
  const isoString = date.toISOString(); // "2024-04-20T01:08:00.000Z"

  // A data BRT é 3 horas antes da UTC (quando não está em horário de verão)
  const utcDate = new Date(isoString);
  utcDate.setHours(utcDate.getHours() - 3);

  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Helper: verifica se tem slot disponível em um dia
// ---------------------------------------------------------------------------

function temSlotDisponivel(
  dataISO: string,
  diaSemana: number,
  duracaoServico: number,
  dispPorDia: Record<number, Disponibilidade[]>,
  agendamentos: Agendamento[],
  bloqueios: Bloqueio[],
  bloqueiosRecPorDia: Record<number, BloqueioRecorrente[]>,
  intervaloSlot: number,
  intervaloMin: number,
  agora: Date
): boolean {
  // Se não há disponibilidade para este dia da semana, retorna false
  const disponibilidadesDoDia = dispPorDia[diaSemana] || [];
  if (disponibilidadesDoDia.length === 0) {
    return false;
  }

  const slots = generateSlots({
    data: dataISO,
    disponibilidades: disponibilidadesDoDia,
    duracaoServico,
    agendamentos: agendamentos.filter(ag => ag.data_hora.startsWith(dataISO)),
    bloqueios: bloqueios.filter(b => tocaDia(b, dataISO)),
    intervaloSlot,
    intervaloMin,
    bloqueiosRecorrentes: bloqueiosRecPorDia[diaSemana] || [],
  });

  // Se o array está vazio (todos os slots passaram), retorna false
  if (slots.length === 0) {
    return false;
  }

  // Verifica se há pelo menos um slot disponível
  return slots.some(s => s.disponivel);
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
      data_inicio,  // opcional, padrão: hoje
    } = await req.json();

    errorContext.prestador_slug = prestador_slug;
    errorContext.data_inicio = data_inicio;

    if (!prestador_slug) {
      return Response.json(
        { erro: "Campo obrigatório: prestador_slug" },
        { status: 400, headers: cors }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---------------------------------------------------------------------
    // 1. Prestador
    // ---------------------------------------------------------------------

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

    // ---------------------------------------------------------------------
    // 2. Serviços ativos
    // ---------------------------------------------------------------------

    const { data: servicos, error: errS } = await supabase
      .from("servicos")
      .select("id, duracao_min, nome, ativo")
      .eq("prestador_id", prestadorId)
      .eq("ativo", true);

    if (errS) throw errS;

    if (!servicos || servicos.length === 0) {
      return Response.json({ servicos: [] }, { headers: cors });
    }

    // ---------------------------------------------------------------------
    // 3. Disponibilidade semanal
    // ---------------------------------------------------------------------

    const { data: disponibilidades, error: errD } = await supabase
      .from("disponibilidade")
      .select("dia_semana, hora_inicio, hora_fim")
      .eq("prestador_id", prestadorId);

    if (errD) throw errD;

    const dispPorDia: Record<number, Disponibilidade[]> = {};
    for (let i = 0; i < 7; i++) {
      dispPorDia[i] = (disponibilidades ?? []).filter(d => d.dia_semana === i);
    }

    // ---------------------------------------------------------------------
    // 4. Dados para os próximos 7 dias
    // ---------------------------------------------------------------------

    const agora = getAgoraBRT();
    const hoje = formatDate(agora);

    // Se data_inicio fornecido, usa ele; senão usa hoje
    const dataInicioBase = data_inicio ? new Date(`${data_inicio}T00:00:00Z`) : agora;
    const dataInicio = formatDate(dataInicioBase);

    // Calcula fim da janela (7 dias)
    const fimJanela = new Date(Date.UTC(
      dataInicioBase.getUTCFullYear(),
      dataInicioBase.getUTCMonth(),
      dataInicioBase.getUTCDate() + 7
    ));
    const fimJanelaISO = formatDate(fimJanela);

    // Agendamentos dos próximos 7 dias
    const { data: agendamentos, error: errA } = await supabase
      .from("agendamentos")
      .select("data_hora, servicos(duracao_min)")
      .eq("prestador_id", prestadorId)
      .in("status", ["confirmado", "reservado"])
      .gte("data_hora", `${dataInicio}T00:00:00Z`)
      .lte("data_hora", `${fimJanelaISO}T23:59:59Z`);

    if (errA) throw errA;

    const agendamentosNorm: Agendamento[] = (agendamentos ?? []).map((ag: any) => ({
      data_hora: ag.data_hora,
      duracao_min: ag.servicos?.duracao_min ?? 60,
      intervalo_min: intervaloMin,
    }));

    // Bloqueios dos próximos 7 dias
    const { data: bloqueios, error: errB } = await supabase
      .from("bloqueios")
      .select("inicio, fim")
      .eq("prestador_id", prestadorId)
      .lt("inicio", `${fimJanelaISO}T23:59:59Z`)
      .gt("fim", `${dataInicio}T00:00:00Z`);

    if (errB) throw errB;

    // Bloqueios recorrentes
    const { data: bloqueiosRecorrentes, error: errBR } = await supabase
      .from("bloqueios_recorrentes")
      .select("dia_semana, hora_inicio, hora_fim")
      .eq("prestador_id", prestadorId)
      .eq("ativo", true);

    if (errBR) {
      console.warn("Erro ao buscar bloqueios recorrentes:", errBR.message);
    }

    const bloqueiosRecPorDia: Record<number, BloqueioRecorrente[]> = {};
    for (let i = 0; i < 7; i++) {
      bloqueiosRecPorDia[i] = (bloqueiosRecorrentes ?? []).filter(b => b.dia_semana === i);
    }

    // ---------------------------------------------------------------------
    // 5. Para cada serviço, verificar disponibilidade
    // ---------------------------------------------------------------------

    const resultado: ServicoInfo[] = [];
    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    for (const servico of servicos) {
      const cadenciaSlots = intervaloSlotConfig || (servico.duracao_min + intervaloMin);

      // Verifica hoje
      const hojeDate = new Date(agora);
      const hojeSemana = hojeDate.getUTCDay();

      const temHoje = temSlotDisponivel(
        hoje,
        hojeSemana,
        servico.duracao_min,
        dispPorDia,
        agendamentosNorm,
        bloqueios ?? [],
        bloqueiosRecPorDia,
        cadenciaSlots,
        intervaloMin,
        agora
      );

      // Verifica amanhã
      const amanhaDate = new Date(Date.UTC(
        hojeDate.getUTCFullYear(),
        hojeDate.getUTCMonth(),
        hojeDate.getUTCDate() + 1
      ));
      const amanhaISO = formatDate(amanhaDate);
      const amanhaSemana = amanhaDate.getUTCDay();
      const temAmanha = temSlotDisponivel(
        amanhaISO,
        amanhaSemana,
        servico.duracao_min,
        dispPorDia,
        agendamentosNorm,
        bloqueios ?? [],
        bloqueiosRecPorDia,
        cadenciaSlots,
        intervaloMin,
        agora
      );

      // Verifica próximos 7 dias (para achar primeiro dia disponível)
      let temSemana = false;
      let primeiroDiaLabel = "";

      for (let i = 2; i <= 7; i++) {
        const dataDate = new Date(Date.UTC(
          hojeDate.getUTCFullYear(),
          hojeDate.getUTCMonth(),
          hojeDate.getUTCDate() + i
        ));
        const dataISO = formatDate(dataDate);
        const diaSemana = dataDate.getUTCDay();

        const temSlot = temSlotDisponivel(
          dataISO,
          diaSemana,
          servico.duracao_min,
          dispPorDia,
          agendamentosNorm,
          bloqueios ?? [],
          bloqueiosRecPorDia,
          cadenciaSlots,
          intervaloMin,
          agora
        );

        if (temSlot) {
          temSemana = true;
          primeiroDiaLabel = diasSemana[diaSemana];
          break;
        }
      }

      // Define rótulo e cor
      let diaLabel = "";
      let cor: "green" | "yellow" | "gray" = "gray";

      if (temHoje) {
        diaLabel = "Disponível hoje";
        cor = "green";
      } else if (temAmanha) {
        diaLabel = "Disponível amanhã";
        cor = "yellow";
      } else if (temSemana) {
        diaLabel = `Próxima vaga: ${primeiroDiaLabel}`;
        cor = "yellow";
      } else {
        diaLabel = "Sem vagas esta semana";
        cor = "gray";
      }

      resultado.push({
        id: servico.id,
        tem_hoje: temHoje,
        tem_amanha: temAmanha,
        tem_semana: temSemana,
        dia_label: diaLabel,
        cor,
      });
    }

    // ---------------------------------------------------------------------
    // RETORNO
    // ---------------------------------------------------------------------

    return Response.json(
      {
        prestador_id: prestadorId,
        data_base: dataInicio,
        servicos: resultado,
      },
      {
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    // Captura erro no Sentry
    if (SENTRY_DSN) {
      Sentry.captureException(err, {
        tags: { function: "disponibilidade-servicos" },
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
