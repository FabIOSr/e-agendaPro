# ⚡ FASE 3: Adicionar Alpine.js

> Guia para adicionar reatividade com Alpine.js aos formulários e páginas

---

## 📋 Objetivos da Fase

1. Adicionar Alpine.js ao projeto
2. Migrar formulários para Alpine
3. Eliminar DOM manipulation manual
4. Implementar estados reativos

**Duração estimada:** 3-5 dias

---

## 🚀 Conceitos Básicos do Alpine.js

### Diretivas Principais

| Diretiva | Descrição | Exemplo |
|----------|-----------|---------|
| `x-data` | Define estado do componente | `x-data="{ count: 0 }"` |
| `x-show` | Mostra/oculta elemento | `x-show="open"` |
| `x-if` | Renderiza condicionalmente | `x-if="user.loggedIn"` |
| `x-for` | Loop em arrays | `x-for="item in items"` |
| `x-model` | Two-way binding | `x-model="form.name"` |
| `x-text` | Define conteúdo de texto | `x-text="message"` |
| `x-html` | Define HTML interno | `x-html="htmlContent"` |
| `x-on` | Event listeners | `@click="doSomething()"` |
| `x-transition` | Animações | `x-transition` |

---

## 📦 Setup do Alpine

### 1. Adicionar CDN

No `<head>` de cada página (ou no template base):

```html
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js"></script>
```

### 2. Criar Componente Base

```html
<div x-data="{
  count: 0,
  increment() {
    this.count++;
  }
}">
  <p x-text="count"></p>
  <button @click="increment()">+</button>
</div>
```

---

## 🎯 Padrões de Alpine.js

### 1. Formulário com Validação

```html
<div x-data="loginForm()">
  <form @submit.prevent="submit()">
    <div>
      <label>Email</label>
      <input
        type="email"
        x-model="form.email"
        :class="{'border-red-500': errors.email}"
        @input="errors.email = null"
      >
      <p x-show="errors.email" x-text="errors.email" class="text-red-500 text-sm"></p>
    </div>

    <button type="submit" :disabled="loading">
      <span x-show="!loading">Entrar</span>
      <span x-show="loading">Entrando...</span>
    </button>
  </form>
</div>

<script>
function loginForm() {
  return {
    form: {
      email: '',
      password: ''
    },
    errors: {},
    loading: false,

    async submit() {
      // Validar
      if (!this.form.email) {
        this.errors.email = 'Email é obrigatório';
        return;
      }

      this.loading = true;
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          body: JSON.stringify(this.form)
        });

        if (response.ok) {
          window.location.href = '/dashboard';
        } else {
          this.errors.password = 'Credenciais inválidas';
        }
      } finally {
        this.loading = false;
      }
    }
  };
}
</script>
```

### 2. Toggle / Modal

```html
<div x-data="{ open: false }">
  <button @click="open = true">Abrir</button>

  <div
    x-show="open"
    x-transition:enter="transition ease-out duration-300"
    x-transition:enter-start="opacity-0"
    x-transition:enter-end="opacity-100"
    x-transition:leave="transition ease-in duration-200"
    x-transition:leave-start="opacity-100"
    x-transition:leave-end="opacity-0"
    class="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
    @click.self="open = false"
  >
    <div class="bg-white rounded-lg p-6 max-w-md w-full">
      <h2 class="text-xl font-bold mb-4">Modal</h2>
      <p class="text-gray-600 mb-4">Conteúdo do modal...</p>
      <button @click="open = false" class="btn btn-primary">Fechar</button>
    </div>
  </div>
</div>
```

### 3. Tabs

```html
<div x-data="{ activeTab: 'tab1' }">
  <!-- Tab Buttons -->
  <div class="flex gap-4 border-b">
    <button
      @click="activeTab = 'tab1'"
      :class="activeTab === 'tab1' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'"
      class="pb-2 px-4"
    >
      Tab 1
    </button>
    <button
      @click="activeTab = 'tab2'"
      :class="activeTab === 'tab2' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'"
      class="pb-2 px-4"
    >
      Tab 2
    </button>
  </div>

  <!-- Tab Content -->
  <div class="mt-4">
    <div x-show="activeTab === 'tab1'">
      Conteúdo da Tab 1
    </div>
    <div x-show="activeTab === 'tab2'">
      Conteúdo da Tab 2
    </div>
  </div>
</div>
```

### 4. Dropdown Menu

```html
<div x-data="{ open: false }" class="relative">
  <button @click="open = !open" @click.away="open = false">
    Menu
    <svg :class="{'rotate-180': open}" class="w-4 h-4 transition-transform"></svg>
  </button>

  <div
    x-show="open"
    x-transition
    class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border"
  >
    <a href="#" class="block px-4 py-2 hover:bg-gray-100">Opção 1</a>
    <a href="#" class="block px-4 py-2 hover:bg-gray-100">Opção 2</a>
    <hr class="my-1">
    <a href="#" class="block px-4 py-2 text-red-600 hover:bg-gray-100">Sair</a>
  </div>
</div>
```

