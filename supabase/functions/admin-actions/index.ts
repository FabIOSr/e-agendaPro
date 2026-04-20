import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";
import { createRateLimiter, RATE_LIMITS, rateLimitHeaders } from '../_shared/rate-limit.ts';

const limiter = createRateLimiter('admin-actions');

// ── JWT usando Web Crypto API (HMAC-SHA256) ─────────────────────────────────
const JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET');
if (!JWT_SECRET) {
  throw new Error('ADMIN_JWT_SECRET environment variable is required');
}
const JWT_ALGORITHM = 'HS256';
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
    ['sign', 'verify']
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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rateResult = limiter.check(ip, RATE_LIMITS.adminActions);
  if (!rateResult.allowed) {
    return Response.json(
      { error: 'Muitas tentativas. Tente novamente mais tarde.' },
      { status: 429, headers: { ...cors, ...rateLimitHeaders(rateResult) } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── VERIFICAÇÃO DE TOKEN ADMIN ────────────────────────────────
  const adminToken = req.headers.get('x-admin-token');
  if (!adminToken) {
    return Response.json({ error: 'Token admin obrigatório' }, { status: 401, headers: cors });
  }

  const tokenResult = await verifyJWT(adminToken);
  if (!tokenResult.valid) {
    if (tokenResult.expired) {
      return Response.json({ error: 'Token expirado' }, { status: 401, headers: cors });
    }
    return Response.json({ error: 'Token inválido' }, { status: 401, headers: cors });
  }

  try {
    const body = await req.json();
    const { action, prestador_id, motivo } = body;

    // ── LISTAR PRESTADORES COM BUSCA ──────────────────────────
    if (action === "listar") {
      const page = body.page || 1;
      const limit = body.limit || 20;
      const search = body.search || "";
      const filtroPlano = body.filtro_plano || "todos";
      const filtroStatus = body.filtro_status || "todos";

      let query = supabase
        .from("prestadores")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,slug.ilike.%${search}%`);
      }

      if (filtroPlano !== "todos") {
        query = query.eq("plano", filtroPlano);
      }

      if (filtroStatus === "pro") {
        query = query.eq("plano", "pro");
      } else if (filtroStatus === "free") {
        query = query.eq("plano", "free");
      } else if (filtroStatus === "trial") {
        query = query.not("trial_ends_at", "is", null).gte("trial_ends_at", new Date().toISOString());
      } else if (filtroStatus === "vencido") {
        query = query.eq("plano", "pro").not("plano_valido_ate", "is", null).lt("plano_valido_ate", new Date().toISOString());
      }

      const offset = (page - 1) * limit;
      const { data, count, error } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      return Response.json({
        prestadores: data || [],
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      }, { headers: cors });
    }

    // ── SUSPENDER CONTA (downgrade forçado para free) ────────
    if (action === "suspender") {
      if (!prestador_id) {
        return Response.json({ error: "prestador_id obrigatório" }, { status: 400, headers: cors });
      }

      const { data: prestador, error: fetchErr } = await supabase
        .from("prestadores")
        .select("nome, email, plano")
        .eq("id", prestador_id)
        .single();

      if (fetchErr || !prestador) {
        return Response.json({ error: "Prestador não encontrado" }, { status: 404, headers: cors });
      }

      const { error } = await supabase
        .from("prestadores")
        .update({
          plano: "free",
          plano_valido_ate: null,
          asaas_sub_id: null,
        })
        .eq("id", prestador_id);

      if (error) throw error;

      // Registrar evento
      await supabase.from("pagamentos").insert({
        prestador_id,
        evento: "ADMIN_SUSPENDEU_CONTA",
        data_evento: new Date().toISOString(),
        payload: { motivo: motivo || "Ação administrativa", plano_anterior: prestador.plano },
      });

      return Response.json({
        ok: true,
        message: `Conta de ${prestador.nome} suspensa`,
      }, { headers: cors });
    }

    // ── ATIVAR CONTA (upgrade forçado para pro) ───────────────
    if (action === "ativar") {
      if (!prestador_id) {
        return Response.json({ error: "prestador_id obrigatório" }, { status: 400, headers: cors });
      }

      const validade = new Date();
      validade.setFullYear(validade.getFullYear() + 1); // 1 ano

      const { data: prestador, error: fetchErr } = await supabase
        .from("prestadores")
        .select("nome, email, plano")
        .eq("id", prestador_id)
        .single();

      if (fetchErr || !prestador) {
        return Response.json({ error: "Prestador não encontrado" }, { status: 404, headers: cors });
      }

      const { error } = await supabase
        .from("prestadores")
        .update({
          plano: "pro",
          plano_valido_ate: validade.toISOString(),
        })
        .eq("id", prestador_id);

      if (error) throw error;

      await supabase.from("pagamentos").insert({
        prestador_id,
        evento: "ADMIN_ATIVOU_CONTA",
        data_evento: new Date().toISOString(),
        payload: { motivo: motivo || "Ação administrativa", valido_ate: validade.toISOString() },
      });

      return Response.json({
        ok: true,
        message: `Conta de ${prestador.nome} ativada até ${validade.toLocaleDateString("pt-BR")}`,
      }, { headers: cors });
    }

    // ── ESTENDER PLANO ────────────────────────────────────────
    if (action === "estender_plano") {
      if (!prestador_id) {
        return Response.json({ error: "prestador_id obrigatório" }, { status: 400, headers: cors });
      }

      const dias = body.dias || 30;

      const { data: prestador, error: fetchErr } = await supabase
        .from("prestadores")
        .select("nome, plano_valido_ate")
        .eq("id", prestador_id)
        .single();

      if (fetchErr || !prestador) {
        return Response.json({ error: "Prestador não encontrado" }, { status: 404, headers: cors });
      }

      // Usa a data atual como base ou a data de validade existente
      const baseDate = prestador.plano_valido_ate && new Date(prestador.plano_valido_ate) > new Date()
        ? new Date(prestador.plano_valido_ate)
        : new Date();

      const novaValidade = new Date(baseDate);
      novaValidade.setDate(novaValidade.getDate() + dias);

      const { error } = await supabase
        .from("prestadores")
        .update({ plano_valido_ate: novaValidade.toISOString() })
        .eq("id", prestador_id);

      if (error) throw error;

      await supabase.from("pagamentos").insert({
        prestador_id,
        evento: "ADMIN_ESTENDEU_PLANO",
        data_evento: new Date().toISOString(),
        payload: { dias, nova_validade: novaValidade.toISOString(), motivo: motivo || "" },
      });

      return Response.json({
        ok: true,
        message: `Plano estendido até ${novaValidade.toLocaleDateString("pt-BR")} (+${dias} dias)`,
      }, { headers: cors });
    }

    // ── DETALHES DO PRESTADOR ────────────────────────────────
    if (action === "detalhes") {
      if (!prestador_id) {
        return Response.json({ error: "prestador_id obrigatório" }, { status: 400, headers: cors });
      }

      const { data: prestador, error } = await supabase
        .from("prestadores")
        .select("*")
        .eq("id", prestador_id)
        .single();

      if (error || !prestador) {
        return Response.json({ error: "Prestador não encontrado" }, { status: 404, headers: cors });
      }

      // Últimos pagamentos
      const { data: pagamentos } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("prestador_id", prestador_id)
        .order("data_evento", { ascending: false })
        .limit(10);

      return Response.json({
        prestador,
        pagamentos: pagamentos || [],
      }, { headers: cors });
    }

    return Response.json({ error: "Ação inválida" }, { status: 400, headers: cors });
  } catch (err) {
    console.error("admin-actions error:", err);
    return Response.json({
      error: "Erro interno",
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500, headers: cors });
  }
});
