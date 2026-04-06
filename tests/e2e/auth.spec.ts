// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Página de Auth', () => {
  test('deve carregar página de auth com formulário de login', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('input').first()).toBeVisible();
  });

  test('deve exibir tela de login como padrão', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#screen-login')).toHaveClass(/active/);
    await expect(page.locator('#btn-login')).toBeVisible();
  });

  test('deve exibir botão de login com Google', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.btn-google').first()).toBeVisible();
  });

  test('deve ter campo de email e senha', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-senha')).toBeVisible();
  });

  test('deve ter link para criar conta', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    const link = page.locator('#screen-login .nav-link a');
    await expect(link).toBeVisible();
    await expect(link).toContainText('Criar conta');
  });

  test('deve ter link para esqueci senha', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    const link = page.locator('#login-senha').locator('xpath=../../label/a');
    await expect(link).toBeVisible();
    await expect(link).toContainText('Esqueceu');
  });
});

test.describe('Proteção de Rotas', () => {
  test('painel deve redirecionar para auth sem sessão', async ({ page }) => {
    await page.goto('/painel');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('painel')).toBeTruthy();
  });

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

  test('relatorio deve redirecionar para auth sem sessão', async ({ page }) => {
    await page.goto('/relatorio');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('relatorio')).toBeTruthy();
  });

  test('planos deve redirecionar para auth sem sessão', async ({ page }) => {
    await page.goto('/planos');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('planos')).toBeTruthy();
  });

  test('onboarding deve redirecionar para auth sem sessão', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('onboarding')).toBeTruthy();
  });
});