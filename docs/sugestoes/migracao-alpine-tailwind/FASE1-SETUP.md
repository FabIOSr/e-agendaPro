# 🔧 FASE 1: Setup Inicial

> Configuração do ambiente para Alpine.js + Tailwind + TypeScript

---

## 📋 Objetivos da Fase

1. Instalar e configurar Tailwind CSS
2. Instalar e configurar Alpine.js
3. Instalar e configurar TypeScript
4. Atualizar processo de build
5. Validar configuração

**Duração estimada:** 1 dia (8 horas)

---

## 🚀 Passo 1: Instalar Dependências

### 1.1 Navegar até o diretório do projeto

```bash
cd Desktop/agendapro
```

### 1.2 Instalar Tailwind CSS

```bash
npm install -D tailwindcss postcss autoprefixer
```

**O que cada pacote faz:**
- `tailwindcss` - Framework de CSS utility-first
- `postcss` - Processador de CSS (transforma @tailwind em CSS)
- `autoprefixer` - Adiciona vendor prefixes automaticamente

### 1.3 Instalar Alpine.js

```bash
npm install -D alpinejs
```

**Nota:** Alpine será carregado via CDN no HTML, mas instalamos para intellisense

### 1.4 Instalar TypeScript

```bash
npm install -D typescript @types/node
```

**O que cada pacote faz:**
- `typescript` - Compilador TypeScript
- `@types/node` - Tipos para Node.js

### 1.5 Verificar package.json

```bash
cat package.json
```

Deve conter em `devDependencies`:

```json
{
  "devDependencies": {
    "@playwright/test": "^1.59.1",
    "@types/node": "^20.0.0",
    "alpinejs": "^3.14.0",
    "autoprefixer": "^10.4.20",
    "dotenv": "^16.3.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.0"
  }
}
```

---

## ⚙️ Passo 2: Configurar Tailwind CSS

### 2.1 Inicializar Tailwind

```bash
npx tailwindcss init -p
```

Isso cria dois arquivos:
- `tailwind.config.js` - Configuração do Tailwind
- `postcss.config.js` - Configuração do PostCSS

### 2.2 Configurar tailwind.config.js

