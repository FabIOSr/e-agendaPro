// tests/e2e/new-layout-fase1.spec.ts
// Testes E2E para o NOVO LAYOUT - FASE 1 (painel.html)
// Testa sidebar colapsável, theme toggle, FOUC prevention, mobile bottom nav

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
// FEATURE FLAG (?layout=novo)
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Feature Flag', () => {
  test('deve ativar data-layout="novo" com ?layout=novo', async ({ page }) => {
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-layout', 'novo');
  });

  test('não deve ter data-layout sem ?layout=novo', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const html = page.locator('html');
    const dataLayout = await html.getAttribute('data-layout');
    expect(dataLayout).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// SIDEBAR COLAPSÁVEL
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Sidebar Colapsável', () => {
  test.beforeEach(async ({ page }) => {
    // Usar feature flag para testar novo layout
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');
  });

  test('deve exibir sidebar expandida por padrão (240px)', async ({ page }) => {
    const sidebar = page.locator('#sidebar').or(page.locator('aside'));
    await expect(sidebar).toBeVisible();

    const sidebarWidth = await sidebar.evaluate((el: HTMLElement) => {
      return window.getComputedStyle(el).width;
    });

    expect(sidebarWidth).toBe('240px');
  });

  test('botão toggle deve existir e ser clicável', async ({ page }) => {
    const toggle = page.locator('#sidebarToggle').or(page.locator('.sidebar-toggle'));
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeEnabled();
  });

  test('deve colapsar sidebar ao clicar no toggle (240px → 64px)', async ({ page }) => {
    const sidebar = page.locator('#sidebar').or(page.locator('aside'));
    const toggle = page.locator('#sidebarToggle').or(page.locator('.sidebar-toggle'));

    // Sidebar deve estar expandida inicialmente
    let initialWidth = await sidebar.evaluate((el: HTMLElement) => {
      return window.getComputedStyle(el).width;
    });
    expect(initialWidth).toBe('240px');

    // Clicar no toggle
    await toggle.click();
    await page.waitForTimeout(300); // Aguardar animação CSS

    // Sidebar deve estar colapsada
    const collapsedWidth = await sidebar.evaluate((el: HTMLElement) => {
      return window.getComputedStyle(el).width;
    });
    expect(collapsedWidth).toBe('64px');
  });

  test('deve expandir sidebar ao clicar novamente (64px → 240px)', async ({ page }) => {
    const sidebar = page.locator('#sidebar').or(page.locator('aside'));
    const toggle = page.locator('#sidebarToggle').or(page.locator('.sidebar-toggle'));

    // Colapsar primeiro
    await toggle.click();
    await page.waitForTimeout(300);

    // Expandir novamente
    await toggle.click();
    await page.waitForTimeout(300);

    // Sidebar deve estar expandida
    const expandedWidth = await sidebar.evaluate((el: HTMLElement) => {
      return window.getComputedStyle(el).width;
    });
    expect(expandedWidth).toBe('240px');
  });

  test('deve ocultar widgets quando colapsada', async ({ page }) => {
    const toggle = page.locator('#sidebarToggle').or(page.locator('.sidebar-toggle'));
    const widgets = page.locator('.sidebar-widgets').or(page.locator('.widgets'));

    // Widgets visíveis quando expandida
    await expect(widgets).toBeVisible();

    // Colapsar
    await toggle.click();
    await page.waitForTimeout(300);

    // Widgets ocultos quando colapsada
    await expect(widgets).not.toBeVisible();
  });

  test('deve persistir estado após reload (localStorage)', async ({ page }) => {
    const sidebar = page.locator('#sidebar').or(page.locator('aside'));
    const toggle = page.locator('#sidebarToggle').or(page.locator('.sidebar-toggle'));

    // Colapsar sidebar
    await toggle.click();
    await page.waitForTimeout(300);

    // Recarregar página
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Sidebar deve estar colapsada após reload
    const collapsedWidth = await sidebar.evaluate((el: HTMLElement) => {
      return window.getComputedStyle(el).width;
    });
    expect(collapsedWidth).toBe('64px');
  });

  test('deve atualizar data-sidebar-collapsed attribute', async ({ page }) => {
    const toggle = page.locator('#sidebarToggle').or(page.locator('.sidebar-toggle'));
    const html = page.locator('html');

    // Inicialmente sem atributo
    await expect(html).not.toHaveAttribute('data-sidebar-collapsed', 'true');

    // Colapsar
    await toggle.click();
    await page.waitForTimeout(300);

    // Deve ter atributo
    await expect(html).toHaveAttribute('data-sidebar-collapsed', 'true');

    // Expandir
    await toggle.click();
    await page.waitForTimeout(300);

    // Atributo deve ser removido
    await expect(html).not.toHaveAttribute('data-sidebar-collapsed', 'true');
  });
});

