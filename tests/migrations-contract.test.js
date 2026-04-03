import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration29 = readFileSync(new URL('../migrations/29_pagamentos_evento_unico.sql', import.meta.url), 'utf8');
const migration30 = readFileSync(new URL('../migrations/30_criar_agendamento_atomic.sql', import.meta.url), 'utf8');

test('migration 29 troca unicidade para asaas_payment_id + evento', () => {
  assert.match(migration29, /DROP CONSTRAINT IF EXISTS pagamentos_asaas_payment_id_key/i);
  assert.match(migration29, /ADD CONSTRAINT pagamentos_asaas_payment_evento_key/i);
  assert.match(migration29, /UNIQUE\s*\(\s*asaas_payment_id\s*,\s*evento\s*\)/i);
});

test('migration 30 cria a RPC criar_agendamento_atomic', () => {
  assert.match(migration30, /CREATE OR REPLACE FUNCTION public\.criar_agendamento_atomic/i);
  assert.match(migration30, /RETURNS JSONB/i);
  assert.match(migration30, /SECURITY DEFINER/i);
});

test('migration 31 corrige a carga de intervalo_slot no prestador', () => {
  const migration31 = readFileSync(new URL('../migrations/31_fix_criar_agendamento_atomic_intervalo_slot.sql', import.meta.url), 'utf8');
  assert.match(migration31, /COALESCE\(intervalo_slot,\s*0\)\s+AS intervalo_slot/i);
  assert.match(migration31, /WHEN v_is_pro AND v_prestador\.intervalo_slot > 0 THEN v_prestador\.intervalo_slot/i);
});

test('migration 30 usa lock transacional por prestador', () => {
  assert.match(migration30, /pg_advisory_xact_lock\s*\(\s*hashtext\(p_prestador_id::text\)\s*\)/i);
});

test('migration 30 protege antecedencia minima no mesmo dia', () => {
  assert.match(migration30, /v_antecedencia_minima\s+CONSTANT\s+INT\s*:=\s*60/i);
  assert.match(migration30, /Escolha um hor[aá]rio com pelo menos 60 minutos de anteced[eê]ncia/i);
});

test('migration 30 valida grade e disponibilidade do expediente', () => {
  assert.match(migration30, /FROM public\.disponibilidade d/i);
  assert.match(migration30, /% v_cadencia_min/i);
});

test('migration 30 protege contra conflito com agendamentos existentes', () => {
  assert.match(migration30, /FROM public\.agendamentos a/i);
  assert.match(migration30, /JOIN public\.servicos s_existente/i);
  assert.match(migration30, /a\.status IN \('confirmado', 'reservado'\)/i);
});

test('migration 30 cobre bloqueios manuais e recorrentes', () => {
  assert.match(migration30, /FROM public\.bloqueios b/i);
  assert.match(migration30, /FROM public\.bloqueios_recorrentes br/i);
});

test('migration 30 finaliza reserva da lista de espera quando houver token', () => {
  assert.match(migration30, /UPDATE public\.lista_espera/i);
  assert.match(migration30, /status = 'agendada'/i);
  assert.match(migration30, /UPDATE public\.agendamentos\s+SET status = 'cancelado'/i);
});
