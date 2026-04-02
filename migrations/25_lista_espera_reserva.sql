-- Migration 25: Lista de Espera com Reserva e Timeout
-- Sistema de reserva temporária: notificado tem 30min para agendar
-- Se não confirmar, próximo da fila é notificado e horário é liberado

ALTER TABLE public.lista_espera 
ADD COLUMN IF NOT EXISTS token_reserva UUID,
ADD COLUMN IF NOT EXISTS reservado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS timeout_minutos INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS notificado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS agendamento_original_id UUID REFERENCES public.agendamentos(id);

--Índice para buscar reservas ativas
CREATE INDEX IF NOT EXISTS idx_lista_espera_reserva_ativa 
ON public.lista_espera(prestador_id, data_preferida, hora_preferida) 
WHERE token_reserva IS NOT NULL AND reservado_em IS NOT NULL;

--Índice para buscar por token
CREATE INDEX IF NOT EXISTS idx_lista_espera_token 
ON public.lista_espera(token_reserva) WHERE token_reserva IS NOT NULL;

COMMENT ON COLUMN public.lista_espera.token_reserva IS 
'Token de reserva do horário quando cliente é notificado. Expira após timeout_minutos.';

COMMENT ON COLUMN public.lista_espera.reservado_em IS 
'Timestamp de quando a reserva foi criada (quando cliente foi notificado)';

COMMENT ON COLUMN public.lista_espera.timeout_minutos IS 
'Tempo em minutos que o notificado tem para confirmar (padrão: 30 min)';

COMMENT ON COLUMN public.lista_espera.notificado_em IS 
'Timestamp de quando o cliente foi notificado';

COMMENT ON COLUMN public.lista_espera.agendamento_original_id IS 
'ID do agendamento original que foi reservado (para virar cancelado após confirmado)';

--Índice para buscar por agendamento original
CREATE INDEX IF NOT EXISTS idx_lista_espera_agendamento_original 
ON public.lista_espera(agendamento_original_id) WHERE agendamento_original_id IS NOT NULL;