// supabase/functions/_shared/cors.ts
//
// Módulo centralizado de configuração de CORS para todas as Edge Functions.
// Importado assim:
//   import { corsHeaders, validateOrigin } from "../_shared/cors.ts";
//
// Origins permitidas via variável de ambiente (opcional, fallback para hardcode):
//   ALLOWED_ORIGINS=https://e-agendapro.web.app,https://agendapro.com.br
//   ALLOWED_ORIGINS_DEV=http://localhost:3000,http://localhost:5173

const HARDCODED_ORIGINS = [
  "https://e-agendapro.web.app",
  "https://agendapro.com.br",
  "https://www.agendapro.com.br",
  // Dev origins (sempre permitidos — desabilitar em produção se necessário via env ALLOWED_ORIGINS)
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5173",
];

function getAllowedOrigins(): string[] {
  // Override via variável de ambiente
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return HARDCODED_ORIGINS;
}

function getAllowedDevOrigins(): string[] {
  const envDev = Deno.env.get("ALLOWED_ORIGINS_DEV");
  if (envDev) {
    return envDev.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000","http://127.0.0.1:5000", "http://127.0.0.1:5173"];
}

function getAllOrigins(): string[] {
  const isProd = Deno.env.get("SENTRY_ENVIRONMENT") === "production";
  if (isProd) return getAllowedOrigins();
  return [...getAllowedOrigins(), ...getAllowedDevOrigins()];
}

/**
 * Retorna os headers CORS para uma requisição.
 */
export function corsHeaders(reqOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token, x-admin-token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (!reqOrigin) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  const allowed = getAllOrigins().some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(".", "\\.").replace("*", "[^.]+") + "$");
      return regex.test(reqOrigin);
    }
    return pattern === reqOrigin;
  });

  if (allowed) {
    headers["Access-Control-Allow-Origin"] = reqOrigin;
  }

  return headers;
}

/**
 * Valida a origem de uma requisição.
 */
export function validateOrigin(reqOrigin: string | null): boolean {
  if (!reqOrigin) return true;
  return getAllOrigins().some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(".", "\\.").replace("*", "[^.]+") + "$");
      return regex.test(reqOrigin);
    }
    return pattern === reqOrigin;
  });
}

/**
 * Handler de preflight CORS (OPTIONS).
 */
export function handleCorsPreflight(reqOrigin: string | null): Response | null {
  const headers = corsHeaders(reqOrigin);
  return new Response(null, { status: 204, headers });
}
