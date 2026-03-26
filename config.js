// config.js — Configurações do AgendaPro
// As variáveis são injetadas pelo processo de build (build.js)

(function() {
  const CONFIG_DEFAULTS = {
    SUPABASE_URL: 'https://kevqgxmcoxmzbypdjhru.supabase.co',
    SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzc3NTgsImV4cCI6MjA4OTcxMzc1OH0.N6szx9ryreGph4DDLoFYhiHecOJg2G80xVnmoH6PkQg',
    APP_URL: 'https://e-agendapro.web.app'
  };

  const config = window.AGENDAPRO_CONFIG || CONFIG_DEFAULTS;

  // Valida se as variáveis foram configuradas
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON || !config.APP_URL) {
    throw new Error('❌ Configuração incompleta. Execute: npm run build');
  }

  window.SUPABASE_URL = config.SUPABASE_URL;
  window.SUPABASE_ANON = config.SUPABASE_ANON;
  window.APP_URL = config.APP_URL;
  window.ENV = config;
})();
