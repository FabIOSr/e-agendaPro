# 📋 Seletores Reais dos HTMLs - Guia para Correção dos Testes

## 🎯 Seletores Corretos Encontrados

### painel.html (Página Principal)

#### Logo/Brand
- **Incorreto**: `.logo`
- **Correto**: `a[href="/painel"]` (contém logo-dot + "AgendaPro")
- **Contém**: `<div class="logo-dot">` e texto "AgendaPro"

#### Theme Toggle
- **Incorreto**: `.theme-toggle, [data-theme-toggle], button[onclick*="toggleTheme"]`
- **Correto**: `#themeToggle` (ID específico)
- **Elemento**: `<button id="themeToggle" onclick="toggleTheme()">🌙</button>`

#### Sidebar Toggle
- **Incorreto**: `.sidebar-toggle, [data-sidebar-toggle], button[onclick*="toggleSidebar"]` (encontra 2 elementos)
- **Correto**: `#sidebarToggle` (ID específico)
- **Elemento**: `<button id="sidebarToggle" onclick="toggleSidebar()">`

#### Sidebar
- **Parcialmente correto**: `#sidebar, aside, .sidebar`
- **Mais específico**: `#sidebar` (ID específico)
- **Elemento**: `<aside id="sidebar" class="bg-[var(--color-panel-bg2)] border-r border-[var(--color-panel-border)] flex flex-col overflow-hidden transition-all duration-300">`

#### Avatar
- **Incorreto**: `.avatar, #avatar-initials, [data-avatar]` (muito genérico)
- **Correto**: `#avatar-initials` (ID específico)
- **Elemento**: `<div id="avatar-initials" class="w-8 h-8 bg-[var(--color-lime)] rounded-full flex items-center justify-center text-[12px] font-semibold text-[var(--color-lime-ink)] cursor-pointer">`

#### Logout/User Menu
- **Incorreto**: `text=Sair, text=Logout, a[href*="logout"]`
- **Correto**: `#user-menu` (container do menu)
- **Botão de logout**: `button[onclick="fazerLogout()"]`
- **Elemento**:
  ```html
  <div id="user-menu" class="absolute right-0 top-full mt-2 w-48 ... hidden">
    <button onclick="fazerLogout()">Sair</button>
  </div>
  ```

#### Mobile Navigation (Bottom Nav)
- **Incorreto**: `.mobile-nav, .bottom-nav, [data-mobile-nav]`
- **Correto**: `.show-mobile-only` ou `nav.show-mobile-only`
- **Elemento**: `<nav class="show-mobile-only flex fixed bottom-0 left-0 right-0 z-[100] bg-[var(--color-panel-bg3)] border-t border-[var(--color-panel-border)] p-2 justify-around">`

#### Mini Calendar
- **Incorreto**: `.mini-calendar, [data-mini-calendar]`
- **Correto (Desktop)**: `.mini-cal` ou `#mini-cal`
- **Correto (Mobile)**: `#mobile-mini-cal`
- **Elementos**:
  ```html
  <div class="mini-cal text-[12px]">
    <div id="mini-cal-mes-label">...</div>
    <div id="mini-cal" class="mini-cal-grid grid grid-cols-7 gap-px text-center"></div>
  </div>
  <div id="mobile-mini-cal" class="grid grid-cols-7 gap-px text-center text-[11px]"></div>
  ```

---

### planos.html (Landing Page)

#### Topbar
- **Correto**: `.topbar` (EXISTE!)
- **Elemento**: `<nav class="topbar">`

#### Logo
- **Correto**: `.logo` (EXISTE!)
- **Elemento**: `<div class="logo">`

#### Voltar Button
- **Possível**: `a[href="/painel"]` (link para voltar)

---

### clientes.html, relatorio.html, configuracoes.html

#### Estrutura Similar
- Usam o mesmo padrão de painel.html
- Topbar unificada
- Sidebar com mesma estrutura
- Avatar com dropdown

---

## 🔧 Correções Necessárias nos Testes

### 1. Testes de Logo
```typescript
// ANTES (incorreto):
const logo = page.locator('.logo');

// DEPOIS (correto):
const logo = page.locator('a[href="/painel"]');
// OU buscar por texto
const logo = page.locator('text=AgendaPro');
```

### 2. Testes de Theme Toggle
```typescript
// ANTES:
const themeToggle = page.locator('.theme-toggle, [data-theme-toggle], button[onclick*="toggleTheme"]');

// DEPOIS:
const themeToggle = page.locator('#themeToggle');
```

### 3. Testes de Sidebar Toggle
```typescript
// ANTES:
const toggleBtn = page.locator('.sidebar-toggle, [data-sidebar-toggle], button[onclick*="toggleSidebar"]');
if (await toggleBtn.isVisible()) { // strict mode violation!

// DEPOIS:
const toggleBtn = page.locator('#sidebarToggle');
// Usar .first() se houver múltiplos
const toggleBtn = page.locator('#sidebarToggle').first();
```

### 4. Testes de Avatar
```typescript
// ANTES:
const avatar = page.locator('.avatar, #avatar-initials, [data-avatar]');

// DEPOIS:
const avatar = page.locator('#avatar-initials');
```

### 5. Testes de Logout
```typescript
// ANTES:
const logout = page.locator('text=Sair, text=Logout, a[href*="logout"]');

// DEPOIS:
const avatar = page.locator('#avatar-initials');
await avatar.click();
const logout = page.locator('#user-menu button[onclick="fazerLogout()"]');
await expect(logout).toBeVisible();
```

### 6. Testes de Mobile Navigation
```typescript
// ANTES:
const bottomNav = page.locator('.mobile-nav, .bottom-nav, [data-mobile-nav]');

// DEPOIS:
const bottomNav = page.locator('.show-mobile-only');
// OU
const bottomNav = page.locator('nav.show-mobile-only');
```

### 7. Testes de Mini Calendar
```typescript
// ANTES:
const miniCalendar = page.locator('.mini-calendar, [data-mini-calendar]');

// DEPOIS (desktop):
const miniCalendar = page.locator('.mini-cal');

// DEPOIS (mobile):
const miniCalendar = page.locator('#mobile-mini-cal');
```

---

## 📊 Resumo das Mudanças

| Elemento | Seletor Antigo | Seletor Novo |
|----------|---------------|--------------|
| Logo | `.logo` | `a[href="/painel"]` |
| Theme Toggle | `.theme-toggle, ...` | `#themeToggle` |
| Sidebar Toggle | `.sidebar-toggle, ...` | `#sidebarToggle` |
| Avatar | `.avatar, ...` | `#avatar-initials` |
| Logout | `text=Sair, ...` | `#user-menu button[onclick="fazerLogout()"]` |
| Mobile Nav | `.mobile-nav, ...` | `.show-mobile-only` |
| Mini Calendar | `.mini-calendar` | `.mini-cal` |

---

## ⚠️ Notas Importantes

1. **IDs são mais confiáveis que classes** - Use IDs específicos quando disponíveis
2. **Evine seletores muito genéricos** - Eles causam "strict mode violations"
3. **Para dropdowns/menus**, primeiro clique para abrir, depois verifique o conteúdo
4. **Mobile vs Desktop** - Alguns elementos têm seletores diferentes dependendo do viewport
5. **planos.html é diferente** - Tem estrutura própria, não segue o padrão do app shell
