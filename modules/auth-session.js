// auth-session.js
// Módulo reutilizável de sessão
// As variáveis são injetadas pelo processo de build (build.js)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL  = 'https://kevqgxmcoxmzbypdjhru.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzc3NTgsImV4cCI6MjA4OTcxMzc1OH0.N6szx9ryreGph4DDLoFYhiHecOJg2G80xVnmoH6PkQg';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error('❌ Configuração incompleta. Execute: npm run build');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

// ── GETTERS ───────────────────────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getPrestador(userId) {
  const { data, error } = await supabase
    .from('prestadores')
    .select(`
      id, nome, slug, bio, foto_url, whatsapp, email,
      plano, plano_valido_ate, trial_usado, trial_ends_at,
      asaas_customer_id, asaas_sub_id,
      created_at
    `)
    .eq('id', userId)
    .single();

  if (error) throw new Error('Perfil não encontrado: ' + error.message);
  return data;
}

// ── PROTEÇÃO DE ROTA ──────────────────────────────────────────────────────

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

export function checkPlano(prestador, planoNecessario) {
  if (planoNecessario === 'free') return true;

  // Verifica se está em trial válido
  if (prestador.trial_ends_at) {
    const trialEnd = new Date(prestador.trial_ends_at);
    if (trialEnd > new Date()) return true; // Trial ativo
  }

  if (prestador.plano !== 'pro') return false;

  if (prestador.plano_valido_ate) {
    const expira = new Date(prestador.plano_valido_ate);
    const gracePeriod = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() > expira.getTime() + gracePeriod) return false;
  }

  return true;
}

// Retorna objeto com status do trial (ativo/inativo, dias restantes)
export function getTrialStatus(prestador) {
  if (!prestador.trial_ends_at) return null;

  const trialEnd = new Date(prestador.trial_ends_at);
  const now = new Date();

  if (trialEnd <= now) return null; // Trial expirou

  const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return {
    active: true,
    ends_at: trialEnd,
    days_remaining: daysRemaining,
  };
}

// Retorna o badge de plano formatado (Free, Pro, ou Trial)
export function getPlanoBadge(prestador) {
  const trial = getTrialStatus(prestador);

  if (trial && trial.active) {
    return {
      texto: trial.days_remaining === 1 ? 'Trial (1 dia)' : `Trial (${trial.days_remaining} dias)`,
      classe: 'trial',
      is_pro: true,
      is_trial: true,
      days_remaining: trial.days_remaining,
      ends_at: trial.ends_at,
    };
  }

  const isPro = checkPlano(prestador, 'pro');

  return {
    texto: isPro ? 'Pro' : 'Grátis',
    classe: isPro ? 'pro' : 'free',
    is_pro: isPro,
    is_trial: false,
  };
}

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

export async function limiteFreeAtingido(prestador) {
  if (prestador.plano === 'pro') return false;
  const total = await getAgendamentosMes(prestador.id);
  return total >= 10;
}

// ── LOGOUT ────────────────────────────────────────────────────────────────

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/auth';
}

// ── LISTENER DE MUDANÇA DE SESSÃO ─────────────────────────────────────────

export function watchSession(onSignedOut) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (!session && event === 'TOKEN_REFRESHED')) {
      if (onSignedOut) onSignedOut();
      else window.location.href = '/auth';
    }
    if (event === 'TOKEN_REFRESHED' && session) {
      console.debug('Token renovado:', new Date(session.expires_at * 1000));
    }
  });
}

// ── HELPER: BEARER TOKEN para Edge Functions ──────────────────────────────

export async function authHeaders(extra = {}) {
  const session = await getSession();
  if (!session) throw new Error('Sessão expirada');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}