Substituir o conteúdo por:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './pages/**/*.html',
    './dist/**/*.html',
    './modules/**/*.js',
    './modules/**/*.ts',
  ],
  darkMode: 'class', // Ativar modo dark manual
  theme: {
    extend: {
      colors: {
        // Cores do AgendaPro - Tema Dark
        // Baseado no CSS original em pages/auth.html
        bg: {
          DEFAULT: '#0e0d0a',    // Fundo principal
          2: '#181714',          // Fundo secundário
          3: '#222018',          // Fundo terciário
        },
        border: {
          DEFAULT: '#2e2b24',    // Bordas principais
          2: '#3e3b32',          // Bordas secundárias
        },
        text: {
          DEFAULT: '#f0ede6',    // Texto principal (off-white)
          muted: '#8a8778',      // Texto secundário
          faint: '#4a4840',      // Texto desabilitado
        },
        lime: {
          DEFAULT: '#c8f060',    // COR PRIMÁRIA (verde lima)
          dark: '#8ab830',       // Verde lima escuro
          light: '#1a2a08',      // Verde lima muito escuro
          50: '#d4f57a',
          100: '#c8f060',
          200: '#8ab830',
          300: '#6a9628',
          400: '#4a7420',
          500: '#c8f060',
          600: '#8ab830',
          700: '#6a9628',
          800: '#4a7420',
          900: '#1a2a08',
        },
        rust: {
          DEFAULT: '#f06048',    // Alertas/erro (laranja ferrugem)
          light: '#f8806a',
          dark: '#c84a30',
        },

        // Aliases para manter familiaridade
        primary: {
          DEFAULT: '#c8f060',    // = lime
          50: '#d4f57a',
          100: '#c8f060',
          200: '#8ab830',
          300: '#6a9628',
          400: '#4a7420',
          500: '#c8f060',
          600: '#8ab830',
          700: '#6a9628',
          800: '#4a7420',
          900: '#1a2a08',
        },
        success: {
          DEFAULT: '#c8f060',    // Usa lime (verde do tema)
          dark: '#8ab830',
        },
        danger: {
          DEFAULT: '#f06048',    // Usa rust (cor de erro)
          dark: '#c84a30',
        },
        warning: {
          DEFAULT: '#e8a53c',    # Tom intermediário de rust
          500: '#e8a53c',
          600: '#f06048',
        },
      },
      fontFamily: {
        sans: ['Syne', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '14px',        // --radius do CSS original
        sm: '8px',
        md: '10px',
        lg: '14px',
        xl: '16px',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)`,
        'glow': 'radial-gradient(ellipse, rgba(200,240,96,.07) 0%, transparent 70%)',
      },
      backgroundSize: {
        '52': '52px',
      },
      boxShadow: {
        'lime': '0 0 12px rgba(200,240,96,.6)',
        'lime-soft': '0 0 20px rgba(200,240,96,.3)',
        'card': '0 8px 32px rgba(0,0,0,.3)',
      },
    },
  },
  plugins: [],
}
```

### 2.3 Configurar postcss.config.js

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### 2.4 Criar arquivo CSS de entrada

```bash
mkdir -p src/styles
```

Criar `src/styles/input.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Customizações globais */
@layer base {
  body {
    @apply font-sans text-gray-900 bg-gray-50;
  }

  h1, h2, h3, h4, h5, h6 {
    @apply font-bold text-gray-900;
  }

  a {
    @apply text-blue-600 hover:text-blue-700 transition-colors;
  }
}

/* Componentes reutilizáveis */
@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-semibold transition-all duration-200 inline-flex items-center justify-center gap-2;
  }

  .btn-primary {
    @apply bg-blue-600 text-white hover:bg-blue-700 active:scale-95;
  }

  .btn-secondary {
    @apply bg-gray-200 text-gray-800 hover:bg-gray-300;
  }

  .btn-danger {
    @apply bg-red-600 text-white hover:bg-red-700;
  }

  .btn-success {
    @apply bg-green-600 text-white hover:bg-green-700;
  }

  .btn-outline {
    @apply border-2 border-blue-600 text-blue-600 hover:bg-blue-50;
  }

  .input {
    @apply w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all;
  }

  .card {
    @apply bg-white rounded-lg shadow-md p-6;
  }

  .container-custom {
    @apply container mx-auto px-4 sm:px-6 lg:px-8;
  }
}

/* Utilitários customizados */
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

---

## 🔷 Passo 3: Configurar TypeScript

### 3.1 Criar tsconfig.json

```javascript
{
  "compilerOptions": {
    // Linguagem
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],

    // Módulos
    "module": "ES2022",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,

    // Type checking
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./",

    // Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": true,

    // JSX (se necessário no futuro)
    "jsx": "preserve",

    // Paths
    "baseUrl": ".",
    "paths": {
      "@/*": ["./modules/*"],
      "@/types/*": ["./modules/types/*"]
    }
  },
  "include": [
    "modules/**/*",
    "supabase/functions/**/*",
    "tests/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build",
    ".firebase"
  ]
}
```

### 3.2 Criar estrutura de tipos

```bash
mkdir -p modules/types
```

Criar `modules/types/index.ts`:

```typescript
// Tipos compartilhados entre frontend e backend

export interface Prestador {
  id: string;
  nome: string;
  slug: string;
  email: string;
  bio?: string;
  foto_url?: string;
  whatsapp?: string;
  plano: 'free' | 'pro';
  plano_valido_ate?: string;
  trial_usado: boolean;
  trial_ends_at?: string;
  intervalo_slot: number;
  asaas_customer_id?: string;
  asaas_sub_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Servico {
  id: string;
  prestador_id: string;
  nome: string;
  duracao_min: number;
  preco?: number;
  ativo: boolean;
  created_at: string;
}

export interface Agendamento {
  id: string;
  prestador_id: string;
  servico_id: string;
  data_hora: string;
  cliente_nome: string;
  cliente_tel: string;
  cliente_email?: string;
  status: 'confirmado' | 'concluido' | 'cancelado';
  cancel_token: string;
  google_event_id?: string;
  avaliacao_solicitada: boolean;
  created_at: string;
}

export interface Disponibilidade {
  id: string;
  prestador_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

export interface Bloqueio {
  id: string;
  prestador_id: string;
  inicio: string;
  fim: string;
  motivo?: string;
}

export interface Slot {
  hora: string;
  disponivel: boolean;
  motivo_bloqueio?: string;
}
```

---

## 🔨 Passo 4: Atualizar Build Process

### 4.1 Modificar package.json scripts

```json
{
  "scripts": {
    "build": "npm run build:css && npm run build:js && npm run build:ts",
    "build:css": "npx tailwindcss -i ./src/styles/input.css -o ./dist/styles/output.css --minify",
    "build:js": "node build.js",
    "build:ts": "tsc",
    "dev": "npm run build:css && node server.js",
    "dev:watch": "npm run build:css -- --watch",
    "serve": "node server.js",
    "test": "node tests/run-tests.js",
    "test:e2e": "playwright test",
    "type-check": "tsc --noEmit"
  }
}
```

### 4.2 Atualizar build.js

Adicionar no início do `build.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');

console.log('🎨 Build CSS com Tailwind...');

try {
  execSync('npx tailwindcss -i ./src/styles/input.css -o ./dist/styles/output.css --minify', {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('   ✅ CSS build completo');
} catch (err) {
  console.warn('⚠️  Tailwind build falhou, continuando...');
}

// ... resto do build existente
```

---

## ✅ Passo 5: Validar Configuração

### 5.1 Testar Tailwind

Criar página teste `test-tailwind.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tailwind Test</title>
  <link rel="stylesheet" href="/dist/styles/output.css">
</head>
<body class="min-h-screen bg-gray-50 flex items-center justify-center">
  <div class="max-w-md w-full">
    <div class="card">
      <h1 class="text-2xl font-bold mb-4">Tailwind Test</h1>
      <p class="text-gray-600 mb-4">Se você ver isso estilizado, Tailwind está funcionando!</p>
      <button class="btn btn-primary w-full">Teste Botão</button>
    </div>
  </div>
</body>
</html>
```

### 5.2 Testar TypeScript

Criar `modules/test-types.ts`:

```typescript
import type { Prestador, Servico } from './types/index.js';

const prestador: Prestador = {
  id: '123',
  nome: 'Teste',
  slug: 'teste',
  email: 'teste@email.com',
  plano: 'free',
  trial_usado: false,
  intervalo_slot: 30,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

console.log('TypeScript OK:', prestador.nome);
```

### 5.3 Rodar testes

```bash
# Testar build CSS
npm run build:css

# Testar TypeScript
npm run build:ts

# Testar build completo
npm run build

# Verificar output
ls -la dist/styles/
```

### 5.4 Testar servidor dev

```bash
npm run dev
```

Acessar `http://localhost:3000/test-tailwind.html`

---

## 📝 Checklist de Validação

Antes de prosseguir para a Fase 2, certifique-se de:

- [ ] `npm install` completou sem erros
- [ ] `tailwind.config.js` criado e configurado
- [ ] `postcss.config.js` criado
- [ ] `tsconfig.json` criado e configurado
- [ ] `src/styles/input.css` criado com @tailwind directives
- [ ] `modules/types/index.ts` criado com tipos base
- [ ] `package.json` scripts atualizados
- [ ] `build.js` atualizado com Tailwind CLI
- [ ] `npm run build` funciona sem erros
- [ ] `npm run dev` inicia servidor
- [ ] Página teste Tailwind funciona
- [ ] TypeScript compila sem erros
- [ ] `dist/styles/output.css` foi gerado

---

## 🚨 Solução de Problemas

### Problema: Tailwind não gera CSS

```bash
# Verificar se input.css existe
ls src/styles/input.css

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install

# Tentar manualmente
npx tailwindcss -i ./src/styles/input.css -o ./dist/styles/output.css
```

### Problema: TypeScript não compila

```bash
# Verificar erros detalhados
npx tsc --noEmit

# Verificar tsconfig.json
cat tsconfig.json

# Reinstalar TypeScript
npm install -D typescript@latest
```

### Problema: Build falha

```bash
# Verificar logs completos
npm run build --verbose

# Limpar e tentar novamente
rm -rf dist
npm run build
```

---

## 📚 Próximos Passos

Após completar esta fase, você está pronto para:

1. **FASE 2:** Migrar CSS para Tailwind
2. Criar páginas com Tailwind
3. Começar a remover CSS manual

Veja [FASE2-TAILWIND.md](./FASE2-TAILWIND.md)

---

**Tempo estimado:** 4-8 horas
**Dificuldade:** Fácil
**Pré-requisitos:** Node.js instalado

**Finalizado em:** ___/___/___
**Por:** ____________
