-- Migration 29: permitir histórico por evento do Asaas com idempotência por pagamento+evento
-- Antes: UNIQUE(asaas_payment_id) impedia registrar múltiplos eventos do mesmo pagamento
-- Agora: UNIQUE(asaas_payment_id, evento) permite histórico e evita duplicar retries do mesmo evento

ALTER TABLE public.pagamentos
DROP CONSTRAINT IF EXISTS pagamentos_asaas_payment_id_key;

ALTER TABLE public.pagamentos
DROP CONSTRAINT IF EXISTS pagamentos_asaas_payment_evento_key;

ALTER TABLE public.pagamentos
ADD CONSTRAINT pagamentos_asaas_payment_evento_key
UNIQUE (asaas_payment_id, evento);
