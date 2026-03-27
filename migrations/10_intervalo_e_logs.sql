-- 10_intervalo_e_logs.sql
-- Adiciona campo de intervalo entre agendamentos e tabela de logs do sistema

-- 1. Campo de intervalo na tabela de prestadores
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS intervalo_min int4 DEFAULT 0;

-- 2. Tabela de logs do sistema para observabilidade
CREATE TABLE IF NOT EXISTS logs_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  funcao text NOT NULL,           -- Nome da Edge Function ou módulo
  prestador_id uuid REFERENCES prestadores(id) ON DELETE SET NULL,
  nivel text DEFAULT 'error',     -- 'info', 'warning', 'error', 'critical'
  mensagem text,                  -- Resumo do erro ou evento
  payload jsonb,                  -- Dados recebidos na requisição (se houver)
  detalhes jsonb,                 -- Objeto de erro completo ou stack trace
  ip_origem text                  -- Opcional: IP de quem chamou a função
);

-- Index para busca rápida por prestador ou função
CREATE INDEX IF NOT EXISTS idx_logs_prestador ON logs_sistema(prestador_id);
CREATE INDEX IF NOT EXISTS idx_logs_funcao ON logs_sistema(funcao);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs_sistema(created_at DESC);

-- RLS para logs (apenas administradores ou leitura desabilitada por padrão)
ALTER TABLE logs_sistema ENABLE ROW LEVEL SECURITY;

-- Por segurança, ninguém lê os logs via API por padrão (apenas via painel do Supabase ou service_role)
CREATE POLICY "Apenas service_role pode ler logs" ON logs_sistema
  FOR SELECT TO service_role USING (true);

CREATE POLICY "Apenas service_role pode inserir logs" ON logs_sistema
  FOR INSERT TO service_role WITH CHECK (true);
