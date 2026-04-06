import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Valida token admin (mesma lógica das outras functions)
async function validateAdminToken(req: Request): Promise<boolean> {
  const adminToken = req.headers.get('x-admin-token');
  if (!adminToken) return false;

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

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
    // ── PARÂMETROS DA QUERY ───────────────────────────────────────
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const planoFilter = url.searchParams.get('plano') || ''; // pro, free, trial, todos

    const offset = (page - 1) * limit;

    // ── QUERY BASE ────────────────────────────────────────────────
    let query = supabase
      .from('prestadores')
      .select('*', { count: 'exact' });

    // Busca por nome ou email
    if (search) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    // Filtro por plano
    if (planoFilter === 'pro') {
      query = query.eq('plano', 'pro');
    } else if (planoFilter === 'free') {
      query = query.or('plano.eq.free,plano.is.null');
    } else if (planoFilter === 'trial') {
      query = query.not('trial_ends_at', 'is', null);
    }
    // 'todos' = sem filtro

    // Paginação
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: prestadores, count: total, error } = await query;

    if (error) {
      console.error('Erro ao buscar prestadores:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar dados' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── AGENDAMENTOS (batch) ──────────────────────────────────────
    const agendamentosMap: Record<string, number> = {};
    const avaliacoesMap: Record<string, { media: number; total: number }> = {};

    if (prestadores && prestadores.length > 0) {
      const ids = prestadores.map(p => p.id);

      // Agendamentos confirmados
      const { data: ags } = await supabase
        .from('agendamentos')
        .select('prestador_id, status')
        .in('prestador_id', ids);

      if (ags) {
        ags.forEach(ag => {
          if (ag.status === 'confirmado' || ag.status === 'concluido') {
            agendamentosMap[ag.prestador_id] = (agendamentosMap[ag.prestador_id] || 0) + 1;
          }
        });
      }

      // Avaliações
      const { data: avgs } = await supabase
        .from('avaliacoes')
        .select('prestador_id, nota')
        .in('prestador_id', ids);

      if (avgs) {
        avgs.forEach(av => {
          if (!avaliacoesMap[av.prestador_id]) {
            avaliacoesMap[av.prestador_id] = { media: 0, total: 0, soma: 0 };
          }
          avaliacoesMap[av.prestador_id].total++;
          avaliacoesMap[av.prestador_id].soma += av.nota;
        });

        // Calcula média
        Object.keys(avaliacoesMap).forEach(id => {
          const item = avaliacoesMap[id];
          item.media = item.total > 0 ? Math.round((item.soma / item.total) * 10) / 10 : 0;
          delete item.soma;
        });
      }
    }

    // ── FORMATA DADOS ─────────────────────────────────────────────
    const prestadoresFormatados = (prestadores || []).map(p => {
      let planoAtual = p.plano || 'free';
      let trialDias = 0;

      if (p.trial_ends_at) {
        const trialEnd = new Date(p.trial_ends_at);
        if (trialEnd > new Date()) {
          planoAtual = 'trial';
          trialDias = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        }
      }

      return {
        id: p.id,
        nome: p.nome,
        email: p.email,
        slug: p.slug,
        whatsapp: p.whatsapp,
        plano: planoAtual,
        trial_dias: trialDias,
        plano_valido_ate: p.plano_valido_ate,
        total_agendamentos: agendamentosMap[p.id] || 0,
        avaliacao_media: avaliacoesMap[p.id]?.media || null,
        avaliacao_total: avaliacoesMap[p.id]?.total || 0,
        created_at: p.created_at,
      };
    });

    const totalPages = Math.ceil((total || 0) / limit);

    return new Response(
      JSON.stringify({
        prestadores: prestadoresFormatados,
        total,
        page,
        limit,
        total_pages: totalPages,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em admin-profissionais:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
