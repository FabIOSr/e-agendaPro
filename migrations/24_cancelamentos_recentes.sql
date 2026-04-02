-- Função para buscar agendamentos cancelados recentemente
-- Usada pelo cron job de lista de espera

CREATE OR REPLACE FUNCTION public.agendamentos_cancelados_recentes(minutos_atras INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  prestador_id UUID,
  cliente_id UUID,
  cliente_nome TEXT,
  cliente_telefone TEXT,
  cliente_email TEXT,
  data_hora TIMESTAMPTZ,
  servico_id UUID,
  servico_nome TEXT,
  duracao_min INTEGER,
  cancelado_em TIMESTAMPTZ
) AS $$
BEGIN
  -- Busca na tabela de log/auditoria ou usa created_at/updated_at
  -- Como não temos tabela de log, vamos usar uma abordagem alternativa:
  -- Retorna agendamentos que foram deletados nos últimos X minutos
  -- Isso requer uma tabela de auditoria ou log
  
  -- Para simplificar, retornamos NULL e o cron job vai buscar diretamente
  -- na tabela lista_espera verificando quem ainda não foi notificado
  RETURN QUERY
  SELECT 
    NULL::UUID, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
    NULL::TIMESTAMPTZ, NULL::UUID, NULL::TEXT, NULL::INTEGER, NULL::TIMESTAMPTZ
  LIMIT 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.agendamentos_cancelados_recentes IS 
'Função placeholder - o cron job busca cancelamentos diretamente via query';
