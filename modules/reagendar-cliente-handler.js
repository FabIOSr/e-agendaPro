export async function handleReagendarClienteRequest(req, deps) {
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

  const errorContext = {
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
        .select('*, servicos(nome, duracao_min), prestadores(nome, slug, whatsapp)')
        .eq('cancel_token', token)
        .single();

      if (!ag) return new Response('Agendamento nao encontrado', { status: 404, headers: corsHeaders });

      let slots = [];
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
        return Response.json({ erro: 'Campos obrigatorios: token, data, hora' }, { status: 400, headers: corsHeaders });
      }

      const { data: ag } = await supabase
        .from('agendamentos')
        .select('*, prestador_id, servicos(nome, duracao_min), prestadores(nome, slug, whatsapp, email), cliente_email')
        .eq('cancel_token', token)
        .single();

      if (!ag) return Response.json({ erro: 'Agendamento nao encontrado' }, { status: 404, headers: corsHeaders });

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
        .select('*, servicos(nome, duracao_min), prestadores(nome, slug, whatsapp, email)')
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

      return Response.json({ ok: true, nova_data_hora: novaDataHora }, { headers: corsHeaders });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (err) {
    onUnexpectedError?.(err, errorContext);
    return Response.json({ erro: 'Erro interno no servidor' }, { status: 500, headers: corsHeaders });
  }
}
