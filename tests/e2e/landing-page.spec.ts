// tests/e2e/landing-page.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('deve carregar a landing page com conteúdo', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Verifica que a página tem conteúdo (HTML foi servido)
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Verifica que tem pelo menos um heading ou texto
    const hasContent = await page.locator('h1, h2, h3, p').count() > 0;
    expect(hasContent).toBeTruthy();
  });
});
