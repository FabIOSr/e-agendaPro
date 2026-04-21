export const TIMEZONE_BRT = 'America/Sao_Paulo';
export const ANTECEDENCIA_MINIMA_MIN = 60;

export interface Disponibilidade {
  hora_inicio: string;
  hora_fim: string;
}

export interface Agendamento {
  data_hora: string;
  duracao_min: number;
  intervalo_min?: number;
}

export interface Bloqueio {
  inicio: string;
  fim: string;
  motivo?: string;
}

export interface BloqueioRecorrente {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  motivo?: string;
}

export interface Slot {
  hora: string;
  disponivel: boolean;
  motivo_bloqueio?: string;
}

export interface GenerateSlotsParams {
  data: string;
  disponibilidades: Disponibilidade[];
  duracaoServico: number;
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  intervaloSlot?: number;
  intervaloMin?: number;
  bloqueiosRecorrentes?: BloqueioRecorrente[];
  now?: Date;
  antecedenciaMinimaMin?: number;
}

export function getAgoraBRT(now: Date = new Date()): Date {
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
  const get = (type: string) => parts.find((part) => part.type === type)?.value;

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
}

export function horaParaDate(data: string, hora: string): Date {
  const horaLimpa = hora.slice(0, 5);
  return new Date(`${data}T${horaLimpa}:00-03:00`);
}

export function dateParaHora(date: Date): string {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(11, 16);
}

export function conflita(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date): boolean {
  return inicioA < fimB && fimA > inicioB;
}

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
}: GenerateSlotsParams): Slot[] {
  const slots: Slot[] = [];
  const cadencia = intervaloSlot;
  const duracaoOcupada = duracaoServico + intervaloMin;

  const mesmoDia = (slotDate: Date) => slotDate.toDateString() === now.toDateString();
  const antecedenciaMinima = new Date(now.getTime() + antecedenciaMinimaMin * 60_000);

  for (const disp of disponibilidades) {
    const expedienteInicio = horaParaDate(data, disp.hora_inicio);
    const expedienteFim = horaParaDate(data, disp.hora_fim);
    let cursor = new Date(expedienteInicio);

    while (cursor < expedienteFim) {
      const inicioSlot = new Date(cursor);
      const fimSlot = new Date(cursor.getTime() + duracaoOcupada * 60_000);

      if (fimSlot > expedienteFim) {
        cursor = new Date(cursor.getTime() + cadencia * 60_000);
        continue;
      }

      if (inicioSlot <= now) {
        cursor = new Date(cursor.getTime() + cadencia * 60_000);
        continue;
      }

      if (mesmoDia(inicioSlot) && inicioSlot < antecedenciaMinima) {
        cursor = new Date(cursor.getTime() + cadencia * 60_000);
        continue;
      }

      let disponivel = true;
      let motivoBloqueio: string | undefined;

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

  slots.sort((a, b) => a.hora.localeCompare(b.hora));
  return slots;
}