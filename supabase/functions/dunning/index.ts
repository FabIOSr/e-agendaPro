// supabase/functions/dunning/index.ts
//
// Edge Function de Dunning Inteligente
// Recuperacao de pagamentos falhados via email, WhatsApp e oferta de desconto
//
// Cron sugerido: 0 9,15,21 * * * (3x ao dia)
//
// Fluxo por pagamento falhado:
//   Tentativa 0 → Email de aviso
//   Tentativa 1 → WhatsApp + Email de lembrete
//   Tentativa 2 → Email com oferta de desconto (15%)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, validateOrigin, handleCorsPreflight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';
import { sendServerEvent } from '../_shared/analytics.ts';

const SENTRY_DSN = Deno.env.get('SENTRY_DSN');
if (SENTRY_DSN) {
  import('https://esm.sh/@sentry/deno@8.0.0').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: Deno.env.get('SENTRY_ENVIRONMENT') || 'production',
      tracesSampleRate: 0.1,
    });
  });
}

const APP_URL = Deno.env.get('APP_URL') || 'https://e-agendapro.web.app';

serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(origin) ?? new Response('Forbidden', { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  const cors = corsHeaders(origin);

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Busca pagamentos falhados nos ultimos 3 dias
  const tresDiasAtras = new Date();
  tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
  const limite = tresDiasAtras.toISOString();

  const { data: pagamentos, error: errPagamentos } = await supabase
    .from('pagamentos')
    .select('*, prestadores(id, nome, email, whatsapp, asaas_sub_id)')
    .eq('evento', 'PAYMENT_FAILED')
    .gte('data_evento', limite)
    .order('data_evento', { ascending: true });

  if (errPagamentos) {
    logger.error('Erro ao buscar pagamentos falhados', errPagamentos);
    return Response.json({ erro: 'Erro interno' }, { status: 500, headers: cors });
  }

  if (!pagamentos || pagamentos.length === 0) {
    logger.info('Dunning: nenhum pagamento falhado encontrado');
    return Response.json({ ok: true, processados: 0, mensagem: 'Nenhum pagamento falhado' }, { headers: cors });
  }

  logger.info(`Dunning: ${pagamentos.length} pagamento(s) falhado(s) encontrado(s)`);

  let processados = 0;
  let emailsEnviados = 0;
  let whatsappEnviados = 0;
  let erros = 0;

  for (const pg of pagamentos) {
    try {
      const prestador = pg.prestadores;
      if (!prestador) {
        logger.warn('Dunning: prestador nao encontrado para pagamento', { pagamentoId: pg.id });
        continue;
      }

      // Conta tentativas ja realizadas para este pagamento
      const { data: tentativasExistentes } = await supabase
        .from('dunning_tentativas')
        .select('tentativa')
        .eq('pagamento_id', pg.id)
        .order('tentativa', { ascending: false })
        .limit(1);

      const proximaTentativa = tentativasExistentes && tentativasExistentes.length > 0
        ? tentativasExistentes[0].tentativa + 1
        : 0;

      // Maximo de 3 tentativas (0, 1, 2)
      if (proximaTentativa > 2) {
        logger.info('Dunning: maximo de tentativas atingido', {
          pagamentoId: pg.id,
          prestadorId: prestador.id,
        });
        continue;
      }

      // Executa acao baseada no numero da tentativa
      let canal: string;
      let sucessoEmail = false;
      let sucessoWhatsapp = false;

      if (proximaTentativa === 0) {
        // 1ª: Email de aviso
        canal = 'email';
        sucessoEmail = await enviarEmailDunning(prestador, 'primeira');
        if (sucessoEmail) emailsEnviados++;
      } else if (proximaTentativa === 1) {
        // 2ª: WhatsApp + Email de lembrete
        canal = 'whatsapp';
        sucessoWhatsapp = await enviarWhatsAppDunning(prestador);
        sucessoEmail = await enviarEmailDunning(prestador, 'segunda');
        if (sucessoWhatsapp) whatsappEnviados++;
        if (sucessoEmail) emailsEnviados++;
      } else {
        // 3ª: Email com oferta de desconto
        canal = 'email_desconto';
        sucessoEmail = await enviarEmailDunning(prestador, 'desconto');
        if (sucessoEmail) emailsEnviados++;
      }

      // Registra tentativa
      await supabase.from('dunning_tentativas').insert({
        prestador_id: prestador.id,
        pagamento_id: pg.id,
        tentativa: proximaTentativa,
        canal,
        enviado: sucessoEmail || sucessoWhatsapp,
      });

      logger.info('Dunning: tentativa registrada', {
        pagamentoId: pg.id,
        prestadorId: prestador.id,
        tentativa: proximaTentativa,
        canal,
      });

      // Analytics (fire-and-forget)
      sendServerEvent('dunning_tentativa', {
        prestador_id: prestador.id,
        tentativa: proximaTentativa,
        canal,
      }, (k: string) => Deno.env.get(k));

      processados++;
    } catch (e) {
      logger.error('Dunning: erro ao processar pagamento', e, { pagamentoId: pg.id });
      erros++;
    }
  }

  return Response.json(
    {
      ok: true,
      processados,
      emailsEnviados,
      whatsappEnviados,
      erros,
      totalPagamentos: pagamentos.length,
    },
    { headers: cors },
  );
});

