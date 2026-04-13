-- 33_reverter_descontos_cron.sql
-- Cron job para reverter descontos de retenção expirados.
-- Executa diariamente às 03:00 UTC (00:00 Brasília).
-- Chama a edge function reverter-desconto via HTTP.

-- Opção 1: Usando pg_net (extensão Supabase para chamadas HTTP)
-- Habilitar extensão pg_net se não existir
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar job que chama a edge function via HTTP
SELECT cron.schedule(
  'reverter-descontos-expirados',       -- nome do job
  '0 3 * * *',                          -- diariamente às 03:00 UTC
  $$
    SELECT net.http_post(
      url     := 'https://kevqgxmcoxmzbypdjhru.supabase.co/functions/v1/reverter-desconto',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzNzc1OCwiZXhwIjoyMDg5NzEzNzU4fQ.Kc0mrEDrvw1JERmdbmL7MJzEa6c1yRr0rFO7Z894mEQ'
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);

-- Opção 2: Se pg_net não estiver disponível, usar stored procedure + webhook externo
-- Criar função que retorna descontos expirados para um script externo processar
CREATE OR REPLACE FUNCTION public.get_descontos_expirados()
RETURNS TABLE (
  cancelamento_id UUID,
  prestador_id UUID,
  desconto_percentual INT,
  meses_desconto INT,
  desconto_asaas_sub_id TEXT,
  desconto_valido_ate TIMESTAMPTZ,
  nome_prestador TEXT,
  asaas_customer_id TEXT,
  asaas_sub_id_atual TEXT,
  plano TEXT,
  assinatura_periodicidade TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.prestador_id,
    c.desconto_percentual,
    c.meses_desconto,
    c.desconto_asaas_sub_id,
    c.desconto_valido_ate,
    p.nome,
    p.asaas_customer_id,
    p.asaas_sub_id,
    p.plano,
    p.assinatura_periodicidade
  FROM cancelamentos c
  JOIN prestadores p ON p.id = c.prestador_id
  WHERE c.recebeu_desconto = true
    AND c.cancelamento_efetivado = false
    AND c.tipo_desconto = 'mensal_imediato'
    AND c.desconto_valido_ate < now()
    AND c.desconto_asaas_sub_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para uso (se necessário)
GRANT EXECUTE ON FUNCTION public.get_descontos_expirados TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_descontos_expirados TO service_role;
