import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Valida token admin
async function validateAdminToken(req: Request): Promise<boolean> {
  const adminToken = req.headers.get('x-admin-token');
  if (!adminToken) return false;

  const adminPassword = Deno.env.get('ADMIN_PASSWORD');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const decoded = JSON.parse(atob(adminToken));
    const age = Date.now() - decoded.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    return age <= maxAge;
  } catch {
    return false;
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Apenas GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Valida auth
  const isValid = await validateAdminToken(req);
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── KPI: Total de prestadores ─────────────────────────────────
    const { count: totalPrestadores } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true });

    // ── KPI: Plano Pro ────────────────────────────────────────────
    const { count: planoPro } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true })
      .eq('plano', 'pro');

    // ── KPI: Plano Free ───────────────────────────────────────────
    const { count: planoFree } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true })
      .or('plano.eq.free,plano.is.null');

    // ── KPI: Trial ────────────────────────────────────────────────
    const { count: planoTrial } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true })
      .not('trial_ends_at', 'is', null);

    // ── KPI: MRR (Receita Mensal Recorrente) ──────────────────────
    const precoPro = 49.90;
    const mrr = (planoPro || 0) * precoPro;

    // ── KPI: Novos nos últimos 7 dias ─────────────────────────────
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    seteDiasAtras.setHours(0, 0, 0, 0);

    const { count: novos7Dias } = await supabase
      .from('prestadores')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', seteDiasAtras.toISOString());

    // ── KPI: Agendamentos do mês ──────────────────────────────────
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count: agendamentosMes } = await supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmado')
      .gte('created_at', inicioMes.toISOString());

    // ── TABELA: Últimos 10 prestadores ────────────────────────────
    const { data: novosUsuarios, error: errorUsuarios } = await supabase
      .from('prestadores')
      .select(`
        id, nome, email, plano, trial_ends_at, created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Conta agendamentos por usuário (batch)
    const agendamentosMap: Record<string, number> = {};
    if (novosUsuarios && novosUsuarios.length > 0) {
      const ids = novosUsuarios.map(u => u.id);
      const { data: ags } = await supabase
        .from('agendamentos')
        .select('prestador_id')
        .in('prestador_id', ids)
        .eq('status', 'confirmado');

      if (ags) {
        ags.forEach(ag => {
          agendamentosMap[ag.prestador_id] = (agendamentosMap[ag.prestador_id] || 0) + 1;
        });
      }
    }

    const novosUsuariosFormatados = (novosUsuarios || []).map(u => {
      let planoAtual = u.plano || 'free';

      // Verifica se está em trial ativo
      if (u.trial_ends_at) {
        const trialEnd = new Date(u.trial_ends_at);
        if (trialEnd > new Date()) {
          planoAtual = 'trial';
          const daysRemaining = Math.ceil(
            (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          return {
            id: u.id,
            nome: u.nome,
            email: u.email,
            plano: planoAtual,
            trial_dias: daysRemaining,
            created_at: u.created_at,
            agendamentos: agendamentosMap[u.id] || 0
          };
        }
      }

      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        plano: planoAtual,
        trial_dias: 0,
        created_at: u.created_at,
        agendamentos: agendamentosMap[u.id] || 0
      };
    });

    // ── RETORNA DADOS ─────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        total_prestadores: totalPrestadores || 0,
        plano_pro: planoPro || 0,
        plano_free: planoFree || 0,
        plano_trial: planoTrial || 0,
        mrr,
        novos_7_dias: novos7Dias || 0,
        desde_7_dias: seteDiasAtras.toLocaleDateString('pt-BR'),
        agendamentos_mes: agendamentosMes || 0,
        novos_usuarios: novosUsuariosFormatados.slice(0, 5) // Mostra só 5 no dashboard
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro em admin-dashboard:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
