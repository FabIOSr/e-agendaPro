// supabase/functions/_shared/cors.ts
//
// Módulo centralizado de configuração de CORS para todas as Edge Functions.
// Importado assim:
// import { corsHeaders, validateOrigin } from "../_shared/cors.ts";
//
// Origins permitidas via variável de ambiente OBRIGATÓRIA em produção:
// ALLOWED_ORIGINS=https://e-agendapro.web.app,https://agendapro.com.br
// ALLOWED_ORIGINS_DEV=http://localhost:3000,http://localhost:5173 (apenas dev)

const PRODUCTION_ORIGINS = [
  'https://e-agendapro.web.app',
  'https://agendapro.com.br',
  'https://www.agendapro.com.br',
];

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173',
];

function isProduction(): boolean {
  return Deno.env.get('SENTRY_ENVIRONMENT') === 'production';
}

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    return envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return PRODUCTION_ORIGINS;
}

function getAllowedDevOrigins(): string[] {
  const envDev = Deno.env.get('ALLOWED_ORIGINS_DEV');
  if (envDev) {
    return envDev.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return DEV_ORIGINS;
}

function getAllOrigins(): string[] {
  if (isProduction()) {
    const origins = getAllowedOrigins();
    if (origins.length === 0 || (origins.length === PRODUCTION_ORIGINS.length && !Deno.env.get('ALLOWED_ORIGINS'))) {
      console.warn('⚠️ ALLOWED_ORIGINS não configurado em produção. Usando origens permitidas do env.');
    }
    return origins;
  }
  return [...getAllowedOrigins(), ...getAllowedDevOrigins()];
}

export function corsHeaders(reqOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (!reqOrigin) {
    headers['Access-Control-Allow-Origin'] = '*';
    return headers;
  }

  const allowed = getAllOrigins().some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace('.', '\\.').replace('*', '[^.]+') + '$');
      return regex.test(reqOrigin);
    }
    return pattern === reqOrigin;
  });

  if (allowed) {
    headers['Access-Control-Allow-Origin'] = reqOrigin;
  }

  return headers;
}

export function validateOrigin(reqOrigin: string | null): boolean {
  if (!reqOrigin) return true;
  return getAllOrigins().some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace('.', '\\.').replace('*', '[^.]+') + '$');
      return regex.test(reqOrigin);
    }
    return pattern === reqOrigin;
  });
}

export function handleCorsPreflight(reqOrigin: string | null): Response | null {
  const headers = corsHeaders(reqOrigin);
  return new Response(null, { status: 204, headers });
}