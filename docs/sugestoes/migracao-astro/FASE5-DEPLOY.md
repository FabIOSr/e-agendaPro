# 🚀 FASE 5: Deploy e Otimização

> Configurar deploy para Firebase Hosting e otimizar performance

---

## 📋 Objetivos da Fase

1. Configurar Firebase Hosting para Astro
2. Otimizar SEO e meta tags
3. Melhorar Lighthouse scores
4. Testes finais e deploy

**Duração estimada:** 5-10 dias (Semanas 7-8)

---

## 🔥 Passo 1: Configurar Firebase

### 1.1 Instalar Firebase Tools

```bash
npm install -g firebase-tools
```

### 1.2 Login no Firebase

```bash
firebase login
```

### 1.3 Inicializar Firebase no projeto

```bash
firebase init hosting
```

**Responder prompts:**
```
? What do you want to use as your public directory?
→ dist

? Configure as a single-page app?
→ No

? Set up automatic builds and deploys with GitHub?
→ Yes/No (escolher)
```

### 1.4 Configurar firebase.json

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      }
    ],
    "headers": [
      {
        "source": "/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=0, must-revalidate"
          }
        ]
      },
      {
        "source": "/assets/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

---

## ⚙️ Passo 2: Configurar Build

### 2.1 Atualizar package.json

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "deploy": "npm run build && firebase deploy --only hosting",
    "deploy:all": "npm run build && firebase deploy"
  }
}
```

### 2.2 Configurar astro.config.mjs para Firebase

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import alpine from '@astrojs/alpinejs';

export default defineConfig({
  integrations: [
    tailwind({ applyBaseStyles: false }),
    alpine(),
  ],
  output: 'static',
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
```

---

## 🔍 Passo 3: Otimizar SEO

### 3.1 Componente Meta Tags

```astro
---
// src/components/seo/MetaTags.astro
interface Props {
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
}

const { 
  title, 
  description = 'AgendaPro - Seu link de agendamento',
  image = '/og-image.png',
  type = 'website'
} = Astro.props;

const canonicalURL = new URL(Astro.url.pathname, Astro.site);
---

<!-- Primary Meta Tags -->
<title>{title}</title>
<meta name="title" content={title} />
<meta name="description" content={description} />

<!-- Open Graph / Facebook -->
<meta property="og:type" content={type} />
<meta property="og:url" content={canonicalURL} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={image} />

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:url" content={canonicalURL} />
<meta property="twitter:title" content={title} />
<meta property="twitter:description" content={description} />
<meta property="twitter:image" content={image} />

<!-- Canonical -->
<link rel="canonical" href={canonicalURL} />
```

### 3.2 Usar em layouts

```astro
---
// src/layouts/LayoutBase.astro
import MetaTags from '../components/seo/MetaTags.astro';

interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
---

<html lang="pt-BR">
<head>
  <MetaTags title={title} description={description} />
  <!-- ...outros head elements -->
</head>
<body>
  <slot />
</body>
</html>
```

### 3.3itemap.xml

```astro
---
// src/pages/sitemap.xml.js
export async function GET() {
  const pages = [
    { url: '/', priority: 1.0 },
    { url: '/planos', priority: 0.8 },
    { url: '/auth', priority: 0.7 },
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages.map(page => `
    <url>
      <loc>https://agendapro.com${page.url}</loc>
      <priority>${page.priority}</priority>
      <changefreq>${page.priority === 1.0 ? 'daily' : 'weekly'}</changefreq>
    </url>
  `).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
```

---

## 📊 Passo 4: Otimizar Performance

### 4.1 Image Optimization

```astro
---
// src/components/ui/OptimizedImage.astro
interface Props {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
}

const { src, alt, width, height, loading = 'lazy' } = Astro.props;
---

<img 
  src={src} 
  alt={alt}
  width={width}
  height={height}
  loading={loading}
  decoding="async"
  class="object-cover"
/>
```

### 4.2 Font Optimization

```html
<!-- No head, adicionar preconnect -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500&family=Syne:wght@400;500;600;700&display=swap">
```

### 4.3 Lazy Loading Islands

```astro
<!-- Only load when visible -->
<HeavyComponent client:visible />

<!-- Load when CPU idle -->
<ToastComponent client:idle />

<!-- Don't load on server, only client -->
<AnalyticsComponent client:only="alpinejs" />
```

---

## 🚀 Passo 5: Deploy

### 5.1 Deploy para Staging

```bash
# Criar ambiente staging no Firebase
firebase hosting:channel:create staging

# Deploy para staging
firebase deploy --only hosting --channel staging
```

### 5.2 Deploy para Produção

```bash
# Build de produção
npm run build

# Deploy
firebase deploy --only hosting

# URL final: https://seu-projeto.web.app
```

### 5.3 Rollback (se necessário)

```bash
# Ver releases anteriores
firebase hosting:channel:list

# Rollback para versão anterior
firebase hosting:channel:deploy production --version 3
```

---

## ✅ Passo 6: Validar Lighthouse

### 6.1 Targets

| Métrica | Target | Mínimo |
|---------|--------|--------|
| Performance | 95+ | 90 |
| Accessibility | 95+ | 90 |
| Best Practices | 95+ | 90 |
| SEO | 95+ | 90 |

### 6.2 Checklist de Otimização

- [ ] Imagens otimizadas (WebP, lazy load)
- [ ] Fonts preload
- [ ] CSS minificado
- [ ] JS bundle otimizado
- [ ] Meta tags em todas as páginas
- [ ] Sitemap.xml
- [ ] robots.txt
- [ ] Semantic HTML
- [ ] ARIA labels onde necessário

---

## 📋 Checklist Final

### Deploy

- [ ] Firebase Hosting configurado
- [ ] Build funcionando
- [ ] Deploy staging OK
- [ ] Deploy produção OK
- [ ] SSL ativado (automático no Firebase)

### SEO

- [ ] Meta tags em todas as páginas
- [ ] Sitemap.xml
- [ robots.txt
- [ ] Open Graph tags
- [ ] Twitter cards

### Performance

- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Lighthouse Best Practices ≥ 90
- [ ] Lighthouse SEO ≥ 90

### Funcionalidade

- [ ] Todas as páginas funcionando
- [ ] Formulários enviando dados
- [ ] Autenticação funcionando
- [ ] Wizard de agendamento OK
- [ ] Painel admin OK

---

## 📚 Documentação Final

Após deploy, atualizar:

- [ ] README.md com instruções de deploy
- [ ] DEPLOY.md com procedimento
- [ ] Documentar variáveis de ambiente

---

**Duração:** 5-10 dias
**Responsável:** ____________
**Início:** ___/___/___
**Fim:** ___/___/___
