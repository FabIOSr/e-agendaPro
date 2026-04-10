# Guia Prático — Alpine.js no AgendaPro

> **Stack:** Alpine.js 3.x
> **Status:** ✅ Aprovado — Única biblioteca de reatividade do projeto

---

## 1. Instalação

```bash
npm install alpinejs
```

Inicialização (um único arquivo, ex: `modules/app.js`):

```javascript
import Alpine from 'alpinejs';

window.Alpine = Alpine;
Alpine.start();
```

Depois, importar esse módulo nas páginas que usam Alpine:

```html
<script type="module" src="/modules/app.js"></script>
```

---

## 2. Filosofia de Uso

Alpine.js no AgendaPro **complementa** o JS vanilla, não substitui. Use Alpine onde a reatividade declarativa traz benefício real. Não migre código que já funciona.

### ✅ Use Alpine quando:
- Toggle de modal, dropdown, accordion
- Formulários com validação em tempo real
- Estado visual de botões (loading, disabled)
- Lista com filtro/busca em tempo real
- Feedback de toast com undo

### ❌ Não use Alpine quando:
- `fetch` + `render` simples (função pura)
- Manipulação de DOM uma única vez (carregar dados ao init)
- Cálculos de scheduling (já resolvidos em `scheduling-rules.js`)
- Lógica de negócio complexa (manter em módulos separados)

---

## 3. Padrões do Projeto

### 3.1 Componente Inline (pequeno)

Para toggles, modais e controles simples — direto no HTML:

```html
<div x-data="{ open: false }">
  <button @click="open = !open">Menu</button>
  <div x-show="open" @click.outside="open = false">
    Conteúdo do dropdown
  </div>
</div>
```

### 3.2 Componente com Funções (médio)

Quando precisa de lógica além de toggles:

```html
<div x-data="buscaClientes()">
  <input type="text" x-model="query" placeholder="Buscar cliente..." />
  <template x-for="c in filtrados" :key="c.telefone">
    <div x-text="c.nome"></div>
  </template>
</div>

<script>
function buscaClientes() {
  return {
    query: '',
    clientes: [],
    async init() {
      const { data } = await supabase.from('agendamentos').select();
      this.clientes = data;
    },
    get filtrados() {
      const q = this.query.toLowerCase();
      return this.clientes.filter(c =>
        (c.cliente_nome || '').toLowerCase().includes(q) ||
        (c.cliente_tel || '').includes(q)
      );
    }
  };
}
</script>
```

### 3.3 Componente com Módulo Externo (grande)

Quando a lógica já existe em um módulo compartilhado:

```html
<!-- painel.html -->
<div x-data="painelPrestador()" x-init="init()">
  <div x-show="loading">Carregando...</div>
  <template x-for="ag in agendamentos" :key="ag.id">
    <div x-text="ag.cliente_nome"></div>
  </template>
</div>

<script src="/modules/auth-session.js"></script>
<script>
function painelPrestador() {
  return {
    loading: false,
    agendamentos: [],
    async init() {
      this.loading = true;
      try {
        const { data } = await supabase
          .from('agendamentos')
          .select('*, servicos(nome)')
          .order('data_hora', { ascending: false })
          .limit(50);
        this.agendamentos = data || [];
      } finally {
        this.loading = false;
      }
    }
  };
}
</script>
```

---

## 4. Estado Global

Para estado compartilhado entre componentes (ex: sessão do usuário, plano ativo):

```javascript
// modules/app-state.js
document.addEventListener('alpine:init', () => {
  Alpine.store('session', {
    user: null,
    plano: 'free',
    trialEndsAt: null,
    async load() {
      const session = await supabase.auth.getSession();
      if (session?.data?.session?.user) {
        this.user = session.data.session.user;
        // Buscar dados do prestador
      }
    }
  });

  Alpine.store('ui', {
    toast: null,
    showToast(msg, type = 'success') {
      this.toast = { msg, type };
      setTimeout(() => this.toast = null, 3000);
    }
  });
});
```

Uso no HTML:

```html
<div x-show="$store.ui.toast">
  <span x-text="$store.ui.toast?.msg"></span>
</div>

<div x-show="$store.session.plano === 'free'">
  Faça upgrade para Pro
</div>
```

---

## 5. Migração Gradual — Exemplo Prático

### Antes (vanilla JS)

```javascript
// clientes.html — função de busca existente
let clientes = [];
let query = '';

document.getElementById('input-busca').addEventListener('input', (e) => {
  query = e.target.value.toLowerCase();
  renderClientes();
});

async function loadClientes() {
  const { data } = await supabase.from('agendamentos').select();
  clientes = data;
  renderClientes();
}

function renderClientes() {
  const container = document.getElementById('lista-clientes');
  const filtrados = clientes.filter(c =>
    (c.cliente_nome || '').toLowerCase().includes(query)
  );
  container.innerHTML = filtrados.map(c =>
    `<div>${c.cliente_nome}</div>`
  ).join('');
}
```

