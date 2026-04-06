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
    const { action, page = 1, limit = 20, filtro = "todos" } = body;

    // ── KPIs FINANCEIROS ──────────────────────────────────────
    if (action === "kpis") {
      // Total prestadores ativos (pro)
      const { count: totalPro } = await supabase
        .from("prestadores")
        .select("*", { count: "exact", head: true })
        .eq("plano", "pro");

      // Total prestadores free
      const { count: totalFree } = await supabase
        .from("prestadores")
        .select("*", { count: "exact", head: true })
        .eq("plano", "free");

      // MRR estimado (pro MONTHLY = 39, YEARLY = 29*12/12 = 29)
      const { data: monthlyPro } = await supabase
        .from("prestadores")
        .select("id")
        .eq("plano", "pro")
        .eq("assinatura_periodicidade", "MONTHLY");

      const { data: yearlyPro } = await supabase
        .from("prestadores")
        .select("id")
        .eq("plano", "pro")
        .eq("assinatura_periodicidade", "YEARLY");

      const mrr = (monthlyPro?.length || 0) * 39 + (yearlyPro?.length || 0) * 29;

      // Receita dos ultimos 30 dias (pagamentos com valor)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: pagamentosRecentes } = await supabase
        .from("pagamentos")
        .select("valor")
        .gte("data_evento", thirtyDaysAgo.toISOString())
        .not("valor", "is", null);

      const receita30d = pagamentosRecentes?.reduce((sum, p) => sum + Number(p.valor), 0) || 0;

      // Churn: cancelamentos nos ultimos 30 dias
      const { count: cancelamentos } = await supabase
        .from("pagamentos")
        .select("*", { count: "exact", head: true })
        .eq("evento", "SUBSCRIPTION_CANCELLED_BY_USER")
        .gte("data_evento", thirtyDaysAgo.toISOString());

      // Total de prestadores
      const { count: totalPrestadores } = await supabase
        .from("prestadores")
        .select("*", { count: "exact", head: true });

      return Response.json({
        totalPro: totalPro || 0,
        totalFree: totalFree || 0,
        totalPrestadores: totalPrestadores || 0,
        mrr,
        receita30d,
        cancelamentos: cancelamentos || 0,
      }, { headers: cors });
    }

    // ── PAGAMENTOS RECENTES ───────────────────────────────────
    if (action === "pagamentos_recentes") {
      const offset = (page - 1) * limit;

      let query = supabase
        .from("pagamentos")
        .select(`
          *,
          prestadores (
            nome,
            email,
            plano
          )
        `, { count: "exact" })
        .order("data_evento", { ascending: false });

      if (filtro !== "todos") {
        query = query.eq("evento", filtro);
      }

      const { data, count, error } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      return Response.json({
        pagamentos: data || [],
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      }, { headers: cors });
    }

    // ── PRESTADORES POR PLANO ────────────────────────────────
    if (action === "por_plano") {
      const { data, error } = await supabase
        .from("prestadores")
        .select("plano, assinatura_periodicidade, plano_valido_ate, trial_ends_at")
        .eq("plano", "pro");

      if (error) throw error;

      const monthly = data?.filter(p => p.assinatura_periodicidade === "MONTHLY").length || 0;
      const yearly = data?.filter(p => p.assinatura_periodicidade === "YEARLY").length || 0;
      const trial = data?.filter(p => p.trial_ends_at && new Date(p.trial_ends_at) > new Date()).length || 0;
      const vencendo = data?.filter(p => {
        if (!p.plano_valido_ate) return false;
        const diff = new Date(p.plano_valido_ate).getTime() - Date.now();
        return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // 3 dias
      }).length || 0;

      return Response.json({
        monthly,
        yearly,
        trial,
        vencendo,
        total: data?.length || 0,
      }, { headers: cors });
    }

    return Response.json({ error: "Ação inválida" }, { status: 400, headers: cors });
  } catch (err) {
    console.error("admin-financeiro error:", err);
    return Response.json({
      error: "Erro interno",
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500, headers: cors });
  }
});
