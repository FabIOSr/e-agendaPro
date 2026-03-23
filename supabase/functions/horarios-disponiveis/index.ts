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
}

interface Bloqueio {
  inicio: string;   // ISO 8601
  fim: string;      // ISO 8601
  motivo?: string;
}

interface Slot {
  hora: string;             // "10:00"
  disponivel: boolean;
  motivo_bloqueio?: string; // preenchido quando disponivel = false (útil para debug)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function horaParaDate(data: string, hora: string): Date {
  return new Date(`${data}T${hora}:00`);
}

function dateParaHora(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/**
 * Conflito entre dois intervalos semi-abertos [a, b) e [c, d):
 * existe sobreposição quando a < d E b > c.
 */
function conflita(
  inicioSlot: Date, fimSlot: Date,
  inicioOcup: Date, fimOcup: Date
): boolean {
  return inicioSlot < fimOcup && fimSlot > inicioOcup;
}

// ---------------------------------------------------------------------------
// Gerador de slots
// ---------------------------------------------------------------------------

function gerarSlots(
  data: string,
  disponibilidades: Disponibilidade[],
  duracaoServico: number,
  agendamentos: Agendamento[],
  bloqueios: Bloqueio[],
  intervaloSlot = 30
): Slot[] {
  const agora = new Date();
  const slots: Slot[] = [];

  for (const disp of disponibilidades) {
    const expedienteInicio = horaParaDate(data, disp.hora_inicio);
    const expedienteFim    = horaParaDate(data, disp.hora_fim);

    let cursor = new Date(expedienteInicio);

    while (cursor < expedienteFim) {
      const inicioSlot = new Date(cursor);
      const fimSlot    = new Date(cursor.getTime() + duracaoServico * 60_000);

      // Regra 1 — slot precisa caber inteiro no expediente
      if (fimSlot > expedienteFim) {
        cursor = new Date(cursor.getTime() + intervaloSlot * 60_000);
        continue;
      }

      // Regra 2 — não exibir horários passados
      if (inicioSlot <= agora) {
        cursor = new Date(cursor.getTime() + intervaloSlot * 60_000);
        continue;
      }

      let disponivel = true;
      let motivoBloqueio: string | undefined;

      // Regra 3 — conflito com agendamentos confirmados
      for (const ag of agendamentos) {
        const inicioAg = new Date(ag.data_hora);
        const fimAg    = new Date(inicioAg.getTime() + ag.duracao_min * 60_000);

        if (conflita(inicioSlot, fimSlot, inicioAg, fimAg)) {
          disponivel = false;
          motivoBloqueio = "horário ocupado";
          break;
        }
      }

      // Regra 4 — conflito com bloqueios manuais
      if (disponivel) {
        for (const bl of bloqueios) {
          const inicioBl = new Date(bl.inicio);
          const fimBl    = new Date(bl.fim);

          if (conflita(inicioSlot, fimSlot, inicioBl, fimBl)) {
            disponivel = false;
            motivoBloqueio = bl.motivo ?? "bloqueado";
            break;
          }
        }
      }

      slots.push({
        hora: dateParaHora(inicioSlot),
        disponivel,
        ...(motivoBloqueio && { motivo_bloqueio: motivoBloqueio }),
      });

      cursor = new Date(cursor.getTime() + intervaloSlot * 60_000);
    }
  }

  // Garante ordem cronológica (caso haja múltiplos turnos no dia)
  slots.sort((a, b) => a.hora.localeCompare(b.hora));

  return slots;
}

// ---------------------------------------------------------------------------
// Handler HTTP
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
    const {
      prestador_slug,
      servico_id,
      data,            // "2026-03-21"
      intervalo_slot,  // opcional, padrão 30 min
    } = await req.json();

    if (!prestador_slug || !servico_id || !data) {
      return Response.json(
        { erro: "Campos obrigatórios: prestador_slug, servico_id, data" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return Response.json(
        { erro: "Formato de data inválido. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Resolve o prestador pelo slug
    const { data: prestador, error: errP } = await supabase
      .from("prestadores")
      .select("id")
      .eq("slug", prestador_slug)
      .single();

    if (errP || !prestador) {
      return Response.json({ erro: "Prestador não encontrado" }, { status: 404 });
    }

    const prestadorId = prestador.id;

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
        { status: 404 }
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
      });
    }

    // 4. Agendamentos confirmados no dia (JOIN com duração do serviço agendado)
    const { data: agendamentos, error: errA } = await supabase
      .from("agendamentos")
      .select("data_hora, servicos(duracao_min)")
      .eq("prestador_id", prestadorId)
      .eq("status", "confirmado")
      .gte("data_hora", `${data}T00:00:00Z`)
      .lte("data_hora", `${data}T23:59:59Z`);

    if (errA) throw errA;

    const agendamentosNorm: Agendamento[] = (agendamentos ?? []).map(
      (ag: any) => ({
        data_hora: ag.data_hora,
        duracao_min: ag.servicos?.duracao_min ?? 60,
      })
    );

    // 5. Bloqueios que tocam o dia inteiro
    //    (inclui bloqueios longos que começaram antes e terminam depois — ex: férias)
    const { data: bloqueios, error: errB } = await supabase
      .from("bloqueios")
      .select("inicio, fim, motivo")
      .eq("prestador_id", prestadorId)
      .lt("inicio", `${data}T23:59:59Z`)
      .gt("fim", `${data}T00:00:00Z`);

    if (errB) throw errB;

    // 6. Gera os slots e retorna
    const slots = gerarSlots(
      data,
      disponibilidades,
      servico.duracao_min,
      agendamentosNorm,
      bloqueios ?? [],
      intervalo_slot ?? 30
    );

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
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("Erro:", err);
    return Response.json(
      { erro: "Erro interno", detalhe: String(err) },
      { status: 500 }
    );
  }
});
