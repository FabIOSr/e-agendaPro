import { defineConfig, normalizePath } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { readdirSync, statSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

const __dirname = import.meta.dirname;

// Carrega variáveis do .env.local
if (existsSync(resolve(__dirname, '.env.local'))) {
  dotenv.config({ path: resolve(__dirname, '.env.local') });
}

/**
 * Função para processar tags <include src="..."></include>
 */
function processIncludes(content) {
  const includeRegex = /<include\s+src="([^"]+)"(?:\s+([^>]*))?><\/include>/g;
  return content.replace(includeRegex, (match, src, attrs) => {
    const filePath = resolve(__dirname, 'src', src);
    if (existsSync(filePath)) {
      let includeContent = readFileSync(filePath, 'utf-8');
      
      // Suporte para variáveis: replace {{key}} com valor do atributo key="..."
      if (attrs) {
        const attrRegex = /(\w+)="([^"]+)"/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrs)) !== null) {
          const [_, key, value] = attrMatch;
          includeContent = includeContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
      }
      
      // Recursividade: permite includes dentro de includes
      return processIncludes(includeContent);
    }
    console.error(`   ❌ Arquivo de include não encontrado: ${filePath}`);
    return `<!-- Erro: ${src} não encontrado -->`;
  });
}

/**
 * Plugin: copia HTMLs de pages/ e config.js para dist/
 * Injeta assets e processa includes
 */
function copyAndInjectHtml() {
  let config = {};
  let assets = [];

  return {
    name: 'vite-plugin-copy-html',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    // Suporte para dev server
    transformIndexHtml(html) {
      return processIncludes(html);
    },

    closeBundle() {
      const outDir = config.build.outDir;
      const srcPages = resolve(__dirname, 'pages');

      // Descobre assets gerados
      const manifestPath = resolve(outDir, '.vite/manifest.json');
      let manifest = {};
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      } catch {
        const assetsDir = resolve(outDir, 'assets');
        if (existsSync(assetsDir)) {
          for (const f of readdirSync(assetsDir)) {
            assets.push(`assets/${f}`);
          }
        }
      }

      if (manifest['src/app.js']) {
        const jsFile = manifest['src/app.js'].file;
        if (jsFile && !assets.includes(jsFile)) assets.push(jsFile);
      }
      if (manifest['src/style.css']) {
        const cssFile = manifest['src/style.css'].file;
        if (cssFile && !assets.includes(cssFile)) assets.push(cssFile);
      }

      // Copia config.js com variáveis
      let configContent = readFileSync(resolve(__dirname, 'config.js'), 'utf-8');
      const env = {
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_ANON: process.env.SUPABASE_ANON || '',
        APP_URL: process.env.APP_URL || '',
        SENTRY_DSN: process.env.SENTRY_DSN || '',
        SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || 'production',
        VERSION: process.env.npm_package_version || '1.0.0',
      };

      configContent = configContent
        .replace('__SUPABASE_URL__', env.SUPABASE_URL)
        .replace('__SUPABASE_ANON__', env.SUPABASE_ANON)
        .replace('__APP_URL__', env.APP_URL)
        .replace('__SENTRY_DSN__', env.SENTRY_DSN)
        .replace('__SENTRY_ENVIRONMENT__', env.SENTRY_ENVIRONMENT)
        .replace('__VERSION__', env.VERSION);

      writeFileSync(resolve(outDir, 'config.js'), configContent, 'utf-8');

      // Copia e processa páginas HTML
      function copyPages(dir, relPath = '') {
        const destDir = resolve(outDir, 'pages', relPath);
        mkdirSync(destDir, { recursive: true });

        for (const file of readdirSync(dir)) {
          const src = resolve(dir, file);
          const entry = statSync(src);
          if (entry.isDirectory()) {
            copyPages(src, `${relPath}${file}/`);
          } else if (file.endsWith('.html')) {
            let content = readFileSync(src, 'utf-8');
            content = processIncludes(content); // Injeção de componentes

            const assetTags = assets
              .map((a) => {
                if (a.endsWith('.css')) return `<link rel="stylesheet" href="/${a}">`;
                if (a.endsWith('.js')) return `<script type="module" src="/${a}"></script>`;
                return '';
              })
              .filter(Boolean)
              .join('\n');

            if (assetTags) {
              content = content.replace('</head>', `${assetTags}\n</head>`);
            }

            writeFileSync(resolve(destDir, file), content, 'utf-8');
          }
        }
      }

      copyPages(srcPages);
      console.log(`   ✅ Build finalizado com sucesso com suporte a componentes.`);

      // Copia modules/
      const srcModules = resolve(__dirname, 'modules');
      const destModules = resolve(outDir, 'modules');
      function copyDir(src, dest) {
        mkdirSync(dest, { recursive: true });
        for (const file of readdirSync(src)) {
          const s = resolve(src, file);
          const d = resolve(dest, file);
          if (statSync(s).isDirectory()) {
            copyDir(s, d);
          } else {
            copyFileSync(s, d);
          }
        }
      }
      if (existsSync(srcModules)) copyDir(srcModules, destModules);
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), copyAndInjectHtml()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'src/app.js'),
        style: resolve(__dirname, 'src/style.css'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: { port: 3000 },
  resolve: {
    alias: {
      '@pages': resolve(__dirname, 'pages'),
      '@modules': resolve(__dirname, 'modules'),
      '@config': resolve(__dirname, 'config.js'),
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_ANON': JSON.stringify(process.env.SUPABASE_ANON || ''),
    'import.meta.env.VITE_APP_URL': JSON.stringify(process.env.APP_URL || ''),
    'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || ''),
    'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(process.env.SENTRY_ENVIRONMENT || 'development'),
    'import.meta.env.VITE_VERSION': JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
});