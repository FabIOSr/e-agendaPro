-- ============================================================
-- MIGRATION 16: Trial de 7 dias para Pro
-- Adiciona coluna trial_ends_at e atualiza lógica de verificação de plano
-- ============================================================

-- ── 1. ADICIONAR COLUNA trial_ends_at ───────────────────────────────────
ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- ── 2. ATUALIZAR verifica_plano_ativo PARA CONSIDERAR TRIAL ─────────────
CREATE OR REPLACE FUNCTION public.verifica_plano_ativo(p_prestador_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_plano TEXT;
  v_valido_ate TIMESTAMPTZ;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  SELECT plano, plano_valido_ate, trial_ends_at
    INTO v_plano, v_valido_ate, v_trial_ends_at
    FROM public.prestadores
    WHERE id = p_prestador_id;

  -- Se estiver em trial válido (não expirou), considera como Pro
  IF v_trial_ends_at IS NOT NULL AND v_trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;

  -- Se plano for free, retorna false (a menos que esteja em trial, que já verificou acima)
  IF v_plano = 'free' THEN
    RETURN FALSE;
  END IF;

  -- Pro sem data de expiração = vitalício (ou assinatura ativa sem data definida)
  IF v_plano = 'pro' AND v_valido_ate IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Pro com data de expiração: considera grace period de 3 dias
  IF v_plano = 'pro' AND v_valido_ate IS NOT NULL THEN
    RETURN v_valido_ate > NOW() - INTERVAL '3 days';
  END IF;

  RETURN FALSE;
END;
$$;

-- ── 3. FUNÇÃO PARA ATIVAR TRIAL DE 7 DIAS ─────────────────────────────────
DROP FUNCTION IF EXISTS public.ativar_trial(UUID);

CREATE FUNCTION public.ativar_trial(p_prestador_id UUID)
RETURNS TABLE(success BOOLEAN, trial_end TIMESTAMPTZ, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_trial_usado BOOLEAN;
  v_trial_atual TIMESTAMPTZ;
BEGIN
  -- Verificar se o prestador existe
  IF NOT EXISTS (SELECT 1 FROM public.prestadores WHERE id = p_prestador_id) THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 'Prestador não encontrado'::TEXT;
    RETURN;
  END IF;

  -- Buscar status atual do trial
  SELECT trial_usado, trial_ends_at
    INTO v_trial_usado, v_trial_atual
    FROM public.prestadores
    WHERE id = p_prestador_id;

  -- Se já usou trial, não permite usar novamente
  IF v_trial_usado THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 'Trial já utilizado'::TEXT;
    RETURN;
  END IF;

  -- Se já tem um trial ativo, retorna data atual
  IF v_trial_atual IS NOT NULL AND v_trial_atual > NOW() THEN
    RETURN QUERY SELECT TRUE, v_trial_atual, 'Trial já ativo'::TEXT;
    RETURN;
  END IF;

  -- Ativar trial por 7 dias
  UPDATE public.prestadores
  SET
    trial_ends_at = NOW() + INTERVAL '7 days',
    plano = 'pro',
    updated_at = NOW()
  WHERE id = p_prestador_id;

  -- Retornar sucesso
  RETURN QUERY
    SELECT
      TRUE as success,
      (NOW() + INTERVAL '7 days')::TIMESTAMPTZ as trial_end,
      'Trial ativado com sucesso'::TEXT as message;
END;
$$;

-- ── 4. FUNÇÃO PARA EXPIRAR TRIALS (executada por cron) ────────────────────
CREATE OR REPLACE FUNCTION public.expirar_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Downgrade para Free quando trial expira
  UPDATE public.prestadores
  SET
    plano = 'free',
    plano_valido_ate = NULL,
    trial_usado = true,  -- Marca que já usou trial
    updated_at = NOW()
  WHERE
    trial_ends_at IS NOT NULL
    AND trial_ends_at <= NOW()
    AND plano = 'pro';
END;
$$;

-- ── 5. CRIAR ÍNDICE PARA PERFORMANCE ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prestadores_trial_ends_at
  ON public.prestadores(trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

-- ── 6. PERMITIR ACESSO ÀS FUNÇÕES ───────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.verifica_plano_ativo(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ativar_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expirar_trials() TO authenticated;

-- ── 7. COMENTÁRIOS PARA DOCUMENTAÇÃO ───────────────────────────────────────
COMMENT ON COLUMN public.prestadores.trial_ends_at IS 'Data/hora de expiração do trial de 7 dias. NULL = sem trial ou trial já expirado';
COMMENT ON FUNCTION public.ativar_trial(UUID) IS 'Ativa trial de 7 dias para um prestador que ainda não utilizou';
COMMENT ON FUNCTION public.expirar_trials() IS 'Downgrade para Free quando trial expira. Executar via cron diário';
