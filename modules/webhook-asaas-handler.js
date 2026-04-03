import {
  calcularValidadeAte,
  classificarEventoAsaas,
  extrairAssinaturaAsaas,
} from './asaas-webhook-rules.js';

export async function handleWebhookAsaasRequest(req, deps) {
  const {
    cors,
    createSupabaseClient,
    getEnv,
    onUnexpectedError,
    now = () => new Date(),
  } = deps;

  const errorContext = {
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
      console.warn('Webhook token invalido');
      return new Response('Unauthorized', { status: 401, headers: cors });
    }

    let payload;
    try {
      payload = await req.json();
    } catch {
      return new Response('Bad Request', { status: 400, headers: cors });
    }

    const { evento, payment, subscription: sub, subId } = extrairAssinaturaAsaas(payload);
    errorContext.evento = evento;
    errorContext.asaas_payment_id = payment?.id ?? null;
    errorContext.asaas_sub_id = subId ?? null;

    console.log(`Webhook Asaas: ${evento}`, { paymentId: payment?.id, subId });

    const acaoEvento = classificarEventoAsaas(evento);
    if (acaoEvento === 'ignorar') {
      return Response.json({ ok: true, ignorado: true, evento }, { headers: cors });
    }

    const supabase = createSupabaseClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    );

    let prestador = null;

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
      console.warn('Prestador nao encontrado - subId:', subId, 'customer:', payment?.customer);
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
      console.error('Erro ao salvar pagamento:', erroPagamento.message);
    } else {
      console.log('Pagamento registrado:', payment?.id);
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
        console.error('Erro ao ativar Pro:', error);
        return Response.json({ erro: 'Erro ao ativar plano' }, { status: 500, headers: cors });
      }

      console.log(`Pro ativado para ${prestador.id} ate ${validoAte.toISOString()} (${ciclo})`);
      return Response.json({ ok: true, acao: 'plano_ativado', valido_ate: validoAte }, { headers: cors });
    }

    if (acaoEvento === 'inadimplente') {
      console.log(`Inadimplente: ${prestador.id} - aguarda cron`);
      return Response.json({ ok: true, acao: 'grace_period_iniciado' }, { headers: cors });
    }

    if (acaoEvento === 'desativar') {
      const { error } = await supabase.rpc('downgrade_pro', {
        p_prestador_id: prestador.id,
      });

      if (error) {
        console.error('Erro ao rebaixar plano:', error);
        return Response.json({ erro: 'Erro ao rebaixar plano' }, { status: 500, headers: cors });
      }

      console.log(`Rebaixado para free + limites aplicados: ${prestador.id} (${evento})`);
      return Response.json({ ok: true, acao: 'plano_rebaixado_limites_aplicados' }, { headers: cors });
    }

    return Response.json({ ok: true }, { headers: cors });
  } catch (err) {
    onUnexpectedError?.(err, errorContext);
    console.error('Erro webhook-asaas:', err);
    return Response.json(
      { erro: 'Erro interno no webhook' },
      { status: 500, headers: cors },
    );
  }
}
