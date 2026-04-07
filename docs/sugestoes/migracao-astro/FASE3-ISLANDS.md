# 🏝️ FASE 3: Islands Interativas

> Criar componentes interativos usando Alpine.js e Islands Architecture

---

## 📋 Objetivos da Fase

1. Configurar Alpine.js como island
2. Criar wizard de agendamento interativo
3. Criar componentes de formulário
4. Integrar com Supabase

**Duração estimada:** 10 dias (Semanas 4-5)

---

## 🏝️ O que são Islands?

```
┌─────────────────────────────────────────────────────┐
│                    PÁGINA ASTRO                      │
│                                                      │
│   ┌─────────────────┐    ┌─────────────────┐      │
│   │   NAVBAR        │    │   FOOTER         │      │
│   │  (HTML estático)│    │  (HTML estático) │      │
│   └─────────────────┘    └─────────────────┘      │
│                                                      │
│   ┌─────────────────────────────────────────┐      │
│   │           HERO SECTION                   │      │
│   │         (HTML estático)                  │      │
│   └─────────────────────────────────────────┘      │
│                                                      │
│         ┌─────────────────────────────┐            │
│         │     WIZARD AGENDAMENTO       │            │
│         │      🏝️ ISLAND               │            │
│         │   client:load                │            │
│         │   (Alpine.js hydratado)      │            │
│         └─────────────────────────────┘            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Regra:** Apenas as islands carregam JavaScript. O resto é HTML puro.

---

## ⚙️ Passo 1: Configurar Alpine.js

### 1.1 Instalar plugin

```bash
npm install @astrojs/alpinejs alpinejs
```

### 1.2 Configurar astro.config.mjs

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import alpine from '@astrojs/alpinejs';

export default defineConfig({
  integrations: [
    tailwind({ applyBaseStyles: false }),
    alpine({ entrypoint: '/src/entrypoint.ts' }),
  ],
});
```

### 1.3 Criar entrypoint

```typescript
// src/entrypoint.ts
import type { Alpine } from 'alpinejs';

export default (Alpine: Alpine) => {
  // Registrar componentes globais
  Alpine.data('agendamentoWizard', () => ({
    step: 1,
    servicoSelecionado: null,
    dataSelecionada: null,
    horarioSelecionado: null,
    form: {
      nome: '',
      email: '',
      telefone: '',
    },
    
    async nextStep() {
      if (this.step < 5) this.step++;
    },
    
    prevStep() {
      if (this.step > 1) this.step--;
    },
    
    selecionarServico(servico) {
      this.servicoSelecionado = servico;
    },
    
    async buscarHorarios() {
      // Buscar via API
    },
    
    async submit() {
      // Enviar para Supabase
    },
  }));
};
```

---

## 🎯 Passo 2: Wizard de Agendamento

### 2.1 Estrutura do componente

