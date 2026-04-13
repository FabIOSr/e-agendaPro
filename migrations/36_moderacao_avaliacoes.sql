-- migrations/36_moderacao_avaliacoes.sql
--
-- Adiciona sistema de moderação de avaliações:
-- - Campo status: pendente (default) → aprovada / rejeitada
-- - Índice para queries de moderação
-- - Auto-aprovação via trigger após 24h
--

-- 1. Adicionar campos de moderação
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS moderada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;

-- 2. Constraint para valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_avaliacoes_status'
  ) THEN
    ALTER TABLE public.avaliacoes
      ADD CONSTRAINT chk_avaliacoes_status
      CHECK (status IN ('pendente', 'aprovada', 'rejeitada'));
  END IF;
END $$;

-- 3. Índice para queries de moderação
CREATE INDEX IF NOT EXISTS idx_avaliacoes_status
  ON public.avaliacoes(status, created_at DESC);

-- 4. Índice para buscar avaliações pendentes por prestador
CREATE INDEX IF NOT EXISTS idx_avaliacoes_prestador_status
  ON public.avaliacoes(prestador_id, status, created_at DESC);

-- 5. Função para auto-aprovar avaliações pendentes após 24h
CREATE OR REPLACE FUNCTION auto_aprovar_avaliacoes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.avaliacoes
  SET status = 'aprovada',
      moderada_em = NOW()
  WHERE status = 'pendente'
    AND created_at < NOW() - INTERVAL '24 hours'
    AND moderada_em IS NULL;
END;
$$;

-- 6. Trigger para auto-aprovação diária (manual via cron ou automático)
-- agendamentos existentes mantêm status 'pendente' até aprovação manual
-- Novos agendamentos entram como 'pendente' automaticamente

-- 7. Migrar avaliações existentes como aprovadas (evita que sumam da página pública)
UPDATE public.avaliacoes
SET status = 'aprovada',
    moderada_em = NOW()
WHERE status = 'pendente';

-- 8. Atualizar stats_avaliacoes para filtrar apenas aprovadas
CREATE OR REPLACE FUNCTION public.stats_avaliacoes(p_prestador_id UUID)
RETURNS TABLE (media NUMERIC, total BIGINT)
LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT ROUND(AVG(nota)::NUMERIC, 1), COUNT(*)
  FROM public.avaliacoes 
  WHERE prestador_id = p_prestador_id 
    AND status = 'aprovada';
$$;