# 🛠️ FASE 5: Painel Admin

> Guia para migrar o painel administrativo para Alpine.js + Tailwind + TypeScript

---

## 📋 Objetivos da Fase

1. Migrar todas as páginas admin
2. Implementar componentes com Alpine.js
3. Adicionar type safety com TypeScript
4. Garantir responsividade completa

**Duração estimada:** 5-7 dias

---

## 🎯 Estrutura do Painel Admin

```
pages/admin/
├── login.html           ← Login com Alpine
├── dashboard.html       ← KPIs reativos
├── profissionais.html   ← Tabela com filtros
├── financeiro.html      ← Gráficos e métricas
├── acoes.html           ← Ações em lote
└── configuracoes.html   ← Config do sistema
```

---

## 🔐 Login Admin

### login.html

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Admin</title>
  <link rel="stylesheet" href="/dist/styles/output.css">
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js"></script>
</head>
<body class="min-h-screen bg-gray-100 flex items-center justify-center px-4">
  <div x-data="adminLogin()">
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">AgendaPro</h1>
        <p class="text-gray-600">Painel Administrativo</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="login()">
        <div class="mb-6">
          <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
            Senha Admin
          </label>
          <input
            type="password"
            id="password"
            x-model="password"
            class="input"
            placeholder="Digite sua senha"
            required
            :disabled="loading"
          >
        </div>

        <!-- Error -->
        <div
          x-show="erro"
          x-transition
          class="mb-4 p-4 bg-red-100 text-red-700 rounded-lg text-sm"
          x-text="erro"
        ></div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full btn btn-primary"
        >
          <svg x-show="loading" class="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <span x-show="!loading">Entrar</span>
          <span x-show="loading">Entrando...</span>
        </button>
      </form>

      <!-- Footer -->
      <p class="text-center text-sm text-gray-500 mt-6">
        Área restrita. Acesso não autorizado é crime.
      </p>
    </div>
  </div>

  <script>
    function adminLogin() {
      return {
        password: '',
        loading: false,
        erro: '',

        async login() {
          this.loading = true;
          this.erro = '';

          try {
            const response = await fetch('/functions/v1/admin-validate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: this.password })
            });

            const data = await response.json();

            if (response.ok) {
              localStorage.setItem('adminToken', data.token);
              window.location.href = '/admin/dashboard';
            } else {
              this.erro = data.erro || 'Senha incorreta';
            }
          } catch (err) {
            this.erro = 'Erro ao conectar. Tente novamente.';
          } finally {
            this.loading = false;
          }
        }
      };
    }
  </script>
