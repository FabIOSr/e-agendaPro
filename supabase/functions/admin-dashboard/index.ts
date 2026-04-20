import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createRateLimiter, RATE_LIMITS, rateLimitHeaders } from '../_shared/rate-limit.ts';
import { corsHeaders, validateOrigin, handleCorsPreflight } from '../_shared/cors.ts';

const limiter = createRateLimiter('admin-dashboard');

// ── JWT usando Web Crypto API (HMAC-SHA256) ─────────────────────────────────
const JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET');
if (!JWT_SECRET) {
  throw new Error('ADMIN_JWT_SECRET environment variable is required');
}
const JWT_ISSUER = 'agendapro-admin';
const JWT_AUDIENCE = 'agendapro-admin-dashboard';

interface JWTPayload {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  sub: string;
}

// Converte string para Uint8Array
async function importKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

// Decodifica base64url
function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Verifica JWT assinado com HMAC-SHA256
async function validateAdminToken(req: Request): Promise<boolean> {
  const adminToken = req.headers.get('x-admin-token');
  if (!adminToken) return false;

  try {
    const parts = adminToken.split('.');
    if (parts.length !== 3) return false;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const encoder = new TextEncoder();
    const data = `${encodedHeader}.${encodedPayload}`;

    // Verifica assinatura
    const key = await importKey(JWT_SECRET);
    const signature = base64UrlDecode(encodedSignature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(data)
    );

    if (!isValid) return false;

    // Decodifica payload
    const payload: JWTPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));

    // Verifica expiração
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return false;

    // Verifica issuer e audience
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) return false;

    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(origin) ?? new Response('Forbidden', { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  const cors = corsHeaders(origin);

  // Apenas GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rateResult = limiter.check(ip, RATE_LIMITS.adminValidate);
  if (!rateResult.allowed) {
    return new Response(
      JSON.stringify({ error: 'Muitas tentativas. Tente novamente mais tarde.' }),
      { status: 429, headers: { ...cors, ...rateLimitHeaders(rateResult), 'Content-Type': 'application/json' } }
    );
  }

  // Valida auth
  const isValid = await validateAdminToken(req);
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── KPI: Total de prestadores ─────────────────────────────────
    const { count: totalPrestadores } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true });

    // ── KPI: Plano Pro ────────────────────────────────────────────
    const { count: planoPro } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true })
      .eq('plano', 'pro');

    // ── KPI: Plano Free ───────────────────────────────────────────
    const { count: planoFree } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true })
      .or('plano.eq.free,plano.is.null');

    // ── KPI: Trial ────────────────────────────────────────────────
    const { count: planoTrial } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true })
      .not('trial_ends_at', 'is', null);

    // ── KPI: MRR (Receita Mensal Recorrente) ──────────────────────
    // Busca pagamentos do mês atual para calcular valor real
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { data: pagamentosMes } = await supabase
      .from('pagamentos')
      .select('valor')
      .gte('data_evento', inicioMes.toISOString())
      .in('status', ['confirmed', 'paid', 'aprovado'])
      .gte('valor', 0);

    const mrr = pagamentosMes?.reduce((sum, p) => sum + (p.valor || 0), 0) || 0;

    // ── KPI: Novos nos últimos 7 dias ─────────────────────────────
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    seteDiasAtras.setHours(0, 0, 0, 0);

    const { count: novos7Dias } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', seteDiasAtras.toISOString());

    // ── KPI: Agendamentos do mês ──────────────────────────────────
    const { count: agendamentosMes } = await supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmado')
      .gte('created_at', inicioMes.toISOString());

    // ── TABELA: Últimos 10 prestadores ────────────────────────────
    const { data: novosUsuarios, error: errorUsuarios } = await supabase
      .from('prestadores')
      .select(`
        id, nome, email, plano, trial_ends_at, created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Conta agendamentos por usuário (batch)
    const agendamentosMap: Record<string, number> = {};
    if (novosUsuarios && novosUsuarios.length > 0) {
      const ids = novosUsuarios.map(u => u.id);
      const { data: ags } = await supabase
        .from('agendamentos')
        .select('prestador_id')
        .in('prestador_id', ids)
        .eq('status', 'confirmado');

      if (ags) {
        ags.forEach(ag => {
          agendamentosMap[ag.prestador_id] = (agendamentosMap[ag.prestador_id] || 0) + 1;
        });
      }
    }

    const novosUsuariosFormatados = (novosUsuarios || []).map(u => {
      let planoAtual = u.plano || 'free';

      // Verifica se está em trial ativo
      if (u.trial_ends_at) {
        const trialEnd = new Date(u.trial_ends_at);
        if (trialEnd > new Date()) {
          planoAtual = 'trial';
          const daysRemaining = Math.ceil(
            (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          return {
            id: u.id,
            nome: u.nome,
            email: u.email,
            plano: planoAtual,
            trial_dias: daysRemaining,
            created_at: u.created_at,
            agendamentos: agendamentosMap[u.id] || 0
          };
        }
      }

      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        plano: planoAtual,
        trial_dias: 0,
        created_at: u.created_at,
        agendamentos: agendamentosMap[u.id] || 0
      };
    });

    // ── RETORNA DADOS ─────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        total_prestadores: totalPrestadores || 0,
        plano_pro: planoPro || 0,
        plano_free: planoFree || 0,
        plano_trial: planoTrial || 0,
        mrr,
        novos_7_dias: novos7Dias || 0,
        desde_7_dias: seteDiasAtras.toLocaleDateString('pt-BR'),
        agendamentos_mes: agendamentosMes || 0,
        novos_usuarios: novosUsuariosFormatados.slice(0, 5) // Mostra só 5 no dashboard
      }),
      {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro em admin-dashboard:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
