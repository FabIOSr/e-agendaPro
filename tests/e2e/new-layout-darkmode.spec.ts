// tests/e2e/new-layout-darkmode.spec.ts
// Testes E2E para Dark Mode do NOVO LAYOUT
// Valida: FOUC prevention, theme persistence, colors adaptation

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
// FOCUS PREVENTION (NO FOUC)
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Dark Mode - FOUC Prevention', () => {
  test('não deve ter FOUC ao alternar tema', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // Capturar screenshot antes
    await page.screenshot({ path: 'test-results/before-theme-toggle.png' });

    // Clicar no theme toggle usando ID específico
    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();

    // Esperar transição (menos de 100ms para não ter FOUC visível)
    await page.waitForTimeout(100);

    // Capturar screenshot depois
    await page.screenshot({ path: 'test-results/after-theme-toggle.png' });

    // Verificar que tema mudou
    const html = page.locator('html');
    const theme = await html.getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('tema deve ser aplicado antes do primeiro render', async ({ page }) => {
    // Simular usuário com tema dark salvo
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // Verificar que html já tem data-theme="dark"
    const html = page.locator('html');
    const theme = await html.getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('não deve aparecer conteúdo estilizado incorretamente', async ({ page }) => {
    await page.goto('/painel');

    // Monitorar mudanças de estilo
    const backgroundColorChanges: string[] = [];

    await page.evaluate(() => {
      const html = document.documentElement;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'data-theme') {
            const bg = window.getComputedStyle(document.body).backgroundColor;
            (window as any).backgroundColorChanges = (window as any).backgroundColorChanges || [];
            (window as any).backgroundColorChanges.push(bg);
          }
        });
      });

      observer.observe(html, { attributes: true });
    });

    // Alternar tema
    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();
    await page.waitForTimeout(200);

    // Buscar mudanças registradas
    const changes = await page.evaluate(() => (window as any).backgroundColorChanges || []);

    // Não deve ter múltiplas mudanças de cor (indica FOUC)
    expect(changes.length).toBeLessThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════
// THEME PERSISTENCE
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Dark Mode - Persistence', () => {
  test('tema deve persistir ao recarregar página', async ({ page }) => {
    // Alternar para dark
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();

    // Verificar que está dark
    let html = page.locator('html');
    let theme = await html.getAttribute('data-theme');
    expect(theme).toBe('dark');

    // Recarregar
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Verificar que ainda está dark
    html = page.locator('html');
    theme = await html.getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('tema deve persistir entre páginas', async ({ page }) => {
    // Alternar para dark no painel
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();

    // Navegar para clientes
    await page.goto('/clientes');
    await page.waitForLoadState('domcontentloaded');

    // Verificar que ainda está dark
    const html = page.locator('html');
    const theme = await html.getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('localStorage deve ter tema salvo', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();

    // Verificar localStorage
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toBe('dark');
  });

  test('toggle de volta para light deve funcionar', async ({ page }) => {
    // Começar em dark
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // Verificar que está dark
    let html = page.locator('html');
    let theme = await html.getAttribute('data-theme');
    expect(theme).toBe('dark');

    // Alternar para light
    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();

    // Verificar que mudou para light (ou sem atributo)
    html = page.locator('html');
    theme = await html.getAttribute('data-theme');
    expect(theme).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════
// COLORS ADAPTATION
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Dark Mode - Colors', () => {
  test('background deve ser escuro em dark mode', async ({ page }) => {
    // Começar em dark
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const body = page.locator('body');
    const bgColor = await body.evaluate((el: HTMLElement) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Deve ser escura (rgb baixo)
    const match = bgColor.match(/\d+/);
    if (match) {
      const rgbValue = parseInt(match[0]);
      expect(rgbValue).toBeLessThan(50); // Menos de 50 de 255 = bem escuro
    }
  });

  test('texto deve ser claro em dark mode', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const body = page.locator('body');
    const textColor = await body.evaluate((el: HTMLElement) => {
      return window.getComputedStyle(el).color;
    });

    // Deve ser clara (rgb alto)
    const match = textColor.match(/\d+/);
    if (match) {
      const rgbValue = parseInt(match[0]);
      expect(rgbValue).toBeGreaterThan(200); // Mais de 200 de 255 = bem claro
    }
  });

  test('cores de destaque devem manter vibrância em dark mode', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // Verificar cor lime (botões primários)
    const limeElement = page.locator('.btn-primary, [style*="color-lime"]').first();
    if (await limeElement.isVisible()) {
      const bgColor = await limeElement.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Lime (#c8f060) deve manter vibrância
      expect(bgColor).toContain('200'); // R
      expect(bgColor).toContain('240'); // G
      expect(bgColor).toContain('96'); // B
    }
  });

  test('bordas devem ser visíveis em dark mode', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    // Pegar um card
    const card = page.locator('.card, .panel-card').first();
    if (await card.isVisible()) {
      const borderColor = await card.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).borderColor;
      });

      // Deve ter cor (não transparente)
      expect(borderColor).not.toBe('rgba(0, 0, 0, 0)');
    }
  });
});

