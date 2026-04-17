-- Migration 38: Remover políticas RLS perigosas
--
-- MOTIVO: As políticas "qualquer um insere" permitem que qualquer pessoa
-- com a anon key faça INSERT direto, bypassando validações das Edge Functions.
--
-- IMPACTO: ZERO - Todas as operações de INSERT passam por Edge Functions
-- que usam SERVICE_ROLE_KEY (ignora RLS).
--
-- RESULTADO ESPERADO:
-- ✅ Edge Functions continuam funcionando (usa SERVICE_ROLE)
-- ✅ Insert direto com anon key passa a retornar 403 (segurança!)
--
-- TABELAS AFETADAS:
-- - agendamentos: "qualquer um insere agendamento"
-- - avaliacoes: "edge function insere avaliacao"
-- - lista_espera: "Cliente entra na lista de espera"
--
-- MANTIDO:
-- - logs_sistema: service_role apenas (seguro, não remover)

-- ============================================
-- 1. REMOVER política perigosa de agendamentos
-- ============================================

DROP POLICY IF EXISTS "qualquer um insere agendamento" ON public.agendamentos;

-- Nota: NÃO substituir por nova política.
-- Edge Function "criar-agendamento" usa SERVICE_ROLE_KEY e chama
-- a RPC criar_agendamento_atomic que tem todas as validações.

-- ============================================
-- 2. REMOVER política perigosa de avaliações
-- ============================================

DROP POLICY IF EXISTS "edge function insere avaliacao" ON public.avaliacoes;

-- Nota: NÃO substituir por nova política.
-- Edge Functions de avaliações usam SERVICE_ROLE_KEY e têm
-- validações próprias.

-- ============================================
-- 3. REMOVER política perigosa de lista_espera
-- ============================================

DROP POLICY IF EXISTS "Cliente entra na lista de espera" ON public.lista_espera;

-- Nota: NÃO substituir por nova política.
-- Lista de espera deve ser gerida apenas via Edge Functions
-- que usam SERVICE_ROLE_KEY.

-- ============================================
-- 4. VERIFICAÇÃO (opcional - rodar para confirmar)
-- ============================================

-- Verificar que políticas foram removidas:
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('agendamentos', 'avaliacoes', 'lista_espera')
--   AND cmd = 'INSERT';

-- Deve retornar vazio (sem políticas INSERT para essas tabelas)

-- ============================================
-- ROLLBACK (se precisar reverter)
-- ============================================

-- Se algo quebrar, recriar as políticas originais:
--
-- CREATE POLICY "qualquer um insere agendamento"
--   ON public.agendamentos
--   FOR INSERT
--   TO public
--   WITH CHECK (true);
--
-- CREATE POLICY "edge function insere avaliacao"
--   ON public.avaliacoes
--   FOR INSERT
--   TO public
--   WITH CHECK (true);
--
-- CREATE POLICY "Cliente entra na lista de espera"
--   ON public.lista_espera
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (true);
