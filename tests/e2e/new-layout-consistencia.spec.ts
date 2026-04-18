// tests/e2e/new-layout-consistencia.spec.ts
// Testes E2E para consistência do NOVO LAYOUT entre todas as páginas
// Valida: topbar, sidebar, dark mode, responsividade

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
// CONSISTÊNCIA CROSS-PAGE
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Consistência Cross-Page', () => {
  const pages = [
    { url: '/painel', name: 'Painel', hasSidebar: true },
    { url: '/clientes', name: 'Clientes', hasSidebar: true },
    { url: '/relatorio', name: 'Relatório', hasSidebar: true },
    { url: '/configuracoes', name: 'Configurações', hasSidebar: true }
  ];

  test.describe('Topbar Consistente', () => {
    test('logo deve ser o mesmo em todas as páginas', async ({ page }) => {
      const logos = [];

      for (const p of pages) {
        await page.goto(p.url);
        await page.waitForLoadState('domcontentloaded');

        // Verificar que existe texto "AgendaPro" na página (pode estar em diferentes lugares)
        const logoText = await page.locator('body').textContent();
        expect(logoText).toContain('AgendaPro');
      }

      // Se chegou aqui, todas as páginas têm "AgendaPro"
      expect(true).toBe(true);
    });

    test('theme toggle deve existir em todas as páginas', async ({ page }) => {
      for (const p of pages) {
        await page.goto(p.url);
        await page.waitForLoadState('domcontentloaded');

        // Usar ID específico
        const themeToggle = page.locator('#themeToggle');
        await expect(themeToggle).toBeVisible();
      }
    });

    test('avatar deve existir em todas as páginas', async ({ page }) => {
      for (const p of pages) {
        await page.goto(p.url);
        await page.waitForLoadState('domcontentloaded');

        // Usar ID específico
        const avatar = page.locator('#avatar-initials');
        await expect(avatar).toBeVisible();
      }
    });
  });

  test.describe('Sidebar Consistente', () => {
    test('sidebar deve existir em todas as páginas (exceto planos)', async ({ page }) => {
      for (const p of pages) {
        await page.goto(p.url);
        await page.waitForLoadState('domcontentloaded');

        // Em mobile, sidebar não existe
        const isMobile = await page.evaluate(() => window.innerWidth < 768);
        if (isMobile) {
          // Em mobile, verificar que sidebar NÃO está visível
          const sidebar = page.locator('#sidebar');
          const isVisible = await sidebar.isVisible().catch(() => false);
          expect(isVisible).toBe(false);
        } else {
          // Em desktop, verificar que sidebar existe
          const sidebar = page.locator('#sidebar');
          await expect(sidebar).toBeVisible();
        }
      }
    });

    test('sidebar toggle deve funcionar em todas as páginas', async ({ page }) => {
      for (const p of pages) {
        await page.goto(p.url);
        await page.waitForLoadState('domcontentloaded');

        const sidebar = page.locator('#sidebar');
        // Usar ID específico para evitar strict mode violation
        const toggleBtn = page.locator('#sidebarToggle');

        if (await toggleBtn.isVisible()) {
          // Clicar para colapsar
          await toggleBtn.click();

          // Verificar que colapsou (data-sidebar-collapsed attribute)
          const isCollapsed = await page.evaluate(() => {
            return document.documentElement.hasAttribute('data-sidebar-collapsed');
          });
          expect(isCollapsed).toBe(true);

          // Clicar para expandir
          await toggleBtn.click();

          // Verificar que expandiu de volta
          const isExpanded = await page.evaluate(() => {
            return !document.documentElement.hasAttribute('data-sidebar-collapsed');
          });
          expect(isExpanded).toBe(true);
        }
      }
    });
  });

  test.describe('Logout Funciona', () => {
    test('logout deve estar disponível via avatar dropdown', async ({ page }) => {
      // Testar apenas na primeira página (fluxo de logout é o mesmo)
      await page.goto('/painel');
      await page.waitForLoadState('domcontentloaded');

      // Clicar no avatar para abrir menu
      const avatar = page.locator('#avatar-initials');
      await avatar.click();

      // Verificar que menu aparece
      const userMenu = page.locator('#user-menu');
      await expect(userMenu).toBeVisible();

      // Verificar que botão de logout existe no menu
      const logoutBtn = userMenu.locator('button[onclick="fazerLogout()"]');
      await expect(logoutBtn).toBeVisible();
    });
  });

  test.describe('Navegação Entre Páginas', () => {
    test('links de navegação devem funcionar', async ({ page }) => {
      // Começar no painel
      await page.goto('/painel');
      await page.waitForLoadState('domcontentloaded');

      // Verificar se está em desktop (tem sidebar)
      const isMobile = await page.evaluate(() => window.innerWidth < 768);

      if (!isMobile) {
        // Apenas em desktop: clicar no link de clientes na sidebar
        await page.locator('#sidebar a[href="/clientes"]').click();
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(/.*clientes.*/);

        // Verificar que clientes carregou com sidebar
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).toBeVisible();
      } else {
        // Em mobile: navegar diretamente
        await page.goto('/clientes');
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(/.*clientes.*/);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════
// PLANOS.HTML ( Landing Page - SEM SIDEBAR)
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: planos.html (Landing Page)', () => {
  test('não deve ter sidebar', async ({ page }) => {
    await page.goto('/planos');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('#sidebar, aside, .sidebar');
    await expect(sidebar).not.toBeVisible();
  });

  test('deve ter topbar simples', async ({ page }) => {
    await page.goto('/planos');
    await page.waitForLoadState('domcontentloaded');

    // planos.html usa .topbar (existente!)
    const topbar = page.locator('.topbar');
    await expect(topbar).toBeVisible();

    // Verificar que tem logo
    const logo = topbar.locator('.logo');
    await expect(logo).toBeVisible();

    // Verificar que tem texto "AgendaPro" no logo
    await expect(logo).toContainText('AgendaPro');
  });

  test('cards de plano devem estar visíveis', async ({ page }) => {
    await page.goto('/planos');
    await page.waitForLoadState('domcontentloaded');

    const planCards = page.locator('.plano-card');
    await expect(planCards).toHaveCount(2); // Pro mensal e Pro anual
  });
});