// ═══════════════════════════════════════════════════════════
// WhatsApp via Evolution API
// ═══════════════════════════════════════════════════════════

async function enviarWhatsAppDunning(prestador: { nome: string; whatsapp: string }): Promise<boolean> {
  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
  const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'agendapro-prod';

  if (!evolutionUrl || !evolutionKey) {
    logger.warn('Dunning: Evolution API nao configurada');
    return false;
  }

  const message = `⚠️ *Pagamento falhou*\n\nOlá, *${prestador.nome}*!\n\nHouve um problema com o pagamento da sua assinatura AgendaPro.\n\nNão se preocupe — seu acesso continua ativo por enquanto.\n\nPor favor, atualize seus dados de pagamento:\n${APP_URL}/planos\n\nSe já atualizou, desconsidere esta mensagem.`;

  try {
    const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': evolutionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: `55${prestador.whatsapp.replace(/\D/g, '')}`,
        textMessage: { text: message },
      }),
    });

    if (!res.ok) {
      logger.warn('Dunning: WhatsApp falhou', { status: res.status });
      return false;
    }

    return true;
  } catch (e) {
    logger.error('Dunning: erro ao enviar WhatsApp', e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// Email via SendGrid
// ═══════════════════════════════════════════════════════════

async function enviarEmailDunning(
  prestador: { nome: string; email: string },
  tipo: 'primeira' | 'segunda' | 'desconto',
): Promise<boolean> {
  const sendgridKey = Deno.env.get('SENDGRID_API_KEY');
  const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@agendapro.com.br';
  const fromName = Deno.env.get('SENDGRID_FROM_NAME') || 'AgendaPro';

  if (!sendgridKey) {
    logger.warn('Dunning: SendGrid nao configurado');
    return false;
  }

  let assunto: string;
  let corpo: string;

  if (tipo === 'primeira') {
    assunto = 'Pagamento falhou — Atualize seus dados';
    corpo = `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
        <h2>Olá, ${prestador.nome}!</h2>
        <p>Não conseguimos processar o pagamento da sua assinatura AgendaPro.</p>
        <p>Não se preocupe — seu acesso continua ativo por enquanto.</p>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/planos"
             style="background:#c8f060;color:#1a2a08;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">
            Atualizar dados de pagamento
          </a>
        </p>
        <p style="margin-top:24px;color:#666;font-size:14px;">
          Se já atualizou, desconsidere este e-mail.
        </p>
      </div>
    `;
  } else if (tipo === 'segunda') {
    assunto = '⚠️ Ação necessária — Pagamento ainda pendente';
    corpo = `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
        <h2>Atenção, ${prestador.nome}</h2>
        <p>O pagamento da sua assinatura ainda não foi processado.</p>
        <p><strong>Para evitar a interrupção do seu acesso</strong>, atualize seus dados de pagamento o quanto antes.</p>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/planos"
             style="background:#f0a060;color:#1a2a08;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">
            Atualizar agora
          </a>
        </p>
        <p style="margin-top:24px;color:#666;font-size:14px;">
          Também enviamos uma mensagem pelo WhatsApp.
        </p>
      </div>
    `;
  } else {
    assunto = '🎁 Oferta especial — Continue conosco!';
    corpo = `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
        <h2>Não queremos te ver partir, ${prestador.nome}!</h2>
        <p>Notamos que houve um problema com seu pagamento e queremos ajudar.</p>
        <p>Como forma de agradecimento por fazer parte do AgendaPro, oferecemos <strong>15% de desconto</strong> no próximo mês.</p>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/planos"
             style="background:#c8f060;color:#1a2a08;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">
            Usar desconto e atualizar
          </a>
        </p>
        <p style="margin-top:24px;color:#666;font-size:14px;">
          Esta oferta é válida por 7 dias. Use-a ao reativar sua assinatura.
        </p>
      </div>
    `;
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: prestador.email }],
          subject: assunto,
        }],
        from: { email: fromEmail, name: fromName },
        content: [{ type: 'text/html', value: corpo }],
      }),
    });

    if (!res.ok && res.status !== 202) {
      logger.warn('Dunning: Email falhou', { status: res.status, email: prestador.email });
      return false;
    }

    return true;
  } catch (e) {
    logger.error('Dunning: erro ao enviar email', e);
    return false;
  }
}
