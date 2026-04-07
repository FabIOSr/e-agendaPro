# ✅ Checklist de Migração

> Acompanhamento dia a dia da migração para Alpine.js + Tailwind + TypeScript

---

## 📋 Como Usar Este Checklist

- [ ] Marcar itens conforme completados
- [ ] Atualizar datas de conclusão
- [ ] Documentar blockers nos comentários
- [ ] Revisar semanalmente com a equipe

---

## 🚀 FASE 1: Setup Inicial (1 dia)

**Início:** ___/___/___
**Fim:** ___/___/___
**Responsável:** ____________

### Instalação de Dependências

- [ ] `npm install -D tailwindcss postcss autoprefixer alpinejs`
- [ ] `npm install -D typescript @types/node`
- [ ] Verificar package.json atualizado

### Arquivos de Configuração

- [ ] `tailwind.config.js` criado
- [ ] `postcss.config.js` criado
- [ ] `tsconfig.json` criado
- [ ] `src/styles/input.css` criado com @tailwind directives

### Build Process

- [ ] `build.js` atualizado com Tailwind CLI
- [ ] `package.json` scripts atualizados
  - [ ] `build:css`
  - [ ] `build:ts`
  - [ ] `dev:watch`
- [ ] Testar `npm run build` - deve funcionar sem erros
- [ ] Testar `npm run dev` - servidor deve iniciar

### Validação

- [ ] Criar página teste com classes Tailwind
- [ ] Verificar se output.css é gerado
- [ ] Verificar se TypeScript compila
- [ ] Commit: `feat: setup tailwind, alpine e typescript`

**Bloqueios:**
```
// Documentar qualquer problema encontrado
```

---

## 🎨 FASE 2: Tailwind CSS (5-7 dias)

**Início:** ___/___/___
**Fim:** ___/___/___
**Responsável:** ____________

### Dia 1-2: Páginas Públicas

#### Landing Page

- [ ] Analisar CSS atual da landing page
- [ ] Migrar hero section para Tailwind
- [ ] Migrar features section para Tailwind
- [ ] Migrar CTA section para Tailwind
- [ ] Migrar footer para Tailwind
- [ ] Comparar visual com original (screenshot)
- [ ] Remover CSS antigo da landing page

#### Página Cliente

- [ ] Analisar CSS atual da página cliente
- [ ] Migrar header para Tailwind
- [ ] Migrar wizard de agendamento para Tailwind
- [ ] Migrar cards de serviço para Tailwind
- [ ] Migrar seleção de data para Tailwind
- [ ] Comparar visual com original
- [ ] Remover CSS antigo da página cliente

#### Auth

- [ ] Migrar página de login para Tailwind
- [ ] Migrar página de cadastro para Tailwind
- [ ] Migrar página de recuperação de senha para Tailwind
- [ ] Testar fluxo completo de auth

**Bloqueios:**
```
//
```

### Dia 3-4: Páginas Autenticadas

#### Onboarding

- [ ] Migrar step 1 para Tailwind
- [ ] Migrar step 2 para Tailwind
- [ ] Migrar step 3 para Tailwind
- [ ] Migrar step 4 para Tailwind
- [ ] Testar wizard completo

#### Painel Prestador

- [ ] Migrar header/sidebar para Tailwind
- [ ] Migrar cards de KPI para Tailwind
- [ ] Migrar lista de agendamentos para Tailwind
- [ ] Migrar filtros para Tailwind
- [ ] Testar responsividade

#### Relatórios

- [ ] Migrar tabela de clientes para Tailwind
- [ ] Migrar gráficos (se houver) para Tailwind
- [ ] Migrar filtros de data para Tailwind
- [ ] Testar exportação (se houver)

**Bloqueios:**
```
//
```

### Dia 5-7: Páginas Secundárias

- [ ] Tela de planos migrada
- [ ] Configurações migrada
- [ ] Cancelamento configurado migrado
- [ ] Reagendar cliente migrado
- [ ] Avaliações migrado
- [ ] Todas as páginas públicas testadas
- [ ] Todas as páginas autenticadas testadas

### Limpeza CSS

- [ ] Listar todos os arquivos .css
- [ ] Verificar se nenhum está sendo usado
- [ ] Remover arquivos CSS antigos
- [ ] Verificar se output.css tem tudo necessário
- [ ] Commit: `feat: migrar css para tailwind`

