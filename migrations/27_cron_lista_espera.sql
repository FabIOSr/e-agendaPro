-- Migration 27: Configurar cron job para Lista de Espera
-- Usa pg_cron para agendar execução da edge function

-- ═══════════════════════════════════════════════════════════════════════════
-- DROP EXISTENTE (antes de criar)
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove jobs existentes se houver (com exception handler para job inexistente)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('lista-espera-processar');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('lista-espera-cleanup');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXTENSÕES
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilita extensão pg_cron (já deve estar habilitada no Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ═══════════════════════════════════════════════════════════════════════════
-- JOB 1: Processar lista de espera a cada 30 minutos
-- ═══════════════════════════════════════════════════════════════════════════

-- Verifica reservas expiradas e notifica próximo da fila
SELECT cron.schedule(
  'lista-espera-processar',           -- nome do job
  '*/30 * * * *',                     -- schedule: a cada 30 min
  $$
    SELECT net.http_post(
      url := 'https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/cron-notificar-lista-espera',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzNzc1OCwiZXhwIjoyMDg5NzEzNzU4fQ.Kc0mrEDrvw1JERmdbmL7MJzEa6c1yRr0rFO7Z894mEQ'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ═══════════════════════════════════════════════════════════════════════════
-- JOB 2: Cleanup diário às 3 AM
-- ═══════════════════════════════════════════════════════════════════════════

-- Marca como expirada entradas antigas (> 30 dias)
SELECT cron.schedule(
  'lista-espera-cleanup',             -- nome do job
  '0 3 * * *',                        -- schedule: 3 AM diariamente
  $$
    SELECT net.http_post(
      url := 'https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/lista-espera',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzNzc1OCwiZXhwIjoyMDg5NzEzNzU4fQ.Kc0mrEDrvw1JERmdbmL7MJzEa6c1yRr0rFO7Z894mEQ'
      ),
      body := '{"action": "cleanup"}'::jsonb
    );
  $$
);

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════

-- Listar jobs agendados (para verificação)
SELECT jobid, jobname, schedule FROM cron.job WHERE jobname LIKE 'lista-espera%';
