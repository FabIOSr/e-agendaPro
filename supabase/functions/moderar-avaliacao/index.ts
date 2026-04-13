// supabase/functions/moderar-avaliacao/index.ts
//
// Edge Function para moderar avaliações:
// POST { avaliacao_id, acao: 'aprovar' | 'rejeitar', motivo? }
//
// Requer JWT do prestador (autenticado)
//
// Cron job pode chamar auto_aprovar_avaliacoes() para aprovar
// avaliações pendentes há mais de 24h.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  // Validar JWT do prestador
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ erro: "Token não fornecido" }, { status: 401, headers: cors });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Decodificar JWT e verificar se é prestador
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ erro: "Token inválido" }, { status: 401, headers: cors });
  }

  // Buscar perfil do prestador
  const { data: prestador } = await supabase
    .from("prestadores")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!prestador) {
    return Response.json({ erro: "Prestador não encontrado" }, { status: 404, headers: cors });
  }

  // Processar ação de moderação
  if (req.method === "POST") {
    const { avaliacao_id, acao, motivo } = await req.json();

    if (!avaliacao_id || !acao) {
      return Response.json(
        { erro: "avaliacao_id e acao são obrigatórios" },
        { status: 400, headers: cors }
      );
    }

    if (!["aprovar", "rejeitar"].includes(acao)) {
      return Response.json(
        { erro: "acao deve ser 'aprovar' ou 'rejeitar'" },
        { status: 400, headers: cors }
      );
    }

    // Verificar se a avaliação pertence a este prestador
    const { data: avaliacao, error: fetchError } = await supabase
      .from("avaliacoes")
      .select("id, prestador_id, status")
      .eq("id", avaliacao_id)
      .single();

    if (fetchError || !avaliacao) {
      return Response.json({ erro: "Avaliação não encontrada" }, { status: 404, headers: cors });
    }

    if (avaliacao.prestador_id !== prestador.id) {
      return Response.json({ erro: "Não autorizado" }, { status: 403, headers: cors });
    }

    if (avaliacao.status !== "pendente") {
      return Response.json(
        { erro: `Avaliação já foi moderada (${avaliacao.status})` },
        { status: 400, headers: cors }
      );
    }

    // Aplicar moderação
    const novoStatus = acao === "aprovar" ? "aprovada" : "rejeitada";
    const { error: updateError } = await supabase
      .from("avaliacoes")
      .update({
        status: novoStatus,
        moderada_em: new Date().toISOString(),
        motivo_rejeicao: motivo || null,
      })
      .eq("id", avaliacao_id);

    if (updateError) {
      console.error("Erro ao moderar avaliação:", updateError);
      return Response.json({ erro: "Erro ao atualizar" }, { status: 500, headers: cors });
    }

    return Response.json({
      ok: true,
      avaliacao_id,
      acao,
      status: novoStatus,
    }, { headers: cors });
  }

  // GET: listar avaliações pendentes do prestador
  if (req.method === "GET") {
    const { data: avaliacoes, error } = await supabase
      .from("avaliacoes")
      .select("id, nota, comentario, cliente_nome, created_at, status")
      .eq("prestador_id", prestador.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar avaliações:", error);
      return Response.json({ erro: "Erro ao buscar" }, { status: 500, headers: cors });
    }

    return Response.json({ avaliacoes: avaliacoes ?? [] }, { headers: cors });
  }

  return Response.json({ erro: "Método não permitido" }, { status: 405, headers: cors });
});