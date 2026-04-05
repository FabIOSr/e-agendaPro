// supabase/functions/avaliacoes/index.ts
//
// Gerencia avaliações de clientes após atendimentos concluídos.
//
// GET  ?token=xxxx        → página de avaliação (estrelas 1–5 + comentário)
// POST { token, nota, comentario } → salva a avaliação
// GET  ?prestador_slug=xx  → retorna avaliações públicas do prestador (para a página pública)
//
// A avaliação é solicitada automaticamente pelo cron job de lembretes,
// 2h após o horário do agendamento.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

// CORS local antigo (substituído pelo módulo _shared/cors.ts)
// const cors = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// };

// ---------------------------------------------------------------------------
// HTML da página de avaliação
// ---------------------------------------------------------------------------
function paginaAvaliacao(ag: any, token: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Como foi seu atendimento?</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,sans-serif; background:#f5f2eb; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .card { background:#fff; border-radius:16px; padding:32px 28px; max-width:400px; width:100%; box-shadow:0 4px 24px rgba(0,0,0,.08); text-align:center; }
  .avatar { width:64px; height:64px; border-radius:50%; background:#eef6d8; display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:700; color:#8ab830; margin:0 auto 14px; }
  h1 { font-size:20px; font-weight:600; margin-bottom:6px; }
  .sub { font-size:14px; color:#6b6860; margin-bottom:24px; line-height:1.6; }
  .stars { display:flex; justify-content:center; gap:8px; margin-bottom:20px; }
  .star { font-size:36px; cursor:pointer; transition:transform .15s; filter:grayscale(1) opacity(.4); }
  .star.on { filter:none; transform:scale(1.1); }
  .star:hover, .star.hover { filter:none; transform:scale(1.1); }
  .nota-label { font-size:14px; font-weight:600; color:#0e0d0a; margin-bottom:16px; min-height:20px; }
  textarea { width:100%; background:#f5f2eb; border:1.5px solid #d8d4c8; border-radius:10px; padding:12px; font-size:14px; font-family:inherit; resize:vertical; min-height:80px; outline:none; margin-bottom:16px; transition:border-color .2s; }
  textarea:focus { border-color:#8ab830; }
  .btn { width:100%; background:#0e0d0a; color:#f0ede6; border:none; border-radius:10px; padding:14px; font-size:15px; font-weight:600; cursor:pointer; }
  .btn:hover { background:#2a2820; }
  .btn:disabled { opacity:.35; cursor:default; }
  .success { display:none; }
  .success.show { display:block; }
  .original.hide { display:none; }
  .big { font-size:40px; margin-bottom:14px; }
</style>
</head>
<body>
<div class="card">
  <div class="original" id="original">
    <div class="avatar">${(ag.prestadores?.nome ?? 'A')[0]}</div>
    <h1>Como foi com ${ag.prestadores?.nome?.split(' ')[0]}?</h1>
    <p class="sub">Sua avaliação ajuda outros clientes e melhora o serviço.</p>

    <div class="stars" id="stars">
      ${[1,2,3,4,5].map(n => `<span class="star" data-n="${n}" onclick="selecionarNota(${n})" onmouseover="hoverNota(${n})" onmouseout="resetHover()">⭐</span>`).join('')}
    </div>
    <div class="nota-label" id="nota-label">Toque em uma estrela</div>

    <textarea id="comentario" placeholder="Deixe um comentário (opcional)…"></textarea>

    <button class="btn" id="btn-enviar" disabled onclick="enviarAvaliacao()">Enviar avaliação</button>
  </div>

  <div class="success" id="success">
    <div class="big">🙏</div>
    <h1>Obrigada!</h1>
    <p class="sub">Sua avaliação foi enviada. Até a próxima!</p>
  </div>
</div>
<script>
const TOKEN = '${token}';
const LABELS = ['','Muito ruim 😞','Ruim 😕','Regular 😐','Bom 😊','Excelente! 🤩'];
let notaSelecionada = 0;

function selecionarNota(n) {
  notaSelecionada = n;
  atualizarEstrelas(n);
  document.getElementById('nota-label').textContent = LABELS[n];
  document.getElementById('btn-enviar').disabled = false;
}
function hoverNota(n) { atualizarEstrelas(n, true); }
function resetHover() { atualizarEstrelas(notaSelecionada); }
function atualizarEstrelas(n, hover=false) {
  document.querySelectorAll('.star').forEach(s => {
    const sn = +s.dataset.n;
    s.classList.toggle('on',    !hover && sn <= n);
    s.classList.toggle('hover',  hover && sn <= n);
  });
}

async function enviarAvaliacao() {
  const comentario = document.getElementById('comentario').value.trim();
  const btn = document.getElementById('btn-enviar');
  btn.disabled = true; btn.textContent = 'Enviando…';

  const res = await fetch(window.location.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, nota: notaSelecionada, comentario }),
  });

  if (res.ok) {
    document.getElementById('original').classList.add('hide');
    document.getElementById('success').classList.add('show');
  } else {
    btn.disabled = false; btn.textContent = 'Tentar novamente';
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
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  const url = new URL(req.url);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // GET ?prestador_slug=xxx → avaliações públicas
  if (req.method === "GET" && url.searchParams.has("prestador_slug")) {
    const slug = url.searchParams.get("prestador_slug")!;

    const { data: prestador } = await supabase
      .from("prestadores").select("id").eq("slug", slug).single();

    if (!prestador) return Response.json({ erro: "Prestador não encontrado" }, { status: 404 });

    const { data: avs } = await supabase
      .from("avaliacoes")
      .select("nota, comentario, cliente_nome, created_at")
      .eq("prestador_id", prestador.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: stats } = await supabase.rpc("stats_avaliacoes", {
      p_prestador_id: prestador.id,
    });

    return Response.json({
      media: stats?.[0]?.media ?? 0,
      total: stats?.[0]?.total ?? 0,
      avaliacoes: avs ?? [],
    }, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  // GET ?token=xxx → página de avaliação
  if (req.method === "GET" && url.searchParams.has("token")) {
    const token = url.searchParams.get("token")!;

    const { data: ag } = await supabase
      .from("agendamentos")
      .select("*, prestadores(nome, slug)")
      .eq("cancel_token", token)
      .eq("status", "concluido")
      .single();

    if (!ag) {
      return new Response(
        `<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
          <h2>Link inválido ou expirado</h2>
        </body></html>`,
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    // Verifica se já avaliou
    const { data: jaAvaliou } = await supabase
      .from("avaliacoes").select("id").eq("agendamento_id", ag.id).single();

    if (jaAvaliou) {
      return new Response(
        `<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
          <h2>✅ Você já avaliou este atendimento</h2>
          <p style="color:#888;margin-top:8px">Obrigado pelo feedback!</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response(paginaAvaliacao(ag, token), {
      headers: { "Content-Type": "text/html" },
    });
  }

  // POST → salva avaliação
  if (req.method === "POST") {
    const { token, nota, comentario } = await req.json();

    if (!token || !nota || nota < 1 || nota > 5) {
      return Response.json({ erro: "token e nota (1–5) são obrigatórios" }, { status: 400, headers: cors });
    }

    const { data: ag } = await supabase
      .from("agendamentos")
      .select("id, prestador_id, cliente_nome, servicos(nome)")
      .eq("cancel_token", token)
      .eq("status", "concluido")
      .single();

    if (!ag) return Response.json({ erro: "Agendamento não encontrado" }, { status: 404, headers: cors });

    const { error } = await supabase.from("avaliacoes").insert({
      agendamento_id: ag.id,
      prestador_id:   ag.prestador_id,
      cliente_nome:   ag.cliente_nome,
      nota,
      comentario:     comentario ?? null,
    });

    if (error?.code === "23505") {
      return Response.json({ erro: "Já avaliado" }, { status: 409, headers: cors });
    }
    if (error) throw error;

    return Response.json({ ok: true }, { headers: cors });
  }

  return new Response("Not found", { status: 404, headers: cors });
});
