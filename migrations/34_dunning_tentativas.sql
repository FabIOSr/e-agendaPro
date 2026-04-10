-- Migration 34: Dunning Inteligente
-- Tabela para rastrear tentativas de recuperação de pagamentos falhados
-- Cron: 3x ao dia (9h, 15h, 21h Brasília) → chama Edge Function /dunning

-- ═══════════════════════════════════════════════════════════════════════════
-- DROP EXISTENTE (antes de criar)
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove job existente se houver (com exception handler para job inexistente)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('dunning-processar');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXTENSÕES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABELA
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.dunning_tentativas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id    UUID        NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  pagamento_id    UUID        NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  tentativa       INT         NOT NULL DEFAULT 0,  -- 0, 1, 2 (3 tentativas max)
  canal           TEXT        NOT NULL,             -- 'email', 'whatsapp', 'email_desconto'
  enviado         BOOLEAN     NOT NULL DEFAULT false,
  data_tentativa  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dunning_tentativas_pagamento
  ON public.dunning_tentativas(pagamento_id);

CREATE INDEX IF NOT EXISTS idx_dunning_tentativas_prestador
  ON public.dunning_tentativas(prestador_id);

-- Garante que cada pagamento receba no maximo 3 tentativas (0, 1, 2)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dunning_pagamento_tentativa
  ON public.dunning_tentativas(pagamento_id, tentativa);

COMMENT ON TABLE public.dunning_tentativas IS
  'Registra tentativas de recuperação de pagamentos falhados (email, WhatsApp, desconto)';

-- ═══════════════════════════════════════════════════════════════════════════
-- CRON JOB: 3x ao dia (9h, 15h, 21h Brasília = 12h, 18h, 00h UTC)
-- ═══════════════════════════════════════════════════════════════════════════

-- ATENÇÃO: URL e Authorization devem ser atualizados se mudar de ambiente
-- (staging → prod) ou se rotacionar o service role key.
SELECT cron.schedule(
  'dunning-processar',
  '0 12,18,0 * * *',
  $$
    SELECT net.http_post(
      url := 'https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/dunning',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzNzc1OCwiZXhwIjoyMDg5NzEzNzU4fQ.Kc0mrEDrvw1JERmdbmL7MJzEa6c1yRr0rFO7Z894mEQ'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════

SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'dunning-processar';
