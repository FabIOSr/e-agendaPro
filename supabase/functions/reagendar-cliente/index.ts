// supabase/functions/reagendar-cliente/index.ts
//
// Permite ao cliente remarcar um agendamento via link unico no WhatsApp.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://esm.sh/@sentry/deno@8";
import { handleReagendarClienteRequest } from "../../../modules/reagendar-cliente-handler.ts";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") ?? "production",
  });
}

const APP_URL = Deno.env.get("APP_URL") ?? "https://e-agendapro.web.app";

// CORS local antigo (substituído pelo módulo _shared/cors.ts)
// const CORS_HEADERS = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// };

async function enviarWhatsApp(telefone: string, mensagem: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "agendapro-prod";

  if (!evolutionUrl || !evolutionKey) return;

  await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": evolutionKey,
    },
    body: JSON.stringify({ number: telefone.replace(/\D/g, ""), textMessage: { text: mensagem } }),
  }).catch(e => {
    if (SENTRY_DSN) Sentry.captureException(e, { tags: { function: "reagendar-cliente", step: "whatsapp" } });
  });
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
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  }).catch(e => {
    if (SENTRY_DSN) Sentry.captureException(e, { tags: { function: "reagendar-cliente", step: "email" } });
  });
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
    <div class="big-icon">📆</div>
    <h1>Remarcar agendamento</h1>
    <p class="sub">Escolha uma nova data e horario para seu atendimento com <strong>${ag.prestadores?.nome}</strong>.</p>
    <div class="atual">
      <strong>Agendamento atual</strong>
      ${ag.servicos?.nome} · ${new Date(ag.data_hora).toLocaleDateString('pt-BR', {weekday:'long',day:'2-digit',month:'long',timeZone:'America/Sao_Paulo'})} as ${new Date(ag.data_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})}
    </div>
    <label>Nova data</label>
    <input type="date" id="data-input" min="${new Date().toISOString().slice(0,10)}" onchange="buscarSlots(this.value)">
    <label>Novo horario</label>
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
const TOKEN = '${token}';
const SERVICO_ID = '${ag.servico_id}';
const PRESTADOR_SLUG = '${ag.prestadores?.slug}';
const SUPABASE_URL = '${APP_URL}';
const SLOTS_INICIAIS = ${slotsJson};
let horaSelecionada = null;

function renderSlots(slots) {
  const grid = document.getElementById('slots-grid');
  const disp = (slots ?? []).filter(s => s.disponivel);
  if (disp.length === 0) {
    grid.innerHTML = '<div class="empty-slots">Sem horarios disponiveis neste dia.</div>';
    return;
  }
  grid.innerHTML = disp.map(s => \`<div class="slot" onclick="selecionarHora('\${s.hora}', this)">\${s.hora}</div>\`).join('');
}

async function buscarSlots(data) {
  const grid = document.getElementById('slots-grid');
  grid.innerHTML = '<div class="empty-slots">Buscando horarios...</div>';
  horaSelecionada = null;
  document.getElementById('btn-confirmar').disabled = true;
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/horarios-disponiveis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prestador_slug: PRESTADOR_SLUG, servico_id: SERVICO_ID, data }),
    });
    const { slots } = await res.json();
    renderSlots(slots);
  } catch {
    grid.innerHTML = '<div class="empty-slots">Erro ao buscar horarios.</div>';
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
  btn.textContent = 'Confirmando...';
  const res = await fetch(window.location.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, data, hora: horaSelecionada }),
  });
  if (res.ok) {
    const { nova_data_hora } = await res.json();
    const d = new Date(nova_data_hora);
    const fmt = d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', timeZone:'America/Sao_Paulo' }) + ' as ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', timeZone:'America/Sao_Paulo' });
    document.getElementById('success-msg').textContent = 'Seu atendimento foi remarcado para ' + fmt + '.';
    document.getElementById('original').classList.add('hide');
    document.getElementById('success').classList.add('show');
  } else {
    btn.disabled = false;
    btn.textContent = 'Erro - tente novamente';
  }
}

if (SLOTS_INICIAIS.length) renderSlots(SLOTS_INICIAIS);
</script>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  return handleReagendarClienteRequest(req, {
    appUrl: APP_URL,
    corsHeaders: () => cors,
    createSupabaseClient: createClient,
    getEnv: (key: string) => Deno.env.get(key),
    fetchImpl: fetch,
    renderPage: paginaReagendar,
    enviarWhatsApp,
    enviarEmail,
    onUnexpectedError: (err: unknown, errorContext: Record<string, unknown>) => {
      if (SENTRY_DSN) {
        Sentry.captureException(err, {
          tags: { function: "reagendar-cliente", plano: (errorContext.plano as string) ?? "unknown" },
          extra: errorContext,
        });
      }
    },
  });
});