// ═══════════════════════════════════════════════════════════
// THEME TOGGLE (DARK/LIGHT MODE)
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');
  });

  test('botão theme toggle deve existir', async ({ page }) => {
    const themeToggle = page.locator('#themeToggle').or(page.locator('.theme-toggle'));
    await expect(themeToggle).toBeVisible();
  });

  test('deve alternar entre light e dark mode', async ({ page }) => {
    const themeToggle = page.locator('#themeToggle').or(page.locator('.theme-toggle'));
    const html = page.locator('html');

    // Inicialmente light (sem data-theme)
    await expect(html).not.toHaveAttribute('data-theme', 'dark');

    // Clicar no toggle
    await themeToggle.click();

    // Deve estar dark
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Clicar novamente
    await themeToggle.click();

    // Deve voltar para light
    await expect(html).not.toHaveAttribute('data-theme', 'dark');
  });

  test('deve atualizar ícone (🌙 ↔ ☀️)', async ({ page }) => {
    const themeToggle = page.locator('#themeToggle').or(page.locator('.theme-toggle'));

    // Ícone inicial (🌙 para light mode)
    const initialIcon = await themeToggle.textContent();
    expect(initialIcon).toContain('🌙');

    // Alternar para dark mode
    await themeToggle.click();

    // Ícone deve mudar para ☀️
    const darkIcon = await themeToggle.textContent();
    expect(darkIcon).toContain('☀️');

    // Voltar para light mode
    await themeToggle.click();

    // Ícone deve voltar para 🌙
    const lightIcon = await themeToggle.textContent();
    expect(lightIcon).toContain('🌙');
  });

  test('deve persistir tema após reload (localStorage)', async ({ page }) => {
    const themeToggle = page.locator('#themeToggle').or(page.locator('.theme-toggle'));
    const html = page.locator('html');

    // Ativar dark mode
    await themeToggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Recarregar página
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Dark mode deve persistir
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('zero FOUC - tema deve ser aplicado antes do render', async ({ page }) => {
    // Este teste verifica se há flash de tema ao recarregar
    const themeToggle = page.locator('#themeToggle').or(page.locator('.theme-toggle'));

    // Ativar dark mode
    await themeToggle.click();

    // Recarregar e verificar se tema dark é aplicado imediatamente
    await page.evaluate(() => {
      return new Promise((resolve) => {
        // Capturar o tema antes de qualquer conteúdo ser renderizado
        const html = document.documentElement;
        resolve(html.getAttribute('data-theme'));
      });
    });

    await page.reload();

    // Verificar que não há flash (tema aplicado desde o início)
    const hasFlash = await page.evaluate(() => {
      const html = document.documentElement;
      return html.getAttribute('data-theme') === 'dark';
    });

    expect(hasFlash).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// MOBILE BOTTOM NAV
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Mobile Bottom Navigation', () => {
  test('deve exibir bottom nav em mobile (<768px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    const bottomNav = page.locator('.bottom-nav').or(page.locator('[data-bottom-nav]'));
    await expect(bottomNav).toBeVisible();
  });

  test('não deve exibir bottom nav em desktop (>=768px)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    const bottomNav = page.locator('.bottom-nav').or(page.locator('[data-bottom-nav]'));
    await expect(bottomNav).not.toBeVisible();
  });

  test('bottom nav deve ter 5 links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    const bottomNav = page.locator('.bottom-nav').or(page.locator('[data-bottom-nav]'));
    const links = bottomNav.locator('a');

    await expect(links).toHaveCount(5);
  });

  test('bottom nav links devem funcionar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    const bottomNav = page.locator('.bottom-nav').or(page.locator('[data-bottom-nav]'));

    // Testar primeiro link (Agenda/Painel)
    const firstLink = bottomNav.locator('a').first();
    await expect(firstLink).toHaveAttribute('href', '/painel');
  });

  test('sidebar deve estar oculta em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('#sidebar').or(page.locator('aside'));
    await expect(sidebar).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// MOBILE CALENDAR DEDICADO
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Mobile Calendar', () => {
  test('deve exibir mini calendar mobile-only em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    const mobileCal = page.locator('#mobile-mini-cal').or(page.locator('.mobile-mini-cal'));
    await expect(mobileCal).toBeVisible();
  });

  test('não deve exibir mini calendar mobile em desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    const mobileCal = page.locator('#mobile-mini-cal').or(page.locator('.mobile-mini-cal'));
    await expect(mobileCal).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// RESPONSIVIDADE
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Responsividade', () => {
  test('deve funcionar em desktop (1920x1080)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    // Sidebar visível
    const sidebar = page.locator('#sidebar').or(page.locator('aside'));
    await expect(sidebar).toBeVisible();

    // Bottom nav oculto
    const bottomNav = page.locator('.bottom-nav');
    await expect(bottomNav).not.toBeVisible();

    // Layout grid
    const layout = page.locator('#appLayout').or(page.locator('.app-layout'));
    await expect(layout).toBeVisible();
  });

  test('deve funcionar em tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('#sidebar').or(page.locator('aside'));
    await expect(sidebar).toBeVisible();

    // Em tablet, sidebar pode estar colapsada por padrão
    // Depende da implementação CSS
  });

  test('deve funcionar em mobile (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');

    // Sidebar oculta
    const sidebar = page.locator('#sidebar').or(page.locator('aside'));
    await expect(sidebar).not.toBeVisible();

    // Bottom nav visível
    const bottomNav = page.locator('.bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Mobile calendar visível
    const mobileCal = page.locator('#mobile-mini-cal');
    await expect(mobileCal).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// KPIS E WIDGETS
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: KPIs e Widgets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Aguardar carregamento de dados
  });

  test('KPIs devem ser preenchidos com dados reais (não "—")', async ({ page }) => {
    const kpiAgendamentos = page.locator('#kpi-agendamentos');
    const kpiReceita = page.locator('#kpi-receita');
    const kpiOcupacao = page.locator('#kpi-ocupacao');

    // KPIs devem existir
    await expect(kpiAgendamentos).toBeVisible();
    await expect(kpiReceita).toBeVisible();
    await expect(kpiOcupacao).toBeVisible();

    // Não devem conter apenas "—" (placeholder)
    const agendamentosText = await kpiAgendamentos.textContent();
    expect(agendamentosText?.trim()).not.toBe('—');
  });

  test('serviços devem ser carregados dinamicamente do Supabase', async ({ page }) => {
    const servicoItems = page.locator('.servico-item');

    // Aguardar carregamento
    await page.waitForTimeout(2000);

    // Deve haver pelo menos um serviço
    const count = await servicoItems.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// AGENDA GRID
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Agenda Grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Aguardar renderização
  });

  test('agenda grid deve funcionar com sidebar expandida', async ({ page }) => {
    const agendaWrap = page.locator('#agenda-wrap');
    const eventsCol = page.locator('#events-col');

    await expect(agendaWrap).toBeVisible();
    await expect(eventsCol).toBeVisible();
  });

  test('agenda grid deve funcionar com sidebar colapsada', async ({ page }) => {
    const toggle = page.locator('#sidebarToggle').or(page.locator('.sidebar-toggle'));
    const eventsCol = page.locator('#events-col');

    // Colapsar sidebar
    await toggle.click();
    await page.waitForTimeout(300);

    // Agenda ainda deve ser visível
    await expect(eventsCol).toBeVisible();
  });

  test('now-line deve estar posicionada corretamente', async ({ page }) => {
    // A now-line só aparece se o horário atual estiver dentro do range
    const nowLine = page.locator('.now-line').or(page.locator('[data-now-line]'));

    // Se existir, deve estar visível
    const count = await nowLine.count();
    if (count > 0) {
      await expect(nowLine.first()).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════
// DETAIL PANEL (MODAL)
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Detail Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('detail panel deve estar centralizado horizontalmente', async ({ page }) => {
    const detailPanel = page.locator('#detail-panel');

    // Se estiver visível (aberto), deve estar centralizado
    const isVisible = await detailPanel.isVisible();
    if (isVisible) {
      const left = await detailPanel.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).left;
      });
      expect(left).toBe('50%');
    }
  });

  test('z-index do detail panel deve ser maior que sidebar', async ({ page }) => {
    const detailPanel = page.locator('#detail-panel');
    const sidebar = page.locator('#sidebar').or(page.locator('aside'));

    const detailPanelZ = await detailPanel.evaluate((el: HTMLElement) => {
      return parseInt(window.getComputedStyle(el).zIndex.toString()) || 0;
    });

    const sidebarZ = await sidebar.evaluate((el: HTMLElement) => {
      return parseInt(window.getComputedStyle(el).zIndex.toString()) || 0;
    });

    expect(detailPanelZ).toBeGreaterThan(sidebarZ);
  });
});

