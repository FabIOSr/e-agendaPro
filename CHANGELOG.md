# Changelog

All notable changes to the AgendaPro project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
