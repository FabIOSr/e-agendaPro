// supabase/functions/reagendar-cliente/index.ts
//
// Permite ao cliente remarcar um agendamento via link único no WhatsApp.
//
// GET  ?token=xxxx               → página de seleção de novo horário
// POST { token, data, hora }     → executa o reagendamento
//
// A lógica de horários disponíveis reutiliza a mesma Edge Function
// horarios-disponiveis que já existe.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = Deno.env.get("APP_URL") ?? "https://e-agendapro.web.app";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function enviarWhatsApp(telefone: string, mensagem: string) {
  const token = Deno.env.get("ZAPI_TOKEN");
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
  
  if (!token || !instanceId || !clientToken) return;
  
  await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": clientToken,
    },
    body: JSON.stringify({ phone: telefone.replace(/\D/g, ""), message: mensagem }),
  }).catch(e => console.error("WhatsApp error:", e));
}

async function enviarEmail(to: string, subject: string, html: string) {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) return;

  await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sendgridKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "fabio-s-ramos@hotmail.com", name: "AgendaPro" },
      subject: subject,
      content: [{ type: "text/html", value: html }],
    }),
  }).catch(e => console.error("Email error:", e));
}

function paginaReagendar(ag: any, token: string, slots: any[]): string {
  const slotsDisponiveis = slots.filter(s => s.disponivel);
  const slotsJson = JSON.stringify(slotsDisponiveis);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Remarcar agendamento</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,sans-serif; background:#f5f2eb; color:#0e0d0a; min-height:100vh; padding:20px; }
  .card { background:#fff; border-radius:16px; padding:28px; max-width:420px; margin:0 auto; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  h1 { font-size:22px; font-weight:600; margin-bottom:6px; }
  .sub { font-size:14px; color:#6b6860; margin-bottom:20px; line-height:1.6; }
  .atual { background:#f5f2eb; border-radius:10px; padding:12px 16px; margin-bottom:20px; font-size:13px; color:#6b6860; }
  .atual strong { color:#0e0d0a; display:block; margin-bottom:4px; }
  label { display:block; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6b6860; margin-bottom:6px; }
  input[type=date] { width:100%; background:#f5f2eb; border:1.5px solid #d8d4c8; border-radius:8px; padding:10px 13px; font-size:14px; outline:none; margin-bottom:16px; transition:border-color .2s; }
  input[type=date]:focus { border-color:#8ab830; }
  .slots { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:20px; min-height:48px; }
  .slot { background:#f5f2eb; border:1.5px solid #d8d4c8; border-radius:9px; padding:10px 4px; text-align:center; font-size:13px; cursor:pointer; transition:all .15s; }
  .slot:hover { border-color:#8ab830; background:#eef6d8; }
  .slot.selected { border-color:#8ab830; background:#c8f060; color:#1a2a08; font-weight:600; }
  .empty-slots { grid-column:1/-1; text-align:center; color:#a8a49a; font-size:13px; padding:12px 0; }
  .btn { width:100%; background:#0e0d0a; color:#f0ede6; border:none; border-radius:10px; padding:14px; font-size:15px; font-weight:600; cursor:pointer; margin-bottom:8px; }
  .btn:hover { background:#2a2820; }
  .btn:disabled { opacity:.35; cursor:default; }
  .btn-ghost { width:100%; background:none; color:#6b6860; border:1.5px solid #d8d4c8; border-radius:10px; padding:12px; font-size:14px; cursor:pointer; }
  .success { display:none; text-align:center; }
  .success.show { display:block; }
  .original.hide { display:none; }
  .big-icon { font-size:40px; margin-bottom:14px; }
</style>
</head>
<body>
<div class="card">
  <div class="original" id="original">
    <div class="big-icon">📅</div>
    <h1>Remarcar agendamento</h1>
    <p class="sub">Escolha uma nova data e horário para seu atendimento com <strong>${ag.prestadores?.nome}</strong>.</p>

    <div class="atual">
      <strong>Agendamento atual</strong>
      ${ag.servicos?.nome} · ${new Date(ag.data_hora).toLocaleDateString('pt-BR', {weekday:'long',day:'2-digit',month:'long',timeZone:'America/Sao_Paulo'})} às ${new Date(ag.data_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})}
    </div>

    <label>Nova data</label>
    <input type="date" id="data-input" min="${new Date().toISOString().slice(0,10)}" onchange="buscarSlots(this.value)">

    <label>Novo horário</label>
    <div class="slots" id="slots-grid">
      <div class="empty-slots">Selecione uma data primeiro</div>
    </div>

    <button class="btn" id="btn-confirmar" disabled onclick="confirmar()">Confirmar remarcação</button>
    <button class="btn-ghost" onclick="history.back()">Cancelar</button>
  </div>

  <div class="success" id="success">
    <div class="big-icon">✅</div>
    <h1>Remarcado!</h1>
    <p class="sub" id="success-msg"></p>
  </div>
</div>

<script>
const TOKEN          = '${token}';
const SERVICO_ID     = '${ag.servico_id}';
const PRESTADOR_SLUG = '${ag.prestadores?.slug}';
const SUPABASE_URL   = '${APP_URL}';
let horaSelecionada  = null;

async function buscarSlots(data) {
  const grid = document.getElementById('slots-grid');
  grid.innerHTML = '<div class="empty-slots">Buscando horários…</div>';
  horaSelecionada = null;
  document.getElementById('btn-confirmar').disabled = true;

  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/horarios-disponiveis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prestador_slug: PRESTADOR_SLUG, servico_id: SERVICO_ID, data }),
    });
    const { slots } = await res.json();
    const disp = (slots ?? []).filter(s => s.disponivel);

    if (disp.length === 0) {
      grid.innerHTML = '<div class="empty-slots">Sem horários disponíveis neste dia.</div>';
      return;
    }

    grid.innerHTML = disp.map(s => \`
      <div class="slot" onclick="selecionarHora('\${s.hora}', this)">\${s.hora}</div>
    \`).join('');
  } catch(e) {
    grid.innerHTML = '<div class="empty-slots">Erro ao buscar horários.</div>';
  }
}

function selecionarHora(hora, el) {
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  horaSelecionada = hora;
  document.getElementById('btn-confirmar').disabled = false;
}

async function confirmar() {
  const data = document.getElementById('data-input').value;
  if (!data || !horaSelecionada) return;

  const btn = document.getElementById('btn-confirmar');
  btn.disabled = true;
  btn.textContent = 'Confirmando…';

  const res = await fetch(window.location.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, data, hora: horaSelecionada }),
  });

  if (res.ok) {
    const { nova_data_hora } = await res.json();
    const d = new Date(nova_data_hora);
    const fmt = d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', timeZone:'America/Sao_Paulo' })
      + ' às ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', timeZone:'America/Sao_Paulo' });
    document.getElementById('success-msg').textContent = 'Seu atendimento foi remarcado para ' + fmt + '.';
    document.getElementById('original').classList.add('hide');
    document.getElementById('success').classList.add('show');
  } else {
    btn.disabled = false;
    btn.textContent = 'Erro — tente novamente';
  }
}
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) return new Response("Token inválido", { status: 400, headers: CORS_HEADERS });

    const { data: ag } = await supabase
      .from("agendamentos")
      .select("*, servicos(nome, duracao_min), prestadores(nome, slug, whatsapp)")
      .eq("cancel_token", token)
      .single();

    if (!ag) return new Response("Agendamento não encontrado", { status: 404, headers: CORS_HEADERS });

    // Busca slots disponíveis para hoje como ponto de partida
    const hoje = new Date().toISOString().slice(0, 10);
    let slots: any[] = [];
    try {
      const slotsRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/horarios-disponiveis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            prestador_slug: ag.prestadores?.slug,
            servico_id: ag.servico_id,
            data: hoje,
          }),
        }
      );
      const slotsData = await slotsRes.json();
      slots = slotsData.slots ?? [];
    } catch {}

    return new Response(paginaReagendar(ag, token, slots), {
      headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
    });
  }

  if (req.method === "POST") {
    const { token, data, hora } = await req.json();
    if (!token || !data || !hora) {
      return Response.json({ erro: "Campos obrigatórios: token, data, hora" }, { status: 400, headers: CORS_HEADERS });
    }

    // Busca o agendamento atual
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("*, prestador_id, servicos(nome, duracao_min), prestadores(nome, slug, whatsapp, email), cliente_email")
      .eq("cancel_token", token)
      .single();

    if (!ag) return Response.json({ erro: "Agendamento não encontrado" }, { status: 404, headers: CORS_HEADERS });

    // Verifica se o novo horário ainda está disponível
    const novaDataHora = new Date(`${data}T${hora}:00`).toISOString();

    const { count } = await supabase
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("prestador_id", ag.prestador_id)
      .eq("status", "confirmado")
      .neq("id", ag.id)
      .gte("data_hora", new Date(`${data}T${hora}:00`).toISOString())
      .lt("data_hora", new Date(`${data}T${hora}:00`).getTime() + (ag.servicos?.duracao_min ?? 60) * 60000 + "");

    if ((count ?? 0) > 0) {
      return Response.json({ erro: "Horário não disponível. Escolha outro." }, { status: 409, headers: CORS_HEADERS });
    }

    // Atualiza o agendamento
    await supabase
      .from("agendamentos")
      .update({ data_hora: novaDataHora })
      .eq("id", ag.id);

    // Busca dados atualizados com email
    const { data: agAtualizado } = await supabase
      .from("agendamentos")
      .select("*, servicos(nome, duracao_min), prestadores(nome, slug, whatsapp, email)")
      .eq("id", ag.id)
      .single();

    // Busca preferências de notificação do prestador
    const { data: prefs } = await supabase
      .from("preferencias_notificacao")
      .select("*")
      .eq("prestador_id", ag.prestador_id)
      .single();

    // Defaults se não tiver preferências
    const notifWpp = prefs?.whatsapp_novo_agendamento ?? true;
    const notifEmail = prefs?.email_novo_agendamento ?? true;

    // Notifica prestador e cliente
    const dataFmt = new Date(novaDataHora).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo",
    });
    const horaFmt = new Date(novaDataHora).toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    });

    // WhatsApp do prestador (se preferência ativa)
    if (agAtualizado?.prestadores?.whatsapp && notifWpp) {
      await enviarWhatsApp(agAtualizado.prestadores.whatsapp,
        `🔄 *Agendamento remarcado*\n\n` +
        `👤 *Cliente:* ${agAtualizado.cliente_nome}\n` +
        `📋 *Serviço:* ${agAtualizado.servicos?.nome}\n` +
        `📅 *Novo horário:* ${dataFmt} às ${horaFmt}`
      );
    }

    // Email para prestador (se preferência ativa)
    if (agAtualizado?.prestadores?.email && notifEmail) {
      await enviarEmail(
        agAtualizado.prestadores.email,
        `🔄 Agendamento remarcado por ${agAtualizado.cliente_nome}`,
        `<div style="font-family: sans-serif;">
          <h2>🔄 Agendamento Remarcado</h2>
          <p><strong>Cliente:</strong> ${agAtualizado.cliente_nome}</p>
          <p><strong>Serviço:</strong> ${agAtualizado.servicos?.nome}</p>
          <p><strong>Novo horário:</strong> ${dataFmt} às ${horaFmt}</p>
        </div>`
      );
    }

    // WhatsApp do cliente
    await enviarWhatsApp(agAtualizado?.cliente_tel || ag.cliente_tel,
      `✅ Remarcado! Seu atendimento com *${agAtualizado?.prestadores?.nome || ag.prestadores?.nome}* foi remarcado para *${dataFmt} às ${horaFmt}*.\n\n` +
      `Se precisar cancelar: ${APP_URL}/cancelar?token=${ag.cancel_token}`
    );

    // Email para cliente
    if (agAtualizado?.cliente_email) {
      await enviarEmail(
        agAtualizado.cliente_email,
        `✅ Agendamento remarcado com ${agAtualizado.prestadores?.nome}`,
        `<div style="font-family: sans-serif;">
          <h2>✅ Agendamento Remarcado</h2>
          <p>Seu atendimento foi remarcado para <strong>${dataFmt} às ${horaFmt}</strong>.</p>
          <p><strong>Serviço:</strong> ${agAtualizado.servicos?.nome}</p>
          <p><strong>Profissional:</strong> ${agAtualizado.prestadores?.nome}</p>
          <p style="margin-top: 20px;">
            <a href="${APP_URL}/cancelar?token=${ag.cancel_token}" style="color: #c84830;">Cancelar agendamento</a>
          </p>
        </div>`
      );
    }

    return Response.json({ ok: true, nova_data_hora: novaDataHora }, { headers: CORS_HEADERS });
  }

  return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
});
