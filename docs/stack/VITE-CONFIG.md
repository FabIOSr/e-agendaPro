# Configuração do Vite — AgendaPro

> **Versão:** Vite 6.x
> **Objetivo:** Build step leve para minificação, tree-shaking e Tailwind com purge

---

## 1. Instalação

```bash
npm install -D vite @tailwindcss/vite tailwindcss postcss
npm install alpinejs
```

---

## 2. `vite.config.js`

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });

// Descobrir todos os HTML files em pages/
function getHtmlInputs() {
  const pagesDir = resolve(__dirname, 'pages');
  const entries = {};

  function scanDir(dir) {
    const entries_list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries_list) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.html')) {
        // Chave = caminho relativo sem extensão
        const key = resolve(fullPath)
          .replace(pagesDir + '/', '')
          .replace('.html', '');
        entries[key] = fullPath;
      }
    }
  }

  scanDir(pagesDir);
  return entries;
}

// Config.js como entry
const entries = {
  ...getHtmlInputs(),
  'config': resolve(__dirname, 'config.js'),
};

// Módulos como entry (para tree-shaking)
const modulesDir = resolve(__dirname, 'modules');
if (fs.existsSync(modulesDir)) {
  const moduleFiles = fs.readdirSync(modulesDir)
    .filter(f => f.endsWith('.js') || f.endsWith('.ts'))
    .filter(f => !f.endsWith('.test.js'));

  for (const file of moduleFiles) {
    const key = 'modules/' + file.replace(/\.(js|ts)$/, '');
    entries[key] = resolve(modulesDir, file);
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: entries,
      output: {
        // Manter estrutura de diretórios no output
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    minify: 'esbuild',
    sourcemap: process.env.SENTRY_ENVIRONMENT !== 'production',
    target: 'es2020',
  },

  // Variáveis de ambiente injetadas no build
  define: {
    __SUPABASE_URL__: JSON.stringify(process.env.SUPABASE_URL || ''),
    __SUPABASE_ANON__: JSON.stringify(process.env.SUPABASE_ANON || ''),
    __APP_URL__: JSON.stringify(process.env.APP_URL || ''),
    __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN || ''),
    __SENTRY_ENVIRONMENT__: JSON.stringify(process.env.SENTRY_ENVIRONMENT || 'development'),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },

  server: {
    port: 3000,
    open: false,
    // Reescrever rotas como o firebase.json
    middlewareMode: false,
  },

  resolve: {
    alias: {
      '@modules': resolve(__dirname, 'modules'),
      '@pages': resolve(__dirname, 'pages'),
    },
  },
});
```

---

## 3. `package.json` — Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 3000",
    "test": "node tests/run-tests.js",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Mudança:** O `build.js` custom é substituído pelo `vite build`. O `dist/` gerado tem a mesma estrutura estática compatível com Firebase Hosting.

---

## 4. `firebase.json` — Sem Mudanças

O `firebase.json` continua apontando para `dist/` como `public`. O Vite gera exatamente o mesmo formato estático que o `build.js` gerava:

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      { "source": "/", "destination": "/pages/landing-page.html" },
      { "source": "/:slug", "destination": "/pages/pagina-cliente.html" }
    ]
  }
}
```

---

## 5. Migração do `build.js` — Comparação

| Funcionalidade | `build.js` (antes) | Vite (depois) |
|---|---|---|
| Copiar HTMLs | `fs.copyFileSync` | Plugin `copyAndInjectHtml` |
| Copiar `modules/` | `fs.copyFileSync` recursivo | Plugin `copyDir()` no `closeBundle` |
| Copiar `config.js` | Regex manual | `define` do Vite + substituição no plugin |
| Injetar assets nos HTMLs | ❌ Não fazia | ✅ Auto-injeta `<link>` e `<script>` |
| Minificação | ❌ Nenhuma | ✅ esbuild (JS + CSS) |
| Tree-shaking | ❌ Nenhum | ✅ Automático |
| Tailwind purge | ❌ Não existia | ✅ Via plugin `@tailwindcss/vite` |
| Dev server com HMR | ❌ Não tinha | ✅ Nativo |
| Source maps | ❌ Não tinha | ✅ Configurável |

### Cópia de `modules/` para `dist/modules/`

O plugin `copyAndInjectHtml` no `closeBundle` copia automaticamente o diretório `modules/` para `dist/modules/` após cada build. Isso garante que scripts como `sentry.js`, `auth-session.js`, etc. estejam disponíveis no path `/modules/sentry.js` sem erro 404.

