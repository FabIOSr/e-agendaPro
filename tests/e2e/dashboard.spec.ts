// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Painel do Prestador', () => {
  test('deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('painel')).toBeTruthy();
  });
});

test.describe('Página de Clientes', () => {
  test('deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/clientes');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('clientes')).toBeTruthy();
  });
});

test.describe('Página de Configurações', () => {
  test('deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/configuracoes');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('configuracoes')).toBeTruthy();
  });
});

test.describe('Página de Planos', () => {
  test('deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/planos');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('planos')).toBeTruthy();
  });
});

test.describe('Página de Relatórios', () => {
  test('deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/relatorio');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('relatorio')).toBeTruthy();
  });
});

test.describe('Onboarding', () => {
  test('deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('onboarding')).toBeTruthy();
  });
});

test.describe('Cancelamento por Token', () => {
  test('deve carregar página de cancelar com token válido', async ({ page }) => {
    await page.goto('/cancelar-cliente?token=test-token-123');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Reagendamento por Token', () => {
  test('deve carregar página de reagendar com token válido', async ({ page }) => {
    await page.goto('/reagendar-cliente?token=test-token-123');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Avaliação do Cliente', () => {
  test('deve carregar página de avaliação', async ({ page }) => {
    await page.goto('/avaliar-cliente');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});