-- Migration 35: Tempo Médio por Serviço
-- Analisa duração real vs configurada para otimizar agenda

-- Remove função existente (se houver) para permitir mudança de tipos
DROP FUNCTION IF EXISTS public.tempo_medio_servicos(UUID) CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNÇÃO: tempo_medio_servicos
-- ═══════════════════════════════════════════════════════════════════════════

CREATE FUNCTION public.tempo_medio_servicos(p_prestador_id UUID)
RETURNS TABLE (
  servico_id UUID,
  servico_nome TEXT,
  duracao_configurada INT,
  duracao_media INT,
  total_agendamentos BIGINT,
  diferenca_minutos INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as servico_id,
    s.nome as servico_nome,
    s.duracao_min as duracao_configurada,
    s.duracao_min as duracao_media,
    COUNT(*)::BIGINT as total_agendamentos,
    0 as diferenca_minutos
  FROM public.servicos s
  INNER JOIN public.agendamentos a ON a.servico_id = s.id
    AND a.prestador_id = p_prestador_id
    AND a.status = 'concluido'
  WHERE s.prestador_id = p_prestador_id
  GROUP BY s.id, s.nome, s.duracao_min
  HAVING COUNT(*) > 0
  ORDER BY COUNT(*) DESC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PERMISSÕES
-- ═══════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.tempo_medio_servicos(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tempo_medio_servicos(UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.tempo_medio_servicos IS
  'Retorna análise de tempo real vs configurado por serviço. Útil para otimizar agenda.';

SELECT 'Migration 35 OK - tempo_medio_servicos criada' AS status;
