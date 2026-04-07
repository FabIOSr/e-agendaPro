# 🎨 FASE 2: Migrar CSS para Tailwind

> Guia passo a passo para substituir CSS manual por classes Tailwind

---

## 📋 Objetivos da Fase

1. Substituir todos os arquivos CSS por classes Tailwind
2. Criar sistema de design consistente
3. Remover dependências de CSS antigo
4. Validar visualmente cada página

**Duração estimada:** 5-7 dias

---

## 🎯 Estratégia de Migração

### Ordem de Migração (Do Mais Simples ao Mais Complexo)

```
Dia 1-2: Páginas Públicas (landing, página cliente)
  ↓
Dia 3-4: Páginas Autenticadas (auth, onboarding)
  ↓
Dia 5-7: Páginas Secundárias (planos, config, admin)
```

### Por que esta ordem?

1. **Páginas públicas** - Mais simples, menos formulários
2. **Páginas autenticadas** - Mais complexas, mais formulários
3. **Páginas secundárias** - Menos críticas, podem ter bugs

---

## 📚 Tabela de Conversão Rápida

### Layout

| CSS | Tailwind |
|-----|----------|
| `display: flex` | `flex` |
| `display: grid` | `grid` |
| `display: block` | `block` |
| `display: inline-block` | `inline-block` |
| `display: none` | `hidden` |

### Flexbox

| CSS | Tailwind |
|-----|----------|
| `justify-content: center` | `justify-center` |
| `justify-content: space-between` | `justify-between` |
| `align-items: center` | `items-center` |
| `flex-direction: column` | `flex-col` |
| `flex-wrap: wrap` | `flex-wrap` |

### Espaçamento

| CSS | Tailwind |
|-----|----------|
| `padding: 1rem` | `p-4` |
| `padding: 2rem` | `p-8` |
| `margin: 0 auto` | `mx-auto` |
| `gap: 1rem` | `gap-4` |

### Cores

| CSS | Tailwind |
|-----|----------|
| `color: #2563eb` | `text-blue-600` |
| `background: #2563eb` | `bg-blue-600` |
| `border-color: #e5e7eb` | `border-gray-200` |

### Tipografia

| CSS | Tailwind |
|-----|----------|
| `font-size: 1.5rem` | `text-2xl` |
| `font-weight: bold` | `font-bold` |
| `text-align: center` | `text-center` |
| `line-height: 1.5` | `leading-relaxed` |

### Bordas

| CSS | Tailwind |
|-----|----------|
| `border-radius: 0.5rem` | `rounded-lg` |
| `border: 1px solid` | `border` |
| `border: 2px solid #2563eb` | `border-2 border-blue-600` |

---

## 📄 Exemplo Prático: Landing Page

### ANTES (CSS manual)

**Arquivo:** `pages/landing-page/index.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>AgendaPro - Agendamentos Online</title>
  <link rel="stylesheet" href="/styles/landing.css">
</head>
<body>
  <div class="hero">
    <div class="container">
      <h1 class="hero-title">Agende sua visita</h1>
      <p class="hero-subtitle">Sistema de agendamento online</p>
      <button class="cta-button">Começar grátis</button>
    </div>
  </div>
  <div class="features">
    <div class="feature">
      <h3>Fácil</h3>
      <p>Configure em minutos</p>
    </div>
  </div>
</body>
</html>
```

**Arquivo:** `styles/landing.css`

```css
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: bold;
  color: white;
  margin-bottom: 1rem;
  text-align: center;
}

.hero-subtitle {
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.cta-button {
  background: white;
  color: #667eea;
  padding: 1rem 2rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1.25rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.features {
  padding: 4rem 2rem;
  background: #f9fafb;
}

.feature {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### DEPOIS (Tailwind)

**Arquivo:** `pages/landing-page/index.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgendaPro - Agendamentos Online</title>
  <link rel="stylesheet" href="/dist/styles/output.css">
