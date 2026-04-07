# 🏗️ FASE 2: Layouts e Páginas Estáticas

> Criar layouts base e migrar páginas estáticas para Astro

---

## 📋 Objetivos da Fase

1. Criar layouts base reutilizáveis
2. Migrar páginas públicas estáticas
3. Configurar roteamento
4. Preservar design atual

**Duração estimada:** 10 dias (Semanas 2-3)

---

## 🎯 Estrutura de Layouts

### 2.1 Criar diretório de layouts

```
src/layouts/
├── LayoutBase.astro      # Layout principal (head, meta)
├── LayoutPublico.astro  # Páginas públicas (landing, planos)
├── LayoutAutenticado.astro  # Página cliente, painel
└── LayoutAdmin.astro    # Painel admin
```

### 2.2 LayoutBase.astro

```astro
---
// src/layouts/LayoutBase.astro
interface Props {
  title: string;
  description?: string;
}

const { title, description = 'AgendaPro - Seu link de agendamento' } = Astro.props;
---

<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content={description}>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@300;400;500&family=Syne:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles/global.css">
</head>
<body>
  <slot />
</body>
</html>

<style is:global>
  /* Variáveis globais */
  :root {
    --ink: #0e0d0a;
    --paper: #f5f2eb;
    --lime: #c8f060;
    --lime-dark: #8ab830;
    --rust: #c84830;
    --muted: #6b6860;
  }
  
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    font-family: 'Syne', sans-serif;
  }
</style>
```

### 2.3 LayoutPublico.astro

```astro
---
// src/layouts/LayoutPublico.astro
import LayoutBase from './LayoutBase.astro';

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<LayoutBase title={title}>
  <nav class="fixed top-0 left-0 right-0 z-50 px-8 h-14 flex items-center justify-between bg-paper/90 backdrop-blur-md border-b border-border">
    <a href="/" class="flex items-center gap-2 text-xl font-serif">
      <span class="w-2 h-2 rounded-full bg-lime shadow-[0_0_0_3px_var(--lime-dark)] animate-pulse"></span>
      AgendaPro
    </a>
    <div class="flex items-center gap-7 text-sm font-medium">
      <a href="/planos" class="text-muted hover:text-ink transition">Planos</a>
      <a href="/auth" class="text-muted hover:text-ink transition">Login</a>
      <a href="/auth?cadastro=1" class="bg-ink text-paper px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink/80 transition">
        Começar agora
      </a>
    </div>
  </nav>
  
  <main>
    <slot />
  </main>
  
  <footer class="py-12 px-8 border-t border-border text-center text-muted text-sm">
    <p>&copy; 2026 AgendaPro. Todos os direitos reservados.</p>
  </footer>
</LayoutBase>
```

---

## 📄 Migrar Páginas Estáticas

### 2.4 Landing Page (pages/landing-page.html)

**Estratégia:** Converter HTML → Astro componente

```astro
---
// src/pages/index.astro
import LayoutPublico from '../layouts/LayoutPublico.astro';
---

<LayoutPublico title="AgendaPro - Seu link de agendamento em minutos">
  <section class="min-h-screen flex flex-col justify-center px-8 pt-20 relative overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-grid-pattern bg-[length:52px_52px] opacity-50"></div>
    
    <div class="max-w-4xl mx-auto text-center relative z-10">
      <h1 class="text-5xl md:text-7xl font-bold mb-6 text-balance">
        Seu link de agendamento
        <span class="text-lime">em minutos</span>
      </h1>
      
      <p class="text-xl text-muted mb-8 max-w-2xl mx-auto">
        Simplifique a agenda do seu negócio. Compartilhe seu link e deixe os clientes agendarem no horário que funciona para ambos.
      </p>
      
      <div class="flex gap-4 justify-center">
        <a href="/auth?cadastro=1" class="bg-lime text-ink px-6 py-3 rounded-xl font-semibold text-lg hover:bg-lime-dark transition">
          Criar link gratuito
        </a>
        <a href="#como-funciona" class="border border-border px-6 py-3 rounded-xl font-semibold text-lg hover:bg-paper-2 transition">
          Como funciona
        </a>
      </div>
    </div>
  </section>
  
  <!-- Features -->
  <section id="como-funciona" class="py-20 px-8 bg-paper-2">
    <!-- ... converter resto da página -->
  </section>
</LayoutPublico>
```

