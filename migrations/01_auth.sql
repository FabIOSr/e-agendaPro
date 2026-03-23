-- ============================================================
-- MIGRATION 01: Schema completo + Auth
-- Cria TODAS as tabelas do zero, depois triggers e RLS.
-- Rodar no Supabase SQL Editor antes de qualquer outra migration.
-- ============================================================

-- ── EXTENSÕES ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 1. PRESTADORES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prestadores (
  id                 UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome               TEXT        NOT NULL DEFAULT '',
  slug               TEXT        UNIQUE,
  email              TEXT,
  bio                TEXT,
  foto_url           TEXT,
  whatsapp           TEXT,
  cpf_cnpj           TEXT,
  plano              TEXT        NOT NULL DEFAULT 'free',
  plano_valido_ate   TIMESTAMPTZ,
  trial_usado        BOOLEAN     NOT NULL DEFAULT false,
  asaas_customer_id  TEXT,
  asaas_sub_id       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. SERVIÇOS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.servicos (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID    NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  nome         TEXT    NOT NULL,
  duracao_min  INTEGER NOT NULL DEFAULT 60,
  preco        NUMERIC,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. DISPONIBILIDADE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disponibilidade (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID    NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  dia_semana   INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio  TIME    NOT NULL,
  hora_fim     TIME    NOT NULL
);

-- ── 4. BLOQUEIOS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bloqueios (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID        NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  inicio       TIMESTAMPTZ NOT NULL,
  fim          TIMESTAMPTZ NOT NULL,
  motivo       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. AGENDAMENTOS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id         UUID        NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  servico_id           UUID        NOT NULL REFERENCES public.servicos(id),
  data_hora            TIMESTAMPTZ NOT NULL,
  cliente_nome         TEXT        NOT NULL,
  cliente_tel          TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'confirmado',
  cancel_token         TEXT        UNIQUE DEFAULT gen_random_uuid()::text,
  google_event_id      TEXT,
  avaliacao_solicitada BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT status_valido CHECK (status IN ('confirmado','concluido','cancelado'))
);

-- ── 6. PAGAMENTOS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pagamentos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id     UUID        NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  asaas_payment_id TEXT        UNIQUE,
  evento           TEXT        NOT NULL,
  valor            NUMERIC,
  billing_type     TEXT,
  data_evento      TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload          JSONB
);

-- ── 7. AVALIAÇÕES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID     UNIQUE REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  prestador_id   UUID     NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  cliente_nome   TEXT     NOT NULL,
  nota           SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 8. GOOGLE CALENDAR TOKENS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  prestador_id  UUID        PRIMARY KEY REFERENCES public.prestadores(id) ON DELETE CASCADE,
  access_token  TEXT        NOT NULL,
  refresh_token TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 9. CLIENTES (CRM) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clientes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID        NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  nome         TEXT        NOT NULL,
  telefone     TEXT        NOT NULL,
  observacoes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prestador_id, telefone)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_agendamentos_prestador_data
  ON public.agendamentos(prestador_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cancel_token
  ON public.agendamentos(cancel_token);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status
  ON public.agendamentos(prestador_id, status, data_hora)
  WHERE status = 'confirmado';
CREATE INDEX IF NOT EXISTS idx_agendamentos_avaliacao
  ON public.agendamentos(status, avaliacao_solicitada, data_hora)
  WHERE status = 'concluido' AND avaliacao_solicitada = false;
CREATE INDEX IF NOT EXISTS idx_servicos_prestador
  ON public.servicos(prestador_id);
CREATE INDEX IF NOT EXISTS idx_disponibilidade_prestador
  ON public.disponibilidade(prestador_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_bloqueios_prestador
  ON public.bloqueios(prestador_id, inicio, fim);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_prestador
  ON public.avaliacoes(prestador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestador
  ON public.pagamentos(prestador_id);
CREATE INDEX IF NOT EXISTS idx_prestadores_asaas
  ON public.prestadores(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_prestadores_slug
  ON public.prestadores(slug);
CREATE INDEX IF NOT EXISTS idx_clientes_prestador
  ON public.clientes(prestador_id, nome);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Cria perfil quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.criar_perfil_prestador()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.prestadores (id, nome, email, plano, trial_usado, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome_completo',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email, 'free', false, NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_prestador();

-- Sincroniza email ao alterar em auth.users
CREATE OR REPLACE FUNCTION public.sincronizar_email_prestador()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.prestadores SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_email_prestador();

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.atualizar_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS prestadores_updated_at ON public.prestadores;
CREATE TRIGGER prestadores_updated_at
  BEFORE UPDATE ON public.prestadores
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

DROP TRIGGER IF EXISTS clientes_updated_at ON public.clientes;
CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.prestadores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidade    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes           ENABLE ROW LEVEL SECURITY;

-- prestadores
DROP POLICY IF EXISTS "prestador le proprio perfil"        ON public.prestadores;
DROP POLICY IF EXISTS "prestador atualiza proprio perfil"  ON public.prestadores;
DROP POLICY IF EXISTS "publico le perfil por slug"         ON public.prestadores;
CREATE POLICY "prestador le proprio perfil"
  ON public.prestadores FOR SELECT USING (auth.uid() = id);
CREATE POLICY "prestador atualiza proprio perfil"
  ON public.prestadores FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "publico le perfil por slug"
  ON public.prestadores FOR SELECT USING (true);

-- serviços
DROP POLICY IF EXISTS "prestador gerencia servicos" ON public.servicos;
DROP POLICY IF EXISTS "publico le servicos ativos"  ON public.servicos;
CREATE POLICY "prestador gerencia servicos"
  ON public.servicos FOR ALL USING (auth.uid() = prestador_id);
CREATE POLICY "publico le servicos ativos"
  ON public.servicos FOR SELECT USING (ativo = true);

-- disponibilidade
DROP POLICY IF EXISTS "prestador gerencia disponibilidade" ON public.disponibilidade;
DROP POLICY IF EXISTS "publico le disponibilidade"         ON public.disponibilidade;
CREATE POLICY "prestador gerencia disponibilidade"
  ON public.disponibilidade FOR ALL USING (auth.uid() = prestador_id);
CREATE POLICY "publico le disponibilidade"
  ON public.disponibilidade FOR SELECT USING (true);

-- bloqueios
DROP POLICY IF EXISTS "prestador gerencia bloqueios" ON public.bloqueios;
CREATE POLICY "prestador gerencia bloqueios"
  ON public.bloqueios FOR ALL USING (auth.uid() = prestador_id);

-- agendamentos
DROP POLICY IF EXISTS "prestador gerencia agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "qualquer um insere agendamento"  ON public.agendamentos;
CREATE POLICY "prestador gerencia agendamentos"
  ON public.agendamentos FOR ALL USING (auth.uid() = prestador_id);
CREATE POLICY "qualquer um insere agendamento"
  ON public.agendamentos FOR INSERT WITH CHECK (true);

-- pagamentos
DROP POLICY IF EXISTS "prestador le seus pagamentos" ON public.pagamentos;
CREATE POLICY "prestador le seus pagamentos"
  ON public.pagamentos FOR SELECT USING (auth.uid() = prestador_id);

-- avaliações
DROP POLICY IF EXISTS "prestador le suas avaliacoes"    ON public.avaliacoes;
DROP POLICY IF EXISTS "publico le avaliacoes"           ON public.avaliacoes;
DROP POLICY IF EXISTS "edge function insere avaliacao"  ON public.avaliacoes;
CREATE POLICY "prestador le suas avaliacoes"
  ON public.avaliacoes FOR SELECT USING (auth.uid() = prestador_id);
CREATE POLICY "publico le avaliacoes"
  ON public.avaliacoes FOR SELECT USING (true);
CREATE POLICY "edge function insere avaliacao"
  ON public.avaliacoes FOR INSERT WITH CHECK (true);

-- google_calendar_tokens
DROP POLICY IF EXISTS "prestador le proprios tokens" ON public.google_calendar_tokens;
CREATE POLICY "prestador le proprios tokens"
  ON public.google_calendar_tokens FOR SELECT USING (auth.uid() = prestador_id);

-- clientes
DROP POLICY IF EXISTS "prestador gerencia clientes" ON public.clientes;
CREATE POLICY "prestador gerencia clientes"
  ON public.clientes FOR ALL USING (auth.uid() = prestador_id);

-- ============================================================
-- FUNÇÕES UTILITÁRIAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.perfil_completo()
RETURNS TABLE (
  id UUID, nome TEXT, slug TEXT, email TEXT, foto_url TEXT, whatsapp TEXT,
  plano TEXT, plano_valido_ate TIMESTAMPTZ, agendamentos_mes BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nome, p.slug, p.email, p.foto_url, p.whatsapp,
    p.plano, p.plano_valido_ate,
    (SELECT COUNT(*) FROM public.agendamentos a
     WHERE a.prestador_id = p.id AND a.status = 'confirmado'
       AND a.created_at >= date_trunc('month', NOW())) AS agendamentos_mes
  FROM public.prestadores p WHERE p.id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.verifica_plano_ativo(p_prestador_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_plano TEXT; v_valido_ate TIMESTAMPTZ;
BEGIN
  SELECT plano, plano_valido_ate INTO v_plano, v_valido_ate
    FROM public.prestadores WHERE id = p_prestador_id;
  IF v_plano = 'free' THEN RETURN FALSE; END IF;
  IF v_plano = 'pro' AND v_valido_ate IS NULL THEN RETURN TRUE; END IF;
  RETURN v_plano = 'pro' AND v_valido_ate > NOW() - INTERVAL '3 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.stats_avaliacoes(p_prestador_id UUID)
RETURNS TABLE (media NUMERIC, total BIGINT)
LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT ROUND(AVG(nota)::NUMERIC, 1), COUNT(*)
  FROM public.avaliacoes WHERE prestador_id = p_prestador_id;
$$;

CREATE OR REPLACE FUNCTION public.kpis_receita(p_prestador_id UUID)
RETURNS TABLE (
  receita_mes NUMERIC, receita_anterior NUMERIC,
  atend_mes BIGINT, atend_anterior BIGINT,
  ticket_medio NUMERIC, ticket_anterior NUMERIC
)
LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT
    COALESCE(SUM(CASE WHEN DATE_TRUNC('month', a.data_hora AT TIME ZONE 'America/Sao_Paulo')
      = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo') THEN s.preco END), 0),
    COALESCE(SUM(CASE WHEN DATE_TRUNC('month', a.data_hora AT TIME ZONE 'America/Sao_Paulo')
      = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 month' THEN s.preco END), 0),
    COUNT(CASE WHEN DATE_TRUNC('month', a.data_hora AT TIME ZONE 'America/Sao_Paulo')
      = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo') THEN 1 END),
    COUNT(CASE WHEN DATE_TRUNC('month', a.data_hora AT TIME ZONE 'America/Sao_Paulo')
      = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 month' THEN 1 END),
    COALESCE(AVG(CASE WHEN DATE_TRUNC('month', a.data_hora AT TIME ZONE 'America/Sao_Paulo')
      = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo') THEN s.preco END), 0),
    COALESCE(AVG(CASE WHEN DATE_TRUNC('month', a.data_hora AT TIME ZONE 'America/Sao_Paulo')
      = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 month' THEN s.preco END), 0)
  FROM public.agendamentos a JOIN public.servicos s ON s.id = a.servico_id
  WHERE a.prestador_id = p_prestador_id AND a.status = 'concluido'
    AND a.data_hora >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 month';
$$;

-- VIEW CRM
CREATE OR REPLACE VIEW public.crm_clientes AS
SELECT
  COALESCE(c.id::text, md5(a.prestador_id::text || a.cliente_tel)) AS id,
  a.prestador_id, a.cliente_nome AS nome, a.cliente_tel AS telefone,
  c.observacoes,
  COUNT(a.id)                                       AS total_visitas,
  COALESCE(SUM(s.preco), 0)                         AS total_gasto,
  ROUND(AVG(s.preco)::NUMERIC, 2)                   AS ticket_medio,
  MAX(a.data_hora)                                  AS ultima_visita,
  (SELECT s2.nome FROM public.agendamentos a2
   JOIN public.servicos s2 ON s2.id = a2.servico_id
   WHERE a2.prestador_id = a.prestador_id AND a2.cliente_tel = a.cliente_tel
     AND a2.status = 'concluido'
   ORDER BY a2.data_hora DESC LIMIT 1)              AS ultimo_servico,
  c.id IS NOT NULL                                  AS tem_perfil
FROM public.agendamentos a
LEFT JOIN public.servicos s ON s.id = a.servico_id
LEFT JOIN public.clientes c
  ON c.prestador_id = a.prestador_id AND c.telefone = a.cliente_tel
WHERE a.status = 'concluido'
GROUP BY a.prestador_id, a.cliente_nome, a.cliente_tel, c.id, c.observacoes
ORDER BY MAX(a.data_hora) DESC;
