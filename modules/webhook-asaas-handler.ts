import { logger } from '../supabase/functions/_shared/logger.ts';
import {
  calcularValidadeAte,
  classificarEventoAsaas,
  extrairAssinaturaAsaas,
} from './asaas-webhook-rules.js';

interface PaymentInfo {
  id?: string;
  customer?: string;
  value?: number;
  billingType?: string;
  subscription?: {
    cycle?: string;
  };
}

interface SubscriptionInfo {
  cycle?: string;
}

interface AsaasPayload {
  evento?: string;
  payment?: PaymentInfo;
  subscription?: SubscriptionInfo;
}

interface Prestador {
  id: string;
  plano: string;
  asaas_customer_id?: string;
}

interface ErrorContext {
  method: string;
  content_type: string | null;
  url: string;
  token_presente?: boolean;
  evento?: string;
  asaas_payment_id?: string | null;
  asaas_sub_id?: string | null;
  [key: string]: unknown;
}

interface Deps {
  cors: Record<string, string>;
  createSupabaseClient: (url: string, key: string) => {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{ data: Prestador | null }>;
        };
        neq: (col: string, val: unknown) => {
          gte: (col: string, val: string) => {
            lt: (col: string, val: string) => {
              select: (columns: string, options: { count: string; head: boolean }) => Promise<{ count: number | null }>;
            };
          };
        };
      };
      update: (data: Record<string, unknown>) => {
        eq: (col: string, val: unknown) => {
          select: (columns: string) => {
            single: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      upsert: (data: Record<string, unknown>, options?: { onConflict: string }) => Promise<{ error: unknown }>;
    };
    rpc: (fn: string, params: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
  getEnv: (key: string) => string;
  onUnexpectedError?: (error: unknown, context: Record<string, unknown>) => void;
  now?: () => Date;
}

interface WebhookRequest {
  method: string;
  headers: {
    get: (name: string) => string | null;
  };
  url: string;
  json: () => Promise<AsaasPayload>;
}

export async function handleWebhookAsaasRequest(
  req: WebhookRequest,
  deps: Deps,
): Promise<Response> {
  const {
    cors,
    createSupabaseClient,
    getEnv,
    onUnexpectedError,
    now = () => new Date(),
  } = deps;

  const errorContext: ErrorContext = {
    method: req.method,
    content_type: req.headers.get('content-type'),
    url: req.url,
  };

  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const webhookToken = req.headers.get('asaas-access-token');
    const tokenEsperado = getEnv('ASAAS_WEBHOOK_TOKEN');
    errorContext.token_presente = Boolean(webhookToken);

    if (!tokenEsperado || webhookToken !== tokenEsperado) {
      logger.warn('Webhook token invalido', { context: errorContext });
      return new Response('Unauthorized', { status: 401, headers: cors });
    }

    let payload: AsaasPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response('Bad Request', { status: 400, headers: cors });
    }

    const { evento, payment, subscription: sub, subId } = extrairAssinaturaAsaas(payload);
    errorContext.evento = evento;
    errorContext.asaas_payment_id = payment?.id ?? null;
    errorContext.asaas_sub_id = subId ?? null;

    logger.metric('webhook_asaas_received', {
      evento,
      paymentId: payment?.id,
      subId,
    });

    const acaoEvento = classificarEventoAsaas(evento);
    if (acaoEvento === 'ignorar') {
      return Response.json({ ok: true, ignorado: true, evento }, { headers: cors });
    }

    const supabase = createSupabaseClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    );

    let prestador: Prestador | null = null;

    if (subId) {
      const { data } = await supabase
        .from('prestadores')
        .select('id, plano, asaas_customer_id')
        .eq('asaas_sub_id', subId)
        .maybeSingle();
      prestador = data;
    }

    if (!prestador && payment?.customer) {
      const { data } = await supabase
        .from('prestadores')
        .select('id, plano, asaas_customer_id')
        .eq('asaas_customer_id', payment.customer)
        .maybeSingle();
      prestador = data;

      if (prestador && subId) {
        await supabase
          .from('prestadores')
          .update({ asaas_sub_id: subId })
          .eq('id', prestador.id);
      }
    }

    if (!prestador) {
      logger.warn('Prestador nao encontrado', {
        subId,
        customer: payment?.customer,
      });
      return Response.json({ ok: true, ignorado: true }, { headers: cors });
    }

    const { error: erroPagamento } = await supabase.from('pagamentos').upsert({
      prestador_id: prestador.id,
      asaas_payment_id: payment?.id ?? null,
      evento,
      valor: payment?.value ?? null,
      billing_type: payment?.billingType ?? null,
      data_evento: now().toISOString(),
      payload,
    }, {
      onConflict: 'asaas_payment_id,evento',
    });

    if (erroPagamento) {
      await logger.error('Erro ao registrar pagamento', erroPagamento, {
        prestador_id: prestador.id,
        asaas_payment_id: payment?.id,
      });
    } else {
      logger.metric('pagamento_registrado', {
        prestador_id: prestador.id,
        asaas_payment_id: payment?.id,
        evento,
      });
    }

    if (acaoEvento === 'ativar') {
      const ciclo = payment?.subscription?.cycle ?? sub?.cycle ?? 'MONTHLY';
      const validoAte = calcularValidadeAte(ciclo, now());

      const { error } = await supabase
        .from('prestadores')
        .update({
          plano: 'pro',
          plano_valido_ate: validoAte.toISOString(),
          trial_usado: true,
          assinatura_periodicidade: ciclo,
        })
        .eq('id', prestador.id);

      if (error) {
        await logger.error('Erro ao ativar Pro', error, {
          prestador_id: prestador.id,
          evento,
        });
        return Response.json({ erro: 'Erro ao ativar plano' }, { status: 500, headers: cors });
      }

      logger.metric('plano_ativado', {
        prestador_id: prestador.id,
        valido_ate: validoAte.toISOString(),
        ciclo,
      });
      return Response.json({ ok: true, acao: 'plano_ativado', valido_ate: validoAte }, { headers: cors });
    }

    if (acaoEvento === 'inadimplente') {
      logger.info('Inadimplente detectado - aguarda cron', {
        prestador_id: prestador.id,
      });
      return Response.json({ ok: true, acao: 'grace_period_iniciado' }, { headers: cors });
    }

    if (acaoEvento === 'desativar') {
      const { error } = await supabase.rpc('downgrade_pro', {
        p_prestador_id: prestador.id,
      });

      if (error) {
        await logger.error('Erro ao rebaixar plano', error, {
          prestador_id: prestador.id,
          evento,
        });
        return Response.json({ erro: 'Erro ao rebaixar plano' }, { status: 500, headers: cors });
      }

      logger.metric('plano_rebaixado', {
        prestador_id: prestador.id,
        evento,
      });
      return Response.json({ ok: true, acao: 'plano_rebaixado_limites_aplicados' }, { headers: cors });
    }

    return Response.json({ ok: true }, { headers: cors });
  } catch (err) {
    onUnexpectedError?.(err, errorContext);
    await logger.captureError('Erro no webhook asaas', err, errorContext);
    return Response.json(
      { erro: 'Erro interno no webhook' },
      { status: 500, headers: cors },
    );
  }
}
