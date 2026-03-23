-- MIGRATION 02: Cron de downgrade de planos vencidos
-- (Tabela pagamentos e colunas Asaas já criadas na migration 01)

-- Cron: rebaixa planos vencidos há mais de 3 dias, todo dia às 03h UTC
SELECT cron.schedule(
  'downgrade-planos-vencidos',
  '0 3 * * *',
  $$
  UPDATE public.prestadores
  SET plano = 'free', plano_valido_ate = NULL
  WHERE plano = 'pro'
    AND plano_valido_ate IS NOT NULL
    AND plano_valido_ate < NOW() - INTERVAL '3 days';
  $$
);
