import { logger } from '../supabase/functions/_shared/logger.ts';

interface Agendamento {
  id: string;
  cliente_nome?: string;
  cliente_email?: string;
  cliente_tel?: string;
  data_hora: string;
  prestador_id: string;
  servico_id?: string;
  cancel_token?: string;
  prestadores?: {
    nome?: string;
    slug?: string;
    whatsapp?: string;
    email?: string;
    plano?: string;
  };
  servicos?: {
    nome?: string;
    duracao_min?: number;
  };
}

interface ErrorContext {
  method: string;
  url: string;
  content_type: string | null;
  token?: string | null;
  data?: string;
  hora?: string;
  plano?: string;
  [key: string]: unknown;
}

interface Deps {
  appUrl: string;
  corsHeaders: Record<string, string>;
  createSupabaseClient: (url: string, key: string) => {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (col: string, val: unknown) => {
          single: () => Promise<{ data: Agendamento | null }>;
        };
      };
      update: (data: Record<string, unknown>) => {
        eq: (col: string, val: unknown) => Promise<void>;
      };
    };
  };
  getEnv: (key: string) => string;
  fetchImpl?: typeof fetch;
  renderPage: (ag: Agendamento, token: string, slots: unknown[]) => string;
  enviarWhatsApp: (phone: string, message: string) => Promise<void>;
  enviarEmail: (to: string, subject: string, html: string) => Promise<void>;
  onUnexpectedError?: (error: unknown, context: Record<string, unknown>) => void;
  getToday?: () => string;
}

interface WebhookRequest {
  method: string;
  headers: {
    get: (name: string) => string | null;
  };
  url: string;
  json: () => Promise<{ token?: string; data?: string; hora?: string }>;
}

