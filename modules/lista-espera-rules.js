export const TIMEZONE_BRT = 'America/Sao_Paulo';

function formatPartsInTimeZone(date, timeZone = TIMEZONE_BRT) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  };
}

export function getDataAtualBRT(now = new Date()) {
  const parts = formatPartsInTimeZone(now);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getMinutosAtualBRT(now = new Date()) {
  const parts = formatPartsInTimeZone(now);
  return parts.hour * 60 + parts.minute;
}

export function horaParaMinutos(hora) {
  if (!hora) return null;
  const [h, m] = hora.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function podeEntrarNaListaEspera({
  dataPreferida,
  tipoPreferencia,
  horaPreferida,
  periodoPreferido,
  disponibilidades,
  now = new Date(),
}) {
  if (!dataPreferida) return false;

  const hojeBrt = getDataAtualBRT(now);
  if (dataPreferida < hojeBrt) return false;
  if (dataPreferida === hojeBrt) return false;

  const periodos = Array.isArray(disponibilidades) ? disponibilidades : [];

  if (periodos.length === 0) return false;

  if (tipoPreferencia === 'exato' && horaPreferida) {
    const horaMin = horaParaMinutos(horaPreferida);
    return periodos.some((disp) => {
      const inicio = horaParaMinutos(disp.hora_inicio);
      const fim = horaParaMinutos(disp.hora_fim);
      return horaMin != null && inicio != null && fim != null && horaMin >= inicio && horaMin < fim;
    });
  }

  if (tipoPreferencia === 'periodo' && periodoPreferido) {
    return periodos.some((disp) => {
      const inicio = horaParaMinutos(disp.hora_inicio);
      const fim = horaParaMinutos(disp.hora_fim);
      if (inicio == null || fim == null) return false;

      if (periodoPreferido === 'manha') return inicio < 780 && fim > 480;
      if (periodoPreferido === 'tarde') return inicio < 1140 && fim > 780;
      if (periodoPreferido === 'noite') return inicio < 1320 && fim > 1140;
      return false;
    });
  }

  return periodos.some((disp) => {
    const inicio = horaParaMinutos(disp.hora_inicio);
    const fim = horaParaMinutos(disp.hora_fim);
    return inicio != null && fim != null && fim > inicio;
  });
}
