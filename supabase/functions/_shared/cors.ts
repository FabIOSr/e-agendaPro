// supabase/functions/_shared/cors.ts
//
// Módulo centralizado de configuração de CORS para todas as Edge Functions.
// Importado assim:
//   import { corsHeaders, validateOrigin } from "../_shared/cors.ts";

const ALLOWED_ORIGINS = [
  "https://e-agendapro.web.app",
  "https://agendapro.com.br",
  "https://www.agendapro.com.br",
  //"http://localhost:3000",       // desenvolvimento local
  //"http://127.0.0.1:3000",
];

/**
 * Retorna os headers CORS para uma requisição.
 * Se a origem for permitida, retorna o header com ela.
 * Caso contrário, retorna headers sem Allow-Origin (bloqueia).
 */
export function corsHeaders(reqOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token, x-admin-token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  // Se não há origem (request server-side ou curl), permite
  if (!reqOrigin) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  // Verifica se a origem está na lista de permitidas
  const allowed = ALLOWED_ORIGINS.some((pattern) => {
    // Suporte a wildcard: "https://*.agendapro.com.br"
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
 * Retorna true se a origem é permitida ou se não há origem (server-side).
 */
export function validateOrigin(reqOrigin: string | null): boolean {
  if (!reqOrigin) return true; // server-side, curl, etc.
  return ALLOWED_ORIGINS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(".", "\\.").replace("*", "[^.]+") + "$");
      return regex.test(reqOrigin);
    }
    return pattern === reqOrigin;
  });
}

/**
 * Handler de preflight CORS (OPTIONS).
 * Retorna 204 com headers apropriados.
 */
export function handleCorsPreflight(reqOrigin: string | null): Response | null {
  const headers = corsHeaders(reqOrigin);
  return new Response(null, { status: 204, headers });
}