### 2.5 Página de Planos

```astro
---
// src/pages/planos.astro
import LayoutPublico from '../layouts/LayoutPublico.astro';
---

<LayoutPublico title="Planos - AgendaPro">
  <div class="pt-24 px-8 max-w-5xl mx-auto">
    <h1 class="text-4xl font-bold text-center mb-4">Escolha seu plano</h1>
    <p class="text-muted text-center mb-12">Comece gratuito, upgrade quando precisar</p>
    
    <div class="grid md:grid-cols-3 gap-6">
      <!-- Free -->
      <div class="p-6 rounded-xl border border-border bg-paper">
        <h3 class="text-xl font-semibold mb-2">Gratuito</h3>
        <p class="text-3xl font-bold mb-4">R$ 0<span class="text-sm font-normal text-muted">/mês</span></p>
        <ul class="space-y-2 text-muted mb-6">
          <li>✅ 1 profissional</li>
          <li>✅ 5 serviços</li>
          <li>✅ Agendamentos ilimitados</li>
        </ul>
        <a href="/auth?cadastro=1" class="block text-center bg-ink text-paper py-3 rounded-lg font-semibold">
          Começar grátis
        </a>
      </div>
      
      <!-- Pro -->
      <div class="p-6 rounded-xl border-2 border-lime bg-paper">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xl font-semibold">Pro</h3>
          <span class="text-xs bg-lime text-ink px-2 py-1 rounded-full font-semibold">Mais популярний</span>
        </div>
        <p class="text-3xl font-bold mb-4">R$ 49<span class="text-sm font-normal text-muted">/mês</span></p>
        <ul class="space-y-2 text-muted mb-6">
          <li>✅ Professionals ilimitados</li>
          <li>✅ Serviços ilimitados</li>
          <li>✅whatsapp notifications</li>
          <li>✅ Google Calendar</li>
        </ul>
        <a href="/auth?cadastro=1&plano=pro" class="block text-center bg-lime text-ink py-3 rounded-lg font-semibold">
          Upgrade agora
        </a>
      </div>
    </div>
  </div>
</LayoutPublico>
```

---

## 🔗 Configurar Roteamento

### 2.6 Arquivo de rotas

```
src/pages/
├── index.astro          → landing-page.html
├── planos.astro         → planos.html
├── auth.astro           → auth.html
├── confirmar-reserva.astro → confirmar-reserva.html
├── onboarding.astro     → onboarding.html
└── cliente/
    ├── [slug].astro     → pagina-cliente.html (dinâmico)
    └── agendamento.astro
```

### 2.7 Rota dinâmica para página do cliente

```astro
---
// src/pages/cliente/[slug].astro
import LayoutBase from '../../layouts/LayoutBase.astro';

const { slug } = Astro.params;

// Buscar dados do prestador via Supabase
// const prestador = await buscarPrestador(slug);
---

<LayoutBase title={`${slug} - Agende agora`}>
  <div id="app" data-slug={slug}>
    <!-- Alpine island será嵌在这里 -->
    <div x-data="agendamentoWizard()">
      <!-- Wizard content -->
    </div>
  </div>
</LayoutBase>

<script>
import { buscarPrestador } from '../../modules/api';

document.addEventListener('DOMContentLoaded', async () => {
  const slug = document.getElementById('app')?.dataset.slug;
  if (slug) {
    const prestador = await buscarPrestador(slug);
    // Inicializar wizard
  }
});
</script>
```

---

## ✅ Checklist da Fase

### Layouts

- [ ] LayoutBase.astro criado
- [ ] LayoutPublico.astro criado
- [ ] LayoutAutenticado.astro criado
- [ ] LayoutAdmin.astro criado

### Páginas

- [ ] index.astro (landing page)
- [ ] planos.astro
- [ ] auth.astro
- [ ] confirmar-reserva.astro
- [ ] onboarding.astro
- [ ] cliente/[slug].astro

### Validação

- [ ] Todas as páginas renderizando corretamente
- [ ] Estilos visuais idênticos ao original
- [ ] Links funcionando
- [ ] SEO meta tags configuradas

---

## 📚 Próximos Passos

1. **FASE 3:** Adicionar Islands interativas
2. Criar wizard de agendamento
3. Adicionar Alpine.js às páginas

---

**Duração:** 10 dias
**Responsável:** ____________
**Início:** ___/___/___
**Fim:** ___/___/___
