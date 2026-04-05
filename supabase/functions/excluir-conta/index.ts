// supabase/functions/excluir-conta/index.ts
//
// Exclui permanentemente a conta de um prestador:
// 1. Remove o usuário do Supabase Auth
// 2. Remove o prestador do banco (CASCADE apaga dados relacionados)
//
// POST {} (sem body — usa o JWT para identificar o usuário)
// Header: Authorization: Bearer <supabase-jwt>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, validateOrigin, handleCorsPreflight } from "../_shared/cors.ts";

// CORS local antigo (substituído pelo módulo _shared/cors.ts)
// const cors = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// };

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin) ?? new Response("Forbidden", { status: 403 });
  }

  if (!validateOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const cors = corsHeaders(origin);

  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) {
      return Response.json({ erro: "Não autenticado" }, { status: 401, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Decodifica o JWT para pegar o user_id
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) {
      return Response.json({ erro: "Token inválido" }, { status: 401, headers: cors });
    }

    const userId = user.id;
    console.log("Excluindo conta do usuário:", userId);

    // 1. Remove do Supabase Auth usando Admin API (GoTrue Admin)
    const authAdminUrl = `${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users/${userId}`;
    const authRes = await fetch(authAdminUrl, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
      },
    });

    if (!authRes.ok) {
      const erroTexto = await authRes.text();
      console.error("Erro ao deletar do Auth:", authRes.status, erroTexto);
      return Response.json(
        { erro: "Erro ao excluir usuário do Auth", status: authRes.status, detalhe: erroTexto },
        { status: 500, headers: cors }
      );
    }

    console.log("Usuário removido do Auth com sucesso");

    // 2. Remove do banco (CASCADE apaga dados relacionados)
    const { error: errP } = await supabase
      .from("prestadores")
      .delete()
      .eq("id", userId);

    if (errP) {
      console.error("Erro ao deletar prestador:", errP);
      return Response.json(
        { erro: "Erro ao excluir conta do banco", detalhe: errP.message },
        { status: 500, headers: cors }
      );
    }

    console.log("Prestador removido do banco com sucesso");

    return Response.json(
      { ok: true, mensagem: "Conta excluída com sucesso" },
      { headers: cors }
    );
  } catch (err) {
    console.error("Erro:", err);
    return Response.json(
      { erro: "Erro interno", detalhe: String(err) },
      { status: 500, headers: cors }
    );
  }
});
