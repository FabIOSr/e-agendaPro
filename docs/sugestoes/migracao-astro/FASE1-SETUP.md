# 🔧 FASE 1: Setup Inicial - Astro

> Configuração do ambiente para Astro Framework

---

## 📋 Objetivos da Fase

1. Instalar Astro CLI
2. Configurar Tailwind CSS
3. Configurar TypeScript
4. Configurar Firebase Adapter
5. Validar configuração inicial

**Duração estimada:** 1 dia (8 horas)

---

## 🚀 Passo 1: Instalar Astro

### 1.1 Criar projeto Astro

```bash
# Navegar ao diretório
cd Desktop/agendapro

# Criar projeto na raiz (ou em subdiretório)
npm create astro@latest . -- --template minimal --install --no-git --typescript strict
```

### 1.2 Responder prompts

```
? How would you like to start your new project? 
→ Empty

? Install dependencies?
→ Yes

? Initialize a new git repository?
→ No (já temos um)

? TypeScript configuration?
→ Strict
```

### 1.3 Verificar estrutura criada

```
agendapro/
├── src/
│   └── pages/
│       └── index.astro
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

---

## ⚙️ Passo 2: Configurar Tailwind CSS

### 2.1 Instalar integração Tailwind

```bash
npm install @astrojs/tailwind tailwindcss
```

### 2.2 Configurar astro.config.mjs

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import alpine from '@astrojs/alpinejs';

export default defineConfig({
  integrations: [
    tailwind({
      // Gera CSS em arquivo separado
      applyBaseStyles: false,
    }),
    alpine(),
  ],
  output: 'static', // ou 'server' se precisar SSR
  build: {
    format: 'file',
  },
  server: {
    port: 3000,
  },
});
```

### 2.3 Configurar tailwind.config.mjs

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0e0d0a',
          2: '#181714',
          3: '#222018',
        },
        border: {
          DEFAULT: '#2e2b24',
          2: '#3e3b32',
        },
        text: {
          DEFAULT: '#f0ede6',
          muted: '#8a8778',
          faint: '#4a4840',
        },
        lime: {
          DEFAULT: '#c8f060',
          dark: '#8ab830',
          light: '#1a2a08',
        },
        rust: {
          DEFAULT: '#f06048',
        },
      },
      fontFamily: {
        sans: ['Syne', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

---

## 🔷 Passo 3: Configurar TypeScript

### 3.1 Verificar tsconfig.json

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/layouts/*": ["src/layouts/*"],
      "@/types/*": ["src/types/*"]
    }
  }
}
```

### 3.2 Criar tipos base

Criar `src/types/index.ts`:

```typescript
export interface Prestador {
  id: string;
  nome: string;
  slug: string;
  email: string;
  plano: 'free' | 'pro';
  foto_url?: string;
}

export interface Servico {
  id: string;
  nome: string;
  duracao_min: number;
  preco?: number;
}

export interface Agendamento {
  id: string;
  servico_id: string;
  data_hora: string;
  cliente_nome: string;
  cliente_tel: string;
  status: 'confirmado' | 'concluido' | 'cancelado';
}
```

---

## 🔥 Passo 4: Configurar Firebase

### 4.1 Instalar adapter

```bash
npm install @astrojs/firebase
```

### 4.2 Atualizar astro.config.mjs

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import alpine from '@astrojs/alpinejs';
import firebase from '@astrojs/firebase';

export default defineConfig({
  integrations: [
    tailwind({ applyBaseStyles: false }),
    alpine(),
    firebase({
      config: {
        apiKey: import.meta.env.FIREBASE_API_KEY,
        authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.FIREBASE_APP_ID,
      },
    }),
  ],
});
```

### 4.3 Adicionar ao .env.local

```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
```

---

## ✅ Passo 5: Validar Configuração

### 5.1 Criar página de teste

```astro
---
// src/pages/test.astro
---
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teste Tailwind</title>
</head>
<body class="min-h-screen bg-bg flex items-center justify-center">
  <div class="max-w-md w-full p-6 bg-bg-2 rounded-lg border border-border">
    <h1 class="text-2xl font-bold text-text mb-4">Teste Astro + Tailwind</h1>
    <p class="text-text-muted mb-4">Se estilizado, funcionando!</p>
    <button class="px-4 py-2 bg-lime text-bg font-semibold rounded-lg hover:bg-lime-dark transition">
      Botão Teste
    </button>
  </div>
</body>
</html>
```

### 5.2 Testar desenvolvimento

```bash
npm run dev
```

Acessar http://localhost:3000/test

### 5.3 Testar build

```bash
npm run build
```

Verificar em `dist/`

---

## 📝 Checklist de Validação

- [ ] Astro CLI instalado
- [ ] `astro.config.mjs` configurado
- [ ] `tailwind.config.mjs` com cores do AgendaPro
- [ ] TypeScript configurado
- [ ] Firebase adapter instalado
- [ ] Página teste funcionando
- [ ] Build funcionando sem erros

---

## 🚨 Solução de Problemas

### Erro: Adapter não encontrado

```bash
# Verificar versão do Node
node --version  # Deve ser 18+

# Limpar e reinstalar
rm -rf node_modules
npm install
```

### Erro: Tailwind não compila

```bash
# Verificar conteúdo do tailwind.config.mjs
# Confirmar que não há erros de sintaxe

# Recriar config
npx tailwindcss init -p
```

---

## 📚 Próximos Passos

Após completar esta fase:

1. **FASE 2:** Criar layouts e migrar páginas
2. Começar pela landing page
3. Configurar islands para interatividade

---

**Tempo estimado:** 8 horas
**Dificuldade:** Média

**Finalizado em:** ___/___/___
**Por:** ____________
