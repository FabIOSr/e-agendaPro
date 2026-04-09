import { logger } from '../supabase/functions/_shared/logger.ts';

interface Agendamento {
  id: string;
  status?: string;
  cliente_nome?: string;
  cliente_email?: string;
  cliente_tel?: string;
  data_hora: string;
  prestador_id: string;
  servico_id?: string;
  cancel_token?: string;
  prestadores?: {
    nome?: string;
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
  plano?: string;
  [key: string]: unknown;
}

interface Deps {
  corsHeaders: () => Record<string, string>;
  createSupabaseClient: (url: string, key: string) => {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (col: string, val: unknown) => {
          neq: (col: string, val: unknown) => {
            select: (columns: string) => {
              single: () => Promise<{ data: Agendamento | null; error: unknown }>;
            };
          };
          single: () => Promise<{ data: Agendamento | null; error: unknown }>;
        };
      };
      update: (data: Record<string, unknown>) => {
        eq: (col: string, val: unknown) => {
          neq: (col: string, val: unknown) => {
            select: (columns: string) => {
              single: () => Promise<{ data: Agendamento | null; error: unknown }>;
            };
          };
        };
      };
    };
  };
  getEnv: (key: string) => string;
  fetchImpl?: typeof fetch;
  renderPage: (ag: Agendamento, token: string) => string;
  enviarWhatsApp: (phone: string, message: string) => Promise<void>;
  enviarEmail: (to: string, subject: string, html: string) => Promise<void>;
  onUnexpectedError?: (error: unknown, context: Record<string, unknown>) => void;
}

interface WebhookRequest {
  method: string;
  headers: {
    get: (name: string) => string | null;
  };
  url: string;
  json: () => Promise<{ token: string }>;
}

export async function handleCancelarAgendamentoClienteRequest(
  req: WebhookRequest,
  deps: Deps,
): Promise<Response> {
  const {
    corsHeaders,
    createSupabaseClient,
    getEnv,
    fetchImpl = fetch,
    renderPage,
    enviarWhatsApp,
    enviarEmail,
    onUnexpectedError,
  } = deps;

  const url = new URL(req.url);
  const headers = corsHeaders();
  const errorContext: ErrorContext = {
    method: req.method,
    url: req.url,
    content_type: req.headers.get('content-type'),
  };

  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    const supabase = createSupabaseClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    );

    if (req.method === 'GET') {
      const token = url.searchParams.get('token');
      errorContext.token = token;
      if (!token) return new Response('Token invalido', { status: 400 });

      const { data: ag, error } = await supabase
        .from('agendamentos')
        .select('*, servicos(nome, duracao_min), prestadores(nome, whatsapp, plano)')
        .eq('cancel_token', token)
        .single();

      if (ag?.prestadores?.plano) errorContext.plano = ag.prestadores.plano;

      if (error || !ag) {
        logger.warn('Link de cancelamento invalido ou expirado', { token });
        return new Response('<html><body>Link invalido ou expirado</body></html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      if (ag.status === 'cancelado') {
        logger.info('Agendamento ja cancelado', {
          agendamento_id: ag.id,
          token,
        });
        return new Response('<html><body>Agendamento ja cancelado</body></html>', {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      logger.metric('cancelar_page_view', {
        agendamento_id: ag.id,
        prestador_plano: ag.prestadores?.plano,
      });
      return new Response(renderPage(ag, token), {
        headers: { 'Content-Type': 'text/html', ...headers },
      });
    }

    if (req.method === 'POST') {
      const { token } = await req.json();
      errorContext.token = token;
      if (!token) return Response.json({ erro: 'Token ausente' }, { status: 400, headers });

      const { data: ag, error } = await supabase
        .from('agendamentos')
        .update({ status: 'cancelado' })
        .eq('cancel_token', token)
        .neq('status', 'cancelado')
        .select('*, servicos(nome), prestadores(nome, whatsapp, email, plano), cliente_email, cliente_tel')
        .single();

      if (ag?.prestadores?.plano) errorContext.plano = ag.prestadores.plano;

      if (error || !ag) {
        logger.warn('Agendamento nao encontrado ou ja cancelado', { token });
        return Response.json({ erro: 'Agendamento nao encontrado ou ja cancelado' }, { status: 404, headers });
      }

      logger.metric('agendamento_cancelado', {
        agendamento_id: ag.id,
        prestador_id: ag.prestador_id,
        cliente_nome: ag.cliente_nome,
        prestador_plano: ag.prestadores?.plano,
      });

      try {
        await fetchImpl(`${getEnv('SUPABASE_URL')}/functions/v1/google-calendar-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            action: 'cancelar',
            agendamento_id: ag.id,
          }),
        });
      } catch {}

      const { data: prefs } = await supabase
        .from('preferencias_notificacao')
        .select('*')
        .eq('prestador_id', ag.prestador_id)
        .single();

      const notifWpp = prefs?.whatsapp_cancelamento ?? true;
      const notifEmail = prefs?.email_cancelamento ?? true;

      const d = new Date(ag.data_hora);
      const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

      if (ag.prestadores?.whatsapp && notifWpp) {
        await enviarWhatsApp(ag.prestadores.whatsapp, `Cancelado: ${ag.cliente_nome} em ${data} as ${hora}`);
      }

      if (ag.prestadores?.email && notifEmail) {
        await enviarEmail(ag.prestadores.email, `Agendamento cancelado por ${ag.cliente_nome}`, `<p>${data} as ${hora}</p>`);
      }

      if (ag.cliente_tel) {
        await enviarWhatsApp(ag.cliente_tel, `Seu agendamento foi cancelado em ${data} as ${hora}`);
      }

      if (ag.cliente_email) {
        await enviarEmail(ag.cliente_email, `Agendamento cancelado com ${ag.prestadores?.nome}`, `<p>${data} as ${hora}</p>`);
      }

      return Response.json({ ok: true, mensagem: 'Agendamento cancelado com sucesso.' }, { headers });
    }

    return new Response('Method not allowed', { status: 405, headers });
  } catch (err) {
    onUnexpectedError?.(err, errorContext);
    await logger.captureError('Erro ao processar cancelamento', err, errorContext);
    return Response.json({ erro: 'Erro interno no servidor' }, { status: 500, headers });
  }
}
