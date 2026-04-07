-- Migration 30: corrigir verifica_plano_ativo para não considerar Pro
-- prestadores cujo trial expirou mas plano continua 'pro' sem validade
--
-- Problema: ao ativar trial, plano = 'pro' e plano_valido_ate = NULL.
-- Quando trial expira, a função antiga retornava TRUE porque:
--   1. trial_ends_at > NOW() → FALSE
--   2. plano = 'free' → FALSE (era 'pro')
--   3. plano = 'pro' AND plano_valido_ate IS NULL → TRUE ← BUG!
--
-- Correção: se trial_ends_at IS NOT NULL (já teve trial) E expirou,
-- NÃO tratar como vitalício — exige plano_valido_ate válido.

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

  -- 1. Trial ativo ainda → Pro
  IF v_trial_ends_at IS NOT NULL AND v_trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;

  -- 2. Plano free → Free
  IF v_plano = 'free' THEN
    RETURN FALSE;
  END IF;

  -- 3. Trial expirou (v_trial_ends_at IS NOT NULL e <= NOW)
  --    Só é Pro se tiver plano_valido_ate válido (assinou de verdade)
  IF v_trial_ends_at IS NOT NULL THEN
    IF v_valido_ate IS NOT NULL THEN
      RETURN v_valido_ate > NOW() - INTERVAL '3 days';
    END IF;
    -- trial expirou sem assinatura → Free
    RETURN FALSE;
  END IF;

  -- 4. Nunca teve trial (v_trial_ends_at IS NULL)
  --    Pro sem data de expiração = vitalício (caso raro/manual)
  IF v_plano = 'pro' AND v_valido_ate IS NULL THEN
    RETURN TRUE;
  END IF;

  -- 5. Pro com data de expiração: grace period de 3 dias
  IF v_plano = 'pro' AND v_valido_ate IS NOT NULL THEN
    RETURN v_valido_ate > NOW() - INTERVAL '3 days';
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verifica_plano_ativo(UUID) TO authenticated, anon;