```javascript
// Copia modules/ para dist/modules/
const srcModules = resolve(__dirname, 'modules');
const destModules = resolve(outDir, 'modules');
copyDir(srcModules, destModules);
```

---

## 6. Injeção de Variáveis

### No `config.js` (mantém compatibilidade)

O `config.js` atual usa placeholders `__VAR__`. Com Vite, usamos `import.meta.env`:

```javascript
// config.js — versão Vite
const config = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || __SUPABASE_URL__,
  SUPABASE_ANON: import.meta.env.VITE_SUPABASE_ANON || __SUPABASE_ANON__,
  APP_URL: import.meta.env.VITE_APP_URL || __APP_URL__,
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || __SENTRY_DSN__,
  SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT || __SENTRY_ENVIRONMENT__,
  VERSION: import.meta.env.VITE_VERSION || __VERSION__,
};

// Exportar para window (compatibilidade com código existente)
window.SUPABASE_URL = config.SUPABASE_URL;
window.SUPABASE_ANON = config.SUPABASE_ANON;
window.APP_URL = config.APP_URL;
window.SENTRY_DSN = config.SENTRY_DSN;
window.SENTRY_ENVIRONMENT = config.SENTRY_ENVIRONMENT;
window.ENV = config;
```

### `.env.local` (mesmo formato)

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON=eyJ...
APP_URL=https://e-agendapro.web.app
SENTRY_DSN=https://xxx@sentry.io/123
SENTRY_ENVIRONMENT=production
```

---

## 7. HTML Pages — Como Funciona

O Vite processa HTML files como entry points. Cada `.html` em `pages/` vira uma página independente no `dist/`:

```
pages/
├── landing-page.html     → dist/pages/landing-page.html
├── auth.html             → dist/auth.html
├── painel.html           → dist/painel.html
├── admin/
│   ├── login.html        → dist/pages/admin/login.html
│   └── dashboard.html    → dist/pages/admin/dashboard.html
└── pagina-cliente.html   → dist/pages/pagina-cliente.html
```

**Scripts nos HTML files** — Os `<script src="...">` são resolvidos pelo Vite automaticamente:

```html
<!-- Antes: caminho relativo -->
<script src="/modules/auth-session.js"></script>

<!-- Com Vite: mesma coisa, mas com tree-shaking -->
<script type="module" src="/modules/auth-session.js"></script>
```

**Nota:** Adicionar `type="module"` nos scripts permite imports ES modules. Durante a migração, scripts sem `type="module"` continuam funcionando (IIFE).

---

## 8. Dev Server

```bash
npm run dev
```

- **Porta:** 3000 (configurável em `vite.config.js`)
- **HMR:** Hot Module Replacement — mudanças em CSS/JS refletem instantaneamente
- **Rewrites:** O Vite não faz rewrites como o Firebase. Para testar rotas slug, acessar diretamente:
  - `http://localhost:3000/pages/pagina-cliente.html` (para testar página pública)
  - `http://localhost:3000/pages/painel.html` (para testar painel)

---

## 9. Build para Produção

```bash
npm run build
```

Output:

```
dist/
├── pages/
│   ├── landing-page.html
│   ├── auth.html
│   ├── painel.html
│   └── ...
├── modules/
│   ├── auth-session-[hash].js
│   ├── scheduling-rules-[hash].js
│   └── ...
├── config-[hash].js
├── shared/
│   └── vendor-[hash].js       ← chunks compartilhados
└── assets/
    └── main-[hash].css        ← Tailwind purged
```

---

## 10. Deploy

Mesmo processo de sempre:

```bash
npm run build && firebase deploy --only hosting
```

O `dist/` gerado pelo Vite é 100% estático — Firebase Hosting não precisa de nenhuma mudança.

---

## 11. Checklist de Setup

- [ ] `npm install -D vite @tailwindcss/vite tailwindcss postcss`
- [ ] `npm install alpinejs`
- [ ] Criar `modules/app.js` com `import Alpine from 'alpinejs'; Alpine.start()`
- [ ] Criar `vite.config.js` (copiar template acima)
- [ ] Adicionar scripts ao `package.json`
- [ ] Adicionar `type="module"` nos `<script>` dos HTML files
- [ ] Testar `npm run dev` — servidor sobe com HMR
- [ ] Testar `npm run build` — `dist/` gerado corretamente
- [ ] Testar `firebase deploy --only hosting` — deploy funciona
- [ ] Verificar que todos os 177 testes continuam passando
