-- Migration 26: Adicionar status 'reservado' para lista de espera
-- Quando um cliente da lista de espera é notificado, o agendamento original
-- não é cancelado, mas reservado temporariamente até confirmar ou expirar

ALTER TABLE public.agendamentos 
DROP CONSTRAINT IF EXISTS status_valido;

ALTER TABLE public.agendamentos 
ADD CONSTRAINT status_valido CHECK (status IN ('confirmado','concluido','cancelado','reservado'));

-- Migration para atualizar constraint na tabela
-- Agora os status são: confirmado, concluido, cancelado, reservado
-- reservado = temporariamente bloqueado para cliente da lista de espera