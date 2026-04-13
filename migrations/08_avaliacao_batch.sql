-- MIGRATION 08: Cron de solicitação de avaliações
-- Roda a cada hora, busca atendimentos concluídos entre 1h e 3h atrás.

SELECT cron.schedule(
  'solicitar-avaliacoes',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/solicitar-avaliacao-batch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzNzc1OCwiZXhwIjoyMDg5NzEzNzU4fQ.Kc0mrEDrvw1JERmdbmL7MJzEa6c1yRr0rFO7Z894mEQ'
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