</body>
</html>
```

---

## 📊 Dashboard

### dashboard.html

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Admin</title>
  <link rel="stylesheet" href="/dist/styles/output.css">
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js"></script>
</head>
<body>
  <div x-data="adminDashboard()">
    <!-- Header -->
    <header class="bg-white border-b px-6 py-4">
      <div class="flex items-center justify-between max-w-7xl mx-auto">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p class="text-gray-600 text-sm">Visão geral do sistema</p>
        </div>
        <button @click="logout()" class="text-gray-600 hover:text-gray-900">
          Sair
        </button>
      </div>
    </header>

    <!-- Loading -->
    <div x-show="loading" class="flex items-center justify-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Content -->
    <div x-show="!loading" class="p-6 max-w-7xl mx-auto">
      <!-- KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <!-- Total Prestadores -->
        <div class="card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Total Prestadores</p>
              <p class="text-3xl font-bold mt-2" x-text="kpis?.total_prestadores || 0"></p>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
          </div>
          <p class="text-sm mt-4">
            <span class="text-green-600" x-text="`+${kpis?.novos_mes || 0} este mês`"></span>
          </p>
        </div>

        <!-- Trials Ativos -->
        <div class="card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Trials Ativos</p>
              <p class="text-3xl font-bold mt-2" x-text="kpis?.trials_ativos || 0"></p>
            </div>
            <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <p class="text-sm mt-4 text-gray-500">
            <span x-text="`${kpis?.trials_expirando_hoje || 0} expiram hoje`"></span>
          </p>
        </div>

        <!-- MRR -->
        <div class="card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">MRR</p>
              <p class="text-3xl font-bold mt-2">
                R$ <span x-text="formatarMoeda(kpis?.mrr || 0)"></span>
              </p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <p class="text-sm mt-4">
            <span :class="kpis?.mrr_crescimento >= 0 ? 'text-green-600' : 'text-red-600'" x-text="`${kpis?.mrr_crescimento || 0}% vs mês passado`"></span>
          </p>
        </div>

        <!-- Alertas -->
        <div class="card"
             :class="kpis?.alertas > 0 ? 'border-2 border-yellow-400 bg-yellow-50' : ''">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Alertas</p>
              <p class="text-3xl font-bold mt-2"
                 :class="kpis?.alertas > 0 ? 'text-yellow-600' : ''"
                 x-text="kpis?.alertas || 0"></p>
            </div>
            <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
          </div>
          <p class="text-sm mt-4 text-gray-500">
            Pagamentos pendentes
          </p>
        </div>
      </div>

      <!-- Gráfico de Crescimento -->
      <div class="card mb-8">
        <h2 class="text-lg font-bold mb-4">Crescimento (Últimos 6 meses)</h2>

        <div class="flex items-end space-x-2 h-48">
          <template x-for="(mes, index) in (kpis?.crescimento || [])" :key="index">
            <div class="flex-1 flex flex-col items-center group">
              <div class="relative w-full">
                <div
                  class="w-full bg-blue-600 rounded-t hover:bg-blue-700 transition-all cursor-pointer relative"
                  :style="`height: ${(mes.prestadores / (kpis?.max_prestadores || 1)) * 100}%`"
                >
                  <!-- Tooltip -->
                  <div class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    <span x-text="mes.prestadores"></span> prestadores
                  </div>
                </div>
              </div>
              <p class="text-xs text-gray-600 mt-2" x-text="mes.mes"></p>
            </div>
          </template>
        </div>
      </div>

      <!-- Atividades Recentes -->
      <div class="card">
        <h2 class="text-lg font-bold mb-4">Atividades Recentes</h2>

        <div class="space-y-4">
          <template x-for="atividade in (kpis?.atividades || [])" :key="atividade.id">
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center"
                     :class="{
                       'bg-green-100 text-green-600': atividade.tipo === 'novo',
                       'bg-blue-100 text-blue-600': atividade.tipo === 'upgrade',
                       'bg-red-100 text-red-600': atividade.tipo === 'cancelamento'
                     }">
                  <svg x-show="atividade.tipo === 'novo'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                  </svg>
                  <svg x-show="atividade.tipo === 'upgrade'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                  <svg x-show="atividade.tipo === 'cancelamento'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                  </svg>
                </div>
                <div>
                  <p class="font-medium" x-text="atividade.descricao"></p>
                  <p class="text-sm text-gray-500" x-text="formatarData(atividade.data)"></p>
                </div>
              </div>
              <span class="text-xs px-2 py-1 rounded-full"
                    :class="{
                      'bg-green-100 text-green-800': atividade.tipo === 'novo',
                      'bg-blue-100 text-blue-800': atividade.tipo === 'upgrade',
                      'bg-red-100 text-red-800': atividade.tipo === 'cancelamento'
                    }"
                    x-text="atividade.tipo">
              </span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <script>
    function adminDashboard() {
      return {
        kpis: null,
        loading: true,

        async init() {
          await this.carregarDados();
          // Refresh a cada 30s
          setInterval(() => this.carregarDados(), 30000);
        },

        async carregarDados() {
          const token = localStorage.getItem('adminToken');
          if (!token) {
            window.location.href = '/admin/login';
            return;
          }

          try {
            const response = await fetch('/functions/v1/admin-dashboard', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            });

            if (response.status === 401) {
              localStorage.removeItem('adminToken');
              window.location.href = '/admin/login';
              return;
            }

            this.kpis = await response.json();
          } catch (err) {
            console.error('Erro ao carregar dashboard:', err);
          } finally {
            this.loading = false;
          }
        },

        formatarMoeda(valor) {
          return (valor / 100).toFixed(2);
        },

        formatarData(data) {
          return new Date(data).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });
        },

        logout() {
          localStorage.removeItem('adminToken');
          window.location.href = '/admin/login';
        }
      };
    }
  </script>
</body>
</html>
```

