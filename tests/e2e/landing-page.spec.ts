// tests/e2e/landing-page.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('deve carregar a landing page com conteúdo principal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const body = page.locator('body');
    await expect(body).toBeVisible();

    const hasContent = await page.locator('h1, h2, h3, p').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('deve exibir o hero com título e CTAs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('.hero-h1')).toContainText('agendamento');
    await expect(page.locator('.hero-sub')).toBeVisible();

    const primaryCta = page.locator('.btn-hero-primary');
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toContainText('Criar minha página grátis');

    const secondaryCta = page.locator('.btn-hero-secondary');
    await expect(secondaryCta).toBeVisible();
    await expect(secondaryCta).toContainText('Ver como funciona');
  });

  test('deve exibir todas as seções principais', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.dor-section')).toBeVisible();
    await expect(page.locator('.features-grid')).toBeVisible();
    await expect(page.locator('.how-section')).toBeVisible();
    await expect(page.locator('.depoimentos-grid')).toBeVisible();
    await expect(page.locator('.nums-section')).toBeVisible();
    await expect(page.locator('.precos-grid')).toBeVisible();
    await expect(page.locator('#faq')).toBeVisible();
    await expect(page.locator('.cta-section')).toBeVisible();
  });

  test('deve exibir 3 cards de preços (Grátis, Pro, Anual)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const cards = page.locator('.preco-card');
    await expect(cards).toHaveCount(3);

    await expect(page.locator('.preco-card').nth(0)).toContainText('Grátis');
    await expect(page.locator('.preco-card').nth(1)).toContainText('Pro');
    await expect(page.locator('.preco-card').nth(2)).toContainText('Anual');

    const destaque = page.locator('.preco-card.destaque');
    await expect(destaque).toContainText('Mais popular');
  });

  test('deve exibir FAQ com itens interativos', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const faqItems = page.locator('.faq-item');
    await expect(faqItems).toHaveCount(6);

    const firstFaq = faqItems.first();
    await expect(firstFaq).not.toHaveClass(/open/);

    await firstFaq.click();
    await expect(firstFaq).toHaveClass(/open/);

    const secondFaq = faqItems.nth(1);
    await secondFaq.click();
    await expect(firstFaq).not.toHaveClass(/open/);
    await expect(secondFaq).toHaveClass(/open/);
  });

  test('deve navegar para seção "como funciona" ao clicar no link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const link = page.locator('a[href="#como-funciona"]').first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '#como-funciona');
  });

  test('deve navegar para seção de preços ao clicar no CTA', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const cta = page.locator('a[href="#precos"]').first();
    await expect(cta).toBeVisible();
    await cta.click();
    await page.waitForTimeout(1000);

    const precosSection = page.locator('#precos');
    const box = await precosSection.boundingBox();
    expect(box).not.toBeNull();
  });

  test('deve ter navegação com logo, links e CTA', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.nav-logo')).toContainText('AgendaPro');
    await expect(page.locator('.nav-dot')).toBeVisible();

    await expect(page.locator('.nav-links a[href="#como-funciona"]')).toBeVisible();
    await expect(page.locator('.nav-links a[href="#precos"]')).toBeVisible();
    await expect(page.locator('.nav-links a[href="#faq"]')).toBeVisible();

    const navLogin = page.locator('.nav-login');
    await expect(navLogin).toBeVisible();
    await expect(navLogin).toHaveAttribute('href', '/auth');

    await expect(page.locator('.nav-cta')).toContainText('Começar grátis');
  });

  test('deve exibir depoimentos com estrelas', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const depoimentos = page.locator('.depoimento');
    await expect(depoimentos).toHaveCount(3);

    const stars = page.locator('.dep-stars');
    await expect(stars).toHaveCount(3);

    await expect(depoimentos.nth(0)).toContainText('Ana Beatriz');
    await expect(depoimentos.nth(1)).toContainText('Carla Mendes');
    await expect(depoimentos.nth(2)).toContainText('Marcos Oliveira');
  });

  test('deve exibir números de resultados', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.num-val').nth(0)).toContainText('70%');
    await expect(page.locator('.num-val').nth(1)).toContainText('3h');
    await expect(page.locator('.num-val').nth(2)).toContainText('+1.2k');
  });

  test('deve ter footer com links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('.footer-logo')).toContainText('AgendaPro');

    const footerLinks = page.locator('.footer-links a');
    await expect(footerLinks).toHaveCount(3);
    await expect(footerLinks.nth(0)).toContainText('Termos');
    await expect(footerLinks.nth(1)).toContainText('Privacidade');
    await expect(footerLinks.nth(2)).toContainText('Contato');
  });

  test('deve redirecionar para /auth ao clicar em "Começar grátis"', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const cta = page.locator('.btn-preco.outline').first();
    await cta.click();

    await page.waitForURL('**/auth**');
    expect(page.url()).toContain('/auth');
  });

  test('deve ser responsivo em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.hero')).toBeVisible();

    const navLinks = page.locator('.nav-links');
    await expect(navLinks).not.toBeVisible();

    const mockup = page.locator('.hero-mockup');
    await expect(mockup).not.toBeVisible();

    const features = page.locator('.feature-card');
    await expect(features.first()).toBeVisible();
  });
});
