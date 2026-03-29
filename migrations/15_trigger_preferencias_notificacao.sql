-- ============================================================
-- MIGRATION 15: Trigger automático para preferências de notificação
-- ============================================================
-- Cria automaticamente as preferências padrão de notificação
-- quando um novo prestador é criado.

-- Função que cria preferências padrão
CREATE OR REPLACE FUNCTION public.criar_preferencias_notificacao_padrao()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.preferencias_notificacao (prestador_id)
  VALUES (NEW.id)
  ON CONFLICT (prestador_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que executa a função após insert em prestadores
DROP TRIGGER IF EXISTS trigger_criar_preferencias_notificacao ON public.prestadores;
CREATE TRIGGER trigger_criar_preferencias_notificacao
  AFTER INSERT ON public.prestadores
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_preferencias_notificacao_padrao();

SELECT 'Migration 15 OK - trigger preferencias_notificacao criado' AS status;
