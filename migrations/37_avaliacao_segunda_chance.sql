-- migrations/37_avaliacao_segunda_chance.sql
--
-- Adiciona sistema de segunda chance para avaliações:
-- - Column flag para evitar reenvio
-- - Índice para performance
-- - Cron job pode enviar lembrete 24h-48h após primeiro envio
--

-- 1. Adicionar coluna de flag
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS avaliacao_segunda_chance BOOLEAN NOT NULL DEFAULT false;

-- 2. Índice para queries de segunda chance
CREATE INDEX IF NOT EXISTS idx_agendamentos_avaliacao_segunda_chance
  ON public.agendamentos(status, avaliacao_solicitada, avaliacao_segunda_chance, data_hora)
  WHERE status = 'concluido' 
    AND avaliacao_solicitada = true 
    AND avaliacao_segunda_chance = false;