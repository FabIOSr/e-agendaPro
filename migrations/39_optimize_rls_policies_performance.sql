-- Migration 39: Otimizar políticas RLS para performance
--
-- PROBLEMA: Políticas que usam auth.uid() diretamente causam re-execução
-- da função para CADA LINHA da tabela, degradando performance em escala.
--
-- SOLUÇÃO: Mudar auth.uid() para (select auth.uid()) força o PostgreSQL
-- a executar APENAS UMA VEZ e reutilizar o resultado para todas as linhas.
--
-- IMPACTO: ZERO - A lógica das políticas permanece idêntica,
-- apenas otimiza a execução.
--
-- GANHO DE PERFORMANCE: Em tabelas com milhares de registros,
-- consultas podem ficar 10-100x mais rápidas.
--
-- BASEADO EM: Supabase Database Linter recommendation 0003
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================
-- 1. TABELA: prestadores
-- ============================================

-- DROP das políticas antigas
DROP POLICY IF EXISTS "prestador le proprio perfil" ON public.prestadores;
DROP POLICY IF EXISTS "prestador atualiza proprio perfil" ON public.prestadores;

-- CREATE das políticas otimizadas
CREATE POLICY "prestador le proprio perfil"
  ON public.prestadores
  FOR SELECT
  TO public
  USING ((select auth.uid()) = id);

CREATE POLICY "prestador atualiza proprio perfil"
  ON public.prestadores
  FOR UPDATE
  TO public
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ============================================
-- 2. TABELA: servicos
-- ============================================

DROP POLICY IF EXISTS "prestador gerencia servicos" ON public.servicos;

CREATE POLICY "prestador gerencia servicos"
  ON public.servicos
  FOR ALL
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 3. TABELA: disponibilidade
-- ============================================

DROP POLICY IF EXISTS "prestador gerencia disponibilidade" ON public.disponibilidade;

CREATE POLICY "prestador gerencia disponibilidade"
  ON public.disponibilidade
  FOR ALL
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 4. TABELA: bloqueios
-- ============================================

DROP POLICY IF EXISTS "prestador gerencia bloqueios" ON public.bloqueios;

CREATE POLICY "prestador gerencia bloqueios"
  ON public.bloqueios
  FOR ALL
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 5. TABELA: bloqueios_recorrentes
-- ============================================

DROP POLICY IF EXISTS "prestador gerencia bloqueios recorrentes" ON public.bloqueios_recorrentes;

CREATE POLICY "prestador gerencia bloqueios recorrentes"
  ON public.bloqueios_recorrentes
  FOR ALL
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 6. TABELA: agendamentos
-- ============================================

DROP POLICY IF EXISTS "Prestador gerencia próprios agendamentos" ON public.agendamentos;

CREATE POLICY "Prestador gerencia próprios agendamentos"
  ON public.agendamentos
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 7. TABELA: clientes
-- ============================================

DROP POLICY IF EXISTS "prestador gerencia clientes" ON public.clientes;

CREATE POLICY "prestador gerencia clientes"
  ON public.clientes
  FOR ALL
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 8. TABELA: pagamentos
-- ============================================

DROP POLICY IF EXISTS "prestador le seus pagamentos" ON public.pagamentos;

CREATE POLICY "prestador le seus pagamentos"
  ON public.pagamentos
  FOR SELECT
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 9. TABELA: avaliacoes
-- ============================================

DROP POLICY IF EXISTS "prestador le suas avaliacoes" ON public.avaliacoes;

CREATE POLICY "prestador le suas avaliacoes"
  ON public.avaliacoes
  FOR SELECT
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 10. TABELA: google_calendar_tokens
-- ============================================

DROP POLICY IF EXISTS "prestador le proprios tokens" ON public.google_calendar_tokens;

CREATE POLICY "prestador le proprios tokens"
  ON public.google_calendar_tokens
  FOR SELECT
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 11. TABELA: preferencias_notificacao
-- ============================================

DROP POLICY IF EXISTS "prestador gerencia preferencias notificacao" ON public.preferencias_notificacao;

CREATE POLICY "prestador gerencia preferencias notificacao"
  ON public.preferencias_notificacao
  FOR ALL
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- 12. TABELA: cancelamentos
-- ============================================

DROP POLICY IF EXISTS "Prestadores podem ver proprios cancelamentos" ON public.cancelamentos;
DROP POLICY IF EXISTS "Prestadores podem inserir proprios cancelamentos" ON public.cancelamentos;
DROP POLICY IF EXISTS "Prestadores podem atualizar proprios cancelamentos" ON public.cancelamentos;

CREATE POLICY "Prestadores podem ver proprios cancelamentos"
  ON public.cancelamentos
  FOR SELECT
  TO public
  USING ((select auth.uid()) = prestador_id);

CREATE POLICY "Prestadores podem inserir proprios cancelamentos"
  ON public.cancelamentos
  FOR INSERT
  TO public
  WITH CHECK ((select auth.uid()) = prestador_id);

CREATE POLICY "Prestadores podem atualizar proprios cancelamentos"
  ON public.cancelamentos
  FOR UPDATE
  TO public
  USING ((select auth.uid()) = prestador_id);

-- ============================================
-- NOTA: lista_espera JÁ ESTÁ OTIMIZADA!
-- ============================================
-- As políticas de lista_espera JÁ usam subquery, então
-- não precisam ser alteradas:
-- - Prestador gerencia sua lista de espera (já usa select)
-- - Prestador vê sua lista de espera (já usa select)

-- ============================================
-- VERIFICAÇÃO (opcional - rodar para confirmar)
-- ============================================

-- Verificar que não há mais auth.uid() direto:
-- SELECT schemaname, tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (
--     qual ~* 'auth\.uid\(\)[^ ]' -- auth.uid() não seguido de select
--     OR with_check ~* 'auth\.uid\(\)[^ ]'
--   );
--
-- Deve retornar vazio (todas otimizadas)

-- ============================================
-- ROLLBACK (se precisar reverter)
-- ============================================

-- Se algo quebrar, recriar as políticas originais:
--
-- -- prestadores
-- DROP POLICY IF EXISTS "prestador le proprio perfil" ON public.prestadores;
-- CREATE POLICY "prestador le proprio perfil"
--   ON public.prestadores FOR SELECT TO PUBLIC
--   USING (auth.uid() = id);
--
-- DROP POLICY IF EXISTS "prestador atualiza proprio perfil" ON public.prestadores;
-- CREATE POLICY "prestador atualiza proprio perfil"
--   ON public.prestadores FOR UPDATE TO PUBLIC
--   USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id);
--
-- -- Repetir padrão para outras tabelas...