---

## 👥 Profissionais

### profissionais.html

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profissionais - Admin</title>
  <link rel="stylesheet" href="/dist/styles/output.css">
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js"></script>
</head>
<body>
  <div x-data="adminProfissionais()">
    <!-- Header -->
    <header class="bg-white border-b px-6 py-4">
      <div class="flex items-center justify-between max-w-7xl mx-auto">
        <div class="flex items-center gap-4">
          <a href="/admin/dashboard" class="text-gray-600 hover:text-gray-900">← Voltar</a>
          <h1 class="text-2xl font-bold">Profissionais</h1>
        </div>
      </div>
    </header>

    <!-- Filters -->
    <div class="bg-white border-b px-6 py-4">
      <div class="max-w-7xl mx-auto flex flex-col md:flex-row gap-4">
        <div class="flex-1">
          <input
            type="text"
            x-model="filtros.busca"
            placeholder="Buscar por nome ou email..."
            class="input"
          >
        </div>
        <select x-model="filtros.plano" class="input md:w-48">
          <option value="">Todos os planos</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
        <select x-model="filtros.status" class="input md:w-48">
          <option value="">Todos os status</option>
          <option value="trial">Trial</option>
          <option value="ativo">Ativo</option>
          <option value="inadimplente">Inadimplente</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="p-6 max-w-7xl mx-auto">
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profissional
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plano
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agendamentos
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
              <template x-for="prestador in profissionaisFiltrados" :key="prestador.id">
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span class="text-blue-600 font-semibold" x-text="prestador.nome.charAt(0)"></span>
                      </div>
                      <div class="ml-4">
                        <p class="text-sm font-medium text-gray-900" x-text="prestador.nome"></p>
                        <p class="text-sm text-gray-500" x-text="prestador.email"></p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="px-2 py-1 text-xs font-medium rounded-full"
                      :class="{
                        'bg-green-100 text-green-800': prestador.plano === 'pro',
                        'bg-gray-100 text-gray-800': prestador.plano === 'free',
                        'bg-purple-100 text-purple-800': prestador.trial_ends_at && new Date(prestador.trial_ends_at) > new Date()
                      }"
                      x-text="prestador.plano === 'pro' ? 'Pro' : (prestador.trial_ends_at && new Date(prestador.trial_ends_at) > new Date() ? 'Trial' : 'Grátis')">
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span x-text="prestador.total_agendamentos || 0"></span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="px-2 py-1 text-xs font-medium rounded-full"
                      :class="{
                        'bg-green-100 text-green-800': prestador.status === 'ativo',
                        'bg-yellow-100 text-yellow-800': prestador.status === 'trial',
                        'bg-red-100 text-red-800': prestador.status === 'inadimplente'
                      }"
                      x-text="prestador.status">
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button @click="verDetalhes(prestador)" class="text-blue-600 hover:text-blue-900 mr-3">
                      Detalhes
                    </button>
                    <button @click="susender(prestador)" class="text-red-600 hover:text-red-900">
                      Suspender
                    </button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div x-show="profissionaisFiltrados.length === 0" class="text-center py-12">
          <p class="text-gray-500">Nenhum profissional encontrado</p>
        </div>

        <!-- Pagination -->
        <div x-show="profissionaisFiltrados.length > 0" class="bg-white px-4 py-3 border-t flex items-center justify-between">
          <p class="text-sm text-gray-700">
            Mostrando <span class="font-medium" x-text="paginacao.offset + 1"></span>
            a <span class="font-medium" x-text="Math.min(paginacao.offset + paginacao.limit, profissionaisFiltrados.length)"></span>
            de <span class="font-medium" x-text="profissionaisFiltrados.length"></span> resultados
          </p>
          <div class="flex gap-2">
            <button
              @click="paginacao.anterior()"
              :disabled="paginacao.offset === 0"
              class="btn btn-secondary btn-sm"
              :disabled="paginacao.offset === 0"
            >
              Anterior
            </button>
            <button
              @click="paginacao.proximo()"
              :disabled="(paginacao.offset + paginacao.limit) >= profissionaisFiltrados.length"
              class="btn btn-secondary btn-sm"
              :disabled="(paginacao.offset + paginacao.limit) >= profissionaisFiltrados.length"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function adminProfissionais() {
      return {
        profissionais: [],
        loading: true,
        filtros: {
          busca: '',
          plano: '',
          status: ''
        },
        paginacao: {
          offset: 0,
          limit: 20
        },

        get profissionaisFiltrados() {
          return this.profissionais.filter(p => {
            const matchBusca = !this.filtros.busca ||
              p.nome.toLowerCase().includes(this.filtros.busca.toLowerCase()) ||
              p.email.toLowerCase().includes(this.filtros.busca.toLowerCase());

            const matchPlano = !this.filtros.plano || p.plano === this.filtros.plano;

            const matchStatus = !this.filtros.status || p.status === this.filtros.status;

            return matchBusca && matchPlano && matchStatus;
          });
        },

        async init() {
          await this.carregarProfissionais();
        },

        async carregarProfissionais() {
          const token = localStorage.getItem('adminToken');
          if (!token) {
            window.location.href = '/admin/login';
            return;
          }

          try {
            const response = await fetch('/functions/v1/admin-profissionais', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                busca: this.filtros.busca,
                plano: this.filtros.plano,
                status: this.filtros.status,
                offset: this.paginacao.offset,
                limit: this.paginacao.limit
              })
            });

            if (response.status === 401) {
              localStorage.removeItem('adminToken');
              window.location.href = '/admin/login';
              return;
            }

            const data = await response.json();
            this.profissionais = data.profissionais || [];
          } catch (err) {
            console.error('Erro ao carregar profissionais:', err);
          } finally {
            this.loading = false;
          }
        },

        verDetalhes(prestador) {
          // Implementar modal de detalhes
          console.log('Ver detalhes:', prestador);
        },

        suspender(prestador) {
          if (confirm(`Suspender ${prestador.nome}?`)) {
            // Implementar suspensão
            console.log('Suspender:', prestador);
          }
        }
      };
    }
  </script>
