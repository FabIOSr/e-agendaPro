-- migration 23: Lista Espera Inteligente
-- Permite que clientes entrem na lista de espera para horários específicos
-- Notificação automática quando vaga surge por cancelamento

-- Tabela de lista de espera
CREATE TABLE IF NOT EXISTS public.lista_espera (
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
  notificado BOOLEAN DEFAULT FALSE,
  notificado_em TIMESTAMPTZ,
  agendado BOOLEAN DEFAULT FALSE,
  UNIQUE(cliente_telefone, data_preferida, hora_preferida, servico_id)
);

COMMENT ON COLUMN public.lista_espera.data_preferida IS 
'Data de interesse do cliente. Notificações só ocorrem até esta data (com min. 2h antecedência).';

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_lista_espera_prestador ON public.lista_espera(prestador_id);
CREATE INDEX IF NOT EXISTS idx_lista_espera_data ON public.lista_espera(data_preferida);
CREATE INDEX IF NOT EXISTS idx_lista_espera_expira ON public.lista_espera(expira_em);
CREATE INDEX IF NOT EXISTS idx_lista_espera_servico ON public.lista_espera(servico_id);
CREATE INDEX IF NOT EXISTS idx_lista_espera_notificado ON public.lista_espera(notificado, agendado);

-- RLS: apenas o prestador pode ver sua lista de espera
ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prestador vê sua lista de espera"
  ON public.lista_espera
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM public.prestadores WHERE id = prestador_id)
  );

-- Trigger: marcar para notificação quando agendamento for cancelado
-- A notificação real é feita por cron job (cron-notificar-lista-espera)
CREATE OR REPLACE FUNCTION public.marcar_lista_espera_para_notificacao()
RETURNS TRIGGER AS $$
DECLARE
  vaga_na_lista RECORD;
BEGIN
  -- Só dispara em cancelamento (DELETE)
  IF TG_OP = 'DELETE' THEN
    -- Marca entradas na lista de espera para o mesmo dia
    -- A notificação real será feita pelo cron job
    UPDATE public.lista_espera
    SET notificado = FALSE  -- Mantém como não notificado para o cron processar
    WHERE prestador_id = OLD.prestador_id
      AND data_preferida = (OLD.data_hora)::DATE
      AND agendado = FALSE
      AND expira_em > NOW();

    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que marca após cancelamento de agendamento
DROP TRIGGER IF EXISTS trg_marcar_lista_espera ON public.agendamentos;
CREATE TRIGGER trg_marcar_lista_espera
  AFTER DELETE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.marcar_lista_espera_para_notificacao();

-- Grant para authenticated usar a função
GRANT INSERT ON public.lista_espera TO authenticated;
GRANT UPDATE ON public.lista_espera TO authenticated;