**Bloqueios:**
```
//
```

---

## ⚡ FASE 3: Alpine.js (3-5 dias)

**Início:** ___/___/___
**Fim:** ___/___/___
**Responsável:** ____________

### Dia 1: Setup + Auth

#### Setup

- [ ] Adicionar Alpine CDN ao HTML base
- [ ] Criar component base para testes
- [ ] Testar reatividade básica

#### Auth Form

- [ ] Converter login para Alpine
- [ ] Converter cadastro para Alpine
- [ ] Adicionar validações em tempo real
- [ ] Adicionar loading states
- [ ] Testar fluxo completo

**Bloqueios:**
```
//
```

### Dia 2-3: Fluxo de Agendamento

#### Componente Wizard

- [ ] Criar componente `agendamentoWizard()`
- [ ] Step 1: Seleção de serviço
  - [ ] Listar serviços com Alpine
  - [ ] Seleção com highlight visual
  - [ ] Navegação para próximo step
- [ ] Step 2: Seleção de data
  - [ ] Calendar interativo
  - [ ] Seleção visual de datas
  - [ ] Validação de disponibilidade
- [ ] Step 3: Seleção de horário
  - [ ] Grid de slots com Alpine
  - [ ] Estados disponível/ocupado
  - [ ] Seleção visual
- [ ] Step 4: Dados do cliente
  - [ ] Form com validações
  - [ ] Máscara de telefone
  - [ ] Loading state no submit
- [ ] Step 5: Confirmação
  - [ ] Resumo do agendamento
  - [ ] Animação de sucesso
  - [ ] Opção de novo agendamento

#### Testes

- [ ] Fluxo completo testado
- [ ] Validações testadas
- [ ] Estados de loading testados
- [ ] Casos de erro testados

**Bloqueios:**
```
//
```

### Dia 4-5: Painel Prestador

#### Dashboard

- [ ] Criar componente `dashboardPrestador()`
- [ ] KPIs reativos
- [ ] Lista de agendamentos
- [ ] Filtros funcionais
- [ ] Modais de detalhes
- [ ] Toast notifications

#### Features

- [ ] Quick actions funcionando
- [ ] Navegação entre datas
- [ ] Cancelamento de agendamento
- [ ] Reagendamento
- [ ] Filtros de status

**Bloqueios:**
```
//
```

### Validação Final

- [ ] Zero `document.getElementById` em código novo
- [ ] Zero `addEventListener` em código novo
- [ ] Todos os formulários com Alpine
- [ ] Testes E2E passando
- [ ] Commit: `feat: adicionar alpine.js`

---

## 🔷 FASE 4: TypeScript (5-7 dias)

**Início:** ___/___/___
**Fim:** ___/___/___
**Responsável:** ____________

### Dia 1-2: Tipos Base

- [ ] Criar `modules/types/index.ts`
- [ ] Definir interface `Prestador`
- [ ] Definir interface `Agendamento`
- [ ] Definir interface `Servico`
- [ ] Definir interface `Disponibilidade`
- [ ] Definir interface `Bloqueio`
- [ ] Definir interface `Slot`
- [ ] Criar tipos para API
- [ ] Criar tipos para Forms

**Bloqueios:**
```
//
```

### Dia 3-4: Módulos Core

#### scheduling-rules

- [ ] Renomear `.js` para `.ts`
- [ ] Adicionar tipos aos parâmetros
- [ ] Adicionar tipo de retorno
- [ ] Corrigir erros do TypeScript
- [ ] Testar funcionalidade

#### auth-session

- [ ] Renomear `.js` para `.ts`
- [ ] Tipar `Prestador`
- [ ] Tipar `Session`
- [ ] Tipar funções exportadas
- [ ] Testar auth

#### Outros Módulos

- [ ] `agendamento-response.ts` migrado
- [ ] `asaas-webhook-rules.ts` migrado
- [ ] `ui-helpers.ts` migrado (se houver)
- [ ] `lista-espera-rules.ts` migrado

**Bloqueios:**
```
//
```

### Dia 5-6: Handlers

- [ ] `criar-agendamento-handler.ts` migrado
- [ ] `webhook-asaas-handler.ts` migrado
- [ ] `cancelar-handler.ts` migrado
- [ ] `reagendar-handler.ts` migrado
- [ ] Tipar request/response
- [ ] Tipar deps
- [ ] Testar handlers

