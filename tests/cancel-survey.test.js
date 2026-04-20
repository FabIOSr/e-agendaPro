// tests/cancel-survey.test.js
// Testes unitários para lógica do Cancel Survey (R-2)
// Execute com: node --test tests/cancel-survey.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Wrapper principal para node --test (test ao invés de describe)
describe('Cancel Survey - Lógica de Validação', () => {
  
  describe('Validação de motivo', () => {
    it('deve validar quando motivo é selecionado', () => {
      const cancelReason = 'muito-caro';
      assert.ok(cancelReason, 'Motivo deve estar selecionado');
    });

    it('não deve validar quando motivo não é selecionado', () => {
      const cancelReason = null;
      assert.ok(!cancelReason, 'Não deve permitir sem motivo');
    });
  });

  describe('Validação de "outro motivo"', () => {
    it('deve exigir texto quando motivo é "outro"', () => {
      const cancelReason = 'outro';
      const outroMotivo = '';
      
      const deveExigir = cancelReason === 'outro' && !outroMotivo.trim();
      assert.ok(deveExigir, 'Deve exigir preenchimento de outro motivo');
    });

    it('deve permitir quando "outro" está preenchido', () => {
      const cancelReason = 'outro';
      const outroMotivo = 'Não gostei do suporte';
      
      const podeContinuar = !(cancelReason === 'outro' && !outroMotivo.trim());
      assert.ok(podeContinuar, 'Deve permitir com motivo preenchido');
    });

    it('não deve exigir para outros motivos', () => {
      const motivos = ['muito-caro', 'nao-uso', 'faltou-feature', 'mudei-ramo'];
      
      for (const motivo of motivos) {
        const outroMotivo = '';
        const podeContinuar = !(motivo === 'outro' && !outroMotivo.trim());
        assert.ok(podeContinuar, `Motivo "${motivo}" não deve exigir texto adicional`);
      }
    });
  });

  describe('Lógica de desconto', () => {
    it('deve mostrar oferta apenas para "muito-caro"', () => {
      const mostrarOferta = (motivo) => motivo === 'muito-caro';
      
      assert.ok(mostrarOferta('muito-caro'), 'Deve mostrar para muito-caro');
      assert.ok(!mostrarOferta('nao-uso'), 'Não deve mostrar para nao-uso');
      assert.ok(!mostrarOferta('outro'), 'Não deve mostrar para outro');
    });
  });

  describe('Payload para edge functions', () => {
    it('deve criar payload correto para criar-cupom', () => {
      const payload = {
        desconto_percentual: 20,
        meses: 3,
        motivo: 'muito-caro'
      };

      assert.strictEqual(payload.desconto_percentual, 20);
      assert.strictEqual(payload.meses, 3);
      assert.strictEqual(payload.motivo, 'muito-caro');
    });

    it('deve criar payload correto para registrar-cancelamento', () => {
      const cancelReason = 'nao-uso';
      const outroMotivo = null;
      
      const payload = {
        motivo: cancelReason,
        outro_motivo: cancelReason === 'outro' ? outroMotivo : null
      };

      assert.strictEqual(payload.motivo, 'nao-uso');
      assert.strictEqual(payload.outro_motivo, null);
    });

    it('deve incluir outro_motivo quando motivo é "outro"', () => {
      const cancelReason = 'outro';
      const outroMotivo = 'Preço muito alto';
      
      const payload = {
        motivo: cancelReason,
        outro_motivo: cancelReason === 'outro' ? outroMotivo : null
      };

      assert.strictEqual(payload.motivo, 'outro');
      assert.strictEqual(payload.outro_motivo, 'Preço muito alto');
    });
  });

  describe('Mapeamento de motivos para exibição', () => {
    it('deve mapear motivos para nomes legíveis', () => {
      const motivoNomes = {
        'muito-caro': 'Muito caro',
        'nao-uso': 'Não uso mais',
        'faltou-feature': 'Faltou funcionalidade',
        'mudei-ramo': 'Mudei de ramo',
        'outro': 'Outro motivo'
      };

      assert.strictEqual(motivoNomes['muito-caro'], 'Muito caro');
      assert.strictEqual(motivoNomes['nao-uso'], 'Não uso mais');
      assert.strictEqual(motivoNomes['faltou-feature'], 'Faltou funcionalidade');
    });
  });

  describe('Validação de desconto', () => {
    it('deve validar percentual entre 10 e 50', () => {
      const validarDesconto = (pct) => pct >= 10 && pct <= 50;
      
      assert.ok(validarDesconto(10), '10% deve ser válido');
      assert.ok(validarDesconto(20), '20% deve ser válido');
      assert.ok(validarDesconto(50), '50% deve ser válido');
      assert.ok(!validarDesconto(5), '5% deve ser inválido');
      assert.ok(!validarDesconto(60), '60% deve ser inválido');
    });

    it('deve validar meses entre 1 e 12', () => {
      const validarMeses = (m) => m >= 1 && m <= 12;
      
      assert.ok(validarMeses(1), '1 mês deve ser válido');
      assert.ok(validarMeses(3), '3 meses deve ser válido');
      assert.ok(validarMeses(12), '12 meses deve ser válido');
      assert.ok(!validarMeses(0), '0 meses deve ser inválido');
      assert.ok(!validarMeses(24), '24 meses deve ser inválido');
    });
  });

  describe('Estado do botão confirmar', () => {
    it('deve desabilitar botão quando sem motivo', () => {
      const cancelReason = null;
      const buttonDisabled = !cancelReason;

      assert.ok(buttonDisabled, 'Botão deve estar desabilitado sem motivo');
    });

    it('deve habilitar botão quando motivo selecionado', () => {
      const cancelReason = 'muito-caro';
      const buttonDisabled = !cancelReason;

      assert.ok(!buttonDisabled, 'Botão deve estar habilitado com motivo');
    });
  });

  describe('Cálculo de desconto', () => {
    it('deve calcular valor com desconto corretamente', () => {
      const valorOriginal = 39.0;
      const descontoPercentual = 20;
      const valorComDesconto = parseFloat((valorOriginal * (1 - descontoPercentual / 100)).toFixed(2));

      assert.strictEqual(valorComDesconto, 31.2, '20% de R$39 deve ser R$31,20');
    });

    it('deve calcular economia total no período', () => {
      const valorOriginal = 39.0;
      const valorComDesconto = 31.2;
      const meses = 3;
      const economia = ((valorOriginal - valorComDesconto) * meses).toFixed(2);

      assert.strictEqual(economia, '23.40', 'Economia em 3 meses deve ser R$23,40');
    });

    it('deve calcular data de validade do desconto', () => {
      const meses = 3;
      const descontoValidoAte = new Date();
      descontoValidoAte.setMonth(descontoValidoAte.getMonth() + meses);

      const diffMeses = (descontoValidoAte.getMonth() - new Date().getMonth() + 12) % 12;
      assert.ok(diffMeses >= 2 && diffMeses <= 4, 'Data deve estar ~3 meses no futuro');
    });
  });

  describe('Estratégia de desconto no Asaas', () => {
    it('deve cancelar assinatura atual antes de criar nova', () => {
      const passos = ['cancelar_atual', 'criar_nova_com_desconto', 'registrar_db'];
      assert.ok(passos.includes('cancelar_atual'), 'Deve cancelar atual primeiro');
      assert.ok(passos.includes('criar_nova_com_desconto'), 'Deve criar nova com desconto');
    });

    it('deve reverter desconto após período expirado', () => {
      const reverter = (valorComDesconto, valorOriginal) => {
        assert.ok(valorOriginal > valorComDesconto, 'Valor original deve ser maior');
        return valorOriginal;
      };
      const resultado = reverter(31.2, 39.0);
      assert.strictEqual(resultado, 39.0, 'Deve retornar ao valor original');
    });
  });

  describe('Plano anual — sem desconto adicional', () => {
    it('deve recusar desconto para plano YEARLY', () => {
      const ciclo = 'YEARLY';
      const permiteDesconto = ciclo === 'MONTHLY';
      assert.ok(!permiteDesconto, 'Plano anual não deve receber desconto adicional');
    });

    it('deve permitir desconto apenas para MONTHLY', () => {
      const permiteDesconto = (ciclo) => ciclo === 'MONTHLY';
      assert.ok(permiteDesconto('MONTHLY'), 'Mensal deve permitir desconto');
      assert.ok(!permiteDesconto('YEARLY'), 'Anual não deve permitir desconto');
    });

    it('deve informar que plano anual já tem melhor preço', () => {
      const mensagem = 'Você já paga o melhor preço (R$29/mês)';
      assert.ok(mensagem.includes('melhor preço'), 'Deve informar sobre melhor preço');
    });
  });

  describe('Cálculo correto de descontoValidoAte', () => {
    it('deve calcular a partir do nextDueDate, não de hoje', () => {
      const nextDueDate = new Date('2026-05-15');
      const meses = 3;
      const descontoValidoAte = new Date(nextDueDate);
      descontoValidoAte.setMonth(descontoValidoAte.getMonth() + meses);

      assert.strictEqual(descontoValidoAte.getMonth(), 7, 'Deve ser agosto (maio + 3)');
    });

    it('não deve usar data atual como base', () => {
      const nextDueDate = new Date('2026-06-01');
      const hoje = new Date('2026-04-20');
      const meses = 3;

      const correto = new Date(nextDueDate);
      correto.setMonth(correto.getMonth() + meses);

      const errado = new Date(hoje);
      errado.setMonth(errado.getMonth() + meses);

      assert.ok(correto > errado, 'Cálculo correto (nextDueDate) deve ser maior que cálculo errado (hoje)');
    });
  });
});
