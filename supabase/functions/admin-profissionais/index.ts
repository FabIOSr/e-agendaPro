import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createRateLimiter, RATE_LIMITS, rateLimitHeaders } from '../_shared/rate-limit.ts';
import { corsHeaders, validateOrigin, handleCorsPreflight } from '../_shared/cors.ts';

const limiter = createRateLimiter('admin-profissionais');

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

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rateResult = limiter.check(ip, RATE_LIMITS.adminDashboard);
  if (!rateResult.allowed) {
    return new Response(
      JSON.stringify({ error: 'Muitas tentativas. Tente novamente mais tarde.' }),
      { status: 429, headers: { ...cors, ...rateLimitHeaders(rateResult), 'Content-Type': 'application/json' } }
    );
  }

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
    // ── PARÂMETROS DA QUERY ───────────────────────────────────────
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const planoFilter = url.searchParams.get('plano') || ''; // pro, free, trial, todos

    const offset = (page - 1) * limit;

    // ── QUERY BASE ────────────────────────────────────────────────
    let query = supabase
      .from('prestadores')
      .select('*', { count: 'exact' });

    // Busca por nome ou email
    if (search) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    // Filtro por plano
    if (planoFilter === 'pro') {
      query = query.eq('plano', 'pro');
    } else if (planoFilter === 'free') {
      query = query.or('plano.eq.free,plano.is.null');
    } else if (planoFilter === 'trial') {
      query = query.not('trial_ends_at', 'is', null);
    }
    // 'todos' = sem filtro

    // Paginação
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: prestadores, count: total, error } = await query;

    if (error) {
      console.error('Erro ao buscar prestadores:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar dados' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ── AGENDAMENTOS (batch) ──────────────────────────────────────
    const agendamentosMap: Record<string, number> = {};
    const avaliacoesMap: Record<string, { media: number; total: number }> = {};

    if (prestadores && prestadores.length > 0) {
      const ids = prestadores.map(p => p.id);

      // Agendamentos confirmados
      const { data: ags } = await supabase
        .from('agendamentos')
        .select('prestador_id, status')
        .in('prestador_id', ids);

      if (ags) {
        ags.forEach(ag => {
          if (ag.status === 'confirmado' || ag.status === 'concluido') {
            agendamentosMap[ag.prestador_id] = (agendamentosMap[ag.prestador_id] || 0) + 1;
          }
        });
      }

      // Avaliações
      const { data: avgs } = await supabase
        .from('avaliacoes')
        .select('prestador_id, nota')
        .in('prestador_id', ids);

      if (avgs) {
        avgs.forEach(av => {
          if (!avaliacoesMap[av.prestador_id]) {
            avaliacoesMap[av.prestador_id] = { media: 0, total: 0, soma: 0 };
          }
          avaliacoesMap[av.prestador_id].total++;
          avaliacoesMap[av.prestador_id].soma += av.nota;
        });

        // Calcula média
        Object.keys(avaliacoesMap).forEach(id => {
          const item = avaliacoesMap[id];
          item.media = item.total > 0 ? Math.round((item.soma / item.total) * 10) / 10 : 0;
          delete item.soma;
        });
      }
    }

    // ── FORMATA DADOS ─────────────────────────────────────────────
    const prestadoresFormatados = (prestadores || []).map(p => {
      let planoAtual = p.plano || 'free';
      let trialDias = 0;

      if (p.trial_ends_at) {
        const trialEnd = new Date(p.trial_ends_at);
        if (trialEnd > new Date()) {
          planoAtual = 'trial';
          trialDias = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        }
      }

      return {
        id: p.id,
        nome: p.nome,
        email: p.email,
        slug: p.slug,
        whatsapp: p.whatsapp,
        plano: planoAtual,
        trial_dias: trialDias,
        plano_valido_ate: p.plano_valido_ate,
        total_agendamentos: agendamentosMap[p.id] || 0,
        avaliacao_media: avaliacoesMap[p.id]?.media || null,
        avaliacao_total: avaliacoesMap[p.id]?.total || 0,
        created_at: p.created_at,
      };
    });

    const totalPages = Math.ceil((total || 0) / limit);

    return new Response(
      JSON.stringify({
        prestadores: prestadoresFormatados,
        total,
        page,
        limit,
        total_pages: totalPages,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em admin-profissionais:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
