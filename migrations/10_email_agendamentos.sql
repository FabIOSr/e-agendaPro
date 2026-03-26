-- Migration: adicionar campo email na tabela agendamentos
-- Uso: Executar no SQL Editor do Supabase

ALTER TABLE public.agendamentos 
ADD COLUMN IF NOT EXISTS cliente_email TEXT;