```astro
---
// src/components/islands/AgendamentoWizard.astro
interface Props {
  prestadorId: string;
}

const { prestadorId } = Astro.props;
---

<div 
  x-data={`agendamentoWizard('${prestadorId}')`}
  class="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg"
>
  <!-- Progress Bar -->
  <div class="flex items-center justify-between mb-8">
    <template x-for="i in 5" :key="i">
      <div 
        class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
        :class="step >= i ? 'bg-lime text-ink' : 'bg-gray-200 text-gray-500'"
        x-text="i"
      ></div>
    </template>
  </div>

  <!-- Step 1: Serviço -->
  <div x-show="step === 1" x-transition>
    <h2 class="text-2xl font-bold mb-4">Escolha o serviço</h2>
    
    <div class="grid gap-4">
      <template x-for="servico in servicos" :key="servico.id">
        <button 
          @click="selecionarServico(servico)"
          class="p-4 border rounded-lg text-left hover:border-lime transition"
          :class="servicoSelecionado?.id === servico.id ? 'border-lime bg-lime/10' : 'border-gray-200'"
        >
          <div class="font-semibold" x-text="servico.nome"></div>
          <div class="text-muted text-sm">
            <span x-text="servico.duracao_min"></span> min
            <span x-if="servico.preco"> - R$ <span x-text="servico.preco"></span></span>
          </div>
        </button>
      </template>
    </div>
    
    <button 
      @click="nextStep()" 
      :disabled="!servicoSelecionado"
      class="mt-6 w-full py-3 bg-lime text-ink font-semibold rounded-lg disabled:opacity-50"
    >
      Continuar
    </button>
  </div>

  <!-- Step 2: Data -->
  <div x-show="step === 2" x-transition style="display: none;">
    <h2 class="text-2xl font-bold mb-4">Escolha a data</h2>
    
    <div class="grid grid-cols-7 gap-2 mb-4">
      <template x-for="dia in dias" :key="dia.data">
        <button
          @click="dataSelecionada = dia"
          class="p-3 text-center rounded-lg hover:bg-lime/10 transition"
          :class="dataSelecionada?.data === dia.data ? 'bg-lime text-ink' : ''"
        >
          <div class="text-xs text-muted" x-text="dia.diaSemana"></div>
          <div class="font-semibold" x-text="dia.dia"></div>
        </button>
      </template>
    </div>
    
    <div class="flex gap-4">
      <button @click="prevStep()" class="flex-1 py-3 border border-gray-200 rounded-lg">
        Voltar
      </button>
      <button 
        @click="nextStep()" 
        :disabled="!dataSelecionada"
        class="flex-1 py-3 bg-lime text-ink font-semibold rounded-lg disabled:opacity-50"
      >
        Continuar
      </button>
    </div>
  </div>

  <!-- Step 3: Horário -->
  <div x-show="step === 3" x-transition style="display: none;">
    <h2 class="text-2xl font-bold mb-4">Escolha o horário</h2>
    
    <div class="grid grid-cols-4 gap-2">
      <template x-for="slot in horarios" :key="slot.hora">
        <button
          @click="horarioSelecionado = slot"
          :disabled="!slot.disponivel"
          class="p-3 text-center rounded-lg transition"
          :class="!slot.disponivel ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : (horarioSelecionado?.hora === slot.hora ? 'bg-lime text-ink' : 'hover:bg-lime/10')"
        >
          <span x-text="slot.hora"></span>
        </button>
      </template>
    </div>
    
    <div class="flex gap-4 mt-6">
      <button @click="prevStep()" class="flex-1 py-3 border border-gray-200 rounded-lg">
        Voltar
      </button>
      <button 
        @click="nextStep()" 
        :disabled="!horarioSelecionado"
        class="flex-1 py-3 bg-lime text-ink font-semibold rounded-lg disabled:opacity-50"
      >
        Continuar
      </button>
    </div>
  </div>

  <!-- Step 4: Dados Cliente -->
  <div x-show="step === 4" x-transition style="display: none;">
    <h2 class="text-2xl font-bold mb-4">Seus dados</h2>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Nome completo</label>
        <input 
          type="text" 
          x-model="form.nome"
          class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lime focus:border-transparent"
          placeholder="Seu nome"
        >
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-1">WhatsApp</label>
        <input 
          type="tel" 
          x-model="form.telefone"
          class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lime focus:border-transparent"
          placeholder="(00) 00000-0000"
        >
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-1">Email (opcional)</label>
        <input 
          type="email" 
          x-model="form.email"
          class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lime focus:border-transparent"
          placeholder="seu@email.com"
        >
      </div>
    </div>
    
    <div class="flex gap-4 mt-6">
      <button @click="prevStep()" class="flex-1 py-3 border border-gray-200 rounded-lg">
        Voltar
      </button>
      <button 
        @click="nextStep()" 
        :disabled="!form.nome || !form.telefone"
        class="flex-1 py-3 bg-lime text-ink font-semibold rounded-lg disabled:opacity-50"
      >
        Continuar
      </button>
    </div>
  </div>

  <!-- Step 5: Confirmação -->
  <div x-show="step === 5" x-transition style="display: none;">
    <h2 class="text-2xl font-bold mb-4">Confirmar agendamento</h2>
    
    <div class="bg-paper-2 p-4 rounded-lg mb-4">
      <div class="flex justify-between mb-2">
        <span class="text-muted">Serviço:</span>
        <span class="font-semibold" x-text="servicoSelecionado?.nome"></span>
      </div>
      <div class="flex justify-between mb-2">
        <span class="text-muted">Data:</span>
        <span class="font-semibold" x-text="dataSelecionada?.formatada"></span>
      </div>
      <div class="flex justify-between mb-2">
        <span class="text-muted">Horário:</span>
        <span class="font-semibold" x-text="horarioSelecionado?.hora"></span>
      </div>
      <div class="flex justify-between">
        <span class="text-muted">Cliente:</span>
        <span class="font-semibold" x-text="form.nome"></span>
      </div>
    </div>
    
    <div class="flex gap-4">
      <button @click="prevStep()" class="flex-1 py-3 border border-gray-200 rounded-lg">
        Voltar
      </button>
      <button 
        @click="submit()" 
        :disabled="submitting"
        class="flex-1 py-3 bg-lime text-ink font-semibold rounded-lg disabled:opacity-50"
      >
        <span x-show="!submitting">Confirmar</span>
        <span x-show="submitting">Enviando...</span>
      </button>
    </div>
  </div>
</div>
```

