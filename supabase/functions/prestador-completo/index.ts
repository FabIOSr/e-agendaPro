// supabase/functions/prestador-completo/index.ts
//
// Endpoint agregado que retorna todos os dados necessários para a página do cliente
// em uma única requisição, otimizando performance e reduzindo roundtrips.
//
// Uso: POST /prestador-completo
// Body: { prestador_slug }
// Retorno: { prestador, servicos, disponibilidade, slots_mes, disponibilidade_servicos, avaliacoes?, proximo_slot?, galeria? }
//
// Cache recomendado: 2 minutos no frontend (menor que endpoints individuais pela natureza agregada)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8.0.0";
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

interface Servico {
  id: string;
  nome: string;
  duracao_min: number;
  preco: number;
  descricao: string | null;
  exibir_preco: boolean;
}

interface Disponibilidade {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

interface Avaliacao {
  id: string;
  cliente_nome: string;
  comentario: string;
  nota: number;
  created_at: string;
}

interface GaleriaImage {
  url: string;
  thumb?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateBRT(date: Date): string {
  const isoString = date.toISOString();
  const utcDate = new Date(isoString);
  utcDate.setHours(utcDate.getHours() - 3);
  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAgoraBRT(): Date {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value;

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
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
    const { prestador_slug } = await req.json();

    errorContext.prestador_slug = prestador_slug;

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
    // 1. Prestador (com tudo que precisamos)
    // ---------------------------------------------------------------------

    const { data: prestador, error: errP } = await supabase
      .from("prestadores")
      .select("id, nome, bio, foto_url, whatsapp, slug, plano, plano_valido_ate, cor_tema, categoria, local_exibicao, galeria_urls, cidade, intervalo_min, intervalo_slot, trial_ends_at")
      .eq("slug", prestador_slug)
      .single();

    if (errP || !prestador) {
      return Response.json({ erro: "Prestador não encontrado" }, { status: 404, headers: cors });
    }

    const prestadorId = prestador.id;
    const isPro = prestador.plano === "pro"
      && prestador.plano_valido_ate
      && new Date(prestador.plano_valido_ate) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // ---------------------------------------------------------------------
    // 2. Serviços ativos
    // ---------------------------------------------------------------------

    const { data: servicos, error: errS } = await supabase
      .from("servicos")
      .select("id, nome, duracao_min, preco, descricao, exibir_preco")
      .eq("prestador_id", prestadorId)
      .eq("ativo", true)
      .order("nome");

    if (errS) throw errS;

    // ---------------------------------------------------------------------
    // 3. Disponibilidade semanal
    // ---------------------------------------------------------------------

    const { data: disponibilidades, error: errD } = await supabase
      .from("disponibilidade")
      .select("dia_semana, hora_inicio, hora_fim")
      .eq("prestador_id", prestadorId)
      .order("dia_semana");

    if (errD) throw errD;

    // Agrupa por dia da semana
    const dispPorDia: Record<number, Disponibilidade[]> = {};
    for (let i = 0; i < 7; i++) {
      dispPorDia[i] = (disponibilidades ?? []).filter(d => d.dia_semana === i);
    }

    // ---------------------------------------------------------------------
    // 4. Slots do mês (batch otimizado)
    // ---------------------------------------------------------------------

    const agora = getAgoraBRT();
    const hoje = formatDateBRT(agora);
    const fimMes = new Date(Date.UTC(
      agora.getUTCFullYear(),
      agora.getUTCMonth() + 1,
      0,
      23, 59, 59
    ));
    const fimMesISO = formatDateBRT(fimMes);

    // Agendamentos confirmados/reservados do mês
    const { data: agendamentos, error: errA } = await supabase
      .from("agendamentos")
      .select("data_hora, servico_id, servicos(duracao_min)")
      .eq("prestador_id", prestadorId)
      .in("status", ["confirmado", "reservado"])
      .gte("data_hora", `${hoje}T00:00:00Z`)
      .lte("data_hora", `${fimMesISO}T23:59:59Z`);

    if (errA) throw errA;

    // Bloqueios do mês
    const { data: bloqueios, error: errB } = await supabase
      .from("bloqueios")
      .select("inicio, fim")
      .eq("prestador_id", prestadorId)
      .lt("inicio", `${fimMesISO}T23:59:59Z`)
      .gt("fim", `${hoje}T00:00:00Z`);

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

    const bloqueiosRecPorDia: Record<number, Disponibilidade[]> = {};
    for (let i = 0; i < 7; i++) {
      bloqueiosRecPorDia[i] = (bloqueiosRecorrentes ?? []).filter(b => b.dia_semana === i);
    }

    // Calcula dias sem slots (simplificado - apenas se tem disponibilidade)
    const diasSemSlots: number[] = [];
    const diasComSlots: number[] = [];

    for (let i = 0; i <= fimMes.getUTCDate(); i++) {
      const dataCheck = new Date(Date.UTC(
        agora.getUTCFullYear(),
        agora.getUTCMonth(),
        agora.getUTCDate() + i
      ));
      const diaSemana = dataCheck.getUTCDay();
      const dataISO = formatDateBRT(dataCheck);

      // Verifica se tem disponibilidade neste dia
      const dispDoDia = dispPorDia[diaSemana];
      if (!dispDoDia || dispDoDia.length === 0) {
        diasSemSlots.push(i);
      } else {
        diasComSlots.push(i);
      }
    }

    // ---------------------------------------------------------------------
    // 5. Disponibilidade por serviço (reusa lógica do endpoint existente)
    // ---------------------------------------------------------------------

    const { generateSlots } = await import("../../../modules/scheduling-rules.js");

    interface ServicoInfo {
      id: string;
      tem_hoje: boolean;
      tem_amanha: boolean;
      tem_semana: boolean;
      dia_label: string;
      cor: "green" | "yellow" | "gray";
    }

    const resultadoServicos: ServicoInfo[] = [];
    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const intervaloMin = prestador.intervalo_min ?? 0;
    const intervaloSlotConfig = isPro ? prestador.intervalo_slot : null;

    function tocaDia(bloqueio: { inicio: string; fim: string }, dataISO: string): boolean {
      const inicio = new Date(bloqueio.inicio);
      const fim = new Date(bloqueio.fim);
      const dia = new Date(`${dataISO}T12:00:00Z`);
      const fimDoDia = new Date(`${dataISO}T23:59:59Z`);
      const inicioDoDia = new Date(`${dataISO}T00:00:00Z`);
      return inicio < fimDoDia && fim > inicioDoDia;
    }

    function temSlotDisponivel(
      dataISO: string,
      diaSemana: number,
      duracaoServico: number,
      dispPorDiaCheck: Record<number, Disponibilidade[]>,
      agendamentosCheck: any[],
      bloqueiosCheck: any[],
      bloqueiosRecPorDiaCheck: Record<number, Disponibilidade[]>,
      intervaloSlotCheck: number | null,
      intervaloMinCheck: number
    ): boolean {
      const disponibilidadesDoDia = dispPorDiaCheck[diaSemana] || [];
      if (disponibilidadesDoDia.length === 0) {
        return false;
      }

      const cadenciaSlots = intervaloSlotCheck || (duracaoServico + intervaloMinCheck);

      const slots = generateSlots({
        data: dataISO,
        disponibilidades: disponibilidadesDoDia,
        duracaoServico,
        agendamentos: agendamentosCheck.filter(ag => ag.data_hora.startsWith(dataISO)),
        bloqueios: bloqueiosCheck.filter(b => tocaDia(b, dataISO)),
        intervaloSlot: cadenciaSlots,
        intervaloMin: intervaloMinCheck,
        bloqueiosRecorrentes: bloqueiosRecPorDiaCheck[diaSemana] || [],
      });

      if (slots.length === 0) {
        return false;
      }

      return slots.some(s => s.disponivel);
    }

    const agendamentosNorm = (agendamentos ?? []).map((ag: any) => ({
      data_hora: ag.data_hora,
      servico_id: ag.servico_id,
      duracao_min: ag.servicos?.duracao_min ?? 60,
      intervalo_min: intervaloMin,
    }));

    for (const servico of (servicos || [])) {
      const cadenciaSlots = intervaloSlotConfig || (servico.duracao_min + intervaloMin);

      // Filtra agendamentos apenas deste serviço
      const agendamentosDoServico = agendamentosNorm.filter(
        ag => ag.servico_id === servico.id
      );

      // Verifica hoje
      const hojeSemana = agora.getUTCDay();
      const temHoje = temSlotDisponivel(
        hoje,
        hojeSemana,
        servico.duracao_min,
        dispPorDia,
        agendamentosDoServico,
        bloqueios ?? [],
        bloqueiosRecPorDia,
        cadenciaSlots,
        intervaloMin
      );

      // Verifica amanhã
      const amanhaDate = new Date(Date.UTC(
        agora.getUTCFullYear(),
        agora.getUTCMonth(),
        agora.getUTCDate() + 1
      ));
      const amanhaISO = formatDateBRT(amanhaDate);
      const amanhaSemana = amanhaDate.getUTCDay();
      const temAmanha = temSlotDisponivel(
        amanhaISO,
        amanhaSemana,
        servico.duracao_min,
        dispPorDia,
        agendamentosDoServico,
        bloqueios ?? [],
        bloqueiosRecPorDia,
        cadenciaSlots,
        intervaloMin
      );

      // Verifica próximos 7 dias
      let temSemana = false;
      let primeiroDiaLabel = "";

      for (let i = 2; i <= 7; i++) {
        const dataDate = new Date(Date.UTC(
          agora.getUTCFullYear(),
          agora.getUTCMonth(),
          agora.getUTCDate() + i
        ));
        const dataISO = formatDateBRT(dataDate);
        const diaSemana = dataDate.getUTCDay();

        const temSlot = temSlotDisponivel(
          dataISO,
          diaSemana,
          servico.duracao_min,
          dispPorDia,
          agendamentosDoServico,
          bloqueios ?? [],
          bloqueiosRecPorDia,
          cadenciaSlots,
          intervaloMin
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

      resultadoServicos.push({
        id: servico.id,
        tem_hoje: temHoje,
        tem_amanha: temAmanha,
        tem_semana: temSemana,
        dia_label: diaLabel,
        cor,
      });
    }

    // ---------------------------------------------------------------------
    // 6. Extras Pro (avaliações, próximo slot, galeria)
    // ---------------------------------------------------------------------

    let avaliacoes: Avaliacao[] | undefined;
    let proximoSlot: { data: string; hora: string } | undefined;
    let galeria: GaleriaImage[] | undefined;

    if (isPro) {
      // Avaliações (últimas 5)
      const { data: avaliacoesData, error: errAv } = await supabase
        .from("avaliacoes")
        .select("id, cliente_nome, comentario, nota, created_at")
        .eq("prestador_id", prestadorId)
        .eq("aprovada", true)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!errAv && avaliacoesData) {
        avaliacoes = avaliacoesData;
      }

      // Próximo slot (simplificado - primeira disponibilidade encontrada)
      for (let i = 0; i < 7; i++) {
        const dataCheck = new Date(Date.UTC(
          agora.getUTCFullYear(),
          agora.getUTCMonth(),
          agora.getUTCDate() + i
        ));
        const diaSemana = dataCheck.getUTCDay();
        const dataISO = formatDateBRT(dataCheck);

        // Usa duração do menor serviço
        const menorDuracao = Math.min(...(servicos || []).map(s => s.duracao_min));

        const temSlot = temSlotDisponivel(
          dataISO,
          diaSemana,
          menorDuracao,
          dispPorDia,
          agendamentosNorm,
          bloqueios ?? [],
          bloqueiosRecPorDia,
          menorDuracao + intervaloMin,
          intervaloMin
        );

        if (temSlot) {
          // Encontra o primeiro slot disponível neste dia
          const dispDoDia = dispPorDia[diaSemana];
          if (dispDoDia && dispDoDia.length > 0) {
            const [hIni, mIni] = dispDoDia[0].hora_inicio.split(':').map(Number);
            proximoSlot = {
              data: dataISO,
              hora: `${String(hIni).padStart(2, '0')}:${String(mIni).padStart(2, '0')}`
            };
            break;
          }
        }
      }

      // Galeria (até 9 fotos)
      if (prestador.galeria_urls?.length) {
        galeria = prestador.galeria_urls.slice(0, 9).map((url: string, idx: number) => ({
          url,
          thumb: idx === 0 ? url : undefined // Apenas primeira como thumb por enquanto
        }));
      }
    }

    // ---------------------------------------------------------------------
    // RETORNO
    // ---------------------------------------------------------------------

    return Response.json(
      {
        prestador: {
          id: prestador.id,
          nome: prestador.nome,
          bio: prestador.bio,
          foto_url: prestador.foto_url,
          whatsapp: prestador.whatsapp,
          slug: prestador.slug,
          plano: prestador.plano,
          plano_valido_ate: prestador.plano_valido_ate,
          cor_tema: prestador.cor_tema,
          categoria: prestador.categoria,
          local_exibicao: prestador.local_exibicao,
          cidade: prestador.cidade,
          galeria_urls: prestador.galeria_urls, // Importante para galeria funcionar
          intervalo_min: prestador.intervalo_min,
          intervalo_slot: prestador.intervalo_slot,
          is_pro: isPro
        },
        servicos: servicos || [],
        disponibilidades: disponibilidades || [],
        slots_mes: {
          dias_sem_slots: diasSemSlots,
          dias_com_slots: diasComSlots,
          data_base: hoje,
          fim_mes: fimMesISO
        },
        servicos_disponibilidade: resultadoServicos,
        avaliacoes, // Apenas Pro
        proximo_slot: proximoSlot, // Apenas Pro
        galeria, // Apenas Pro
      },
      {
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    // Captura erro no Sentry
    if (SENTRY_DSN) {
      Sentry.captureException(err, {
        tags: { function: "prestador-completo" },
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
