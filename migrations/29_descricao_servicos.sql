-- Migration 29: descrição e controle de exibição de preço nos serviços
-- Executar no Supabase SQL Editor

ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exibir_preco BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN servicos.descricao IS 'Descrição curta do serviço (máx 120 chars), exibida na página pública';
COMMENT ON COLUMN servicos.exibir_preco IS 'Se false, exibe "Sob consulta" em vez do valor na página pública';