### Depois (Alpine.js)

```html
<div x-data="clientesComponent()" x-init="init()">
  <input type="text" x-model="query" placeholder="Buscar cliente..." />
  <div id="lista-clientes">
    <template x-for="c in filtrados" :key="c.telefone">
      <div x-text="c.cliente_nome"></div>
    </template>
  </div>
</div>

<script>
function clientesComponent() {
  return {
    clientes: [],
    query: '',
    async init() {
      const { data } = await supabase.from('agendamentos').select();
      this.clientes = data || [];
    },
    get filtrados() {
      const q = this.query.toLowerCase();
      return this.clientes.filter(c =>
        (c.cliente_nome || '').toLowerCase().includes(q)
      );
    }
  };
}
</script>
```

**Nota:** A lógica de negócio (regras de filtro, chamadas ao Supabase) pode continuar nos módulos existentes. Alpine só gerencia o estado da UI.

---

## 6. Diretivas Mais Usadas

| Diretiva | Uso no AgendaPro |
|---|---|
| `x-data` | Declarar estado do componente |
| `x-init` | Inicializar dados (carregar do Supabase) |
| `x-show` | Mostrar/ocultar modais, toasts, badges |
| `x-bind:class` | Classes condicionais (botão loading, status) |
| `x-on:click` | Handlers de clique (salvar, cancelar) |
| `x-on:submit.prevent` | Formulários com preventDefault |
| `x-model` | Inputs de busca, formulários |
| `x-text` | Texto dinâmico (nomes, preços) |
| `x-html` | Conteúdo formatado (descrições) |
| `x-for` | Listas (clientes, serviços, agendamentos) |
| `x-transition` | Animações de modais, toasts |
| `@click.outside` | Fechar modal ao clicar fora |

---

## 7. Boas Práticas

1. **Funções globais nomeadas** — `function nomeDoComponent()` — Alpine encontra automaticamente
2. **`init()` assíncrono** — sempre com try/finally para loading state
3. **Getters computados** — `get filtrados()` em vez de chamar função no template
4. **Sem DOM manipulation** — usar `x-show`, `x-text`, `x-for` em vez de `document.getElementById`
5. **Estado mínimo** — Alpine gerencia UI state, módulos externos geram lógica de negócio
6. **`x-cloak` nos elementos** — evita flash de conteúdo não-renderizado

```html
<style>[x-cloak] { display: none !important; }</style>

<div x-data="{ open: false }" x-cloak>
  Conteúdo que só aparece após Alpine carregar
</div>
```

---

## 8. Integração com Código Existente

Alpine **convive** com JS vanilla na mesma página:

```html
<!-- Alpine gerencia o modal -->
<div x-data="{ showCancelModal: false }">
  <button @click="showCancelModal = true">Cancelar</button>
  <div x-show="showCancelModal">Modal de cancelamento</div>
</div>

<!-- Vanilla JS continua funcionando -->
<script>
// Código existente não precisa mudar
async function salvarServico() {
  const { error } = await supabase.from('servicos').update({...});
  if (error) {
    toast('Erro ao salvar', 'error'); // ui-helpers.js
  } else {
    toast('✓ Salvo!');
  }
}
</script>
```

---

## 9. Anti-padrões (Não Fazer)

```html
<!-- ❌ Lógica de negócio no template -->
<div x-data="{ items: [] }"
     x-init="fetch('/api').then(r => r.json()).then(d => items = d)">

<!-- ❌ Múltiplos componentes sem store global -->
<div x-data="{ user: null }" x-init="loadUser()">
<div x-data="{ user: null }" x-init="loadUser()">  <!-- duplicado! -->

<!-- ❌ Manipular DOM dentro de Alpine -->
<div x-data @click="document.getElementById('x').style.color = 'red'">

<!-- ✅ Correto: funções separadas, Alpine só gerencia estado -->
<script>
async function loadUser() {
  const { data } = await supabase.auth.getUser();
  Alpine.store('session').user = data?.user;
}
</script>
```

---

## 10. Checklist de Migração de Página

- [ ] Importar módulo Alpine no entry point (`<script type="module">`)
- [ ] Adicionar `[x-cloak]` no CSS
- [ ] Identificar 2-3 interações para migrar primeiro (modal, busca, toggle)
- [ ] Converter `document.getElementById` → `x-model` / `x-show` / `x-text`
- [ ] Converter `renderX()` → `x-for` com getter computado
- [ ] Mover `addEventListener('click')` → `@click`
- [ ] Testar que todos os fluxos continuam funcionando
- [ ] Remover listeners vanilla JS que foram substituídos