export async function handleReagendarClienteRequest(
  req: WebhookRequest,
  deps: Deps,
): Promise<Response> {
  const {
    appUrl,
    corsHeaders,
    createSupabaseClient,
    getEnv,
    fetchImpl = fetch,
    renderPage,
    enviarWhatsApp,
    enviarEmail,
    onUnexpectedError,
    getToday = () => new Date().toISOString().slice(0, 10),
  } = deps;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabase = createSupabaseClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );

  const errorContext: ErrorContext = {
    method: req.method,
    url: req.url,
    content_type: req.headers.get('content-type'),
  };

  try {
    if (req.method === 'GET') {
      const token = url.searchParams.get('token');
      errorContext.token = token;
      if (!token) return new Response('Token invalido', { status: 400, headers: corsHeaders });

      const { data: ag } = await supabase
        .from('agendamentos')
        .select('*, servicos(nome, duracao_min), prestadores(nome, slug, whatsapp, plano)')
        .eq('cancel_token', token)
        .single();

      if (!ag) {
        logger.warn('Agendamento nao encontrado para reagendamento', { token });
        return new Response('Agendamento nao encontrado', { status: 404, headers: corsHeaders });
      }

      let slots: unknown[] = [];
      try {
        const slotsRes = await fetchImpl(
          `${getEnv('SUPABASE_URL')}/functions/v1/horarios-disponiveis`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              prestador_slug: ag.prestadores?.slug,
              servico_id: ag.servico_id,
              data: getToday(),
            }),
          },
        );
        const slotsData = await slotsRes.json();
        slots = slotsData.slots ?? [];
      } catch {
        slots = [];
      }

      logger.metric('reagendar_page_view', {
        agendamento_id: ag.id,
        prestador_slug: ag.prestadores?.slug,
        slots_count: slots.length,
      });
      return new Response(renderPage(ag, token, slots), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
      });
    }

    if (req.method === 'POST') {
      const { token, data, hora } = await req.json();
      errorContext.token = token;
      errorContext.data = data;
      errorContext.hora = hora;

      if (!token || !data || !hora) {
        logger.warn('Campos obrigatorios ausentes para reagendamento', {
          token_presente: Boolean(token),
          data_presente: Boolean(data),
          hora_presente: Boolean(hora),
        });
        return Response.json({ erro: 'Campos obrigatorios: token, data, hora' }, { status: 400, headers: corsHeaders });
      }

      const { data: ag } = await supabase
        .from('agendamentos')
        .select('*, prestador_id, servicos(nome, duracao_min), prestadores(nome, slug, whatsapp, email, plano), cliente_email')
        .eq('cancel_token', token)
        .single();

      if (!ag) {
        logger.warn('Agendamento nao encontrado para reagendamento POST', { token });
        return Response.json({ erro: 'Agendamento nao encontrado' }, { status: 404, headers: corsHeaders });
      }
      if (ag.prestadores?.plano) errorContext.plano = ag.prestadores.plano;

      const novaDataHora = new Date(`${data}T${hora}:00`).toISOString();
      const inicio = new Date(`${data}T${hora}:00`);
      const fim = new Date(inicio.getTime() + (ag.servicos?.duracao_min ?? 60) * 60000).toISOString();

      const { count } = await supabase
        .from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .eq('prestador_id', ag.prestador_id)
        .eq('status', 'confirmado')
        .neq('id', ag.id)
        .gte('data_hora', inicio.toISOString())
        .lt('data_hora', fim);

      if ((count ?? 0) > 0) {
        logger.info('Conflito de horario para reagendamento', {
          prestador_id: ag.prestador_id,
          nova_data_hora: novaDataHora,
        });
        return Response.json({ erro: 'Horario nao disponivel. Escolha outro.' }, { status: 409, headers: corsHeaders });
      }

      await supabase
        .from('agendamentos')
        .update({ data_hora: novaDataHora })
        .eq('id', ag.id);

      try {
        await fetchImpl(`${getEnv('SUPABASE_URL')}/functions/v1/google-calendar-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            action: 'reagendar',
            agendamento_id: ag.id,
          }),
        });
      } catch {}

      const { data: agAtualizado } = await supabase
        .from('agendamentos')
        .select('*, servicos(nome, duracao_min), prestadores(nome, slug, whatsapp, email, plano)')
        .eq('id', ag.id)
        .single();

      const { data: prefs } = await supabase
        .from('preferencias_notificacao')
        .select('*')
        .eq('prestador_id', ag.prestador_id)
        .single();

      const notifWpp = prefs?.whatsapp_novo_agendamento ?? true;
      const notifEmail = prefs?.email_novo_agendamento ?? true;

      const dataFmt = new Date(novaDataHora).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo',
      });
      const horaFmt = new Date(novaDataHora).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
      });

      if (agAtualizado?.prestadores?.whatsapp && notifWpp) {
        await enviarWhatsApp(
          agAtualizado.prestadores.whatsapp,
          `Agendamento remarcado\nCliente: ${agAtualizado.cliente_nome}\nServico: ${agAtualizado.servicos?.nome}\nNovo horario: ${dataFmt} as ${horaFmt}`,
        );
      }

      if (agAtualizado?.prestadores?.email && notifEmail) {
        await enviarEmail(
          agAtualizado.prestadores.email,
          `Agendamento remarcado por ${agAtualizado.cliente_nome}`,
          `<p>Novo horario: ${dataFmt} as ${horaFmt}</p>`,
        );
      }

      await enviarWhatsApp(
        agAtualizado?.cliente_tel || ag.cliente_tel,
        `Remarcado para ${dataFmt} as ${horaFmt}. Cancelar: ${appUrl}/cancelar?token=${ag.cancel_token}`,
      );

      if (agAtualizado?.cliente_email) {
        await enviarEmail(
          agAtualizado.cliente_email,
          `Agendamento remarcado com ${agAtualizado.prestadores?.nome}`,
          `<p>Remarcado para ${dataFmt} as ${horaFmt}</p>`,
        );
      }

      logger.metric('agendamento_reagendado', {
        agendamento_id: ag.id,
        prestador_id: ag.prestador_id,
        nova_data_hora: novaDataHora,
      });

      return Response.json({ ok: true, nova_data_hora: novaDataHora }, { headers: corsHeaders });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (err) {
    onUnexpectedError?.(err, errorContext);
    await logger.captureError('Erro ao processar reagendamento', err, errorContext);
    return Response.json({ erro: 'Erro interno no servidor' }, { status: 500, headers: corsHeaders });
  }
}
