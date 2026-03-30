-- ============================================================
-- MIGRATION 18: Corrigir downgrade Pro/Trial → Free
-- Resetar limites quando expira trial ou assinatura Pro
-- ============================================================

-- ── 1. FUNÇÃO PARA APLICAR LIMITES FREE NO DOWNGRADE ─────────────────────
CREATE OR REPLACE FUNCTION public.aplicar_limites_free(p_prestador_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- 1. Resetar intervalo_slot para 0 (padrão Free)
  UPDATE public.prestadores
  SET intervalo_slot = 0
  WHERE id = p_prestador_id AND intervalo_slot IS NOT NULL;

  -- 2. Manter apenas 1 bloqueio recorrente (o mais antigo), deletar os outros
  DELETE FROM public.bloqueios_recorrentes
  WHERE prestador_id = p_prestador_id
    AND id NOT IN (
      SELECT id FROM public.bloqueios_recorrentes
      WHERE prestador_id = p_prestador_id
      ORDER BY created_at ASC
      LIMIT 1
    );

END;
$$;

-- ── 2. ATUALIZAR expirar_trials PARA USAR A NOVA FUNÇÃO ────────────────────
CREATE OR REPLACE FUNCTION public.expirar_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_prestadores RECORD;
BEGIN
  -- Buscar todos os trials expirados
  FOR v_prestadores IN
    SELECT id FROM public.prestadores
    WHERE trial_ends_at IS NOT NULL
      AND trial_ends_at <= NOW()
      AND plano = 'pro'
  LOOP
    -- Aplica downgrade
    UPDATE public.prestadores
    SET
      plano = 'free',
      plano_valido_ate = NULL,
      updated_at = NOW()
    WHERE id = v_prestadores.id;

    -- Aplica limites Free
    PERFORM public.aplicar_limites_free(v_prestadores.id);
  END LOOP;
END;
$$;

-- ── 3. FUNÇÃO PARA DOWNGRADE DE ASSINATURA PRO (webhook ASAAS) ─────────────
CREATE OR REPLACE FUNCTION public.downgrade_pro(p_prestador_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Downgrade para Free
  UPDATE public.prestadores
  SET
    plano = 'free',
    plano_valido_ate = NULL,
    updated_at = NOW()
  WHERE id = p_prestador_id;

  -- Aplica limites Free
  PERFORM public.aplicar_limites_free(p_prestador_id);
END;
$$;

-- ── 4. COMENTÁRIOS PARA DOCUMENTAÇÃO ───────────────────────────────────────
COMMENT ON FUNCTION public.aplicar_limites_free(UUID) IS 'Aplica limites do plano Free: reset intervalo_slot para 0, mantém apenas 1 bloqueio recorrente';
COMMENT ON FUNCTION public.downgrade_pro(UUID) IS 'Executa downgrade de Pro para Free e aplica limites. Usado pelo webhook ASAAS quando assinatura é cancelada';
COMMENT ON FUNCTION public.expirar_trials() IS 'Expira trials de 7 dias e aplica limites Free. Executar via cron diário';

-- ── 5. PERMITIR ACESSO ÀS NOVAS FUNÇÕES ───────────────────────────────────
GRANT EXECUTE ON FUNCTION public.aplicar_limites_free(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.downgrade_pro(UUID) TO authenticated;
