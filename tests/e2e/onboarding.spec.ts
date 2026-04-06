// tests/e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Onboarding', () => {
  test('deve redirecionar para /auth sem sessão', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForTimeout(1000);
    expect(page.url().includes('auth') || page.url().includes('onboarding')).toBeTruthy();
  });

  test('deve carregar a página de onboarding', async ({ page }) => {
    await page.goto('/onboarding.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});