**Bloqueios:**
```
//
```

### Dia 7: Testes

- [ ] Renomear testes `.js` para `.ts`
- [ ] Atualizar imports
- [ ] Corrigir erros de tipo
- [ ] `npm test` passando
- [ ] `tsc --noEmit` sem erros
- [ ] Commit: `feat: migrar para typescript`

**Bloqueios:**
```
//
```

---

## 🛠️ FASE 5: Painel Admin (5-7 dias)

**Início:** ___/___/___
**Fim:** ___/___/___
**Responsável:** ____________

### Páginas

- [ ] Login admin com Alpine
- [ ] Dashboard admin com Alpine
- [ ] Profissionais com Alpine
- [ ] Financeiro com Alpine
- [ ] Ações com Alpine
- [ ] Configurações com Alpine
- [ ] Todas com Tailwind
- [ ] Testes E2E admin passando
- [ ] Commit: `feat: migrar admin para alpine`

**Bloqueios:**
```
//
```

---

## 🧹 FASE 6: Limpeza e Deploy

**Início:** ___/___/___
**Fim:** ___/___/___

### Limpeza

- [ ] Remover arquivos CSS antigos
- [ ] Remover `.js` não migrados
- [ ] Verificar imports quebrados
- [ ] Limpar node_modules
- [ ] `npm ci` para garantir

### Otimizações

- [ ] Verificar bundle size
- [ ] Optimizar imagens
- [ ] Minificar HTML
- [ ] Configurar cache headers

### Testes Finais

- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse Best Practices ≥ 90
- [ ] Lighthouse SEO ≥ 95
- [ ] Todos os testes E2E passando
- [ ] Testes manuais completos

### Deploy

- [ ] Build de produção
- [ ] Deploy para staging
- [ ] Testes em staging
- [ ] Deploy para produção
- [ ] Smoke tests em produção
- [ ] Monitorar por 24h

### Documentação

- [ ] Atualizar README.md
- [ ] Atualizar documentação de API
- [ ] Criar guia de contribuição
- [ ] Documentar componentes Tailwind
- [ ] Commit: `docs: atualizar docs pos-migracao`

---

## 📊 Métricas de Progresso

### Por Fase

| Fase | Itens | Completos | % |
|------|-------|-----------|---|
| Setup | 10 | _ | _% |
| Tailwind | 25 | _ | _% |
| Alpine | 20 | _ | _% |
| TypeScript | 20 | _ | _% |
| Admin | 10 | _ | _% |
| Limpeza | 15 | _ | _% |
| **TOTAL** | **100** | **_** | **_%** |

### Por Arquivo

**Páginas:** __/15 migradas
**Módulos:** __/12 migrados
**Handlers:** __/4 migrados
**Testes:** __/10 migrados

---

## 🚨 Bloqueios Ativos

```
Data: ___/___/___
Bloqueio: _________________________
Impacto: _________________________
Ação: _____________________________
Responsável: ______________________
Resolvido: [ ] sim [ ] não
```

---

## 📝 Notas da Semana

### Semana 1 (___/___ a ___/___)

```
Conquistas:

Problemas:

Aprendizados:

Próxima semana:
```

### Semana 2 (___/___ a ___/___)

```
Conquistas:

Problemas:

Aprendizados:

Próxima semana:
```

### Semana 3 (___/___ a ___/___)

```
Conquistas:

Problemas:

Aprendizados:

Próxima semana:
```

### Semana 4 (___/___ a ___/___)

```
Conquistas:

Problemas:

Aprendizados:

Retrospectiva:
```

---

## ✅ Critérios de Conclusão

A migração está completa quando:

- [ ] Todas as fases estão 100% completas
- [ ] Zero arquivos CSS manuais restantes
- [ ] Zero arquivos `.js` nos módulos
- [ ] Todos os testes passando
- [ ] Lighthouse score ≥ 90 em todas as métricas
- [ ] Deploy em produção funcionando
- [ ] Documentação atualizada
- [ ] Time treinado

**Data de conclusão:** ___/___/___
**Assinatura do responsável:** ____________

---

**Documento version:** 1.0
**Atualizar diariamente durante a migração**
