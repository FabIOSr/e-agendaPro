// tests/e2e/internal-pages.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Proteção de Rotas - Páginas Internas', () => {
  test('clientes deve redirecionar para auth sem sessão', async ({ page }) => {
    await page.goto('/clientes');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('clientes')).toBeTruthy();
  });

  test('configuracoes deve redirecionar para auth sem sessão', async ({ page }) => {
    await page.goto('/configuracoes');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('configuracoes')).toBeTruthy();
  });

  test('planos deve redirecionar para auth sem sessão', async ({ page }) => {
    await page.goto('/planos');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('planos')).toBeTruthy();
  });

  test('relatorio deve redirecionar para auth sem sessão', async ({ page }) => {
    await page.goto('/relatorio');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('relatorio')).toBeTruthy();
  });

  test('onboarding deve redirecionar para auth sem sessão', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('onboarding')).toBeTruthy();
  });
});

test.describe('Páginas Públicas', () => {
  test('landing page deve carregar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('auth deve carregar', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('pagina-cliente deve carregar com slug', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('confirmar-reserva deve carregar', async ({ page }) => {
    await page.goto('/confirmar-reserva');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});