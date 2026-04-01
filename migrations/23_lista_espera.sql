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
  hora_preferida TIME NOT NULL,
  servico_nome TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  expira_em TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  notificado BOOLEAN DEFAULT FALSE,
  notificado_em TIMESTAMPTZ,
  agendado BOOLEAN DEFAULT FALSE,
  UNIQUE(cliente_telefone, data_preferida, hora_preferida)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_lista_espera_prestador ON public.lista_espera(prestador_id);
CREATE INDEX IF NOT EXISTS idx_lista_espera_data ON public.lista_espera(data_preferida);
CREATE INDEX IF NOT EXISTS idx_lista_espera_expira ON public.lista_espera(expira_em);

-- RLS: apenas o prestador pode ver sua lista de espera
ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prestador vê sua lista de espera"
  ON public.lista_espera
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM public.prestadores WHERE id = prestador_id)
  );

-- Trigger: notificar quando agendamento for cancelado e houver alguém na lista de espera
CREATE OR REPLACE FUNCTION public.notificar_lista_espera()
RETURNS TRIGGER AS $$
DECLARE
  vaga_na_lista RECORD;
  prestador RECORD;
BEGIN
  -- Só dispara em cancelamento (DELETE)
  IF TG_OP = 'DELETE' THEN
    -- Busca prestador
    SELECT p.* 
    INTO prestador
    FROM public.prestadores p
    WHERE p.id = OLD.prestador_id;

    -- Busca alguém na lista de espera para o mesmo dia/hora (ou próximo)
    FOR vaga_na_lista IN
      SELECT le.*
      FROM public.lista_espera le
      WHERE le.prestador_id = OLD.prestador_id
        AND le.data_preferida = (OLD.data_hora)::DATE
        AND le.agendado = FALSE
        AND le.expira_em > NOW()
      ORDER BY le.criado_em ASC
      LIMIT 1
    LOOP
      -- Atualiza status para notificado
      UPDATE public.lista_espera
      SET notificado = TRUE,
          notificado_em = NOW()
      WHERE id = vaga_na_lista.id;

      -- Chama edge function para notificar (via HTTP)
      -- Isso é feito de forma assíncrona para não bloquear o cancelamento
      PERFORM pg_notify(
        'lista_espera_notificacao',
        json_build_object(
          'prestador_id', OLD.prestador_id,
          'data', vaga_na_lista.data_preferida,
          'hora', vaga_na_lista.hora_preferida,
          'cliente_id', vaga_na_lista.id
        )::text
      );
      
      RAISE NOTICE 'Cliente na lista de espera notificado: %', vaga_na_lista.cliente_nome;
    END LOOP;

    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que chama a função após cancelamento de agendamento
DROP TRIGGER IF EXISTS trg_notificar_lista_espera ON public.agendamentos;
CREATE TRIGGER trg_notificar_lista_espera
  AFTER DELETE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_lista_espera();

-- Grant para authenticated usar a função
GRANT INSERT ON public.lista_espera TO authenticated;
GRANT UPDATE ON public.lista_espera TO authenticated;