### 5. Lista com Filtros

```html
<div x-data="filteredList()">
  <input
    type="text"
    x-model="search"
    placeholder="Buscar..."
    class="input mb-4"
  >

  <select x-model="filter" class="input mb-4">
    <option value="">Todos</option>
    <option value="active">Ativos</option>
    <option value="inactive">Inativos</option>
  </select>

  <ul class="space-y-2">
    <template x-for="item in filteredItems" :key="item.id">
      <li class="card">
        <h3 x-text="item.name"></h3>
        <span x-show="item.active" class="text-green-600">Ativo</span>
      </li>
    </template>
  </ul>

  <p x-show="filteredItems.length === 0" class="text-center text-gray-500 py-8">
    Nenhum item encontrado
  </p>
</div>

<script>
function filteredList() {
  return {
    search: '',
    filter: '',
    items: [
      { id: 1, name: 'Item 1', active: true },
      { id: 2, name: 'Item 2', active: false },
      { id: 3, name: 'Item 3', active: true },
    ],

    get filteredItems() {
      return this.items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(this.search.toLowerCase());
        const matchesFilter = !this.filter || (this.filter === 'active' ? item.active : !item.active);
        return matchesSearch && matchesFilter;
      });
    }
  };
}
</script>
```

---

## 📄 Migração de Formulários

### Login

```html
<!-- ANTES -->
<form id="login-form">
  <input id="email" type="email">
  <input id="password" type="password">
  <button type="submit">Entrar</button>
</form>

<script>
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  // ... enviar dados
});
</script>

<!-- DEPOIS -->
<div x-data="loginForm()">
  <form @submit.prevent="login()">
    <input x-model="form.email" type="email">
    <input x-model="form.password" type="password">
    <button type="submit" :disabled="loading">
      <span x-show="!loading">Entrar</span>
      <span x-show="loading">Entrando...</span>
    </button>
    <p x-show="error" x-text="error" class="text-red-500"></p>
  </form>
</div>

<script>
function loginForm() {
  return {
    form: { email: '', password: '' },
    loading: false,
    error: '',

    async login() {
      this.loading = true;
      this.error = '';

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: this.form.email,
          password: this.form.password,
        });

        if (error) throw error;

        window.location.href = '/painel';
      } catch (err) {
        this.error = 'Email ou senha incorretos';
      } finally {
        this.loading = false;
      }
    }
  };
}
</script>
```

### Wizard de Agendamento

