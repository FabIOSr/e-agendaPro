// tests/e2e/booking-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Página Pública de Agendamento', () => {
  test('deve carregar página do profissional com perfil', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.hero')).toBeVisible();
  });

  test('deve exibir avatar e nome do profissional', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.avatar-wrap')).toBeVisible();
    await expect(page.locator('.hero h1')).toBeVisible();
  });

  test('deve exibir steps de navegação', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.steps-nav')).toBeVisible();
  });

  test('deve exibir sección de seleção de serviço', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    const content = page.locator('.content');
    await expect(content).toBeVisible();
  });
});

test.describe('Página de Confirmação de Reserva', () => {
  test('deve carregar página de confirmação', async ({ page }) => {
    await page.goto('/confirmar-reserva');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Responsividade da Página Pública', () => {
  test('deve ser responsivo em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.hero')).toBeVisible();
  });
});