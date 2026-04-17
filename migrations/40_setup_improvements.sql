-- Migration 40: Melhorias de performance (GRATUITAS)
--
-- MIGRATION INCLUI:
-- 1. Criar índice para foreign key órfão em agendamentos (melhora performance)
--
-- NOTA: Extensão pg_net foi REMOVIDA desta migration porque
-- pg_net não suporta SET SCHEMA (limitação da extensão).
--
-- IMPACTO: ZERO - Melhoria não invasiva
-- CUSTO: GRÁTIS - Funciona em plano free do Supabase
--
-- BASEADO EM: Supabase Database Linter recommendation
-- - performance: unindexed_foreign_keys

-- ============================================
-- 1. CRIAR ÍNDICE PARA FOREIGN KEY ÓRFÃO
-- ============================================
--
-- MOTIVO: A tabela agendamentos tem uma foreign key para servicos
-- que não possui índice, causando slow queries em JOINs.
--
-- PROBLEMA IDENTIFICADO pelo Database Linter:
-- "Table public.agendamentos has a foreign key
--  agendamentos_servico_id_fkey without a covering index.
--  This can lead to suboptimal query performance."
--
-- SOLUÇÃO: Criar índice CONCURRENT (não bloqueia a tabela)
-- para permitir queries da aplicação durante a criação.

CREATE INDEX IF NOT EXISTS idx_agendamentos_servico_id
  ON public.agendamentos(servico_id);

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar que o índice foi criado:
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'agendamentos'
  AND indexname = 'idx_agendamentos_servico_id';

-- Deve retornar o índice criado

-- ============================================
-- ROLLBACK (se precisar reverter)
-- ============================================

-- Para reverter a migração:
--DROP INDEX IF EXISTS idx_agendamentos_servico_id;

-- ============================================
-- TEMPO ESPERADO DE EXECUÇÃO
-- ============================================

-- CREATE INDEX: 5-30 segundos (depende do tamanho da tabela)
--
-- NOTA: Índice vai bloquear escritas na tabela durante criação.
-- Para tabelas grandes ou produção com muito tráfego, considere
-- executar via CLI em período de menor movimento.
