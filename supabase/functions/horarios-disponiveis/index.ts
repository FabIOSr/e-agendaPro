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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converte "data + hora local BRT" para Date em UTC.
 * Usa offset fixo -03:00 para garantir consistência com o banco,
 * que salva tudo em UTC com offset BRT explícito.
 */
function horaParaDate(data: string, hora: string): Date {
  // Remove segundos se presentes (banco retorna "09:00:00")
  const horaLimpa = hora.slice(0, 5);
  return new Date(`${data}T${horaLimpa}:00-03:00`);
}

/**
 * Converte Date UTC para string "HH:MM" no fuso BRT (UTC-3).
 */
function dateParaHora(d: Date): string {
  // Subtrai 3h para converter UTC → BRT
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(11, 16);
}

/**
 * Conflito entre dois intervalos semi-abertos [a, b) e [c, d):
 * existe sobreposição quando a < d E b > c.
 * Todas as datas devem estar em UTC para a comparação ser correta.
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
  intervaloSlot = 30,
  intervaloMin = 0,
  bloqueiosRecorrentes: BloqueioRecorrente[] = []
): Slot[] {
  const agora = new Date();
  const slots: Slot[] = [];

  // O cursor avança pela cadência dos slots (intervaloSlot), não pelo buffer.
  // O buffer (intervaloMin) é somado à duração do serviço para calcular
  // o espaço ocupado — mas não muda de onde o próximo slot começa na grade.
  const cadencia = intervaloSlot; // minutos entre início de cada slot exibido

  // Duração real ocupada por um agendamento deste serviço (serviço + buffer)
  const duracaoOcupada = duracaoServico + intervaloMin;

  for (const disp of disponibilidades) {
    const expedienteInicio = horaParaDate(data, disp.hora_inicio);
    const expedienteFim    = horaParaDate(data, disp.hora_fim);

    let cursor = new Date(expedienteInicio);

    while (cursor < expedienteFim) {
      const inicioSlot = new Date(cursor);
      // fimSlot = fim real do serviço + buffer — o que precisa caber no expediente
      // e o que não pode conflitar com bloqueios/agendamentos
      const fimSlot = new Date(cursor.getTime() + duracaoOcupada * 60_000);

      // Regra 1 — serviço + buffer precisa caber inteiro no expediente
      if (fimSlot > expedienteFim) {
        cursor = new Date(cursor.getTime() + cadencia * 60_000);
        continue;
      }

      // Regra 2 — não exibir horários passados
      if (inicioSlot <= agora) {
        cursor = new Date(cursor.getTime() + cadencia * 60_000);
        continue;
      }

      let disponivel = true;
      let motivoBloqueio: string | undefined;

      // Regra 3 — conflito com agendamentos confirmados
      // O agendamento existente ocupa: sua duração + buffer do prestador
      for (const ag of agendamentos) {
        const inicioAg = new Date(ag.data_hora);
        const fimAg    = new Date(
          inicioAg.getTime() + (ag.duracao_min + (ag.intervalo_min ?? 0)) * 60_000
        );

        if (conflita(inicioSlot, fimSlot, inicioAg, fimAg)) {
          disponivel = false;
          motivoBloqueio = "horário ocupado";
          break;
        }
      }

      // Regra 4 — conflito com bloqueios pontuais
      // bloqueios chegam do banco em UTC — comparação correta pois fimSlot também é UTC
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

      // Regra 5 — conflito com bloqueios recorrentes (dia da semana + horário)
      // Convertendo slot UTC para BRT para comparar com hora_inicio/hora_fim do banco
      if (disponivel && bloqueiosRecorrentes.length > 0) {
        const slotBRT = new Date(inicioSlot.getTime() - 3 * 60 * 60 * 1000);
        const diaSemanaSlot = slotBRT.getUTCDay();
        const hIniSlot = slotBRT.getUTCHours() * 60 + slotBRT.getUTCMinutes();
        const hFimSlot = (hIniSlot + duracaoOcupada);

        for (const br of bloqueiosRecorrentes) {
          if (br.dia_semana !== diaSemanaSlot) continue;
          // Remove segundos se presentes (banco retorna "12:00:00")
          const [hBrIni, mBrIni] = br.hora_inicio.slice(0, 5).split(":").map(Number);
          const [hBrFim, mBrFim] = br.hora_fim.slice(0, 5).split(":").map(Number);
          const minBrIni = hBrIni * 60 + mBrIni;
          const minBrFim = hBrFim * 60 + mBrFim;

          // Conflito: slot começa antes do fim do bloqueio E slot termina depois do início
          if (hIniSlot < minBrFim && hFimSlot > minBrIni) {
            disponivel = false;
            motivoBloqueio = br.motivo ?? "bloqueado";
            break;
          }
        }
      }

      slots.push({
        hora: dateParaHora(inicioSlot),
        disponivel,
        ...(motivoBloqueio && { motivo_bloqueio: motivoBloqueio }),
      });

      // Cursor avança pela cadência — não pela duração ocupada
      cursor = new Date(cursor.getTime() + cadencia * 60_000);
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
    console.log('DEBUG: Recebendo requisição para horarios-disponiveis');
    
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
      .select("id, intervalo_min, intervalo_slot, plano, plano_valido_ate")
      .eq("slug", prestador_slug)
      .single();

    if (errP || !prestador) {
      return Response.json({ erro: "Prestador não encontrado" }, { status: 404 });
    }

    const prestadorId = prestador.id;
    const intervaloMin = prestador.intervalo_min ?? 0;

    // Verifica se é Pro (usa intervalo_slot configurado)
    const isPro = prestador.plano === "pro"
      && prestador.plano_valido_ate
      && new Date(prestador.plano_valido_ate) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Para usuários free, ignora intervalo_slot e usa sempre duração do serviço
    const intervaloSlotConfig = isPro ? prestador.intervalo_slot : null;

    console.log('DEBUG intervaloMin:', intervaloMin, 'prestador_slug:', prestador_slug, 'isPro:', isPro, 'intervaloSlotConfig:', intervaloSlotConfig);

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

    // 4. Agendamentos confirmados no dia (JOIN com duração do serviço + buffer do prestador)
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
    const slots = gerarSlots(
      data,
      disponibilidades,
      servico.duracao_min,
      agendamentosNorm,
      bloqueios ?? [],
      intervaloSlotConfig || servico.duracao_min,
      intervaloMin,
      bloqueiosRecorrentes ?? []
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
