#!/usr/bin/env node
// setup.js — Configuração inicial do AgendaPro
// Executa UMA VEZ antes do primeiro deploy.
//
// Uso:
//   node setup.js
//
// O script vai perguntar suas credenciais e substituir em todos os arquivos.

const fs   = require('fs');
const path = require('path');
const rl   = require('readline').createInterface({
  input:  process.stdin,
  output: process.stdout,
});

const pergunta = (q) => new Promise(r => rl.question(q, r));

const AMARELO = '\x1b[33m';
const VERDE   = '\x1b[32m';
const RESET   = '\x1b[0m';
const NEGRITO = '\x1b[1m';

async function main() {
  console.log(`\n${NEGRITO}╔══════════════════════════════════════╗`);
  console.log(`║     AgendaPro — Setup inicial        ║`);
  console.log(`╚══════════════════════════════════════╝${RESET}\n`);

  console.log('Este script substitui as variáveis de ambiente em todos os arquivos.\n');
  console.log(`${AMARELO}Onde encontrar cada valor:${RESET}`);
  console.log('  SUPABASE_URL   → Supabase Dashboard → Settings → API → Project URL');
  console.log('  ANON_KEY       → Supabase Dashboard → Settings → API → anon public');
  console.log('  APP_URL        → URL do seu app (ex: https://agendapro.com.br)\n');

  const supabaseUrl  = await pergunta('SUPABASE_URL (ex: https://xyzabc.supabase.co): ');
  const anonKey      = await pergunta('ANON_KEY (começa com eyJ...): ');
  const appUrl       = await pergunta('APP_URL (ex: https://agendapro.com.br): ');

  rl.close();

  if (!supabaseUrl.startsWith('https://') || !anonKey.startsWith('eyJ')) {
    console.error('\n❌ Valores inválidos. Verifique e tente novamente.\n');
    process.exit(1);
  }

  const substituicoes = [
    ['https://kevqgxmcoxmzbypdjhru.supabase.co', supabaseUrl.trim()],
    ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnFneG1jb3htemJ5cGRqaHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzc3NTgsImV4cCI6MjA4OTcxMzc1OH0.N6szx9ryreGph4DDLoFYhiHecOJg2G80xVnmoH6PkQg',                    anonKey.trim()],
    ['https://e-agendapro.web.app/',              (appUrl || 'https://agendapro.com.br').trim()],
    ['https://kevqgxmcoxmzbypdjhru.supabase.co',         supabaseUrl.trim().replace('https://', '')],
  ];

  // Arquivos a processar
  const pastas = ['pages', 'modules'];
  let total = 0;

  for (const pasta of pastas) {
    const dir = path.join(__dirname, pasta);
    if (!fs.existsSync(dir)) continue;
    const arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.html') || f.endsWith('.js'));
    for (const arquivo of arquivos) {
      const caminho = path.join(dir, arquivo);
      let conteudo  = fs.readFileSync(caminho, 'utf8');
      let alterado  = false;
      for (const [de, para] of substituicoes) {
        if (conteudo.includes(de)) {
          conteudo = conteudo.split(de).join(para);
          alterado = true;
        }
      }
      if (alterado) {
        fs.writeFileSync(caminho, conteudo, 'utf8');
        console.log(`  ${VERDE}✓${RESET} ${pasta}/${arquivo}`);
        total++;
      }
    }
  }

  console.log(`\n${VERDE}${NEGRITO}✓ ${total} arquivo(s) atualizado(s).${RESET}\n`);
  console.log('Próximo passo:');
  console.log(`  ${AMARELO}firebase deploy --only hosting${RESET}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
