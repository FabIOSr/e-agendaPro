-- ============================================================
-- MIGRATION 13: Bloqueios recorrentes por dia da semana
-- ============================================================
-- Exemplos de uso:
--   Almoço toda segunda a sexta: 5 registros, dia_semana 1-5, 12:00-13:00
--   Reunião toda segunda: 1 registro, dia_semana 1, 08:00-09:00
--   Sem disponibilidade aos sábados: não é necessário (usa tabela disponibilidade)

CREATE TABLE IF NOT EXISTS public.bloqueios_recorrentes (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID    NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  dia_semana   INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 1=Seg … 6=Sáb
  hora_inicio  TIME    NOT NULL,
  hora_fim     TIME    NOT NULL,
  motivo       TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hora_valida CHECK (hora_fim > hora_inicio)
);

-- Índice para busca rápida por prestador + dia da semana
CREATE INDEX IF NOT EXISTS idx_bloqueios_recorrentes_prestador
  ON public.bloqueios_recorrentes(prestador_id, dia_semana)
  WHERE ativo = true;

-- RLS
ALTER TABLE public.bloqueios_recorrentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prestador gerencia bloqueios recorrentes" ON public.bloqueios_recorrentes;
CREATE POLICY "prestador gerencia bloqueios recorrentes"
  ON public.bloqueios_recorrentes FOR ALL
  USING (auth.uid() = prestador_id);

-- Leitura pública (necessário para Edge Function com anon key)
DROP POLICY IF EXISTS "publico le bloqueios recorrentes" ON public.bloqueios_recorrentes;
CREATE POLICY "publico le bloqueios recorrentes"
  ON public.bloqueios_recorrentes FOR SELECT
  USING (true);