</head>
<body>
  <!-- Hero Section -->
  <div class="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center px-4">
    <div class="max-w-4xl w-full text-center">
      <h1 class="text-5xl md:text-6xl font-bold text-white mb-6">
        Agende sua visita
      </h1>
      <p class="text-xl md:text-2xl text-white/90 mb-8">
        Sistema de agendamento online para profissionais
      </p>
      <a href="/auth"
         class="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-all hover:-translate-y-1 hover:shadow-2xl">
        Começar grátis
      </a>
    </div>
  </div>

  <!-- Features Section -->
  <div class="bg-gray-50 py-16 px-4">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center text-gray-900 mb-12">
        Por que escolher AgendaPro?
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Feature 1 -->
        <div class="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
          <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">Fácil Configuração</h3>
          <p class="text-gray-600">Configure seus serviços em menos de 5 minutos</p>
        </div>

        <!-- Feature 2 -->
        <div class="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">Lembretes Automáticos</h3>
          <p class="text-gray-600">WhatsApp automático para reduzir faltas</p>
        </div>

        <!-- Feature 3 -->
        <div class="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
          <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">Relatórios Detalhados</h3>
          <p class="text-gray-600">Acompanhe sua receita e clientes</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 📄 Exemplo Prático: Página de Auth

### ANTES

```html
<style>
.auth-container { max-width: 400px; margin: 2rem auto; padding: 2rem; }
.auth-input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; }
.auth-button { width: 100%; background: #2563eb; color: white; }
</style>

<form class="auth-container">
  <input type="email" class="auth-input">
  <button class="auth-button">Entrar</button>
</form>
```

### DEPOIS

```html
<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
  <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Bem-vindo</h1>
      <p class="text-gray-600 mt-2">Entre na sua conta AgendaPro</p>
    </div>

    <form class="space-y-6">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          class="input"
          placeholder="seu@email.com"
          required
        >
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
          Senha
        </label>
        <input
          type="password"
          id="password"
          name="password"
          class="input"
          placeholder="••••••••"
          required
        >
      </div>

      <div class="flex items-center justify-between">
        <label class="flex items-center">
          <input type="checkbox" class="rounded border-gray-300 text-blue-600">
          <span class="ml-2 text-sm text-gray-600">Lembrar-me</span>
        </label>
        <a href="/esqueci-senha" class="text-sm text-blue-600 hover:text-blue-700">
          Esqueci a senha
        </a>
      </div>

      <button
        type="submit"
        class="w-full btn btn-primary"
      >
        Entrar
      </button>

      <p class="text-center text-sm text-gray-600">
        Não tem uma conta?
        <a href="/cadastro" class="font-medium text-blue-600 hover:text-blue-700">
          Cadastre-se
        </a>
      </p>
    </form>
  </div>
</div>
```

---

## 🎯 Componentes Comuns

### Cards

```html
<!-- Card Básico -->
<div class="card">
  <h3 class="text-lg font-bold mb-2">Título</h3>
  <p class="text-gray-600">Conteúdo</p>
</div>

<!-- Card com Hover -->
<div class="card hover:shadow-lg transition-shadow">
  ...
</div>

<!-- Card com Badge -->
<div class="card">
  <div class="flex items-start justify-between">
    <div>
      <h3 class="text-lg font-bold">Título</h3>
    </div>
    <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
      Ativo
    </span>
  </div>
</div>
```

### Botões

```html
<!-- Primário -->
<button class="btn btn-primary">Salvar</button>

<!-- Secundário -->
<button class="btn btn-secondary">Cancelar</button>

<!-- Perigo -->
<button class="btn btn-danger">Excluir</button>

<!-- Outline -->
<button class="btn btn-outline">Ver Detalhes</button>

<!-- Com ícone -->
<button class="btn btn-primary gap-2">
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
  </svg>
  Adicionar
</button>

<!-- Loading -->
<button class="btn btn-primary" disabled>
  <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
  </svg>
  Salvando...
</button>
```

### Formulários

