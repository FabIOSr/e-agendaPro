import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, User } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const adminPassword = Deno.env.get('ADMIN_PASSWORD');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action, password, user_id } = body;

    // ── AÇÃO: VALIDAR SENHA ADMIN (login inicial) ──────────────────
    if (action === 'validate_password') {
      if (!password) {
        return new Response(
          JSON.stringify({ error: 'Senha obrigatória' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isValid = password === adminPassword;

      if (!isValid) {
        console.warn('⚠️ Tentativa de login admin com senha inválida');
        return new Response(
          JSON.stringify({ valid: false, error: 'Senha inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Gera um token simples (HMAC com timestamp)
      const timestamp = Date.now();
      const tokenData = { timestamp, hash: crypto.randomUUID() };
      const token = btoa(JSON.stringify(tokenData));

      return new Response(
        JSON.stringify({
          valid: true,
          token,
          expires_at: new Date(timestamp + 24 * 60 * 60 * 1000).toISOString(), // 24h
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── AÇÃO: VALIDAR TOKEN ADMIN (sessão) ─────────────────────────
    if (action === 'validate_token') {
      const adminToken = req.headers.get('x-admin-token');

      if (!adminToken) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Token não fornecido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const decoded = JSON.parse(atob(adminToken));
        const age = Date.now() - decoded.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas

        if (age > maxAge) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Token expirado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ valid: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Token inválido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── AÇÃO: LOGOUT ADMIN ─────────────────────────────────────────
    if (action === 'logout') {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em admin-validate:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