### 2.2 Usar no cliente/[slug].astro

```astro
---
// src/pages/cliente/[slug].astro
import LayoutBase from '../../layouts/LayoutBase.astro';
import AgendamentoWizard from '../../components/islands/AgendamentoWizard.astro';

const { slug } = Astro.params;
---

<LayoutBase title="Agende agora">
  <div class="min-h-screen bg-paper py-12 px-4">
    <AgendamentoWizard prestadorId={slug} />
  </div>
</LayoutBase>
```

---

## 📝 Passo 3: Formulário de Login

### 3.1 Componente

```astro
---
// src/components/islands/FormLogin.astro
---

<div x-data="formLogin()" class="max-w-md mx-auto p-6">
  <!-- Toggle Login/Cadastro -->
  <div class="flex mb-6 bg-paper-2 rounded-lg p-1">
    <button 
      @click="modo = 'login'"
      class="flex-1 py-2 rounded-md text-sm font-medium transition"
      :class="modo === 'login' ? 'bg-white shadow text-ink' : 'text-muted'"
    >
      Login
    </button>
    <button 
      @click="modo = 'cadastro'"
      class="flex-1 py-2 rounded-md text-sm font-medium transition"
      :class="modo === 'cadastro' ? 'bg-white shadow text-ink' : 'text-muted'"
    >
      Cadastro
    </button>
  </div>

  <!-- Formulário -->
  <form @submit.prevent="submit()">
    <div class="space-y-4">
      <div x-show="modo === 'cadastro'">
        <label class="block text-sm font-medium mb-1">Nome</label>
        <input type="text" x-model="form.nome" class="w-full px-4 py-3 border rounded-lg">
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input type="email" x-model="form.email" class="w-full px-4 py-3 border rounded-lg">
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-1">Senha</label>
        <input type="password" x-model="form.senha" class="w-full px-4 py-3 border rounded-lg">
      </div>
    </div>
    
    <button 
      type="submit"
      class="w-full mt-6 py-3 bg-lime text-ink font-semibold rounded-lg hover:bg-lime-dark transition"
    >
      <span x-show="modo === 'login'">Entrar</span>
      <span x-show="modo === 'cadastro'">Criar conta</span>
    </button>
  </form>
  
  <!-- Erro -->
  <div x-show="erro" x-transition class="mt-4 p-3 bg-rust/10 text-rust rounded-lg text-sm">
    <span x-text="erro"></span>
  </div>
</div>
```

---

## 🔌 Passo 4: Integração API

### 4.1 Client-side API

```typescript
// src/lib/api.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON
);

export async function buscarServicos(prestadorId: string) {
  const { data, error } = await supabase
    .from('servicos')
    .select('*')
    .eq('prestador_id', prestadorId)
    .eq('ativo', true);
  
  if (error) throw error;
  return data;
}

export async function criarAgendamento(dados: any) {
  const { data, error } = await supabase
    .from('agendamentos')
    .insert(dados)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function buscarHorariosDisponiveis(
  prestadorId: string,
  servicoId: string,
  data: string
) {
  // Implementar lógica de disponibilidade
}
```

---

## ⚡ Diretivas de Hydration

| Directive | Quando carrega | Uso |
|-----------|-----------------|-----|
| `client:load` | Imediato | Islands principais (wizard) |
| `client:idle` | Quando CPU ociosa | Componentes secundários |
| `client:visible` | Quando visível | Componentes abaixo da dobra |
| `client:media` | Quando.matches media | Responsive |

### Exemplo

```astro
<!-- Carrega imediato -->
<AgendamentoWizard client:load prestadorId="123" />

<!-- Carrega quando visível -->
<FormNewsletter client:visible />

<!-- Carrega quando CPU idle -->
<ToastNotifications client:idle />
```

---

## ✅ Checklist da Fase

### Configuração

- [ ] Alpine.js configurado no Astro
- [ ] Entrypoint criado com componentes
- [ ] Types configurados

### Componentes

- [ ] AgendamentoWizard.astro
- [ ] FormLogin.astro
- [ ] Calendario.astro
- [ ] ToastNotifications.astro

### Integração

- [ ] Supabase client configurado
- [ ] API functions criadas
- [ ] Testes de integração

### Validação

- [ ] Wizard completo funcionando
- [ ] Formulários validando
- [ ] API respondendo

---

## 📚 Próximos Passos

1. **FASE 4:** Migrar painel admin
2. Configurar deploy
3. Testes finais

---

**Duração:** 10 dias
**Responsável:** ____________
**Início:** ___/___/___
**Fim:** ___/___/___
