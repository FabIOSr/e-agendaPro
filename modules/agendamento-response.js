/**
 * Normaliza o resultado da stored procedure criar_agendamento_atomic
 * em um formato padronizado para resposta HTTP.
 *
 * @param {Object|null} resultadoCriacao - Resultado retornado pela SP
 * @returns {{ ok: boolean, status: number, body: Object }}
 */
export function normalizarResultadoCriacaoAgendamento(resultadoCriacao) {
  if (resultadoCriacao?.ok) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        agendamento_id: resultadoCriacao.agendamento_id,
      },
    };
  }

  const status = Number(resultadoCriacao?.http_status) || 400;
  const body = {
    erro: resultadoCriacao?.erro || 'Erro ao criar agendamento',
  };

  if (resultadoCriacao?.count != null) body.count = resultadoCriacao.count;
  if (resultadoCriacao?.limite != null) body.limite = resultadoCriacao.limite;
  if (resultadoCriacao?.whatsapp != null) body.whatsapp = resultadoCriacao.whatsapp;

  return {
    ok: false,
    status,
    body,
  };
}
