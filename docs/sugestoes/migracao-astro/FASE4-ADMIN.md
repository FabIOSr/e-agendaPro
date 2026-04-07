# 🖥️ FASE 4: Painel Admin

> Migrar painel administrativo para Astro com Islands

---

## 📋 Objetivos da Fase

1. Migrar todas as páginas admin para Astro
2. Criar componentes interativos com islands
3. Manter funcionalidade atual
4. Implementar dashboard reativo

**Duração estimada:** 10 dias (Semana 6)

---

## 🗂️ Estrutura do Admin

```
src/pages/admin/
├── index.astro           → Redirect para dashboard
├── dashboard.astro       → admin/dashboard.html
├── login.astro           → admin/login.html
├── profissionais.astro    → admin/profissionais.html
├── financeiro.astro      → admin/financeiro.html
├── configuracoes.astro   → admin/configuracoes.html
└── acoes.astro           → admin/acoes.html
```

---

## 📊 Layout Admin

### 4.1 LayoutAdmin.astro

```astro
---
// src/layouts/LayoutAdmin.astro
import LayoutBase from './LayoutBase.astro';

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<LayoutBase title={title}>
  <div class="min-h-screen bg-bg flex">
    <!-- Sidebar -->
    <aside class="w-64 fixed left-0 top-0 bottom-0 bg-bg-2 border-r border-border p-4">
      <div class="flex items-center gap-2 mb-8">
        <span class="w-2 h-2 rounded-full bg-lime"></span>
        <span class="font-serif text-lg">AgendaPro</span>
      </div>
      
      <nav class="space-y-1">
        <a href="/admin/dashboard" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-bg-3 transition">
          <span>📊</span> Dashboard
        </a>
        <a href="/admin/profissionais" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-bg-3 transition">
          <span>👥</span> Profissionais
        </a>
        <a href="/admin/financeiro" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-bg-3 transition">
          <span>💰</span> Financeiro
        </a>
        <a href="/admin/configuracoes" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-bg-3 transition">
          <span>⚙️</span> Configurações
        </a>
        <a href="/admin/acoes" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-bg-3 transition">
          <span>⚡</span> Ações
        </a>
      </nav>
      
      <div class="absolute bottom-4 left-4 right-4">
        <button @click="logout()" class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-bg-3 transition text-rust">
          <span>🚪</span> Sair
        </button>
      </div>
    </aside>
    
    <!-- Main Content -->
    <main class="flex-1 ml-64 p-8">
      <slot />
    </main>
  </div>
</LayoutBase>
```

---

## 📈 Dashboard Admin

### 4.2 Dashboard com Island Reativa

```astro
---
// src/pages/admin/dashboard.astro
import LayoutAdmin from '../../layouts/LayoutAdmin.astro';
import AdminStats from '../../components/islands/AdminStats.astro';
import AdminAgendamentos from '../../components/islands/AdminAgendamentos.astro';
---

<LayoutAdmin title="Dashboard - AgendaPro Admin">
  <div class="mb-8">
    <h1 class="text-2xl font-bold">Dashboard</h1>
    <p class="text-muted">Visão geral dos seus agendamentos</p>
  </div>
  
  <!-- Stats Cards (Island) -->
  <AdminStats client:load />
  
  <!-- Lista Agendamentos (Island) -->
  <div class="mt-8">
    <AdminAgendamentos client:load />
  </div>
</LayoutAdmin>
```

### 4.3 Componente Stats

```astro
---
// src/components/islands/AdminStats.astro
---

<div x-data="adminStats()" class="grid grid-cols-4 gap-6 mb-8">
  <!-- Card: Total Agendamentos -->
  <div class="bg-bg-2 border border-border rounded-xl p-6">
    <div class="text-muted text-sm mb-1">Total agendamentos</div>
    <div class="text-3xl font-bold" x-text="stats.total"></div>
    <div class="text-xs text-lime mt-2">↑ 12% vs mês anterior</div>
  </div>
  
  <!-- Card: Hoje -->
  <div class="bg-bg-2 border border-border rounded-xl p-6">
    <div class="text-muted text-sm mb-1">Hoje</div>
    <div class="text-3xl font-bold" x-text="stats.hoje"></div>
    <div class="text-xs text-muted mt-2" x-text="stats.ocupados + ' horários ocupados'"></div>
  </div>
  
  <!-- Card: Receita -->
  <div class="bg-bg-2 border border-border rounded-xl p-6">
    <div class="text-muted text-sm mb-1">Receita mês</div>
    <div class="text-3xl font-bold text-lime" x-text="formatCurrency(stats.receita)"></div>
    <div class="text-xs text-lime mt-2">↑ 8% vs mês anterior</div>
  </div>
  
  <!-- Card: Clientes -->
  <div class="bg-bg-2 border border-border rounded-xl p-6">
    <div class="text-muted text-sm mb-1">Novos clientes</div>
    <div class="text-3xl font-bold" x-text="stats.novosClientes"></div>
    <div class="text-xs text-lime mt-2">↑ 5% vs mês anterior</div>
  </div>
</div>

<script>
import Alpine from 'alpinejs';

Alpine.data('adminStats', () => ({
  stats: {
    total: 0,
    hoje: 0,
    receita: 0,
    novosClientes: 0,
    ocupados: 0,
  },
  
  async init() {
    await this.carregarStats();
    
    // Atualizar a cada 30 segundos
    setInterval(() => this.carregarStats(), 30000);
  },
  
  async carregarStats() {
    const response = await fetch('/api/admin/stats');
    this.stats = await response.json();
  },
  
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  },
}));
</script>
```

