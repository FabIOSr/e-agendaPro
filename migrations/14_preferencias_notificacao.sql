-- ============================================================
-- MIGRATION 14: Preferências de Notificação
-- ============================================================
-- Controla quais notificações o prestador deseja receber
-- Cada preferência pode ser ligada/desligada individualmente

CREATE TABLE IF NOT EXISTS public.preferencias_notificacao (
  prestador_id UUID PRIMARY KEY REFERENCES public.prestadores(id) ON DELETE CASCADE,

  -- WhatsApp
  whatsapp_novo_agendamento BOOLEAN NOT NULL DEFAULT true,
  whatsapp_lembrete_d1 BOOLEAN NOT NULL DEFAULT true,
  whatsapp_cancelamento BOOLEAN NOT NULL DEFAULT true,
  whatsapp_agenda_vazia BOOLEAN NOT NULL DEFAULT false,

  -- Email
  email_novo_agendamento BOOLEAN NOT NULL DEFAULT true,
  email_lembrete_d1 BOOLEAN NOT NULL DEFAULT true,
  email_cancelamento BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_preferencias_notificacao_prestador
  ON public.preferencias_notificacao(prestador_id);

-- RLS
ALTER TABLE public.preferencias_notificacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prestador gerencia preferencias notificacao" ON public.preferencias_notificacao;
CREATE POLICY "prestador gerencia preferencias notificacao"
  ON public.preferencias_notificacao FOR ALL
  USING (auth.uid() = prestador_id);

DROP POLICY IF EXISTS "publico le preferencias notificacao" ON public.preferencias_notificacao;
CREATE POLICY "publico le preferencias notificacao"
  ON public.preferencias_notificacao FOR SELECT
  USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.atualiza_preferencias_notificacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_preferencias_notificacao_updated_at ON public.preferencias_notificacao;
CREATE TRIGGER trigger_preferencias_notificacao_updated_at
  BEFORE UPDATE ON public.preferencias_notificacao
  FOR EACH ROW
  EXECUTE FUNCTION public.atualiza_preferencias_notificacao_updated_at();

-- Criar preferências padrão para prestadores existentes
INSERT INTO public.preferencias_notificacao (prestador_id)
SELECT id FROM public.prestadores
ON CONFLICT (prestador_id) DO NOTHING;

SELECT 'Migration 14 OK - preferencias_notificacao criado' AS status;
