/**
 * Regras de geração de slots de horários.
 * Espelha a lógica da função SQL criar_agendamento_atomic para manter
 * consistência entre frontend e backend.
 */

export const TIMEZONE_BRT = 'America/Sao_Paulo';
export const ANTECEDENCIA_MINIMA_MIN = 60;

/**
 * Retorna a hora atual no fuso BRT como Date.
 * Usa Intl.DateTimeFormat para respeitar regras oficiais de timezone (DST, etc).
 */
export function getAgoraBRT(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE_BRT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
}

/**
 * Converte string de hora (HH:MM ou HH:MM:SS) para Date numa data específica.
 */
export function horaParaDate(data, hora) {
  const horaLimpa = hora.slice(0, 5);
  return new Date(`${data}T${horaLimpa}:00-03:00`);
}

/**
 * Extrai apenas a hora (HH:MM) de um Date.
 */
export function dateParaHora(date) {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(11, 16);
}

/**
 * Verifica se dois intervalos de tempo se sobrepõem.
 */
export function conflita(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && fimA > inicioB;
}

/**
 * Gera todos os slots de horários para uma data, aplicando:
 * - Cadência (intervalo entre slots)
 * - Antecedência mínima de 60 min (só para o mesmo dia)
 * - Conflitos com agendamentos existentes (duração + buffer)
 * - Bloqueios manuais
 * - Bloqueios recorrentes
 *
 * @param {Object} params
 * @param {string} params.data - Data no formato YYYY-MM-DD
 * @param {Array} params.disponibilidades - [{ hora_inicio, hora_fim }]
 * @param {number} params.duracaoServico - Duração do serviço em minutos
 * @param {Array} params.agendamentos - [{ data_hora, duracao_min, intervalo_min }]
 * @param {Array} params.bloqueios - [{ inicio, fim, motivo }]
 * @param {number} params.intervaloSlot - Intervalo entre slots (Pro) ou 0 (Free)
 * @param {number} params.intervaloMin - Buffer extra do profissional em minutos
 * @param {Array} params.bloqueiosRecorrentes - [{ dia_semana, hora_inicio, hora_fim, motivo }]
 * @param {Date} params.now - Hora atual (para testes, usa getAgoraBRT por padrão)
 * @param {number} params.antecedenciaMinimaMin - Antecedência mínima em minutos (padrão 60)
 * @returns {Array} [{ hora, disponivel, motivo_bloqueio? }]
 */
export function generateSlots({
  data,
  disponibilidades,
  duracaoServico,
  agendamentos,
  bloqueios,
  intervaloSlot = 30,
  intervaloMin = 0,
  bloqueiosRecorrentes = [],
  now = getAgoraBRT(),
  antecedenciaMinimaMin = ANTECEDENCIA_MINIMA_MIN,
}) {
  const slots = [];
  const cadencia = intervaloSlot;
  const duracaoOcupada = duracaoServico + intervaloMin;

  // Antecedência mínima só se aplica se o slot for no mesmo dia
  const mesmoDia = (slotDate) => slotDate.toDateString() === now.toDateString();
  const antecedenciaMinima = new Date(now.getTime() + antecedenciaMinimaMin * 60_000);

  for (const disp of disponibilidades) {
    const expedienteInicio = horaParaDate(data, disp.hora_inicio);
    const expedienteFim = horaParaDate(data, disp.hora_fim);
    let cursor = new Date(expedienteInicio);

    while (cursor < expedienteFim) {
      const inicioSlot = new Date(cursor);
      const fimSlot = new Date(cursor.getTime() + duracaoOcupada * 60_000);

      // Slot não cabe no expediente
      if (fimSlot > expedienteFim) {
        cursor = new Date(cursor.getTime() + cadencia * 60_000);
        continue;
      }

      // Não exibir horários passados
      if (inicioSlot <= now) {
        cursor = new Date(cursor.getTime() + cadencia * 60_000);
        continue;
      }

      // Antecedência mínima: só bloqueia se for no mesmo dia
      if (mesmoDia(inicioSlot) && inicioSlot < antecedenciaMinima) {
        cursor = new Date(cursor.getTime() + cadencia * 60_000);
        continue;
      }

      let disponivel = true;
      let motivoBloqueio;

      // Verifica conflito com agendamentos existentes
      for (const ag of agendamentos) {
        const inicioAg = new Date(ag.data_hora);
        const fimAg = new Date(
          inicioAg.getTime() + (ag.duracao_min + (ag.intervalo_min ?? 0)) * 60_000,
        );

        if (conflita(inicioSlot, fimSlot, inicioAg, fimAg)) {
          disponivel = false;
          motivoBloqueio = 'horário ocupado';
          break;
        }
      }

      // Verifica conflitos com bloqueios manuais
      if (disponivel) {
        for (const bloqueio of bloqueios) {
          const inicioBl = new Date(bloqueio.inicio);
          const fimBl = new Date(bloqueio.fim);

          if (conflita(inicioSlot, fimSlot, inicioBl, fimBl)) {
            disponivel = false;
            motivoBloqueio = bloqueio.motivo ?? 'bloqueado';
            break;
          }
        }
      }

      // Verifica conflitos com bloqueios recorrentes
      if (disponivel && bloqueiosRecorrentes.length > 0) {
        const slotBrt = new Date(inicioSlot.getTime() - 3 * 60 * 60 * 1000);
        const diaSemanaSlot = slotBrt.getUTCDay();
        const hIniSlot = slotBrt.getUTCHours() * 60 + slotBrt.getUTCMinutes();
        const hFimSlot = hIniSlot + duracaoOcupada;

        for (const bloqueioRecorrente of bloqueiosRecorrentes) {
          if (bloqueioRecorrente.dia_semana !== diaSemanaSlot) continue;

          const [hBrIni, mBrIni] = bloqueioRecorrente.hora_inicio.slice(0, 5).split(':').map(Number);
          const [hBrFim, mBrFim] = bloqueioRecorrente.hora_fim.slice(0, 5).split(':').map(Number);
          const minBrIni = hBrIni * 60 + mBrIni;
          const minBrFim = hBrFim * 60 + mBrFim;

          if (hIniSlot < minBrFim && hFimSlot > minBrIni) {
            disponivel = false;
            motivoBloqueio = bloqueioRecorrente.motivo ?? 'bloqueado';
            break;
          }
        }
      }

      slots.push({
        hora: dateParaHora(inicioSlot),
        disponivel,
        ...(motivoBloqueio && { motivo_bloqueio: motivoBloqueio }),
      });

      cursor = new Date(cursor.getTime() + cadencia * 60_000);
    }
  }

  // Ordena slots por horário
  slots.sort((a, b) => a.hora.localeCompare(b.hora));
  return slots;
}