---

## 👥 Lista de Agendamentos

### 4.4 AdminAgendamentos.astro

```astro
---
// src/components/islands/AdminAgendamentos.astro
---

<div x-data="adminAgendamentos()" class="bg-bg-2 border border-border rounded-xl overflow-hidden">
  <!-- Header com filtros -->
  <div class="p-4 border-b border-border flex items-center justify-between">
    <h2 class="font-semibold">Agendamentos</h2>
    
    <div class="flex items-center gap-4">
      <!-- Filtro data -->
      <input 
        type="date" 
        x-model="filtroData"
        @change="filtrar()"
        class="px-3 py-2 bg-bg border border-border rounded-lg text-sm"
      >
      
      <!-- Filtro status -->
      <select 
        x-model="filtroStatus"
        @change="filtrar()"
        class="px-3 py-2 bg-bg border border-border rounded-lg text-sm"
      >
        <option value="">Todos</option>
        <option value="confirmado">Confirmado</option>
        <option value="concluido">Concluído</option>
        <option value="cancelado">Cancelado</option>
      </select>
    </div>
  </div>
  
  <!-- Tabela -->
  <table class="w-full">
    <thead class="bg-bg-3 text-left text-sm text-muted">
      <tr>
        <th class="px-4 py-3">Cliente</th>
        <th class="px-4 py-3">Serviço</th>
        <th class="px-4 py-3">Data/Hora</th>
        <th class="px-4 py-3">Status</th>
        <th class="px-4 py-3">Ações</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-border">
      <template x-for="agendamento in agendamentosFiltrados" :key="agendamento.id">
        <tr class="hover:bg-bg-3 transition">
          <td class="px-4 py-3">
            <div class="font-medium" x-text="agendamento.cliente_nome"></div>
            <div class="text-sm text-muted" x-text="agendamento.cliente_tel"></div>
          </td>
          <td class="px-4 py-3" x-text="agendamento.servico_nome"></td>
          <td class="px-4 py-3">
            <div x-text="formatarData(agendamento.data_hora)"></div>
            <div class="text-sm text-muted" x-text="formatarHora(agendamento.data_hora)"></div>
          </td>
          <td class="px-4 py-3">
            <span 
              class="px-2 py-1 rounded-full text-xs font-medium"
              :class="{
                'bg-lime/20 text-lime': agendamento.status === 'confirmado',
                'bg-gray-500/20 text-gray-400': agendamento.status === 'concluido',
                'bg-rust/20 text-rust': agendamento.status === 'cancelado',
              }"
              x-text="agendamento.status"
            ></span>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <button 
                @click="verDetalhes(agendamento)"
                class="p-2 hover:bg-bg rounded-lg transition"
                title="Ver detalhes"
              >
                👁️
              </button>
              <button 
                @click="cancelar(agendamento)"
                class="p-2 hover:bg-bg rounded-lg transition text-rust"
                title="Cancelar"
              >
                ❌
              </button>
            </div>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
  
  <!-- Loading -->
  <div x-show="loading" class="p-8 text-center text-muted">
    Carregando...
  </div>
  
  <!-- Vazia -->
  <div x-show="agendamentosFiltrados.length === 0 && !loading" class="p-8 text-center text-muted">
    Nenhum agendamento encontrado
  </div>
</div>

<script>
import Alpine from 'alpinejs';

Alpine.data('adminAgendamentos', () => ({
  agendamentos: [],
  agendamentosFiltrados: [],
  loading: true,
  filtroData: '',
  filtroStatus: '',
  
  async init() {
    await this.carregarAgendamentos();
  },
  
  async carregarAgendamentos() {
    this.loading = true;
    const response = await fetch('/api/admin/agendamentos');
    this.agendamentos = await response.json();
    this.filtrar();
    this.loading = false;
  },
  
  filtrar() {
    this.agendamentosFiltrados = this.agendamentos.filter(a => {
      if (this.filtroStatus && a.status !== this.filtroStatus) return false;
      if (this.filtroData) {
        const dataAgendamento = new Date(a.data_hora).toISOString().split('T')[0];
        if (dataAgendamento !== this.filtroData) return false;
      }
      return true;
    });
  },
  
  formatarData(dataHora) {
    return new Date(dataHora).toLocaleDateString('pt-BR');
  },
  
  formatarHora(dataHora) {
    return new Date(dataHora).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  },
  
  async verDetalhes(agendamento) {
    // Abrir modal de detalhes
  },
  
  async cancelar(agendamento) {
    if (!confirm('Cancelar este agendamento?')) return;
    
    await fetch(`/api/admin/agendamentos/${agendamento.id}/cancelar`, {
      method: 'POST',
    });
    
    await this.carregarAgendamentos();
  },
}));
</script>
```