// ═══════════════════════════════════════════════════════════
// CROSS-PAGE DARK MODE
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Dark Mode - Cross-Page', () => {
  const pages = [
    { url: '/painel', name: 'Painel' },
    { url: '/clientes', name: 'Clientes' },
    { url: '/relatorio', name: 'Relatório' },
    { url: '/configuracoes', name: 'Configurações' }
  ];

  test('todas as páginas devem suportar dark mode', async ({ page }) => {
    // Alternar para dark no painel
    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();

    // Testar em cada página
    for (const p of pages) {
      await page.goto(p.url);
      await page.waitForLoadState('domcontentloaded');

      const html = page.locator('html');
      const theme = await html.getAttribute('data-theme');
      expect(theme).toBe('dark');

      // Screenshot para verificação visual
      await page.screenshot({
        path: `test-results/dark-mode-${p.name.toLowerCase()}.png`,
        fullPage: false
      });
    }
  });

  test('theme toggle deve estar disponível em todas as páginas', async ({ page }) => {
    for (const p of pages) {
      await page.goto(p.url);
      await page.waitForLoadState('domcontentloaded');

      const themeToggle = page.locator('#themeToggle');
      await expect(themeToggle).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════
// CHART.JS DARK MODE
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Dark Mode - Chart.js', () => {
  test('gráfico deve adaptar cores para dark mode', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/relatorio');
    await page.waitForLoadState('domcontentloaded');

    // Esperar Chart.js carregar
    await page.waitForTimeout(1000);

    // Verificar que canvas existe
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Screenshot para verificação visual
    await page.screenshot({
      path: 'test-results/chart-dark-mode.png',
      fullPage: false
    });
  });

  test('gráfico deve alternar cores ao mudar tema', async ({ page }) => {
    await page.goto('/relatorio');
    await page.waitForLoadState('domcontentloaded');

    // Esperar Chart.js carregar
    await page.waitForTimeout(1000);

    const canvas = page.locator('canvas');

    // Screenshot em light
    await page.screenshot({
      path: 'test-results/chart-light-mode.png',
      fullPage: false
    });

    // Alternar para dark
    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();

    // Esperar Chart.js atualizar
    await page.waitForTimeout(500);

    // Screenshot em dark
    await page.screenshot({
      path: 'test-results/chart-after-dark.png',
      fullPage: false
    });

    // Verificar que canvas ainda está visível
    await expect(canvas).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// ACCESSIBILITY - CONTRAST
// ═══════════════════════════════════════════════════════════

test.describe('Novo Layout: Dark Mode - Accessibility', () => {
  test('deve ter contraste adequado em texto principal', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/painel');
    await page.waitForLoadState('domcontentloaded');

    const body = page.locator('body');

    // Calcular contraste (WCAG AA requer mínimo 4.5:1)
    const contrast = await body.evaluate(() => {
      const bodyEl = document.body;
      const styles = window.getComputedStyle(bodyEl);

      const textColor = styles.color;
      const bgColor = styles.backgroundColor;

      // Função simplificada para extrair RGB
      const getRGB = (color: string) => {
        const match = color.match(/\d+/g);
        if (match) {
          return match.map(Number);
        }
        return [0, 0, 0];
      };

      const getLuminance = (rgb: number[]) => {
        const [r, g, b] = rgb.map(v => {
          v = v / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const fgRGB = getRGB(textColor);
      const bgRGB = getRGB(bgColor);

      const fgLum = getLuminance(fgRGB);
      const bgLum = getLuminance(bgRGB);

      const lighter = Math.max(fgLum, bgLum);
      const darker = Math.min(fgLum, bgLum);

      return (lighter + 0.05) / (darker + 0.05);
    });

    // WCAG AA requer contraste mínimo de 4.5:1
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});
