-- 11_intervalo_slot.sql
-- Adiciona campo para configurar intervalo entre slots (plano pago)

ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS intervalo_slot int4 DEFAULT 0;
