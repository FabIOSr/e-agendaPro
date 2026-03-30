-- ============================================================
-- MIGRATION 17: Ativar trial automaticamente no cadastro
-- Modifica o trigger de cadastro para ativar trial de 7 dias automaticamente
-- ============================================================

-- ── ATUALIZAR TRIGGER PARA ATIVAR TRIAL AUTOMATICAMENTE ───────────────────
CREATE OR REPLACE FUNCTION public.criar_perfil_prestador()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  -- Calcula data de fim do trial (7 dias a partir de agora)
  v_trial_ends_at := NOW() + INTERVAL '7 days';

  -- Insere perfil com trial ativado
  INSERT INTO public.prestadores (id, nome, email, plano, trial_usado, trial_ends_at, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome_completo',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'pro',           -- plano = pro durante o trial
    false,           -- trial_usado = false (ainda não usou trial "de verdade")
    v_trial_ends_at,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── COMENTÁRIOS ───────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.criar_perfil_prestador() IS 'Cria perfil de prestador quando usuário se cadastra e ativa trial de 7 dias automaticamente';
