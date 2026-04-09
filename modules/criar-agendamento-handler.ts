/**
 * Handler de Criação de Agendamento
 *
 * Chamado pela Edge Function criar-agendamento e por testes automatizados.
 * Centraliza toda a lógica de criação: validação, execução atômica, Google Calendar.
 */

import { normalizarResultadoCriacaoAgendamento } from './agendamento-response.js';
import { logger } from './logger.js';

export interface CriarAgendamentoDeps {
  cors: Record<string, string>;
  createSupabaseClient: (url: string, key: string) => any;
  getEnv: (key: string) => string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  onUnexpectedError?: (error: unknown, context: Record<string, unknown>) => void;
}

export interface CriarAgendamentoBody {
  prestador_id: string;
  servico_id: string;
  cliente_nome: string;
  cliente_tel: string;
  cliente_email?: string;
  data_hora: string;
  token_reserva?: string;
}

export async function handleCriarAgendamentoRequest(
  req: Request,
  deps: CriarAgendamentoDeps
): Promise<Response> {
  const {
    cors,
    createSupabaseClient,
    getEnv,
    fetchImpl = fetch,
    now = () => new Date(),
    onUnexpectedError,
  } = deps;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const errorContext: Record<string, unknown> = {
    method: req.method,
    content_type: req.headers.get('content-type'),
    url: req.url,
  };

  try {
    let body: CriarAgendamentoBody;
    try {
      body = await req.json();
    } catch {
      return Response.json({ erro: 'Body invalido' }, { status: 400, headers: cors });
    }

    const {
      prestador_id,
      servico_id,
      cliente_nome,
      cliente_tel,
      cliente_email,
      data_hora,
      token_reserva,
    } = body;

    errorContext.prestador_id = prestador_id;
    errorContext.servico_id = servico_id;
    errorContext.cliente_nome = cliente_nome;
    errorContext.cliente_tel = cliente_tel;
    errorContext.cliente_email = cliente_email;
    errorContext.data_hora = data_hora;
    errorContext.token_reserva = Boolean(token_reserva);

    // Validações
    if (!prestador_id || !servico_id || !cliente_nome || !cliente_tel || !data_hora) {
      return Response.json(
        {
          erro:
            'Campos obrigatorios: prestador_id, servico_id, cliente_nome, cliente_tel, data_hora',
        },
        { status: 400, headers: cors }
      );
    }

    const dataHoraDate = new Date(data_hora);
    if (Number.isNaN(dataHoraDate.getTime())) {
      return Response.json(
        { erro: 'data_hora invalido. Use ISO 8601 (ex: 2026-04-10T09:00:00-03:00)' },
        { status: 400, headers: cors }
      );
    }

    if (dataHoraDate < now()) {
      return Response.json(
        { erro: 'Nao e possivel agendar no passado' },
        { status: 400, headers: cors }
      );
    }

    // Execução atômica
    const supabase = createSupabaseClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    const { data: resultadoCriacao, error: errCriacao } = await supabase.rpc(
      'criar_agendamento_atomic',
      {
        p_prestador_id: prestador_id,
        p_servico_id: servico_id,
        p_cliente_nome: cliente_nome,
        p_cliente_tel: cliente_tel,
        p_cliente_email: cliente_email?.trim() || null,
        p_data_hora: dataHoraDate.toISOString(),
        p_token_reserva: token_reserva ?? null,
      }
    );

    if (errCriacao) {
      await logger.error('Falha ao executar criar_agendamento_atomic', errCriacao, {
        feature: 'criar-agendamento',
        prestador_id,
        servico_id,
      });
      return Response.json(
        { erro: 'Erro ao criar agendamento' },
        { status: 500, headers: cors }
      );
    }

    const resultadoNormalizado = normalizarResultadoCriacaoAgendamento(resultadoCriacao);
    if (!resultadoNormalizado.ok) {
      return Response.json(resultadoNormalizado.body, {
        status: resultadoNormalizado.status,
        headers: cors,
      });
    }

    const agendamentoId = resultadoNormalizado.body.agendamento_id;

    // Upsert cliente (não crítico)
    const { error: errCliente } = await supabase
      .from('clientes')
      .upsert(
        {
          prestador_id,
          nome: cliente_nome.trim(),
          telefone: cliente_tel.trim(),
        },
        { onConflict: 'prestador_id,telefone', ignoreDuplicates: true }
      );

    if (errCliente) {
      logger.warn('Falha ao upsert cliente (nao critico)', {
        feature: 'criar-agendamento',
        error: errCliente.message,
      });
    }

    // Google Calendar (não crítico)
    try {
      const gcalUrl = `${getEnv('SUPABASE_URL')}/functions/v1/google-calendar-sync`;
      const gcalResp = await fetchImpl(gcalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
          apikey: getEnv('SUPABASE_ANON_KEY') ?? '',
        },
        body: JSON.stringify({
          action: 'criar',
          agendamento_id: agendamentoId,
        }),
      });

      const gcalData = await gcalResp.json();
      if (gcalData.sincronizado) {
        logger.info('Google Calendar sincronizado', {
          feature: 'criar-agendamento',
          evento_id: gcalData.evento_id,
        });
      } else {
        logger.debug('Google Calendar nao sincronizado', {
          feature: 'criar-agendamento',
          motivo: gcalData.motivo,
        });
      }
    } catch (errGcal) {
      logger.warn('Falha ao sincronizar Google Calendar (nao critico)', {
        feature: 'criar-agendamento',
        error: String(errGcal),
      });
    }

    logger.metric('agendamento_criado', {
      agendamento_id: agendamentoId,
      prestador_id,
    });

    return Response.json(
      { ok: true, agendamento_id: agendamentoId },
      { status: 200, headers: cors }
    );
  } catch (err) {
    onUnexpectedError?.(err, errorContext);
    await logger.captureError('Erro inesperado em criar-agendamento', err, {
      feature: 'criar-agendamento',
      ...errorContext,
    });
    return Response.json(
      { erro: 'Erro interno no servidor' },
      { status: 500, headers: cors }
    );
  }
}