</body>
</html>
```

---

## ✅ Checklist

### Login

- [ ] Formulário com Alpine
- [ ] Validação de senha
- [ ] Loading state
- [ ] Tratamento de erros
- [ ] Redirecionamento

### Dashboard

- [ ] KPIs exibidos
- [ ] Gráfico de crescimento
- [ ] Atividades recentes
- [ ] Auto-refresh a cada 30s
- [ ] Responsivo

### Profissionais

- [ ] Lista com busca
- [ ] Filtros por plano/status
- [ ] Paginação
- [ ] Ações (detalhes, suspender)
- [ ] Empty state

### Financeiro

- [ ] Métricas financeiras
- [ ] Gráficos de receita
- [ ] Lista de pagamentos
- [ ] Filtros de período

### Ações

- [ ] Suspensão em lote
- [ ] Ativação em lote
- [ ] Extensão de trial

### Configurações

- [ ] Status do sistema
- [ ] Variáveis de ambiente
- [ ] Logs de erros

---

## 📚 Próximos Passos

Após completar esta fase, você está pronto para:

1. **FASE 6:** Limpeza e Deploy
2. Remover código legado
3. Deploy para produção

Veja [CHECKLIST.md](./CHECKLIST.md) para fase final

---

**Tempo estimado:** 40-56 horas (5-7 dias)
**Dificuldade:** Média
**Pré-requisitos:** FASE 4 completada

**Finalizado em:** ___/___/___
**Por:** ____________
