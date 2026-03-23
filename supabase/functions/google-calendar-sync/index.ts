// supabase/functions/google-calendar-sync/index.ts
//
// Sincroniza agendamentos do AgendaPro com o Google Calendar do prestador.
//
// Fluxo OAuth:
//   1. GET ?action=auth&prestador_id=xxx  → redireciona para consent screen do Google
//   2. GET ?action=callback&code=xxx      → troca code por tokens e salva no Supabase
//
// Sincronização:
//   POST { action: "criar",    agendamento_id }  → cria evento no Calendar
//   POST { action: "cancelar", agendamento_id }  → deleta o evento do Calendar
//   POST { action: "reagendar",agendamento_id }  → atualiza horário do evento
//
// Variáveis de ambiente:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const REDIRECT_URI         = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync?action=callback`;
const SCOPES               = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_API         = "https://www.googleapis.com/calendar/v3";

// ---------------------------------------------------------------------------
// Helpers OAuth
// ---------------------------------------------------------------------------
async function obterTokens(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    "authorization_code",
    }),
  });
  return res.json();
}

async function renovarAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type:    "refresh_token",
    }),
  });
  return res.json();
}

async function getAccessToken(supabase: any, prestadorId: string): Promise<string> {
  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("prestador_id", prestadorId)
    .single();

  if (!data) throw new Error("Google Calendar não conectado");

  // Renova se expirado (com 5 min de margem)
  if (new Date(data.expires_at).getTime() < Date.now() + 5 * 60 * 1000) {
    const novos = await renovarAccessToken(data.refresh_token);
    await supabase.from("google_calendar_tokens").update({
      access_token: novos.access_token,
      expires_at:   new Date(Date.now() + novos.expires_in * 1000).toISOString(),
    }).eq("prestador_id", prestadorId);
    return novos.access_token;
  }

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Operações no Calendar
// ---------------------------------------------------------------------------
async function criarEvento(accessToken: string, ag: any) {
  const inicio = new Date(ag.data_hora);
  const fim    = new Date(inicio.getTime() + (ag.servicos?.duracao_min ?? 60) * 60 * 1000);

  const res = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      summary:     `${ag.servicos?.nome} — ${ag.cliente_nome}`,
      description: `📞 ${ag.cliente_tel}\n📋 ${ag.servicos?.nome}\n💰 R$${ag.servicos?.preco}`,
      start: { dateTime: inicio.toISOString(), timeZone: "America/Sao_Paulo" },
      end:   { dateTime: fim.toISOString(),    timeZone: "America/Sao_Paulo" },
      colorId: "2", // verde
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup",  minutes: 30 },
          { method: "popup",  minutes: 1440 }, // 1 dia
        ],
      },
    }),
  });

  const evento = await res.json();
  return evento.id;
}

async function atualizarEvento(accessToken: string, eventoId: string, ag: any) {
  const inicio = new Date(ag.data_hora);
  const fim    = new Date(inicio.getTime() + (ag.servicos?.duracao_min ?? 60) * 60 * 1000);

  await fetch(`${CALENDAR_API}/calendars/primary/events/${eventoId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      start: { dateTime: inicio.toISOString(), timeZone: "America/Sao_Paulo" },
      end:   { dateTime: fim.toISOString(),    timeZone: "America/Sao_Paulo" },
    }),
  });
}

async function deletarEvento(accessToken: string, eventoId: string) {
  await fetch(`${CALENDAR_API}/calendars/primary/events/${eventoId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
}

// ---------------------------------------------------------------------------
// Handler HTTP
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const url    = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── INICIAR AUTH OAUTH ──────────────────────────────────────────────────
  if (action === "auth") {
    const prestadorId = url.searchParams.get("prestador_id");
    if (!prestadorId) return new Response("prestador_id obrigatório", { status: 400 });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id",     GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri",  REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope",         SCOPES);
    authUrl.searchParams.set("access_type",   "offline");
    authUrl.searchParams.set("prompt",        "consent");
    authUrl.searchParams.set("state",         prestadorId); // passa ID pelo state

    return Response.redirect(authUrl.toString(), 302);
  }

  // ── CALLBACK OAUTH ──────────────────────────────────────────────────────
  if (action === "callback") {
    const code        = url.searchParams.get("code");
    const prestadorId = url.searchParams.get("state");

    if (!code || !prestadorId) {
      return new Response("Parâmetros inválidos", { status: 400 });
    }

    const tokens = await obterTokens(code);

    if (tokens.error) {
      return new Response(`Erro OAuth: ${tokens.error_description}`, { status: 400 });
    }

    // Salva tokens
    await supabase.from("google_calendar_tokens").upsert({
      prestador_id:  prestadorId,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: "prestador_id" });

    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
        <h2>✅ Google Calendar conectado!</h2>
        <p style="color:#888;margin-top:8px">Seus agendamentos serão sincronizados automaticamente.</p>
        <script>setTimeout(() => window.close(), 2000)</script>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // ── OPERAÇÕES ───────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { action: op, agendamento_id } = await req.json();

    if (!op || !agendamento_id) {
      return Response.json({ erro: "action e agendamento_id obrigatórios" }, { status: 400 });
    }

    const { data: ag } = await supabase
      .from("agendamentos")
      .select("*, servicos(nome, duracao_min, preco)")
      .eq("id", agendamento_id)
      .single();

    if (!ag) return Response.json({ erro: "Agendamento não encontrado" }, { status: 404 });

    // Prestador tem Calendar conectado?
    const { data: tokenRow } = await supabase
      .from("google_calendar_tokens")
      .select("prestador_id")
      .eq("prestador_id", ag.prestador_id)
      .single();

    if (!tokenRow) {
      // Silenciosamente ignora — Calendar não conectado
      return Response.json({ ok: true, sincronizado: false, motivo: "Calendar não conectado" });
    }

    const accessToken = await getAccessToken(supabase, ag.prestador_id);

    if (op === "criar") {
      const eventoId = await criarEvento(accessToken, ag);
      // Salva o ID do evento para poder atualizar/deletar depois
      await supabase.from("agendamentos")
        .update({ google_event_id: eventoId })
        .eq("id", agendamento_id);
      return Response.json({ ok: true, sincronizado: true, evento_id: eventoId });
    }

    if (op === "reagendar") {
      if (!ag.google_event_id) {
        return Response.json({ erro: "Evento não encontrado no Calendar" }, { status: 404 });
      }
      await atualizarEvento(accessToken, ag.google_event_id, ag);
      return Response.json({ ok: true, sincronizado: true });
    }

    if (op === "cancelar") {
      if (ag.google_event_id) {
        await deletarEvento(accessToken, ag.google_event_id);
      }
      return Response.json({ ok: true, sincronizado: true });
    }

    return Response.json({ erro: "action inválida" }, { status: 400 });
  }

  return new Response("Not found", { status: 404 });
});
