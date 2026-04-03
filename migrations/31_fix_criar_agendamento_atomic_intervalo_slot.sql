-- Migration 31: corrige RPC criar_agendamento_atomic para carregar intervalo_slot
-- A versao anterior selecionava apenas intervalo_min e depois acessava
-- v_prestador.intervalo_slot, causando erro em execucao no banco real.

CREATE OR REPLACE FUNCTION public.criar_agendamento_atomic(
  p_prestador_id UUID,
  p_servico_id UUID,
  p_cliente_nome TEXT,
  p_cliente_tel TEXT,
  p_cliente_email TEXT DEFAULT NULL,
  p_data_hora TIMESTAMPTZ DEFAULT NULL,
  p_token_reserva UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_prestador RECORD;
  v_servico RECORD;
  v_reserva RECORD;
  v_disponivel_no_dia BOOLEAN;
  v_agendamento_id UUID;
  v_agendamento_original_id UUID;
  v_count BIGINT;
  v_cadencia_min INT;
  v_agora_brt TIMESTAMP;
  v_fim_agendamento TIMESTAMPTZ;
  v_inicio_local TIMESTAMP;
  v_fim_local TIMESTAMP;
  v_motivo TEXT;
  v_is_pro BOOLEAN;
  v_limite_free CONSTANT INT := 10;
  v_antecedencia_minima CONSTANT INT := 60;
BEGIN
  IF p_prestador_id IS NULL OR p_prestador_id IS NULL OR p_cliente_nome IS NULL OR p_cliente_tel IS NULL OR p_data_hora IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Campos obrigatorios: prestador_id, servico_id, cliente_nome, cliente_tel, data_hora',
      'http_status', 400
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_prestador_id::text));

  IF p_data_hora < NOW() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Nao e possivel agendar no passado',
      'http_status', 400
    );
  END IF;

  SELECT
    id,
    plano,
    plano_valido_ate,
    whatsapp,
    COALESCE(intervalo_min, 0) AS intervalo_min,
    COALESCE(intervalo_slot, 0) AS intervalo_slot
  INTO v_prestador
  FROM public.prestadores
  WHERE id = p_prestador_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Prestador nao encontrado',
      'http_status', 400
    );
  END IF;

  SELECT id, duracao_min
    INTO v_servico
    FROM public.servicos
   WHERE id = p_servico_id
     AND prestador_id = p_prestador_id
     AND ativo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Servico nao encontrado ou inativo',
      'http_status', 400
    );
  END IF;

  IF p_token_reserva IS NOT NULL THEN
    SELECT id, prestador_id, reservado_em, timeout_minutos, agendamento_original_id
      INTO v_reserva
      FROM public.lista_espera
     WHERE token_reserva = p_token_reserva
       AND status = 'notificada'
     FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'erro', 'Token de reserva invalido ou expirado',
        'http_status', 400
      );
    END IF;

    IF v_reserva.prestador_id <> p_prestador_id THEN
      RETURN jsonb_build_object(
        'ok', false,
        'erro', 'Token nao pertence a este prestador',
        'http_status', 400
      );
    END IF;

    IF v_reserva.reservado_em IS NULL OR v_reserva.timeout_minutos IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'erro', 'Reserva expirada. Por favor, tente novamente.',
        'http_status', 400
      );
    END IF;

    IF NOW() >= v_reserva.reservado_em + make_interval(mins => v_reserva.timeout_minutos) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'erro', 'Tempo para confirmar expirou. Por favor, tente novamente.',
        'http_status', 400
      );
    END IF;

    v_agendamento_original_id := v_reserva.agendamento_original_id;
  END IF;

  v_is_pro :=
    v_prestador.plano = 'pro'
    AND v_prestador.plano_valido_ate IS NOT NULL
    AND v_prestador.plano_valido_ate > NOW() - INTERVAL '3 days';

  v_cadencia_min := CASE
    WHEN v_is_pro AND v_prestador.intervalo_slot > 0 THEN v_prestador.intervalo_slot
    ELSE v_servico.duracao_min + v_prestador.intervalo_min
  END;

  IF NOT v_is_pro THEN
    SELECT COUNT(*)
      INTO v_count
      FROM public.agendamentos
     WHERE prestador_id = p_prestador_id
       AND data_hora >= date_trunc('month', NOW())
       AND data_hora < date_trunc('month', NOW()) + INTERVAL '1 month'
       AND status <> 'cancelado';

    IF v_count >= v_limite_free THEN
      RETURN jsonb_build_object(
        'ok', false,
        'erro', 'limite_atingido',
        'count', v_count,
        'limite', v_limite_free,
        'whatsapp', v_prestador.whatsapp,
        'http_status', 403
      );
    END IF;
  END IF;

  v_fim_agendamento := p_data_hora + make_interval(mins => v_servico.duracao_min);
  v_agora_brt := NOW() AT TIME ZONE 'America/Sao_Paulo';
  v_inicio_local := p_data_hora AT TIME ZONE 'America/Sao_Paulo';
  v_fim_local := v_inicio_local + make_interval(mins => v_servico.duracao_min);

  IF v_inicio_local::DATE = v_agora_brt::DATE
     AND v_inicio_local < (v_agora_brt + make_interval(mins => v_antecedencia_minima)) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Horario indisponivel. Escolha um horario com pelo menos 60 minutos de antecedencia.',
      'http_status', 409
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.disponibilidade d
     WHERE d.prestador_id = p_prestador_id
       AND d.dia_semana = EXTRACT(DOW FROM v_inicio_local)::INT
       AND d.hora_inicio <= v_inicio_local::TIME
       AND d.hora_fim >= v_fim_local::TIME
       AND (
         (
           (
             EXTRACT(HOUR FROM v_inicio_local)::INT * 60
             + EXTRACT(MINUTE FROM v_inicio_local)::INT
           ) - (
             EXTRACT(HOUR FROM d.hora_inicio)::INT * 60
             + EXTRACT(MINUTE FROM d.hora_inicio)::INT
           )
         ) % v_cadencia_min
       ) = 0
  ) INTO v_disponivel_no_dia;

  IF NOT v_disponivel_no_dia THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Horario nao disponivel. Por favor, escolha outro horario.',
      'http_status', 409
    );
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.agendamentos a
      JOIN public.servicos s_existente ON s_existente.id = a.servico_id
     WHERE a.prestador_id = p_prestador_id
       AND a.status IN ('confirmado', 'reservado')
       AND (v_agendamento_original_id IS NULL OR a.id <> v_agendamento_original_id)
       AND a.data_hora < v_fim_agendamento
       AND (
         a.data_hora + make_interval(mins => s_existente.duracao_min + v_prestador.intervalo_min)
       ) > p_data_hora
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Horario nao disponivel. Por favor, escolha outro horario.',
      'http_status', 409
    );
  END IF;

  v_motivo := NULL;
  SELECT COALESCE(b.motivo, 'bloqueio')
    INTO v_motivo
    FROM public.bloqueios b
   WHERE b.prestador_id = p_prestador_id
     AND b.inicio < v_fim_agendamento
     AND b.fim > p_data_hora
   LIMIT 1;

  IF v_motivo IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Horario indisponivel: ' || v_motivo || '. Por favor, escolha outro horario.',
      'http_status', 409
    );
  END IF;

  v_motivo := NULL;
  SELECT COALESCE(br.motivo, 'bloqueio recorrente')
    INTO v_motivo
    FROM public.bloqueios_recorrentes br
   WHERE br.prestador_id = p_prestador_id
     AND br.ativo = true
     AND br.dia_semana = EXTRACT(DOW FROM v_inicio_local)::INT
     AND br.hora_inicio < v_fim_local::TIME
     AND br.hora_fim > v_inicio_local::TIME
   LIMIT 1;

  IF v_motivo IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Horario indisponivel: ' || v_motivo || '. Por favor, escolha outro horario.',
      'http_status', 409
    );
  END IF;

  INSERT INTO public.agendamentos (
    prestador_id,
    servico_id,
    cliente_nome,
    cliente_tel,
    cliente_email,
    data_hora,
    status,
    cancel_token
  ) VALUES (
    p_prestador_id,
    p_servico_id,
    btrim(p_cliente_nome),
    btrim(p_cliente_tel),
    NULLIF(btrim(COALESCE(p_cliente_email, '')), ''),
    p_data_hora,
    'confirmado',
    gen_random_uuid()::TEXT
  )
  RETURNING id INTO v_agendamento_id;

  IF v_agendamento_original_id IS NOT NULL THEN
    UPDATE public.agendamentos
       SET status = 'cancelado'
     WHERE id = v_agendamento_original_id;

    UPDATE public.lista_espera
       SET status = 'agendada',
           status_atualizado_em = NOW(),
           token_reserva = NULL,
           reservado_em = NULL
     WHERE id = v_reserva.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'agendamento_id', v_agendamento_id
  );
END;
$$;

COMMENT ON FUNCTION public.criar_agendamento_atomic(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID)
IS 'Cria agendamento de forma atomica com lock por prestador, validacoes de limite, conflitos, bloqueios e reserva da lista de espera.';

GRANT EXECUTE ON FUNCTION public.criar_agendamento_atomic(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento_atomic(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID) TO service_role;
