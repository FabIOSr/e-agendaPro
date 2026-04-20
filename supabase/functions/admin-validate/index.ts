import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createRateLimiter, RATE_LIMITS, rateLimitHeaders, rateLimitResponse } from '../_shared/rate-limit.ts';
import { corsHeaders, validateOrigin, handleCorsPreflight } from '../_shared/cors.ts';

const limiter = createRateLimiter('admin-validate');

// ── JWT usando Web Crypto API (HMAC-SHA256) ─────────────────────────────────
const JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET');
if (!JWT_SECRET) {
  throw new Error('ADMIN_JWT_SECRET environment variable is required');
}
const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'agendapro-admin';
const JWT_AUDIENCE = 'agendapro-admin-dashboard';
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 horas

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
    ['sign', 'verify']
  );
}

// Codifica base64url (sem padding, URL-safe)
function base64UrlEncode(data: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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

// Gera JWT assinado com HMAC-SHA256
async function generateJWT(): Promise<string> {
  const now = Date.now();
  const payload: JWTPayload = {
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + TOKEN_TTL) / 1000),
    sub: 'admin',
  };

  const header = { alg: JWT_ALGORITHM, typ: 'JWT' };
  const encoder = new TextEncoder();

  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await importKey(JWT_SECRET);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  return `${data}.${base64UrlEncode(signature)}`;
}

// Verifica JWT assinado com HMAC-SHA256
async function verifyJWT(token: string): Promise<{ valid: boolean; expired: boolean; payload?: JWTPayload }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, expired: false };

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

    if (!isValid) return { valid: false, expired: false };

    // Decodifica payload
    const payload: JWTPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));

    // Verifica expiração
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, expired: true };
    }

    // Verifica issuer e audience
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
      return { valid: false, expired: false };
    }

    return { valid: true, expired: false, payload };
  } catch {
    return { valid: false, expired: false };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(origin) ?? new Response('Forbidden', { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  const cors = corsHeaders(origin);

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const adminPassword = Deno.env.get('ADMIN_PASSWORD');
  const hashedPassword = Deno.env.get('ADMIN_PASSWORD_HASH');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action, password, user_id } = body;

    if (action === 'validate_password') {
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const rateResult = limiter.check(ip, RATE_LIMITS.adminValidate);
      if (!rateResult.allowed) {
        console.warn('Rate limit excedido para admin login:', ip);
        return new Response(
          JSON.stringify({ valid: false, error: 'Muitas tentativas. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...cors, ...rateLimitHeaders(rateResult), 'Content-Type': 'application/json' } }
        );
      }

      if (!password) {
        return new Response(
          JSON.stringify({ error: 'Senha obrigatória' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Verificação de senha (texto plano por enquanto - TODO: Web Crypto API)
      const isValid = password === adminPassword;

      if (!isValid) {
        console.warn('⚠️ Tentativa de login admin com senha inválida');
        return new Response(
          JSON.stringify({ valid: false, error: 'Senha inválida' }),
          { status: 401, headers: { ...cors, ...rateLimitHeaders(rateResult), 'Content-Type': 'application/json' } }
        );
      }

      const token = await generateJWT();

      console.info('✅ Admin login realizado com sucesso');
      return new Response(
        JSON.stringify({
          valid: true,
          token,
          expires_at: new Date(Date.now() + TOKEN_TTL).toISOString(),
        }),
        { status: 200, headers: { ...cors, ...rateLimitHeaders(rateResult), 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'validate_token') {
      const adminToken = req.headers.get('x-admin-token');

      if (!adminToken) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Token não fornecido' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const tokenResult = await verifyJWT(adminToken);

      if (!tokenResult.valid) {
        if (tokenResult.expired) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Token expirado' }),
            { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ valid: false, error: 'Token inválido' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'logout') {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em admin-validate:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});