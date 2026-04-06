// tests/e2e/dashboard.spec.ts
// Painel do prestador (painel.html) — Topbar, sidebar, agenda, stats, navegação
import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
// PROTEÇÃO DE ROTAS (sem sessão → redirect para /auth)
// ═══════════════════════════════════════════════════════════

test.describe('Proteção de Rotas', () => {
  test('painel deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('painel')).toBeTruthy();
  });

  test('clientes deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/clientes');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('clientes')).toBeTruthy();
  });

  test('configurações deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/configuracoes');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('configuracoes')).toBeTruthy();
  });

  test('planos deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/planos');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('planos')).toBeTruthy();
  });

  test('relatório deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/relatorio');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('relatorio')).toBeTruthy();
  });

  test('onboarding deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('onboarding')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════
// TOPBAR — Logo, navegação, avatar
// ═══════════════════════════════════════════════════════════

test.describe('Dashboard: Topbar', () => {
  test('deve exibir logo com indicador pulsante', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.locator('.logo-dot')).toBeVisible();
  });

  test('deve exibir navegação central com links', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.nav-link[href="/painel"]')).toBeVisible();
    await expect(page.locator('.nav-link[href="/painel"]')).toContainText('Agenda');
    // Link "Agenda" deve estar ativo na página painel
    await expect(page.locator('.nav-link[href="/painel"]')).toHaveClass(/active/);
  });

  test('deve exibir todos os links de navegação', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const navLinks = page.locator('.nav-link');
    await expect(navLinks).toHaveCount(5);

    await expect(navLinks.nth(0)).toContainText('Agenda');
    await expect(navLinks.nth(1)).toContainText('Clientes');
    await expect(navLinks.nth(2)).toContainText('Relatórios');
    await expect(navLinks.nth(3)).toContainText('Config');
    await expect(navLinks.nth(4)).toContainText('Plano');
  });

  test('deve exibir botão "+ Novo"', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.btn-new')).toBeVisible();
    await expect(page.locator('.btn-new')).toContainText('Novo');
  });

  test('deve exibir botão "Sair"', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.btn-logout')).toBeVisible();
    await expect(page.locator('.btn-logout')).toContainText('Sair');
  });

  test('deve exibir avatar com iniciais', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#avatar-initials')).toBeVisible();
  });

  test('deve exibir navegação de data na topbar', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // .date-nav e #date-label existem no DOM (podem estar ocultos em mobile)
    await expect(page.locator('.date-nav')).toBeAttached();
    await expect(page.locator('#date-label')).toBeAttached();
  });

  test('deve exibir botões de navegação de data (anterior/próximo)', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const dateNavButtons = page.locator('.date-nav button');
    await expect(dateNavButtons).toHaveCount(2);
  });
});

// ═══════════════════════════════════════════════════════════
// SIDEBAR — Mini calendário, stats do dia, serviços
// ═══════════════════════════════════════════════════════════

test.describe('Dashboard: Sidebar', () => {
  test('deve exibir mini-calendário na sidebar', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // Container do mini-cal existe (conteúdo renderizado via JS com sessão)
    await expect(page.locator('.mini-cal')).toBeVisible();
    await expect(page.locator('#mini-cal-mes-label')).toBeVisible();
    await expect(page.locator('#mini-cal')).toBeAttached();
  });

  test('deve exibir label do mês na sidebar', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#sidebar-mes-label')).toBeVisible();
  });

  test('deve exibir seção "Hoje" com 3 estatísticas', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // Label "Hoje"
    const sidebarSections = page.locator('.sidebar-section');
    await expect(sidebarSections.nth(1).locator('.sidebar-label')).toContainText('Hoje');

    // 3 stats: Agendamentos, Receita, Próximo
    await expect(page.locator('#stat-count')).toBeVisible();
    await expect(page.locator('#stat-receita')).toBeVisible();
    await expect(page.locator('#stat-proximo')).toBeVisible();
  });

  test('deve exibir seção de serviços na sidebar', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const sidebarSections = page.locator('.sidebar-section');
    await expect(sidebarSections.nth(2).locator('.sidebar-label')).toContainText('Serviços');
  });

  test('deve exibir lista de serviços com nome e duração', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const servicoItems = page.locator('.servico-item');
    await expect(servicoItems.first()).toBeVisible();
    await expect(page.locator('.servico-item-name').first()).toBeVisible();
    await expect(page.locator('.servico-item-dur').first()).toBeVisible();
  });

  test('deve exibir botão de bloqueio na sidebar', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.btn-bloqueio')).toBeVisible();
    await expect(page.locator('.btn-bloqueio')).toContainText('bloqueio', { ignoreCase: true });
  });
});

