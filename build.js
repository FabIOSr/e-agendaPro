// build.js — Script de build para injetar variáveis de ambiente
// Uso: node build.js
// 
// Este script:
// 1. Lê as variáveis do .env.local (ou .env)
// 2. Substitui os placeholders nos arquivos JS
// 3. Gera versão production-ready

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '.env.local') });

const env = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON: process.env.SUPABASE_ANON || '',
  APP_URL: process.env.APP_URL || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || 'production',
  VERSION: process.env.npm_package_version || '1.0.0'
};

if (!env.SUPABASE_URL || !env.SUPABASE_ANON || !env.APP_URL) {
  console.error('❌ Variáveis de ambiente faltando. Copie .env.example para .env.local');
  process.exit(1);
}

console.log('🔧 Build started...');
console.log(`   SUPABASE_URL: ${env.SUPABASE_URL}`);
console.log(`   APP_URL: ${env.APP_URL}`);
console.log(`   SENTRY_DSN: ${env.SENTRY_DSN ? 'configurado' : 'não configurado'}`);
console.log(`   SENTRY_ENVIRONMENT: ${env.SENTRY_ENVIRONMENT}`);

// ── Processa config.js ─────────────────────────────────────────────────────
let configContent = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
configContent = configContent
  .replace('__SUPABASE_URL__', env.SUPABASE_URL)
  .replace('__SUPABASE_ANON__', env.SUPABASE_ANON)
  .replace('__APP_URL__', env.APP_URL)
  .replace('__SENTRY_DSN__', env.SENTRY_DSN)
  .replace('__SENTRY_ENVIRONMENT__', env.SENTRY_ENVIRONMENT)
  .replace('__VERSION__', env.VERSION);

// Atualiza validação pós-build (valores não podem ser vazios)
configContent = configContent.replace(
  /if \(!config\.SUPABASE_URL \|\| config\.SUPABASE_URL === '__SUPABASE_URL__' \|\|\s*!config\.SUPABASE_ANON \|\| config\.SUPABASE_ANON === '__SUPABASE_ANON__' \|\|\s*!config\.APP_URL \|\| config\.APP_URL === '__APP_URL__'\)/,
  `if (!config.SUPABASE_URL || !config.SUPABASE_ANON || !config.APP_URL)`
);

fs.writeFileSync(path.join(__dirname, 'config.js'), configContent);
console.log('   ✅ config.js');

// ── Processa auth-session.js ───────────────────────────────────────────────
let authContent = fs.readFileSync(path.join(__dirname, 'modules/auth-session.js'), 'utf8');
authContent = authContent
  .replace("const SUPABASE_URL  = '__SUPABASE_URL__';", `const SUPABASE_URL  = '${env.SUPABASE_URL}';`)
  .replace("const SUPABASE_ANON = '__SUPABASE_ANON__';", `const SUPABASE_ANON = '${env.SUPABASE_ANON}';`);

fs.writeFileSync(path.join(__dirname, 'modules/auth-session.js'), authContent);
console.log('   ✅ modules/auth-session.js');

console.log('🎉 Build completo!');
console.log('');
console.log('📝 Próximos passos:');
console.log('   1. Deploy: firebase deploy --only hosting');
console.log('   2. Configure as Edge Functions secrets no Supabase');
