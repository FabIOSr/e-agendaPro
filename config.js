// config.js — Configurações do AgendaPro
// As variáveis são injetadas pelo processo de build (build.js)
// Placeholders: __VAR__ são substituídos no build

(function() {
  const CONFIG_DEFAULTS = {
    SUPABASE_URL: '__SUPABASE_URL__',
    SUPABASE_ANON: '__SUPABASE_ANON__',
    APP_URL: '__APP_URL__',
    SENTRY_DSN: '__SENTRY_DSN__',
    SENTRY_ENVIRONMENT: '__SENTRY_ENVIRONMENT__',
    VERSION: '__VERSION__'
  };

  const config = window.AGENDAPRO_CONFIG || CONFIG_DEFAULTS;

  // Valida se as variáveis foram configuradas
  if (
    !config.SUPABASE_URL || config.SUPABASE_URL === '__SUPABASE_URL__' ||
    !config.SUPABASE_ANON || config.SUPABASE_ANON === '__SUPABASE_ANON__' ||
    !config.APP_URL || config.APP_URL === '__APP_URL__'
  ) {
    throw new Error('❌ Configuração incompleta. Execute: npm run build');
  }

  window.SUPABASE_URL = config.SUPABASE_URL;
  window.SUPABASE_ANON = config.SUPABASE_ANON;
  window.APP_URL = config.APP_URL;
  window.SENTRY_DSN = config.SENTRY_DSN;
  window.SENTRY_ENVIRONMENT = config.SENTRY_ENVIRONMENT;
  window.ENV = config;
})();
