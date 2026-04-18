# Changelog

All notable changes to the AgendaPro project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2026-04-18

#### FASE 6: Testes Finais - 100% Aprovado 🎉
- **56 testes E2E criados e validados** com Playwright
  - `new-layout-consistencia.spec.ts` (11 testes) - Consistência cross-page
  - `new-layout-mobile.spec.ts` (35 testes) - Responsividade mobile/tablet
  - `new-layout-darkmode.spec.ts` (10 testes) - Dark mode sem FOUC
  - **Resultado: 56/56 testes passando (100%)**

- **Seletores CSS validados e documentados**
  - IDs específicos: `#themeToggle`, `#sidebarToggle`, `#avatar-initials`, `#user-menu`
  - Classes validadas: `nav.show-mobile-only`, `.mini-cal`, `#mobile-mini-cal`
  - Documentação completa em `TESTE-SELETORES.md`

- **Validações realizadas:**
  - ✅ Logo consistente em todas as páginas
  - ✅ Theme toggle funcional em todas
  - ✅ Avatar com dropdown funcional
  - ✅ Sidebar existente (desktop) / oculta (mobile)
  - ✅ Mobile bottom nav funcionando
  - ✅ Configurações tabs navigation
  - ✅ Serviços responsivos sem quebra de linha
  - ✅ Tablet layout (769px+) validado
  - ✅ Zero FOUC em dark mode
  - ✅ Theme persistence validado
  - ✅ Contraste WCAG AA adequado

- **Documentação criada:**
  - `TESTE-SELETORES.md` - Guia de seletores reais
  - `TESTE-RESUMO-FINAL.md` - Resumo executivo
  - `TESTE-RESULTADO-FINAL.md` - Resultado 100%

- **Status:**
  - ✅ FASE 0-6 COMPLETAS
  - 🚀 **Migração para novo layout 100% finalizada!**

#### FASE 5: planos.html - Landing Page Mantida
- **Decisão de manter planos.html como landing page** (sem migração para App Shell)
  - Página de conversão (upgrade) funciona melhor sem sidebar
  - Topbar simples preservada (Logo + Nome + Voltar)
  - Funcionalidade ASAAS intacta (Pix, Cartão, Boleto)
  - Design system já utilizado via variáveis CSS

- **Documentação de Cores**
  - Adicionados comentários Tailwind em `src/style.css`
  - Mapeamento completo: `stone-*` para backgrounds/text/borders
  - Cores customizadas documentadas: lime (#c8f060), teal (#5DCAA5), rust (#c84830), blue (#60b0f0), purple (#b060f0)
  - Light theme e dark theme com referências Tailwind

- **Status:**
  - ✅ FASE 0-5 completas
  - ⏳ FASE 6: Testes finais pendente

#### FASE 4: configuracoes.html Migration
- **Configurações page migrada para novo layout unificado**
  - App Shell aplicado (topbar unificada, sidebar colapsável, bottom nav mobile)
  - Sistema de tabs navigation para 8 seções (Perfil, Serviços, Galeria, Agenda, Notificações, Plano, Senha, Conta)
  - Desktop: ícone + texto, Mobile: ícone apenas com horizontal scroll
  - Avatar initials fix (exibe iniciais do profissional em vez de "-")
  - Ajustes responsivos para mobile (serviços sem quebra de linha)

- **Mobile Layout Improvements**
  - Serviços: `flex-wrap: nowrap !important` previne quebra de linha
  - Grid columns reduzidas: `1fr 70px 80px` → `1fr 60px 70px`
  - Botões menores: toggle (32px), delete (26px)
  - Card footer buttons responsivos com `flex: 1`

- **Tabs Navigation CSS** (configuracoes.html:139-203)
  - `.config-tabs` - Container com gap e overflow scroll
  - `.config-tab` - Botões com active state e acessibilidade
  - Mobile: labels hidden, ícones de 18px

- **Avatar Initials Fix** (configuracoes.html:2049-2060)
  - Extrai nome de `session.user.user_metadata` (nome, name, ou email)
  - Gera iniciais (primeiras 2 palavras, primeira letra maiúscula)
  - Atualiza badge do avatar e nome no dropdown

### Added - 2026-04-14

#### Layout Infrastructure (FASE 0)
- **Design System CSS** (`src/css/design-system.css`)
  - RGB variables para uso com Tailwind CSS v4
  - Light theme (padrão) e Dark theme
  - Token mapping completo (variáveis antigas → novas)
  - Cores de destaque: lime, teal, amber, rust
  - Cores de categorias: purple (tintura), blue (escova)

- **Layout CSS** (`src/css/layout.css`)
  - Grid responsivo (240px sidebar + 1fr content)
  - Sidebar colapsável (240px ↔ 64px)
  - Mobile layout (flexbox, sidebar oculta)
  - FOUC prevention rules
  - Z-index hierarchy explícita

- **Layout JavaScript** (`src/js/layout.js`)
  - toggleSidebar() - Alterna sidebar expandida/colapsada
  - toggleTheme() - Alterna tema claro/escuro
  - FOUC prevention script (executa antes do render)
  - localStorage persistência
  - Feature flag ?layout=novo

- **App Shell Template** (src/templates/app-shell.html)
  - Template completo de referência
  - Topbar unificada
  - Sidebar colapsável
  - Bottom navigation mobile
  - URLs amigáveis Firebase Hosting

- **Reusable Components**
  - src/js/components/topbar.js - Topbar com opções customizáveis
  - src/js/components/sidebar.js - Sidebar com navegação + widgets
  - src/js/components/mobile-nav.js - Bottom nav para mobile

#### Documentation
- LAYOUT-PROPOSAL.md - Proposta visual e comparativo
- IMPLEMENTATION-PLAN.md - Planejamento detalhado por fase
  - Análise LEITO das páginas reais
  - Token mapping completo
  - Estimativa: 50h (revisado de 40h)
- new-layout-tailwind.html - Protótipo funcional completo

### Changed

#### URLs Firebase Hosting
- Antes: /pages/painel.html, /pages/clientes.html, etc.
- Depois: /painel, /clientes, etc. (URLs amigáveis)
- Benefício: URLs mais limpias e profissionais

### Technical Notes

- Tailwind CSS v4 CDN - Zero build step necessário
- RGB Variables - Formato rgb(var(--variable)) requer valores separados por espaço
- FOUC Prevention - Script inline no <head> aplica estado antes do render
- Feature Flag - ?layout=novo ativa novo layout para testes em produção

---

## [1.0.0] - 2024-XX-XX

### Added
- Sistema de agendamento completo
- Autenticação com Supabase
- Dashboard de clientes
- Relatórios com Chart.js
- Integração ASAAS para pagamentos

### Changed
- Migração para Tailwind CSS v4

### Fixed
- FOUC em todas as páginas
- Inconsistência de layout entre páginas
- Calendar não disponível em mobile

---

## Format

**Tipos de Mudanças:**
- Added - Novas funcionalidades
- Changed - Mudanças em funcionalidades existentes
- Deprecated - Funcionalidades que serão removidas
- Removed - Funcionalidades removidas
- Fixed - Correções de bugs
- Security - Correções de segurança

**Categorias de Mudanças:**
- Layout - Mudanças no layout/UX
- Documentation - Mudanças na documentação
- Technical - Mudanças técnicas (build, infraestrutura)
- Feature - Novas funcionalidades para usuários