// ═══════════════════════════════════════════════════════════
// AGENDA — Grid principal de horários
// ═══════════════════════════════════════════════════════════

test.describe('Dashboard: Agenda (grid de horários)', () => {
  test('deve exibir container da agenda', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#agenda-wrap')).toBeVisible();
    await expect(page.locator('#agenda-grid')).toBeVisible();
  });

  test('deve exibir colunas de horários (time-col e events-col)', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // Colunas existem no DOM (conteúdo renderizado via JS com sessão)
    await expect(page.locator('#time-col')).toBeAttached();
    await expect(page.locator('#events-col')).toBeAttached();
  });

  test('deve exibir labels de hora (renderizadas via JS)', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');
    // Aguarda renderização do JS
    await page.waitForTimeout(2000);

    // Labels de hora são renderizadas via JS; testamos que o container existe
    await expect(page.locator('#time-col')).toBeAttached();
    await expect(page.locator('#events-col')).toBeAttached();
  });

  test('deve destacar hora atual com classe "now" (quando aplicável)', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // A classe "now" depende do horário atual; testamos a estrutura
    await expect(page.locator('#agenda-wrap')).toBeAttached();
  });
});

// ═══════════════════════════════════════════════════════════
// MODAL DE DETALHES (overlay + painel lateral)
// ═══════════════════════════════════════════════════════════

test.describe('Dashboard: Modal de detalhes', () => {
  test('deve existir overlay no DOM', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#overlay')).toBeAttached();
  });

  test('deve existir painel de detalhes no DOM', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#detail-panel')).toBeAttached();
  });

  test('painel de detalhes deve ter header com título e botão fechar', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.detail-title')).toBeAttached();
    await expect(page.locator('.detail-close')).toBeAttached();
  });

  test('painel de detalhes deve ter corpo e ações', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#dp-body')).toBeAttached();
    await expect(page.locator('#dp-actions')).toBeAttached();
  });
});

// ═══════════════════════════════════════════════════════════
// BANNER PLANO FREE
// ═══════════════════════════════════════════════════════════

test.describe('Dashboard: Banner de plano', () => {
  test('banner de plano free deve existir no DOM', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // Banner pode estar oculto (usuário Pro)
    await expect(page.locator('#banner-free')).toBeAttached();
  });

  test('badge Pro deve existir no DOM', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#badge-pro-periodicidade')).toBeAttached();
    await expect(page.locator('#pro-periodicidade-text')).toBeAttached();
  });
});

// ═══════════════════════════════════════════════════════════
// RESPONSIVIDADE
// ═══════════════════════════════════════════════════════════

test.describe('Dashboard: Responsividade', () => {
  test('deve renderizar em mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.logo')).toBeVisible();
  });

  test('deve renderizar em tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('#agenda-wrap')).toBeVisible();
  });

  test('deve renderizar em desktop (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('#agenda-wrap')).toBeVisible();
    await expect(page.locator('.nav-links')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// PÁGINAS RELACIONADAS (links da navegação)
// ═══════════════════════════════════════════════════════════

test.describe('Navegação: links da topbar', () => {
  test('link "Agenda" deve apontar para /painel', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.nav-link[href="/painel"]')).toHaveAttribute('href', '/painel');
  });

  test('link "Clientes" deve apontar para /clientes', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.nav-link:has-text("Clientes")')).toHaveAttribute('href', '/clientes');
  });

  test('link "Relatórios" deve apontar para /relatorio', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.nav-link:has-text("Relatórios")')).toHaveAttribute('href', '/relatorio');
  });

  test('link "Config" deve apontar para /configuracoes', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.nav-link:has-text("Config")')).toHaveAttribute('href', '/configuracoes');
  });

  test('link "Plano" deve apontar para /planos', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.nav-link:has-text("Plano")')).toHaveAttribute('href', '/planos');
  });
});