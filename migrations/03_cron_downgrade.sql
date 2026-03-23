-- MIGRATION 03: Cron lembrete D-1 (WhatsApp)
-- Chama a Edge Function lembretes-whatsapp todo dia às 21h UTC (18h Brasília)
-- Substitua SEU_PROJETO e SEU_SERVICE_ROLE_KEY antes de rodar.

SELECT cron.schedule(
  'lembrete-d1',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://SEU_PROJETO.supabase.co/functions/v1/lembretes-whatsapp',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{"tipo":"lembrete_d1"}'::jsonb
  );
  $$
);
