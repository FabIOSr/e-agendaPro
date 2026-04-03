import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const BUILD_PATHS = [
  'config.js',
  'modules',
  'pages',
];

function copyRecursive(srcPath, destPath) {
  const stat = fs.statSync(srcPath);

  if (stat.isDirectory()) {
    fs.mkdirSync(destPath, { recursive: true });
    for (const entry of fs.readdirSync(srcPath, { withFileTypes: true })) {
      copyRecursive(path.join(srcPath, entry.name), path.join(destPath, entry.name));
    }
    return;
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
}

dotenv.config({ path: path.join(__dirname, '.env.local') });

const env = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON: process.env.SUPABASE_ANON || '',
  APP_URL: process.env.APP_URL || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || 'production',
  VERSION: process.env.npm_package_version || '1.0.0',
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

fs.rmSync(DIST_DIR, { recursive: true, force: true });
for (const relativePath of BUILD_PATHS) {
  copyRecursive(path.join(__dirname, relativePath), path.join(DIST_DIR, relativePath));
}
console.log('   ✅ dist/ gerado com allowlist');

const distConfigPath = path.join(DIST_DIR, 'config.js');
let configContent = fs.readFileSync(distConfigPath, 'utf8');

configContent = configContent
  .replace('__SUPABASE_URL__', env.SUPABASE_URL)
  .replace('__SUPABASE_ANON__', env.SUPABASE_ANON)
  .replace('__APP_URL__', env.APP_URL)
  .replace('__SENTRY_DSN__', env.SENTRY_DSN)
  .replace('__SENTRY_ENVIRONMENT__', env.SENTRY_ENVIRONMENT)
  .replace('__VERSION__', env.VERSION);

fs.writeFileSync(distConfigPath, configContent);
console.log('   ✅ dist/config.js');

console.log('🎉 Build completo!');
console.log('');
console.log('📝 Próximos passos:');
console.log('   1. Deploy: firebase deploy --only hosting');
console.log('   2. Configure as Edge Functions secrets no Supabase');