```html
<!-- Form Básico -->
<form class="space-y-4">
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1">
      Nome
    </label>
    <input type="text" class="input" placeholder="Seu nome">
  </div>

  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1">
      Email
    </label>
    <input type="email" class="input" placeholder="seu@email.com">
  </div>

  <button type="submit" class="btn btn-primary">
    Enviar
  </button>
</form>

<!-- Form Inline -->
<form class="flex gap-4 items-end">
  <div class="flex-1">
    <label class="block text-sm font-medium text-gray-700 mb-1">
      Buscar
    </label>
    <input type="text" class="input" placeholder="Digite...">
  </div>
  <button type="submit" class="btn btn-primary">
    Buscar
  </button>
</form>
```

### Tabelas

```html
<div class="overflow-x-auto">
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-50">
      <tr>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Nome
        </th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Status
        </th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Ações
        </th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200">
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          João Silva
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            Confirmado
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button class="text-blue-600 hover:text-blue-900">Editar</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Modais

```html
<!-- Modal Overlay -->
<div x-data="{ open: false }">
  <!-- Trigger -->
  <button @click="open = true">Abrir Modal</button>

  <!-- Modal -->
  <div
    x-show="open"
    class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    @click.self="open = false"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">Título do Modal</h3>
        <button @click="open = false" class="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
      <p class="text-gray-600 mb-6">Conteúdo do modal...</p>
      <div class="flex justify-end gap-3">
        <button @click="open = false" class="btn btn-secondary">
          Cancelar
        </button>
        <button @click="open = false" class="btn btn-primary">
          Confirmar
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## 📝 Por Página

### Landing Page

```bash
# Localização
pages/landing-page/index.html

# Classes principais
min-h-screen
bg-gradient-to-br
from-indigo-500
to-pink-500
text-center
text-5xl
font-bold
```

### Página Cliente

```bash
# Localização
pages/pagina-cliente/index.html

# Classes principais
max-w-4xl
mx-auto
bg-white
rounded-lg
shadow-md
```

### Auth

```bash
# Localização
pages/auth/auth.html

# Classes principais
min-h-screen
flex items-center justify-center
bg-gray-50
max-w-md
w-full
```

### Onboarding

```bash
# Localização
pages/onboarding/index.html

# Classes principais
steps
wizards
progress-bar
form-group
input-group
```

### Painel Prestador

```bash
# Localização
pages/painel-prestador/index.html

# Classes principais
sidebar
main-content
dashboard-header
kpi-card
agendamento-list
```

---

## ✅ Checklist de Migração

Para cada página:

- [ ] Copiar HTML original para backup
- [ ] Identificar todos os estilos CSS
- [ ] Converter para classes Tailwind
- [ ] Testar visualmente
- [ ] Comparar com screenshot do original
- [ ] Testar responsividade (mobile)
- [ ] Remover CSS antigo
- [ ] Commit

---

## 🚨 Dicas Importantes

### 1. Comece com Mobile First

```html
<!-- Mobile First -->
<div class="text-sm md:text-base lg:text-lg">
  Texto responsivo
</div>
```

### 2. Use Variantes de Estado

```html
<!-- Hover, Focus, Active -->
<button class="bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 active:scale-95">
  Clique
</button>
```

### 3. Responsividade com Grid

```html
<!-- Responsivo -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Colunas adaptativas -->
</div>
```

### 4. Espaçamento Consistente

```html
<!-- Use a escala de espaçamento do Tailwind -->
<div class="p-4 sm:p-6 lg:p-8">  <!-- 1rem, 1.5rem, 2rem -->
  Padding consistente
</div>
```

---

## 📚 Próximos Passos

Após completar esta fase, você está pronto para:

1. **FASE 3:** Adicionar Alpine.js aos formulários
2. Criar componentes reativos
3. Melhorar UX com estados

Veja [FASE3-ALPINE.md](./FASE3-ALPINE.md)

---

**Tempo estimado:** 40-56 horas (5-7 dias)
**Dificuldade:** Média
**Pré-requisitos:** FASE 1 completada

**Finalizado em:** ___/___/___
**Por:** ____________