---

## 💰 Página Financeiro

### 4.5 Financeiro.astro

```astro
---
// src/pages/admin/financeiro.astro
import LayoutAdmin from '../../layouts/LayoutAdmin.astro';
import FinanceiroChart from '../../components/islands/FinanceiroChart.astro';
import FinanceiroTable from '../../components/islands/FinanceiroTable.astro';
---

<LayoutAdmin title="Financeiro - AgendaPro Admin">
  <div class="mb-8">
    <h1 class="text-2xl font-bold">Financeiro</h1>
    <p class="text-muted">Receitas e transações</p>
  </div>
  
  <!-- Resumo financeiro -->
  <div class="grid grid-cols-3 gap-6 mb-8">
    <div class="bg-bg-2 border border-border rounded-xl p-6">
      <div class="text-muted text-sm mb-1">Receita total</div>
      <div class="text-3xl font-bold text-lime">R$ 12.450,00</div>
    </div>
    <div class="bg-bg-2 border border-border rounded-xl p-6">
      <div class="text-muted text-sm mb-1">Este mês</div>
      <div class="text-3xl font-bold">R$ 3.200,00</div>
    </div>
    <div class="bg-bg-2 border border-border rounded-xl p-6">
      <div class="text-muted text-sm mb-1">Pendente</div>
      <div class="text-3xl font-bold text-rust">R$ 450,00</div>
    </div>
  </div>
  
  <!-- Gráfico -->
  <FinanceiroChart client:load />
  
  <!-- Tabela transações -->
  <FinanceiroTable client:load />
</LayoutAdmin>
```

---

## ⚙️ Configurações Admin

### 4.6 Configuracoes.astro

```astro
---
// src/pages/admin/configuracoes.astro
import LayoutAdmin from '../../layouts/LayoutAdmin.astro';
import ConfigGeral from '../../components/islands/ConfigGeral.astro';
import ConfigNotificacoes from '../../components/islands/ConfigNotificacoes.astro';
---

<LayoutAdmin title="Configurações - AgendaPro Admin">
  <div class="mb-8">
    <h1 class="text-2xl font-bold">Configurações</h1>
    <p class="text-muted">Gerencie as configurações do sistema</p>
  </div>
  
  <div class="grid grid-cols-3 gap-6">
    <!-- Configurações Gerais -->
    <div class="col-span-2">
      <ConfigGeral client:load />
    </div>
    
    <!-- Notificações -->
    <div>
      <ConfigNotificacoes client:load />
    </div>
  </div>
</LayoutAdmin>
```

---

## ✅ Checklist da Fase

### Páginas Migradas

- [ ] admin/dashboard.astro
- [ ] admin/profissionais.astro
- [ ] admin/financeiro.astro
- [ ] admin/configuracoes.astro
- [ ] admin/acoes.astro

### Componentes Islands

- [ ] AdminStats.astro
- [ ] AdminAgendamentos.astro
- [ ] FinanceiroChart.astro
- [ ] FinanceiroTable.astro
- [ ] ConfigGeral.astro
- [ ] ConfigNotificacoes.astro

### Validação

- [ ] Todas as funcionalidades funcionando
- [ ] Filtros funcionando
- [ ] Atualizações em tempo real
- [ ] Testes E2E passando

---

## 📚 Próximos Passos

1. **FASE 5:** Deploy e Otimização
2. Configurar Firebase Hosting
3. Lighthouse optimization

---

**Duração:** 10 dias
**Responsável:** ____________
**Início:** ___/___/___
**Fim:** ___/___/___
