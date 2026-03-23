// auth-session.js
// Módulo reutilizável de sessão — importar em TODAS as páginas protegidas.
//
// Uso:
//   import { getSession, getPrestador, logout, requireAuth, checkPlano } from './auth-session.js'
//
// Exemplo de proteção de rota:
//   const { user, prestador } = await requireAuth()
//   if (!checkPlano(prestador, 'pro')) mostrarPaywall()

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ── CONFIGURAÇÃO ──────────────────────────────────────────────────────────
// Em produção usar variáveis de ambiente / build-time injection
const SUPABASE_URL  = window.__SUPABASE_URL__  || 'https://kevqgxmcoxmzbypdjhru.supabase.co';
const SUPABASE_ANON = window.__SUPABASE_ANON__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzc3NTgsImV4cCI6MjA4OTcxMzc1OH0.N6szx9ryreGph4DDLoFYhiHecOJg2G80xVnmoH6PkQg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    // Persiste sessão no localStorage automaticamente
    persistSession: true,
    // Renova token automaticamente antes de expirar
    autoRefreshToken: true,
    // Detecta sessão de outros abas/janelas
    detectSessionInUrl: true,
    // Armazenamento de sessão (padrão: localStorage)
    storage: window.localStorage,
  },
});

// ── GETTERS ───────────────────────────────────────────────────────────────

/**
 * Retorna a sessão atual (token JWT + user).
 * null se não estiver logado.
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Retorna o user do Supabase Auth atual.
 * null se não estiver logado.
 */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Retorna o perfil completo do prestador (tabela prestadores).
 * Inclui plano, plano_valido_ate, slug, nome, etc.
 */
export async function getPrestador(userId) {
  const { data, error } = await supabase
    .from('prestadores')
    .select(`
      id, nome, slug, bio, foto_url, whatsapp, email,
      plano, plano_valido_ate, trial_usado,
      asaas_customer_id, asaas_sub_id,
      created_at
    `)
    .eq('id', userId)
    .single();

  if (error) throw new Error('Perfil não encontrado: ' + error.message);
  return data;
}

// ── PROTEÇÃO DE ROTA ──────────────────────────────────────────────────────

/**
 * Verifica se há sessão ativa.
 * Se não houver, redireciona para /auth e lança erro.
 * Retorna { user, prestador } para uso imediato.
 *
 * @param {string} redirectTo - URL para onde voltar após login (opcional)
 */
export async function requireAuth(redirectTo) {
  const session = await getSession();

  if (!session) {
    const dest = redirectTo || window.location.pathname;
    window.location.href = `/auth?next=${encodeURIComponent(dest)}`;
    throw new Error('Não autenticado');
  }

  const prestador = await getPrestador(session.user.id);
  return { user: session.user, prestador, session };
}

// ── VERIFICAÇÃO DE PLANO ──────────────────────────────────────────────────

/**
 * Retorna true se o prestador tem acesso a determinada funcionalidade.
 *
 * @param {object} prestador - objeto retornado por getPrestador()
 * @param {string} planoNecessario - 'free' | 'pro'
 */
export function checkPlano(prestador, planoNecessario) {
  if (planoNecessario === 'free') return true; // free acessa tudo do free

  if (prestador.plano !== 'pro') return false;

  // Verifica se não está expirado (inclui grace period de 3 dias)
  if (prestador.plano_valido_ate) {
    const expira    = new Date(prestador.plano_valido_ate);
    const gracePeriod = 3 * 24 * 60 * 60 * 1000; // 3 dias em ms
    if (Date.now() > expira.getTime() + gracePeriod) return false;
  }

  return true;
}

/**
 * Retorna quantos agendamentos o prestador fez no mês atual.
 * Usado para verificar o limite do plano free (10/mês).
 */
export async function getAgendamentosMes(prestadorId) {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('prestador_id', prestadorId)
    .eq('status', 'confirmado')
    .gte('created_at', inicioMes.toISOString());

  if (error) return 0;
  return count ?? 0;
}

/**
 * Retorna se o plano free atingiu o limite do mês.
 */
export async function limiteFreeAtingido(prestador) {
  if (prestador.plano === 'pro') return false;
  const total = await getAgendamentosMes(prestador.id);
  return total >= 10;
}

// ── LOGOUT ────────────────────────────────────────────────────────────────

/**
 * Faz logout e redireciona para /auth.
 */
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/auth';
}

// ── LISTENER DE MUDANÇA DE SESSÃO ─────────────────────────────────────────

/**
 * Escuta mudanças de auth (token renovado, logout de outra aba, etc.)
 * Chame uma vez na inicialização de cada página protegida.
 *
 * @param {function} onSignedOut - callback quando sessão expirar
 */
export function watchSession(onSignedOut) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (!session && event === 'TOKEN_REFRESHED')) {
      if (onSignedOut) onSignedOut();
      else window.location.href = '/auth';
    }
    if (event === 'TOKEN_REFRESHED' && session) {
      // Token renovado silenciosamente — não precisa fazer nada
      console.debug('Token renovado:', new Date(session.expires_at * 1000));
    }
  });
}

// ── HELPER: BEARER TOKEN para Edge Functions ──────────────────────────────

/**
 * Retorna o header Authorization para chamadas às Edge Functions.
 * Uso: fetch(url, { headers: await authHeaders() })
 */
export async function authHeaders(extra = {}) {
  const session = await getSession();
  if (!session) throw new Error('Sessão expirada');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}
