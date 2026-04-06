// tests/e2e/cancelamento-reagendamento.spec.ts
import { test, expect } from '@playwright/test';

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