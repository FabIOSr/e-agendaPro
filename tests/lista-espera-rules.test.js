import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDataAtualBRT,
  getMinutosAtualBRT,
  horaParaMinutos,
  podeEntrarNaListaEspera,
} from '../modules/lista-espera-rules.js';

test('horaParaMinutos converte HH:MM corretamente', () => {
  assert.equal(horaParaMinutos('08:30'), 510);
  assert.equal(horaParaMinutos('18:00:00'), 1080);
});

test('getDataAtualBRT e getMinutosAtualBRT usam America/Sao_Paulo', () => {
  const base = new Date('2026-04-03T22:15:00.000Z');
  assert.equal(getDataAtualBRT(base), '2026-04-03');
  assert.equal(getMinutosAtualBRT(base), 1155);
});

test('podeEntrarNaListaEspera aceita dia futuro com expediente configurado', () => {
  assert.equal(podeEntrarNaListaEspera({
    dataPreferida: '2026-04-10',
    tipoPreferencia: 'qualquer',
    disponibilidades: [{ hora_inicio: '08:00', hora_fim: '18:00' }],
    now: new Date('2026-04-03T22:00:00.000Z'),
  }), true);
});

test('podeEntrarNaListaEspera rejeita dia passado', () => {
  assert.equal(podeEntrarNaListaEspera({
    dataPreferida: '2026-04-02',
    tipoPreferencia: 'qualquer',
    disponibilidades: [],
    now: new Date('2026-04-03T22:00:00.000Z'),
  }), false);
});

test('podeEntrarNaListaEspera rejeita qualquer entrada para hoje', () => {
  assert.equal(podeEntrarNaListaEspera({
    dataPreferida: '2026-04-03',
    tipoPreferencia: 'qualquer',
    disponibilidades: [{ hora_inicio: '08:00', hora_fim: '18:00' }],
    now: new Date('2026-04-03T17:10:00.000Z'),
  }), false);
});

test('podeEntrarNaListaEspera aceita horario exato futuro dentro do expediente', () => {
  assert.equal(podeEntrarNaListaEspera({
    dataPreferida: '2026-04-10',
    tipoPreferencia: 'exato',
    horaPreferida: '17:00',
    disponibilidades: [{ hora_inicio: '08:00', hora_fim: '18:00' }],
    now: new Date('2026-04-03T20:30:00.000Z'),
  }), true);
});

test('podeEntrarNaListaEspera rejeita horario exato fora do expediente', () => {
  assert.equal(podeEntrarNaListaEspera({
    dataPreferida: '2026-04-10',
    tipoPreferencia: 'exato',
    horaPreferida: '19:00',
    disponibilidades: [{ hora_inicio: '08:00', hora_fim: '18:00' }],
    now: new Date('2026-04-03T18:00:00.000Z'),
  }), false);
});

test('podeEntrarNaListaEspera aceita periodo compativel com o expediente', () => {
  assert.equal(podeEntrarNaListaEspera({
    dataPreferida: '2026-04-10',
    tipoPreferencia: 'periodo',
    periodoPreferido: 'tarde',
    disponibilidades: [{ hora_inicio: '13:00', hora_fim: '18:00' }],
    now: new Date('2026-04-03T18:00:00.000Z'),
  }), true);
});

test('podeEntrarNaListaEspera rejeita periodo fora do expediente', () => {
  assert.equal(podeEntrarNaListaEspera({
    dataPreferida: '2026-04-10',
    tipoPreferencia: 'periodo',
    periodoPreferido: 'noite',
    disponibilidades: [{ hora_inicio: '08:00', hora_fim: '18:00' }],
    now: new Date('2026-04-03T18:00:00.000Z'),
  }), false);
});
