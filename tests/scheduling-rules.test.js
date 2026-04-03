import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateSlots,
  horaParaDate,
  dateParaHora,
  conflita,
  getAgoraBRT,
  ANTECEDENCIA_MINIMA_MIN,
  TIMEZONE_BRT,
} from '../modules/scheduling-rules.js';

// ── Helpers de teste ───────────────────────────────────────────────────────

/**
 * Cria uma data BRT fixa para testes determinísticos.
 * Assume offset -03:00 (BRT padrão, sem DST).
 */
function brt(ano, mes, dia, hora, minuto = 0) {
  return new Date(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-03:00`);
}

// ── Testes: utilitários ────────────────────────────────────────────────────

test('horaParaDate converte HH:MM para Date na data correta', () => {
  const result = horaParaDate('2026-04-06', '09:30');
  assert.equal(result.toISOString(), '2026-04-06T12:30:00.000Z');
});

test('horaParaDate ignora segundos em HH:MM:SS', () => {
  const result = horaParaDate('2026-04-06', '09:30:45');
  assert.equal(result.toISOString(), '2026-04-06T12:30:00.000Z');
});

test('dateParaHora extrai HH:MM de um Date', () => {
  const result = dateParaHora(brt(2026, 4, 6, 14, 30));
  assert.equal(result, '14:30');
});

test('conflita detecta sobreposição de intervalos', () => {
  // Sobreposição parcial
  assert.equal(conflita(brt(2026, 4, 6, 9, 0), brt(2026, 4, 6, 10, 0),
                        brt(2026, 4, 6, 9, 30), brt(2026, 4, 6, 10, 30)), true);

  // Sem sobreposição (um termina quando o outro começa)
  assert.equal(conflita(brt(2026, 4, 6, 9, 0), brt(2026, 4, 6, 10, 0),
                        brt(2026, 4, 6, 10, 0), brt(2026, 4, 6, 11, 0)), false);

  // Totalmente contido
  assert.equal(conflita(brt(2026, 4, 6, 8, 0), brt(2026, 4, 6, 12, 0),
                        brt(2026, 4, 6, 9, 0), brt(2026, 4, 6, 10, 0)), true);

  // Sem sobreposição (antes)
  assert.equal(conflita(brt(2026, 4, 6, 9, 0), brt(2026, 4, 6, 10, 0),
                        brt(2026, 4, 6, 7, 0), brt(2026, 4, 6, 8, 0)), false);
});

test('getAgoraBRT retorna hora atual em BRT', () => {
  const agora = getAgoraBRT();
  assert.ok(agora instanceof Date);
  // Verifica que está próximo da hora atual (margem de 2s)
  const diff = Math.abs(agora.getTime() - Date.now());
  assert.ok(diff < 2000, `Diferença muito grande: ${diff}ms`);
});

test('constantes exportadas têm valores esperados', () => {
  assert.equal(ANTECEDENCIA_MINIMA_MIN, 60);
  assert.equal(TIMEZONE_BRT, 'America/Sao_Paulo');
});

// ── Testes: antecedência mínima ────────────────────────────────────────────

test('slots no mesmo dia respeitam antecedência mínima de 60 min', () => {
  // Agora: 11:28 → antecedência: 12:28
  // Expediente: 11:00 - 14:00, cadência 30 min, serviço 30 min
  const slots = generateSlots({
    data: '2026-04-03',
    disponibilidades: [{ hora_inicio: '11:00', hora_fim: '14:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 3, 11, 28),
  });

  const disponiveis = slots.filter((s) => s.disponivel).map((s) => s.hora);
  // Primeiro slot disponível: 12:30 (primeiro após 12:28 alinhado a 30 min)
  assert.deepEqual(disponiveis, ['12:30', '13:00', '13:30']);
});

test('slots no mesmo dia com cadência de 15 min respeitam antecedência mínima', () => {
  // Agora: 11:28 → antecedência: 12:28
  // Expediente: 11:00 - 13:30, cadência 15 min
  const slots = generateSlots({
    data: '2026-04-03',
    disponibilidades: [{ hora_inicio: '11:00', hora_fim: '13:30' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 15,
    intervaloMin: 0,
    now: brt(2026, 4, 3, 11, 28),
  });

  const disponiveis = slots.filter((s) => s.disponivel).map((s) => s.hora);
  // 12:30 é o primeiro slot ≥ 12:28 alinhado a 15 min
  // 12:45 também cabe (12:45 + 30 = 13:15 < 13:30)
  assert.deepEqual(disponiveis, ['12:30', '12:45', '13:00']);
});

test('slots em dia futuro NÃO respeitam antecedência mínima', () => {
  // Agora: 11:28 do dia 03, mas slots são para dia 04
  // Todos os slots do dia 04 devem estar disponíveis
  const slots = generateSlots({
    data: '2026-04-04',
    disponibilidades: [{ hora_inicio: '08:00', hora_fim: '10:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 3, 11, 28),
  });

  const disponiveis = slots.filter((s) => s.disponivel).map((s) => s.hora);
  assert.deepEqual(disponiveis, ['08:00', '08:30', '09:00', '09:30']);
});

test('antecedência mínima configurável via parâmetro', () => {
  // Agora: 10:00, antecedência: 30 min → bloqueia até 10:30
  const slots = generateSlots({
    data: '2026-04-03',
    disponibilidades: [{ hora_inicio: '10:00', hora_fim: '12:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 3, 10, 0),
    antecedenciaMinimaMin: 30,
  });

  const disponiveis = slots.filter((s) => s.disponivel).map((s) => s.hora);
  // 10:00 bloqueado (passado), 10:30 é o primeiro ≥ 10:30
  assert.deepEqual(disponiveis, ['10:30', '11:00', '11:30']);
});

// ── Testes: conflitos com agendamentos ─────────────────────────────────────

test('agendamento existente bloqueia slots sobrepostos usando duração + buffer', () => {
  // Agendamento: 13:00-14:00 (60 min) + 10 min buffer = bloqueia até 14:10
  const slots = generateSlots({
    data: '2026-04-04',
    disponibilidades: [{ hora_inicio: '13:00', hora_fim: '16:00' }],
    duracaoServico: 30,
    agendamentos: [
      {
        data_hora: brt(2026, 4, 4, 13, 0).toISOString(),
        duracao_min: 60,
        intervalo_min: 10,
      },
    ],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 3, 9, 0),
  });

  const porHora = Object.fromEntries(slots.map((s) => [s.hora, s.disponivel]));
  assert.equal(porHora['13:00'], false);  // dentro do agendamento
  assert.equal(porHora['13:30'], false);  // dentro do agendamento
  assert.equal(porHora['14:00'], false);  // dentro do buffer (14:00 < 14:10)
  assert.equal(porHora['14:30'], true);   // livre
});

test('agendamento com mesma duração do serviço bloqueia corretamente', () => {
  // Serviço novo: 30 min. Agendamento existente: 13:00-13:30
  const slots = generateSlots({
    data: '2026-04-04',
    disponibilidades: [{ hora_inicio: '12:00', hora_fim: '15:00' }],
    duracaoServico: 30,
    agendamentos: [
      {
        data_hora: brt(2026, 4, 4, 13, 0).toISOString(),
        duracao_min: 30,
        intervalo_min: 0,
      },
    ],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 3, 9, 0),
  });

  const porHora = Object.fromEntries(slots.map((s) => [s.hora, s.disponivel]));
  assert.equal(porHora['12:30'], true);
  assert.equal(porHora['13:00'], false);
  assert.equal(porHora['13:30'], true);
  assert.equal(porHora['14:00'], true);
});

test('agendamento com duração diferente do serviço novo bloqueia corretamente', () => {
  // Serviço novo: 20 min. Agendamento existente: 13:00-14:30 (90 min)
  const slots = generateSlots({
    data: '2026-04-04',
    disponibilidades: [{ hora_inicio: '13:00', hora_fim: '16:00' }],
    duracaoServico: 20,
    agendamentos: [
      {
        data_hora: brt(2026, 4, 4, 13, 0).toISOString(),
        duracao_min: 90,
        intervalo_min: 0,
      },
    ],
    bloqueios: [],
    intervaloSlot: 20,
    intervaloMin: 0,
    now: brt(2026, 4, 3, 9, 0),
  });

  const porHora = Object.fromEntries(slots.map((s) => [s.hora, s.disponivel]));
  assert.equal(porHora['13:00'], false);
  assert.equal(porHora['13:20'], false);
  assert.equal(porHora['13:40'], false);
  assert.equal(porHora['14:00'], false);  // 14:00 + 20 = 14:20, conflita com 14:30
  assert.equal(porHora['14:40'], true);
});

// ── Testes: bloqueios manuais ──────────────────────────────────────────────

test('bloqueio manual marca slots sobrepostos como indisponíveis', () => {
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [{ hora_inicio: '09:00', hora_fim: '12:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [
      {
        inicio: brt(2026, 4, 6, 9, 30).toISOString(),
        fim: brt(2026, 4, 6, 10, 0).toISOString(),
        motivo: 'reunião',
      },
    ],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 5, 9, 0),
  });

  const porHora = Object.fromEntries(slots.map((s) => [s.hora, s]));
  assert.equal(porHora['09:00'].disponivel, true);
  assert.equal(porHora['09:30'].disponivel, false);
  assert.equal(porHora['09:30'].motivo_bloqueio, 'reunião');
  assert.equal(porHora['10:00'].disponivel, true);
});

test('bloqueio manual que cobre múltiplos slots', () => {
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [{ hora_inicio: '08:00', hora_fim: '12:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [
      {
        inicio: brt(2026, 4, 6, 9, 0).toISOString(),
        fim: brt(2026, 4, 6, 10, 30).toISOString(),
        motivo: 'almoço estendido',
      },
    ],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 5, 9, 0),
  });

  const porHora = Object.fromEntries(slots.map((s) => [s.hora, s]));
  assert.equal(porHora['08:30'].disponivel, true);
  assert.equal(porHora['09:00'].disponivel, false);
  assert.equal(porHora['09:30'].disponivel, false);
  assert.equal(porHora['10:00'].disponivel, false);  // 10:00-10:30 conflita
  assert.equal(porHora['10:30'].disponivel, true);
});

// ── Testes: bloqueios recorrentes ──────────────────────────────────────────

test('bloqueio recorrente marca slots do dia correto como indisponíveis', () => {
  // 2026-04-06 é segunda-feira (dia 1)
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [{ hora_inicio: '09:00', hora_fim: '12:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    bloqueiosRecorrentes: [
      {
        dia_semana: 1,
        hora_inicio: '10:30:00',
        hora_fim: '11:00:00',
        motivo: 'almoço',
      },
    ],
    now: brt(2026, 4, 5, 9, 0),
  });

  const porHora = Object.fromEntries(slots.map((s) => [s.hora, s]));
  assert.equal(porHora['10:00'].disponivel, true);
  assert.equal(porHora['10:30'].disponivel, false);
  assert.equal(porHora['10:30'].motivo_bloqueio, 'almoço');
  assert.equal(porHora['11:00'].disponivel, true);
});

test('bloqueio recorrente NÃO afeta outros dias da semana', () => {
  // 2026-04-07 é terça-feira (dia 2), bloqueio é para segunda (dia 1)
  const slots = generateSlots({
    data: '2026-04-07',
    disponibilidades: [{ hora_inicio: '09:00', hora_fim: '12:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    bloqueiosRecorrentes: [
      {
        dia_semana: 1,
        hora_inicio: '10:30:00',
        hora_fim: '11:00:00',
        motivo: 'almoço',
      },
    ],
    now: brt(2026, 4, 5, 9, 0),
  });

  const disponiveis = slots.filter((s) => s.disponivel).map((s) => s.hora);
  assert.deepEqual(disponiveis, ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
});

// ── Testes: cadência e grade de horários ───────────────────────────────────

test('cadência de 30 min gera slots alinhados', () => {
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [{ hora_inicio: '09:00', hora_fim: '12:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 5, 9, 0),
  });

  const horas = slots.map((s) => s.hora);
  assert.deepEqual(horas, ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
});

test('cadência de 15 min gera mais slots no mesmo expediente', () => {
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [{ hora_inicio: '09:00', hora_fim: '10:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 15,
    intervaloMin: 0,
    now: brt(2026, 4, 5, 9, 0),
  });

  const horas = slots.map((s) => s.hora);
  // 09:00 + 30 = 09:30 (cabe), 09:15 + 30 = 09:45 (cabe), 09:30 + 30 = 10:00 (não cabe)
  assert.deepEqual(horas, ['09:00', '09:15', '09:30']);
});

test('serviço que não cabe no expediente não gera slot', () => {
  // Expediente 09:00-09:20, serviço 30 min → nenhum slot cabe
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [{ hora_inicio: '09:00', hora_fim: '09:20' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 5, 9, 0),
  });

  assert.deepEqual(slots, []);
});

// ── Testes: múltiplas disponibilidades ─────────────────────────────────────

test('múltiplos períodos de expediente (manhã + tarde)', () => {
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [
      { hora_inicio: '09:00', hora_fim: '12:00' },
      { hora_inicio: '14:00', hora_fim: '18:00' },
    ],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 5, 9, 0),
  });

  const horas = slots.map((s) => s.hora);
  // Manhã: 09:00, 09:30, 10:00, 10:30, 11:00, 11:30
  // Tarde: 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00, 17:30
  assert.deepEqual(horas, [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  ]);
});

// ── Testes: combinação de regras ───────────────────────────────────────────

test('agendamento + bloqueio manual + recorrente atuam juntos', () => {
  // 2026-04-06 é segunda (dia 1)
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [{ hora_inicio: '09:00', hora_fim: '12:00' }],
    duracaoServico: 30,
    agendamentos: [
      {
        data_hora: brt(2026, 4, 6, 9, 0).toISOString(),
        duracao_min: 30,
        intervalo_min: 0,
      },
    ],
    bloqueios: [
      {
        inicio: brt(2026, 4, 6, 10, 0).toISOString(),
        fim: brt(2026, 4, 6, 10, 30).toISOString(),
        motivo: 'reunião',
      },
    ],
    intervaloSlot: 30,
    intervaloMin: 0,
    bloqueiosRecorrentes: [
      {
        dia_semana: 1,
        hora_inicio: '11:00:00',
        hora_fim: '11:30:00',
        motivo: 'almoço',
      },
    ],
    now: brt(2026, 4, 5, 9, 0),
  });

  const porHora = Object.fromEntries(slots.map((s) => [s.hora, s]));
  assert.equal(porHora['09:00'].disponivel, false);  // agendamento
  assert.equal(porHora['09:30'].disponivel, true);
  assert.equal(porHora['10:00'].disponivel, false);  // bloqueio manual
  assert.equal(porHora['10:30'].disponivel, true);
  assert.equal(porHora['11:00'].disponivel, false);  // bloqueio recorrente
  assert.equal(porHora['11:30'].disponivel, true);
});

// ── Testes: ordenação e consistência ───────────────────────────────────────

test('slots são retornados ordenados por horário', () => {
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [
      { hora_inicio: '14:00', hora_fim: '16:00' },
      { hora_inicio: '09:00', hora_fim: '11:00' },
    ],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 5, 9, 0),
  });

  const horas = slots.map((s) => s.hora);
  // Deve estar ordenado mesmo com disponibilidades fora de ordem
  assert.deepEqual(horas, [
    '09:00', '09:30', '10:00', '10:30',
    '14:00', '14:30', '15:00', '15:30',
  ]);
});

test('slots sem conflitos têm motivo_bloqueio indefinido', () => {
  const slots = generateSlots({
    data: '2026-04-06',
    disponibilidades: [{ hora_inicio: '09:00', hora_fim: '10:00' }],
    duracaoServico: 30,
    agendamentos: [],
    bloqueios: [],
    intervaloSlot: 30,
    intervaloMin: 0,
    now: brt(2026, 4, 5, 9, 0),
  });

  for (const slot of slots) {
    assert.equal(slot.motivo_bloqueio, undefined);
    assert.equal(slot.disponivel, true);
  }
});
