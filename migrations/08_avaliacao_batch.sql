-- MIGRATION 08: Cron de solicitação de avaliações
-- Roda a cada hora, busca atendimentos concluídos entre 1h e 3h atrás.
-- Substitua SEU_PROJETO e SEU_SERVICE_ROLE_KEY antes de rodar.

SELECT cron.schedule(
  'solicitar-avaliacoes',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://SEU_PROJETO.supabase.co/functions/v1/solicitar-avaliacao-batch',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
