import { createClient, SupabaseClient, Session, User } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

interface Prestador {
  id: string;
  nome: string;
  slug: string;
  bio: string | null;
  foto_url: string | null;
  whatsapp: string | null;
  email: string;
  plano: string;
  plano_valido_ate: string | null;
  trial_usado: boolean;
  trial_ends_at: string | null;
  asaas_customer_id: string | null;
  asaas_sub_id: string | null;
  created_at: string;
}

interface PlanoBadge {
  texto: string;
  classe: string;
  is_pro: boolean;
  is_trial: boolean;
  days_remaining?: number;
  ends_at?: Date;
}

interface TrialStatus {
  active: boolean;
  ends_at: Date;
  days_remaining: number;
}

interface SessionResult {
  user: User;
  prestador: Prestador;
  session: Session;
}

if (!window.SUPABASE_URL || !window.SUPABASE_ANON) {
  throw new Error('❌ config.js deve ser carregado antes de auth-session.js');
}

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON = window.SUPABASE_ANON;

if (
  !SUPABASE_URL || SUPABASE_URL === '__SUPABASE_URL__' ||
  !SUPABASE_ANON || SUPABASE_ANON === '__SUPABASE_ANON__'
) {
  throw new Error('❌ Configuração incompleta. Execute: npm run build');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getPrestador(userId: string): Promise<Prestador> {
  const { data, error } = await supabase
    .from('prestadores')
    .select(`
      id, nome, slug, bio, foto_url, whatsapp, email,
      plano, plano_valido_ate, trial_usado, trial_ends_at,
      asaas_customer_id, asaas_sub_id, created_at
    `)
    .eq('id', userId)
    .single();

  if (error) throw new Error('Perfil não encontrado: ' + error.message);
  return data as Prestador;
}

export async function requireAuth(redirectTo?: string): Promise<SessionResult> {
  const session = await getSession();

  if (!session) {
    const dest = redirectTo || window.location.pathname;
    window.location.href = `/auth?next=${encodeURIComponent(dest)}`;
    throw new Error('Não autenticado');
  }

  const prestador = await getPrestador(session.user.id);
  return { user: session.user, prestador, session };
}

export function checkPlano(prestador: Prestador, planoNecessario: 'free' | 'pro'): boolean {
  if (planoNecessario === 'free') return true;

  if (prestador.trial_ends_at) {
    const trialEnd = new Date(prestador.trial_ends_at);
    if (trialEnd > new Date()) return true;
  }

  if (prestador.plano !== 'pro') return false;

  if (prestador.plano_valido_ate) {
    const expira = new Date(prestador.plano_valido_ate);
    const gracePeriod = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() > expira.getTime() + gracePeriod) return false;
  }

  return true;
}

export function getTrialStatus(prestador: Prestador): TrialStatus | null {
  if (!prestador.trial_ends_at) return null;

  const trialEnd = new Date(prestador.trial_ends_at);
  const now = new Date();

  if (trialEnd <= now) return null;

  const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return {
    active: true,
    ends_at: trialEnd,
    days_remaining: daysRemaining,
  };
}

export function getPlanoBadge(prestador: Prestador): PlanoBadge {
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

export async function getAgendamentosMes(prestadorId: string): Promise<number> {
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

export async function limiteFreeAtingido(prestador: Prestador): Promise<boolean> {
  if (prestador.plano === 'pro') return false;
  const total = await getAgendamentosMes(prestador.id);
  return total >= 30;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  window.location.href = '/auth';
}

export function watchSession(onSignedOut: (() => void) | null): void {
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

export async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const session = await getSession();
  if (!session) throw new Error('Sessão expirada');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}