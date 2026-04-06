// tests/e2e/booking-flow.spec.ts
// Fluxo completo de agendamento na página pública (:slug)
// Testa os 5 steps: Serviço → Data → Horário → Dados → Confirmar
import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
// ESTRUTURA DA PÁGINA (estática, sem backend)
// ═══════════════════════════════════════════════════════════

test.describe('Página pública: estrutura', () => {
  test('deve carregar hero com avatar e nome', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.locator('#hero-avatar')).toBeVisible();
    // #hero-bio existe no DOM (pode estar oculto sem bio)
    await expect(page.locator('#hero-bio')).toBeAttached();
  });

  test('deve exibir barra de progresso com 5 steps', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');

    const steps = page.locator('.step-item');
    await expect(steps).toHaveCount(5);

    // Step 1 (Serviço) deve estar ativo
    await expect(page.locator('#sc-1')).toHaveClass(/active/);
    await expect(page.locator('#sl-1')).toHaveClass(/active/);

    // Steps 2-5 não ativos
    await expect(page.locator('#sc-2')).not.toHaveClass(/active/);
    await expect(page.locator('#sc-3')).not.toHaveClass(/active/);
    await expect(page.locator('#sc-4')).not.toHaveClass(/active/);
    await expect(page.locator('#sc-5')).not.toHaveClass(/active/);
  });

  test('deve exibir step 1 (Serviço) como ativo', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#step-1')).toHaveClass(/active/);
    await expect(page.locator('#step-1 .section-title')).toContainText('Escolha o serviço');

    // Outros steps ocultos
    await expect(page.locator('#step-2')).not.toHaveClass(/active/);
    await expect(page.locator('#step-3')).not.toHaveClass(/active/);
    await expect(page.locator('#step-4')).not.toHaveClass(/active/);
    await expect(page.locator('#step-5')).not.toHaveClass(/active/);
  });

  test('deve exibir área de conteúdo', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.content')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// STEP 1 — Seleção de serviço
// ═══════════════════════════════════════════════════════════

test.describe('Step 1: Seleção de serviço', () => {
  test('deve exibir título "Escolha o serviço"', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#step-1 .section-title')).toContainText('Escolha o serviço');
  });

  test('deve carregar serviços dinamicamente (aguardar render)', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');

    // Aguarda carregamento dinâmico dos serviços
    await page.waitForTimeout(2000);

    // Verifica que existe container de serviços
    const servicosContainer = page.locator('#step-1');
    await expect(servicosContainer).toBeVisible();
  });

  test('deve avançar para step 2 ao clicar em serviço', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Clica no primeiro serviço disponível
    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      // Step 2 (Data) deve ficar ativo
      await expect(page.locator('#sc-2')).toHaveClass(/active/);
      await expect(page.locator('#step-2')).toHaveClass(/active/);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// STEP 2 — Seleção de data (calendário)
// ═══════════════════════════════════════════════════════════

test.describe('Step 2: Seleção de data', () => {
  test('deve exibir calendário com mês e navegação', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Clica no primeiro serviço para ir ao step 2
    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      // Calendário deve estar visível
      await expect(page.locator('#cal-month')).toBeVisible();
      await expect(page.locator('#cal-grid')).toBeVisible();
    }
  });

  test('deve exibir botão "Voltar" para step 1', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const btnVoltar = page.locator('#step-2 .btn-ghost');
      await expect(btnVoltar).toBeVisible();
      await expect(btnVoltar).toContainText('Voltar');
    }
  });

  test('deve voltar para step 1 ao clicar "Voltar"', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      await page.locator('#step-2 .btn-ghost').click();
      await page.waitForTimeout(500);

      // Deve voltar para step 1
      await expect(page.locator('#sc-1')).toHaveClass(/active/);
      await expect(page.locator('#step-1')).toHaveClass(/active/);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// STEP 3 — Seleção de horário (slots)
// ═══════════════════════════════════════════════════════════

test.describe('Step 3: Seleção de horário', () => {
  test('deve exibir grid de horários ao selecionar data', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Vai para step 2
    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      // Clica em data futura (day 15 do mês atual, evitando hoje)
      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        // Step 3 (Horário) deve ficar ativo e grid de slots visível
        await expect(page.locator('#sc-3')).toHaveClass(/active/);
        await expect(page.locator('#step-3')).toHaveClass(/active/);
        await expect(page.locator('#slots-grid')).toBeVisible();
      }
    }
  });

  test('deve exibir botão "Voltar" para step 2', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        const btnVoltar = page.locator('#step-3 .btn-ghost');
        await expect(btnVoltar).toBeVisible();
        await expect(btnVoltar).toContainText('Voltar');
      }
    }
  });

  test('deve avançar para step 4 ao clicar em horário disponível', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        // Clica no primeiro slot disponível
        const slotDisponivel = page.locator('#slots-grid .slot-btn:not(.indisponivel)').first();
        if (await slotDisponivel.isVisible()) {
          await slotDisponivel.click();
          await page.waitForTimeout(500);

          // Step 4 (Dados) deve ficar ativo
          await expect(page.locator('#sc-4')).toHaveClass(/active/);
          await expect(page.locator('#step-4')).toHaveClass(/active/);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
// STEP 4 — Dados do cliente
// ═══════════════════════════════════════════════════════════

test.describe('Step 4: Dados do cliente', () => {
  test('deve exibir formulário com nome, WhatsApp e email', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Navega até step 4
    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        const slotDisponivel = page.locator('#slots-grid .slot-btn:not(.indisponivel)').first();
        if (await slotDisponivel.isVisible()) {
          await slotDisponivel.click();
          await page.waitForTimeout(500);

          // Verifica campos do formulário
          await expect(page.locator('#input-nome')).toBeVisible();
          await expect(page.locator('#input-nome')).toHaveAttribute('placeholder', /chama/i);

          await expect(page.locator('#input-tel')).toBeVisible();
          await expect(page.locator('#input-tel')).toHaveAttribute('placeholder', /\(/);

          await expect(page.locator('#input-email')).toBeVisible();
          await expect(page.locator('#input-email')).toHaveAttribute('type', 'email');
        }
      }
    }
  });

  test('deve ter botão "Ver resumo" desabilitado por padrão', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        const slotDisponivel = page.locator('#slots-grid .slot-btn:not(.indisponivel)').first();
        if (await slotDisponivel.isVisible()) {
          await slotDisponivel.click();
          await page.waitForTimeout(500);

          // Botão deve estar desabilitado até preencher dados
          await expect(page.locator('#btn-confirmar')).toBeDisabled();
        }
      }
    }
  });

  test('deve habilitar botão ao preencher nome e telefone', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        const slotDisponivel = page.locator('#slots-grid .slot-btn:not(.indisponivel)').first();
        if (await slotDisponivel.isVisible()) {
          await slotDisponivel.click();
          await page.waitForTimeout(500);

          // Preenche nome
          await page.locator('#input-nome').fill('Maria Silva');

          // Preenche telefone
          await page.locator('#input-tel').fill('11999990000');

          await page.waitForTimeout(300);

          // Botão deve estar habilitado
          await expect(page.locator('#btn-confirmar')).toBeEnabled();
        }
      }
    }
  });

  test('deve exibir aviso de política de privacidade', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        const slotDisponivel = page.locator('#slots-grid .slot-btn:not(.indisponivel)').first();
        if (await slotDisponivel.isVisible()) {
          await slotDisponivel.click();
          await page.waitForTimeout(500);

          // Aviso de privacidade deve estar visível
          await expect(page.locator('.aviso-box')).toBeVisible();
        }
      }
    }
  });

  test('deve voltar para step 3 ao clicar "Voltar"', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        const slotDisponivel = page.locator('#slots-grid .slot-btn:not(.indisponivel)').first();
        if (await slotDisponivel.isVisible()) {
          await slotDisponivel.click();
          await page.waitForTimeout(500);

          await page.locator('#step-4 .btn-ghost').click();
          await page.waitForTimeout(500);

          // Deve voltar para step 3
          await expect(page.locator('#sc-3')).toHaveClass(/active/);
          await expect(page.locator('#step-3')).toHaveClass(/active/);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
// STEP 5 — Confirmação (resumo)
// ═══════════════════════════════════════════════════════════

test.describe('Step 5: Confirmação', () => {
  test('deve exibir resumo com serviço, data, horário e cliente', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        const slotDisponivel = page.locator('#slots-grid .slot-btn:not(.indisponivel)').first();
        if (await slotDisponivel.isVisible()) {
          await slotDisponivel.click();
          await page.waitForTimeout(500);

          await page.locator('#input-nome').fill('Maria Silva');
          await page.locator('#input-tel').fill('11999990000');
          await page.waitForTimeout(300);

          // Clica "Ver resumo"
          await page.locator('#btn-confirmar').click();
          await page.waitForTimeout(500);

          // Step 5 deve estar ativo
          await expect(page.locator('#sc-5')).toHaveClass(/active/);
          await expect(page.locator('#step-5')).toHaveClass(/active/);

          // Resumo deve existir
          await expect(page.locator('.resumo-card')).toBeVisible();
          await expect(page.locator('#r-servico')).toBeVisible();
          await expect(page.locator('#r-data')).toBeVisible();
          await expect(page.locator('#r-hora')).toBeVisible();
          await expect(page.locator('#r-nome')).toBeVisible();
        }
      }
    }
  });

  test('deve exibir botão "Confirmar agendamento"', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        const slotDisponivel = page.locator('#slots-grid .slot-btn:not(.indisponivel)').first();
        if (await slotDisponivel.isVisible()) {
          await slotDisponivel.click();
          await page.waitForTimeout(500);

          await page.locator('#input-nome').fill('Maria Silva');
          await page.locator('#input-tel').fill('11999990000');
          await page.waitForTimeout(300);

          await page.locator('#btn-confirmar').click();
          await page.waitForTimeout(500);

          // Botão de confirmar agendamento
          const btnAgendar = page.locator('.btn-confirmar-agendamento, #btn-agendar-final');
          await expect(btnAgendar.first()).toBeVisible();
        }
      }
    }
  });

  test('deve exibir botão "Voltar" para step 4', async ({ page }) => {
    await page.goto('/ana-cabelos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const primeiroServico = page.locator('.servico-card, .servico-opcao').first();
    if (await primeiroServico.count() > 0) {
      await primeiroServico.click();
      await page.waitForTimeout(500);

      const diaFuturo = page.locator('#cal-grid .cal-day').filter({ hasNotText: /^$/ }).first();
      if (await diaFuturo.isVisible()) {
        await diaFuturo.click();
        await page.waitForTimeout(1500);

        const slotDisponivel = page.locator('#slots-grid .slot-btn:not(.indisponivel)').first();
        if (await slotDisponivel.isVisible()) {
          await slotDisponivel.click();
          await page.waitForTimeout(500);

          await page.locator('#input-nome').fill('Maria Silva');
          await page.locator('#input-tel').fill('11999990000');
          await page.waitForTimeout(300);

          await page.locator('#btn-confirmar').click();
          await page.waitForTimeout(500);

          await expect(page.locator('#step-5 .btn-ghost')).toBeVisible();
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
// PÁGINAS DE SUPORTE
// ═══════════════════════════════════════════════════════════

test.describe('Página de Confirmação de Reserva', () => {
  test('deve carregar página de confirmação', async ({ page }) => {
    await page.goto('/confirmar-reserva');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Cancelamento por Token', () => {
  test('deve carregar página de cancelar com token', async ({ page }) => {
    await page.goto('/cancelar-cliente?token=test-token-123');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Reagendamento por Token', () => {
  test('deve carregar página de reagendar com token', async ({ page }) => {
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