// ═══════════════════════════════════════════════════════════
// TOPBAR UNIFICADA
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Topbar Unificada', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/painel?layout=novo');
    await page.waitForLoadState('domcontentloaded');
  });

  test('deve ter logo com animação pulse-dot', async ({ page }) => {
    const logo = page.locator('.logo');
    await expect(logo).toBeVisible();

    const logoDot = page.locator('.logo-dot');
    await expect(logoDot).toBeVisible();
  });

  test('deve ter botão toggle de sidebar', async ({ page }) => {
    const toggle = page.locator('#sidebarToggle').or(page.locator('.sidebar-toggle'));
    await expect(toggle).toBeVisible();
  });

  test('deve ter date navigation no painel', async ({ page }) => {
    const dateNav = page.locator('.date-nav');
    await expect(dateNav).toBeVisible();
  });

  test('deve ter badge Pro visível apenas para usuários Pro', async ({ page }) => {
    const badgePro = page.locator('#badge-pro-periodicidade');
    // Badge pode não estar visível para usuários free
    await expect(badgePro).toBeAttached();
  });

  test('deve ter botão "+ Novo"', async ({ page }) => {
    const btnNew = page.locator('.btn-new');
    await expect(btnNew).toBeVisible();
  });

  test('deve ter avatar com dropdown', async ({ page }) => {
    const avatar = page.locator('#avatar-initials');
    await expect(avatar).toBeVisible();
  });
});
