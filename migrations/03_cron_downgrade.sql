-- MIGRATION 03: Cron downgrade inadimplentes + lembrete WhatsApp

-- 1. Função SQL para rebaixa prestadores inadimplentes (grace period 3 dias)
CREATE OR REPLACE FUNCTION public.rebaixar_inadimplentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  prestador record;
BEGIN
  FOR prestador IN
    SELECT id, email
    FROM public.prestadores
    WHERE plano = 'pro'
      AND plano_valido_ate IS NOT NULL
      AND plano_valido_ate < now() - interval '3 days'
  LOOP
    UPDATE public.prestadores
    SET plano = 'free', plano_valido_ate = null, asaas_sub_id = null
    WHERE id = prestador.id;
    RAISE NOTICE 'Rebaixado para free: %', prestador.email;
  END LOOP;
END;
$$;

-- 2. Agenda verificação de inadimplentes todo dia às 22h UTC (19h Brasília)
SELECT cron.schedule(
  'check-inadimplentes',
  '0 22 * * *',
  $$
  SELECT public.rebaixar_inadimplentes();
  $$
);

-- 3. Cron lembrete D-1 (WhatsApp) - Substitua SEU_SERVICE_ROLE_KEY
SELECT cron.schedule(
  'lembrete-d1',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/lembretes-whatsapp',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{"tipo":"lembrete_d1"}'::jsonb
  );
  $$
);
