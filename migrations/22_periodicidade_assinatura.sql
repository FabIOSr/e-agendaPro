-- Migration: Adicionar campo de periodicidade às assinaturas
-- Data: 2026-03-31
-- Descrição: Adiciona campo 'periodicidade' para distinguir entre planos mensais e anuais

-- Adicionar coluna 'periodicidade' na tabela prestadores
ALTER TABLE prestadores 
ADD COLUMN IF NOT EXISTS assinatura_periodicidade TEXT DEFAULT 'MONTHLY';

-- Adicionar comentário para documentação
COMMENT ON COLUMN prestadores.assinatura_periodicidade IS 'Periodicidade da assinatura: MONTHLY (mensal) ou YEARLY (anual)';

-- Criar índice para consultas rápidas por periodicidade
CREATE INDEX IF NOT EXISTS idx_prestadores_periodicidade 
ON prestadores(assinatura_periodicidade) 
WHERE assinatura_periodicidade = 'YEARLY';

-- Atualizar registros existentes para MONTHLY (padrão)
UPDATE prestadores 
SET assinatura_periodicidade = 'MONTHLY' 
WHERE plano = 'pro' AND assinatura_periodicidade IS NULL;

-- Grant de permissões
GRANT UPDATE (assinatura_periodicidade) ON prestadores TO authenticated;
