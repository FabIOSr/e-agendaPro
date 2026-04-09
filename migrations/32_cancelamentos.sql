-- 32_cancelamentos.sql
-- Registra motivos de cancelamento de assinatura e descontos oferecidos
-- DROP TABLE IF EXISTS public.cancelamentos;
CREATE TABLE IF NOT EXISTS public.cancelamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL CHECK (motivo IN (
    'muito-caro',
    'nao-uso',
    'faltou-feature',
    'mudei-ramo',
    'outro'
  )),
  outro_motivo TEXT,
  recebeu_desconto BOOLEAN DEFAULT false,
  desconto_percentual INT,
  meses_desconto INT,
  desconto_asaas_sub_id TEXT,         -- ID da assinatura com desconto no Asaas
  desconto_valido_ate TIMESTAMPTZ,     -- Data limite do desconto (quando reverter)
  assinatura_original_sub_id TEXT,     -- ID da assinatura original (para reverter)
  tipo_desconto TEXT,                  -- 'mensal_imediato' ou 'anual_renovacao'
  desconto_aplicado_em TIMESTAMPTZ,    -- Quando o desconto foi agendado/aplicado
  cancelamento_efetivado BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.cancelamentos ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Prestadores podem inserir proprios cancelamentos" ON public.cancelamentos;
CREATE POLICY "Prestadores podem inserir proprios cancelamentos"
  ON public.cancelamentos
  FOR INSERT
  WITH CHECK (auth.uid() = prestador_id);
DROP POLICY IF EXISTS "Prestadores podem atualizar proprios cancelamentos" ON public.cancelamentos;
CREATE POLICY "Prestadores podem atualizar proprios cancelamentos"
  ON public.cancelamentos
  FOR UPDATE
  USING (auth.uid() = prestador_id);

DROP POLICY IF EXISTS "Prestadores podem ver proprios cancelamentos" ON public.cancelamentos;
CREATE POLICY "Prestadores podem ver proprios cancelamentos"
  ON public.cancelamentos
  FOR SELECT
  USING (auth.uid() = prestador_id);

-- Index para queries frequentes
DROP INDEX IF EXISTS idx_cancelamentos_prestador;
CREATE INDEX idx_cancelamentos_prestador ON public.cancelamentos(prestador_id);
DROP INDEX IF EXISTS idx_cancelamentos_motivo;
CREATE INDEX idx_cancelamentos_motivo ON public.cancelamentos(motivo);
DROP INDEX IF EXISTS idx_cancelamentos_criado_em;
CREATE INDEX idx_cancelamentos_criado_em ON public.cancelamentos(criado_em DESC);

-- Garante colunas caso tabela já exista (ADD COLUMN IF NOT EXISTS é idempotente)
ALTER TABLE public.cancelamentos
  ADD COLUMN IF NOT EXISTS tipo_desconto TEXT;
ALTER TABLE public.cancelamentos
  ADD COLUMN IF NOT EXISTS desconto_aplicado_em TIMESTAMPTZ;
ALTER TABLE public.cancelamentos
  ADD COLUMN IF NOT EXISTS desconto_valido_ate TIMESTAMPTZ;

-- Index para reversão de descontos (apenas mensal_imediato pendente)
DROP INDEX IF EXISTS idx_cancelamentos_desconto_valido;
CREATE INDEX idx_cancelamentos_desconto_valido
  ON public.cancelamentos(desconto_valido_ate)
  WHERE recebeu_desconto = true
    AND cancelamento_efetivado = false
    AND tipo_desconto = 'mensal_imediato';
