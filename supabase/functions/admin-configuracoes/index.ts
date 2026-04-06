import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
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

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action } = body;

    // ── STATUS DO SISTEMA ─────────────────────────────────────
    if (action === "status") {
      // Total prestadores por plano
      const { count: totalPro } = await supabase
        .from("prestadores")
        .select("*", { count: "exact", head: true })
        .eq("plano", "pro");

      const { count: totalFree } = await supabase
        .from("prestadores")
        .select("*", { count: "exact", head: true })
        .eq("plano", "free");

      // Total agendamentos
      const { count: totalAgendamentos } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true });

      // Segredos configurados (apenas verifica existência, não o valor)
      const adminPassword = Deno.env.get("ADMIN_PASSWORD") ? "✅ Configurado" : "❌ Não configurado";
      const asaasApiKey = Deno.env.get("ASAAS_API_KEY") ? "✅ Configurado" : "❌ Não configurado";
      const asaasWebhook = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ? "✅ Configurado" : "❌ Não configurado";

      return Response.json({
        totalPro: totalPro || 0,
        totalFree: totalFree || 0,
        totalAgendamentos: totalAgendamentos || 0,
        secrets: {
          ADMIN_PASSWORD: adminPassword,
          ASAAS_API_KEY: asaasApiKey,
          ASAAS_WEBHOOK_TOKEN: asaasWebhook,
        },
        timestamp: new Date().toISOString(),
      }, { headers: cors });
    }

    // ── ALTERAR SENHA ADMIN ──────────────────────────────────
    if (action === "alterar_senha") {
      const novaSenha = body.nova_senha;
      const senhaAtual = body.senha_atual;

      if (!novaSenha || novaSenha.length < 8) {
        return Response.json({ error: "A nova senha deve ter pelo menos 8 caracteres" }, { status: 400, headers: cors });
      }

      const senhaAtualConfig = Deno.env.get("ADMIN_PASSWORD");
      if (senhaAtualConfig && senhaAtual !== senhaAtualConfig) {
        return Response.json({ error: "Senha atual incorreta" }, { status: 401, headers: cors });
      }

      // Nota: Edge Functions não podem modificar secrets dinamicamente
      // A senha deve ser alterada via dashboard Supabase ou CLI
      return Response.json({
        ok: true,
        message: "Para alterar a senha, acesse o Dashboard do Supabase → Edge Functions → Secrets → ADMIN_PASSWORD, ou use: supabase secrets set ADMIN_PASSWORD='nova_senha'",
        instrucoes: "https://supabase.com/docs/guides/functions/secrets",
      }, { headers: cors });
    }

    // ── LISTAR FUNCOES ───────────────────────────────────────
    if (action === "listar_funcoes") {
      const funcoes = [
        { nome: "admin-validate", status: "deployed" },
        { nome: "admin-dashboard", status: "deployed" },
        { nome: "admin-profissionais", status: "deployed" },
        { nome: "admin-financeiro", status: "deployed" },
        { nome: "admin-actions", status: "deployed" },
        { nome: "admin-configuracoes", status: "deployed" },
        { nome: "criar-assinatura", status: "deployed" },
        { nome: "cancelar-assinatura", status: "deployed" },
        { nome: "webhook-asaas", status: "deployed" },
      ];

      return Response.json({ funcoes }, { headers: cors });
    }

    // ── LISTAR TABELAS ──────────────────────────────────────
    if (action === "listar_tabelas") {
      const { data, error } = await supabase
        .from("prestadores")
        .select("plano")
        .limit(0);

      if (error && !error.message.includes("0 rows")) {
        // Tenta via RPC para contar tabelas
      }

      // Retorna info manual das tabelas conhecidas
      const tabelas = [
        { nome: "prestadores", descricao: "Dados dos prestadores (planos, assinaturas, trial)" },
        { nome: "agendamentos", descricao: "Agendamentos de serviços" },
        { nome: "pagamentos", descricao: "Histórico de pagamentos e eventos" },
        { nome: "avaliacoes", descricao: "Avaliações de clientes" },
        { nome: "servicos", descricao: "Serviços oferecidos" },
        { nome: "horarios", descricao: "Horários disponíveis" },
        { nome: "bloqueios", descricao: "Bloqueios de agenda" },
      ];

      return Response.json({ tabelas }, { headers: cors });
    }

    return Response.json({ error: "Ação inválida" }, { status: 400, headers: cors });
  } catch (err) {
    console.error("admin-configuracoes error:", err);
    return Response.json({
      error: "Erro interno",
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500, headers: cors });
  }
});
