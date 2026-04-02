-- migration 23: Lista Espera Inteligente 2.1
-- Permite que clientes entrem na lista de espera para horários específicos
-- Notificação automática quando vaga surge por cancelamento
-- Correções: status, trigger UPDATE, cleanup automático

DROP TABLE IF EXISTS public.lista_espera CASCADE;

-- Tabela de lista de espera
CREATE TABLE public.lista_espera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_email TEXT,
  data_preferida DATE NOT NULL,
  hora_preferida TIME,
  servico_id UUID REFERENCES public.servicos(id) ON DELETE CASCADE,
  servico_nome TEXT,
  servico_duracao_min INT,
  tipo_preferencia TEXT DEFAULT 'exato',  -- 'exato' | 'periodo' | 'qualquer'
  periodo_preferido TEXT,                 -- 'manha' | 'tarde' | 'noite'
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'ativa',            -- 'ativa' | 'notificada' | 'agendada' | 'desistiu' | 'expirada'
  status_atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_telefone, data_preferida, hora_preferida, servico_id)
);

COMMENT ON COLUMN public.lista_espera.data_preferida IS 
'Data de interesse do cliente. Notificações só ocorrem até esta data (com min. 2h antecedência).';

COMMENT ON COLUMN public.lista_espera.status IS 
'Status da entrada: ativa (aguardando vaga), notificada (recebeu WhatsApp), agendada (convertida), desistiu (cliente cancelou), expirada (data passou)';

-- Índices para busca rápida
CREATE INDEX idx_lista_espera_prestador ON public.lista_espera(prestador_id);
CREATE INDEX idx_lista_espera_data ON public.lista_espera(data_preferida);
CREATE INDEX idx_lista_espera_servico ON public.lista_espera(servico_id);
CREATE INDEX idx_lista_espera_status ON public.lista_espera(status) WHERE status IN ('ativa', 'notificada');
CREATE INDEX idx_lista_espera_cleanup ON public.lista_espera(data_preferida) WHERE status NOT IN ('desistiu', 'expirada');

-- RLS: apenas o prestador pode ver sua lista de espera
ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prestador vê sua lista de espera"
  ON public.lista_espera
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (SELECT p.id FROM public.prestadores p WHERE p.id = prestador_id)
  );

-- Prestador pode atualizar status (marcar como desistiu, agendada, etc)
CREATE POLICY "Prestador gerencia sua lista de espera"
  ON public.lista_espera
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (SELECT p.id FROM public.prestadores p WHERE p.id = prestador_id)
  );

-- Cliente pode entrar na lista (INSERT)
CREATE POLICY "Cliente entra na lista de espera"
  ON public.lista_espera
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Trigger: marcar para notificação quando agendamento for CANCELADO (UPDATE status)
-- A notificação real é feita por cron job (cron-notificar-lista-espera)
CREATE OR REPLACE FUNCTION public.marcar_lista_espera_para_notificacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Dispara apenas em cancelamento via UPDATE de status
  IF TG_OP = 'UPDATE' AND OLD.status != 'cancelado' AND NEW.status = 'cancelado' THEN
    -- Atualiza timestamp para forçar reprocessamento pelo cron job
    -- Mantém o status atual (ativa ou notificada) para não perder o estado
    UPDATE public.lista_espera
    SET status_atualizado_em = NOW()
    WHERE prestador_id = OLD.prestador_id
      AND data_preferida = (OLD.data_hora)::DATE
      AND status IN ('ativa', 'notificada');

    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.marcar_lista_espera_para_notificacao IS
'Atualiza timestamp da lista de espera quando agendamento é cancelado. O cron job fará a notificação.';

-- Trigger que marca após cancelamento de agendamento (UPDATE status)
DROP TRIGGER IF EXISTS trg_marcar_lista_espera ON public.agendamentos;
CREATE TRIGGER trg_marcar_lista_espera
  AFTER UPDATE ON public.agendamentos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelado')
  EXECUTE FUNCTION public.marcar_lista_espera_para_notificacao();

-- Grant para authenticated usar a função
GRANT INSERT ON public.lista_espera TO authenticated;
GRANT UPDATE ON public.lista_espera TO authenticated;

-- Migration 23.1: Cleanup automático de entradas antigas
-- Rodar via cron job diário no Supabase
CREATE OR REPLACE FUNCTION public.cleanup_lista_espera()
RETURNS void AS $$
BEGIN
  -- Marca como expirada entradas com data > 30 dias no passado
  UPDATE public.lista_espera
  SET status = 'expirada',
      status_atualizado_em = NOW()
  WHERE data_preferida < CURRENT_DATE - INTERVAL '30 days'
    AND status IN ('ativa', 'notificada');
  
  -- Opcional: deletar registros expirados/desistiu > 90 dias
  -- DELETE FROM public.lista_espera
  -- WHERE data_preferida < CURRENT_DATE - INTERVAL '90 days'
  --   AND status IN ('expirada', 'desistiu');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_lista_espera IS 
'Limpa entradas antigas da lista de espera (> 30 dias). Executar via cron job diário.';

-- Grant para função de cleanup
GRANT EXECUTE ON FUNCTION public.cleanup_lista_espera TO service_role;
