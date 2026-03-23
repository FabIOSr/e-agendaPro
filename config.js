// config.js — credenciais centralizadas do AgendaPro
// Variáveis de ambiente injetadas pelo Firebase Hosting

const AGENDAPRO_CONFIG = {
  SUPABASE_URL:  window.ENV_SUPABASE_URL  || 'https://kevqgxmcoxmzbypdjhru.supabase.co',
  SUPABASE_ANON: window.ENV_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzc3NTgsImV4cCI6MjA4OTcxMzc1OH0.N6szx9ryreGph4DDLoFYhiHecOJg2G80xVnmoH6PkQg',
  APP_URL:       window.ENV_APP_URL       || 'https://e-agendapro.web.app',
};

window.SUPABASE_URL  = AGENDAPRO_CONFIG.SUPABASE_URL;
window.SUPABASE_ANON = AGENDAPRO_CONFIG.SUPABASE_ANON;
window.APP_URL       = AGENDAPRO_CONFIG.APP_URL;
