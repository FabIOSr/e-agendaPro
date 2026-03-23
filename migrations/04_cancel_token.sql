-- MIGRATION 04: Verificação de integridade
-- cancel_token e avaliacao_solicitada já foram criados na migration 01.
-- Este arquivo confirma que os índices existem (idempotente).

CREATE INDEX IF NOT EXISTS idx_agendamentos_cancel_token
  ON public.agendamentos(cancel_token);

CREATE INDEX IF NOT EXISTS idx_agendamentos_avaliacao
  ON public.agendamentos(status, avaliacao_solicitada, data_hora)
  WHERE status = 'concluido' AND avaliacao_solicitada = false;

SELECT 'Migration 04 OK - índices verificados' AS status;
