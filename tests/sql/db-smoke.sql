BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_servico_id uuid;
  v_agendamento_original_id uuid;
  v_token_reserva uuid := gen_random_uuid();
  v_result jsonb;
  v_result_conflict jsonb;
  v_result_same_day jsonb;
  v_result_reserva jsonb;
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'teste-smoke@example.com',
    crypt('senha123', gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  UPDATE public.prestadores
     SET nome = 'Prestador Smoke',
         slug = 'prestador-smoke-db',
         email = 'teste-smoke@example.com',
         whatsapp = '5511999999999',
         plano = 'pro',
         intervalo_min = 10,
         intervalo_slot = 30,
         plano_valido_ate = now() + interval '30 days'
   WHERE id = v_user_id;

  INSERT INTO public.servicos (prestador_id, nome, duracao_min, preco)
  VALUES (v_user_id, 'Corte Smoke', 60, 80)
  RETURNING id INTO v_servico_id;

  -- Agenda para 7 dias a partir de agora, as 10h BRT
  -- Preciso garantir disponibilidade no dia correspondente
  INSERT INTO public.disponibilidade (prestador_id, dia_semana, hora_inicio, hora_fim)
  SELECT
    v_user_id,
    extract(dow from (now() at time zone 'America/Sao_Paulo' + interval '7 days'))::int,
    '08:00', '18:00';

  -- Data do agendamento: 7 dias a partir de agora, as 10:00 BRT
  -- Formato: date + time, convertido para timestamptz
  v_result := public.criar_agendamento_atomic(
    v_user_id,
    v_servico_id,
    'Maria Smoke',
    '5511888888888',
    'maria-smoke@example.com',
    (SELECT ((now() at time zone 'America/Sao_Paulo' + interval '7 days')::date || ' 10:00:00')::timestamp at time zone 'America/Sao_Paulo'),
    NULL
  );

  IF coalesce((v_result->>'ok')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Smoke falhou: criacao valida nao retornou sucesso. Resultado=%', v_result;
  END IF;

  -- Conflito: mesmo horario, mesmo dia
  v_result_conflict := public.criar_agendamento_atomic(
    v_user_id,
    v_servico_id,
    'Joao Smoke',
    '5511777777777',
    'joao-smoke@example.com',
    (SELECT ((now() at time zone 'America/Sao_Paulo' + interval '7 days')::date || ' 10:00:00')::timestamp at time zone 'America/Sao_Paulo'),
    NULL
  );

  IF (v_result_conflict->>'http_status')::int IS DISTINCT FROM 409 THEN
    RAISE EXCEPTION 'Smoke falhou: conflito esperado nao retornou 409. Resultado=%', v_result_conflict;
  END IF;

  -- Antecedencia minima: agendar para 30 min a partir de agora deve falhar
  v_result_same_day := public.criar_agendamento_atomic(
    v_user_id,
    v_servico_id,
    'Ana Smoke',
    '5511666666666',
    'ana-smoke@example.com',
    (SELECT ((now() at time zone 'America/Sao_Paulo' + interval '30 minutes')::timestamp at time zone 'America/Sao_Paulo')),
    NULL
  );

  IF (v_result_same_day->>'http_status')::int IS DISTINCT FROM 409 THEN
    RAISE EXCEPTION 'Smoke falhou: antecedencia minima esperada nao retornou 409. Resultado=%', v_result_same_day;
  END IF;

  INSERT INTO public.pagamentos (prestador_id, asaas_payment_id, evento, valor)
  VALUES (v_user_id, 'pay_smoke_1', 'PAYMENT_RECEIVED', 99.90);

  INSERT INTO public.pagamentos (prestador_id, asaas_payment_id, evento, valor)
  VALUES (v_user_id, 'pay_smoke_1', 'PAYMENT_CONFIRMED', 99.90);

  BEGIN
    INSERT INTO public.pagamentos (prestador_id, asaas_payment_id, evento, valor)
    VALUES (v_user_id, 'pay_smoke_1', 'PAYMENT_CONFIRMED', 99.90);
    RAISE EXCEPTION 'Smoke falhou: duplicidade de payment_id + evento deveria quebrar.';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  IF (SELECT count(*) FROM public.pagamentos WHERE asaas_payment_id = 'pay_smoke_1') <> 2 THEN
    RAISE EXCEPTION 'Smoke falhou: esperado historico com 2 eventos para o mesmo payment_id.';
  END IF;

  INSERT INTO public.agendamentos (
    prestador_id,
    servico_id,
    data_hora,
    cliente_nome,
    cliente_tel,
    status
  )
  VALUES (
    v_user_id,
    v_servico_id,
    (SELECT ((now() at time zone 'America/Sao_Paulo' + interval '7 days')::date || ' 15:00:00')::timestamp at time zone 'America/Sao_Paulo'),
    'Cliente Original',
    '5511555555555',
    'reservado'
  )
  RETURNING id INTO v_agendamento_original_id;

  INSERT INTO public.lista_espera (
    prestador_id,
    cliente_nome,
    cliente_telefone,
    cliente_email,
    data_preferida,
    hora_preferida,
    servico_id,
    servico_nome,
    servico_duracao_min,
    tipo_preferencia,
    status,
    token_reserva,
    reservado_em,
    timeout_minutos,
    notificado_em,
    agendamento_original_id
  )
  VALUES (
    v_user_id,
    'Cliente Lista',
    '5511444444444',
    'lista@example.com',
    (SELECT (now() at time zone 'America/Sao_Paulo' + interval '7 days')::date),
    '15:00',
    v_servico_id,
    'Corte Smoke',
    60,
    'exato',
    'notificada',
    v_token_reserva,
    now(),
    30,
    now(),
    v_agendamento_original_id
  );

  v_result_reserva := public.criar_agendamento_atomic(
    v_user_id,
    v_servico_id,
    'Cliente Lista',
    '5511444444444',
    'lista@example.com',
    (SELECT ((now() at time zone 'America/Sao_Paulo' + interval '7 days')::date || ' 15:00:00')::timestamp at time zone 'America/Sao_Paulo'),
    v_token_reserva
  );

  IF coalesce((v_result_reserva->>'ok')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Smoke falhou: confirmacao por token_reserva nao retornou sucesso. Resultado=%', v_result_reserva;
  END IF;

  IF (SELECT status FROM public.agendamentos WHERE id = v_agendamento_original_id) IS DISTINCT FROM 'cancelado' THEN
    RAISE EXCEPTION 'Smoke falhou: agendamento original deveria virar cancelado apos confirmacao da reserva.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.lista_espera
     WHERE token_reserva = v_token_reserva
       AND status = 'notificada'
  ) THEN
    RAISE EXCEPTION 'Smoke falhou: entrada da lista de espera deveria sair de notificada apos confirmacao.';
  END IF;

  IF (SELECT status FROM public.lista_espera WHERE agendamento_original_id = v_agendamento_original_id) IS DISTINCT FROM 'agendada' THEN
    RAISE EXCEPTION 'Smoke falhou: entrada da lista de espera deveria virar agendada apos confirmacao.';
  END IF;

  RAISE NOTICE 'DB smoke ok: RPC e pagamentos validados com sucesso.';
END $$;

ROLLBACK;
