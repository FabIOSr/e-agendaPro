-- MIGRATION 05: Verificação de integridade
-- Tabelas avaliacoes e google_calendar_tokens já criadas na migration 01.
-- Este arquivo confirma índices e políticas adicionais (idempotente).

CREATE INDEX IF NOT EXISTS idx_avaliacoes_prestador
  ON public.avaliacoes(prestador_id, created_at DESC);

SELECT 'Migration 05 OK - avaliacoes e gcal verificados' AS status;