```html
<div x-data="agendamentoWizard()">
  <!-- Progresso -->
  <div class="mb-8">
    <div class="flex justify-between">
      <template x-for="(step, index) in steps" :key="index">
        <div class="flex items-center">
          <div
            :class="currentStep >= index ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'"
            class="w-8 h-8 rounded-full flex items-center justify-center font-semibold"
            x-text="index + 1"
          ></div>
          <div x-show="index < steps.length - 1" class="w-16 h-1 bg-gray-200 mx-2"></div>
        </div>
      </template>
    </div>
  </div>

  <!-- Step 1: Serviço -->
  <div x-show="currentStep === 0">
    <h2 class="text-2xl font-bold mb-4">Escolha o serviço</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <template x-for="servico in servicos" :key="servico.id">
        <button
          @click="agendamento.servico_id = servico.id"
          :class="agendamento.servico_id === servico.id ? 'ring-2 ring-blue-600 bg-blue-50' : ''"
          class="card text-left hover:shadow-lg transition-shadow"
        >
          <h3 class="font-bold" x-text="servico.nome"></h3>
          <p class="text-gray-600" x-text="servico.duracao_min + ' minutos'"></p>
          <p class="text-blue-600 font-bold" x-text="'R$ ' + servico.preco"></p>
        </button>
      </template>
    </div>
  </div>

  <!-- Step 2: Data -->
  <div x-show="currentStep === 1">
    <h2 class="text-2xl font-bold mb-4">Escolha a data</h2>
    <input type="date" x-model="agendamento.data" class="input mb-4" :min="minDate">

    <div class="grid grid-cols-3 gap-2">
      <template x-for="slot in slots" :key="slot.hora">
        <button
          @click="agendamento.hora = slot.hora"
          :disabled="!slot.disponivel"
          :class="{
            'bg-blue-600 text-white': agendamento.hora === slot.hora,
            'bg-gray-100 text-gray-400 cursor-not-allowed': !slot.disponivel,
            'hover:bg-gray-100': slot.disponivel && agendamento.hora !== slot.hora
          }"
          class="py-2 px-4 rounded-lg font-medium"
          x-text="slot.hora"
        ></button>
      </template>
    </div>
  </div>

  <!-- Step 3: Cliente -->
  <div x-show="currentStep === 2">
    <h2 class="text-2xl font-bold mb-4">Seus dados</h2>
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Nome</label>
        <input x-model="agendamento.cliente_nome" class="input" type="text">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
        <input x-model="agendamento.cliente_tel" class="input" type="tel">
      </div>
    </div>
  </div>

  <!-- Step 4: Confirmação -->
  <div x-show="currentStep === 3">
    <h2 class="text-2xl font-bold mb-4">Confirme seu agendamento</h2>
    <div class="card">
      <p><strong>Serviço:</strong> <span x-text="servicoSelecionado?.nome"></span></p>
      <p><strong>Data:</strong> <span x-text="dataFormatada"></span></p>
      <p><strong>Horário:</strong> <span x-text="agendamento.hora"></span></p>
      <p><strong>Valor:</strong> <span x-text="'R$ ' + servicoSelecionado?.preco"></span></p>
    </div>
  </div>

  <!-- Navegação -->
  <div class="flex justify-between mt-8">
    <button
      x-show="currentStep > 0"
      @click="currentStep--"
      class="btn btn-secondary"
    >
      Voltar
    </button>

    <button
      x-show="currentStep < 3"
      @click="nextStep()"
      :disabled="!podeAvancar"
      class="btn btn-primary"
    >
      Próximo
    </button>

    <button
      x-show="currentStep === 3"
      @click="confirmar()"
      :disabled="loading"
      class="btn btn-primary"
    >
      <span x-show="!loading">Confirmar Agendamento</span>
      <span x-show="loading">Agendando...</span>
    </button>
  </div>
</div>

<script>
function agendamentoWizard() {
  return {
    currentStep: 0,
    steps: ['Serviço', 'Data', 'Dados', 'Confirmação'],
    servicos: [],
    slots: [],
    loading: false,

    agendamento: {
      servico_id: '',
      data: '',
      hora: '',
      cliente_nome: '',
      cliente_tel: ''
    },

    get minDate() {
      return new Date().toISOString().split('T')[0];
    },

    get servicoSelecionado() {
      return this.servicos.find(s => s.id === this.agendamento.servico_id);
    },

    get dataFormatada() {
      if (!this.agendamento.data) return '';
      return new Date(this.agendamento.data + 'T12:00:00').toLocaleDateString('pt-BR');
    },

    get podeAvancar() {
      switch (this.currentStep) {
        case 0: return !!this.agendamento.servico_id;
        case 1: return !!this.agendamento.data && !!this.agendamento.hora;
        case 2: return !!this.agendamento.cliente_nome && !!this.agendamento.cliente_tel;
        default: return true;
      }
    },

    async init() {
      // Carregar serviços
      const { data } = await supabase.from('servicos').select().eq('ativo', true);
      this.servicos = data;
    },

    async nextStep() {
      if (this.currentStep === 0) {
        // Carregar slots quando selecionar data
        this.agendamento.data = new Date().toISOString().split('T')[0];
        await this.carregarSlots();
      }
      this.currentStep++;
    },

    async carregarSlots() {
      const response = await fetch('/functions/v1/horarios-disponiveis', {
        method: 'POST',
        body: JSON.stringify({
          prestador_slug: 'ana-cabelos',
          servico_id: this.agendamento.servico_id,
          data: this.agendamento.data
        })
      });
      this.slots = await response.json();
    },

    async confirmar() {
      this.loading = true;
      try {
        const response = await fetch('/functions/v1/criar-agendamento', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify(this.agendamento)
        });

        if (response.ok) {
          this.currentStep = 4; // Sucesso
        } else {
          alert('Erro ao agendar');
        }
      } finally {
        this.loading = false;
      }
    }
  };
}
</script>
```

---

## ✅ Checklist

### Setup

- [ ] Alpine CDN adicionado
- [ ] Página teste criada
- [ ] Teste de reatividade funcionando

### Formulários

- [ ] Login migrado
- [ ] Cadastro migrado
- [ ] Recuperação de senha migrada

### Wizard

- [ ] Step 1 (Serviço) migrado
- [ ] Step 2 (Data) migrado
- [ ] Step 3 (Cliente) migrado
- [ ] Step 4 (Confirmação) migrado
- [ ] Navegação funcionando

### Dashboard

- [ ] KPIs reativos
- [ ] Lista de agendamentos
- [ ] Filtros funcionais
- [ ] Modais funcionais

### Validação

- [ ] Zero `document.getElementById`
- [ ] Zero `addEventListener`
- [ ] Estados reativos testados
- [ ] Testes E2E passando

---

## 📚 Próximos Passos

Após completar esta fase, você está pronto para:

1. **FASE 4:** Migrar módulos para TypeScript
2. Adicionar type safety
3. Melhorar IntelliSense

Veja [FASE4-TYPESCRIPT.md](./FASE4-TYPESCRIPT.md)

---

**Tempo estimado:** 24-40 horas (3-5 dias)
**Dificuldade:** Média
**Pré-requisitos:** FASE 2 completada

**Finalizado em:** ___/___/___
**Por:** ____________
