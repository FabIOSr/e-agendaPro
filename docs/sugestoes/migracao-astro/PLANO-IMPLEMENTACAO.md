# 📅 Plano de Implementação - Migração Astro

> Roadmap detalhado para migração do AgendaPro para Astro Framework

---

## 🎯 Visão Geral

| Aspecto | Detalhe |
|---------|---------|
| **Objetivo** | Modernizar frontend com Astro + Islands Architecture |
| **Duração** | 6-8 semanas |
| **Equipa Mínima** | 1 desenvolvedor |
| **Risco** | Médio |

---

## 📊 Fases do Projeto

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGRAÇÃO AGENDAPRO → ASTRO                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FASE 1      FASE 2         FASE 3         FASE 4      FASE 5   │
│  Setup       Layouts        Islands        Admin       Deploy   │
│  ↓           ↓              ↓              ↓           ↓        │
│  Semana 1    Semana 2-3     Semana 4-5     Semana 6    Semana 7│
│  5 dias      10 dias        10 dias        5 dias     5 dias   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Detalhamento por Fase

### FASE 1: Setup (Semana 1)

| Dia | Tarefa | Entregável |
|-----|--------|------------|
| 1 | Instalar Astro CLI | Ambiente configurado |
| 2 | Configurar Tailwind CSS | tailwind.config.js |
| 3 | Configurar TypeScript | tsconfig.json |
| 4 | Configurar Firebase Adapter | firebase.json atualizado |
| 5 | Validar build inicial | Projeto compilando |

**Entregável da Fase:** Projeto Astro rodando localmente

---

### FASE 2: Layouts e Páginas Estáticas (Semanas 2-3)

| Dia | Tarefa | Entregável |
|-----|--------|------------|
| 6-7 | Criar layouts base | Layout principal criado |
| 8-9 | Migrar landing page | landing-page.astro |
| 10-11 | Migrar páginas públicas | planos, auth, confirmar-reserva |
| 12-13 | Migrar página cliente | pagina-cliente.astro |
| 14 | Migrar onboarding | onboarding.astro |

**Entregável da Fase:** Todas as páginas públicas migradas para Astro

---

### FASE 3: Islands Interativas (Semanas 4-5)

| Dia | Tarefa | Entregável |
|-----|--------|------------|
| 15-16 | Setup Alpine islands | Alpine configurado |
| 17-18 | Criar wizard de agendamento | IslandAgendamento.astro |
| 19-20 | Criar componentes de form | Islands de formulários |
| 21-22 | Integrar com Supabase | Client-side islands |
| 23-24 | Testar interatividade | Todas as islands funcionado |

**Entregável da Fase:** Formulários interativos com islands

---

### FASE 4: Painel Admin (Semana 6)

| Dia | Tarefa | Entregável |
|-----|--------|------------|
| 25-26 | Migrar dashboard | admin/dashboard.astro |
| 27-28 | Migrar configurações | admin/configuracoes.astro |
| 29-30 | Migrar listagens | admin/* listagens |
| 31 | Testes admin | Painel funcionando |
| 32 | Correções | Bugs corrigidos |

**Entregável da Fase:** Painel admin completo

---

### FASE 5: Deploy e Otimização (Semana 7-8)

| Dia | Tarefa | Entregável |
|-----|--------|------------|
| 33-34 | Configurar Firebase deploy | firebase.json configurado |
| 35-36 | SEO e meta tags | Meta tags em todas as páginas |
| 37-38 | Otimizações Lighthouse | Lighthouse 90+ |
| 39-40 | Testes E2E | Todos os testes passando |
| 41-42 | Deploy produção | Sistema em produção |

**Entregável da Fase:** Sistema em produção

---

## 🎯 Marcos (Milestones)

| Sem | Marco | Critério de Sucesso |
|-----|-------|---------------------|
| 1 | **Setup Completo** | Astro rodando localmente com Tailwind |
| 2 | **Layouts Prontos** | Páginas públicas em Astro |
| 3 | **Islands Funcionando** | Wizard de agendamento interativo |
| 4 | **Admin Migrado** | Painel admin completo |
| 5 | **Deploy Production** | Sistema no ar com Lighthouse 90+ |

---

## 📦 Estrutura de Arquivos Proposta

```
agendapro/
├── src/
│   ├── components/
│   │   ├── islands/
│   │   │   ├── AgendamentoWizard.astro
│   │   │   ├── Calendario.astro
│   │   │   ├── FormContato.astro
│   │   │   └── Toast.astro
│   │   └── ui/
│   │       ├── Button.astro
│   │       ├── Card.astro
│   │       └── Input.astro
│   ├── layouts/
│   │   ├── LayoutBase.astro
│   │   ├── LayoutAdmin.astro
│   │   └── LayoutLanding.astro
│   ├── pages/
│   │   ├── index.astro          (landing-page.html)
│   │   ├── planos.astro
│   │   ├── auth.astro
│   │   ├── cliente/
│   │   │   ├── [slug].astro
│   │   │   └── agendamento.astro
│   │   └── admin/
│   │       ├── index.astro
│   │       ├── dashboard.astro
│   │       └── configuracoes.astro
│   ├── styles/
│   │   └── global.css
│   └── types/
│       └── index.ts
├── public/
│   └── (arquivos estáticos)
├── astro.config.mjs
├── tailwind.config.mjs
└── tsconfig.json
```

---

## 🔧 Dependências e Ferramentas

| Pacote | Versão | Purpose |
|--------|--------|---------|
| astro | ^5.0 | Framework principal |
| @astrojs/tailwind | ^6.0 | Integração Tailwind |
| @astrojs/alpinejs | ^0.4 | Integração Alpine |
| @astrojs/firebase | ^0.3 | Firebase adapter |
| tailwindcss | ^3.4 | CSS framework |
| alpinejs | ^3.14 | Interatividade |

---

## 📊 Critérios de Progresso

| Métrica | Sem 1 | Sem 2 | Sem 3 | Sem 4 | Sem 5 | Sem 6-8 |
|---------|-------|-------|-------|-------|-------|---------|
| Páginas Astro | 1 | 5 | 10 | 15 | 15 | 20 |
| Islands | 0 | 2 | 5 | 8 | 8 | 10 |
| Lighthouse | - | 70 | 80 | 85 | 90 | 95 |

---

## 🚨 Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|----------|-----------|
| Curva de aprendizado Astro | Alta | Médio | Treinamento prévio |
| Regressões visuais | Média | Alto | Screenshots comparação |
| Problemas de deploy | Baixa | Alto | Rollback procedure doc |
| Performance islands | Média | Médio | Lazy loading config |

---

## 📝 Pré-requisitos

- [ ] Node.js 18+ instalado
- [ ] Acesso ao Firebase project
- [ ] Acesso ao Supabase project
- [ ] Ambiente de desenvolvimento configurado
- [ ] Backup do código atual

---

## 📚 Arquivos Relacionados

- [RESUMO-EXECUTIVO](./RESUMO-EXECUTIVO.md) - Visão geral
- [ARQUITETURA](./ARQUITETURA.md) - Detalhes técnicos
- [FASE1-SETUP](./FASE1-SETUP.md) - Guia de configuração
- [CHECKLIST](./CHECKLIST.md) - Acompanhamento

---

**Última atualização:** 2026-04-06
**Próxima revisão:** Semanal
